# Database Synchronization Implementation

## Problem Statement

The app is currently using localStorage as its primary data storage via Zustand's persist middleware. This means:

1. **Device A** (with localStorage data) → sees all data
2. **Device B** (empty localStorage) → sees no data
3. Database has migrated data, but app doesn't read from it

## Root Cause

In `src/lib/store.ts`:
```typescript
storage: createJSONStorage(() => localStorage)
```

This configures Zustand to persist to localStorage, making it the source of truth instead of the database.

## Solution Overview

We need to implement a **hybrid approach**:

1. **Database as source of truth** - All data stored in PostgreSQL
2. **Zustand as in-memory cache** - Fast access, no persistence
3. **API layer** - Fetch/save data to database
4. **Initialization on login** - Load data from database into Zustand

## Implementation Steps

### Step 1: Remove localStorage Persistence from Zustand

**File:** `src/lib/store.ts`

Change from:
```typescript
persist(
  (set, get) => ({ ... }),
  {
    name: 'rowing-tracker-storage',
    storage: createJSONStorage(() => localStorage),
  }
)
```

To:
```typescript
(set, get) => ({
  // Store state without persistence
  sessions: [],
  personalRecords: [],
  earnedAwards: [],
  
  // Add initialization method
  initializeFromDB: async () => {
    const data = await initializeStoreFromDB();
    set({
      sessions: data.sessions,
      personalRecords: data.personalRecords,
      earnedAwards: data.earnedAwards,
    });
  },
  
  // Update addSessions to save to DB
  addSessions: async (newSessions) => {
    // Save to database first
    await saveSessionsToDB(newSessions);
    // Then update local state
    set((state) => ({
      sessions: [...state.sessions, ...newSessions]
    }));
  },
  
  // ... other methods updated similarly
})
```

### Step 2: Initialize Store on App Load

**File:** `src/components/AuthProvider.tsx` or `src/app/layout.tsx`

```typescript
import { useRowingStore } from '@/lib/store';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

export function DataInitializer() {
  const { data: session, status } = useSession();
  const initializeFromDB = useRowingStore((state) => state.initializeFromDB);

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // Load data from database when user logs in
      initializeFromDB();
    }
  }, [status, session, initializeFromDB]);

  return null;
}
```

### Step 3: Update All Data Mutations

Every method that modifies data needs to:
1. Save to database via API
2. Update local Zustand state
3. Handle errors gracefully

Example for `addSessions`:
```typescript
addSessions: async (newSessions: Session[]) => {
  try {
    // Save to database
    const result = await saveSessionsToDB(newSessions);
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // Update local state
    set((state) => ({
      sessions: [...state.sessions, ...newSessions].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    }));
    
    // Recalculate PRs and awards
    get().updatePersonalRecords();
    get().checkForNewAwards();
  } catch (error) {
    console.error('Failed to add sessions:', error);
    throw error;
  }
}
```

## Migration Path

### For Existing Users with localStorage Data

1. User logs in → sees migration prompt
2. User clicks "Migrate Data"
3. Data copied from localStorage → database
4. App loads data from database into Zustand
5. User sees same data on all devices

### For New Users

1. User registers/logs in
2. App loads empty state from database
3. User uploads sessions
4. Sessions saved to database
5. Available on all devices immediately

## Benefits

✅ **Multi-device sync** - Same data on all devices
✅ **Data persistence** - Survives browser cache clears
✅ **Scalability** - Database can handle large datasets
✅ **Security** - Data isolated per user
✅ **Backup** - Database backups protect user data
✅ **Performance** - Zustand provides fast in-memory access

## Testing Checklist

- [ ] Login on Device A → upload session → see it in database
- [ ] Login on Device B → see same session
- [ ] Upload session on Device B → see it on Device A (after refresh)
- [ ] Clear localStorage → data still available
- [ ] Logout/login → data persists
- [ ] Migration from localStorage works correctly
- [ ] No duplicate data after migration

## Files to Modify

1. `src/lib/store.ts` - Remove localStorage persistence, add DB methods
2. `src/components/AuthProvider.tsx` - Add data initialization
3. `src/lib/dataSync.ts` - Already created (API helpers)
4. `src/app/api/sessions/route.ts` - Already created
5. `src/app/api/prs/route.ts` - Already created
6. `src/app/api/awards/route.ts` - Already created

## Next Steps

1. Update Zustand store to remove localStorage persistence
2. Add initialization logic to load from database
3. Update all mutation methods to save to database
4. Test multi-device synchronization
5. Update documentation
