import { Session } from '@/types/session';
import { TrainingPlan, TrainingSession, TrainingWeek, PlanTemplate } from '@/lib/trainingPlans';

// OpenAI API configuration
interface OpenAIConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

// Chat message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sessionId: string;
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

  // Send chat message to AI trainer
  async sendChatMessage(
    message: string, 
    conversationHistory: ChatMessage[] = [],
    userSessions?: Session[]
  ): Promise<string> {
    if (!this.config) {
      throw new Error('Cloud AI service not configured');
    }

    try {
      const messages = this.buildChatMessages(message, conversationHistory, userSessions);
      
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: 0.7, // Higher temperature for more conversational responses
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Chat AI failed:', error);
      throw error;
    }
  }

  // Build chat message array with system prompt and conversation context
  private buildChatMessages(
    userMessage: string, 
    history: ChatMessage[], 
    sessions?: Session[]
  ): any[] {
    const systemPrompt = this.getChatSystemPrompt(sessions);
    
    // Start with system prompt
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      }
    ];

    // Add conversation history (last 10 messages to maintain context)
    const recentHistory = history.slice(-10);
    recentHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage
    });

    return messages;
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
              content: this.getPlanGenerationSystemPrompt()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.4, // Lower temperature for structured output
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const planData = this.parsePlanResponse(data.choices[0].message.content);
      
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
              content: this.getPlanModificationSystemPrompt()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.4,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const modifications = this.parsePlanModificationResponse(data.choices[0].message.content);
      
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
              content: this.getAdherenceAnalysisSystemPrompt()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.5,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
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
- Create a structured weekly plan with appropriate progression
- Include variety of session types (endurance, intervals, tempo, recovery, technique)
- Consider the rower's current fitness level and experience
- Build in appropriate recovery periods
- Make sessions realistic and achievable

RESPONSE FORMAT:
Return a JSON object with this structure:
{
  "title": "Plan title",
  "description": "Brief description of the plan",
  "weeks": [
    {
      "weekNumber": 1,
      "focus": "Week focus description",
      "sessions": [
        {
          "day": 1,
          "type": "endurance|interval|tempo|recovery|strength|technique|rest",
          "title": "Session title",
          "description": "Detailed session description",
          "duration": 45,
          "intensity": "low|medium|high",
          "notes": "Optional coaching notes"
        }
      ]
    }
  ]
}

Create exactly ${duration} weeks with 3-6 sessions per week depending on the level and focus.`;
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
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Failed to parse plan response:', error);
      throw new Error('Invalid plan format from AI');
    }
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
