# Settings Database Integration - Testing Guide

## Test Endpoints

### 1. Test Settings Sync
**Endpoint**: `GET /api/test/settings-sync`
**Purpose**: Verify current user settings in database
**Response**: 
```json
{
  "success": true,
  "userId": "user-id",
  "userEmail": "user@example.com",
  "settingsExists": true,
  "settingsData": {
    "theme": "system",
    "units": "metric",
    "language": "en",
    "cloudAIEnabled": false,
    "maxTokens": 1500,
    "hasUserProfileContext": false,
    "hasAIConfig": false,
    "createdAt": "2025-12-23T10:00:00Z",
    "updatedAt": "2025-12-23T10:00:00Z"
  },
  "apiKeyCount": 0,
  "timestamp": "2025-12-23T10:30:00Z"
}
```

### 2. Test Settings Save
**Endpoint**: `POST /api/test/settings-sync`
**Purpose**: Test saving settings to database
**Request Body**:
```json
{
  "theme": "dark",
  "units": "imperial",
  "language": "es"
}
```
**Response**:
```json
{
  "success": true,
  "message": "Settings saved successfully",
  "settings": {
    "theme": "dark",
    "units": "imperial",
    "language": "es",
    "updatedAt": "2025-12-23T10:30:00Z"
  }
}
```

## Manual Testing Steps

### Step 1: Verify Settings Load from Database
1. Open browser DevTools (F12)
2. Go to Settings page
3. Check Console for any errors
4. Verify settings are loaded (should see values in form fields)
5. Check Network tab - should see GET /api/settings request

**Expected Result**: Settings page loads without errors, values appear in form fields

### Step 2: Test Settings Save to Database
1. On Settings page, change a setting (e.g., Theme from "System" to "Dark")
2. Observe the change in UI (should update immediately)
3. Check Network tab - should see POST /api/settings request
4. Check Console for success message
5. Refresh the page
6. Verify the setting persists (should still show "Dark")

**Expected Result**: 
- Setting changes immediately in UI
- POST request succeeds
- Setting persists after page refresh
- Success message appears

### Step 3: Test Database Persistence
1. Open browser DevTools Console
2. Run test endpoint:
```javascript
fetch('/api/test/settings-sync').then(r => r.json()).then(d => console.log(d))
```
3. Verify response shows:
   - `settingsExists: true`
   - Your current settings in `settingsData`
   - `apiKeyCount` shows any saved API keys

**Expected Result**: Response shows your settings are in the database

### Step 4: Test Settings Sync Hook
1. On Settings page, open DevTools Console
2. Change multiple settings rapidly
3. Verify each change:
   - Updates UI immediately (optimistic update)
   - Shows success message
   - Persists after refresh

**Expected Result**: All changes persist, no data loss

### Step 5: Test Fallback to localStorage
1. Open browser DevTools Network tab
2. Simulate offline mode (DevTools → Network → Offline)
3. Try to change a setting
4. Verify:
   - Setting updates in UI (optimistic)
   - Error message appears (database unavailable)
   - Setting is still in localStorage as fallback

**Expected Result**: Settings still work offline, fallback to localStorage

### Step 6: Test Multi-User Isolation
1. Open two browser windows/tabs with different user accounts
2. In Window A: Change theme to "Dark"
3. In Window B: Change theme to "Light"
4. Verify each user's settings are independent
5. Refresh both windows
6. Verify settings persist correctly for each user

**Expected Result**: Each user's settings are isolated, no cross-user data leakage

## Automated Testing

### Run Test Endpoint
```bash
# Test GET endpoint (fetch current settings)
curl -X GET http://localhost:3000/api/test/settings-sync \
  -H "Cookie: <your-session-cookie>"

# Test POST endpoint (save test settings)
curl -X POST http://localhost:3000/api/test/settings-sync \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"theme": "dark", "units": "imperial"}'
```

## Expected Behavior

### Settings Load
- ✅ Settings load from database on page mount
- ✅ Falls back to localStorage if database unavailable
- ✅ Shows loading state while fetching
- ✅ Displays error if database fails

### Settings Save
- ✅ Optimistic UI update (immediate feedback)
- ✅ Saves to database asynchronously
- ✅ Also saves to localStorage as fallback
- ✅ Shows success/error message
- ✅ Reverts on error

### Data Persistence
- ✅ Settings persist after page refresh
- ✅ Settings persist across browser sessions
- ✅ Settings isolated per user
- ✅ No cross-user data leakage

### Error Handling
- ✅ Graceful fallback to localStorage
- ✅ User-friendly error messages
- ✅ No sensitive data in errors
- ✅ Proper logging for debugging

## Troubleshooting

### Settings Not Saving
1. Check browser console for errors
2. Check Network tab for failed requests
3. Verify authentication (check /api/auth/session)
4. Check database connection (verify Prisma can connect)
5. Check API endpoint response (POST /api/settings)

### Settings Not Loading
1. Check browser console for errors
2. Verify authentication
3. Check Network tab for GET /api/settings request
4. Verify database has UserSettings record for user
5. Check localStorage as fallback

### Data Not Persisting
1. Verify POST request succeeded (200 status)
2. Check database directly: `SELECT * FROM "UserSettings" WHERE "userId" = 'your-id'`
3. Verify updatedAt timestamp changed
4. Check for any database errors in server logs

### Cross-User Data Leakage
1. Verify userId filtering in API routes
2. Check Prisma queries include userId filter
3. Verify unique constraints on userId fields
4. Test with multiple users simultaneously

## Performance Metrics

### Expected Response Times
- GET /api/settings: < 200ms
- POST /api/settings: < 300ms
- Settings page load: < 1s
- Settings save: < 500ms (with optimistic update)

### Database Queries
- Settings load: 1 query
- Settings save: 1 upsert query
- API key save: 1 upsert query

## Security Verification

### Authentication
- ✅ All endpoints require NextAuth.js session
- ✅ Unauthorized requests return 401
- ✅ No settings exposed without authentication

### User Isolation
- ✅ All queries filtered by userId
- ✅ Users can only access their own settings
- ✅ No cross-user data leakage

### Data Encryption
- ✅ API keys encrypted with AES-256-GCM
- ✅ Sensitive data not logged
- ✅ HTTPS in transit

## Sign-Off Checklist

- [ ] Settings load from database without errors
- [ ] Settings save to database and persist
- [ ] Fallback to localStorage works
- [ ] Error messages display correctly
- [ ] Multi-user isolation verified
- [ ] No cross-user data leakage
- [ ] Performance metrics acceptable
- [ ] Security measures verified
- [ ] All test endpoints pass

## Next Steps

1. Run manual testing steps 1-6
2. Verify all checkboxes pass
3. Test with real user data
4. Monitor database performance
5. Proceed with AI config integration
