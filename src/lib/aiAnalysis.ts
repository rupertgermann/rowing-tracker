import { Session } from '@/types/session';
import { cloudAI } from '@/lib/cloudAI';
import {
  buildPostureAIPayload,
  assertNoKeypointsInPayload,
  type PostureAIPayload,
} from '@/lib/mocap/aiPayload';

// Types for AI analysis results
export interface TrendData {
  metric: string;
  direction: 'improving' | 'declining' | 'stable';
  confidence: number; // 0-1 scale
  changeRate: number; // units per session
  description: string;
}

export interface AnomalyData {
  sessionId: string;
  date: Date;
  anomalies: {
    metric: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }[];
}

export interface Insight {
  id: string;
  type: 'trend' | 'anomaly' | 'recommendation' | 'achievement';
  title: string;
  description: string;
  actionable: boolean;
  priority: 'low' | 'medium' | 'high';
  dateGenerated: Date;
  relatedSessions?: string[];
}

export interface TrainingLoadData {
  acuteLoad: number; // Last 7 days
  chronicLoad: number; // Last 28 days
  strain: number; // Acute/Chronic ratio
  recommendation: string;
}

// Core AI Analysis Service
export class AIAnalysisService {
  private static instance: AIAnalysisService;
  
  private constructor() {}
  
  static getInstance(): AIAnalysisService {
    if (!AIAnalysisService.instance) {
      AIAnalysisService.instance = new AIAnalysisService();
    }
    return AIAnalysisService.instance;
  }

  // Basic trend detection algorithms
  analyzeTrend(sessions: Session[], metric: keyof Session): TrendData | null {
    if (sessions.length < 5) return null; // Need minimum data for trend analysis
    
    const values = sessions
      .map(s => s[metric] as number)
      .filter(v => v !== undefined && v !== null && !isNaN(v));
    
    if (values.length < 5) return null;
    
    // Simple linear regression for trend detection
    const n = values.length;
    const x = Array.from({length: n}, (_, i) => i);
    const y = values;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumXX = x.reduce((total, xi) => total + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const meanY = sumY / n;
    
    // Calculate R-squared for confidence
    const yMean = y.reduce((a, b) => a + b, 0) / n;
    const ssTotal = y.reduce((total, yi) => total + Math.pow(yi - yMean, 2), 0);
    const ssResidual = y.reduce((total, yi, i) => {
      const predicted = slope * i + (meanY - slope * (n - 1) / 2);
      return total + Math.pow(yi - predicted, 2);
    }, 0);
    
    const rSquared = 1 - (ssResidual / ssTotal);
    const confidence = Math.max(0, Math.min(1, rSquared));
    
    // Determine trend direction
    let direction: 'improving' | 'declining' | 'stable';
    if (Math.abs(slope) < 0.01) {
      direction = 'stable';
    } else if (this.isImprovingMetric(metric)) {
      direction = slope > 0 ? 'improving' : 'declining';
    } else {
      direction = slope < 0 ? 'improving' : 'declining';
    }
    
    return {
      metric: metric.toString(),
      direction,
      confidence,
      changeRate: slope,
      description: this.generateTrendDescription(metric, direction, slope, confidence)
    };
  }

  // Detect unusual sessions (anomalies)
  detectAnomalies(sessions: Session[]): AnomalyData[] {
    if (sessions.length < 10) return []; // Need baseline for anomaly detection
    
    const anomalies: AnomalyData[] = [];
    
    sessions.forEach(session => {
      const sessionAnomalies: AnomalyData['anomalies'] = [];
      
      // Check pace anomalies (should be relatively consistent)
      if (session.avgSplit > 0) {
        const paceValues = sessions
          .map(s => s.avgSplit)
          .filter(p => p > 0);
        
        const mean = paceValues.reduce((a, b) => a + b, 0) / paceValues.length;
        const stdDev = Math.sqrt(
          paceValues.reduce((total, pace) => total + Math.pow(pace - mean, 2), 0) / paceValues.length
        );
        
        const zScore = Math.abs((session.avgSplit - mean) / stdDev);
        
        if (zScore > 2.5) {
          sessionAnomalies.push({
            metric: 'pace',
            severity: zScore > 3 ? 'high' : 'medium',
            description: `Pace was ${session.avgSplit < mean ? 'much faster' : 'much slower'} than usual`
          });
        }
      }
      
      // Check power anomalies
      if (session.avgPower > 0) {
        const powerValues = sessions
          .map(s => s.avgPower)
          .filter(p => p > 0);
        
        const mean = powerValues.reduce((a, b) => a + b, 0) / powerValues.length;
        const stdDev = Math.sqrt(
          powerValues.reduce((total, power) => total + Math.pow(power - mean, 2), 0) / powerValues.length
        );
        
        const zScore = (session.avgPower - mean) / stdDev;
        
        if (zScore > 2.5) {
          sessionAnomalies.push({
            metric: 'power',
            severity: zScore > 3 ? 'high' : 'medium',
            description: `Power output was unusually high (${Math.round(session.avgPower)}W)`
          });
        }
      }
      
      if (sessionAnomalies.length > 0) {
        anomalies.push({
          sessionId: session.id,
          date: session.timestamp,
          anomalies: sessionAnomalies
        });
      }
    });
    
    return anomalies;
  }

  // Basic training load calculations
  calculateTrainingLoad(sessions: Session[]): TrainingLoadData | null {
    if (sessions.length < 7) return null;
    
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    
    const acuteSessions = sessions.filter(s => new Date(s.timestamp) >= sevenDaysAgo);
    const chronicSessions = sessions.filter(s => new Date(s.timestamp) >= twentyEightDaysAgo);
    
    // Simple load calculation based on duration and intensity
    const calculateLoad = (sessionList: Session[]) => {
      return sessionList.reduce((total, session) => {
        // Load = duration (minutes) * intensity factor
        const intensityFactor = this.calculateIntensityFactor(session, sessions);
        return total + (session.duration / 60) * intensityFactor;
      }, 0);
    };
    
    const acuteLoad = calculateLoad(acuteSessions);
    const chronicLoad = calculateLoad(chronicSessions) / 4; // Average per week
    const strain = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;
    
    return {
      acuteLoad: Math.round(acuteLoad),
      chronicLoad: Math.round(chronicLoad),
      strain: Math.round(strain * 100) / 100,
      recommendation: this.generateLoadRecommendation(strain)
    };
  }

  // Generate actionable insights
  async generateInsights(sessions: Session[]): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    if (sessions.length < 5) return insights;
    
    // Trend insights
    const paceTrend = this.analyzeTrend(sessions, 'avgSplit');
    if (paceTrend && paceTrend.confidence > 0.5) {
      insights.push({
        id: `trend-pace-${Date.now()}`,
        type: 'trend',
        title: `Pace is ${paceTrend.direction}`,
        description: paceTrend.description,
        actionable: paceTrend.direction !== 'stable',
        priority: paceTrend.confidence > 0.8 ? 'high' : 'medium',
        dateGenerated: new Date()
      });
    }
    
    const powerTrend = this.analyzeTrend(sessions, 'avgPower');
    if (powerTrend && powerTrend.confidence > 0.5) {
      insights.push({
        id: `trend-power-${Date.now()}`,
        type: 'trend',
        title: `Power is ${powerTrend.direction}`,
        description: powerTrend.description,
        actionable: powerTrend.direction !== 'stable',
        priority: powerTrend.confidence > 0.8 ? 'high' : 'medium',
        dateGenerated: new Date()
      });
    }
    
    // Training load insights - use AI when available, otherwise simplified logic
    const trainingLoad = this.calculateTrainingLoad(sessions);
    if (trainingLoad) {
      // Try to get AI-generated training load insights
      if (cloudAI.isConfigured()) {
        try {
          const aiInsights = await cloudAI.generateInsights(sessions);
          // Filter for training load related insights
          const trainingLoadInsights = aiInsights.filter(insight => 
            insight.title.toLowerCase().includes('load') ||
            insight.title.toLowerCase().includes('training') ||
            insight.title.toLowerCase().includes('recovery') ||
            insight.description.toLowerCase().includes('strain')
          );
          
          // Convert AI insights to local Insight format
          trainingLoadInsights.forEach(aiInsight => {
            insights.push({
              id: `ai-load-${aiInsight.id}`,
              type: aiInsight.type as Insight['type'],
              title: aiInsight.title,
              description: aiInsight.description,
              actionable: aiInsight.actionable,
              priority: aiInsight.priority,
              dateGenerated: aiInsight.dateGenerated
            });
          });
        } catch (error) {
          console.warn('Failed to generate AI training load insights, falling back to basic logic:', error);
          // Fallback to basic logic
          this.addBasicTrainingLoadInsights(trainingLoad, insights);
        }
      } else {
        // Use basic logic when AI is not configured
        this.addBasicTrainingLoadInsights(trainingLoad, insights);
      }
    }
    
    // Achievement insights
    const recentSessions = sessions.slice(-10);
    const bestRecentPace = Math.min(...recentSessions.map(s => s.avgSplit).filter(p => p > 0));
    const allTimeBestPace = Math.min(...sessions.map(s => s.avgSplit).filter(p => p > 0));
    
    if (bestRecentPace === allTimeBestPace && recentSessions.length >= 5) {
      insights.push({
        id: `achievement-pace-${Date.now()}`,
        type: 'achievement',
        title: 'Personal Best Pace!',
        description: `You've achieved your best pace of ${this.formatPace(bestRecentPace)} in recent sessions!`,
        actionable: false,
        priority: 'low',
        dateGenerated: new Date()
      });
    }
    
    return insights.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // Helper methods
  private isImprovingMetric(metric: keyof Session): boolean {
    const improvingMetrics = ['avgPower', 'distance'];
    const decliningMetrics = ['avgSplit', 'duration'];
    
    return improvingMetrics.includes(metric as string) || !decliningMetrics.includes(metric as string);
  }

  private generateTrendDescription(
    metric: keyof Session, 
    direction: 'improving' | 'declining' | 'stable', 
    slope: number, 
    confidence: number
  ): string {
    const metricName = this.formatMetricName(metric);
    const confidenceLevel = confidence > 0.8 ? 'strong' : confidence > 0.5 ? 'moderate' : 'weak';
    
    if (direction === 'stable') {
      return `Your ${metricName} has been stable with ${confidenceLevel} consistency.`;
    }
    
    const trendVerb = direction === 'improving' ? 'improving' : 'declining';
    const rateDescription = Math.abs(slope) > 1 ? 'significantly' : 'gradually';
    
    return `Your ${metricName} is ${rateDescription} ${trendVerb} with ${confidenceLevel} confidence.`;
  }

  private calculateIntensityFactor(session: Session, allSessions: Session[]): number {
    // Simple intensity calculation based on pace and power
    let intensity = 1.0;
    
    if (session.avgSplit > 0) {
      // Faster pace = higher intensity
      const avgPace = allSessions.reduce((sum, s) => sum + (s.avgSplit || 0), 0) / allSessions.length;
      intensity += Math.max(0, (avgPace - session.avgSplit) / avgPace);
    }
    
    if (session.avgPower > 0) {
      // Higher power = higher intensity
      intensity += session.avgPower / 200; // Normalize around 200W
    }
    
    return Math.max(0.5, Math.min(2.0, intensity));
  }

  private generateLoadRecommendation(strain: number): string {
    if (strain > 1.5) {
      return 'Very high strain. Take 2-3 rest days before next intense session.';
    } else if (strain > 1.3) {
      return 'High strain. Consider an extra rest day or light recovery session.';
    } else if (strain > 0.9) {
      return 'Moderate strain. Maintain current training load with adequate recovery.';
    } else if (strain > 0.8) {
      return 'Low strain. Good opportunity to increase training volume or intensity.';
    } else {
      return 'Very low strain. Consider increasing training frequency for better adaptations.';
    }
  }

  private formatMetricName(metric: keyof Session): string {
    const names: Record<string, string> = {
      avgSplit: 'pace',
      avgPower: 'power output',
      avgStrokeRate: 'stroke rate',
      distance: 'distance',
      duration: 'session duration'
    };
    
    return names[metric as string] || metric.toString();
  }

  private formatPace(secondsPer500m: number): string {
    if (secondsPer500m <= 0) return '--:--';
    const minutes = Math.floor(secondsPer500m / 60);
    const seconds = Math.floor(secondsPer500m % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // Add basic training load insights when AI is not available
  private addBasicTrainingLoadInsights(trainingLoad: TrainingLoadData, insights: Insight[]): void {
    if (trainingLoad.strain > 1.3) {
      insights.push({
        id: `load-high-${Date.now()}`,
        type: 'recommendation',
        title: 'High Training Load Detected',
        description: 'Your training load is significantly higher than usual. Consider adding extra recovery time.',
        actionable: true,
        priority: 'high',
        dateGenerated: new Date()
      });
    } else if (trainingLoad.strain < 0.8) {
      insights.push({
        id: `load-low-${Date.now()}`,
        type: 'recommendation',
        title: 'Low Training Volume',
        description: 'Your training load is lower than your baseline. Consider increasing frequency or intensity.',
        actionable: true,
        priority: 'medium',
        dateGenerated: new Date()
      });
    }
  }
}

// Export singleton instance
export const aiAnalysis = AIAnalysisService.getInstance();

// ============================================================================
// Posture AI Payload Integration
// ============================================================================

/**
 * Input type for posture data fetched server-side (from DB records).
 * No keypoints — only aggregated fault/metric rows.
 */
export interface MocapSessionPostureData {
  faults: Array<{ faultType: string; severity: string }>;
  metrics: Array<{
    strokeIndex: number;
    segmentationSource: string;
    metricsJson: unknown;
  }>;
  qualityFlags: string[];
  qualityScore: number | null;
}

/**
 * Build a cloud-safe posture AI payload from DB-fetched mocap data and user
 * settings, then verify the hard keypoint guard.
 *
 * Returns null when cloudAI is disabled (no posture data leaves the device).
 * Call this server-side (e.g. in an API route) where DB access is available;
 * pass the returned payload into the cloud AI prompt builder.
 */
export function buildAndValidatePosturePayload(
  postureData: MocapSessionPostureData,
  opts: { cloudAIEnabled: boolean; mocapDetailedAIShare: boolean },
): PostureAIPayload | null {
  const payload = buildPostureAIPayload(
    postureData.faults,
    postureData.metrics,
    postureData.qualityFlags,
    postureData.qualityScore,
    opts,
  );

  if (payload !== null) {
    // Hard guard: must never contain keypoint arrays.
    assertNoKeypointsInPayload(payload);
  }

  return payload;
}

/**
 * Serialise a validated PostureAIPayload as a JSON context block suitable
 * for appending to an AI prompt string.
 */
export function formatPosturePayloadForPrompt(
  payload: PostureAIPayload,
): string {
  const tierLabel =
    payload.tier === 3
      ? 'Tier 3 – Fault Summary (no body geometry)'
      : 'Tier 2 – Fault Summary + Per-Stroke Metrics (no keypoints)';

  return `\n\n---\nPOSTURE ANALYSIS CONTEXT [${tierLabel}]:\n${JSON.stringify(payload, null, 2)}\n---`;
}
