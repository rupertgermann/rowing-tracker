import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useRowingStore } from '@/lib/store';
import { Session } from '@/types/session';
import { aiAnalysis, Insight, TrendData, TrainingLoadData, AnomalyData } from '@/lib/aiAnalysis';
import { cloudAI, CloudInsight } from '@/lib/cloudAI';
import { initializeCloudAIFromSettings, isAIAvailable, getAIConfigurationErrorMessage } from '@/lib/aiConfig';
import { memoryStorage } from '@/lib/memoryStorage';
import { saveInsightsToDB, fetchInsightsFromDB } from '@/lib/dataSync';
import { SettingsService } from '@/lib/settings';
import { buildPostureAIPayload, assertNoKeypointsInPayload, PostureAIPayload } from '@/lib/mocap/aiPayload';

async function fetchPosturePayload(): Promise<PostureAIPayload | null> {
  const settings = SettingsService.getInstance().getSettings();
  const { cloudAIEnabled, mocapDetailedAIShare } = settings.aiSettings;
  if (!cloudAIEnabled) return null;

  try {
    const res = await fetch('/api/mocap/posture-summary');
    if (!res.ok) return null;
    const { faults, metrics, qualityFlags, qualityScore } = await res.json();

    if (!faults?.length && !metrics?.length) return null;

    const payload = buildPostureAIPayload(faults, metrics, qualityFlags ?? [], qualityScore ?? null, {
      cloudAIEnabled,
      mocapDetailedAIShare,
    });
    if (payload) assertNoKeypointsInPayload(payload);
    return payload;
  } catch {
    return null;
  }
}

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
    const dbInsights = await fetchInsightsFromDB();
    
    if (!dbInsights || dbInsights.length === 0) {
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
  const [dbActiveInsightsCount, setDbActiveInsightsCount] = useState<number | null>(null); // Track DB-loaded active insights count

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
        const { active, archived } = await fetchInsightsFromDatabase();

        setArchivedInsightsState(archived);
        setArchivedLoaded(true);
        setDbActiveInsightsCount(active.length); // Track how many active insights we loaded from DB

        // If we have active insights from DB, use them
        if (active.length > 0) {
          setData(prev => ({
            ...prev,
            insights: active,
            archivedInsights: archived,
            lastAnalyzed: active[0]?.dateGenerated || null
          }));
        }

        // Set dbInsightsLoaded AFTER all state updates
        setDbInsightsLoaded(true);
      } catch (error) {
        console.error('[INSIGHTS] Error loading from DB:', error);
        setArchivedInsightsState([]);
        setArchivedLoaded(true);
        setDbActiveInsightsCount(0);
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

    // Reset DB active insights count to force regeneration
    setDbActiveInsightsCount(0);
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
      const { archived } = await fetchInsightsFromDatabase();
      
      // Update state
      setArchivedInsightsState(archived);
      setData(prevData => ({
        ...prevData,
        archivedInsights: archived
      }));
      
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
    // Note: Loading state (isAnalyzing) is now managed by runAnalysis for consistent behavior
    if (isAIAvailableForUse) {
      try {
        // Initialize cloud AI with latest settings
        initializeCloudAI();

        // Build tiered posture payload (null when cloud AI disabled or no data)
        const posturePayload = await fetchPosturePayload();

        // Generate insights using cloud AI
        const cloudInsights = await cloudAI.generateInsights(sessions, posturePayload);

        // Generate local trends and other data (cloud AI only handles insights)
        const trends = [
          aiAnalysis.analyzeTrend(sessions, 'avgSplit'),
          aiAnalysis.analyzeTrend(sessions, 'avgPower'),
          aiAnalysis.analyzeTrend(sessions, 'avgStrokeRate'),
          aiAnalysis.analyzeTrend(sessions, 'distance')
        ].filter((trend): trend is TrendData => trend !== null);

        const trainingLoad = aiAnalysis.calculateTrainingLoad(sessions);
        const anomalies = aiAnalysis.detectAnomalies(sessions);

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
      if (analysisInFlightRef.current) {
        return;
      }

      // Don't run analysis if we have no sessions yet (avoid race condition during initial load)
      if (sessions.length === 0) {
        return;
      }

      // Wait until DB insights + revision markers are loaded so we can make a correct decision.
      if (!dbInsightsLoaded || revisions === null || dbActiveInsightsCount === null) {
        return;
      }

      // Check if we have any active (non-archived) insights from DB
      // Use dbActiveInsightsCount (set during DB load) instead of data.insights to avoid stale state issues
      const hasActiveInsightsInDB = dbActiveInsightsCount > 0;

      // If insights in DB are already up-to-date with the current sessions dataset, do not regenerate on reload.
      const insightsAreCurrent = revisions.sessionsRevision === revisions.insightsRevision;

      // Skip regeneration only if: not forced, revisions match, AND we have active insights in DB
      if (!forceRefresh && insightsAreCurrent && hasActiveInsightsInDB) {
        return;
      }

      // Set loading state IMMEDIATELY when we decide to regenerate (same as manual refresh flow)
      setIsAnalyzing(true);
      analysisInFlightRef.current = true;

      // Calculate what needs to be archived (but DON'T update state yet - it's in effect dependencies)
      let currentArchived = archivedInsightsState;
      let insightsToArchive: typeof data.insights = [];
      if (data.insights && data.insights.length > 0) {
        const now = new Date();
        insightsToArchive = data.insights.map(i => ({
          ...i,
          archived: true,
          archivedAt: now.toISOString(),
        }));

        // Persist archived insights to DB (fire-and-forget, doesn't affect state)
        for (const insight of insightsToArchive) {
          persistInsightUpdateToDB(insight);
        }

        // Calculate new archived list (but don't set state yet!)
        currentArchived = addToArchive(currentArchived, insightsToArchive);
      }

      // CRITICAL: Clear current insights immediately so UI shows loading state
      // This mirrors what refreshInsights() does - it clears insights before triggering regeneration
      // NOTE: We set archivedInsights in data but NOT archivedInsightsState to avoid effect re-run
      setData(prev => ({
        ...prev,
        insights: [],
        archivedInsights: currentArchived
      }));

      try {

        // Generate new insights
        const result = await performAnalysis();
        if (isMounted) {
          const updatedResult = {
            ...result,
            archivedInsights: currentArchived,
            isArchivedView
          };

          // Persist insights to DB (source of truth) - AWAIT to ensure save completes
          try {
            await saveInsightsToDB((updatedResult.insights || []) as Record<string, unknown>[], { markAsCurrent: true });
            // Update the DB active insights count so we don't regenerate on next check
            setDbActiveInsightsCount(updatedResult.insights?.length || 0);
          } catch (err) {
            console.warn('[useAIInsights] Failed to save insights to database:', err);
          }

          // Sync insights to memory for AI coach access (async, non-blocking)
          syncInsightsToMemory(updatedResult.insights, updatedResult.usingCloudAI);

          // NOW update archivedInsightsState - after API completed, batched with other updates
          // This prevents the effect from re-running mid-flight
          if (insightsToArchive.length > 0) {
            setArchivedInsightsState(currentArchived);
          }

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

          // IMPORTANT: Also save fallback results to DB with markAsCurrent to prevent re-regeneration
          try {
            await saveInsightsToDB((localResult.insights || []) as Record<string, unknown>[], { markAsCurrent: true });
            setDbActiveInsightsCount(localResult.insights?.length || 0);
          } catch (err) {
            console.warn('[useAIInsights] Failed to save fallback insights to database:', err);
          }

          setData(localResult);
        }
      } finally {
        analysisInFlightRef.current = false;
        // Always reset loading state in finally block to ensure UI is never stuck
        setIsAnalyzing(false);
      }
    };

    runAnalysis();

    return () => {
      isMounted = false;
    };
  }, [performAnalysis, sessions, refreshTrigger, forceRefresh, initializeCloudAI, archivedInsightsState, isArchivedView, dbInsightsLoaded, revisions, dbActiveInsightsCount]);

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
// Uses database for persistence with localStorage as fallback cache
export function useInsightFeedback() {
  const [feedbackCache, setFeedbackCache] = useState<Record<string, string>>({});
  const cacheLoadedRef = useRef(false);

  // Load feedback from insights on mount (DB is source of truth)
  useEffect(() => {
    if (cacheLoadedRef.current) return;
    cacheLoadedRef.current = true;

    let cancelled = false;
    const loadFeedback = async () => {
      try {
        const { active, archived } = await fetchInsightsFromDatabase();
        if (cancelled) return;

        const allInsights = [...active, ...archived];
        const cache: Record<string, string> = {};

        allInsights.forEach((insight: any) => {
          if (insight.feedback) {
            cache[insight.id] = insight.feedback;
          }
        });

        setFeedbackCache(cache);
      } catch (error) {
        console.warn('[useInsightFeedback] Failed to load feedback from DB:', error);
      }
    };

    const timeout = window.setTimeout(loadFeedback, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  const handleInsightFeedback = useCallback(async (insightId: string, feedback: 'helpful' | 'not_helpful' | 'action_taken') => {
    // Update local cache immediately for better UX
    setFeedbackCache(prev => ({ ...prev, [insightId]: feedback }));

    // Persist to database
    try {
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId, feedback }),
      });

      if (!response.ok) {
        console.warn('[useInsightFeedback] Failed to save feedback to DB');
      }
    } catch (error) {
      console.warn('[useInsightFeedback] Error saving feedback:', error);
    }
  }, []);

  const getInsightFeedback = useCallback((insightId: string) => {
    const feedback = feedbackCache[insightId];
    if (!feedback) return null;

    return {
      insightId,
      feedback,
      source: insightId.startsWith('cloud-') ? 'cloud-ai' : 'local-analysis'
    };
  }, [feedbackCache]);

  return {
    recordFeedback: handleInsightFeedback,
    getFeedback: getInsightFeedback
  };
}
