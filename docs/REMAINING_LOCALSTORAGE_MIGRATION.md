# Remaining localStorage Migration

## Status: Training Plans ✅ DONE

**File:** `src/lib/trainingPlans.ts`
- ✅ Replaced `getPlans()` with database fetch
- ✅ Made all methods async
- ✅ Replaced `savePlans()` with database save
- ✅ All CRUD operations now use database

## Status: Chat Storage ✅ DONE

**File:** `src/lib/chatStorage.ts`
**API:** `/api/chat` ✅ EXISTS
- ✅ Made all methods async
- ✅ `getSessions()` - fetches from database with 30s cache
- ✅ `getSession()` - fetches from database
- ✅ `createSession()` - uses API
- ✅ `addMessage()` - uses API
- ✅ `updateSessionTitle()` - uses API
- ✅ `deleteSession()` - uses API
- ✅ `clearAllSessions()` - uses API
- ✅ `searchMessages()` - uses API
- ✅ `getPlanAnalysisSessions()` - fetches from database
- ✅ `getInsightDiscussionSessions()` - fetches from database
- ✅ `getCurrentSessionId()` - kept in localStorage (UI state only)
- ✅ Updated all consumers to use async methods

**Consumers updated:**
- `src/components/ExplainChartButton.tsx`
- `src/app/analytics/page.tsx`
- `src/components/PlanAnalysisArchiveModal.tsx`
- `src/components/InsightDiscussionArchiveModal.tsx`
- `src/components/ai/InsightCard.tsx`

## Status: Settings Service ✅ DONE

**File:** `src/lib/settings.ts`
**API:** `/api/settings` ✅ EXISTS
- ✅ `initializeFromDB()` - fetches from database on app load
- ✅ `syncToDatabase()` - syncs changes to database (debounced, 1s)
- ✅ All `update*()` methods trigger DB sync automatically
- ✅ `getSettings()` reads from localStorage cache (synchronous for performance)
- ✅ `transformDBToAppSettings()` / `transformAppToDBSettings()` - proper format conversion
- ✅ `useSettings` hook consolidated to use SettingsService
- ✅ `useDataSync` hook initializes settings from DB on app load
- ✅ localStorage used as cache for offline/performance

**Key files:**
- `src/lib/settings.ts` - Main service with DB sync
- `src/hooks/useSettings.ts` - React hook using SettingsService
- `src/hooks/useDataSync.ts` - Initializes settings on app load
- `src/lib/settingsSync.ts` - API retry logic utilities

## Remaining Files to Fix

### 3. AI Insights Cache ❌ TODO
**File:** `hooks/useAIInsights.ts`
**API:** `/api/insights` ✅ EXISTS
**Usage:** Cached AI-generated insights
**Methods to update:**
- `getCachedInsights()` - fetch from database
- `cacheInsights()` - save to database
- `getArchivedInsights()` - fetch from database

### 4. Memory Storage ⚠️ PARTIAL
**File:** `lib/memoryStorage.ts`
**API:** `/api/memory` ✅ EXISTS
**Usage:** Uses IndexedDB for documents/blobs
**Status:** API ready, needs integration
**Note:** Already has database API, just needs to replace IndexedDB calls

### 5. Image Storage ⚠️ MIGRATION ONLY
**File:** `lib/imageStorage.ts`
**API:** `/api/generated-achievements` ✅ EXISTS
**Usage:** Achievement images (IndexedDB → Database)
**Status:** Migration functions exist, filesystem storage preferred
**Note:** Keep filesystem storage, use database as backup

## Integration Priority

1. ~~**Chat Storage** (High) - Users actively use chat~~ ✅ DONE
2. ~~**Settings Service** (High) - Critical for user experience~~ ✅ DONE
3. **AI Insights** (Medium) - Important but can regenerate
4. **Memory Storage** (Medium) - API ready, straightforward
5. **Image Storage** (Low) - Migration already handled

## Testing Checklist

After each integration:
- [ ] Create data on Device A
- [ ] Verify saves to database (check console logs)
- [ ] Reload page - data persists
- [ ] Login on Device B - data appears
- [ ] Modify on Device B
- [ ] Check Device A - sees changes

## Notes

- Keep `currentSessionId` in localStorage (UI state, not data)
- Keep `activePlanId` in localStorage (UI state, not data)
- Settings can cache in localStorage for offline/performance
- All actual data MUST go to database
