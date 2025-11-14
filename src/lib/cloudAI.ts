import { Session } from '@/types/session';

// OpenAI API configuration
interface OpenAIConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

// Insight types from cloud AI
export interface CloudInsight {
  id: string;
  type: 'performance' | 'recommendation' | 'trend' | 'achievement' | 'warning';
  title: string;
  description: string;
  actionable: boolean;
  priority: 'low' | 'medium' | 'high';
  confidence: number; // 0-1 from AI
  evidence: string[]; // Supporting data points
  dateGenerated: Date;
}

export class CloudAIService {
  private static instance: CloudAIService;
  private config: OpenAIConfig | null = null;
  
  private constructor() {}
  
  static getInstance(): CloudAIService {
    if (!CloudAIService.instance) {
      CloudAIService.instance = new CloudAIService();
    }
    return CloudAIService.instance;
  }

  // Initialize with API key from environment or user input
  initialize(apiKey?: string): boolean {
    // Priority: user-provided key > environment variable
    const key = apiKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    
    if (!key) {
      console.warn('OpenAI API key not provided');
      return false;
    }
    
    this.config = {
      apiKey: key,
      model: 'gpt-4-turbo-preview',
      baseUrl: 'https://api.openai.com/v1'
    };
    
    return true;
  }

  // Check if service is configured
  isConfigured(): boolean {
    return this.config !== null;
  }

  // Anonymize session data for privacy
  private anonymizeSessions(sessions: Session[]): any[] {
    return sessions.map(session => ({
      date: new Date(session.timestamp).toISOString().split('T')[0], // Only date, no time
      distance: session.distance,
      duration: session.duration,
      pace: session.avgSplit,
      power: session.avgPower,
      strokeRate: session.avgStrokeRate,
      // Remove any potentially identifying information
    }));
  }

  // Generate rowing-specific insights using OpenAI
  async generateInsights(sessions: Session[]): Promise<CloudInsight[]> {
    if (!this.config) {
      throw new Error('Cloud AI service not configured');
    }

    if (sessions.length < 3) {
      return [];
    }

    try {
      const anonymizedData = this.anonymizeSessions(sessions);
      const prompt = this.buildInsightPrompt(anonymizedData);
      
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3, // Lower temperature for consistent insights
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const insights = this.parseInsightResponse(data.choices[0].message.content);
      
      return insights;
    } catch (error) {
      console.error('Cloud AI analysis failed:', error);
      throw error;
    }
  }

  // Get system prompt for rowing performance analysis
  private getSystemPrompt(): string {
    return `You are an expert rowing coach and sports data analyst specializing in indoor rowing performance analysis. 
You analyze rowing workout data to provide actionable insights, trend analysis, and personalized recommendations.

Your expertise includes:
- Rowing physiology and training principles
- Performance metrics (pace, power, stroke rate, distance)
- Training load management and recovery
- Technique improvement and efficiency
- Goal setting and progression planning

Always provide:
1. Evidence-based insights
2. Actionable recommendations
3. Priority levels (high/medium/low)
4. Confidence scores based on data quality
5. Clear explanations of findings

Focus on practical advice that helps rowers improve performance while avoiding injury and overtraining.`;
  }

  // Build user prompt with session data
  private buildInsightPrompt(sessions: any[]): string {
    const recentSessions = sessions.slice(-10); // Last 10 sessions
    const sessionSummary = this.createSessionSummary(recentSessions);
    
    return `Analyze the following indoor rowing workout data and provide personalized insights:

SESSION DATA:
${sessionSummary}

ANALYSIS REQUIREMENTS:
1. Performance Trends: Analyze pace, power, and stroke rate patterns
2. Training Load: Assess volume and intensity balance
3. Recovery Needs: Identify signs of overtraining or under-recovery
4. Technique Indicators: Look for efficiency patterns
5. Goal Progress: Evaluate progress toward typical rowing goals

RESPONSE FORMAT:
Return a JSON array of insights with this structure:
[
  {
    "type": "performance|recommendation|trend|achievement|warning",
    "title": "Brief insight title",
    "description": "Detailed explanation with specific advice",
    "actionable": true/false,
    "priority": "high|medium|low", 
    "confidence": 0.0-1.0,
    "evidence": ["specific data points supporting this insight"]
  }
]

Limit to 5 most important insights. Focus on actionable advice that will help the rower improve.`;
  }

  // Create readable session summary for the AI
  private createSessionSummary(sessions: any[]): string {
    return sessions.map((session, index) => {
      const pace = session.pace ? `${this.formatPace(session.pace)}/500m` : 'N/A';
      const power = session.power ? `${Math.round(session.power)}W` : 'N/A';
      const strokeRate = session.strokeRate ? `${Math.round(session.strokeRate)} spm` : 'N/A';
      
      return `Session ${index + 1} (${session.date}):
  - Distance: ${session.distance}m
  - Duration: ${this.formatDuration(session.duration)}
  - Pace: ${pace}
  - Power: ${power}
  - Stroke Rate: ${strokeRate}`;
    }).join('\n\n');
  }

  // Parse AI response into structured insights
  private parseInsightResponse(response: string): CloudInsight[] {
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      const insightsData = JSON.parse(jsonMatch[0]);
      
      return insightsData.map((insight: any, index: number) => ({
        id: `cloud-insight-${Date.now()}-${index}`,
        type: insight.type || 'recommendation',
        title: insight.title || 'Performance Insight',
        description: insight.description || 'No description provided',
        actionable: Boolean(insight.actionable),
        priority: insight.priority || 'medium',
        confidence: Math.max(0, Math.min(1, insight.confidence || 0.5)),
        evidence: Array.isArray(insight.evidence) ? insight.evidence : [],
        dateGenerated: new Date()
      }));
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      // Return fallback insight
      return [{
        id: `fallback-${Date.now()}`,
        type: 'warning' as const,
        title: 'AI Analysis Error',
        description: 'Unable to process AI insights. Please try again later.',
        actionable: false,
        priority: 'low' as const,
        confidence: 0,
        evidence: [],
        dateGenerated: new Date()
      }];
    }
  }

  // Test API connection
  async testConnection(): Promise<boolean> {
    if (!this.config) return false;
    
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        }
      });
      
      return response.ok;
    } catch (error) {
      console.error('API connection test failed:', error);
      return false;
    }
  }

  // Helper methods for formatting
  private formatPace(secondsPer500m: number): string {
    if (secondsPer500m <= 0) return '--:--';
    const minutes = Math.floor(secondsPer500m / 60);
    const seconds = Math.floor(secondsPer500m % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
}

// Export singleton instance
export const cloudAI = CloudAIService.getInstance();
