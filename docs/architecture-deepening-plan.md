# Architecture Deepening Implementation Plan

This plan turns the architecture review findings into implementation slices. The goal is to increase **Depth**: more rowing tracker behaviour behind smaller, clearer **Interfaces**, with better **Locality**, higher **Leverage**, and tests that exercise each **Module** through its real **Seam**.

## Success Criteria

- Rowing import, rowing session analytics, awards, AI insight generation, chat, memory ingestion, and model settings each have a clear owning **Module**.
- Callers no longer need to know multi-step ordering across persistence, cache invalidation, store updates, memory publishing, and provider calls.
- Tests use the **Interface** as the test surface instead of reaching through hooks, pages, routes, and storage helpers in sequence.
- The deletion test improves for each deepened **Module**: deleting the **Module** would make complexity reappear across multiple callers, rather than simply removing pass-through code.
- New **Seams** only stay public when there are at least two real **Adapters** or a caller-facing variation already exists.

## Working Rules

- Keep changes surgical. Deepen one **Module** at a time.
- Preserve shipped behaviour unless a slice explicitly changes it.
- Add regression tests before moving orchestration when existing behaviour is unclear.
- Avoid creating speculative **Seams**. One **Adapter** is hypothetical; two **Adapters** make the **Seam** real.
- Do not rename domain concepts until they are added to `CONTEXT.md` through a design conversation.

## Phase 1: Rowing Data Core

Start here because rowing sessions are the shared input for analytics, awards, AI insight, chat context, and training plans.

### 1. Deepen The Rowing Import Module

**Files**

- `src/app/sync/page.tsx`
- `src/lib/csvParser.ts`
- `src/lib/zipParser.ts`
- `src/lib/strokeParser.ts`
- `src/lib/dataSync.ts`
- `src/lib/store.ts`

**Problem**

The rowing import workflow is mostly implemented inside `sync/page.tsx`. That **Module** knows file validation, CSV parsing, ZIP parsing, SmartRow sync result handling, duplicate detection, chunked persistence, progress state, and store reconciliation. The current **Interface** is **Shallow** because the caller must know almost the same ordering as the **Implementation**.

**Implementation Plan**

1. Add regression coverage for manual CSV import, manual ZIP import, and SmartRow sync result import at the current behaviour level.
2. Move import orchestration out of `sync/page.tsx` into a rowing import **Module** that owns validation, parsing, duplicate handling, persistence, and result aggregation.
3. Keep progress reporting as a caller-observable concern, but make storage and store reconciliation internal to the rowing import **Implementation**.
4. Remove caller knowledge of `skipDbSave` from the page after the rowing import **Module** owns persistence ordering.
5. Keep SmartRow website automation separate from rowing import. The SmartRow **Adapter** should produce import material or an import result, while import rules remain local to the rowing import **Module**.

**Benefits**

**Locality** improves because import rules live in one place. **Leverage** improves because manual CSV, ZIP, and SmartRow sync share one import path. Tests improve because they can assert rowing import outcomes instead of mocking page state, progress callbacks, storage calls, and store flags in exact order.

### 2. Deepen SmartRow Parsing

**Files**

- `src/lib/csvParser.ts`
- `src/lib/strokeParser.ts`
- `src/lib/zipParser.ts`
- `src/types/session.ts`

**Problem**

SmartRow number parsing, delimiter detection, column names, timestamp assumptions, stroke data assumptions, and workout identity rules are spread across multiple parsing **Modules**. The deletion test shows duplicated helpers and duplicated SmartRow knowledge.

**Implementation Plan**

1. Add parser fixtures for European numbers, delimiter variants, summary rows, stroke rows, missing columns, and ZIP filename matching.
2. Consolidate shared SmartRow format rules into one parsing area while preserving separate summary and stroke **Implementations** where useful.
3. Make ZIP processing depend on SmartRow workout identity rules instead of reimplementing matching assumptions.
4. Keep raw SmartRow format concerns out of pages and storage code.

**Benefits**

**Locality** improves because SmartRow format changes are handled in one parsing area. **Leverage** improves because manual upload, ZIP import, and SmartRow sync reuse the same rules. Tests improve because parsing invariants are covered once through the parsing **Interface**.

### 3. Deepen Rowing Session Storage

**Files**

- `src/lib/store.ts`
- `src/lib/dataSync.ts`
- `src/lib/services/sessionsCache.ts`
- `src/lib/services/analyticsCache.ts`
- `src/app/api/sessions/route.ts`
- `src/app/api/sessions/list/route.ts`

**Problem**

Persistence, cache invalidation, local store mutation, revision behaviour, personal record updates, and award recomputation are coordinated across several **Modules**. The storage **Seam** leaks through `dataSync.ts`, cache helpers, route files, and store methods.

**Implementation Plan**

1. Add regression tests for add, update, delete, chunked save, cache invalidation, and revision freshness.
2. Move session persistence policy and cache invalidation into a rowing session storage **Module**.
3. Keep local state mutation in the store, but stop requiring callers to coordinate persistence details and cache details.
4. Separate storage effects from award and analytics recomputation where possible, then reconnect them through higher-level rowing session operations.
5. Retire direct page calls to lower-level storage helpers after the rowing import **Module** uses the storage **Module**.

**Benefits**

**Locality** improves because storage rules and cache rules live together. **Leverage** improves because import, edit, delete, migration, and sync reuse storage behaviour. Tests improve because storage effects are asserted through one **Interface** instead of a sequence of cache, route, and store calls.

## Phase 2: Rowing Intelligence

This phase concentrates calculations that currently leak into analytics, awards, predictions, and AI insight prompts.

### 4. Deepen Rowing Session Analytics

**Files**

- `src/lib/store.ts`
- `src/lib/awardPredictions.ts`
- `src/app/api/analytics/route.ts`
- `src/hooks/useAnalyticsData.ts`
- `src/hooks/useLazyAnalytics.ts`
- `src/lib/analysisUtils.ts`

**Problem**

Rowing session totals, averages, streaks, personal records, chart data, and summaries are calculated in competing **Implementations**. This is **Shallow** because callers must know which calculation path they are using and tests must duplicate fixtures across hooks, route files, and pages.

**Implementation Plan**

1. Add golden tests for totals, averages, current streak, best streak, personal records, and representative chart data.
2. Choose one primary rowing session analytics **Implementation** for session-level metrics.
3. Move duplicated session-level math behind the analytics **Module**.
4. Keep stroke-level analytics as a related but separate **Implementation** if that preserves **Locality**.
5. Update dashboard, analytics pages, awards, predictions, and AI insight prompts to use the same analytics **Module**.

**Benefits**

**Locality** improves because one fix to streak math applies everywhere. **Leverage** improves because dashboard, analytics, awards, predictions, AI insight, and explanation flows share one rowing session view. Tests improve because metric rules are tested once through the analytics **Interface**.

### 5. Deepen The Awards Module

**Files**

- `src/lib/awards.ts`
- `src/lib/store.ts`
- `src/lib/awardPredictions.ts`
- `src/lib/achievementStore.ts`
- `src/app/api/awards/route.ts`
- `src/app/api/generated-achievements/route.ts`
- `src/app/api/achievements/suggestions/route.ts`

**Problem**

Static awards, AI award suggestions, earned award detection, predictions, generated achievement artifacts, and notification side effects are split across several **Modules**. The store owns too much award **Implementation**, so rowing session import and persistence must know award side effects.

**Implementation Plan**

1. Add tests for static award earning, AI award criteria, first-earned dates, predictions, and generated achievement persistence.
2. Move earned award calculation and AI award criteria evaluation out of the store into an awards **Module**.
3. Make award prediction use the same award and rowing session analytics rules.
4. Bring generated achievement artifacts closer to award state so generated stories and images are not a disconnected path.
5. Update store and route files to call higher-level award operations instead of duplicating award rules.

**Benefits**

**Locality** improves because award criteria, streak fixes, and AI award rules live together. **Leverage** improves because awards list, suggestions, predictions, notifications, and generated stories reuse the same award understanding. Tests improve because award behaviour can be tested from rowing sessions without initializing unrelated store state.

### 6. Deepen AI Insight Generation

**Files**

- `src/hooks/useAIInsights.ts`
- `src/lib/aiAnalysis.ts`
- `src/lib/cloudAI.ts`
- `src/lib/dataSync.ts`
- `src/lib/memoryStorage.ts`
- `src/app/api/insights/route.ts`

**Problem**

`useAIInsights.ts` owns revision freshness, DB-first loading, local/cloud choice, archive state, memory publishing, deletion, and React timing guards. The AI insight lifecycle is hidden in a hook-shaped **Module**, which makes the **Interface** a poor test surface.

**Implementation Plan**

1. Add regression tests for DB-first load, freshness decisions, force refresh, archive behaviour, deletion, local fallback, cloud generation, and memory publishing.
2. Move insight lifecycle rules into an AI insight generation **Module**.
3. Keep React state in the hook, but make the hook call intent-level insight operations rather than coordinating revision and persistence details.
4. Make memory publishing part of the insight generation **Implementation** so chat access to insight history is not an incidental hook side effect.
5. Use the rowing session analytics **Module** for derived training context before generating insights.

**Benefits**

**Locality** improves because insight lifecycle rules stop being spread across hook, analysis, storage, and memory **Modules**. **Leverage** improves because dashboard, archive views, chat, and settings reuse the same insight behaviour. Tests improve because insight outcomes can be asserted without knowing hook effect ordering or revision fetch timing.

## Phase 3: AI Interaction Core

This phase deepens chat, explanation handoff, memory ingestion, and model settings after rowing session analytics is stable.

### 7. Deepen The Chat Module

**Files**

- `src/hooks/useChat.ts`
- `src/lib/chatStorage.ts`
- `src/app/api/chat/route.ts`
- `src/lib/cloudAI.ts`
- `src/app/chat/page.tsx`

**Problem**

Chat session mutation, message persistence, streaming replacement, title naming, and conversation continuity are split across hook, storage helper, route file, and provider code. The `responseId` **Seam** leaks because generation returns it, the hook searches for it, but persistence does not make continuity an obvious invariant.

**Implementation Plan**

1. Add tests for session creation, message append, streaming replacement, assistant persistence, title naming, deletion cleanup, search, and conversation continuity.
2. Move chat workflow rules into a chat **Module** that owns session mutation, message persistence, streaming replacement, title naming, and continuity tracking.
3. Keep page and hook code focused on user intent and display state.
4. Make explanation, plan analysis, and AI insight discussion reuse chat operations instead of duplicating setup order.
5. Keep provider-specific streaming and response IDs inside an Adapter-facing area of the chat **Implementation**.

**Benefits**

**Locality** improves because chat behaviour is concentrated. **Leverage** improves because explanation, training plan analysis, and AI insight discussion can reuse the same chat flow. Tests improve because “message sent and saved” becomes testable through one **Interface** rather than many ordered fetches.

### 8. Deepen Explanation Handoff

**Files**

- `src/components/ExplainChartButton.tsx`
- `src/components/ExplainInsightButton.tsx`
- `src/app/plans/page.tsx`
- `src/app/chat/page.tsx`
- `src/lib/store.ts`
- `src/lib/chatStorage.ts`

**Problem**

Chart explanation, training plan analysis, and AI insight discussion each build prompts and handoff state separately. The handoff depends on pending store fields, URL flags, and chat page effects. This **Module** is **Shallow** because the real behaviour lives outside the initiating caller.

**Implementation Plan**

1. Add tests for starting chart, plan, and AI insight discussions from their current entry points.
2. Move prompt construction, session creation, saved explanation lookup, and handoff state into an explanation handoff **Module**.
3. Remove duplicated pending-data effects from `app/chat/page.tsx` once callers can start discussions through the same path.
4. Keep each button or page action as a thin caller.
5. Reuse the chat **Module** for session creation and message persistence.

**Benefits**

**Locality** improves because explanation prompts and handoff rules live together. **Leverage** improves because new explanation entry points can reuse the same flow. Tests improve because they no longer need to coordinate router flags, pending store state, chat session creation, and assistant-message detection.

### 9. Deepen Memory Ingestion

**Files**

- `src/hooks/useMemory.ts`
- `src/lib/memoryStorage.ts`
- `src/lib/documentProcessor.ts`
- `src/app/chat/page.tsx`
- `src/lib/cloudAI.ts`
- `src/app/api/memory/route.ts`
- `src/app/api/memory/upload/route.ts`
- `src/app/api/memory/file/route.ts`

**Problem**

Upload, extraction, storage, metadata, search shape, attachment conversion, and chat retrieval are split across many **Modules**. `documentProcessor.ts` directly calls the provider with hardcoded model settings, so provider details and model settings leak into memory ingestion.

**Implementation Plan**

1. Add tests for PDF ingestion, image ingestion, extracted text, metadata, search, binary retrieval, and chat-ready retrieval.
2. Move document processing, extracted text, binary storage, metadata, and search shape into a memory ingestion **Module**.
3. Put provider-specific extraction behind an Adapter used by memory ingestion.
4. Make chat context retrieval consume memory through the memory ingestion **Interface** rather than re-filtering memory records.
5. Use model settings and prompt resolution for extraction tasks instead of hardcoded provider requests.

**Benefits**

**Locality** improves because document rules live with memory ingestion. **Leverage** improves because uploaded PDFs, images, notes, training plans, and AI insight memory share one path. Tests improve because “document is usable by chat” can be tested without asserting upload/update/fetch ordering.

### 10. Deepen Model Settings And Prompt Resolution

**Files**

- `src/lib/settings.ts`
- `src/lib/aiConfig.ts`
- `src/lib/aiModelOptions.ts`
- `src/lib/aiPromptDefaults.ts`
- `src/app/settings/page.tsx`
- `src/lib/cloudAI.ts`
- `src/lib/documentProcessor.ts`
- `src/app/api/achievements/suggestions/route.ts`
- `src/app/api/achievements/story/route.ts`
- `src/app/api/achievements/image/route.ts`
- `src/lib/validations/settings.ts`

**Problem**

Defaults, validation, UI options, persisted settings, runtime model selection, and prompt strings are spread across several **Modules**. The deletion test shows some Modules only affect settings display, while runtime behaviour still exists elsewhere.

**Implementation Plan**

1. Add tests for default settings, stored overrides, validation, per-task model resolution, and prompt resolution.
2. Deepen model settings and prompt resolution around defaults, stored overrides, validation, and runtime selection for each AI task.
3. Update chat, AI insight, training plan, achievement, explanation, and memory ingestion paths to ask for resolved settings instead of reading scattered fields.
4. Move hardcoded provider prompts toward task-specific prompt resolution.
5. Keep UI option lists as callers of the same settings vocabulary rather than a parallel source of truth.

**Benefits**

**Locality** improves because model and prompt changes are contained. **Leverage** improves because every AI task shares the same settings rules. Tests improve because resolved settings can be tested once instead of separately through UI options, validation, storage, and provider payloads.

### 11. Deepen Provider Adapter And Response Parsing

**Files**

- `src/lib/cloudAI.ts`
- `src/lib/documentProcessor.ts`
- `src/app/api/achievements/suggestions/route.ts`
- `src/app/api/achievements/story/route.ts`
- `src/app/api/achievements/image/route.ts`

**Problem**

Provider request building and response parsing are repeated. Streaming parsing, text parsing, JSON parsing, tool loops, incomplete response handling, retries, and token limits are handled differently by each path. The provider **Adapter** is **Shallow** because provider quirks leak into domain **Modules**.

**Implementation Plan**

1. Add tests for text output, structured output, streaming output, incomplete responses, failed provider calls, and image/text extraction outputs.
2. Move provider request sending, streaming, incomplete-response handling, text extraction, and structured-output parsing into one provider **Adapter**.
3. Keep domain **Modules** responsible for prompt intent and result meaning.
4. Update achievements, document processing, chat, and insight generation to use the provider **Adapter**.
5. Remove duplicate provider parsing after each caller uses the provider **Adapter**.

**Benefits**

**Locality** improves because provider quirks live in one place. **Leverage** improves because every AI task gets the same failure handling and parsing. Tests improve because callers can mock one Adapter behaviour instead of many provider response shapes.

## Phase 4: Training Plans And Achievement AI

These slices depend on the deeper AI interaction core and rowing intelligence Modules.

### 12. Deepen Training Plan AI

**Files**

- `src/app/plans/page.tsx`
- `src/lib/trainingPlans.ts`
- `src/lib/cloudAI.ts`
- `src/lib/memoryStorage.ts`
- `src/app/chat/page.tsx`
- `src/components/PlanAnalysisArchiveModal.tsx`

**Problem**

Training plan creation, AI generation, persistence, activation, memory publishing, deletion cleanup, and chat analysis handoff are spread across page, library, memory, and chat files. The training plan **Module** has some **Depth** for storage and templates, but AI orchestration around it is **Shallow**.

**Implementation Plan**

1. Add tests for training plan generation, activation, memory publishing, deletion cleanup, and plan analysis handoff.
2. Move generation, activation side effects, memory publishing, and plan analysis entry into a training plan AI **Module**.
3. Reuse model settings and prompt resolution for plan generation and plan analysis.
4. Reuse chat and explanation handoff where plan analysis becomes a discussion.
5. Keep plan pages focused on plan selection and display.

**Benefits**

**Locality** improves because training plan rules stay near training plan behaviour. **Leverage** improves because chat, memory, and plan archive can use the same plan analysis behaviour. Tests improve because training plan outcomes can be asserted without knowing page-level prompt JSON, memory ordering, or chat handoff flags.

### 13. Deepen Achievement AI Generation

**Files**

- `src/app/api/achievements/suggestions/route.ts`
- `src/app/api/achievements/story/route.ts`
- `src/app/api/achievements/image/route.ts`
- `src/lib/awardPredictions.ts`
- `src/lib/awards.ts`
- `src/lib/achievementColors.ts`
- `src/lib/settings.ts`
- `src/app/settings/page.tsx`

**Problem**

Achievement suggestions, story generation, and image generation each build prompts, select models, parse results, and call the provider separately. Settings expose achievement prompts and model options, but route files carry their own defaults and custom prompt handling.

**Implementation Plan**

1. Add tests for achievement suggestion generation, story generation, image prompt preparation, palette rules, and result shaping.
2. Move suggestion, story, image prompt preparation, model settings, palette rules, and result shaping into an achievement AI generation **Module**.
3. Reuse the awards **Module** for award meaning and award prediction context.
4. Reuse model settings and prompt resolution for achievement AI settings.
5. Reuse the provider **Adapter** for provider calls and response parsing.

**Benefits**

**Locality** improves because achievement AI rules live with achievement behaviour. **Leverage** improves because settings, award suggestions, story generation, and image generation share one rule set. Tests improve because achievement output can be tested without provider payload details across three route files.

## Phase 5: App Startup And Sync

Do this after the rowing session storage **Module** exists, because sync depends on stable storage semantics.

### 14. Deepen Local Data And Cloud Data Sync

**Files**

- `src/hooks/useDataSync.ts`
- `src/lib/dataSync.ts`
- `src/lib/migrateAllLocalData.ts`
- `src/lib/settingsSync.ts`
- `src/lib/memorySync.ts`
- `src/lib/settings.ts`

**Problem**

App startup, local data migration, cloud data loading, settings sync, memory sync, and cache warming are coordinated across several **Modules**. Callers must know ordering across local data, cloud data, settings, memory, and cache state.

**Implementation Plan**

1. Add tests for first startup, authenticated startup, local data migration, settings sync, memory sync, partial failure, and cache warming.
2. Deepen a data sync **Module** around startup, local data migration, cloud data loading, and cache warming.
3. Keep per-area persistence details behind their owning **Modules**.
4. Make startup callers invoke one sync story rather than coordinating settings first, then rowing sessions, then memory.
5. Remove overlapping migration and sync orchestration after the data sync **Module** owns ordering.

**Benefits**

**Locality** improves because startup and migration ordering lives in one place. **Leverage** improves because rowing sessions, awards, analytics, settings, memory, and chat can share one model of local data versus cloud data. Tests improve because sync outcomes and failure handling can be asserted without coordinating many initialization calls.

## Suggested Order

1. Rowing import **Module**.
2. SmartRow parsing **Module**.
3. Rowing session storage **Module**.
4. Rowing session analytics **Module**.
5. Awards **Module**.
6. AI insight generation **Module**.
7. Chat **Module**.
8. Explanation handoff **Module**.
9. Memory ingestion **Module**.
10. Model settings and prompt resolution **Module**.
11. Provider **Adapter** and response parsing.
12. Training plan AI **Module**.
13. Achievement AI generation **Module**.
14. Data sync **Module**.

## Review Checkpoints

- After each slice, run the deletion test against the new **Module**.
- After each slice, identify whether any new **Seam** has one **Adapter** or two real **Adapters**.
- After each slice, confirm the main tests exercise the public **Interface**, not internal **Implementation** details.
- After each slice, remove old pass-through Modules if complexity does not reappear across callers.
