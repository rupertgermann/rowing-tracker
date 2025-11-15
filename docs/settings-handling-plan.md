# Settings Handling Optimization & AI Coach Alignment Plan

## 1. Current State Summary

- **Central settings store**
  - `src/lib/settings.ts` defines:
    - `SettingsService` singleton (`settings`) storing all categories in `localStorage` under `rowing_app_settings`.
    - Categories: `userPreferences`, `dataManagement`, `trainingSettings`, `notificationSettings`, `privacySettings`, `aiSettings`.
    - Category-specific getters (`getUserPreferences`, `getAISettings`, etc.) and update methods (`updateUserPreferences`, `updateAISettings`, ...).
    - Migration and validation logic ensuring defaults + `aiSettings` exist.

- **Settings UI** (`src/app/settings/page.tsx`)
  - Client component using `settings` directly:
    - On mount: `settings.getSettings()` -> `settingsData` state.
    - `saveSettings(category, updates)` calls corresponding `settings.updateX` and then reloads via `loadSettings()`.
  - All categories (user, data, training, notifications, privacy) use this unify flow.
  - **AI Coach / AI Settings** section:
    - Stored in `settingsData.aiSettings` via `settings.updateAISettings`.
    - UI supports:
      - `openaiApiKey`, `cloudAIEnabled`, `model`, `temperature`, `maxTokens`.
      - Textareas for `systemPrompt`, `chatSystemPrompt`, `planGenerationPrompt`.
    - `Test Connection` button uses `cloudAI.initialize(settingsData.aiSettings.openaiApiKey)` + `cloudAI.testConnection()`.

- **AI coach usage sites**
  - **Dashboard AI insights**: `src/hooks/useAIInsights.ts`
    - Calls `cloudAI.initialize()` *without* accessing `aiSettings` (relies only on env `NEXT_PUBLIC_OPENAI_API_KEY`).
    - Exposes `isCloudAIConfigured` but does not use `aiSettings` flags like `cloudAIEnabled` or `model`.
  - **Chat / AI coach**: `src/hooks/useChat.ts`, `src/app/chat/page.tsx`
    - `useChat` calls `cloudAI.sendChatMessage(...)` but never initializes `cloudAI` with API key or uses `aiSettings`.
    - Chat page shows `isAIConfigured = cloudAI.isConfigured()` to decide whether AI is ready, but this is only true if someone else previously called `cloudAI.initialize()`.
  - **Legacy AI settings component**: `src/components/ai/AISettings.tsx`
    - Maintains its own `AIUserSettings` in state, persisted in `localStorage` under `ai_settings`.
    - Also calls `cloudAI.initialize(settings.apiKey)` and `cloudAI.testConnection()`.
    - This duplicates both storage and connection logic, separate from `SettingsService.aiSettings`.

- **Other localStorage usage**
  - `ChatStorageService` (`src/lib/chatStorage.ts`) and `useInsightFeedback` (`useAIInsights.ts`) access `localStorage` directly.
  - Error in dev logs: `localStorage is not defined` – occurs when these functions run in a non-browser context (e.g., SSR or during build) without guarding for `window`/`localStorage` availability.

## 2. Problems To Solve

1. **Two competing AI settings stores**
   - `SettingsService.aiSettings` vs `AISettings` component using `ai_settings` key.
   - This leads to confusion and bugs where the AI coach uses different API keys or flags than the Settings page.

2. **AI coach not consistently using saved settings**
   - `cloudAI.initialize()` in `useAIInsights` ignores `aiSettings.openaiApiKey` and `cloudAIEnabled`.
   - Chat (`useChat`) assumes `cloudAI` is already configured and does not look at `aiSettings` at all.

3. **LocalStorage usage without guards**
   - `SettingsService.getSettings()`, `ChatStorageService.getSessions()`, and `useInsightFeedback` access `localStorage` directly.
   - Can run during SSR or in environments where `window` / `localStorage` is not defined, causing runtime errors and full reloads.

4. **AI settings behaviour is not standardized across features**
   - Some places behave as if AI is enabled whenever an env API key exists.
   - Others use UI toggles / prompts but the underlying services do not fully respect them.

## 3. Design Principles (Simple & Reliable)

- **Single source of truth** for user-configurable AI coach settings: `SettingsService.aiSettings`.
- **Explicit, predictable initialization** of `cloudAI` in client-only code paths:
  - Prefer a small helper that reads `aiSettings` and configures `cloudAI` once per session (idempotent).
- **Guard all `localStorage` usage** behind `typeof window !== 'undefined'` checks.
- **Minimal changes**: reuse existing types and UI; remove only redundant/contradicting storage.
- **No server-side dependence** on browser-only settings.

## 4. Target Behaviour (After Refactor)

- **Settings page**
  - All categories, including **AI Coach**, read/write via `SettingsService` only.
  - AI section reflects and controls the exact settings used by:
    - Dashboard AI insights (`useAIInsights`).
    - Chat / AI coach (`useChat` + `cloudAI`).

- **AI coach enablement logic**
  - AI features (chat + cloud insights + AI training plan generation) should be considered **enabled** if:
    - `aiSettings.cloudAIEnabled === true`, and
    - `aiSettings.openaiApiKey` is a non-empty string.
  - Fallback: if `cloudAIEnabled` is false but `NEXT_PUBLIC_OPENAI_API_KEY` is set, we may still allow **read-only / low-friction** AI usage (optional, can be left as-is for now).

- **AI coach uses user settings consistently**
  - `cloudAI.initialize(apiKey)` is always called with:
    - `aiSettings.openaiApiKey` when AI coach is enabled, *or*
    - falls back to env var inside `cloudAI.initialize()` as it already does.
  - `cloudAI.isConfigured()` is therefore consistent with whether we’ve called `initialize()` in a client-only context.

- **LocalStorage safety**
  - All `localStorage` access occurs only:
    - Inside `use client` components or hooks, and
    - After checking `typeof window !== 'undefined'`.
  - On the server / build, these functions should:
    - Either early-return defaults (for getters), or
    - Be no-ops (for setters/clearers).

## 5. Step-by-Step Implementation Plan

### 5.1. Harden SettingsService against SSR

**Goal:** Prevent `localStorage` errors and make settings safe to call from any client code.

**Changes (minimal):**
- In `SettingsService` methods that touch `localStorage`:
  - `getSettings`, `resetAllSettings`, `calculateStorageUsage`, `clearDataCategory`, `clearAllData`, `saveSettings`.
- Add an early guard:
  - If `typeof window === 'undefined'` or `typeof localStorage === 'undefined'`:
    - For **getters** (`getSettings`, `calculateStorageUsage`): return safe defaults.
    - For **mutators** (`resetAllSettings`, `clearDataCategory`, `clearAllData`, `saveSettings`): simply return without doing anything.

**Why this is safe & minimal:**
- All existing callers are client components or hooks that run after mount in practice.
- Guarding prevents unintended SSR/bundler execution from crashing.
- No changes to the public API or types.

### 5.2. Harden ChatStorageService and useInsightFeedback

**Goal:** Avoid `localStorage` errors for chat sessions and AI insight feedback.

**Changes:**
- In `ChatStorageService`:
  - Guard all `localStorage` accesses (`getSessions`, `getCurrentSessionId`, `setCurrentSessionId`, `clearAllSessions`, `saveSessions`).
  - On server / no-localStorage:
    - `getSessions` → return `[]`.
    - `getCurrentSessionId` → return `null`.
    - Mutating ops → no-op.
- In `useInsightFeedback` (`useAIInsights.ts`):
  - Before `localStorage.getItem` / `setItem`, check `typeof window !== 'undefined'`.
  - If not in browser, just skip storing / retrieving feedback.

**Result:**
- No `localStorage is not defined` errors when navigating to chat or using AI features.

### 5.3. Make AI coach settings single-sourced from SettingsService

**Goal:** Remove the split between `ai_settings` and `SettingsService.aiSettings`.

**Changes:**
1. **Deprecate `src/components/ai/AISettings.tsx` as a storage source**
   - Keep the component file untouched for now (to avoid large changes), but ensure it is **not used** by any page for persistence.
   - Verify: currently `DashboardPage` imports `AISettings` but only to render it in the AI Settings tab (hash `#ai-settings`).
     - Decide: either
       - A) Replace usage of `AISettings` on the dashboard with a simple link to `/settings#ai-settings`, or
       - B) Refactor `AISettings` to use `SettingsService.aiSettings` instead of `ai_settings`.
   - **Preferred minimal path:** Option A.
     - Rationale: avoids rewriting the whole component; centralizes all AI configuration in the main Settings page.

2. **Ensure no other code reads `ai_settings` directly**
   - Confirm via search (already done) that only `AISettings.tsx` uses `ai_settings` key.
   - After we stop rendering `AISettings` on the dashboard, `ai_settings` is effectively unused and can remain as dead data in localStorage until cleared by the user via data management (optional cleanup later).

### 5.4. Wire `cloudAI` initialization to AI settings

**Goal:** Make AI features respect user-configured AI coach settings.

**Changes:**

1. **Add a small helper in `cloudAI` or a tiny utility module**
   - Create a function (client-only) that:
     - Reads `SettingsService.getAISettings()`.
     - If `cloudAIEnabled` and `openaiApiKey` exist and we’re in the browser:
       - Calls `cloudAI.initialize(openaiApiKey)`.
       - Returns `true` if configured, `false` otherwise.
   - Because `SettingsService` already handles defaults + migration, we only need to respect its values.

2. **Update `useAIInsights` to use AI settings**
   - Replace `initializeCloudAI` logic that calls `cloudAI.initialize()` with no args:
     - Call the new helper to initialize from `aiSettings`.
     - Fallback: if user has **not** enabled cloud AI but `process.env.NEXT_PUBLIC_OPENAI_API_KEY` exists, you may still call `cloudAI.initialize()` without args (optional; minimal change is to leave it as is, but annotate in code with a short comment if touched).
   - Use `aiSettings.cloudAIEnabled` to determine `isCloudAIConfigured` more accurately:
     - `isCloudAIConfigured` should be true only when we have successfully initialized using either user key or env key.

3. **Update `useChat` to ensure AI is configured before sending messages**
   - Before calling `cloudAI.sendChatMessage(...)`, ensure:
     - If `!cloudAI.isConfigured()`, attempt initialization via the same helper used in `useAIInsights`.
     - If initialization fails, set `state.error` to something like `'Cloud AI is not configured. Please configure your OpenAI API key in Settings.'` and abort send.
   - Additionally, compute `isAIConfigured` from both:
     - `cloudAI.isConfigured()` and
     - `aiSettings.cloudAIEnabled` (if we choose to load settings here).
   - Minimal approach:
     - Keep `isAIConfigured = cloudAI.isConfigured()` but ensure we always attempt initialization from AI settings when chat first mounts or first sends a message.

4. **Align `SettingsPage` AI section messaging**
   - Text already says: "Your API key is stored locally and never shared" and "Enable Cloud AI Features".
   - This is consistent with the behavior we’re implementing, so no major content changes required.

### 5.5. Dashboard AI tab alignment

**Goal:** Remove duplicated AI configuration UI on the dashboard and remove dependence on `AISettings` component as a source of truth.

**Minimal change option (recommended):**
- On `DashboardPage`:
  - Remove the actual rendering of `<AISettings />` if present (in the `ai-settings` tab content).
  - Instead, for the "AI Settings" tab:
    - Show a short message + button linking to `/settings` with `#aiSettings` category active.
    - This keeps the dashboard clean and moves configuration exclusively into the main Settings page.

**Result:**
- The only place where AI coach configuration is edited is the `Settings` page.
- All AI features read from the same `SettingsService.aiSettings` state.

### 5.6. Optional: Reflect model & temperature from settings in `cloudAI`

**Goal (optional / small enhancement):** Use `aiSettings.model` and `aiSettings.temperature` from settings in `cloudAI` when sending requests.

**Minimal changes:**
- Update `CloudAIService.initialize(apiKey?: string)` to accept an optional config object or later setters:
  - Keep existing signature for backwards compatibility.
  - Optionally add a tiny `configureFromSettings(ai: AISettings)` function that updates:
    - `this.config.model`.
- For now, to keep changes small, we can **skip this step** and leave model/temperature as UI-only hints, or add a very small follow-up once everything else works.

## 6. Risk Assessment & Safeguards

- **LocalStorage guards**
  - Eliminate the `localStorage is not defined` runtime error.
  - Behavior on server returns defaults; no breaking API changes.

- **Single source of AI settings**
  - Moving away from `ai_settings` key removes inconsistency but might surprise users who only configured AI via the old `AISettings` component.
  - Mitigation: by switching dashboard to link to Settings, users are clearly directed to the new canonical configuration place.

- **AI initialization helper**
  - Centralizing `cloudAI.initialize` calls makes it easier to audit and adjust later.
  - If initialization fails, we surface a user-facing error instead of crashing.

- **Minimal surface area**
  - No change to the public shapes of `Settings`, `AISettings` interfaces.
  - Main logic changes are restricted to:
    - Guarding localStorage usage.
    - Adding a small helper for AI initialization.
    - Updating `useAIInsights` and `useChat` to call that helper.
    - Simplifying dashboard AI settings UI to link to the Settings page.

## 7. Implementation Order

1. **Add localStorage guards** in `SettingsService`, `ChatStorageService`, and `useInsightFeedback`.
2. **Introduce AI initialization helper** (e.g., in `cloudAI` or a tiny `aiConfig` utility).
3. **Update `useAIInsights`** to use the helper instead of raw `cloudAI.initialize()` with no args.
4. **Update `useChat`** to ensure AI is configured before sending messages and to surface a clear error when not configured.
5. **Simplify Dashboard AI tab** to link to `/settings` for config instead of using `AISettings` as a separate store.
6. **Manual test flow** (after changes):
   - Open `/settings`, configure AI coach (toggle on, set API key), test connection.
   - Visit `/chat`: verify `New Chat` is enabled, messages send successfully when AI is enabled and fail cleanly when disabled.
   - Visit `/dashboard`: verify AI insights behave sensibly with and without configured AI.

---

If you approve this plan, I’ll implement it step by step, keeping changes minimal and localized, and then propose a concise commit message like:

> "Unify AI coach settings handling and harden localStorage usage"
