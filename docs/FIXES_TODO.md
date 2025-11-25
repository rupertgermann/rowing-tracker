# Rowing Tracker - Fixes & Improvements TODO

**Generated:** 2025-11-25  
**Status:** Analysis complete, ready for implementation

---

## 🔴 Critical Issues (Fix First)

### 1. ESLint Errors (118 errors, 115 warnings)
The build succeeds but `npm run lint` fails with 233 problems.

- [ ] **`src/lib/cloudAI.ts`** - 40+ `@typescript-eslint/no-explicit-any` errors
  - Replace `any` types with proper interfaces
  - Fix `prefer-const` violations (line 795)
  - Fix unused variables (`sessions` at lines 560, 647, 1561)
  
- [ ] **`src/lib/settings.ts`** - 6 issues
  - Replace `any` types (lines 322, 469, 560)
  - Fix `prefer-const` (line 470)
  - Fix unused `error` variables (lines 354, 567)

- [ ] **`src/lib/strokeParser.ts`** - 2 issues
  - Replace `any` type (line 40)
  - Fix unused `e` variable (line 81)

- [ ] **`src/lib/trainingPlans.ts`** - 3 issues
  - Replace `any` types (lines 93, 314, 323)

- [ ] **`src/lib/zipParser.ts`** - 2 issues
  - Remove unused `StrokeData` import (line 2)
  - Fix unused `e` variable (line 39)

- [ ] **Multiple component files** - Various `any` type issues
  - `src/app/dashboard/page.tsx`
  - `src/app/sessions/page.tsx`
  - `src/app/sessions/[id]/page.tsx`
  - `src/hooks/useAIInsights.ts`
  - `src/hooks/useChat.ts`

---

## 🟡 Code Quality Issues

### 2. Debug Console Logs (94 occurrences)
Production code contains excessive debug logging that should be removed or gated.

- [ ] **`src/lib/cloudAI.ts`** - 64 console statements
  - Remove `console.group('Chat Turn Debug')` and related logs
  - Remove `console.log('Raw AI response:', response)`
  - Remove `console.log('Extracted JSON:', jsonString)`
  - Keep only error logging, wrap in `if (process.env.NODE_ENV === 'development')`

- [ ] **`src/hooks/useAIInsights.ts`** - 11 console statements
  - Remove or gate debug logs

- [ ] **`src/lib/settings.ts`** - 6 console statements
  - Keep error logs, remove debug logs

- [ ] **Other files** - 13 console statements across 8 files
  - Review and clean up

### 3. Duplicate Code
Several helper functions are duplicated across files:

- [ ] **Formatting functions** duplicated in:
  - `src/app/dashboard/page.tsx`
  - `src/app/analytics/page.tsx`
  - `src/app/sessions/page.tsx`
  - `src/app/sessions/[id]/page.tsx`
  - `src/app/prs/page.tsx`
  
  **Fix:** Create `src/lib/formatters.ts` with shared functions:
  - `formatDistance(meters: number): string`
  - `formatDuration(seconds: number): string`
  - `formatPace(secondsPer500m: number): string`
  - `formatDate(date: Date): string`
  - `formatPower(watts: number): string`

- [ ] **Chart configurations** duplicated in:
  - `src/app/dashboard/page.tsx`
  - `src/app/analytics/page.tsx`
  
  **Fix:** Move `chartConfigs` to `src/lib/chartUtils.ts`

---

## 🟢 Architecture Improvements

### 4. Type Safety
- [ ] Create proper TypeScript interfaces for API responses in `src/lib/cloudAI.ts`
  - `ApiResponse` interface
  - `InsightResponse` interface
  - `TrainingPlanResponse` interface
  - `ChatMessage` interface

- [ ] Add strict typing to session detail page
  - Replace `useState<any>(null)` with proper `Session | null` type

### 5. Missing Error Boundaries
- [ ] Add React Error Boundary component for graceful error handling
- [ ] Wrap main layout sections with error boundaries

### 6. Incomplete Documentation
- [ ] Update `docs/ai-features-todo.md` - all items still unchecked but many are implemented
- [ ] Update `docs/todo.md` - Phase 1b (Design System) items unchecked but partially done
- [ ] Create `docs/ARCHITECTURE.md` documenting current structure

---

## 🔵 Feature Gaps

### 7. Missing Tests
- [ ] No unit tests exist
- [ ] No integration tests
- [ ] No E2E tests with Playwright (dependency installed but unused)

### 8. Incomplete Features from Original TODO
- [ ] Session comparison view (deferred)
- [ ] Data export functionality (deferred)
- [ ] Light theme toggle (deferred)
- [ ] Weekly/monthly trend charts (deferred)

### 9. PR/Merge Workflow
From `docs/IMPLEMENTATION_TODO.md`:
- [ ] Create Pull Request for GPT-5.1 refactor
- [ ] Update main README
- [ ] Archive old API docs

---

## 🟣 Performance & UX

### 10. Hydration Handling
- [ ] Multiple pages use `mounted` state pattern - consider extracting to custom hook
  - `src/app/dashboard/page.tsx`
  - `src/app/sessions/page.tsx`
  - `src/app/prs/page.tsx`
  - `src/app/analytics/page.tsx`

### 11. Mobile Navigation
- [ ] Mobile navigation only shows Upload button prominently
- [ ] Consider adding hamburger menu or bottom navigation

### 12. Accessibility
- [ ] Add skip-to-content link
- [ ] Ensure all interactive elements have visible focus states
- [ ] Add `aria-live` regions for dynamic content updates

---

## 📋 Implementation Priority

### Phase 1: Critical Fixes (1-2 hours)
1. Fix ESLint errors in core files (`cloudAI.ts`, `settings.ts`)
2. Remove/gate debug console logs
3. Fix unused imports and variables

### Phase 2: Code Quality (2-3 hours)
1. Extract shared formatting functions to `src/lib/formatters.ts`
2. Extract chart configs to `src/lib/chartUtils.ts`
3. Add proper TypeScript interfaces

### Phase 3: Architecture (2-3 hours)
1. Add Error Boundaries
2. Create `useMounted` custom hook
3. Update documentation

### Phase 4: Testing (4+ hours)
1. Set up Jest/Vitest
2. Add unit tests for utility functions
3. Add component tests
4. Configure Playwright for E2E

---

## 📊 Summary

| Category | Count | Priority |
|----------|-------|----------|
| ESLint Errors | 118 | 🔴 Critical |
| ESLint Warnings | 115 | 🟡 Medium |
| Console Logs | 94 | 🟡 Medium |
| Duplicate Code | 5 files | 🟢 Low |
| Missing Tests | 0 tests | 🔵 Future |
| Doc Updates | 3 files | 🟢 Low |

**Estimated Total Effort:** 10-15 hours

---

## Notes

- Build succeeds (`npm run build` passes)
- App is functional but has code quality issues
- Most issues are type safety and code organization
- No runtime bugs identified during analysis
