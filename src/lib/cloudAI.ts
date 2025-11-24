import { Session } from '@/types/session';
import { TrainingPlan, TrainingSession, TrainingWeek, PlanTemplate } from '@/lib/trainingPlans';
import { SettingsService } from '@/lib/settings';

// OpenAI API configuration
interface OpenAIConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

// GPT-5.1 Responses API request configuration
interface ApiRequestConfig {
  // Input (string for simple, array for conversations)
  input: string | Array<{ role: string; content: string }>;

  // Optional system-level guidance (higher priority than input)
  instructions?: string;

  // Model selection per use case
  model: 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5.1';

  // Reasoning effort per use case
  reasoning: "none" | "low" | "medium" | "high";

  // Output verbosity
  verbosity: "low" | "medium" | "high";

  // Maximum output tokens
  maxTokens: number;

  // Optional conversation chaining
  previousResponseId?: string;

  // Optional structured output format
  jsonSchema?: {
    name: string;
    schema: object;
  };

  // Optional storage control
  store?: boolean;

  // Tools (rarely used in our app)
  tools?: Array<{
    type: "function";
    name: string;
    description: string;
    parameters?: object;
  }>;
}

// Chat message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sessionId: string;
  responseId?: string; // AI response ID for conversation chaining
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
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
  private aiSettings: any = null; // Store AI settings for API calls

  private constructor() { }

  static getInstance(): CloudAIService {
    if (!CloudAIService.instance) {
      CloudAIService.instance = new CloudAIService();
    }
    return CloudAIService.instance;
  }

  // Initialize with API key and configuration from settings
  initialize(apiKey?: string): boolean {
    // Priority: user-provided key > environment variable
    const key = apiKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY;

    if (!key) {
      console.warn('OpenAI API key not provided');
      return false;
    }

    // Get AI settings for model configuration
    const settings = SettingsService.getInstance().getSettings();
    const aiSettings = settings.aiSettings;

    // Always update config (even if already initialized) to pick up settings changes
    this.config = {
      apiKey: key,
      model: 'gpt-5.1', // Default model (per-use-case models are used in actual calls)
      baseUrl: 'https://api.openai.com/v1'
    };

    // Always update AI settings for use in API calls
    this.aiSettings = aiSettings;

    console.log('CloudAI initialized with settings:', {
      chatReasoning: this.aiSettings.chat.reasoning,
      insightsReasoning: this.aiSettings.insights.reasoning,
      trainingPlansReasoning: this.aiSettings.trainingPlans.reasoning,
      maxTokens: this.aiSettings.maxTokens,
      insightsPrompt: this.aiSettings.insightsPrompt?.substring(0, 100) + '...'
    });

    return true;
  }

  // Check if service is configured
  isConfigured(): boolean {
    return this.config !== null;
  }

  // Send chat message to AI trainer
  async sendChatMessage(
    message: string,
    conversationHistory: ChatMessage[] = [],
    userSessions?: Session[],
    previousResponseId?: string
  ): Promise<{ content: string; responseId: string }> {
    if (!this.config) {
      throw new Error('Cloud AI service not configured');
    }

    try {
      const useCaseConfig = this.aiSettings.chat;
      const config: ApiRequestConfig = {
        input: message,
        instructions: this.getChatSystemPrompt(userSessions),
        model: useCaseConfig.model, // Use model from AI settings
        reasoning: useCaseConfig.reasoning,
        verbosity: useCaseConfig.verbosity,
        maxTokens: 1000,
        previousResponseId,    // Automatic context chaining
        store: true            // Store for future chaining
      };

      const response = await this.makeApiCall(config);

      return {
        content: this.parseResponse(response),
        responseId: response.id
      };
    } catch (error) {
      console.error('Chat AI failed:', error);
      throw error;
    }
  }

  // Build GPT-5.1 Responses API request
  private buildRequest(config: ApiRequestConfig): object {
    const request: any = {
      model: config.model, // Use model from config instead of hardcoded
      max_output_tokens: config.maxTokens
    };

    // Input (string or array - both work!)
    request.input = config.input;

    // Instructions (if provided)
    if (config.instructions) {
      request.instructions = config.instructions;
    }

    // Reasoning effort - map model-specific values
    const reasoningMapping: Record<string, Record<string, string>> = {
      'gpt-5-mini': {
        'none': 'minimal', // Map 'none' to 'minimal' for gpt-5-mini
        'low': 'low',
        'medium': 'medium',
        'high': 'high'
      },
      'gpt-5-nano': {
        'none': 'minimal', // Assume same mapping as gpt-5-mini
        'low': 'low',
        'medium': 'medium',
        'high': 'high'
      },
      'gpt-5.1': {
        'none': 'none', // Keep 'none' for gpt-5.1 if supported
        'low': 'low',
        'medium': 'medium',
        'high': 'high'
      }
    };

    const mappedReasoning = reasoningMapping[config.model]?.[config.reasoning] || config.reasoning;
    request.reasoning = { effort: mappedReasoning };

    // Verbosity and structured outputs
    request.text = { verbosity: config.verbosity };

    if (config.jsonSchema) {
      request.text.format = {
        type: "json_schema",
        name: config.jsonSchema.name,
        strict: true,
        schema: config.jsonSchema.schema
      };
    }

    // State management
    if (config.store !== undefined) {
      request.store = config.store;
    }

    if (config.previousResponseId) {
      request.previous_response_id = config.previousResponseId;
    }

    // Tools (if needed)
    if (config.tools?.length) {
      request.tools = config.tools;
    }

    return request;
  }

  // Parse GPT-5.1 Responses API response
  private parseResponse(data: any): string {
    // Use SDK helper if available
    if (data.output_text) {
      return data.output_text;
    }

    // Manual parsing (for HTTP responses)
    const messageOutput = data.output?.find(
      (item: any) => item.type === 'message'
    );

    if (messageOutput?.content?.length > 0) {
      const textContent = messageOutput.content.find(
        (c: any) => c.type === 'output_text'
      );

      if (textContent?.text) {
        return textContent.text;
      }
    }

    throw new Error('Unable to extract text from response');
  }

  // Make API call to GPT-5.1 Responses API
  private async makeApiCall(config: ApiRequestConfig): Promise<any> {
    const requestBody = this.buildRequest(config);

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config!.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status}. ${errorText}`);
    }

    const data = await response.json();
    return data;
  }



  // Get system prompt for chat AI trainer
  private getChatSystemPrompt(sessions?: Session[]): string {
    const sessionContext = sessions ? this.getSessionContext(sessions) : '';

    return `You are a personal AI rowing coach and trainer. You specialize in indoor rowing performance, technique, and training optimization.

YOUR EXPERTISE:
- Rowing technique and form improvement
- Training program design and periodization
- Performance analysis and goal setting
- Recovery and injury prevention
- Nutrition and lifestyle guidance for rowers
- Mental preparation and race strategy

YOUR PERSONALITY:
- Encouraging and motivational
- Knowledgeable but approachable
- Data-driven when relevant, but focused on practical advice
- Asks clarifying questions to provide better guidance
- Celebrates progress and provides constructive feedback

${sessionContext}

COMMUNICATION STYLE:
- Use conversational, encouraging language
- Provide specific, actionable advice
- Ask about the rower's goals, experience level, and constraints
- Reference their actual data when available to personalize recommendations
- Keep responses focused and practical

Remember: You're building a long-term coaching relationship. Be supportive, knowledgeable, and genuinely helpful in their rowing journey.`;
  }

  // Get user's session context for personalized coaching
  private getSessionContext(sessions: Session[]): string {
    if (!sessions || sessions.length === 0) {
      return 'USER DATA: No training sessions available yet.';
    }

    const recentSessions = sessions.slice(-5);
    const totalSessions = sessions.length;
    const totalDistance = sessions.reduce((sum, s) => sum + s.distance, 0);
    const avgPace = sessions
      .map(s => s.avgSplit)
      .filter(p => p > 0)
      .reduce((sum, p, _, arr) => sum + p / arr.length, 0);
    const avgPower = sessions
      .map(s => s.avgPower)
      .filter(p => p > 0)
      .reduce((sum, p, _, arr) => sum + p / arr.length, 0);

    return `USER DATA:
- Total Sessions: ${totalSessions}
- Total Distance: ${(totalDistance / 1000).toFixed(1)}km
- Average Pace: ${avgPace > 0 ? this.formatPace(avgPace) : 'N/A'}/500m
- Average Power: ${avgPower > 0 ? Math.round(avgPower) + 'W' : 'N/A'}
- Recent Activity: Last ${recentSessions.length} sessions in the past ${this.getDaysSpan(recentSessions)} days

Use this data to provide personalized coaching and reference their actual performance when relevant.`;
  }

  // Calculate time span of sessions
  private getDaysSpan(sessions: Session[]): number {
    if (sessions.length < 2) return 0;

    const dates = sessions.map(s => new Date(s.timestamp));
    const oldest = new Date(Math.min(...dates.map(d => d.getTime())));
    const newest = new Date(Math.max(...dates.map(d => d.getTime())));

    return Math.ceil((newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24));
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
      const useCaseConfig = this.aiSettings.insights;

      const config: ApiRequestConfig = {
        input: `${this.getSystemPrompt()}\n\n${prompt}`,
        model: useCaseConfig.model, // Use model from AI settings
        reasoning: useCaseConfig.reasoning,
        verbosity: useCaseConfig.verbosity,
        maxTokens: this.aiSettings?.maxTokens || 1500,
        jsonSchema: {
          name: "insights",
          schema: {
            type: "object",
            properties: {
              insights: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    actionable: { type: "boolean" },
                    priority: { type: "string" },
                    confidence: { type: "number" },
                    evidence: {
                      type: "array",
                      items: { type: "string" }
                    }
                  },
                  required: ["type", "title", "description", "actionable", "priority", "confidence", "evidence"],
                  additionalProperties: false
                }
              }
            },
            required: ["insights"],
            additionalProperties: false
          }
        }
      };

      const response = await this.makeApiCall(config);
      const content = this.parseResponse(response);
      const data = JSON.parse(content);

      return data.insights;
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

  // Build user prompt with session data using configurable prompt
  private buildInsightPrompt(sessions: any[]): string {
    // Include more sessions for better progress analysis
    const recentSessions = sessions.slice(-20); // Last 20 sessions for better context
    const sessionSummary = this.createSessionSummary(recentSessions);

    // Add training summary for progress analysis
    const trainingSummary = this.createTrainingSummary(sessions);

    // Get configurable insights prompt from settings
    const settings = SettingsService.getInstance().getSettings();
    const insightsPrompt = settings.aiSettings.insightsPrompt || this.getDefaultInsightsPrompt();

    // Restructure prompt to make analysis task clear
    let finalPrompt = `You are an expert rowing coach analyzing training data. The user has a specific request below.

USER REQUEST:
${insightsPrompt}

TRAINING DATA FOR ANALYSIS:
Below is the user's rowing workout data that you should analyze to answer their request.

${trainingSummary}

${sessionSummary}

YOUR TASK:
Analyze the training data above to address the user's request. Provide personalized insights, trends, and actionable recommendations based on the data.

RESPONSE FORMAT:
Return ONLY a JSON array of insights. Do not include the training data in your response - only your analysis and insights.

JSON structure:
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

CRITICAL: Your response must be ONLY the JSON array of insights. Do not include any explanations, markdown, or the training data itself.`;

    return finalPrompt;
  }

  // Default insights prompt fallback
  private getDefaultInsightsPrompt(): string {
    return `Analyze the following indoor rowing workout data and provide personalized insights:

SESSION DATA:
{sessionData}

ANALYSIS REQUIREMENTS:
1. Performance Trends: Analyze pace, power, and stroke rate patterns
2. Training Load: Assess volume and intensity balance
3. Recovery Needs: Identify signs of overtraining or under-recovery
4. Technique Indicators: Look for efficiency patterns
5. Goal Progress: Evaluate progress toward typical rowing goals

RESPONSE FORMAT:
IMPORTANT: Return ONLY a JSON array. Do not include any explanations, markdown, or additional text. Your entire response must be valid JSON that can be parsed directly.

Return a JSON array with this structure:
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

Limit to 5 most important insights. Focus on actionable advice that will help the rower improve.

CRITICAL: Your response must be ONLY the JSON array. No markdown code blocks, no explanations, no introductory text.`;
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

  // Create aggregated training summary for progress analysis
  private createTrainingSummary(sessions: any[]): string {
    if (sessions.length === 0) {
      return 'No training data available.';
    }

    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalDistance = sessions.reduce((sum, s) => sum + (s.distance || 0), 0);
    const avgPace = sessions.filter(s => s.pace).reduce((sum, s) => sum + s.pace, 0) / sessions.filter(s => s.pace).length || 0;
    const avgPower = sessions.filter(s => s.power).reduce((sum, s) => sum + s.power, 0) / sessions.filter(s => s.power).length || 0;
    const avgStrokeRate = sessions.filter(s => s.strokeRate).reduce((sum, s) => sum + s.strokeRate, 0) / sessions.filter(s => s.strokeRate).length || 0;

    // Calculate recent vs older comparisons for progress
    const recentSessions = sessions.slice(-5);
    const olderSessions = sessions.slice(-10, -5);

    const recentAvgPace = recentSessions.filter(s => s.pace).reduce((sum, s) => sum + s.pace, 0) / recentSessions.filter(s => s.pace).length || 0;
    const olderAvgPace = olderSessions.filter(s => s.pace).reduce((sum, s) => sum + s.pace, 0) / olderSessions.filter(s => s.pace).length || 0;

    const paceTrend = recentAvgPace < olderAvgPace ? 'improving (faster)' : recentAvgPace > olderAvgPace ? 'declining (slower)' : 'stable';

    // Date range
    const dates = sessions.map(s => new Date(s.date)).sort((a, b) => a.getTime() - b.getTime());
    const startDate = dates[0]?.toLocaleDateString();
    const endDate = dates[dates.length - 1]?.toLocaleDateString();

    return `TRAINING SUMMARY:
Total Sessions: ${totalSessions}
Training Period: ${startDate} to ${endDate}
Total Duration: ${this.formatDuration(totalDuration)} (${Math.round(totalDuration / 60)} hours)
Total Distance: ${this.formatDistance(totalDistance)} (${Math.round(totalDistance / 1000)} km)

AVERAGES:
Average Pace: ${avgPace ? this.formatPace(avgPace) + '/500m' : 'N/A'}
Average Power: ${avgPower ? Math.round(avgPower) + 'W' : 'N/A'}
Average Stroke Rate: ${avgStrokeRate ? Math.round(avgStrokeRate) + ' spm' : 'N/A'}

RECENT TRENDS (last 5 sessions vs previous 5):
Pace Trend: ${paceTrend}

TRAINING FREQUENCY:
Average sessions per week: ${(totalSessions / Math.max(1, Math.ceil((dates[dates.length - 1]?.getTime() - dates[0]?.getTime()) / (1000 * 60 * 60 * 24 * 7)))).toFixed(1)}`;
  }

  // Parse AI response into structured insights
  private parseInsightResponse(response: string): CloudInsight[] {
    try {
      console.log('Raw AI response:', response); // Debug logging

      // Multiple attempts to extract JSON from response
      let jsonString = '';

      // Try 1: Look for JSON array with markdown code blocks
      const markdownMatch = response.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (markdownMatch) {
        jsonString = markdownMatch[1];
      } else {
        // Try 2: Look for JSON array without markdown
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          jsonString = jsonMatch[0];
        } else {
          // Try 3: Look for JSON object with insights property
          const objectMatch = response.match(/\{[\s\S]*"insights"[\s\S]*\}/);
          if (objectMatch) {
            const parsed = JSON.parse(objectMatch[0]);
            jsonString = JSON.stringify(parsed.insights || parsed);
          } else {
            // Try 4: Try to parse the entire response as JSON
            try {
              const parsed = JSON.parse(response.trim());
              jsonString = JSON.stringify(Array.isArray(parsed) ? parsed : parsed.insights || parsed);
            } catch {
              throw new Error('No JSON found in AI response. Response was: ' + response.substring(0, 200));
            }
          }
        }
      }

      // Clean up the JSON string
      jsonString = jsonString
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
        .replace(/\\n/g, '\\\\n') // Fix escaped newlines
        .trim();

      console.log('Extracted JSON:', jsonString); // Debug logging

      const insightsData = JSON.parse(jsonString);

      // Ensure we have an array
      const insightsArray = Array.isArray(insightsData) ? insightsData : [insightsData];

      return insightsArray.map((insight: any, index: number) => ({
        id: `cloud-insight-${Date.now()}-${index}`,
        type: insight.type || 'recommendation',
        title: insight.title || 'Performance Insight',
        description: insight.description || 'No description provided',
        actionable: Boolean(insight.actionable),
        priority: insight.priority || 'medium',
        confidence: Math.max(0, Math.min(1, Number(insight.confidence) || 0.5)),
        evidence: Array.isArray(insight.evidence) ? insight.evidence : [],
        dateGenerated: new Date()
      }));
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.error('Response content:', response);

      // Return fallback insight instead of throwing
      return [{
        id: `cloud-insight-fallback-${Date.now()}`,
        type: 'recommendation',
        title: 'AI Analysis Error',
        description: `Unable to process AI analysis: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your AI configuration.`,
        actionable: false,
        priority: 'low' as const,
        confidence: 0,
        evidence: [],
        dateGenerated: new Date()
      }];
    }
  }

  // Generate training plan using AI
  async generateTrainingPlan(
    goals: string[],
    level: 'beginner' | 'intermediate' | 'advanced',
    focus: 'general_fitness' | 'endurance' | 'speed' | 'strength' | 'competition',
    duration: number,
    userSessions?: Session[]
  ): Promise<TrainingPlan> {
    if (!this.config) {
      throw new Error('Cloud AI service not configured');
    }

    try {
      const prompt = this.buildPlanGenerationPrompt(goals, level, focus, duration, userSessions);

      const useCaseConfig = this.aiSettings.trainingPlans;
      const config: ApiRequestConfig = {
        input: `${this.getPlanGenerationSystemPrompt()}\n\n${prompt}`,
        instructions: "Generate a structured training plan following the specified JSON schema",
        model: useCaseConfig.model, // Use model from AI settings
        reasoning: useCaseConfig.reasoning,
        verbosity: useCaseConfig.verbosity,
        maxTokens: this.aiSettings?.maxTokens || 4000,
        jsonSchema: {
          name: "training_plan",
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              weeks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    weekNumber: { type: "number" },
                    focus: { type: "string" },
                    sessions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          day: { type: "number" },
                          type: { type: "string" },
                          title: { type: "string" },
                          description: { type: "string" },
                          duration: { type: "number" },
                          intensity: { type: "string" },
                          notes: { type: "string" }
                        },
                        required: ["day", "type", "title", "description", "duration", "intensity", "notes"],
                        additionalProperties: false
                      }
                    }
                  },
                  required: ["weekNumber", "focus", "sessions"],
                  additionalProperties: false
                }
              }
            },
            required: ["title", "description", "weeks"],
            additionalProperties: false
          }
        }
      };

      const response = await this.makeApiCall(config);
      const content = this.parseResponse(response);
      const planData = JSON.parse(content);

      return this.createTrainingPlanFromAI(planData, goals, level, focus, duration);
    } catch (error) {
      console.error('Training plan generation failed:', error);
      throw error;
    }
  }

  // Modify existing training plan
  async modifyTrainingPlan(
    plan: TrainingPlan,
    modificationRequest: string,
    userSessions?: Session[]
  ): Promise<TrainingPlan> {
    if (!this.config) {
      throw new Error('Cloud AI service not configured');
    }

    try {
      const prompt = this.buildPlanModificationPrompt(plan, modificationRequest, userSessions);

      const useCaseConfig = this.aiSettings.trainingPlans;
      const config: ApiRequestConfig = {
        input: `${this.getPlanModificationSystemPrompt()}\n\n${prompt}`,
        instructions: "Modify the training plan following the specified JSON schema",
        model: useCaseConfig.model, // Use model from AI settings
        reasoning: useCaseConfig.reasoning,
        verbosity: useCaseConfig.verbosity,
        maxTokens: this.aiSettings?.maxTokens || 4000,
        jsonSchema: {
          name: "training_plan",
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              weeks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    weekNumber: { type: "number" },
                    focus: { type: "string" },
                    sessions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          day: { type: "number" },
                          type: { type: "string" },
                          title: { type: "string" },
                          description: { type: "string" },
                          duration: { type: "number" },
                          intensity: { type: "string" },
                          notes: { type: "string" }
                        },
                        required: ["day", "type", "title", "description", "duration", "intensity", "notes"],
                        additionalProperties: false
                      }
                    }
                  },
                  required: ["weekNumber", "focus", "sessions"],
                  additionalProperties: false
                }
              }
            },
            required: ["title", "description", "weeks"],
            additionalProperties: false
          }
        }
      };

      const response = await this.makeApiCall(config);
      const modifications = JSON.parse(this.parseResponse(response));

      return this.applyPlanModifications(plan, modifications);
    } catch (error) {
      console.error('Plan modification failed:', error);
      throw error;
    }
  }

  // Analyze plan adherence and provide recommendations
  async analyzePlanAdherence(
    plan: TrainingPlan,
    userSessions: Session[]
  ): Promise<string> {
    if (!this.config) {
      throw new Error('Cloud AI service not configured');
    }

    try {
      const prompt = this.buildAdherenceAnalysisPrompt(plan, userSessions);
      const useCaseConfig = this.aiSettings.insights;

      const config: ApiRequestConfig = {
        input: `${this.getAdherenceAnalysisSystemPrompt()}\n\n${prompt}`,
        model: useCaseConfig.model, // Use model from AI settings
        reasoning: useCaseConfig.reasoning,
        verbosity: useCaseConfig.verbosity,
        maxTokens: 1000
      };

      const response = await this.makeApiCall(config);
      return this.parseResponse(response);
    } catch (error) {
      console.error('Adherence analysis failed:', error);
      throw error;
    }
  }

  // Build prompt for plan generation
  private buildPlanGenerationPrompt(
    goals: string[],
    level: 'beginner' | 'intermediate' | 'advanced',
    focus: 'general_fitness' | 'endurance' | 'speed' | 'strength' | 'competition',
    duration: number,
    userSessions?: Session[]
  ): string {
    const userContext = userSessions ? this.getUserContextForPlanning(userSessions) : '';

    return `Generate a ${duration}-week training plan for a ${level} rower focusing on ${focus}.

GOALS: ${goals.join(', ')}

${userContext}

REQUIREMENTS:
- Create structured weekly plan with appropriate progression
- Include variety: endurance, intervals, tempo, recovery, technique
- Match current fitness level and experience
- Build in recovery periods
- Make sessions realistic and achievable

Create exactly ${duration} weeks with 3-6 sessions per week.`;
  }

  // Build prompt for plan modification
  private buildPlanModificationPrompt(
    plan: TrainingPlan,
    modificationRequest: string,
    userSessions?: Session[]
  ): string {
    const planSummary = this.summarizePlan(plan);
    const userContext = userSessions ? this.getUserContextForPlanning(userSessions) : '';

    return `Modify the following training plan based on the user's request:

CURRENT PLAN:
${planSummary}

USER REQUEST: ${modificationRequest}

${userContext}

RESPONSE FORMAT:
Return a JSON object with the modifications:
{
  "title": "Updated plan title (if changed)",
  "description": "Updated description (if changed)",
  "weekModifications": [
    {
      "weekNumber": 1,
      "focus": "Updated week focus (if changed)",
      "sessionChanges": [
        {
          "day": 1,
          "action": "add|modify|remove",
          "session": { ...session data ... }
        }
      ]
    }
  ],
  "reasoning": "Explanation of changes made"
}

Only modify what's necessary to address the user's request.`;
  }

  // Build prompt for adherence analysis
  private buildAdherenceAnalysisPrompt(plan: TrainingPlan, userSessions: Session[]): string {
    const adherenceData = this.calculateAdherenceMetrics(plan, userSessions);

    return `Analyze the training plan adherence and provide recommendations:

PLAN ADHERENCE DATA:
${adherenceData}

USER'S RECENT SESSIONS:
${this.summarizeRecentSessions(userSessions.slice(-10))}

Provide analysis on:
1. Current adherence rate and what it means
2. Patterns in missed or completed sessions
3. Recommendations for improving adherence
4. Suggestions for plan adjustments if needed

Keep the response encouraging and actionable.`;
  }

  // System prompts
  private getPlanGenerationSystemPrompt(): string {
    return `You are an expert rowing coach and sports scientist specializing in training plan design. 
You create personalized, progressive training plans for rowers of all levels.

Your expertise includes:
- Exercise physiology and training principles
- Periodization and progressive overload
- Rowing-specific training methodologies
- Injury prevention and recovery management
- Goal-oriented program design

Always create plans that are:
- Scientifically sound and progressive
- Realistic and achievable for the target level
- Varied to maintain engagement and prevent plateaus
- Appropriate for the stated goals and focus area
- Include proper recovery and adaptation periods

Ensure the plan structure follows proper training principles with appropriate volume and intensity progression.`;
  }

  private getPlanModificationSystemPrompt(): string {
    return `You are an expert rowing coach helping athletes modify their training plans. 
You understand how to adjust programs while maintaining training integrity and progression.

When modifying plans:
- Preserve the overall training structure and progression
- Make changes that address the specific request
- Maintain appropriate balance between training and recovery
- Explain your reasoning for modifications
- Ensure the plan remains realistic and achievable

Always consider the athlete's current progress and capabilities when suggesting changes.`;
  }

  private getAdherenceAnalysisSystemPrompt(): string {
    return `You are an expert rowing coach analyzing training plan adherence. 
You provide constructive, encouraging feedback and practical recommendations.

Your analysis should:
- Identify positive patterns and successes
- Address challenges without being critical
- Provide specific, actionable recommendations
- Consider the athlete's overall training load and life factors
- Suggest plan adjustments when adherence issues indicate the plan is too difficult or easy

Maintain a supportive, motivational tone while being honest about adherence patterns.`;
  }

  // Helper methods for plan generation
  private parsePlanResponse(response: string): any {
    try {
      // Log raw response details
      console.log('🔍 AI Response Analysis:');
      console.log('- Raw response length:', response.length);
      console.log('- Raw response preview (first 200 chars):', response.substring(0, 200));
      console.log('- Raw response preview (last 200 chars):', response.substring(response.length - 200));

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('❌ No JSON found in response - checking for markdown wrapping');
        console.log('- Contains markdown code blocks:', response.includes('```'));
        console.log('- Contains "json":', response.includes('json'));
        throw new Error('No JSON found in AI response');
      }

      let extractedJson = jsonMatch[0];
      console.log('✅ JSON extracted with regex');
      console.log('- Extracted JSON length:', extractedJson.length);
      console.log('- JSON starts with:', extractedJson.substring(0, 100));
      console.log('- JSON ends with:', extractedJson.substring(extractedJson.length - 100));

      // Check for common JSON issues around position 8500
      if (extractedJson.length > 8500) {
        const errorContext = extractedJson.substring(8450, 8550);
        console.log('🎯 Context around error position 8500:', errorContext);

        // Check for trailing commas
        const trailingCommaMatches = extractedJson.match(/,\s*[}\]]/g);
        if (trailingCommaMatches) {
          console.log('⚠️ Found trailing commas in JSON:', trailingCommaMatches.length, 'instances');
        }

        // Check for incomplete arrays/objects
        const openBraces = (extractedJson.match(/\{/g) || []).length;
        const closeBraces = (extractedJson.match(/\}/g) || []).length;
        const openBrackets = (extractedJson.match(/\[/g) || []).length;
        const closeBrackets = (extractedJson.match(/\]/g) || []).length;

        console.log('📊 Brace/Bracket balance:');
        console.log('- Open braces {:', openBraces, 'Close braces }:', closeBraces);
        console.log('- Open brackets [:', openBrackets, 'Close brackets ]:', closeBrackets);

        if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
          console.log('❌ Unbalanced braces/brackets - attempting JSON repair...');
          extractedJson = this.repairIncompleteJSON(extractedJson, openBraces, closeBraces, openBrackets, closeBrackets);
          console.log('🔧 JSON repaired, new length:', extractedJson.length);
        }
      }

      const parsed = JSON.parse(extractedJson);
      console.log('✅ JSON parsed successfully');
      return parsed;
    } catch (error) {
      console.error('❌ Failed to parse plan response:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      } else {
        console.error('Non-Error thrown:', error);
      }
      throw new Error('Invalid plan format from AI');
    }
  }

  private repairIncompleteJSON(json: string, openBraces: number, closeBraces: number, openBrackets: number, closeBrackets: number): string {
    let repaired = json;

    // Remove trailing commas that might be causing the issue
    repaired = repaired.replace(/,\s*([}\]])/g, '$1');

    // Add missing closing brackets and braces
    const missingBraces = openBraces - closeBraces;
    const missingBrackets = openBrackets - closeBrackets;

    // Add missing closing brackets first (inner structures)
    for (let i = 0; i < missingBrackets; i++) {
      repaired += ']';
    }

    // Add missing closing braces (outer structures)
    for (let i = 0; i < missingBraces; i++) {
      repaired += '}';
    }

    console.log('🔧 JSON repair applied:');
    console.log('- Added', missingBrackets, 'closing brackets');
    console.log('- Added', missingBraces, 'closing braces');

    return repaired;
  }

  private parsePlanModificationResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Failed to parse modification response:', error);
      throw new Error('Invalid modification format from AI');
    }
  }

  private createTrainingPlanFromAI(
    planData: any,
    goals: string[],
    level: 'beginner' | 'intermediate' | 'advanced',
    focus: 'general_fitness' | 'endurance' | 'speed' | 'strength' | 'competition',
    duration: number
  ): TrainingPlan {
    const weeks: TrainingWeek[] = planData.weeks.map((weekData: any, index: number) => ({
      id: `week_${Date.now()}_${index}`,
      weekNumber: weekData.weekNumber,
      focus: weekData.focus,
      totalVolume: weekData.sessions.reduce((total: number, session: any) => total + session.duration, 0),
      sessions: weekData.sessions.map((sessionData: any, sessionIndex: number) => ({
        id: `session_${Date.now()}_${index}_${sessionIndex}`,
        day: sessionData.day,
        week: weekData.weekNumber,
        type: sessionData.type,
        title: sessionData.title,
        description: sessionData.description,
        duration: sessionData.duration,
        intensity: sessionData.intensity,
        notes: sessionData.notes,
        completed: false
      })),
      completed: false,
      actualVolume: 0
    }));

    return {
      id: `plan_${Date.now()}`,
      title: planData.title,
      description: planData.description,
      goals,
      duration,
      level,
      focus,
      createdAt: new Date(),
      updatedAt: new Date(),
      weeks,
      status: 'draft',
      progress: {
        completedWeeks: 0,
        completedSessions: 0,
        totalSessions: weeks.reduce((total, week) => total + week.sessions.length, 0),
        adherenceRate: 0
      }
    };
  }

  private applyPlanModifications(plan: TrainingPlan, modifications: any): TrainingPlan {
    // Apply modifications to the plan
    const updatedPlan = { ...plan };

    if (modifications.title) {
      updatedPlan.title = modifications.title;
    }

    if (modifications.description) {
      updatedPlan.description = modifications.description;
    }

    if (modifications.weekModifications) {
      modifications.weekModifications.forEach((weekMod: any) => {
        const weekIndex = updatedPlan.weeks.findIndex(w => w.weekNumber === weekMod.weekNumber);
        if (weekIndex !== -1) {
          if (weekMod.focus) {
            updatedPlan.weeks[weekIndex].focus = weekMod.focus;
          }

          if (weekMod.sessionChanges) {
            weekMod.sessionChanges.forEach((change: any) => {
              if (change.action === 'add') {
                updatedPlan.weeks[weekIndex].sessions.push({
                  id: `session_${Date.now()}`,
                  ...change.session,
                  week: weekMod.weekNumber,
                  completed: false
                });
              } else if (change.action === 'modify') {
                const sessionIndex = updatedPlan.weeks[weekIndex].sessions.findIndex(
                  s => s.day === change.session.day
                );
                if (sessionIndex !== -1) {
                  updatedPlan.weeks[weekIndex].sessions[sessionIndex] = {
                    ...updatedPlan.weeks[weekIndex].sessions[sessionIndex],
                    ...change.session
                  };
                }
              } else if (change.action === 'remove') {
                updatedPlan.weeks[weekIndex].sessions = updatedPlan.weeks[weekIndex].sessions.filter(
                  s => s.day !== change.session.day
                );
              }
            });
          }
        }
      });
    }

    updatedPlan.updatedAt = new Date();
    return updatedPlan;
  }

  private getUserContextForPlanning(sessions: Session[]): string {
    if (!sessions || sessions.length === 0) {
      return 'USER DATA: No previous training sessions available.';
    }

    const recentSessions = sessions.slice(-10);
    const totalSessions = sessions.length;
    const avgDuration = sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length;
    const avgPace = sessions
      .map(s => s.avgSplit)
      .filter(p => p > 0)
      .reduce((sum, p, _, arr) => sum + p / arr.length, 0);
    const weeklyFrequency = this.calculateWeeklyFrequency(sessions);

    return `USER DATA:
- Experience Level: ${totalSessions < 10 ? 'Beginner' : totalSessions < 50 ? 'Intermediate' : 'Advanced'}
- Total Sessions: ${totalSessions}
- Average Session Duration: ${Math.round(avgDuration / 60)} minutes
- Average Pace: ${avgPace > 0 ? this.formatPace(avgPace) : 'N/A'}/500m
- Weekly Training Frequency: ${weeklyFrequency} sessions per week
- Recent Activity: Last ${recentSessions.length} sessions

Use this data to create an appropriate plan that matches their current fitness and experience level.`;
  }

  private calculateAdherenceMetrics(plan: TrainingPlan, sessions: Session[]): string {
    const totalPlannedSessions = plan.progress.totalSessions;
    const completedSessions = plan.progress.completedSessions;
    const adherenceRate = totalPlannedSessions > 0 ? (completedSessions / totalPlannedSessions) * 100 : 0;

    return `ADHERENCE METRICS:
- Planned Sessions: ${totalPlannedSessions}
- Completed Sessions: ${completedSessions}
- Adherence Rate: ${adherenceRate.toFixed(1)}%
- Completed Weeks: ${plan.progress.completedWeeks}/${plan.duration}
- Plan Status: ${plan.status}`;
  }

  private summarizePlan(plan: TrainingPlan): string {
    return `PLAN SUMMARY:
- Title: ${plan.title}
- Duration: ${plan.duration} weeks
- Level: ${plan.level}
- Focus: ${plan.focus}
- Goals: ${plan.goals.join(', ')}
- Total Sessions: ${plan.progress.totalSessions}
- Current Progress: ${plan.progress.completedWeeks}/${plan.duration} weeks completed`;
  }

  private summarizeRecentSessions(sessions: Session[]): string {
    return sessions.map((session, index) => {
      const pace = session.avgSplit ? `${this.formatPace(session.avgSplit)}/500m` : 'N/A';
      return `Session ${index + 1}: ${session.distance}m in ${this.formatDuration(session.duration)} at ${pace}`;
    }).join('\n');
  }

  private calculateWeeklyFrequency(sessions: Session[]): number {
    if (sessions.length < 7) return sessions.length;

    const recentSessions = sessions.slice(-28); // Last 4 weeks
    const weeksSpan = this.getDaysSpan(recentSessions) / 7 || 1;
    return recentSessions.length / weeksSpan;
  }

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

  private formatDistance(meters: number): string {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)}km`;
    } else {
      return `${Math.round(meters)}m`;
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
}

// Export singleton instance
export const cloudAI = CloudAIService.getInstance();
