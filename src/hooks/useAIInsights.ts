import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useRowingStore } from '@/lib/store';
import { Session } from '@/types/session';
import { aiAnalysis, Insight, TrendData, TrainingLoadData, AnomalyData } from '@/lib/aiAnalysis';
import { cloudAI, CloudInsight } from '@/lib/cloudAI';
import { initializeCloudAIFromSettings, isAIAvailable, getAIConfigurationErrorMessage } from '@/lib/aiConfig';
import { memoryStorage } from '@/lib/memoryStorage';
import { saveInsightsToDB, fetchInsightsFromDB, saveArchivedInsightsToDB } from '@/lib/dataSync';

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
  archivedInsights?: (Insight | CloudInsight)[];
  archiveInsight?: (insightId: string) => void;
  unarchiveInsight?: (insightId: string) => void;
  deleteInsight?: (insightId: string) => void;
  isArchivedView?: boolean;
  setIsArchivedView?: (isArchived: boolean) => void;
}

// Cache utilities for AI insights
interface InsightCache {
  data: AIInsightData;
  cacheKey: string;
  timestamp: number;
}

const CACHE_KEY = 'rowing_ai_insights_cache';
const ARCHIVE_KEY = 'rowing_ai_insights_archive';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const AUTO_ARCHIVE_DAYS = 30; // Archive insights older than 30 days

// Generate cache key based on session data
const generateCacheKey = (sessions: Session[], usingCloudAI: boolean): string => {
  if (!sessions || sessions.length === 0) return 'no-sessions';

  const sessionCount = sessions.length;
  const lastSessionTimestamp = sessions
    .map(s => new Date(s.timestamp).getTime())
    .sort((a, b) => b - a)[0] || 0;

  // Include a hash of session IDs to detect when sessions are deleted/replaced
  // even if count and last timestamp remain the same
  const sessionIdsHash = sessions
    .map(s => s.id)
    .sort()
    .join(',')
    .split('')
    .reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0)
    .toString(36);

  const cacheKey = `${sessionCount}-${lastSessionTimestamp}-${usingCloudAI}-${sessionIdsHash}`;
  return cacheKey;
};

// Get cached insights from localStorage (session cache only)
// DB is source of truth, localStorage is just for avoiding re-fetch within same session
const getCachedInsights = (sessions: Session[], usingCloudAI: boolean): AIInsightData | null => {
  // Guard against SSR/non-browser environments
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    console.log('[CACHE] No window/localStorage - returning null');
    return null;
  }

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) {
      console.log('[CACHE] No cached insights found in localStorage');
      return null;
    }

    const cache: InsightCache = JSON.parse(cached);
    const currentCacheKey = generateCacheKey(sessions, usingCloudAI);

    // Check if cache is still valid (shorter expiry for session cache)
    const isExpired = Date.now() - cache.timestamp > CACHE_EXPIRY_MS;
    const isKeyMatch = cache.cacheKey === currentCacheKey;

    console.log('[CACHE] Check:', {
      cachedKey: cache.cacheKey,
      currentKey: currentCacheKey,
      isKeyMatch,
      isExpired,
      cacheAge: Date.now() - cache.timestamp,
      expiryMs: CACHE_EXPIRY_MS
    });

    if (!isExpired && isKeyMatch) {
      console.log('[CACHE] ✅ Using valid localStorage cache');
      return {
        ...cache.data,
        lastAnalyzed: cache.data.lastAnalyzed ? new Date(cache.data.lastAnalyzed) : null
      };
    } else {
      console.log('[CACHE] ❌ Cache invalid:', {
        keyMatch: isKeyMatch,
        expired: isExpired
      });
    }
  } catch (error) {
    console.warn('Failed to read cached insights:', error);
    localStorage.removeItem(CACHE_KEY);
  }

  return null;
};

// Get any cached insights (even if stale/mismatched) for archiving before regeneration
const getStaleInsightsForArchiving = (): (Insight | CloudInsight)[] => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return [];

    const cache: InsightCache = JSON.parse(cached);
    return cache.data?.insights || [];
  } catch (error) {
    return [];
  }
};

// Save insights to cache (archives old insights before overwriting)
// Synchronous localStorage save with async database persistence in background
const saveCachedInsights = (sessions: Session[], usingCloudAI: boolean, data: AIInsightData): void => {
  // Guard against SSR/non-browser environments
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  try {
    // Archive existing cached insights BEFORE overwriting
    const existingCached = localStorage.getItem(CACHE_KEY);
    if (existingCached) {
      try {
        const oldCache: InsightCache = JSON.parse(existingCached);
        const oldInsights = oldCache.data?.insights || [];
        if (oldInsights.length > 0) {
          const currentArchived = getArchivedInsights();
          const newArchived = addToArchive(currentArchived, oldInsights);
          saveArchivedInsights(newArchived);
        }
      } catch (parseError) {
        console.warn('Failed to parse old cache for archiving:', parseError);
      }
    }

    const cacheKey = generateCacheKey(sessions, usingCloudAI);
    const cache: InsightCache = {
      data,
      cacheKey,
      timestamp: Date.now()
    };

    console.log('[CACHE] Saving insights:', {
      cacheKey,
      insightCount: data.insights.length,
      timestamp: cache.timestamp
    });

    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));

    // Persist insights to database for permanent storage (async, non-blocking)
    if (data.insights && data.insights.length > 0) {
      saveInsightsToDB(data.insights)
        .catch(err => console.warn('[useAIInsights] Failed to save insights to database:', err));
    }

    // Sync insights to memory for AI coach access (async, non-blocking)
    syncInsightsToMemory(data.insights, usingCloudAI);
  } catch (error) {
    console.warn('Failed to cache insights:', error);
  }
};

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

// Clear cached insights
const clearCachedInsights = (): void => {
  // Guard against SSR/non-browser environments
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  localStorage.removeItem(CACHE_KEY);
};

// Helper to add items to archive with deduplication
const addToArchive = (existing: (Insight | CloudInsight)[], newItems: (Insight | CloudInsight)[]): (Insight | CloudInsight)[] => {
  const existingIds = new Set(existing.map(i => i.id));
  const uniqueNewItems = newItems.filter(i => !existingIds.has(i.id));
  return [...existing, ...uniqueNewItems];
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

// Archive helper functions - now uses DB as source of truth
const getArchivedInsights = (): (Insight | CloudInsight)[] => {
  // Guard against SSR/non-browser environments
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [];
  }

  try {
    // Try localStorage cache first for synchronous access
    const archived = localStorage.getItem(ARCHIVE_KEY);
    if (!archived) {
      return [];
    }

    const parsed = JSON.parse(archived);
    const uniqueMap = new Map();

    parsed.forEach((insight: any) => {
      let date = new Date(insight.dateGenerated);
      if (isNaN(date.getTime()) || date.getFullYear() === 1970) {
        date = new Date();
      }

      const processedInsight = {
        ...insight,
        dateGenerated: date
      };

      if (!uniqueMap.has(insight.id)) {
        uniqueMap.set(insight.id, processedInsight);
      }
    });

    return Array.from(uniqueMap.values());
  } catch (error) {
    console.warn('Failed to read archived insights:', error);
    return [];
  }
};

const saveArchivedInsights = (archivedInsights: (Insight | CloudInsight)[]): void => {
  // Guard against SSR/non-browser environments
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archivedInsights));
    
    // Persist to database in the background (non-blocking)
    saveArchivedInsightsToDB(archivedInsights)
      .then(result => {
        if (!result.success) {
          console.warn('[useAIInsights] Failed to save archived insights to database:', result.error);
        } else {
          console.log('[useAIInsights] Archived insights saved to database');
        }
      })
      .catch(err => {
        console.warn('[useAIInsights] Error saving archived insights to database:', err);
      });
  } catch (error) {
    console.warn('Failed to save archived insights:', error);
  }
};

const archiveInsight = (insightId: string, currentInsights: (Insight | CloudInsight)[]): {
  updatedInsights: (Insight | CloudInsight)[];
  archivedInsights: (Insight | CloudInsight)[];
} => {
  const insightToArchive = currentInsights.find(insight => insight.id === insightId);
  if (!insightToArchive) {
    return { updatedInsights: currentInsights, archivedInsights: getArchivedInsights() };
  }

  const updatedInsights = currentInsights.filter(insight => insight.id !== insightId);
  const existingArchived = getArchivedInsights();
  const newArchivedInsights = addToArchive(existingArchived, [insightToArchive]);

  saveArchivedInsights(newArchivedInsights);
  return { updatedInsights, archivedInsights: newArchivedInsights };
};

const unarchiveInsight = (insightId: string): (Insight | CloudInsight) => {
  const archivedInsights = getArchivedInsights();
  const insightToUnarchive = archivedInsights.find(insight => insight.id === insightId);

  if (!insightToUnarchive) {
    throw new Error('Insight not found in archive');
  }

  const updatedArchived = archivedInsights.filter(insight => insight.id !== insightId);
  saveArchivedInsights(updatedArchived);

  return insightToUnarchive;
};

// Delete insight permanently from archive
const deleteInsight = (insightId: string): void => {
  const archivedInsights = getArchivedInsights();
  const updatedArchived = archivedInsights.filter(insight => insight.id !== insightId);
  saveArchivedInsights(updatedArchived);
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

  if (oldInsights.length > 0) {
    const existingArchived = getArchivedInsights();
    const newArchived = addToArchive(existingArchived, oldInsights);
    saveArchivedInsights(newArchived);
  }

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

  // Load archived insights state
  const [archivedInsightsState, setArchivedInsightsState] = useState<(Insight | CloudInsight)[]>([]);
  const [archivedLoaded, setArchivedLoaded] = useState(false);
  const [dbInsightsLoaded, setDbInsightsLoaded] = useState(false);

  // DB-first: Load insights from database on mount
  useEffect(() => {
    if (dbLoadedRef.current) return;
    dbLoadedRef.current = true;

    const loadFromDB = async () => {
      try {
        console.log('[INSIGHTS] Loading insights from database (DB-first)...');
        const { active, archived } = await fetchInsightsFromDatabase();
        
        // Cache in localStorage for session performance
        if (archived.length > 0) {
          localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archived));
        }
        
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
        // Fallback to localStorage cache
        const archived = getArchivedInsights();
        setArchivedInsightsState(archived);
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
    // Archive all existing insights before refresh
    setData(prevData => {
      if (prevData.insights.length > 0) {
        const existingArchived = getArchivedInsights();
        const newArchived = addToArchive(existingArchived, prevData.insights);
        saveArchivedInsights(newArchived);
        setArchivedInsightsState(newArchived);

        return {
          ...prevData,
          insights: [],
          archivedInsights: newArchived
        };
      }
      return prevData;
    });

    clearCachedInsights();
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Archive insight function
  const archiveInsightCallback = useCallback((insightId: string) => {
    setData(prevData => {
      const { updatedInsights, archivedInsights } = archiveInsight(insightId, prevData.insights);
      setArchivedInsightsState(archivedInsights);
      return {
        ...prevData,
        insights: updatedInsights,
        archivedInsights
      };
    });
  }, []);

  // Unarchive insight function
  const unarchiveInsightCallback = useCallback((insightId: string) => {
    try {
      const unarchivedInsight = unarchiveInsight(insightId);
      const updatedArchived = getArchivedInsights();
      setArchivedInsightsState(updatedArchived);
      setData(prevData => ({
        ...prevData,
        insights: [...prevData.insights, unarchivedInsight],
        archivedInsights: updatedArchived
      }));
    } catch (error) {
      console.error('Failed to unarchive insight:', error);
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
    deleteInsight(insightId);
    const updatedArchived = getArchivedInsights();
    setArchivedInsightsState(updatedArchived);
    setData(prevData => {
      return {
        ...prevData,
        archivedInsights: updatedArchived
      };
    });
  }, []);

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
      const { updatedInsights, newlyArchived } = autoArchiveOldInsights(insights.slice(0, 5));

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
      console.log('[INSIGHTS] Analysis triggered:', {
        forceRefresh,
        sessionCount: sessions.length,
        sessionsChanged: sessions.length > 0
      });

      // Don't run analysis if we have no sessions yet (avoid race condition during initial load)
      if (sessions.length === 0) {
        console.log('[INSIGHTS] No sessions loaded yet - skipping');
        return;
      }

      try {
        // Check cache first (unless force refresh)
        if (!forceRefresh) {
          console.log('[INSIGHTS] Checking cache...');
          const isCloudAIConfigured = initializeCloudAI();
          const isAIAvailableForUse = isCloudAIConfigured && isAIAvailable();
          const usingCloudAI = isAIAvailableForUse;

          const cachedData = getCachedInsights(sessions, usingCloudAI);
          
          if (cachedData) {
            console.log('[INSIGHTS] ✅ Using cached data - no regeneration');
            if (isMounted) {
              setData(cachedData);
            }
            return;
          }
        } else {
          console.log('[INSIGHTS] Force refresh - skipping cache');
        }

        // Archive stale cached insights BEFORE generating new ones
        // This handles the case where React state is empty but cache has old insights
        const staleInsights = getStaleInsightsForArchiving();
        let currentArchived = getArchivedInsights();
        
        if (staleInsights.length > 0) {
          currentArchived = addToArchive(currentArchived, staleInsights);
          saveArchivedInsights(currentArchived);
        }

        // Generate new insights
        const result = await performAnalysis();
        if (isMounted) {
          const updatedResult = {
            ...result,
            archivedInsights: currentArchived,
            isArchivedView
          };

          // Cache the results (synchronous localStorage, async DB in background)
          const isCloudAIConfigured = initializeCloudAI();
          const isAIAvailableForUse = isCloudAIConfigured && isAIAvailable();
          const usingCloudAI = isAIAvailableForUse;
          saveCachedInsights(sessions, usingCloudAI, updatedResult);

          setData(updatedResult);
        }
      } catch (error) {
        console.error('Analysis error:', error);
        if (isMounted) {
          const localResult = await getLocalAnalysis(sessions);
          setData(localResult);
        }
      }
    };

    runAnalysis();

    return () => {
      isMounted = false;
    };
  }, [performAnalysis, sessions, refreshTrigger, forceRefresh, initializeCloudAI]);

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
