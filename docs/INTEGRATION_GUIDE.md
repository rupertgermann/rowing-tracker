# Database Sync Integration Guide

## Overview

This guide shows how to integrate the new database sync APIs with existing stores and hooks.

## API Routes Created

### ✅ Completed
1. `/api/sessions` - Rowing sessions (GET, POST)
2. `/api/prs` - Personal records (GET, POST)
3. `/api/awards` - Earned awards (GET, POST)
4. `/api/settings` - User settings (GET, POST)
5. `/api/training-plans` - Training plans with weeks/sessions (GET, POST, DELETE)
6. `/api/insights` - AI insights (GET, POST, DELETE)
7. `/api/chat` - Chat sessions with messages (GET, POST, DELETE)

## Integration Steps by Feature

### 1. Training Plans (useTrainingPlans hook)

**Location:** `src/hooks/useTrainingPlans.ts`

**Current:** Uses localStorage via Zustand persist

**Changes Needed:**
```typescript
import { saveTrainingPlansToDB } from '@/lib/dataSync';

// In createPlan, updatePlan, deletePlan functions:
// After updating local state, save to database:
saveTrainingPlansToDB(updatedPlans).catch(err => {
  console.error('Failed to save plans to database:', err);
});
```

**Files to modify:**
- `src/hooks/useTrainingPlans.ts` - Add database saves
- Store already loads plans via `initializeFromDB()`

### 2. AI Insights (useAIInsights hook)

**Location:** `src/hooks/useAIInsights.ts`

**Current:** Uses localStorage

**Changes Needed:**
```typescript
import { saveInsightsToDB } from '@/lib/dataSync';

// In addInsight, archiveInsight, deleteInsight:
saveInsightsToDB(updatedInsights).catch(err => {
  console.error('Failed to save insights to database:', err);
});
```

**Files to modify:**
- `src/hooks/useAIInsights.ts` - Add database saves
- Store loads insights via `initializeFromDB()`

### 3. Chat Sessions (useChatSessions hook)

**Location:** `src/hooks/useChatSessions.ts`

**Current:** Uses localStorage

**Changes Needed:**
```typescript
import { saveChatSessionsToDB } from '@/lib/dataSync';

// In createSession, addMessage, deleteSession:
saveChatSessionsToDB(updatedSessions).catch(err => {
  console.error('Failed to save chat to database:', err);
});
```

**Files to modify:**
- `src/hooks/useChatSessions.ts` - Add database saves
- Store loads chat via `initializeFromDB()`

### 4. Settings (SettingsService)

**Location:** `src/lib/settings.ts`

**Current:** Uses localStorage

**Changes Needed:**
```typescript
import { saveSettingsToDB, fetchSettingsFromDB } from '@/lib/dataSync';

// In SettingsService.save():
await saveSettingsToDB(settings);

// In SettingsService.load():
const settings = await fetchSettingsFromDB();
```

**Files to modify:**
- `src/lib/settings.ts` - Replace localStorage with database calls

## Quick Integration Pattern

For any feature that needs database sync:

```typescript
// 1. Import the save function
import { saveSomethingToDB } from '@/lib/dataSync';

// 2. After state update, save to database
const handleUpdate = async (data) => {
  // Update local state
  setState(newState);
  
  // Save to database (async, non-blocking)
  saveSomethingToDB(newState).catch(err => {
    console.error('Failed to save:', err);
    // Optionally: Show error toast to user
  });
};

// 3. Data loads automatically on login via initializeFromDB()
```

## Testing Each Integration

### Training Plans
1. Create a plan → Check database
2. Refresh page → Plan still there
3. Login on another device → See same plan

### AI Insights
1. Generate insight → Check database
2. Archive insight → Check database
3. Login on another device → See insights

### Chat
1. Start chat → Check database
2. Send messages → Check database
3. Login on another device → See chat history

### Settings
1. Change theme → Check database
2. Update AI model → Check database
3. Login on another device → See same settings

## Database Queries for Testing

```sql
-- Check training plans
SELECT * FROM "TrainingPlan" WHERE "userId" = 'your-user-id';

-- Check insights
SELECT * FROM "AIInsight" WHERE "userId" = 'your-user-id';

-- Check chat sessions
SELECT * FROM "ChatSession" WHERE "userId" = 'your-user-id';

-- Check settings
SELECT * FROM "UserSettings" WHERE "userId" = 'your-user-id';
```

## Common Issues

### Issue: Data not saving
- Check console for errors
- Verify user is authenticated
- Check API route logs

### Issue: Data not loading
- Check `initializeFromDB()` is called
- Verify `useDataSync` hook is in AuthProvider
- Check console for fetch errors

### Issue: Duplicate data
- API routes check for existing records
- Uses upsert pattern where appropriate

## Next Steps

1. Integrate training plans hook
2. Integrate AI insights hook
3. Integrate chat sessions hook
4. Integrate settings service
5. Test complete multi-device workflow
6. Remove localStorage dependencies
7. Add error handling UI (toasts)
