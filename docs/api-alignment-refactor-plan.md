# API Alignment Refactor Plan
## Generalizing Responses API and Chat Completions API Logic

### Overview
This plan outlines the refactoring of API request logic in `cloudAI.ts` to properly handle both the Responses API (for GPT-5 models) and Chat Completions API (for GPT-4 and other models) with unified, maintainable code.

---

## 1. Current State Analysis

### API Usage Locations
1. **sendChatMessage** (lines 96-195) - Supports both APIs
2. **generateInsights** (lines 340-426) - Supports both APIs
3. **generateTrainingPlan** (lines 675-724) - Only Chat Completions
4. **modifyTrainingPlan** (lines 726-774) - Only Chat Completions
5. **analyzePlanAdherence** (lines 776-821) - Only Chat Completions

### Current Issues
- **Duplication**: Endpoint selection and request building logic duplicated across methods
- **Inconsistency**: Training plan methods don't support GPT-5 Responses API
- **Maintainability**: Parameter mapping scattered throughout the codebase
- **Response Parsing**: Different extraction logic per API type, duplicated code
- **Tool Definitions**: Different formats between APIs not properly abstracted

---

## 2. API Differences Reference

### Responses API (`/v1/responses`) - GPT-5 Models

#### Request Parameters
```typescript
{
  model: string,                          // "gpt-5", "gpt-5.1", "gpt-5-mini", etc.
  input: string | Array<Message>,         // String OR array of messages
  instructions?: string,                  // System-level guidance (higher priority)
  reasoning: {
    effort: "none" | "minimal" | "low" | "medium" | "high"
  },
  text: {
    verbosity: "low" | "medium" | "high",
    format?: {                            // For structured outputs
      type: "json_schema",
      name: string,
      strict: boolean,
      schema: object
    }
  },
  max_output_tokens: number,
  tools: [                                // Custom tools format
    {
      type: "custom",
      name: string,
      description: string
    }
  ],
  store?: boolean,                        // Default: true
  previous_response_id?: string           // For multi-turn conversations
}
```

#### Response Structure
```typescript
{
  id: string,
  object: "response",
  created: number,
  model: string,
  output_text?: string,                   // Direct text (simple format)
  output?: [                              // Complex format with messages
    {
      type: "message",
      content: [
        {
          type: "output_text",
          text: string
        }
      ]
    }
  ],
  usage: {
    prompt_tokens: number,
    completion_tokens: number,
    total_tokens: number
  }
}
```

### Chat Completions API (`/v1/chat/completions`) - GPT-4 & Others

#### Request Parameters (GPT-4)
```typescript
{
  model: string,
  messages: [                             // Array of message objects
    {
      role: "system" | "user" | "assistant",
      content: string
    }
  ],
  temperature: number,                    // NOT supported for GPT-5
  top_p: number,                         // NOT supported for GPT-5
  max_tokens: number,
  tools: [                                // Function calling format
    {
      type: "function",
      function: {
        name: string,
        description: string,
        parameters: object
      }
    }
  ]
}
```

#### Request Parameters (GPT-5 via Chat Completions)
```typescript
{
  model: string,
  messages: [...],                        // Same as GPT-4
  reasoning_effort: "minimal" | "low" | "medium" | "high",  // Flat parameter
  verbosity: "low" | "medium" | "high",  // Flat parameter
  max_output_tokens: number,             // Different from max_tokens
  tools: [                                // Custom tool format different from Responses API
    {
      type: "custom",
      custom: {                           // Nested "custom" object
        name: string,
        description: string
      }
    }
  ]
}
```

#### Response Structure
```typescript
{
  id: string,
  object: "chat.completion",
  created: number,
  model: string,
  choices: [
    {
      index: number,
      message: {
        role: "assistant",
        content: string
      },
      finish_reason: string
    }
  ],
  usage: {
    prompt_tokens: number,
    completion_tokens: number,
    total_tokens: number
  }
}
```

---

## 3. Refactoring Strategy

### Phase 1: Create API Configuration Module

#### New Interface: `ApiRequestConfig`
```typescript
interface ApiRequestConfig {
  model: string;
  endpoint: '/responses' | '/chat/completions';
  
  // Input formats (one required)
  input?: string | any[];                // String or array of messages for Responses API
  messages?: MessageArray;               // For Chat Completions API
  instructions?: string;                 // System-level guidance (Responses API only, higher priority)
  
  // GPT-5 specific parameters
  reasoning?: 'none' | 'minimal' | 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
  maxTokens?: number;
  
  // GPT-4 specific parameters (ignored for GPT-5)
  temperature?: number;                  // Only for non-GPT-5 in Chat Completions
  
  // Tools
  tools?: any[];
  
  // State management (Responses API)
  store?: boolean;                       // Default: true, set false for ZDR
  previous_response_id?: string;         // For multi-turn conversations
  
  // Structured outputs (Responses API)
  textFormat?: any;                      // For text.format parameter
}
```

#### Model Detection Logic
```typescript
private getApiType(model: string): 'responses' | 'chat-completions' {
  // GPT-5 family: gpt-5, gpt-5.1, gpt-5-mini, gpt-5-nano, gpt-5.1-2025-11-13
  return model.startsWith('gpt-5') ? 'responses' : 'chat-completions';
}
```

#### Reasoning Effort Mapping
```typescript
private getReasoningEffort(model: string): string {
  if (model === 'gpt-5.1' || model.includes('gpt-5.1')) {
    return 'none';  // GPT-5.1 supports "none" for fastest responses
  } else if (model.startsWith('gpt-5')) {
    return 'minimal';  // Other GPT-5 models use "minimal" instead of "none"
  }
  return 'low';  // Fallback (shouldn't be used for non-GPT-5)
}
```

### Phase 2: Unified Request Builder

#### Method: `buildApiRequest()`
This centralizes all parameter mapping logic:

```typescript
private buildApiRequest(config: ApiRequestConfig): object {
  const apiType = this.getApiType(config.model);
  
  if (apiType === 'responses') {
    return this.buildResponsesApiRequest(config);
  } else {
    return this.buildChatCompletionsRequest(config);
  }
}

private buildResponsesApiRequest(config: ApiRequestConfig): object {
  const request: any = {
    model: config.model,
    max_output_tokens: config.maxTokens || this.aiSettings?.maxTokens || 1500
  };
  
  // Input: Can be string or array of messages
  if (config.input) {
    request.input = config.input;
  } else if (config.messages) {
    request.input = config.messages;  // Responses API accepts messages array directly
  }
  
  // Instructions (higher priority than input, Responses API only)
  if (config.instructions) {
    request.instructions = config.instructions;
  }
  
  // Reasoning effort (nested object format)
  if (config.reasoning) {
    request.reasoning = { effort: config.reasoning };
  }
  
  // Verbosity (nested in text object)
  if (config.verbosity) {
    request.text = request.text || {};
    request.text.verbosity = config.verbosity;
  }
  
  // Structured outputs (in text.format)
  if (config.textFormat) {
    request.text = request.text || {};
    request.text.format = config.textFormat;
  }
  
  // Tools
  if (config.tools && config.tools.length > 0) {
    request.tools = this.convertToolsToResponsesFormat(config.tools);
  }
  
  // State management
  if (config.store !== undefined) {
    request.store = config.store;
  }
  
  if (config.previous_response_id) {
    request.previous_response_id = config.previous_response_id;
  }
  
  return request;
}

private buildChatCompletionsRequest(config: ApiRequestConfig): object {
  const isGPT5 = config.model.startsWith('gpt-5');
  
  const request: any = {
    model: config.model,
    messages: config.messages
  };
  
  if (isGPT5) {
    // GPT-5 via Chat Completions API
    if (config.reasoning) {
      request.reasoning_effort = config.reasoning;
    }
    if (config.verbosity) {
      request.verbosity = config.verbosity;
    }
    if (config.maxTokens) {
      request.max_output_tokens = config.maxTokens;
    }
    if (config.tools && config.tools.length > 0) {
      request.tools = this.convertToolsToChatCompletionsGPT5Format(config.tools);
    }
  } else {
    // GPT-4 and other models
    if (config.temperature !== undefined) {
      request.temperature = config.temperature;
    }
    if (config.maxTokens) {
      request.max_tokens = config.maxTokens;
    }
    if (config.tools && config.tools.length > 0) {
      request.tools = this.convertToolsToChatCompletionsGPT4Format(config.tools);
    }
  }
  
  return request;
}
```

### Phase 3: Unified Response Parser

#### Method: `parseApiResponse()`
```typescript
private parseApiResponse(
  data: any, 
  apiType: 'responses' | 'chat-completions'
): string {
  if (apiType === 'responses') {
    return this.parseResponsesApiResponse(data);
  } else {
    return this.parseChatCompletionsResponse(data);
  }
}

private parseResponsesApiResponse(data: any): string {
  // Try simple format first
  if (data.output_text) {
    return data.output_text;
  }
  
  // Try complex format with output array
  if (data.output && Array.isArray(data.output)) {
    const messageOutput = data.output.find(
      (item: any) => item.type === 'message' && item.content
    );
    
    if (messageOutput?.content?.length > 0) {
      const textContent = messageOutput.content.find(
        (c: any) => c.type === 'output_text' && c.text
      );
      return textContent?.text || '';
    }
  }
  
  throw new Error('Unable to extract text from Responses API response');
}

private parseChatCompletionsResponse(data: any): string {
  return data.choices?.[0]?.message?.content || '';
}
```

### Phase 4: Tool Format Conversion

#### Three Different Tool Formats
```typescript
// Internal unified format
interface UnifiedTool {
  name: string;
  description: string;
  type?: 'custom' | 'function';
  parameters?: object;  // For function calling
}

// Responses API format
private convertToolsToResponsesFormat(tools: UnifiedTool[]): any[] {
  return tools.map(tool => ({
    type: 'custom',
    name: tool.name,
    description: tool.description
  }));
}

// Chat Completions API - GPT-5 format
private convertToolsToChatCompletionsGPT5Format(tools: UnifiedTool[]): any[] {
  return tools.map(tool => ({
    type: 'custom',
    custom: {
      name: tool.name,
      description: tool.description
    }
  }));
}

// Chat Completions API - GPT-4 format (function calling)
private convertToolsToChatCompletionsGPT4Format(tools: UnifiedTool[]): any[] {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters || {
        type: 'object',
        properties: {}
      }
    }
  }));
}
```

### Phase 5: Update All API Call Sites

#### 5.1 sendChatMessage() Refactor
```typescript
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
    const apiType = this.getApiType(this.config.model);
    
    const requestConfig: ApiRequestConfig = {
      model: this.config.model,
      messages: messages,
      reasoning: this.getReasoningEffort(this.config.model),
      verbosity: 'medium',
      maxTokens: 1000
    };
    
    const requestBody = this.buildApiRequest(requestConfig);
    const endpoint = apiType === 'responses' ? '/responses' : '/chat/completions';
    
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status}. Details: ${errorText}`);
    }

    const data = await response.json();
    return this.parseApiResponse(data, apiType);
  } catch (error) {
    console.error('Chat AI failed:', error);
    throw error;
  }
}
```

#### 5.2 generateInsights() Refactor
Similar pattern - use `buildApiRequest()` and `parseApiResponse()`

#### 5.3 Training Plan Methods Refactor
Update `generateTrainingPlan()`, `modifyTrainingPlan()`, and `analyzePlanAdherence()` to support both APIs.

---

## 4. Parameter Validation

### Add Model-Specific Validation
```typescript
private validateRequestConfig(config: ApiRequestConfig): void {
  const isGPT5 = config.model.startsWith('gpt-5');
  
  // GPT-5 models don't support temperature, top_p, logprobs
  if (isGPT5 && config.temperature !== undefined) {
    console.warn(
      `temperature parameter not supported for ${config.model}. ` +
      `Use reasoning and verbosity instead.`
    );
    delete config.temperature;
  }
  
  // Validate reasoning effort values
  const validReasoningEfforts = isGPT5 && config.model.includes('5.1')
    ? ['none', 'low', 'medium', 'high']
    : ['minimal', 'low', 'medium', 'high'];
    
  if (config.reasoning && !validReasoningEfforts.includes(config.reasoning)) {
    throw new Error(
      `Invalid reasoning effort "${config.reasoning}" for ${config.model}. ` +
      `Valid values: ${validReasoningEfforts.join(', ')}`
    );
  }
}
```

---

## 5. Implementation Checklist

### Step-by-Step Implementation Order

1. **Add new interfaces and types** ✓
   - [ ] `ApiRequestConfig` interface
   - [ ] `ApiType` type
   - [ ] `UnifiedTool` interface

2. **Implement core helper methods** ✓
   - [ ] `getApiType(model: string)`
   - [ ] `getReasoningEffort(model: string)`
   - [ ] `validateRequestConfig(config: ApiRequestConfig)`

3. **Build request builders** ✓
   - [ ] `buildApiRequest(config: ApiRequestConfig)`
   - [ ] `buildResponsesApiRequest(config: ApiRequestConfig)`
   - [ ] `buildChatCompletionsRequest(config: ApiRequestConfig)`

4. **Build response parsers** ✓
   - [ ] `parseApiResponse(data: any, apiType: ApiType)`
   - [ ] `parseResponsesApiResponse(data: any)`
   - [ ] `parseChatCompletionsResponse(data: any)`

5. **Implement tool converters** ✓
   - [ ] `convertToolsToResponsesFormat(tools: UnifiedTool[])`
   - [ ] `convertToolsToChatCompletionsGPT5Format(tools: UnifiedTool[])`
   - [ ] `convertToolsToChatCompletionsGPT4Format(tools: UnifiedTool[])`

5a. **Add state management support** ✓
   - [ ] Support `store` parameter for response storage control
   - [ ] Support `previous_response_id` for multi-turn conversations
   - [ ] Handle response chaining logic

5b. **Add structured outputs support** ✓
   - [ ] Support `text.format` for Responses API
   - [ ] Support `response_format` for Chat Completions API
   - [ ] Unified interface for JSON schema definitions

5c. **Add instructions parameter support** ✓
   - [ ] Support top-level `instructions` in Responses API
   - [ ] Convert to `developer` role messages when needed
   - [ ] Handle priority between `instructions` and `input`

6. **Refactor existing methods** ✓
   - [ ] `sendChatMessage()` - use unified builders
   - [ ] `generateInsights()` - use unified builders
   - [ ] `generateTrainingPlan()` - add GPT-5 support
   - [ ] `modifyTrainingPlan()` - add GPT-5 support
   - [ ] `analyzePlanAdherence()` - add GPT-5 support

7. **Update helper methods** ✓
   - [ ] Remove duplication from `convertMessagesToInput()`
   - [ ] Ensure all methods use centralized logic

8. **Testing** ✓
   - [ ] Test with GPT-5.1 model (Responses API with "none" reasoning)
   - [ ] Test with GPT-5 model (Responses API with "minimal" reasoning)
   - [ ] Test with GPT-4 model (Chat Completions API with temperature)
   - [ ] Test training plan generation with all model types
   - [ ] Test chat with all model types
   - [ ] Test insights generation with all model types

---

## 6. Benefits of This Approach

### Maintainability
- Single source of truth for API differences
- Easy to add new models or API versions
- Centralized parameter mapping reduces bugs

### Flexibility
- All methods automatically support both APIs
- Easy to switch models without code changes
- Future API changes only require updates in one place

### Correctness
- Proper parameter validation prevents API errors
- Correct tool format for each API type
- Proper reasoning effort for each model variant

### Performance
- No unnecessary conversions
- Optimal parameters for each model type
- Efficient response parsing

---

## 7. Backward Compatibility

### No Breaking Changes
- All existing method signatures remain the same
- Settings integration unchanged
- Existing error handling preserved

### Migration Path
- Existing code continues to work
- New unified logic replaces duplicated code
- Gradual rollout per method possible

---

## 8. Future Enhancements

### Potential Additions
- Streaming support for both APIs
- Tool response handling for multi-turn conversations
- Caching strategies for repeated queries
- Rate limiting and retry logic
- Telemetry and performance monitoring

### API Evolution
- Easy to add GPT-6 when released
- Support for new parameters (e.g., new reasoning levels)
- Adaptation to API changes with minimal code impact

---

## 9. Code Quality Standards

### Follow Best Practices
- Comprehensive error handling
- Detailed logging for debugging
- Type safety with TypeScript
- Clear method naming conventions
- Inline documentation for complex logic

### Testing Strategy
- Unit tests for all converters
- Integration tests for each API type
- Error handling validation
- Edge case coverage

---

## Conclusion

This refactoring creates a robust, maintainable foundation for handling multiple OpenAI API variants. The unified approach eliminates code duplication, ensures correctness, and makes future updates straightforward.
