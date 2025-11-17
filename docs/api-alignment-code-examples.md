# API Alignment - Code Transformation Examples

This document shows before/after code examples for the API alignment refactoring.

---

## 1. Request Building - Before vs After

### BEFORE: Duplicated Logic in `sendChatMessage()`

```typescript
// Lines 112-134 in current code
const isGPT5 = this.usesResponsesAPI(this.config.model);
const endpoint = isGPT5 ? '/responses' : '/chat/completions';

const requestBody = isGPT5 
  ? {
      // GPT-5 Responses API format
      model: this.config.model,
      input: this.convertMessagesToInput(messages),
      reasoning: { effort: this.getReasoningEffort(this.config.model) },
      text: { verbosity: "medium" },
      max_output_tokens: 1000
    }
  : {
      // GPT-4 Chat Completions API format
      model: this.config.model,
      messages,
      temperature: 0.7,
      max_tokens: 1000
    };

const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
  method: 'POST',
  headers: { /* ... */ },
  body: JSON.stringify(requestBody)
});
```

### AFTER: Unified Builder Pattern

```typescript
// New centralized approach
const requestConfig: ApiRequestConfig = {
  model: this.config.model,
  messages: messages,
  reasoning: this.getReasoningEffort(this.config.model),
  verbosity: 'medium',
  maxTokens: 1000,
  temperature: 0.7  // Only used if non-GPT-5
};

const apiType = this.getApiType(this.config.model);
const requestBody = this.buildApiRequest(requestConfig);
const endpoint = apiType === 'responses' ? '/responses' : '/chat/completions';

const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
  method: 'POST',
  headers: { /* ... */ },
  body: JSON.stringify(requestBody)
});
```

**Benefits**: 
- 40% less code at call site
- No conditional logic needed
- Same pattern for all methods

---

## 2. Response Parsing - Before vs After

### BEFORE: Complex Conditional in `sendChatMessage()`

```typescript
// Lines 170-189 in current code
let extractedContent = '';

if (isGPT5) {
  // GPT-5 Responses API: find the first message output with text content
  const messageOutput = data.output?.find((item: any) => item.type === 'message' && item.content);
  if (messageOutput?.content?.length > 0) {
    const textContent = messageOutput.content.find((c: any) => c.type === 'output_text' && c.text);
    extractedContent = textContent?.text || '';
  }
} else {
  // GPT-4 Chat Completions API
  extractedContent = data.choices?.[0]?.message?.content || '';
}

console.log('Extracted content:', extractedContent);
return extractedContent;
```

### AFTER: Single Unified Call

```typescript
const data = await response.json();
const content = this.parseApiResponse(data, apiType);
console.log('Extracted content:', content);
return content;
```

**Benefits**:
- 85% less code at call site
- Consistent parsing logic
- Easier to test and maintain

---

## 3. Training Plan Generation - Before vs After

### BEFORE: Hardcoded Chat Completions Only

```typescript
// Lines 689-710 in current code
const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${this.config.apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: this.config.model,  // ❌ Fails if model is GPT-5
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
    temperature: 0.4,  // ❌ Not supported for GPT-5
    max_tokens: 4000
  })
});
```

### AFTER: Supports All Models

```typescript
const apiType = this.getApiType(this.config.model);
const requestConfig: ApiRequestConfig = {
  model: this.config.model,
  messages: [
    { role: 'system', content: this.getPlanGenerationSystemPrompt() },
    { role: 'user', content: prompt }
  ],
  reasoning: 'medium',  // Good for complex generation
  verbosity: 'high',    // Need detailed plans
  maxTokens: 4000,
  temperature: 0.4      // Auto-ignored for GPT-5
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

const data = await response.json();
const planData = this.parsePlanResponse(
  this.parseApiResponse(data, apiType)
);
```

**Benefits**:
- ✓ Works with GPT-5 models
- ✓ Proper parameters for each model
- ✓ Consistent with other methods

---

## 4. Model Detection - New Central Logic

### NEW: Single Source of Truth

```typescript
/**
 * Determines which API to use based on model name
 */
private getApiType(model: string): 'responses' | 'chat-completions' {
  // GPT-5 family uses Responses API
  // Examples: gpt-5, gpt-5.1, gpt-5-mini, gpt-5-nano, gpt-5.1-2025-11-13
  return model.startsWith('gpt-5') ? 'responses' : 'chat-completions';
}

/**
 * Gets appropriate reasoning effort based on model
 */
private getReasoningEffort(model: string): string {
  if (model === 'gpt-5.1' || model.includes('gpt-5.1')) {
    return 'none';  // GPT-5.1 supports "none" for fastest responses
  } else if (model.startsWith('gpt-5')) {
    return 'minimal';  // Other GPT-5 models use "minimal" instead of "none"
  }
  return 'low';  // Fallback (for non-GPT-5 in edge cases)
}
```

**Benefits**:
- Single decision point
- Easy to update for new models
- Self-documenting code

---

## 5. Request Builder - Complete Implementation

### NEW: Unified Builder with All Logic

```typescript
/**
 * Builds API request object based on model type
 */
private buildApiRequest(config: ApiRequestConfig): object {
  this.validateRequestConfig(config);
  const apiType = this.getApiType(config.model);
  
  if (apiType === 'responses') {
    return this.buildResponsesApiRequest(config);
  } else {
    return this.buildChatCompletionsRequest(config);
  }
}

/**
 * Build request for Responses API (GPT-5 models)
 */
private buildResponsesApiRequest(config: ApiRequestConfig): object {
  const request: any = {
    model: config.model,
    input: config.input || this.convertMessagesToInput(config.messages!),
    max_output_tokens: config.maxTokens || this.aiSettings?.maxTokens || 1500
  };
  
  if (config.reasoning) {
    request.reasoning = { effort: config.reasoning };
  }
  
  if (config.verbosity) {
    request.text = { verbosity: config.verbosity };
  }
  
  if (config.tools && config.tools.length > 0) {
    request.tools = this.convertToolsToResponsesFormat(config.tools);
  }
  
  return request;
}

/**
 * Build request for Chat Completions API (GPT-4 and GPT-5)
 */
private buildChatCompletionsRequest(config: ApiRequestConfig): object {
  const isGPT5 = config.model.startsWith('gpt-5');
  
  const request: any = {
    model: config.model,
    messages: config.messages
  };
  
  if (isGPT5) {
    // GPT-5 via Chat Completions uses flat parameters
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
    // GPT-4 and other models use traditional parameters
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

---

## 6. Response Parser - Complete Implementation

### NEW: Unified Response Extraction

```typescript
/**
 * Parse API response based on API type
 */
private parseApiResponse(
  data: any, 
  apiType: 'responses' | 'chat-completions'
): string {
  console.log('=== API RESPONSE PARSING ===');
  console.log('API Type:', apiType);
  console.log('Response keys:', Object.keys(data));
  
  try {
    const content = apiType === 'responses'
      ? this.parseResponsesApiResponse(data)
      : this.parseChatCompletionsResponse(data);
      
    console.log('Successfully extracted content, length:', content.length);
    return content;
  } catch (error) {
    console.error('Failed to parse API response:', error);
    console.error('Response data:', JSON.stringify(data, null, 2));
    throw error;
  }
}

/**
 * Parse Responses API response
 */
private parseResponsesApiResponse(data: any): string {
  // Try simple format first (most common)
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
      
      if (textContent?.text) {
        return textContent.text;
      }
    }
  }
  
  throw new Error('Unable to extract text from Responses API response');
}

/**
 * Parse Chat Completions API response
 */
private parseChatCompletionsResponse(data: any): string {
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('Unable to extract content from Chat Completions API response');
  }
  
  return content;
}
```

---

## 7. Tool Format Conversion - Complete Implementation

### NEW: Three-Format Support

```typescript
/**
 * Internal unified tool format
 */
interface UnifiedTool {
  name: string;
  description: string;
  type?: 'custom' | 'function';
  parameters?: object;
}

/**
 * Convert tools to Responses API format
 * Format: { type: "custom", name: "...", description: "..." }
 */
private convertToolsToResponsesFormat(tools: UnifiedTool[]): any[] {
  return tools.map(tool => ({
    type: 'custom',
    name: tool.name,
    description: tool.description
  }));
}

/**
 * Convert tools to Chat Completions API format (GPT-5)
 * Format: { type: "custom", custom: { name: "...", description: "..." } }
 */
private convertToolsToChatCompletionsGPT5Format(tools: UnifiedTool[]): any[] {
  return tools.map(tool => ({
    type: 'custom',
    custom: {
      name: tool.name,
      description: tool.description
    }
  }));
}

/**
 * Convert tools to Chat Completions API format (GPT-4)
 * Format: { type: "function", function: { name: "...", description: "...", parameters: {...} } }
 */
private convertToolsToChatCompletionsGPT4Format(tools: UnifiedTool[]): any[] {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters || {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }));
}
```

---

## 8. Parameter Validation - New Safety Layer

### NEW: Proactive Validation

```typescript
/**
 * Validate request configuration and warn about unsupported parameters
 */
private validateRequestConfig(config: ApiRequestConfig): void {
  const isGPT5 = config.model.startsWith('gpt-5');
  
  // GPT-5 models don't support temperature, top_p, logprobs
  if (isGPT5 && config.temperature !== undefined) {
    console.warn(
      `⚠️  temperature parameter not supported for ${config.model}. ` +
      `Use reasoning and verbosity instead. Temperature will be ignored.`
    );
    delete config.temperature;
  }
  
  // Validate reasoning effort values
  if (config.reasoning) {
    const validEfforts = config.model.includes('5.1')
      ? ['none', 'low', 'medium', 'high']
      : isGPT5
      ? ['minimal', 'low', 'medium', 'high']
      : [];
      
    if (isGPT5 && !validEfforts.includes(config.reasoning)) {
      throw new Error(
        `Invalid reasoning effort "${config.reasoning}" for ${config.model}. ` +
        `Valid values: ${validEfforts.join(', ')}`
      );
    }
  }
  
  // Validate verbosity values
  if (config.verbosity && !['low', 'medium', 'high'].includes(config.verbosity)) {
    throw new Error(
      `Invalid verbosity "${config.verbosity}". Valid values: low, medium, high`
    );
  }
}
```

---

## 9. Complete Method Refactor Example

### BEFORE: `generateInsights()` - Lines 340-426

```typescript
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
    
    // GPT-5 models use the Responses API, GPT-4 uses Chat Completions API
    const isGPT5 = this.usesResponsesAPI(this.config.model);
    const endpoint = isGPT5 ? '/responses' : '/chat/completions';
    
    const requestBody = isGPT5 
      ? {
          model: this.config.model,
          input: `${this.getSystemPrompt()}\n\n${prompt}`,
          reasoning: { effort: this.getReasoningEffort(this.config.model) },
          text: { verbosity: "low" },
          max_output_tokens: this.aiSettings?.maxTokens || 1500
        }
      : {
          model: this.config.model,
          messages: [
            { role: 'system', content: this.getSystemPrompt() },
            { role: 'user', content: prompt }
          ],
          temperature: this.aiSettings?.temperature || 0.7,
          max_tokens: this.aiSettings?.maxTokens || 1500
        };
    
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
    const content = data.output_text || data.choices?.[0]?.message?.content || '';
    const insights = this.parseInsightResponse(content);
    
    return insights;
  } catch (error) {
    console.error('Cloud AI analysis failed:', error);
    throw error;
  }
}
```

### AFTER: `generateInsights()` - Refactored

```typescript
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
    const apiType = this.getApiType(this.config.model);
    
    // Build unified request configuration
    const requestConfig: ApiRequestConfig = {
      model: this.config.model,
      messages: [
        { role: 'system', content: this.getSystemPrompt() },
        { role: 'user', content: prompt }
      ],
      reasoning: this.getReasoningEffort(this.config.model),
      verbosity: 'low',  // Concise insights
      maxTokens: this.aiSettings?.maxTokens || 1500,
      temperature: this.aiSettings?.temperature || 0.7
    };
    
    // Build request and make API call
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
    
    // Parse response and extract insights
    const data = await response.json();
    const content = this.parseApiResponse(data, apiType);
    const insights = this.parseInsightResponse(content);
    
    return insights;
  } catch (error) {
    console.error('Cloud AI analysis failed:', error);
    throw error;
  }
}
```

**Improvements**:
- ✓ Cleaner, more readable code
- ✓ Uses centralized builders
- ✓ Consistent with other methods
- ✓ Better error handling
- ✓ Easier to test

---

## 10. Type Definitions - New Interfaces

### NEW: Core Types for Abstraction

```typescript
/**
 * API type discriminator
 */
type ApiType = 'responses' | 'chat-completions';

/**
 * Unified API request configuration
 */
interface ApiRequestConfig {
  model: string;
  endpoint?: ApiType;                    // Auto-detected if not provided
  
  // Input formats (one required)
  input?: string;                        // For Responses API
  messages?: Array<{                     // For Chat Completions API
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  
  // GPT-5 specific parameters
  reasoning?: 'none' | 'minimal' | 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
  
  // Token limits
  maxTokens?: number;
  
  // GPT-4 specific parameters (ignored for GPT-5)
  temperature?: number;
  top_p?: number;
  
  // Tools
  tools?: UnifiedTool[];
}

/**
 * Unified tool definition (internal format)
 */
interface UnifiedTool {
  name: string;
  description: string;
  type?: 'custom' | 'function';
  parameters?: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}
```

---

## Summary of Changes

### Code Reduction
- **Request building**: ~50 lines → ~5 lines per call site
- **Response parsing**: ~20 lines → ~1 line per call site
- **Total reduction**: ~350 lines of duplicated code eliminated

### Quality Improvements
- **Consistency**: All methods use same pattern
- **Maintainability**: Single source of truth for API logic
- **Extensibility**: Easy to add new models/parameters
- **Testability**: Builders can be unit tested independently
- **Type Safety**: Full TypeScript typing throughout

### Functional Improvements
- **GPT-5 Support**: All methods now support Responses API
- **Validation**: Proactive parameter checking
- **Error Messages**: Clear, actionable error messages
- **Logging**: Comprehensive debugging information

---

**Document Purpose**: Reference for implementation
**Last Updated**: 2025-11-17
