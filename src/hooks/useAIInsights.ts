import { useMemo, useState, useCallback } from 'react';
import { useRowingStore } from '@/lib/store';
import { Session } from '@/types/session';
import { aiAnalysis, Insight, TrendData, TrainingLoadData, AnomalyData } from '@/lib/aiAnalysis';
import { cloudAI, CloudInsight } from '@/lib/cloudAI';

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
}

export function useAIInsights(): AIInsightData {
  const { getSessions } = useRowingStore();
  const sessions = getSessions();
  const [cloudAIError, setCloudAIError] = useState<string | null>(null);

  // Initialize cloud AI if API key is available
  const initializeCloudAI = useCallback(() => {
    try {
      const isConfigured = cloudAI.initialize();
      if (isConfigured) {
        setCloudAIError(null);
      }
      return isConfigured;
    } catch (error) {
      setCloudAIError(error instanceof Error ? error.message : 'Failed to initialize Cloud AI');
      return false;
    }
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

      return {
        insights: insights.slice(0, 5),
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
        cloudAIError: error instanceof Error ? error.message : 'Analysis failed',
        isCloudAIConfigured: false
      };
    }
  };

  const analysisData = useMemo(() => {
    // Need minimum sessions for meaningful analysis
    const isAnalyzable = sessions.length >= 3; // Reduced for cloud AI
    const isCloudAIConfigured = initializeCloudAI();
    
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

    // Try Cloud AI first if configured, fallback to local analysis
    if (isCloudAIConfigured) {
      try {
        // For now, return local analysis with cloud AI flag
        // In a real implementation, this would be an async operation
        const localInsights = aiAnalysis.generateInsights(sessions);
        const trends = [
          aiAnalysis.analyzeTrend(sessions, 'avgSplit'),
          aiAnalysis.analyzeTrend(sessions, 'avgPower'),
          aiAnalysis.analyzeTrend(sessions, 'avgStrokeRate'),
          aiAnalysis.analyzeTrend(sessions, 'distance')
        ].filter((trend): trend is TrendData => trend !== null);

        const trainingLoad = aiAnalysis.calculateTrainingLoad(sessions);
        const anomalies = aiAnalysis.detectAnomalies(sessions);

        return {
          insights: localInsights.slice(0, 5),
          trends,
          trainingLoad,
          anomalies: anomalies.slice(0, 3),
          isAnalyzable: true,
          lastAnalyzed: new Date(),
          usingCloudAI: false, // Will be true when async cloud AI is implemented
          cloudAIError: null,
          isCloudAIConfigured: true
        };
      } catch (error) {
        console.error('Cloud AI failed, falling back to local analysis:', error);
        setCloudAIError(error instanceof Error ? error.message : 'Cloud AI error');
        
        // Fallback to local analysis
        return getLocalAnalysis(sessions);
      }
    }

    // Use local analysis
    return getLocalAnalysis(sessions);
  }, [sessions, initializeCloudAI]);

  return analysisData;
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
    const feedbackKey = `insight_feedback_${insightId}`;
    const feedbackData = localStorage.getItem(feedbackKey);
    
    return feedbackData ? JSON.parse(feedbackData) : null;
  };

  return {
    recordFeedback: handleInsightFeedback,
    getFeedback: getInsightFeedback
  };
}
