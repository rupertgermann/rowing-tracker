# API Alignment Plan - Updates from Official OpenAI Documentation

**Date:** 2025-11-17  
**Based on:** Official OpenAI Responses API and Migration documentation

---

## Critical New Findings

After reviewing the official OpenAI documentation (`openAI_Text_generation.md`, `openAI_migrate_to_responses_api.md`, `openAI_using_gpt-5.1.md`), several important parameters and patterns were discovered that must be incorporated into our implementation.

---

## 1. New Parameters to Support

### 1.1 `instructions` Parameter (Responses API Only)

**What it is:**
- Top-level parameter that provides system-level guidance
- **Higher priority than `input` parameter**
- Only applies to the current request (not persisted with `previous_response_id`)

**Usage:**
```typescript
// Instead of system message in input
{
  model: "gpt-5",
  instructions: "You are a rowing training expert.",
  input: "Analyze my recent workout"
}

// Equivalent to developer role message
{
  model: "gpt-5",
  input: [
    { role: "developer", content: "You are a rowing training expert." },
    { role: "user", content: "Analyze my recent workout" }
  ]
}
```

**Impact on our app:**
- We can simplify code by using `instructions` for system prompts
- Better separation of system behavior vs user input
- **Important:** Instructions are NOT carried forward with `previous_response_id`

**Implementation:**
```typescript
const requestConfig: ApiRequestConfig = {
  model: this.config.model,
  instructions: this.getSystemPrompt(),  // Our existing system prompt
  input: userMessage,                     // User's actual message
  reasoning: this.getReasoningEffort(this.config.model),
  verbosity: 'medium'
};
```

---

### 1.2 `store` Parameter (Responses API)

**What it is:**
- Controls whether responses are stored by OpenAI
- **Default: `true`** (responses are stored)
- Set to `false` for Zero Data Retention (ZDR) requirements

**Usage:**
```typescript
{
  model: "gpt-5",
  input: "Hello",
  store: false  // Don't persist this response
}
```

**Impact on our app:**
- Default behavior (store: true) is fine for most users
- May want to expose as privacy setting for users
- For ZDR orgs, combine with `include: ["reasoning.encrypted_content"]`

**Implementation considerations:**
- Add optional `store` setting to AI settings
- Default to `true` (OpenAI's default)
- Allow users to opt-out for privacy

---

### 1.3 `previous_response_id` Parameter (Responses API)

**What it is:**
- References a previous response to build conversation chains
- Automatically includes previous reasoning items and context
- Alternative to manually managing conversation state

**Usage:**
```typescript
// First request
const res1 = await client.responses.create({
  model: "gpt-5",
  input: "What is the capital of France?",
  store: true  // Must store to reference later
});

// Second request - automatically includes res1's context
const res2 = await client.responses.create({
  model: "gpt-5",
  input: "And its population?",
  previous_response_id: res1.id,  // Links to previous response
  store: true
});
```

**Alternative - Manual context management:**
```typescript
// Append output to input
const context = [
  { role: "user", content: "What is the capital of France?" }
];

const res1 = await client.responses.create({
  model: "gpt-5",
  input: context
});

// Add output to context
context.push(...res1.output);
context.push({ role: "user", content: "And its population?" });

const res2 = await client.responses.create({
  model: "gpt-5",
  input: context
});
```

**Impact on our app:**
- Our chat feature can use `previous_response_id` for cleaner code
- Requires `store: true` (default)
- Simplifies multi-turn conversation management
- **Key benefit:** Preserves reasoning items between turns automatically

**Implementation strategy:**
```typescript
// In sendChatMessage()
if (previousResponseId) {
  requestConfig.previous_response_id = previousResponseId;
  requestConfig.store = true;  // Required for chaining
} else {
  // First message or no chaining
  requestConfig.input = this.buildChatMessages(message, conversationHistory);
}
```

---

### 1.4 Message Roles: `developer` vs `system`

**What it is:**
- Responses API uses `developer` role (not `system`)
- `developer` messages have higher priority than `user` messages
- Chat Completions uses `system` role

**Comparison:**

| API | High Priority | User Input | Model Output |
|-----|---------------|------------|--------------|
| Responses | `developer` | `user` | `assistant` |
| Chat Completions | `system` | `user` | `assistant` |

**Usage:**
```typescript
// Responses API
{
  input: [
    { role: "developer", content: "You are a helpful assistant." },
    { role: "user", content: "Hello!" },
    { role: "assistant", content: "Hi there!" },
    { role: "user", content: "How are you?" }
  ]
}

// Chat Completions API
{
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello!" },
    { role: "assistant", content: "Hi there!" },
    { role: "user", content: "How are you?" }
  ]
}
```

**Impact on our app:**
- Need to convert `system` → `developer` when using Responses API
- Or use `instructions` parameter instead (simpler)

**Implementation:**
```typescript
// Option 1: Use instructions (recommended)
{
  instructions: systemPrompt,
  input: userMessages  // No need for developer role
}

// Option 2: Convert roles
private convertMessagesToResponsesAPI(messages: any[]): any[] {
  return messages.map(msg => ({
    ...msg,
    role: msg.role === 'system' ? 'developer' : msg.role
  }));
}
```

---

### 1.5 Structured Outputs: `text.format` vs `response_format`

**What it is:**
- Different parameter locations for JSON schema between APIs
- Responses API: `text.format`
- Chat Completions: `response_format`

**Responses API:**
```typescript
{
  model: "gpt-5",
  input: "Jane, 54 years old",
  text: {
    verbosity: "low",
    format: {
      type: "json_schema",
      name: "person",
      strict: true,
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" }
        },
        required: ["name", "age"]
      }
    }
  }
}
```

**Chat Completions API:**
```typescript
{
  model: "gpt-5",
  messages: [{ role: "user", content: "Jane, 54 years old" }],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "person",
      strict: true,
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" }
        },
        required: ["name", "age"]
      }
    }
  }
}
```

**Impact on our app:**
- We use structured outputs for insights, training plans
- Need to handle both formats in builder
- Schema definition is the same, just different nesting

**Implementation:**
```typescript
// Unified config
interface ApiRequestConfig {
  jsonSchema?: {
    name: string;
    strict?: boolean;
    schema: object;
  };
}

// In Responses API builder
if (config.jsonSchema) {
  request.text = request.text || {};
  request.text.format = {
    type: "json_schema",
    ...config.jsonSchema
  };
}

// In Chat Completions builder
if (config.jsonSchema) {
  request.response_format = {
    type: "json_schema",
    json_schema: config.jsonSchema
  };
}
```

---

### 1.6 Input Flexibility in Responses API

**What it is:**
- `input` can be a **string** OR **array of messages**
- More flexible than Chat Completions (always array)

**Usage:**
```typescript
// String input (simple)
{
  model: "gpt-5",
  input: "Write a haiku about code"
}

// Array input (conversation)
{
  model: "gpt-5",
  input: [
    { role: "developer", content: "You are a poet." },
    { role: "user", content: "Write a haiku about code" }
  ]
}
```

**Impact on our app:**
- Simpler single-turn requests can use string
- Multi-turn conversations use array
- No need to convert strings to message arrays unnecessarily

**Implementation:**
```typescript
// For simple prompts
const config: ApiRequestConfig = {
  model: this.config.model,
  input: prompt,  // String is fine!
  reasoning: { effort: 'medium' }
};

// For conversations
const config: ApiRequestConfig = {
  model: this.config.model,
  input: conversationHistory,  // Array of messages
  reasoning: { effort: 'low' }
};
```

---

### 1.7 Tool Definition Differences

**Critical difference:**
- Responses API: **Internally-tagged**, strict by default
- Chat Completions: **Externally-tagged**, non-strict by default

**Responses API (Internally-tagged):**
```typescript
{
  type: "function",
  name: "get_weather",           // name is sibling of type
  description: "Get weather",
  parameters: {
    type: "object",
    properties: { location: { type: "string" } }
  }
  // strict: true by default
}
```

**Chat Completions API (Externally-tagged):**
```typescript
{
  type: "function",
  function: {                     // function is nested
    name: "get_weather",
    description: "Get weather",
    strict: true,                 // must specify if wanted
    parameters: {
      type: "object",
      properties: { location: { type: "string" } }
    }
  }
}
```

**Custom Tools in Responses API:**
```typescript
{
  type: "custom",
  name: "code_exec",
  description: "Execute Python code"
}
```

**Custom Tools in Chat Completions (GPT-5):**
```typescript
{
  type: "custom",
  custom: {                       // nested custom object
    name: "code_exec",
    description: "Execute Python code"
  }
}
```

**Impact on our app:**
- Must handle both formats in tool converters
- Responses API tools are stricter by default (better!)
- Custom tools format differs significantly

---

## 2. Response Structure Differences

### 2.1 Output Array Structure

**Responses API returns `output` array:**
```json
{
  "id": "resp_123",
  "object": "response",
  "output": [
    {
      "id": "rs_456",
      "type": "reasoning",
      "content": [],
      "summary": []
    },
    {
      "id": "msg_789",
      "type": "message",
      "status": "completed",
      "content": [
        {
          "type": "output_text",
          "text": "The answer is...",
          "annotations": []
        }
      ],
      "role": "assistant"
    }
  ]
}
```

**Key points:**
- `output` is an array of items
- Items can be: `reasoning`, `message`, `function_call`, `function_call_output`, etc.
- Cannot assume text is at `output[0].content[0].text`
- SDK provides `output_text` helper that aggregates all text

**Impact on our app:**
- Use `response.output_text` helper when available
- Fall back to manual parsing for complex cases
- Be aware that `output` may contain multiple items

---

### 2.2 Convenience Helper: `output_text`

**What it is:**
- SDK helper that aggregates all text from `output` array
- Simplifies common case of extracting response text
- Not available in raw HTTP responses

**Usage:**
```typescript
// With SDK
const response = await client.responses.create({
  model: "gpt-5",
  input: "Hello"
});

console.log(response.output_text);  // "Hi there! How can I help?"

// Without SDK (manual parsing needed)
const text = response.output
  .filter(item => item.type === 'message')
  .flatMap(item => item.content)
  .filter(c => c.type === 'output_text')
  .map(c => c.text)
  .join('\n');
```

**Impact on our app:**
- Our current code already tries to use this pattern
- Should verify we're using SDK's `output_text` when available
- Keep fallback parsing for HTTP responses

---

## 3. Model-Specific Behavior

### 3.1 GPT-5.1 vs GPT-5 Reasoning Effort

**Critical difference:**

| Model | Lowest Setting | Default | Highest Setting |
|-------|----------------|---------|-----------------|
| GPT-5.1 | `"none"` | `"none"` | `"high"` |
| GPT-5 | `"minimal"` | `"medium"` | `"high"` |
| o3 | `"low"` | N/A | `"high"` |

**Why it matters:**
- GPT-5.1 has new ultra-fast `"none"` setting
- GPT-5 doesn't support `"none"`, uses `"minimal"` instead
- Using wrong setting will cause API errors

**Current implementation is correct:**
```typescript
private getReasoningEffort(model: string): string {
  if (model === 'gpt-5.1' || model.includes('gpt-5.1')) {
    return 'none';  // ✓ Correct for GPT-5.1
  } else if (model.startsWith('gpt-5')) {
    return 'minimal';  // ✓ Correct for other GPT-5
  }
  return 'low';
}
```

**Recommendation:**
- Keep current logic
- Document why different defaults exist
- Consider making configurable per use case

---

### 3.2 Use Case Recommendations

**From OpenAI docs:**

| Use Case | Model | Reasoning | Verbosity |
|----------|-------|-----------|-----------|
| Fast chat | GPT-5.1 | `none` or `low` | `medium` |
| Insights generation | GPT-5 | `medium` | `low` |
| Training plan generation | GPT-5.1 | `high` | `high` |
| Plan modification | GPT-5 | `medium` | `medium` |
| Quick analysis | GPT-5-mini | `low` | `low` |

**Impact on our app:**
- Different methods should use different reasoning levels
- Chat: `low` reasoning (speed matters)
- Insights: `medium` reasoning (balance)
- Training plans: `high` reasoning (accuracy critical)

**Proposed updates:**
```typescript
// sendChatMessage() - prioritize speed
reasoning: this.getChatReasoningEffort(),  // Returns 'none' or 'low'
verbosity: 'medium'

// generateInsights() - balanced
reasoning: 'medium',
verbosity: 'low'

// generateTrainingPlan() - prioritize quality
reasoning: 'high',
verbosity: 'high'

// modifyTrainingPlan() - balanced
reasoning: 'medium',
verbosity: 'medium'
```

---

## 4. Updated Implementation Checklist

### Phase 1: Core Infrastructure ✓

- [ ] Add `instructions` parameter to `ApiRequestConfig`
- [ ] Add `store` parameter to `ApiRequestConfig`
- [ ] Add `previous_response_id` parameter to `ApiRequestConfig`
- [ ] Add `jsonSchema` parameter for unified structured outputs
- [ ] Update `buildResponsesApiRequest()` to handle all new parameters
- [ ] Update `buildChatCompletionsRequest()` to handle structured outputs

### Phase 2: Message Role Handling ✓

- [ ] Support `developer` role in Responses API
- [ ] Convert `system` → `developer` when needed
- [ ] Prefer `instructions` parameter over `developer` role messages
- [ ] Handle role conversion in `convertMessagesToInput()` if needed

### Phase 3: State Management ✓

- [ ] Implement `previous_response_id` support in chat methods
- [ ] Add `store` parameter to settings (optional privacy feature)
- [ ] Support manual context management (append `output` to `input`)
- [ ] Document both approaches (chaining vs manual)

### Phase 4: Tool Definitions ✓

- [ ] Update `convertToolsToResponsesFormat()` for internally-tagged format
- [ ] Update `convertToolsToChatCompletionsGPT5Format()` for custom tools
- [ ] Update `convertToolsToChatCompletionsGPT4Format()` for function calling
- [ ] Handle `strict: true` default in Responses API

### Phase 5: Structured Outputs ✓

- [ ] Support `text.format` in Responses API builder
- [ ] Support `response_format` in Chat Completions builder
- [ ] Unified `jsonSchema` config parameter
- [ ] Test with existing insight/plan parsing

### Phase 6: Use Case Optimization ✓

- [ ] Set appropriate reasoning effort per method:
  - Chat: `low` (speed)
  - Insights: `medium` (balance)
  - Training plans: `high` (quality)
- [ ] Set appropriate verbosity per method
- [ ] Document reasoning behind choices

### Phase 7: Response Parsing ✓

- [ ] Verify `output_text` helper usage
- [ ] Update fallback parsing for `output` array
- [ ] Handle multiple output items (reasoning + message)
- [ ] Test with actual API responses

---

## 5. Code Changes Required

### 5.1 New Type Definitions

```typescript
/**
 * Unified API request configuration
 * Supports both Responses API and Chat Completions API
 */
interface ApiRequestConfig {
  model: string;
  
  // Input (flexible in Responses API)
  input?: string | any[];           // String or messages array (Responses)
  messages?: any[];                  // Messages array (Chat Completions)
  instructions?: string;             // System-level guidance (Responses only)
  
  // Reasoning and output control
  reasoning?: 'none' | 'minimal' | 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
  maxTokens?: number;
  
  // GPT-4 specific (ignored for GPT-5)
  temperature?: number;
  
  // Tools
  tools?: UnifiedTool[];
  
  // State management (Responses API)
  store?: boolean;
  previous_response_id?: string;
  
  // Structured outputs
  jsonSchema?: {
    name: string;
    strict?: boolean;
    schema: object;
  };
}
```

### 5.2 Updated Request Builder

```typescript
private buildResponsesApiRequest(config: ApiRequestConfig): object {
  const request: any = {
    model: config.model,
    max_output_tokens: config.maxTokens || 1500
  };
  
  // Input: string or array (flexible!)
  if (config.input !== undefined) {
    request.input = config.input;
  } else if (config.messages) {
    // Convert system role to developer role
    request.input = config.messages.map(msg => ({
      ...msg,
      role: msg.role === 'system' ? 'developer' : msg.role
    }));
  }
  
  // Instructions (higher priority, simpler than developer role)
  if (config.instructions) {
    request.instructions = config.instructions;
  }
  
  // Reasoning effort
  if (config.reasoning) {
    request.reasoning = { effort: config.reasoning };
  }
  
  // Verbosity and structured outputs
  if (config.verbosity || config.jsonSchema) {
    request.text = {};
    
    if (config.verbosity) {
      request.text.verbosity = config.verbosity;
    }
    
    if (config.jsonSchema) {
      request.text.format = {
        type: "json_schema",
        name: config.jsonSchema.name,
        strict: config.jsonSchema.strict ?? true,  // Default true
        schema: config.jsonSchema.schema
      };
    }
  }
  
  // Tools
  if (config.tools?.length) {
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
```

### 5.3 Updated Chat Method with `previous_response_id`

```typescript
async sendChatMessage(
  message: string,
  conversationHistory: ChatMessage[] = [],
  previousResponseId?: string  // NEW: Optional response ID for chaining
): Promise<string> {
  if (!this.config) {
    throw new Error('Cloud AI service not configured');
  }

  try {
    const apiType = this.getApiType(this.config.model);
    
    const requestConfig: ApiRequestConfig = {
      model: this.config.model,
      reasoning: this.getChatReasoningEffort(),  // Use chat-specific reasoning
      verbosity: 'medium',
      maxTokens: 1000
    };
    
    // Use previous_response_id for chaining OR build context manually
    if (previousResponseId && apiType === 'responses') {
      requestConfig.previous_response_id = previousResponseId;
      requestConfig.input = message;  // Simple string input
      requestConfig.store = true;     // Required for chaining
    } else {
      // Build full context
      const messages = this.buildChatMessages(message, conversationHistory);
      if (apiType === 'responses') {
        requestConfig.instructions = this.getSystemPrompt();
        requestConfig.input = messages.filter(m => m.role !== 'system');
      } else {
        requestConfig.messages = messages;
      }
    }
    
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
      throw new Error(`OpenAI API error: ${response.status}. ${errorText}`);
    }

    const data = await response.json();
    return this.parseApiResponse(data, apiType);
  } catch (error) {
    console.error('Chat AI failed:', error);
    throw error;
  }
}

/**
 * Get reasoning effort optimized for chat
 */
private getChatReasoningEffort(): string {
  const model = this.config.model;
  
  // Chat prioritizes speed
  if (model === 'gpt-5.1' || model.includes('gpt-5.1')) {
    return 'none';   // Ultra-fast for GPT-5.1
  } else if (model.startsWith('gpt-5')) {
    return 'low';    // Fast for other GPT-5
  }
  
  return 'low';
}
```

---

## 6. Testing Strategy

### 6.1 Test All New Parameters

- [ ] Test `instructions` parameter (Responses API)
- [ ] Test `store: true` and `store: false`
- [ ] Test `previous_response_id` chaining
- [ ] Test `text.format` structured outputs
- [ ] Test `developer` role messages
- [ ] Test string vs array `input`

### 6.2 Test All Model Variants

- [ ] GPT-5.1 with `reasoning: { effort: "none" }`
- [ ] GPT-5 with `reasoning: { effort: "minimal" }`
- [ ] GPT-5-mini with various reasoning levels
- [ ] GPT-4 with temperature (not reasoning)

### 6.3 Test All Use Cases

- [ ] Chat with response chaining
- [ ] Insights generation with structured outputs
- [ ] Training plan generation with high reasoning
- [ ] Plan modification with medium reasoning
- [ ] Adherence analysis

---

## 7. Documentation Updates Needed

### 7.1 Inline Code Documentation

- Document why different reasoning efforts for different methods
- Document `instructions` vs `input` usage
- Document `previous_response_id` for stateful conversations
- Document tool format differences

### 7.2 User-Facing Documentation

- Explain privacy implications of `store` parameter
- Document best practices for each use case
- Explain model selection guidance

---

## Summary of Required Changes

### High Priority (Core Functionality)

1. ✅ Add `instructions` parameter support
2. ✅ Add `previous_response_id` for conversation chaining
3. ✅ Add `text.format` for structured outputs
4. ✅ Convert `system` → `developer` role
5. ✅ Support string OR array for `input`

### Medium Priority (Optimization)

6. ✅ Add use-case-specific reasoning effort
7. ✅ Add `store` parameter support
8. ✅ Update tool converters for all formats
9. ✅ Optimize verbosity per use case

### Low Priority (Enhancement)

10. ✅ Add settings UI for `store` parameter
11. ✅ Expose conversation chaining in chat UI
12. ✅ Add telemetry for reasoning tokens usage

---

**End of Update Document**
