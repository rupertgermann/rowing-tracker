# Remaining localStorage Migration

## Status: Training Plans ✅ DONE

**File:** `src/lib/trainingPlans.ts`
- ✅ Replaced `getPlans()` with database fetch
- ✅ Made all methods async
- ✅ Replaced `savePlans()` with database save
- ✅ All CRUD operations now use database

## Remaining Files to Fix

### 1. Chat Storage ❌ TODO
**File:** `src/lib/chatStorage.ts`
**API:** `/api/chat` ✅ EXISTS
**Usage:** Chat sessions and messages
**Methods to update:**
- `getSessions()` - fetch from database
- `saveSessions()` - save to database
- `getCurrentSessionId()` - keep in localStorage (UI state only)

### 2. Settings Service ❌ TODO  
**File:** `src/lib/settings.ts`
**API:** `/api/settings` ✅ EXISTS
**Usage:** User preferences and configuration
**Methods to update:**
- `load()` - fetch from database
- `save()` - save to database
- Keep localStorage for cache/offline fallback

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

1. **Chat Storage** (High) - Users actively use chat
2. **Settings Service** (High) - Critical for user experience
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
