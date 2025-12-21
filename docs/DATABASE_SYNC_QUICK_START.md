# Database Synchronization - Quick Start Guide

## Current Status

✅ **Completed:**
- Database schema with all models
- API routes created:
  - `/api/sessions` - GET/POST sessions
  - `/api/prs` - GET/POST personal records
  - `/api/awards` - GET/POST awards
- Data sync utilities in `src/lib/dataSync.ts`
- Migration system for localStorage → database

❌ **Issue:**
- App still reads from localStorage (Zustand persist middleware)
- Data not syncing across devices

## The Problem

The Zustand store uses `persist` middleware with localStorage:
```typescript
persist(
  (set, get) => ({ ... }),
  { storage: createJSONStorage(() => localStorage) }
)
```

This means:
- Device A: localStorage → sees data
- Device B: empty localStorage → sees nothing
- Database: has data but app doesn't read it

## Solution Implementation

### Phase 1: Update addSessions to Save to Database (CRITICAL)

This is the most important change - when users upload sessions, save them to the database.

**File:** `src/lib/store.ts`

In the `addSessions` method (around line 623), add database save:

```typescript
addSessions: async (newSessions) => {
  set((state) => {
    const existingIds = new Set(state.sessions.map(s => s.id));
    const uniqueNewSessions = newSessions.filter(s => !existingIds.has(s.id));
    
    // SAVE TO DATABASE FIRST
    saveSessionsToDB(uniqueNewSessions).catch(err => {
      console.error('Failed to save sessions to database:', err);
    });
    
    const updatedSessions = [...state.sessions, ...uniqueNewSessions];
    const updatedRecords = calculatePersonalRecords(updatedSessions);
    const recomputedAwards = computeAllEarnedAwards(updatedSessions);
    
    // Save PRs and awards to database too
    savePRsToDB(updatedRecords).catch(err => {
      console.error('Failed to save PRs to database:', err);
    });
    
    saveAwardsToDB(recomputedAwards).catch(err => {
      console.error('Failed to save awards to database:', err);
    });
    
    // ... rest of existing logic
  });
},
```

### Phase 2: Load from Database on Login

**File:** `src/components/AuthProvider.tsx`

Add initialization hook:

```typescript
'use client';

import { SessionProvider } from 'next-auth/react';
import { useDataSync } from '@/hooks/useDataSync';

function DataSyncWrapper({ children }: { children: React.ReactNode }) {
  useDataSync(); // This hook loads data from database
  return <>{children}</>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DataSyncWrapper>
        {children}
      </DataSyncWrapper>
    </SessionProvider>
  );
}
```

### Phase 3: Add initializeFromDB to Store Interface

**File:** `src/lib/store.ts`

Find the `RowingStore` interface and add:

```typescript
interface RowingStore {
  // ... existing properties
  
  // Add this method
  initializeFromDB: () => Promise<void>;
}
```

### Phase 4: Remove localStorage Persistence (FINAL STEP)

Once database sync is working, remove the persist wrapper:

**Before:**
```typescript
export const useRowingStore = create<RowingStore>()(
  persist(
    (set, get) => ({ ... }),
    { storage: createJSONStorage(() => localStorage) }
  )
);
```

**After:**
```typescript
export const useRowingStore = create<RowingStore>()((set, get) => ({
  // ... all the store logic
}));
```

## Testing Steps

1. **Test Database Save:**
   - Upload a session
   - Check database: `SELECT * FROM "RowingSession";`
   - Should see the session

2. **Test Multi-Device:**
   - Device A: Upload session
   - Device B: Refresh page
   - Should see the session (after implementing Phase 2)

3. **Test Migration:**
   - Device with localStorage data
   - Click "Migrate Data"
   - Data copied to database
   - Refresh page
   - Should still see data

## Rollback Plan

If something breaks:

1. Revert store.ts changes
2. Keep API routes (they're harmless)
3. Users can still use localStorage
4. Fix issues and try again

## Important Notes

- **Don't delete localStorage data** until sync is confirmed working
- **Test with a backup account** first
- **Database sessions persist forever** - localStorage can be cleared
- **Migration is one-way** - localStorage → database only

## Current Files

✅ Created:
- `src/app/api/sessions/route.ts`
- `src/app/api/prs/route.ts`
- `src/app/api/awards/route.ts`
- `src/lib/dataSync.ts`
- `src/hooks/useDataSync.ts`
- `src/lib/migrateLocalStorage.ts`
- `src/components/MigrationPrompt.tsx`

⚠️ Need to modify:
- `src/lib/store.ts` - Add database saves to mutations
- `src/components/AuthProvider.tsx` - Add data initialization
- Add `initializeFromDB` to RowingStore interface

## Next Steps

1. Add `initializeFromDB: () => Promise<void>` to RowingStore interface
2. Update `addSessions` to call `saveSessionsToDB`
3. Update `deleteSession` to call database API
4. Update `updateSession` to call database API
5. Add data initialization to AuthProvider
6. Test thoroughly
7. Remove localStorage persistence
