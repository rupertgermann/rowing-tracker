# Complete Database Synchronization Plan

## Overview

Migrate all application data from localStorage to PostgreSQL database for multi-device sync.

## Data Types & Status

### ✅ Completed (Phase 1)
- [x] **RowingSession** - Workout sessions with metrics
- [x] **PersonalRecord** - Best performances per distance
- [x] **EarnedAward** - Unlocked achievements

### 🔧 In Progress (Phase 2)
- [ ] **StrokeData** - Stroke-by-stroke analysis (linked to sessions)
- [ ] **TrainingPlan** - Multi-week training programs
- [ ] **TrainingWeek** - Weekly training structure
- [ ] **TrainingSession** - Individual planned workouts
- [ ] **AIInsight** - Generated performance insights
- [ ] **ChatSession** - AI coach conversations
- [ ] **ChatMessage** - Individual chat messages
- [ ] **UserSettings** - User preferences and configuration
- [ ] **ChartExplanation** - Cached chart explanations
- [ ] **AIAwardSuggestion** - AI-suggested custom awards

### 📋 Future (Phase 3)
- [ ] **MemoryDocument** - Uploaded PDFs/images for AI context
- [ ] **MemoryBlob** - Binary data storage
- [ ] **UserApiKey** - Encrypted API keys storage
- [ ] **GeneratedAchievement** - AI-generated award stories/images

## Implementation Strategy

### For Each Data Type:

1. **Create API Route** (`/api/{resource}/route.ts`)
   - GET: Fetch all user's resources
   - POST: Create/update resources
   - DELETE: Remove resources (if needed)

2. **Update Store** (`src/lib/store.ts`)
   - Add save to database in mutation methods
   - Keep local state for performance

3. **Update Data Sync** (`src/lib/dataSync.ts`)
   - Add fetch function
   - Add save function
   - Include in `initializeStoreFromDB`

4. **Update Hooks** (if needed)
   - Ensure data loads on login
   - Ensure data saves on changes

## Priority Order

### High Priority (Core Functionality)
1. **StrokeData** - Users upload this with sessions
2. **TrainingPlan/Week/Session** - Active feature users rely on
3. **UserSettings** - Preferences should sync

### Medium Priority (Enhanced Features)
4. **AIInsight** - Generated insights should persist
5. **ChatSession/Message** - Chat history valuable
6. **ChartExplanation** - Cache improves performance

### Low Priority (Nice to Have)
7. **AIAwardSuggestion** - Less frequently used
8. **MemoryDocument** - Advanced feature
9. **GeneratedAchievement** - Optional enhancement

## Current Approach

**Hybrid Model:**
- Database = Source of truth
- Zustand store = In-memory cache
- Save on mutation, load on login
- No localStorage persistence

**Benefits:**
- ✅ Multi-device sync
- ✅ Data survives browser clears
- ✅ Fast in-memory access
- ✅ Centralized backup

## Next Steps

1. Implement StrokeData sync (highest impact)
2. Implement Training Plans sync (user-facing feature)
3. Implement Settings sync (user preferences)
4. Implement AI features sync (insights, chat)
5. Test complete multi-device workflow
6. Remove localStorage dependencies
7. Add data export/import functionality
