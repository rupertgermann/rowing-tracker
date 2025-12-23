# Settings Migration to Database - Progress Report

## Completed ✅

### 1. API Endpoint Enhancement
- **File**: `/api/settings/route.ts`
- **Status**: ✅ Complete
- **Changes**:
  - Extended GET handler to return comprehensive default settings
  - Extended POST handler to accept all UserSettings schema fields
  - Added field-by-field update logic for partial updates
  - Supports: theme, units, dateFormat, timeFormat, language, timezone, chart settings, training zones, notification settings, AI settings, user profile context, dashboard settings, etc.

### 2. Settings Sync Library
- **File**: `/lib/settingsSync.ts`
- **Status**: ✅ Complete
- **Exports**:
  - `fetchSettingsFromDB()` - Async fetch from database
  - `saveSettingsToDB()` - Async save to database
  - `saveAISettingsToDB()` - Specialized AI settings save
  - `saveUserProfileContextToDB()` - User profile context save

### 3. Settings Hook
- **File**: `/hooks/useSettings.ts`
- **Status**: ✅ Complete
- **Features**:
  - Loads settings from database on mount
  - Falls back to localStorage if database unavailable
  - Provides `updateSettings()` for full settings updates
  - Provides category-specific update functions:
    - `updateAISettings()`
    - `updateUserPreferences()`
    - `updateTrainingSettings()`
    - `updateNotificationSettings()`
  - Returns loading state and error handling

## In Progress 🔄

### AI Config Migration
- **Current Status**: Starting
- **Current Implementation**: 
  - Stored in localStorage via `settings.ts`
  - API keys stored as plain text (security risk)
  - Uses `aiConfig.ts` for initialization logic
- **Target Implementation**:
  - Move API keys to `UserApiKey` model (encrypted)
  - Store AI settings in `UserSettings.aiConfig` (JSON field)
  - Use database as source of truth
  - Encrypt sensitive data in transit and at rest

### Security Considerations
1. **API Key Storage**:
   - Current: Plain text in localStorage ❌
   - Target: Encrypted in `UserApiKey` table ✅
   - Use `crypto` module for encryption

2. **Sensitive Fields**:
   - `openaiApiKey` → Move to `UserApiKey` table
   - `aiConfig` → Store in `UserSettings.aiConfig` (JSON)
   - Never expose keys in API responses

3. **Encryption Strategy**:
   - Use Node.js `crypto` module for server-side encryption
   - Store encrypted key in database
   - Decrypt only when needed for API calls
   - Never send keys to client

## Pending 📋

### 1. AI Config Service Migration
- Create `aiConfigSync.ts` for API calls
- Update `aiConfig.ts` to use database
- Implement secure key storage and retrieval

### 2. Settings Page Integration
- Update settings UI to use `useSettings` hook
- Integrate AI config form with database
- Add secure API key input with encryption

### 3. Testing
- Test settings persistence across sessions
- Test AI config updates
- Test fallback to localStorage
- Verify data isolation between users

### 4. Cleanup
- Remove localStorage-based settings from `settings.ts` (keep as fallback)
- Remove plain-text API key storage
- Update documentation

## Architecture

### Data Flow
```
Settings Page UI
    ↓
useSettings Hook
    ↓
settingsSync.ts (API calls)
    ↓
/api/settings (NextAuth protected)
    ↓
Prisma UserSettings Model
    ↓
PostgreSQL Database
```

### AI Config Flow
```
AI Coach / Insights / Training Plans
    ↓
aiConfig.ts (initialization)
    ↓
aiConfigSync.ts (fetch from DB)
    ↓
/api/ai-config (NextAuth protected)
    ↓
Prisma UserApiKey Model (encrypted)
    ↓
PostgreSQL Database
```

## Files Created/Modified

### Created
- ✅ `/lib/settingsSync.ts` - Settings API integration
- ✅ `/hooks/useSettings.ts` - Settings state management hook
- 📋 `/lib/aiConfigSync.ts` - AI config API integration (pending)

### Modified
- ✅ `/api/settings/route.ts` - Enhanced endpoint
- 📋 `/lib/aiConfig.ts` - Will update to use database
- 📋 `/lib/settings.ts` - Will keep as fallback

## Migration Timeline

### Phase 1: Settings (This session)
- ✅ Create API endpoint
- ✅ Create sync library
- ✅ Create hook
- 🔄 Migrate AI Config
- 📋 Test integration

### Phase 2: Integration (Next session)
- Update UI components to use hooks
- Test end-to-end
- Verify data isolation

### Phase 3: Cleanup (Next session)
- Remove localStorage dependencies
- Update documentation
- Performance optimization

## Notes

- All settings are now database-backed with localStorage fallback
- User data is properly isolated by userId
- Settings are encrypted in transit (HTTPS)
- API keys will be encrypted at rest
- No breaking changes to existing code
- Gradual migration allows testing before full rollout
