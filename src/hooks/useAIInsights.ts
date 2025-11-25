import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRowingStore } from '@/lib/store';
import { Session } from '@/types/session';
import { aiAnalysis, Insight, TrendData, TrainingLoadData, AnomalyData } from '@/lib/aiAnalysis';
import { cloudAI, CloudInsight } from '@/lib/cloudAI';
import { initializeCloudAIFromSettings, isAIAvailable, getAIConfigurationErrorMessage } from '@/lib/aiConfig';
import { memoryStorage } from '@/lib/memoryStorage';

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
  
  return `${sessionCount}-${lastSessionTimestamp}-${usingCloudAI}`;
};

// Get cached insights if valid
const getCachedInsights = (sessions: Session[], usingCloudAI: boolean): AIInsightData | null => {
  // Guard against SSR/non-browser environments
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const cache: InsightCache = JSON.parse(cached);
    const currentCacheKey = generateCacheKey(sessions, usingCloudAI);
    
    // Check if cache is still valid
    const isExpired = Date.now() - cache.timestamp > CACHE_EXPIRY_MS;
    const isKeyMatch = cache.cacheKey === currentCacheKey;
    
    if (!isExpired && isKeyMatch) {
      // Convert timestamp back to Date object
      return {
        ...cache.data,
        lastAnalyzed: cache.data.lastAnalyzed ? new Date(cache.data.lastAnalyzed) : null
      };
    }
  } catch (error) {
    console.warn('Failed to read cached insights:', error);
    // Clear corrupted cache
    localStorage.removeItem(CACHE_KEY);
  }
  
  return null;
};

// Save insights to cache
const saveCachedInsights = (sessions: Session[], usingCloudAI: boolean, data: AIInsightData): void => {
  // Guard against SSR/non-browser environments
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  
  try {
    const cache: InsightCache = {
      data,
      cacheKey: generateCacheKey(sessions, usingCloudAI),
      timestamp: Date.now()
    };
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    
    // Sync insights to memory for AI coach access
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

// Archive helper functions
const getArchivedInsights = (): (Insight | CloudInsight)[] => {
  // Guard against SSR/non-browser environments
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [];
  }
  
  try {
    const archived = localStorage.getItem(ARCHIVE_KEY);
    if (!archived) return [];
    
    const parsed = JSON.parse(archived);
    // Convert date strings back to Date objects
    return parsed.map((insight: any) => ({
      ...insight,
      dateGenerated: new Date(insight.dateGenerated)
    }));
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
  const newArchivedInsights = [...existingArchived, insightToArchive];
  
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
    const newArchived = [...existingArchived, ...oldInsights];
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
        const newArchived = [...existingArchived, ...prevData.insights];
        saveArchivedInsights(newArchived);
        
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
      setData(prevData => ({
        ...prevData,
        insights: [...prevData.insights, unarchivedInsight],
        archivedInsights: getArchivedInsights()
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
    setData(prevData => {
      const updatedArchived = prevData.archivedInsights?.filter(insight => insight.id !== insightId) || [];
      return {
        ...prevData,
        archivedInsights: updatedArchived
      };
    });
  }, []);

  const getLocalAnalysis = (sessionData: Session[]) => {
    try {
      const insights = aiAnalysis.generateInsights(sessionData);
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
      
      if (newlyArchived.length > 0) {
        console.log(`Auto-archived ${newlyArchived.length} old insights`);
      }

      return {
        insights: updatedInsights,
        trends,
        trainingLoad,
        anomalies: anomalies.slice(0, 3),
        isAnalyzable: true,
        lastAnalyzed: new Date(),
        usingCloudAI: false,
        cloudAIError: null,
        isCloudAIConfigured: false
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
        isCloudAIConfigured: false
      };
    }
  };

  // Main analysis function
  const performAnalysis = useCallback(async () => {
    const isAnalyzable = sessions.length >= 3;
    const isCloudAIConfigured = initializeCloudAI();
    const isAIAvailableForUse = isCloudAIConfigured && isAIAvailable();

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
        isCloudAIConfigured
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
          isCloudAIConfigured: true
        };
      } catch (error) {
        console.error('Cloud AI failed, falling back to local analysis:', error);
        setIsAnalyzing(false);
        const errorMessage = error instanceof Error ? error.message : 'Cloud AI error';
        setCloudAIError(errorMessage);
        
        // Fallback to local analysis
        return getLocalAnalysis(sessions);
      }
    }

    // Use local analysis
    return getLocalAnalysis(sessions);
  }, [sessions, initializeCloudAI]);

  // Run analysis when sessions change or refresh is triggered
  useEffect(() => {
    let isMounted = true;
    
    const runAnalysis = async () => {
      try {
        // Check cache first (unless force refresh)
        if (!forceRefresh) {
          const isCloudAIConfigured = initializeCloudAI();
          const isAIAvailableForUse = isCloudAIConfigured && isAIAvailable();
          const usingCloudAI = isAIAvailableForUse;
          
          const cachedData = getCachedInsights(sessions, usingCloudAI);
          if (cachedData) {
            if (isMounted) {
              setData(cachedData);
            }
            return;
          }
        }
        
        // Generate new insights
        const result = await performAnalysis();
        if (isMounted) {
          const archivedInsights = getArchivedInsights();
          const updatedResult = {
            ...result,
            archivedInsights,
            isArchivedView
          };
          setData(updatedResult);
          // Cache the results
          const isCloudAIConfigured = initializeCloudAI();
          const isAIAvailableForUse = isCloudAIConfigured && isAIAvailable();
          const usingCloudAI = isAIAvailableForUse;
          saveCachedInsights(sessions, usingCloudAI, updatedResult);
        }
      } catch (error) {
        console.error('Analysis error:', error);
        if (isMounted) {
          setData(getLocalAnalysis(sessions));
        }
      }
    };

    runAnalysis();

    return () => {
      isMounted = false;
    };
  }, [performAnalysis, sessions, refreshTrigger, forceRefresh, initializeCloudAI]);

  return { 
    ...data, 
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
      console.log('Insight feedback recorded:', feedbackData);
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
