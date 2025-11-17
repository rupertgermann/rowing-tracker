# API Refactor Documentation

## ⚡ CURRENT PLAN: GPT-5.1 Only (Simplified)

**Status:** Ready for implementation  
**Timeline:** 3-5 hours  
**Complexity:** Low  

---

## 🚀 **START HERE: [IMPLEMENTATION_TODO.md](./IMPLEMENTATION_TODO.md)** 

**Complete step-by-step checklist with 60+ actionable tasks organized by phase.**

---

### Active Documents

1. **📘 Main Plan:** [`api-refactor-plan-gpt51-only.md`](./api-refactor-plan-gpt51-only.md)
   - Complete technical specification
   - Request/response formats
   - All use case configurations
   - Implementation checklist

2. **⚡ Quick Guide:** [`SIMPLIFIED_PLAN.md`](./SIMPLIFIED_PLAN.md)
   - Executive summary
   - Before/after comparison
   - 3-5 hour roadmap
   - Testing checklist

---

## Decision: GPT-5.1 Only

**Why:** Massive simplification with zero downsides

### Benefits
- ✅ **72% less code** (~200 lines removed, ~50 added)
- ✅ **65% faster to implement** (3-5h vs 9-13h)
- ✅ **Best performance** (GPT-5.1 is most intelligent)
- ✅ **Latest features** (conversation chaining, instructions, store)
- ✅ **Simpler maintenance** (single API, single format)
- ✅ **Better UX** (no model selection needed)

### What We Removed
- ❌ Chat Completions API support
- ❌ GPT-4/GPT-5 model support
- ❌ Temperature/top_p parameters
- ❌ Model detection logic
- ❌ Dual request builders
- ❌ Dual response parsers
- ❌ Tool format converters (3 → 1)

### What We Kept
- ✅ Single Responses API endpoint
- ✅ GPT-5.1 model (hardcoded)
- ✅ Optimized reasoning per use case
- ✅ Conversation chaining
- ✅ Structured outputs
- ✅ All existing features

---

## Quick Start

### 1. Read the Plan
Start here: [`SIMPLIFIED_PLAN.md`](./SIMPLIFIED_PLAN.md)

### 2. Implementation Phases

**Phase 1: Remove Legacy (1 hour)**
- Delete old model detection code
- Delete Chat Completions builders
- Remove ~200 lines

**Phase 2: Implement Clean API (2 hours)**
- Single interface: `ApiRequestConfig`
- Single builder: `buildRequest()`
- Single parser: `parseResponse()`

**Phase 3: Update Methods (1-2 hours)**
- Chat: `reasoning: "none"` (speed)
- Insights: `reasoning: "medium"` (balanced)
- Plans: `reasoning: "high"` (quality)

**Phase 4: Settings & Test (1 hour)**
- Remove model/temperature UI
- Test all use cases
- Verify conversation chaining

### 3. Create Branch & Start

```bash
git checkout -b refactor/gpt51-only
# Start coding!
```

---

## Use Case Configurations

### 🚀 Chat
```typescript
{
  reasoning: "none",      // Ultra-fast
  verbosity: "medium",
  previousResponseId      // Auto-chaining
}
```

### 📊 Insights
```typescript
{
  reasoning: "medium",    // Balanced
  verbosity: "low",       // Concise
  jsonSchema             // Structured
}
```

### 📋 Training Plans
```typescript
{
  reasoning: "high",      // Best quality
  verbosity: "high",      // Detailed
  jsonSchema             // Structured
}
```

---

## Code Comparison

### Before (Multi-API - 250 lines)
```typescript
// Model detection
const isGPT5 = this.usesResponsesAPI(this.config.model);
const endpoint = isGPT5 ? '/responses' : '/chat/completions';

// Dual builders
const requestBody = isGPT5 
  ? { /* Responses API format */ }
  : { /* Chat Completions format */ };

// Dual parsers
if (isGPT5) {
  // Parse Responses API
} else {
  // Parse Chat Completions
}
```

### After (GPT-5.1 Only - 70 lines)
```typescript
// Single builder
const request = this.buildRequest({
  input: message,
  reasoning: "none",
  verbosity: "medium"
});

// Single endpoint
const response = await fetch('https://api.openai.com/v1/responses', {
  body: JSON.stringify(request)
});

// Single parser
return this.parseResponse(await response.json());
```

**Result: 72% less code!**

---

## Archived Documentation

The following documents were created for the multi-API approach and are now archived:

### 📦 Archived (For Reference Only)

1. **`api-alignment-refactor-plan.md`** (500+ lines)
   - Multi-API approach
   - Support for GPT-4, GPT-5, GPT-5.1
   - Both Responses and Chat Completions APIs
   - **Status:** Superseded by simplified plan

2. **`api-alignment-summary.md`** (300+ lines)
   - Executive summary for multi-API
   - **Status:** Superseded by SIMPLIFIED_PLAN.md

3. **`api-alignment-code-examples.md`** (900+ lines)
   - Code examples for multi-API approach
   - **Status:** Reference only

4. **`api-alignment-plan-updates.md`** (800+ lines)
   - Detailed parameter documentation
   - Still useful for API reference
   - **Status:** Reference for Responses API details

5. **`PLAN_COMPLETE.md`** (400+ lines)
   - Multi-API implementation checklist
   - **Status:** Superseded by simplified plan

**Note:** These documents contain valuable API reference information but the implementation approach has been simplified to GPT-5.1 only.

---

## API Reference

### GPT-5.1 Responses API Endpoint
```
POST https://api.openai.com/v1/responses
```

### Request Format
```typescript
{
  model: "gpt-5.1",
  input: string | Array<Message>,
  instructions?: string,              // System guidance (high priority)
  reasoning: { effort: "none" | "low" | "medium" | "high" },
  text: { 
    verbosity: "low" | "medium" | "high",
    format?: { /* JSON schema */ }    // Structured outputs
  },
  max_output_tokens: number,
  previous_response_id?: string,      // Conversation chaining
  store?: boolean                     // Storage control (default: true)
}
```

### Response Format
```typescript
{
  id: string,
  object: "response",
  model: "gpt-5.1",
  output: Array<{
    type: "message" | "reasoning" | ...,
    content: [{ type: "output_text", text: string }]
  }>,
  output_text: string  // SDK helper
}
```

---

## Key Features

### 1. Conversation Chaining
```typescript
const res1 = await client.responses.create({
  input: "First message",
  store: true
});

const res2 = await client.responses.create({
  input: "Follow-up",
  previous_response_id: res1.id,  // Automatic context!
  store: true
});
```

### 2. Instructions Parameter
```typescript
{
  instructions: "You are a rowing expert.",  // High priority
  input: "Analyze my workout"                // User input
}
```

### 3. Structured Outputs
```typescript
{
  text: {
    format: {
      type: "json_schema",
      name: "insights",
      schema: { /* JSON schema */ }
    }
  }
}
```

### 4. Optimized Reasoning
```typescript
// Chat: Fast
{ reasoning: { effort: "none" } }

// Insights: Balanced
{ reasoning: { effort: "medium" } }

// Plans: Quality
{ reasoning: { effort: "high" } }
```

---

## Implementation Checklist

### Before Starting
- [ ] Review `SIMPLIFIED_PLAN.md`
- [ ] Review `api-refactor-plan-gpt51-only.md`
- [ ] Create branch: `refactor/gpt51-only`
- [ ] Backup current implementation

### Phase 1: Remove Legacy (1 hour)
- [ ] Delete `usesResponsesAPI()` method
- [ ] Delete `buildChatCompletionsRequest()` method
- [ ] Delete `parseChatCompletionsResponse()` method
- [ ] Delete tool converters for Chat Completions
- [ ] Delete temperature/top_p handling
- [ ] Clean up model detection logic

### Phase 2: Implement (2 hours)
- [ ] Create `ApiRequestConfig` interface
- [ ] Implement `buildRequest()` method
- [ ] Implement `parseResponse()` method
- [ ] Implement `makeApiCall()` method

### Phase 3: Update Methods (1-2 hours)
- [ ] `sendChatMessage()` with `reasoning: "none"`
- [ ] `generateInsights()` with `reasoning: "medium"` + JSON
- [ ] `generateTrainingPlan()` with `reasoning: "high"` + JSON
- [ ] `modifyTrainingPlan()` with `reasoning: "medium"` + JSON
- [ ] `analyzePlanAdherence()` with `reasoning: "medium"`

### Phase 4: Settings & UI (1 hour)
- [ ] Remove model selection dropdown
- [ ] Remove temperature slider
- [ ] Update `AISettings` interface
- [ ] Add optional `store` toggle
- [ ] Test settings persistence

### Phase 5: Testing (1 hour)
- [ ] Test chat (single message)
- [ ] Test chat (with chaining)
- [ ] Test insights generation
- [ ] Test training plan generation
- [ ] Test plan modification
- [ ] Test error handling
- [ ] Verify JSON parsing

### After Completion
- [ ] Code review
- [ ] Update inline documentation
- [ ] Create PR
- [ ] Merge to main

---

## Success Criteria

After implementation, verify:

### Functionality ✅
- [ ] Chat works with conversation chaining
- [ ] Insights return structured JSON
- [ ] Training plans return structured JSON
- [ ] Plan modifications work correctly
- [ ] Error handling is robust

### Performance ✅
- [ ] Chat response time < 2s
- [ ] Insights response time < 5s
- [ ] Plans generate successfully

### Code Quality ✅
- [ ] ~200 lines removed
- [ ] ~50 lines added (clean)
- [ ] No model detection logic
- [ ] No API switching logic
- [ ] Single request builder
- [ ] Single response parser

### User Experience ✅
- [ ] No model selection needed
- [ ] No temperature setting needed
- [ ] Faster chat responses
- [ ] Better training plans
- [ ] Consistent performance

---

## Questions?

### Why GPT-5.1 only?
**Answer:** GPT-5.1 is objectively better than all older models. There's no benefit to supporting GPT-4 or GPT-5.

### What about users who want other models?
**Answer:** They don't need other models. GPT-5.1 is faster (with `reasoning: "none"`), more intelligent, and more cost-effective.

### What if OpenAI releases GPT-6?
**Answer:** Easy! Change the hardcoded `"gpt-5.1"` to `"gpt-6"` in one place. Done.

### Can we still use the archived docs?
**Answer:** Yes! They're great for API reference and understanding Responses API features. Just ignore the multi-API implementation approach.

---

## Timeline

| Phase | Time | What You'll Do |
|-------|------|----------------|
| 1. Remove | 1h | Delete ~200 lines of legacy code |
| 2. Implement | 2h | Add ~50 lines of clean code |
| 3. Methods | 1-2h | Update 5 methods with configs |
| 4. Settings | 1h | Simplify UI, remove dropdowns |
| 5. Test | 1h | Verify everything works |
| **Total** | **3-5h** | Clean, simple, modern code |

---

## Next Steps

1. **Read:** [`SIMPLIFIED_PLAN.md`](./SIMPLIFIED_PLAN.md)
2. **Understand:** [`api-refactor-plan-gpt51-only.md`](./api-refactor-plan-gpt51-only.md)
3. **Code:** Create branch and start implementing
4. **Test:** Verify all use cases work
5. **Ship:** Merge and deploy

**Let's build the simple version!** 🚀

---

*Last updated: 2025-11-17*  
*Status: Ready for implementation ✅*
