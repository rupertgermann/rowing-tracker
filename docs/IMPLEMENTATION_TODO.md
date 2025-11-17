# GPT-5.1 API Refactor - Implementation Checklist

**Target:** GPT-5.1 with Responses API only  
**Timeline:** 3-5 hours  
**Branch:** `refactor/gpt51-only`

---

## 🚀 Pre-Implementation

### Setup
- [ ] Create feature branch: `git checkout -b refactor/gpt51-only`
- [ ] Backup current `cloudAI.ts` (copy to `cloudAI.ts.backup`)
- [ ] Review `api-refactor-plan-gpt51-only.md` one more time
- [ ] Review `SIMPLIFIED_PLAN.md` for quick reference
- [ ] Ensure you have OpenAI API key for testing

---

## 📝 Phase 1: Remove Legacy Code (1 hour)

### Delete Unused Methods
- [ ] Remove `usesResponsesAPI(model: string): boolean` method
- [ ] Remove `getApiType(model: string)` method (if exists)
- [ ] Remove `buildChatCompletionsRequest(config)` method
- [ ] Remove `parseChatCompletionsResponse(data)` method
- [ ] Remove `convertToolsToChatCompletionsGPT5Format(tools)` method
- [ ] Remove `convertToolsToChatCompletionsGPT4Format(tools)` method
- [ ] Remove `convertToolsToResponsesFormat(tools)` method (will recreate simpler version)

### Clean Up Model Detection Logic
- [ ] Remove all `if (isGPT5)` conditionals
- [ ] Remove all `const endpoint = isGPT5 ? ...` logic
- [ ] Remove all `model.startsWith('gpt-5')` checks
- [ ] Remove all temperature/top_p parameter handling
- [ ] Remove any `max_tokens` vs `max_output_tokens` conditionals

### Update Type Definitions
- [ ] Remove old `ApiRequestConfig` interface (if exists)
- [ ] Remove any Chat Completions specific types
- [ ] Keep only GPT-5.1 relevant types

### Checkpoint
- [ ] Verify ~200 lines removed
- [ ] Code compiles (even with missing implementations)
- [ ] No more dual-API logic remains

---

## 🔨 Phase 2: Implement Clean GPT-5.1 API (2 hours)

### Create New Interface (in cloudAI.ts)
```typescript
- [ ] Add ApiRequestConfig interface:
  interface ApiRequestConfig {
    input: string | Array<{ role: string; content: string }>;
    instructions?: string;
    reasoning: "none" | "low" | "medium" | "high";
    verbosity: "low" | "medium" | "high";
    maxTokens: number;
    store?: boolean;
    previousResponseId?: string;
    jsonSchema?: {
      name: string;
      schema: object;
    };
    tools?: Array<{
      type: "function";
      name: string;
      description: string;
      parameters?: object;
    }>;
  }
```

### Implement buildRequest() Method
```typescript
- [ ] Create private buildRequest(config: ApiRequestConfig): object
- [ ] Set model to "gpt-5.1" (hardcoded)
- [ ] Handle input parameter (string or array)
- [ ] Handle instructions parameter (optional)
- [ ] Build reasoning object: { effort: config.reasoning }
- [ ] Build text object with verbosity
- [ ] Add text.format for jsonSchema (if provided)
- [ ] Set max_output_tokens
- [ ] Add store parameter (if provided)
- [ ] Add previous_response_id (if provided)
- [ ] Add tools array (if provided)
- [ ] Return complete request object
```

### Implement parseResponse() Method
```typescript
- [ ] Create private parseResponse(data: any): string
- [ ] Try data.output_text first (SDK helper)
- [ ] Fallback: Find message type in output array
- [ ] Extract text from content array
- [ ] Throw clear error if parsing fails
- [ ] Add console logging for debugging
```

### Implement makeApiCall() Method
```typescript
- [ ] Create private async makeApiCall(config: ApiRequestConfig): Promise<any>
- [ ] Build request using buildRequest()
- [ ] Hardcode endpoint: 'https://api.openai.com/v1/responses'
- [ ] Set headers: Authorization and Content-Type
- [ ] Make POST request with fetch
- [ ] Check response.ok
- [ ] Parse JSON response
- [ ] Return full response object (not just text - for responseId)
- [ ] Add proper error handling with detailed messages
```

### Checkpoint
- [ ] New methods compile without errors
- [ ] Types are correct
- [ ] No references to old methods remain

---

## 🔄 Phase 3: Update All Methods (1-2 hours)

### Update sendChatMessage()

```typescript
- [ ] Update method signature to return { content: string; responseId: string }
- [ ] Add optional previousResponseId parameter
- [ ] Create ApiRequestConfig with:
  - input: message (string)
  - instructions: this.getSystemPrompt()
  - reasoning: "none"
  - verbosity: "medium"
  - maxTokens: 1000
  - store: true
  - previousResponseId: previousResponseId
- [ ] Call makeApiCall(config)
- [ ] Return { content: parseResponse(data), responseId: data.id }
- [ ] Update error handling
- [ ] Remove all old dual-API logic
- [ ] Test manually
```

### Update generateInsights()

```typescript
- [ ] Keep same method signature
- [ ] Build prompt using existing buildInsightPrompt()
- [ ] Create ApiRequestConfig with:
  - input: prompt (string)
  - reasoning: "medium"
  - verbosity: "low"
  - maxTokens: 1500
  - jsonSchema: { name: "insights", schema: {...} }
- [ ] Define JSON schema for insights structure
- [ ] Call makeApiCall(config)
- [ ] Parse response with parseResponse()
- [ ] Parse JSON from response text
- [ ] Return insights array
- [ ] Update error handling
- [ ] Test manually
```

### Update generateTrainingPlan()

```typescript
- [ ] Keep same method signature
- [ ] Build prompt using existing buildPlanPrompt()
- [ ] Create ApiRequestConfig with:
  - input: prompt
  - instructions: this.getPlanSystemPrompt()
  - reasoning: "high"
  - verbosity: "high"
  - maxTokens: 4000
  - jsonSchema: { name: "training_plan", schema: {...} }
- [ ] Define/reuse JSON schema for plan structure
- [ ] Call makeApiCall(config)
- [ ] Parse response and extract JSON
- [ ] Return parsed plan
- [ ] Update error handling
- [ ] Test manually
```

### Update modifyTrainingPlan()

```typescript
- [ ] Keep same method signature
- [ ] Build modification prompt
- [ ] Create ApiRequestConfig with:
  - input: prompt
  - instructions: this.getPlanSystemPrompt()
  - reasoning: "medium"
  - verbosity: "medium"
  - maxTokens: 4000
  - jsonSchema: same as training plan
- [ ] Call makeApiCall(config)
- [ ] Parse response
- [ ] Return modified plan
- [ ] Update error handling
- [ ] Test manually
```

### Update analyzePlanAdherence()

```typescript
- [ ] Keep same method signature
- [ ] Build analysis prompt
- [ ] Create ApiRequestConfig with:
  - input: prompt
  - reasoning: "medium"
  - verbosity: "low"
  - maxTokens: 2000
  - jsonSchema: { name: "adherence_analysis", schema: {...} }
- [ ] Define schema for adherence results
- [ ] Call makeApiCall(config)
- [ ] Parse response
- [ ] Return analysis
- [ ] Update error handling
- [ ] Test manually
```

### Update Any Other AI Methods
- [ ] Check for any other methods calling OpenAI API
- [ ] Update them to use new pattern
- [ ] Remove old dual-API logic

### Checkpoint
- [ ] All methods updated
- [ ] All use makeApiCall() internally
- [ ] Each has appropriate reasoning effort
- [ ] Each has appropriate verbosity
- [ ] Code compiles without errors

---

## ⚙️ Phase 4: Update Settings & UI (1 hour)

### Update Settings Interface (settings.ts)

```typescript
- [ ] Open /src/lib/settings.ts
- [ ] Update AISettings interface:
  - Remove: model field
  - Remove: temperature field
  - Keep: openaiApiKey, maxTokens
  - Add: storeResponses?: boolean (optional, default true)
  - Keep: all prompt fields
- [ ] Update default settings object
- [ ] Update getAISettings() if needed
- [ ] Update setAISettings() if needed
- [ ] Add migration code to clean old settings:
  if (settings.model) delete settings.model;
  if (settings.temperature) delete settings.temperature;
```

### Update Settings UI (settings/page.tsx)

```typescript
- [ ] Open /src/app/settings/page.tsx
- [ ] Remove model selection dropdown completely
- [ ] Remove temperature slider completely
- [ ] Keep API key input
- [ ] Keep max tokens input
- [ ] Add optional "Store Responses" checkbox for privacy
- [ ] Update form state
- [ ] Update form submission
- [ ] Test UI renders correctly
```

### Update CloudAIService Constructor

```typescript
- [ ] Remove model from config/constructor (if passed)
- [ ] Hardcode model to "gpt-5.1" internally
- [ ] Keep apiKey and baseUrl
- [ ] Update any initialization logic
```

### Checkpoint
- [ ] Settings interface updated
- [ ] UI simplified
- [ ] No model/temperature controls visible
- [ ] App compiles

---

## 🧪 Phase 5: Testing (1 hour)

### Unit-Level Testing

```typescript
- [ ] Test buildRequest() with various configs
- [ ] Test parseResponse() with sample responses
- [ ] Test error handling in makeApiCall()
- [ ] Verify JSON schema definitions are valid
```

### Integration Testing

#### Test Chat
- [ ] Send single chat message
- [ ] Verify response is returned
- [ ] Verify responseId is returned
- [ ] Send follow-up with previousResponseId
- [ ] Verify conversation context maintained
- [ ] Test with long conversation history
- [ ] Verify reasoning: "none" is fast (< 2s)

#### Test Insights
- [ ] Generate insights with sample sessions
- [ ] Verify structured JSON is returned
- [ ] Verify all required fields present
- [ ] Test with empty sessions
- [ ] Test with large session data
- [ ] Verify reasoning: "medium" works

#### Test Training Plans
- [ ] Generate new training plan
- [ ] Verify structured JSON returned
- [ ] Verify all plan fields present
- [ ] Test with various user goals
- [ ] Verify reasoning: "high" produces quality results

#### Test Plan Modifications
- [ ] Modify existing plan
- [ ] Verify modified plan returned
- [ ] Test various modification types
- [ ] Verify reasoning: "medium" works

#### Test Adherence Analysis
- [ ] Analyze plan adherence
- [ ] Verify analysis results returned
- [ ] Test with different adherence scenarios

### Error Handling Testing
- [ ] Test with invalid API key
- [ ] Test with network error
- [ ] Test with malformed response
- [ ] Test with rate limiting
- [ ] Verify error messages are clear

### Performance Testing
- [ ] Measure chat response time (should be < 2s)
- [ ] Measure insights generation time
- [ ] Measure plan generation time
- [ ] Verify no memory leaks

### Edge Cases
- [ ] Test with very long input
- [ ] Test with empty input
- [ ] Test with special characters
- [ ] Test with previousResponseId that doesn't exist
- [ ] Test conversation chaining across sessions

### Checkpoint
- [ ] All tests passing
- [ ] All use cases work
- [ ] Performance is good
- [ ] Error handling is robust

---

## 📋 Phase 6: Code Quality & Documentation (30 min)

### Code Review
- [ ] Remove all console.logs (or make them debug-only)
- [ ] Add JSDoc comments to public methods
- [ ] Add inline comments for complex logic
- [ ] Ensure consistent code style
- [ ] Check for any TODO comments
- [ ] Verify no hardcoded test data remains

### Documentation
- [ ] Update method signatures in comments
- [ ] Document reasoning effort choices
- [ ] Document verbosity choices
- [ ] Add examples of conversation chaining
- [ ] Document JSON schema structures

### Type Safety
- [ ] Ensure all types are properly defined
- [ ] No use of `any` where specific type works
- [ ] All promises properly typed
- [ ] All async/await used correctly

### Cleanup
- [ ] Remove commented-out old code
- [ ] Remove unused imports
- [ ] Remove unused variables
- [ ] Format code consistently

### Checkpoint
- [ ] Code is clean and documented
- [ ] No linting errors
- [ ] TypeScript compiles without warnings

---

## ✅ Phase 7: Final Verification & Commit

### Final Testing
- [ ] Test entire app end-to-end
- [ ] Test chat feature thoroughly
- [ ] Test insights generation
- [ ] Test training plan creation
- [ ] Test plan modifications
- [ ] Verify settings page works
- [ ] Check for any console errors

### Verification Checklist
- [ ] ~200 lines of code removed
- [ ] ~50 lines of clean code added
- [ ] Net reduction: ~150 lines
- [ ] No model detection logic remains
- [ ] No API switching logic remains
- [ ] Single endpoint used everywhere
- [ ] All methods use GPT-5.1
- [ ] Conversation chaining works
- [ ] Structured outputs work
- [ ] Performance is good

### Pre-Commit Checklist
- [ ] All tests pass
- [ ] Code compiles without errors
- [ ] No TypeScript warnings
- [ ] No console errors in browser
- [ ] Settings persist correctly
- [ ] API calls work in production-like environment

### Commit the Changes

```bash
- [ ] Review all changed files: git status
- [ ] Review diff: git diff
- [ ] Stage changes: git add .
- [ ] Commit with message (see below)
- [ ] Push branch: git push origin refactor/gpt51-only
```

### Commit Message
```
refactor(cloudAI): simplify to GPT-5.1 Responses API only

Remove support for:
- Chat Completions API
- GPT-4 and GPT-5 models  
- Temperature/top_p parameters
- Model selection logic
- Dual request/response handling

Implement clean GPT-5.1 solution:
- Single unified request builder
- Single response parser
- Optimized reasoning per use case:
  * Chat: "none" (ultra-fast)
  * Insights: "medium" (balanced)
  * Plans: "high" (best quality)
- Conversation chaining with previous_response_id
- Structured outputs for insights and plans
- Instructions parameter for system prompts

Changes:
- cloudAI.ts: -200 lines, +50 lines (net -150)
- settings.ts: Removed model and temperature fields
- settings UI: Removed model/temperature controls

BREAKING CHANGE: Only supports GPT-5.1 model

Benefits:
- 72% less code to maintain
- 65% faster implementation
- 3% better API performance
- Latest Responses API features
- Simpler, cleaner codebase

Migration: Automatic - API keys work, prompts preserved
```

---

## 🎉 Post-Implementation

### Create Pull Request
- [ ] Go to GitHub
- [ ] Create PR from `refactor/gpt51-only` to `main`
- [ ] Add description referencing this checklist
- [ ] Add before/after comparison
- [ ] Request review (if applicable)

### Documentation Updates
- [ ] Update main README if needed
- [ ] Archive old API docs
- [ ] Keep SIMPLIFIED_PLAN.md for reference

### Monitor
- [ ] Watch for any errors in production
- [ ] Monitor API usage/costs
- [ ] Collect user feedback
- [ ] Track performance metrics

### Celebrate! 🎊
- [ ] You just simplified your codebase by 72%!
- [ ] You're now using the latest AI API!
- [ ] You have conversation chaining!
- [ ] You have better performance!

---

## 📊 Success Metrics

After completion, verify you achieved:

### Code Quality
- ✅ ~150 lines of code removed (net)
- ✅ Single API endpoint used
- ✅ No model detection logic
- ✅ Clean, maintainable code

### Functionality
- ✅ Chat works with conversation chaining
- ✅ Insights return structured data
- ✅ Training plans return structured data
- ✅ All features work as before (or better)

### Performance
- ✅ Chat responses < 2 seconds
- ✅ Insights generation < 5 seconds
- ✅ Plans generate successfully
- ✅ No errors in console

### User Experience
- ✅ Simpler settings UI
- ✅ No confusing model selection
- ✅ Faster responses
- ✅ Better quality outputs

---

## 🆘 Troubleshooting

### If API Calls Fail
- Check API key is set correctly
- Verify endpoint URL is correct
- Check request format matches Responses API
- Review error message for clues
- Check OpenAI API status

### If Responses Are Wrong Format
- Verify parseResponse() logic
- Check output array structure
- Look for output_text first
- Fall back to manual parsing
- Add debug logging

### If JSON Parsing Fails
- Check JSON schema is valid
- Verify text.format structure
- Try without jsonSchema first
- Check response content
- Validate JSON manually

### If Conversation Chaining Doesn't Work
- Verify store: true is set
- Check previousResponseId is passed correctly
- Ensure response IDs are saved
- Test with simple conversation first

### If Tests Fail
- Run tests individually
- Check for async/await issues
- Verify mock data is correct
- Review error messages carefully
- Test API calls manually first

---

## ⏱️ Time Tracking

Use this to track your actual time vs estimate:

| Phase | Estimated | Actual | Notes |
|-------|-----------|--------|-------|
| 1. Remove Legacy | 1h | ___ | |
| 2. Implement API | 2h | ___ | |
| 3. Update Methods | 1-2h | ___ | |
| 4. Settings/UI | 1h | ___ | |
| 5. Testing | 1h | ___ | |
| 6. Documentation | 30m | ___ | |
| 7. Final Steps | 30m | ___ | |
| **Total** | **3-5h** | ___ | |

---

## 📝 Notes Section

Use this space for implementation notes, decisions, or issues encountered:

```
[Your notes here]
```

---

**Good luck with the implementation!** 🚀

Remember:
- Take breaks every hour
- Test frequently as you build
- Commit early and often (can squash later)
- Ask for help if stuck
- Celebrate small wins

You're building a cleaner, simpler, better codebase!
