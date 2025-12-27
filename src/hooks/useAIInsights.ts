import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useRowingStore } from '@/lib/store';
import { Session } from '@/types/session';
import { aiAnalysis, Insight, TrendData, TrainingLoadData, AnomalyData } from '@/lib/aiAnalysis';
import { cloudAI, CloudInsight } from '@/lib/cloudAI';
import { initializeCloudAIFromSettings, isAIAvailable, getAIConfigurationErrorMessage } from '@/lib/aiConfig';
import { memoryStorage } from '@/lib/memoryStorage';
import { saveInsightsToDB, fetchInsightsFromDB } from '@/lib/dataSync';

export interface AIInsightData {
  insights: (Insight | CloudInsight)[];
  trends: TrendData[];
  trainingLoad: TrainingLoadData | null;
  anomalies: AnomalyData[];
  isAnalyzable: boolean;
  lastAnalyzed: Date | null;
  usingCloudAI: boolean;
  cloudAIError: string | null;
  isCloudAIConfigured: boolean;
  isGenerating: boolean;
  refreshInsights?: () => void;
  refreshArchivedInsights?: () => Promise<void>;
  archivedInsights?: (Insight | CloudInsight)[];
  archiveInsight?: (insightId: string) => void;
  unarchiveInsight?: (insightId: string) => void;
  deleteInsight?: (insightId: string) => void;
  isArchivedView?: boolean;
  setIsArchivedView?: (isArchived: boolean) => void;
}

const AUTO_ARCHIVE_DAYS = 30; // Archive insights older than 30 days

// Sync insights to memory storage for AI coach access
const syncInsightsToMemory = async (insights: (Insight | CloudInsight)[], usingCloudAI: boolean): Promise<void> => {
  if (insights.length === 0) return;

  try {
    await memoryStorage.addSystemDocument(
      'insight',
      `AI Insights - ${new Date().toLocaleDateString()}`,
      {
        generatedAt: new Date().toISOString(),
        source: usingCloudAI ? 'cloud-ai' : 'local-analysis',
        insightCount: insights.length,
        insights: insights.map(insight => ({
          id: insight.id,
          type: insight.type,
          title: insight.title,
          description: insight.description,
          priority: insight.priority,
          category: 'category' in insight ? insight.category : undefined,
          dateGenerated: insight.dateGenerated,
        }))
      },
      {
        description: `${insights.length} insights from ${usingCloudAI ? 'AI analysis' : 'local analysis'}`
      }
    );

    // Keep only the latest 3 insights in memory to avoid clutter
    await memoryStorage.cleanupOldInsights(3);
  } catch (error) {
    console.warn('Failed to sync insights to memory:', error);
  }
};

// Helper to add items to archive with deduplication
const addToArchive = (existing: (Insight | CloudInsight)[], newItems: (Insight | CloudInsight)[]): (Insight | CloudInsight)[] => {
  const existingIds = new Set(existing.map(i => i.id));
  const uniqueNewItems = newItems.filter(i => !existingIds.has(i.id));
  return [...existing, ...uniqueNewItems];
};

const persistInsightUpdateToDB = async (insight: any): Promise<void> => {
  try {
    await saveInsightsToDB([insight]);
  } catch (error) {
    console.warn('[useAIInsights] Failed to persist insight update to database:', error);
  }
};

const deleteInsightFromDB = async (insightId: string): Promise<void> => {
  try {
    const response = await fetch('/api/insights', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insightId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.warn('[useAIInsights] Failed to delete insight from DB:', error?.error || response.statusText);
    }
  } catch (error) {
    console.warn('[useAIInsights] Error deleting insight from DB:', error);
  }
};

// Fetch insights from database (DB-first pattern)
const fetchInsightsFromDatabase = async (): Promise<{ active: (Insight | CloudInsight)[], archived: (Insight | CloudInsight)[] }> => {
  try {
    console.log('[INSIGHTS DB] Fetching insights from database...');
    const dbInsights = await fetchInsightsFromDB();
    
    if (!dbInsights || dbInsights.length === 0) {
      console.log('[INSIGHTS DB] No insights in database');
      return { active: [], archived: [] };
    }
    
    // Separate active and archived insights
    const active: (Insight | CloudInsight)[] = [];
    const archived: (Insight | CloudInsight)[] = [];
    
    dbInsights.forEach((insight: any) => {
      const processedInsight = {
        ...insight,
        dateGenerated: new Date(insight.dateGenerated || Date.now())
      };
      
      if (insight.archived) {
        archived.push(processedInsight);
      } else {
        active.push(processedInsight);
      }
    });
    
    console.log('[INSIGHTS DB] Loaded', active.length, 'active and', archived.length, 'archived insights from DB');
    return { active, archived };
  } catch (error) {
    console.error('[INSIGHTS DB] Error fetching insights:', error);
    return { active: [], archived: [] };
  }
};


// Auto-archive old insights
const autoArchiveOldInsights = (insights: (Insight | CloudInsight)[]): {
  updatedInsights: (Insight | CloudInsight)[];
  newlyArchived: (Insight | CloudInsight)[];
} => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - AUTO_ARCHIVE_DAYS);

  const oldInsights = insights.filter(insight => {
    const insightDate = new Date(insight.dateGenerated);
    return insightDate < cutoffDate;
  });

  const updatedInsights = insights.filter(insight => {
    const insightDate = new Date(insight.dateGenerated);
    return insightDate >= cutoffDate;
  });

  return {
    updatedInsights,
    newlyArchived: oldInsights
  };
};

export function useAIInsights(forceRefresh: boolean = false): AIInsightData {
  const { getSessions } = useRowingStore();
  const sessions = getSessions();
  const [cloudAIError, setCloudAIError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isArchivedView, setIsArchivedView] = useState(false);
  const dbLoadedRef = useRef(false);
  const analysisInFlightRef = useRef(false);

  // Load archived insights state
  const [archivedInsightsState, setArchivedInsightsState] = useState<(Insight | CloudInsight)[]>([]);
  const [archivedLoaded, setArchivedLoaded] = useState(false);
  const [dbInsightsLoaded, setDbInsightsLoaded] = useState(false);

  const [revisions, setRevisions] = useState<{ sessionsRevision: number; insightsRevision: number } | null>(null);
  const revisionsLoadedRef = useRef(false);

  // Load revision markers from DB on mount (reload-stable)
  useEffect(() => {
    if (revisionsLoadedRef.current) return;
    revisionsLoadedRef.current = true;

    const loadRevisions = async () => {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) {
          setRevisions({ sessionsRevision: 0, insightsRevision: 0 });
          return;
        }
        const data = await res.json();
        const s = data?.settings;
        setRevisions({
          sessionsRevision: typeof s?.sessionsRevision === 'number' ? s.sessionsRevision : 0,
          insightsRevision: typeof s?.insightsRevision === 'number' ? s.insightsRevision : 0,
        });
      } catch {
        setRevisions({ sessionsRevision: 0, insightsRevision: 0 });
      }
    };

    loadRevisions();
  }, []);

  // DB-first: Load insights from database on mount
  useEffect(() => {
    if (dbLoadedRef.current) return;
    dbLoadedRef.current = true;

    const loadFromDB = async () => {
      try {
        console.log('[INSIGHTS] Loading insights from database (DB-first)...');
        const { active, archived } = await fetchInsightsFromDatabase();
        
        setArchivedInsightsState(archived);
        setArchivedLoaded(true);
        setDbInsightsLoaded(true);
        
        // If we have active insights from DB, use them
        if (active.length > 0) {
          console.log('[INSIGHTS] Using', active.length, 'active insights from DB');
          setData(prev => ({
            ...prev,
            insights: active,
            archivedInsights: archived,
            lastAnalyzed: active[0]?.dateGenerated || null
          }));
        }
      } catch (error) {
        console.error('[INSIGHTS] Error loading from DB:', error);
        setArchivedInsightsState([]);
        setArchivedLoaded(true);
        setDbInsightsLoaded(true);
      }
    };

    loadFromDB();
  }, []);

  // State for analysis results
  const [data, setData] = useState<AIInsightData>({
    insights: [],
    trends: [],
    trainingLoad: null,
    anomalies: [],
    isAnalyzable: false,
    lastAnalyzed: null,
    usingCloudAI: false,
    cloudAIError: null,
    isCloudAIConfigured: false,
    isGenerating: false,
    archivedInsights: [],
    isArchivedView: false
  });

  // Initialize cloud AI from user settings
  const initializeCloudAI = useCallback(() => {
    try {
      const isConfigured = initializeCloudAIFromSettings();
      if (isConfigured) {
        setCloudAIError(null);
      } else {
        // Set error message if initialization failed
        const errorMessage = getAIConfigurationErrorMessage();
        setCloudAIError(errorMessage);
      }
      return isConfigured;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize Cloud AI';
      setCloudAIError(errorMessage);
      return false;
    }
  }, []);

  // Manual refresh function
  const refreshInsights = useCallback(() => {
    // Archive all existing insights before refresh (DB + in-memory only)
    setData(prevData => {
      if (prevData.insights.length > 0) {
        const now = new Date();
        const toArchive = prevData.insights.map(i => ({
          ...i,
          archived: true,
          archivedAt: now.toISOString(),
        }));

        toArchive.forEach(i => {
          persistInsightUpdateToDB(i);
        });

        setArchivedInsightsState(prevArchived => addToArchive(prevArchived, toArchive));

        return {
          ...prevData,
          insights: [],
          archivedInsights: addToArchive(prevData.archivedInsights || [], toArchive)
        };
      }
      return prevData;
    });

    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Archive insight function
  const archiveInsightCallback = useCallback((insightId: string) => {
    setData(prevData => {
      const insightToArchive = prevData.insights.find(insight => insight.id === insightId);
      if (!insightToArchive) {
        return prevData;
      }

      const updatedInsights = prevData.insights.filter(insight => insight.id !== insightId);
      const archivedInsight = {
        ...insightToArchive,
        archived: true,
        archivedAt: new Date().toISOString(),
      };

      persistInsightUpdateToDB(archivedInsight);

      const updatedArchived = addToArchive(archivedInsightsState, [archivedInsight]);
      setArchivedInsightsState(updatedArchived);
      return {
        ...prevData,
        insights: updatedInsights,
        archivedInsights: updatedArchived
      };
    });
  }, [archivedInsightsState]);

  // Unarchive insight function
  const unarchiveInsightCallback = useCallback((insightId: string) => {
    const insightToUnarchive = archivedInsightsState.find(insight => insight.id === insightId);
    if (!insightToUnarchive) {
      console.error('Failed to unarchive insight: not found');
      return;
    }

    const unarchivedInsight = {
      ...insightToUnarchive,
      archived: false,
      archivedAt: null,
    };

    persistInsightUpdateToDB(unarchivedInsight);

    const updatedArchived = archivedInsightsState.filter(insight => insight.id !== insightId);
    setArchivedInsightsState(updatedArchived);
    setData(prevData => ({
      ...prevData,
      insights: [...prevData.insights, unarchivedInsight],
      archivedInsights: updatedArchived
    }));
  }, [archivedInsightsState]);

  // Refresh archived insights from database (for after clearing archive)
  const refreshArchivedInsights = useCallback(async () => {
    try {
      console.log('[INSIGHTS] Refreshing archived insights from database...');
      const { archived } = await fetchInsightsFromDatabase();
      
      // Update state
      setArchivedInsightsState(archived);
      setData(prevData => ({
        ...prevData,
        archivedInsights: archived
      }));
      
      console.log('[INSIGHTS] Refreshed', archived.length, 'archived insights from database');
    } catch (error) {
      console.error('[INSIGHTS] Failed to refresh archived insights:', error);
    }
  }, []);

  // Set archived view function
  const setIsArchivedViewCallback = useCallback((isArchived: boolean) => {
    setIsArchivedView(isArchived);
    setData(prevData => ({
      ...prevData,
      isArchivedView: isArchived
    }));
  }, []);

  // Delete insight function
  const deleteInsightCallback = useCallback((insightId: string) => {
    deleteInsightFromDB(insightId);
    const updatedArchived = archivedInsightsState.filter(insight => insight.id !== insightId);
    setArchivedInsightsState(updatedArchived);
    setData(prevData => ({
      ...prevData,
      archivedInsights: updatedArchived
    }));
  }, [archivedInsightsState]);

  const getLocalAnalysis = async (sessionData: Session[]) => {
    try {
      const insights = await aiAnalysis.generateInsights(sessionData);
      const trends = [
        aiAnalysis.analyzeTrend(sessionData, 'avgSplit'),
        aiAnalysis.analyzeTrend(sessionData, 'avgPower'),
        aiAnalysis.analyzeTrend(sessionData, 'avgStrokeRate'),
        aiAnalysis.analyzeTrend(sessionData, 'distance')
      ].filter((trend): trend is TrendData => trend !== null);

      const trainingLoad = aiAnalysis.calculateTrainingLoad(sessionData);
      const anomalies = aiAnalysis.detectAnomalies(sessionData);

      // Auto-archive old insights
      const { updatedInsights } = autoArchiveOldInsights(insights.slice(0, 5));

      // Auto-archive old insights silently

      return {
        insights: updatedInsights,
        trends,
        trainingLoad,
        anomalies: anomalies.slice(0, 3),
        isAnalyzable: true,
        lastAnalyzed: new Date(),
        usingCloudAI: false,
        cloudAIError: null,
        isCloudAIConfigured: false,
        isGenerating: false
      };
    } catch (error) {
      console.error('Local analysis failed:', error);
      return {
        insights: [],
        trends: [],
        trainingLoad: null,
        anomalies: [],
        isAnalyzable: false,
        lastAnalyzed: null,
        usingCloudAI: false,
        cloudAIError: 'Local analysis failed',
        isCloudAIConfigured: false,
        isGenerating: false
      };
    }
  };

  // Main analysis function
  const performAnalysis = useCallback(async () => {
    const isAnalyzable = sessions.length >= 3;
    const isCloudAIConfigured = initializeCloudAI();
    const isAIAvailableForUse = isCloudAIConfigured && isAIAvailable();

    // If AI is not configured, return special state with no insights but still show archived insights
    if (!isCloudAIConfigured) {
      return {
        insights: [],
        trends: [],
        trainingLoad: null,
        anomalies: [],
        isAnalyzable: false,
        lastAnalyzed: null,
        usingCloudAI: false,
        cloudAIError: 'AI connection not configured. Please configure AI settings to generate insights.',
        isCloudAIConfigured: false,
        isGenerating: false
      };
    }

    if (!isAnalyzable) {
      return {
        insights: [],
        trends: [],
        trainingLoad: null,
        anomalies: [],
        isAnalyzable: false,
        lastAnalyzed: null,
        usingCloudAI: false,
        cloudAIError: null,
        isCloudAIConfigured,
        isGenerating: false
      };
    }

    // Try Cloud AI first if configured and available
    if (isAIAvailableForUse) {
      setIsAnalyzing(true);
      try {
        // Initialize cloud AI with latest settings
        initializeCloudAI();

        // Generate insights using cloud AI
        const cloudInsights = await cloudAI.generateInsights(sessions);

        // Generate local trends and other data (cloud AI only handles insights)
        const trends = [
          aiAnalysis.analyzeTrend(sessions, 'avgSplit'),
          aiAnalysis.analyzeTrend(sessions, 'avgPower'),
          aiAnalysis.analyzeTrend(sessions, 'avgStrokeRate'),
          aiAnalysis.analyzeTrend(sessions, 'distance')
        ].filter((trend): trend is TrendData => trend !== null);

        const trainingLoad = aiAnalysis.calculateTrainingLoad(sessions);
        const anomalies = aiAnalysis.detectAnomalies(sessions);

        setIsAnalyzing(false);
        setCloudAIError(null);

        return {
          insights: cloudInsights.slice(0, 5),
          trends,
          trainingLoad,
          anomalies: anomalies.slice(0, 3),
          isAnalyzable: true,
          lastAnalyzed: new Date(),
          usingCloudAI: true,
          cloudAIError: null,
          isCloudAIConfigured: true,
          isGenerating: false
        };
      } catch (error) {
        console.error('Cloud AI failed, falling back to local analysis:', error);
        setIsAnalyzing(false);
        const errorMessage = error instanceof Error ? error.message : 'Cloud AI error';
        setCloudAIError(errorMessage);

        // Fallback to local analysis
        const localResult = await getLocalAnalysis(sessions);
        return localResult;
      }
    }

    // Use local analysis
    const localResult = await getLocalAnalysis(sessions);
    return localResult;
  }, [sessions, initializeCloudAI]);

  // Run analysis when sessions change or refresh is triggered
  useEffect(() => {
    let isMounted = true;

    const runAnalysis = async () => {
      if (analysisInFlightRef.current) return;

      const sessionsChanged = revisions ? revisions.sessionsRevision !== revisions.insightsRevision : null;

      console.log('[INSIGHTS] Analysis triggered:', {
        forceRefresh,
        sessionCount: sessions.length,
        sessionsChanged
      });

      // Don't run analysis if we have no sessions yet (avoid race condition during initial load)
      if (sessions.length === 0) {
        console.log('[INSIGHTS] No sessions loaded yet - skipping');
        return;
      }

      // Wait until DB insights + revision markers are loaded so we can make a correct decision.
      if (!dbInsightsLoaded || revisions === null) {
        return;
      }

      // If insights in DB are already up-to-date with the current sessions dataset, do not regenerate on reload.
      const insightsAreCurrent = revisions.sessionsRevision === revisions.insightsRevision;

      if (!forceRefresh && insightsAreCurrent) {
        return;
      }

      try {
        analysisInFlightRef.current = true;

        // No local caching: always rely on DB + in-memory state
        let currentArchived = archivedInsightsState;

        // Generate new insights
        const result = await performAnalysis();
        if (isMounted) {
          const updatedResult = {
            ...result,
            archivedInsights: currentArchived,
            isArchivedView
          };

          // Persist insights to DB (source of truth)
          saveInsightsToDB(updatedResult.insights || [], { markAsCurrent: true })
            .catch(err => console.warn('[useAIInsights] Failed to save insights to database:', err));

          // Sync insights to memory for AI coach access (async, non-blocking)
          syncInsightsToMemory(updatedResult.insights, updatedResult.usingCloudAI);

          setData(updatedResult);

          // Refresh revision markers after a successful generation so future reloads don't retrigger.
          try {
            const res = await fetch('/api/settings');
            if (res.ok) {
              const newData = await res.json();
              const s = newData?.settings;
              setRevisions({
                sessionsRevision: typeof s?.sessionsRevision === 'number' ? s.sessionsRevision : 0,
                insightsRevision: typeof s?.insightsRevision === 'number' ? s.insightsRevision : 0,
              });
            }
          } catch {
            // ignore
          }
        }
      } catch (error) {
        console.error('Analysis error:', error);
        if (isMounted) {
          const localResult = await getLocalAnalysis(sessions);
          setData(localResult);
        }
      } finally {
        analysisInFlightRef.current = false;
      }
    };

    runAnalysis();

    return () => {
      isMounted = false;
    };
  }, [performAnalysis, sessions, refreshTrigger, forceRefresh, initializeCloudAI, archivedInsightsState, isArchivedView, dbInsightsLoaded, revisions, data.insights]);

  // Compute isAnalyzable directly from sessions count to ensure it's always accurate
  // (not dependent on async analysis completing)
  const isAnalyzable = sessions.length >= 3;

  // Use archivedInsightsState as the source of truth (loaded immediately on mount)
  // Fall back to data.archivedInsights if state hasn't been updated yet
  const archivedInsights = archivedInsightsState.length > 0 
    ? archivedInsightsState 
    : (data.archivedInsights || []);

  return {
    ...data,
    isAnalyzable,
    isGenerating: isAnalyzing,
    archivedInsights,
    refreshInsights,
    refreshArchivedInsights,
    archiveInsight: archiveInsightCallback,
    unarchiveInsight: unarchiveInsightCallback,
    deleteInsight: deleteInsightCallback,
    setIsArchivedView: setIsArchivedViewCallback
  };
}

// Async function for cloud AI insights (to be used with proper async handling)
export async function getCloudInsights(sessions: Session[]): Promise<CloudInsight[]> {
  try {
    if (!cloudAI.isConfigured()) {
      throw new Error('Cloud AI not configured');
    }

    const insights = await cloudAI.generateInsights(sessions);
    return insights;
  } catch (error) {
    console.error('Cloud AI analysis failed:', error);
    throw error;
  }
}

// Helper hook for insight feedback (supports both local and cloud insights)
export function useInsightFeedback() {
  const handleInsightFeedback = (insightId: string, feedback: 'helpful' | 'not_helpful' | 'action_taken') => {
    // Guard against SSR/non-browser environments
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    // Store feedback in localStorage for future ML improvements
    const feedbackKey = `insight_feedback_${insightId}`;
    const existingFeedback = localStorage.getItem(feedbackKey);

    if (!existingFeedback) {
      const feedbackData = {
        insightId,
        feedback,
        timestamp: new Date().toISOString(),
        source: insightId.startsWith('cloud-') ? 'cloud-ai' : 'local-analysis'
      };

      localStorage.setItem(feedbackKey, JSON.stringify(feedbackData));

      // In a real implementation, this would send feedback to a server
      // for improving the AI recommendation algorithms
    }
  };

  const getInsightFeedback = (insightId: string) => {
    // Guard against SSR/non-browser environments
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return null;
    }

    const feedbackKey = `insight_feedback_${insightId}`;
    const feedbackData = localStorage.getItem(feedbackKey);

    return feedbackData ? JSON.parse(feedbackData) : null;
  };

  return {
    recordFeedback: handleInsightFeedback,
    getFeedback: getInsightFeedback
  };
}
