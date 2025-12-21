# Testing Database Synchronization

## Current Implementation Status

✅ **Completed:**
- Removed localStorage persistence from Zustand store
- Added database save operations to `addSessions`
- Created `initializeFromDB` method to load data on login
- Added `useDataSync` hook to trigger initialization
- Integrated data sync into `AuthProvider`
- Added comprehensive logging throughout data flow

## Testing Instructions

### 1. Open Browser Console

Open your browser's developer tools (F12) and go to the Console tab. You'll see detailed logs showing the data flow.

### 2. Upload a Session

1. Go to `/upload` page
2. Upload a CSV file
3. Watch the console for these logs:

```
[STORE] addSessions called with X sessions
[STORE] Unique new sessions: X
[STORE] Saving sessions to database...
[SYNC] Saving X sessions to database
[SYNC] Save response status: 200
[SYNC] Save successful: {...}
[STORE] Save result: { success: true }
```

### 3. Check Database

Run this query to verify data was saved:

```sql
SELECT COUNT(*) FROM "RowingSession";
SELECT * FROM "RowingSession" ORDER BY timestamp DESC LIMIT 5;
```

### 4. Refresh Page

After uploading, refresh the page and watch for:

```
[DATASYNC] useDataSync effect triggered: { status: 'authenticated', hasUser: true, hasInitialized: false }
[DATASYNC] Initializing data from database...
[STORE] initializeFromDB called
[SYNC] Fetching sessions from /api/sessions
[SYNC] Response status: 200
[SYNC] Fetched sessions: X
[STORE] Fetched from DB: { sessions: X, prs: Y, awards: Z }
[STORE] Setting state with: { sessions: X, prs: Y, awards: Z }
[STORE] State updated successfully
```

### 5. Check Dashboard

Go to `/dashboard` and verify:
- Session count is correct
- Charts show data
- Stats are calculated

## Common Issues & Solutions

### Issue 1: "Fetched sessions: 0" but database has data

**Cause:** API route not returning data or authentication issue

**Debug:**
1. Check `/api/sessions` directly in browser
2. Verify you're logged in
3. Check server logs for errors

### Issue 2: Upload succeeds but dashboard shows no data

**Cause:** Store not being initialized or data not being saved

**Debug:**
1. Check console for `[STORE] Save result: { success: true }`
2. Check database has the data
3. Check `[STORE] initializeFromDB called` happens on page load
4. Verify `[STORE] State updated successfully` appears

### Issue 3: Data appears after upload but disappears on refresh

**Cause:** Data saved to store but not to database

**Debug:**
1. Check `[SYNC] Save successful` appears
2. Query database to confirm data is there
3. Check API route logs for errors

### Issue 4: Multiple initializations

**Cause:** `useDataSync` hook running multiple times

**Debug:**
1. Check `hasInitialized` flag is working
2. Look for multiple `[DATASYNC] Initializing data from database...` logs
3. May need to add dependency array optimization

## Expected Log Flow

### On Login:
```
[DATASYNC] useDataSync effect triggered: { status: 'loading', ... }
[DATASYNC] useDataSync effect triggered: { status: 'authenticated', hasUser: true, hasInitialized: false }
[DATASYNC] Initializing data from database...
[STORE] initializeFromDB called
[SYNC] Fetching sessions from /api/sessions
[SYNC] Response status: 200
[SYNC] Fetched sessions: 0
[STORE] Fetched from DB: { sessions: 0, prs: 0, awards: 0 }
[STORE] Setting state with: { sessions: 0, prs: 0, awards: 0 }
[STORE] State updated successfully
```

### On Upload:
```
[STORE] addSessions called with 1 sessions
[STORE] Unique new sessions: 1
[STORE] Saving sessions to database...
[SYNC] Saving 1 sessions to database
[SYNC] Save response status: 200
[SYNC] Save successful: { sessions: [...], count: 1 }
[STORE] Save result: { success: true }
```

### On Refresh After Upload:
```
[DATASYNC] useDataSync effect triggered: { status: 'authenticated', hasUser: true, hasInitialized: false }
[DATASYNC] Initializing data from database...
[STORE] initializeFromDB called
[SYNC] Fetching sessions from /api/sessions
[SYNC] Response status: 200
[SYNC] Fetched sessions: 1
[STORE] Fetched from DB: { sessions: 1, prs: 1, awards: 0 }
[STORE] Setting state with: { sessions: 1, prs: 1, awards: 0 }
[STORE] State updated successfully
```

## Verification Checklist

- [ ] Console shows `[STORE] addSessions called` when uploading
- [ ] Console shows `[SYNC] Save successful` after upload
- [ ] Database query shows sessions exist
- [ ] Console shows `[STORE] initializeFromDB called` on page load
- [ ] Console shows `[SYNC] Fetched sessions: X` with correct count
- [ ] Dashboard displays uploaded sessions
- [ ] Data persists after browser refresh
- [ ] Data visible on different devices (after login)

## Next Steps

Once testing confirms the flow works:

1. Remove debug logging (or make it conditional on dev mode)
2. Add error handling UI (toast notifications)
3. Add loading states during data fetch
4. Optimize re-fetching strategy
5. Add data refresh button
6. Consider adding optimistic updates
