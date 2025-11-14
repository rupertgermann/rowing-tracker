import { useMemo } from 'react';
import { useRowingStore } from '@/lib/store';
import { aiAnalysis, Insight, TrendData, TrainingLoadData, AnomalyData } from '@/lib/aiAnalysis';

export interface AIInsightData {
  insights: Insight[];
  trends: TrendData[];
  trainingLoad: TrainingLoadData | null;
  anomalies: AnomalyData[];
  isAnalyzable: boolean;
  lastAnalyzed: Date | null;
}

export function useAIInsights(): AIInsightData {
  const { getSessions } = useRowingStore();
  const sessions = getSessions();

  const analysisData = useMemo(() => {
    // Need minimum sessions for meaningful analysis
    const isAnalyzable = sessions.length >= 5;
    
    if (!isAnalyzable) {
      return {
        insights: [],
        trends: [],
        trainingLoad: null,
        anomalies: [],
        isAnalyzable: false,
        lastAnalyzed: null
      };
    }

    try {
      // Generate insights using the AI analysis service
      const insights = aiAnalysis.generateInsights(sessions);
      
      // Analyze trends for key metrics
      const trends = [
        aiAnalysis.analyzeTrend(sessions, 'avgSplit'),
        aiAnalysis.analyzeTrend(sessions, 'avgPower'),
        aiAnalysis.analyzeTrend(sessions, 'avgStrokeRate'),
        aiAnalysis.analyzeTrend(sessions, 'distance')
      ].filter((trend): trend is TrendData => trend !== null);

      // Calculate training load
      const trainingLoad = aiAnalysis.calculateTrainingLoad(sessions);
      
      // Detect anomalies
      const anomalies = aiAnalysis.detectAnomalies(sessions);

      return {
        insights: insights.slice(0, 5), // Limit to top 5 insights for dashboard
        trends,
        trainingLoad,
        anomalies: anomalies.slice(0, 3), // Limit to top 3 anomalies
        isAnalyzable: true,
        lastAnalyzed: new Date()
      };
    } catch (error) {
      console.error('AI Analysis failed:', error);
      return {
        insights: [],
        trends: [],
        trainingLoad: null,
        anomalies: [],
        isAnalyzable: false,
        lastAnalyzed: null
      };
    }
  }, [sessions]);

  return analysisData;
}

// Helper hook for insight feedback
export function useInsightFeedback() {
  const handleInsightFeedback = (insightId: string, feedback: 'helpful' | 'not_helpful' | 'action_taken') => {
    // Store feedback in localStorage for future ML improvements
    const feedbackKey = `insight_feedback_${insightId}`;
    const existingFeedback = localStorage.getItem(feedbackKey);
    
    if (!existingFeedback) {
      const feedbackData = {
        insightId,
        feedback,
        timestamp: new Date().toISOString()
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
