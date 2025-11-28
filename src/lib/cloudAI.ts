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

  // Streaming callback
  onToken?: (token: string) => void;
}

// File attachment for chat messages
export interface FileAttachment {
  name: string;
  mimeType: string;
  data: string; // base64 data URL (e.g., "data:image/png;base64,...")
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
    previousResponseId?: string,
    onToken?: (token: string) => void,
    attachments?: FileAttachment[]
  ): Promise<{ content: string; responseId: string }> {
    if (!this.config) {
      throw new Error('Cloud AI service not configured');
    }

    try {
      const useCaseConfig = this.aiSettings.chat;

      // Define tools available to the model
      const tools = [
        {
          type: "function" as const,
          name: "get_sessions",
          description: "Get rowing sessions from the user's history. Can filter by date range or get specific session details.",
          parameters: {
            type: "object",
            properties: {
              limit: {
                type: ["number", "null"],
                description: "Number of sessions to retrieve (default: 5, max: 20)"
              },
              startDate: {
                type: ["string", "null"],
                description: "Filter sessions after this date (ISO format YYYY-MM-DD)"
              },
              endDate: {
                type: ["string", "null"],
                description: "Filter sessions before this date (ISO format YYYY-MM-DD)"
              },
              sessionId: {
                type: ["string", "null"],
                description: "Get a specific session by ID"
              },
              includeDetails: {
                type: ["boolean", "null"],
                description: "Include detailed stroke data for deep analysis (default: false)"
              }
            },
            required: ["limit", "startDate", "endDate", "sessionId", "includeDetails"],
            additionalProperties: false
          },
          strict: true
        },
        {
          type: "function" as const,
          name: "get_memory_documents",
          description: "Retrieve documents from the user's coaching memory. Includes user uploads (PDFs, images) AND system-generated content like training plans and insights.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: ["string", "null"],
                description: "Search query to filter documents by name, description, or extracted text"
              },
              type: {
                type: ["string", "null"],
                enum: ["image", "pdf", "training_plan", "insight", "note", null],
                description: "Filter by document type"
              },
              source: {
                type: ["string", "null"],
                enum: ["user", "system", null],
                description: "Filter by source (user uploads vs system-generated)"
              },
              activeOnly: {
                type: ["boolean", "null"],
                description: "For training plans: only return active plan (default: false)"
              },
              includeContent: {
                type: ["boolean", "null"],
                description: "Include full extracted text content (default: false, only summaries)"
              }
            },
            required: ["query", "type", "source", "activeOnly", "includeContent"],
            additionalProperties: false
          },
          strict: true
        },
        {
          type: "function" as const,
          name: "get_achievements",
          description: "Get the user's personal records (PRs) and earned awards/achievements. Use this to understand the user's best performances and milestones.",
          parameters: {
            type: "object",
            properties: {
              includePersonalRecords: {
                type: ["boolean", "null"],
                description: "Include personal records for standard distances (100m, 500m, 1000m, 2000m, 5000m). Default: true"
              },
              includeAwards: {
                type: ["boolean", "null"],
                description: "Include earned awards/achievements. Default: true"
              },
              includeNextAwards: {
                type: ["boolean", "null"],
                description: "Include upcoming awards the user is close to earning. Default: false"
              }
            },
            required: ["includePersonalRecords", "includeAwards", "includeNextAwards"],
            additionalProperties: false
          },
          strict: true
        }
      ];

      // Prepare initial input messages
      const messages: any[] = [
        { role: 'system', content: this.getChatSystemPrompt() },
        ...conversationHistory.slice(-10).map(msg => ({
          role: msg.role,
          content: msg.content
        })),
      ];

      // Build user message with optional file attachments
      if (attachments && attachments.length > 0) {
        // Multi-part content with files and text
        const userContent: any[] = [];
        
        // Supported MIME types for OpenAI file inputs
        const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const supportedFileTypes = ['application/pdf'];

        // Add file attachments first
        for (const attachment of attachments) {
          // Check if it's a supported image type
          if (supportedImageTypes.some(type => attachment.mimeType.startsWith(type.split('/')[0]) && attachment.mimeType.includes(type.split('/')[1])) || 
              attachment.mimeType.startsWith('image/')) {
            // Image attachment - use input_image
            userContent.push({
              type: 'input_image',
              image_url: attachment.data
            });
          } else if (attachment.mimeType === 'application/pdf') {
            // PDF attachment - use input_file
            userContent.push({
              type: 'input_file',
              filename: attachment.name,
              file_data: attachment.data
            });
          } else if (supportedFileTypes.includes(attachment.mimeType)) {
            // Other supported file types
            userContent.push({
              type: 'input_file',
              filename: attachment.name,
              file_data: attachment.data
            });
          } else {
            // Unsupported file type - log warning and skip
            console.warn(`Skipping unsupported file type: ${attachment.mimeType} for file: ${attachment.name}`);
            // Don't add to userContent - will be handled as text context if available
          }
        }

        // Add text message
        if (message.trim()) {
          userContent.push({
            type: 'input_text',
            text: message
          });
        } else {
          // If no text, add a default prompt
          userContent.push({
            type: 'input_text',
            text: 'Please analyze the attached file(s).'
          });
        }

        messages.push({ role: 'user', content: userContent });
      } else {
        // Simple text-only message
        messages.push({ role: 'user', content: message });
      }

      let currentInput: any = messages;
      let currentPreviousResponseId = previousResponseId;
      let finalContent = '';
      let finalResponseId = '';

      // Tool loop - handle up to 5 turns of tool calls
      for (let turn = 0; turn < 5; turn++) {
        const config: ApiRequestConfig = {
          input: currentInput,
          model: useCaseConfig.model,
          reasoning: useCaseConfig.reasoning,
          verbosity: useCaseConfig.verbosity,
          maxTokens: this.aiSettings.maxTokens,
          previousResponseId: currentPreviousResponseId,
          store: true,
          tools: tools,
          onToken: onToken // Pass streaming callback
        };

        const response = await this.makeApiCall(config);

        finalResponseId = response.id;

        // Check for tool calls
        const toolCalls = response.output?.filter((item: any) => item.type === 'function_call');

        if (toolCalls && toolCalls.length > 0) {
          // Execute tools and prepare next input
          const toolOutputs = [];

          for (const toolCall of toolCalls) {
            const args = JSON.parse(toolCall.arguments);
            const result = await this.executeTool(toolCall.name, args);

            toolOutputs.push({
              type: "function_call_output",
              call_id: toolCall.call_id,
              output: JSON.stringify(result)
            });
          }

          // Feed tool outputs back to model
          currentInput = toolOutputs;
          currentPreviousResponseId = response.id;
        } else {
          // No tool calls, just get the text response
          finalContent = this.parseResponse(response);
          break;
        }
      }

      return {
        content: finalContent,
        responseId: finalResponseId
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

    // Streaming
    if (config.onToken) {
      request.stream = true;
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

    // Handle streaming response
    if (config.onToken && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResponse: any = { id: '', output: [] };

      // Track items being built by index
      const activeItems: Record<number, any> = {};

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() === '') continue;
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              if (dataStr === '[DONE]') continue;

              try {
                const event = JSON.parse(dataStr);

                // Capture Response ID
                if (event.response_id && !finalResponse.id) {
                  finalResponse.id = event.response_id;
                }

                // Handle Event Types based on documented API
                if (event.type === 'response.output_text.delta') {
                  // Simple text delta - just call the callback
                  if (event.delta) {
                    config.onToken(event.delta);
                  }
                } else if (event.type === 'response.completed') {
                  // Stream is complete - the event contains the full response
                  if (event.response) {
                    finalResponse = event.response;
                  }
                } else if (event.type === 'response.output_item.added') {
                  const index = event.output_index;
                  activeItems[index] = event.item;
                  if (event.item.type === 'message' && !activeItems[index].content) {
                    activeItems[index].content = [];
                  }
                } else if (event.type === 'response.content_part.added') {
                  const index = event.output_index;
                  const partIndex = event.content_index || 0;
                  if (activeItems[index] && activeItems[index].type === 'message') {
                    if (!activeItems[index].content[partIndex]) {
                      activeItems[index].content[partIndex] = event.part;
                    }
                  }
                } else if (event.type === 'response.content_part.delta') {
                  const index = event.output_index;
                  const partIndex = event.content_index || 0;
                  if (event.delta) {
                    if (activeItems[index] && activeItems[index].content && activeItems[index].content[partIndex]) {
                      activeItems[index].content[partIndex].text += event.delta;
                    }
                    config.onToken(event.delta);
                  }
                } else if (event.type === 'response.function_call_arguments.delta') {
                  const index = event.output_index;
                  if (activeItems[index] && activeItems[index].type === 'function_call') {
                    activeItems[index].arguments += event.delta;
                  }
                } else if (event.type === 'response.output_item.done') {
                  const index = event.output_index;
                  activeItems[index] = event.item;
                }

              } catch {
                // Ignore malformed SSE chunks
              }
            }
          }
        }
      } catch (error) {
        console.error('Error reading stream:', error);
      } finally {
        reader.releaseLock();
      }

      // Construct final response object
      finalResponse.output = Object.values(activeItems);

      // Safeguard: if output is empty, this is an error
      if (!finalResponse.output || finalResponse.output.length === 0) {
        console.error('Streaming response had no output');
        throw new Error('Streaming response had no output. This may indicate an API error or unsupported response format.');
      }

      return finalResponse;
    }

    // Handle standard response
    const data = await response.json();
    return data;
  }

  // Execute tool calls
  private async executeTool(name: string, args: any): Promise<any> {
    if (name === 'get_sessions') {
      // Dynamic import to avoid circular dependencies if possible, or just use the store
      // Since we're in a class, we can access the store directly via import
      const { useRowingStore } = await import('@/lib/store');
      const store = useRowingStore.getState();
      const sessions = store.sessions;

      const includeDetails = args.includeDetails === true;

      if (args.sessionId) {
        const session = sessions.find(s => s.id === args.sessionId);
        return session ? this.anonymizeSessions([session], includeDetails)[0] : { error: "Session not found" };
      }

      let filtered = [...sessions];

      if (args.startDate) {
        const start = new Date(args.startDate);
        filtered = filtered.filter(s => new Date(s.timestamp) >= start);
      }

      if (args.endDate) {
        const end = new Date(args.endDate);
        filtered = filtered.filter(s => new Date(s.timestamp) <= end);
      }

      // Sort by date desc
      filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const limit = args.limit || 5;
      return this.anonymizeSessions(filtered.slice(0, limit), includeDetails);
    }

    if (name === 'get_memory_documents') {
      const { memoryStorage } = await import('@/lib/memoryStorage');

      let docs = await memoryStorage.getAllDocuments();

      // Filter by type
      if (args.type) {
        docs = docs.filter(d => d.type === args.type);
      }

      // Filter by source
      if (args.source) {
        docs = docs.filter(d => d.source === args.source);
      }

      // Filter active training plans only
      if (args.activeOnly && args.type === 'training_plan') {
        docs = docs.filter(d => d.status === 'active');
      }

      // Search by query
      if (args.query) {
        const query = args.query.toLowerCase();
        docs = docs.filter(d =>
          d.name.toLowerCase().includes(query) ||
          d.description?.toLowerCase().includes(query) ||
          d.extractedText?.toLowerCase().includes(query) ||
          d.tags?.some(tag => tag.toLowerCase().includes(query))
        );
      }

      // Sort by date desc
      docs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

      // Return formatted results
      const result = docs.map(doc => ({
        id: doc.id,
        name: doc.name,
        type: doc.type,
        source: doc.source,
        description: doc.description,
        uploadedAt: doc.uploadedAt,
        status: doc.status,
        tags: doc.tags,
        // Include content based on flag
        text: args.includeContent
          ? doc.extractedText
          : doc.extractedText?.slice(0, 300) + (doc.extractedText && doc.extractedText.length > 300 ? '...' : ''),
        // For system documents, include the structured content
        content: args.includeContent ? doc.content : undefined,
      }));

      return result;
    }

    if (name === 'get_achievements') {
      const { useRowingStore } = await import('@/lib/store');
      const { AWARDS } = await import('@/lib/awards');
      const store = useRowingStore.getState();

      const result: any = {};

      // Personal Records
      if (args.includePersonalRecords !== false) {
        const prs = store.personalRecords;
        result.personalRecords = prs.map(pr => ({
          distance: pr.distance,
          bestTime: pr.bestTime,
          bestPace: this.formatPace(pr.bestPace),
          avgPower: pr.avgPower ? `${pr.avgPower.toFixed(1)}W` : null,
          date: new Date(pr.date).toISOString().split('T')[0]
        }));

        if (prs.length === 0) {
          result.personalRecords = "No personal records yet. The user needs to complete sessions at standard distances (100m, 500m, 1000m, 2000m, 5000m).";
        }
      }

      // Earned Awards
      if (args.includeAwards !== false) {
        const earnedAwards = store.earnedAwards;
        result.earnedAwards = earnedAwards.map(ea => {
          const award = AWARDS.find(a => a.id === ea.awardId);
          return {
            id: ea.awardId,
            title: award?.title || ea.awardId,
            description: award?.description || '',
            earnedAt: new Date(ea.earnedAt).toISOString().split('T')[0]
          };
        });

        result.totalAwardsEarned = earnedAwards.length;
        result.totalAwardsAvailable = AWARDS.length;
      }

      // Next Awards (upcoming achievements user is close to)
      if (args.includeNextAwards === true) {
        const sessions = store.sessions;
        const stats = store.getStats();
        const earnedIds = new Set(store.earnedAwards.map(a => a.awardId));

        const unearnedAwards = AWARDS.filter(a => !earnedIds.has(a.id));

        // Calculate progress for key metrics
        const totalDistance = sessions.reduce((acc, s) => acc + s.distance, 0);
        const totalDuration = sessions.reduce((acc, s) => acc + s.duration, 0);
        const sessionCount = sessions.length;
        const bestStreak = stats.bestStreak;

        result.nextAwards = unearnedAwards.slice(0, 5).map(award => ({
          id: award.id,
          title: award.title,
          description: award.description
        }));

        result.currentProgress = {
          totalSessions: sessionCount,
          totalDistance: `${(totalDistance / 1000).toFixed(1)}km`,
          totalDuration: `${(totalDuration / 3600).toFixed(1)}h`,
          bestStreak: `${bestStreak} days`
        };
      }

      return result;
    }

    return { error: `Unknown tool: ${name}` };
  }


  // Get system prompt for chat AI trainer
  private getChatSystemPrompt(sessions?: Session[]): string {
    return `You are a personal AI rowing coach and trainer. You specialize in indoor rowing performance, technique, and training optimization.

CRITICAL FORMATTING RULES - READ CAREFULLY:

1. STRUCTURE YOUR RESPONSES WITH HEADERS:
Use markdown headers (##, ###) to organize your responses into clear sections. You may use emojis to make the headers more engaging.

2. USE TABLES FOR SESSION DATA:
When the user asks for session data, comparisons, or any tabular information, you MUST format it as a markdown table.

❌ WRONG - DO NOT DO THIS:
• Session 1
  • Date: 2025-11-24
  • Duration: 300 s

✅ CORRECT - ALWAYS DO THIS FOR SESSION DATA:
| Date | Duration | Distance | Pace | Power | Stroke Rate |
|------|----------|----------|------|-------|-------------|
| 2025-11-24 | 300s | 1000m | 1:50 | 102.8W | 25.1 spm |
| 2025-11-22 | 307s | 1000m | 1:53 | 96.4W | 24.2 spm |

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

TOOLS AVAILABLE:
- get_sessions: Use this to retrieve the user's rowing history. You can filter by date or get specific sessions.
  - ALWAYS use this tool if the user asks about their past performance, specific sessions, or progress.
  - When the user asks "how many sessions" or about the total count:
    * Set limit to 999 (to get ALL sessions for accurate counting)
    * Set includeDetails to FALSE
    * Report the ACTUAL count from the returned array length
  - When the user asks for "all sessions" or requests more than 20 sessions:
    * Set limit to 999 (to get all available sessions)
    * Set includeDetails to FALSE (summaries only, no detailed stroke data)
  - When the user asks for a specific number of sessions (20 or fewer):
    * Set limit to the requested number
    * Set includeDetails to FALSE (unless they specifically ask for detailed analysis)
  - Set 'includeDetails' to TRUE ONLY when the user explicitly asks for:
    * Detailed stroke analysis
    * Stroke-by-stroke data
    * Consistency checks
    * Specific workout details or technique analysis
  - Do NOT assume you know the user's data unless you have called this tool.

- get_memory_documents: Access the user's coaching memory containing uploaded documents and system-generated content.
  - MEMORY CONTENTS:
    * User uploads: PDFs (training guides, articles), images (technique screenshots, form photos)
    * Training Plans: Active and archived training plans you've created
    * Insights: AI-generated insights from the dashboard
    * Notes: User-saved notes and reminders
  - WHEN TO USE:
    * User asks about their training plan → type: 'training_plan', activeOnly: true
    * User references an uploaded document → query: [search term]
    * User asks about recent insights/recommendations → type: 'insight'
    * User mentions something they uploaded → source: 'user'
  - PARAMETERS:
    * query: Search by name, description, or extracted text content
    * type: Filter by 'image', 'pdf', 'training_plan', 'insight', or 'note'
    * source: 'user' for uploads, 'system' for generated content
    * activeOnly: true to get only the active training plan
    * includeContent: true to get full text content (use sparingly)

- get_achievements: Retrieve the user's personal records (PRs) and earned awards/achievements.
  - PERSONAL RECORDS:
    * Best times for standard distances: 100m, 500m, 1000m, 2000m, 5000m
    * Includes pace, power, and date achieved
    * Use to celebrate PRs, set goals, and track improvement
  - AWARDS/ACHIEVEMENTS:
    * Gamification milestones the user has unlocked (e.g., "First Splash", "Century Club", "Million Meter Club")
    * Categories: Session counts, duration, streaks, distance, power, speed, improvement
    * Use to celebrate accomplishments and motivate toward next goals
  - WHEN TO USE:
    * User asks about their personal records or best times → includePersonalRecords: true
    * User asks about achievements, awards, or badges → includeAwards: true
    * User wants to know what awards they're close to earning → includeNextAwards: true
    * User asks "what should I work toward?" → includeNextAwards: true
    * When celebrating progress or setting goals
  - PARAMETERS:
    * includePersonalRecords: true to get PR data (default: true)
    * includeAwards: true to get earned awards (default: true)
    * includeNextAwards: true to get upcoming/next awards to earn (default: false)

FORMATTING GUIDELINES:
- ALWAYS use markdown formatting in your responses
- Use ## for main sections and ### for subsections
- When presenting session data, statistics, or comparisons: USE MARKDOWN TABLES (not bullet points!)
- When displaying tables of session data:
  * Show a MAXIMUM of 10 rows by default
  * If you fetched more sessions, mention how many total sessions exist
  * Only show more than 10 rows if the user explicitly requests it
  * Example: "Here are your 10 most recent sessions (you have 45 total):"
- Use proper markdown table syntax with pipes (|) and hyphens (-)
- Use **bold** for emphasis and *italic* for subtle emphasis
- Use bullet points ONLY for recommendations, tips, or non-tabular lists
- Use code blocks for specific numbers or metrics when appropriate

COMMUNICATION STYLE:
- Use conversational, encouraging language
- Provide specific, actionable advice
- Ask about the rower's goals, experience level, and constraints
- Reference their actual data when available to personalize recommendations
- Keep responses focused and practical
- Structure responses with clear headers for easy scanning

Remember: You're building a long-term coaching relationship. Be supportive, knowledgeable, and genuinely helpful in their rowing journey.${this.getUserProfileContext()}`;
  }

  // Get user's session context for personalized coaching
  // Deprecated: Context is now retrieved via tools
  private getSessionContext(sessions: Session[]): string {
    return '';
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
  private anonymizeSessions(sessions: Session[], includeDetails: boolean = false): any[] {
    return sessions.map(session => {
      const baseData = {
        id: session.id, // Include ID for reference
        date: new Date(session.timestamp).toISOString().split('T')[0], // Only date, no time
        distance: session.distance,
        duration: session.duration,
        pace: session.avgSplit,
        power: session.avgPower,
        strokeRate: session.avgStrokeRate,
      };

      if (includeDetails && session.strokeData) {
        return {
          ...baseData,
          strokeData: session.strokeData.map(s => ({
            time: s.time,
            distance: s.distance,
            power: s.power,
            pace: s.split,
            strokeRate: s.strokeRate,
            heartRate: s.heartRate
          }))
        };
      }

      return baseData;
    });
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

      return this.parseInsightResponse(content);
    } catch (error) {
      console.error('Cloud AI analysis failed:', error);
      throw error;
    }
  }

  // Get user's personal context from settings (medical conditions, preferences, etc.)
  private getUserProfileContext(): string {
    const settings = SettingsService.getInstance().getSettings();
    const context = settings.aiSettings.userProfileContext?.trim();
    if (context) {
      return `\n\n${context}\n\nIMPORTANT: Always take the above personal context into account when providing advice. Adjust your recommendations to accommodate any medical conditions, limitations, or preferences mentioned.`;
    }
    return '';
  }

  // Get system prompt for rowing performance analysis
  private getSystemPrompt(): string {
    const userContext = this.getUserProfileContext();
    
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

Focus on practical advice that helps rowers improve performance while avoiding injury and overtraining.${userContext}`;
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
        maxTokens: this.aiSettings.maxTokens
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
    const userContext = this.getUserProfileContext();
    
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

Ensure the plan structure follows proper training principles with appropriate volume and intensity progression.${userContext}`;
  }

  private getPlanModificationSystemPrompt(): string {
    const userContext = this.getUserProfileContext();
    
    return `You are an expert rowing coach helping athletes modify their training plans. 
You understand how to adjust programs while maintaining training integrity and progression.

When modifying plans:
- Preserve the overall training structure and progression
- Make changes that address the specific request
- Maintain appropriate balance between training and recovery
- Explain your reasoning for modifications
- Ensure the plan remains realistic and achievable

Always consider the athlete's current progress and capabilities when suggesting changes.${userContext}`;
  }

  private getAdherenceAnalysisSystemPrompt(): string {
    const userContext = this.getUserProfileContext();
    
    return `You are an expert rowing coach analyzing training plan adherence. 
You provide constructive, encouraging feedback and practical recommendations.

Your analysis should:
- Identify positive patterns and successes
- Address challenges without being critical
- Provide specific, actionable recommendations
- Consider the athlete's overall training load and life factors
- Suggest plan adjustments when adherence issues indicate the plan is too difficult or easy

Maintain a supportive, motivational tone while being honest about adherence patterns.${userContext}`;
  }

  // Helper methods for plan generation
  private parsePlanResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      let extractedJson = jsonMatch[0];

      // Check for common JSON issues (unbalanced braces/brackets)
      if (extractedJson.length > 8500) {
        const openBraces = (extractedJson.match(/\{/g) || []).length;
        const closeBraces = (extractedJson.match(/\}/g) || []).length;
        const openBrackets = (extractedJson.match(/\[/g) || []).length;
        const closeBrackets = (extractedJson.match(/\]/g) || []).length;

        if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
          extractedJson = this.repairIncompleteJSON(extractedJson, openBraces, closeBraces, openBrackets, closeBrackets);
        }
      }

      return JSON.parse(extractedJson);
    } catch (error) {
      console.error('Failed to parse plan response:', error);
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

  // Condense user profile/documents into a system prompt addition
  async condenseUserProfile(rawInput: string): Promise<string> {
    if (!this.config) {
      throw new Error('Cloud AI service not configured');
    }

    if (!rawInput.trim()) {
      return '';
    }

    try {
      const prompt = `You are helping a rowing coach AI understand a user's personal context. The user has provided information about themselves that should influence how the AI coach gives advice.

USER'S INFORMATION:
${rawInput}

YOUR TASK:
Condense this information into a concise, structured system prompt addition (max 300 words) that will help the AI coach personalize its advice. Focus on:

1. **Health/Medical Considerations**: Any conditions, injuries, or limitations that affect training (e.g., heart conditions, joint issues, medications)
2. **Physical Profile**: Age, fitness level, experience, physical constraints
3. **Goals & Preferences**: Training goals, preferred workout types, time availability
4. **Special Needs**: Any accommodations or modifications needed for safe training

FORMAT YOUR RESPONSE AS:
A direct system prompt addition that starts with "PERSONAL CONTEXT:" followed by bullet points. This text will be injected directly into AI prompts, so write it as instructions for an AI, not as a summary for the user.

Example format:
PERSONAL CONTEXT:
- User has [condition], adjust recommendations to [specific guidance]
- Avoid suggesting [specific activities] due to [reason]
- User prefers [preference], incorporate this into plans
- [Any other relevant coaching considerations]

Be specific and actionable. Only include information relevant to rowing training and coaching.`;

      const config: ApiRequestConfig = {
        input: prompt,
        model: 'gpt-5-mini',
        reasoning: 'medium',
        verbosity: 'low',
        maxTokens: 500
      };

      const response = await this.makeApiCall(config);
      const content = this.parseResponse(response);
      
      return content.trim();
    } catch (error) {
      console.error('Failed to condense user profile:', error);
      throw error;
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
