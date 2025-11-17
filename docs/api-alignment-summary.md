# API Alignment Refactor - Executive Summary

## Problem Statement

The current `cloudAI.ts` implementation has API request logic scattered across multiple methods, with duplicated endpoint selection, parameter building, and response parsing code. This creates maintenance challenges and prevents some methods (training plan generation) from supporting GPT-5 Responses API.

## Solution Overview

Create a unified, generalized API abstraction layer that:
1. **Centralizes** endpoint selection and API type detection
2. **Unifies** request building for both Responses and Chat Completions APIs
3. **Standardizes** response parsing across different API formats
4. **Supports** all model types (GPT-5.1, GPT-5, GPT-4, etc.) with correct parameters
5. **Leverages** new Responses API features: `instructions`, `previous_response_id`, `store`, and flexible `input`
6. **Optimizes** reasoning effort and verbosity per use case for best performance

## Key Technical Decisions

### 1. API Detection Strategy
**Decision**: Use model name prefix matching (`model.startsWith('gpt-5')`)

**Rationale**:
- Simple, fast, and reliable
- Covers all GPT-5 variants: `gpt-5`, `gpt-5.1`, `gpt-5-mini`, `gpt-5-nano`, `gpt-5.1-2025-11-13`
- Easy to extend for future models

**Trade-offs**:
- Requires naming convention adherence
- Alternative (API discovery) would add network overhead

### 2. Reasoning Effort Mapping
**Decision**: Model-specific reasoning effort defaults

```typescript
gpt-5.1 → "none"     // Fastest, new in 5.1
gpt-5   → "minimal"  // Default for earlier GPT-5
gpt-4   → N/A        // Uses temperature instead
```

**Rationale**:
- GPT-5.1 introduced "none" for ultra-low latency
- Earlier GPT-5 models don't support "none", use "minimal"
- Documentation explicitly specifies these differences

**Trade-offs**:
- Requires model version detection
- Must be updated if OpenAI changes defaults

### 3. Tool Format Abstraction
**Decision**: Three-tier approach with internal unified format

**Tool Formats**:
1. **Responses API**: `{ type: "custom", name, description }`
2. **Chat Completions (GPT-5)**: `{ type: "custom", custom: { name, description } }`
3. **Chat Completions (GPT-4)**: `{ type: "function", function: { name, description, parameters } }`

**Rationale**:
- Single internal format simplifies calling code
- Converters handle API-specific transformations
- Isolates API differences from business logic

**Trade-offs**:
- Additional conversion step
- More complex for advanced tool features
- Better abstraction vs. minor performance cost

### 4. Response Parsing Strategy
**Decision**: Two-phase parsing with fallback mechanisms

**Approach**:
```typescript
Responses API:
  1. Try data.output_text (simple format)
  2. Try data.output[].content[] (complex format)
  3. Throw error if neither works

Chat Completions API:
  1. Extract data.choices[0].message.content
  2. Throw error if not present
```

**Rationale**:
- Handles both documented response formats
- Graceful degradation with clear error messages
- Future-proof for API evolution

**Trade-offs**:
- Slightly more complex than single path
- Better reliability vs. code simplicity

### 5. Parameter Validation
**Decision**: Proactive validation with warnings for unsupported parameters

**Example**:
- GPT-5 + `temperature` → Warning + parameter removed
- Invalid reasoning effort → Immediate error

**Rationale**:
- Prevents cryptic API errors
- Educates developers about constraints
- Fails fast for invalid configurations

**Trade-offs**:
- Additional code complexity
- Better developer experience vs. code size

### New Features Enabled

1. **Conversation Chaining** - Use `previous_response_id` for cleaner multi-turn chats
2. **Optimized Reasoning** - Different reasoning levels per use case:
   - Chat: `low` (speed priority)
   - Insights: `medium` (balanced)
   - Training plans: `high` (quality priority)
3. **Privacy Control** - `store: false` for ZDR compliance
4. **Cleaner System Prompts** - Use `instructions` instead of system messages
5. **Structured Outputs** - Native JSON schema support via `text.format`

## Impact Analysis

### Code Quality Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| API call sites with duplicated logic | 5 | 0 | 100% |
| Lines of endpoint selection code | ~50 | ~15 | 70% reduction |
| Methods supporting both APIs | 2/5 | 5/5 | 100% coverage |
| Parameter validation points | 0 | 1 (centralized) | ∞ improvement |

### Maintainability Benefits

1. **Single Source of Truth**
   - All API differences in one module
   - Changes propagate automatically
   - No scattered updates needed

2. **Extensibility**
   - New models: Update detection logic only
   - New parameters: Add to `ApiRequestConfig` once
   - New endpoints: Extend builders only

3. **Testing**
   - Test API logic independently
   - Mock builders for unit tests
   - Integration tests per API type

### Risk Mitigation

**Low Risk Areas**:
- Pure refactoring, no logic changes
- Existing method signatures unchanged
- Backward compatible

**Mitigation Strategies**:
- Comprehensive testing before rollout
- Gradual method-by-method migration possible
- Detailed logging for debugging

## Implementation Priorities

### Phase 1: Foundation (Critical)
1. Add new interfaces and type definitions
   - Add `instructions`, `store`, `previous_response_id` to config
   - Add `jsonSchema` for unified structured outputs
   - Support string OR array for `input`
2. Implement core helper methods
   - Model detection and reasoning effort mapping
   - Role conversion (`system` → `developer`)
3. Build request builders and parsers
   - Support all new Responses API parameters
   - Handle structured outputs for both APIs

**Timeline**: 3-4 hours (expanded scope)
**Risk**: Low

### Phase 2: Refactoring (High Priority)
1. Update `sendChatMessage()` with conversation chaining
   - Support `previous_response_id` parameter
   - Use `instructions` for system prompts
   - Optimize reasoning effort for chat (low/none)
2. Update `generateInsights()` with structured outputs
   - Use `text.format` for JSON schema
   - Set medium reasoning effort
3. Update training plan methods
   - Set high reasoning effort for generation
   - Set medium for modifications
   - Use structured outputs for JSON parsing
4. Remove duplicated code

**Timeline**: 3-5 hours (expanded scope)
**Risk**: Medium (requires thorough testing)

### Phase 3: Enhancement (Medium Priority)
1. Add comprehensive error messages
2. Implement detailed logging
3. Add parameter validation

**Timeline**: 1-2 hours
**Risk**: Low

### Phase 4: Testing & Documentation (Required)
1. Test all model types
2. Update inline documentation
3. Create developer guide

**Timeline**: 2-3 hours
**Risk**: Low

## Success Criteria

### Functional Requirements
- ✓ All methods support both Responses and Chat Completions APIs
- ✓ Correct parameters for each model type
- ✓ Proper response parsing for all API formats
- ✓ Tool definitions work with all APIs

### Non-Functional Requirements
- ✓ No breaking changes to existing code
- ✓ Clear error messages for invalid configurations
- ✓ Improved code maintainability metrics
- ✓ Comprehensive test coverage

### Performance Requirements
- ✓ No additional network overhead
- ✓ Minimal conversion overhead
- ✓ Efficient response parsing

## Key Architectural Patterns

### 1. Builder Pattern
Used for request construction with method chaining

### 2. Strategy Pattern
Different parsing strategies for different API types

### 3. Factory Pattern
API request creation based on model type

### 4. Facade Pattern
Unified interface hiding API complexity

## Critical API Differences Reference

### New Parameters Added (Based on Official Docs)

**Responses API Exclusive Parameters:**
- `instructions` - System-level guidance (higher priority than input)
- `store` - Control response storage (default: true)
- `previous_response_id` - Chain responses for multi-turn conversations
- `text.format` - Structured outputs (JSON schema)
- Input flexibility - Can be string OR array of messages

**Role Differences:**
- Responses API: `developer` role (higher priority)
- Chat Completions: `system` role

### Parameter Naming Differences

| Concept | Responses API | Chat Completions (GPT-5) | Chat Completions (GPT-4) |
|---------|---------------|--------------------------|--------------------------|
| Input | `input` (string OR array) | `messages` (array) | `messages` (array) |
| Instructions | `instructions` (top-level) | N/A | N/A |
| Reasoning | `reasoning: { effort: "..." }` | `reasoning_effort: "..."` | N/A (use `temperature`) |
| Verbosity | `text: { verbosity: "..." }` | `verbosity: "..."` | N/A |
| Max tokens | `max_output_tokens` | `max_output_tokens` | `max_tokens` |
| Tools | `{ type: "custom", name, description }` | `{ type: "custom", custom: {...} }` | `{ type: "function", function: {...} }` |

### Response Structure Differences

| Field | Responses API | Chat Completions API |
|-------|---------------|---------------------|
| Content | `output_text` or `output[].content[]` | `choices[0].message.content` |
| Object type | `"response"` | `"chat.completion"` |
| Top-level text | ✓ Supported | ✗ Not supported |

### Unsupported Parameters

**GPT-5 Models (both APIs)**:
- ✗ `temperature`
- ✗ `top_p`
- ✗ `logprobs`

**Responses API**:
- ✗ `messages` (use `input` instead)
- ✗ `temperature`
- ✗ `max_tokens` (use `max_output_tokens`)

## Documentation References

- **Responses API**: `/docs/using_gpt-5.1.md`
- **OpenAI Platform Docs**: Retrieved via Context7 MCP server
- **Current Implementation**: `/src/lib/cloudAI.ts` lines 96-821

## Commit Message Template

```
refactor(cloudAI): generalize API switching between Responses and Chat Completions

- Create unified request builder for both API types
- Centralize endpoint selection and parameter mapping
- Add proper GPT-5 support to all API methods
- Implement model-specific parameter validation
- Standardize response parsing across APIs
- Support tool definitions for all API formats

Breaking Changes: None
Fixes: Training plan generation now supports GPT-5 models

Closes: #[issue-number]
```

## Next Steps

1. Review and approve this plan
2. Begin Phase 1 implementation
3. Create feature branch: `refactor/api-alignment`
4. Implement with comprehensive tests
5. Code review before merge
6. Monitor in production for any issues

---

**Plan Created**: 2025-11-17
**Author**: Cascade AI Assistant
**Status**: Ready for Implementation
