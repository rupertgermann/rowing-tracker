# Database Schema Design for Multi-User Rowing Tracker

## Overview

This document outlines the database schema design for migrating the rowing tracker from localStorage/IndexedDB to a proper database with multi-user support.

## Technology Stack

- **Database**: PostgreSQL (robust, scalable, excellent JSON support)
- **ORM**: Prisma 7 (type-safe, excellent Next.js integration)
- **Authentication**: NextAuth.js v4 (supports multiple providers, session management)
- **Hosting Options**: 
  - **Development**: Docker (local PostgreSQL)
  - **Production**: Supabase, Vercel Postgres, Railway, or self-hosted

## Quick Setup

### Option 1: Local Docker (Development)

```bash
# Start PostgreSQL container
npm run db:start

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# (Optional) Open Prisma Studio to view data
npm run db:studio
```

### Option 2: Supabase (Production)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings > Database** and copy connection strings
3. Update `.env`:
   ```env
   DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
   ```
4. Deploy migrations:
   ```bash
   npm run db:migrate:deploy
   ```

---

## Current Data Models Analysis

### 1. Sessions (Zustand Store - `rowing-tracker-storage`)
- Core rowing session data from SmartRow CSV imports
- Includes stroke-by-stroke data (optional)
- Personal records derived from sessions

### 2. Awards/Achievements
- Static awards defined in code (`awards.ts`)
- Earned awards with timestamps
- AI-suggested custom awards
- Generated achievement content (stories, images)

### 3. Training Plans (`rowing_training_plans`)
- Multi-week structured training programs
- Individual training sessions within weeks
- Progress tracking and adherence

### 4. Chat History (`rowing_ai_chat_sessions`)
- AI chat conversations
- Multiple session categories (chat, explanation, plan_analysis, insight_discussion)

### 5. AI Insights (`rowing_ai_insights_cache`, `rowing_ai_insights_archive`)
- Generated insights from session analysis
- Archived insights for historical reference

### 6. Memory Documents (IndexedDB - `rowing_memory_db`)
- User-uploaded files (images, PDFs)
- System-generated documents (training plans, insights)
- Binary blob storage

### 7. Settings (`rowing_app_settings`)
- User preferences
- AI configuration
- Training zones
- Notification preferences

---

## Database Schema (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// USER & AUTHENTICATION
// ============================================================================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  name          String?
  image         String?
  passwordHash  String?   // For email/password auth
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  accounts      Account[]
  sessions      AuthSession[]
  rowingSessions RowingSession[]
  personalRecords PersonalRecord[]
  earnedAwards  EarnedAward[]
  aiAwards      AIAwardSuggestion[]
  generatedAchievements GeneratedAchievement[]
  trainingPlans TrainingPlan[]
  chatSessions  ChatSession[]
  aiInsights    AIInsight[]
  memoryDocuments MemoryDocument[]
  settings      UserSettings?
  
  @@index([email])
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model AuthSession {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ============================================================================
// ROWING SESSIONS
// ============================================================================

model RowingSession {
  id              String   @id @default(cuid())
  userId          String
  
  // Core session data
  timestamp       DateTime
  distance        Int      // meters
  duration        Int      // seconds
  energy          Int      // kCal
  strokeCount     Int
  avgPower        Float    // watts
  maxPower        Float
  wattPerKg       Float
  avgSplit        Float    // seconds per 500m
  minSplit        Float
  avgWork         Float    // joules
  avgStrokeLength Float    // meters
  avgStrokeRate   Float    // SPM
  maxStrokeRate   Float
  
  // Metadata
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  importedAt      DateTime @default(now())
  sourceFile      String?  // Original CSV filename
  
  // Relations
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  strokeData      StrokeData[]
  personalRecords PersonalRecord[]
  trainingSessionLinks TrainingSessionLink[]
  
  @@unique([userId, timestamp, distance]) // Prevent duplicate imports
  @@index([userId])
  @@index([userId, timestamp])
  @@index([userId, distance])
}

model StrokeData {
  id              String   @id @default(cuid())
  sessionId       String
  
  strokeIndex     Int
  time            Float    // seconds
  timestamp       String
  distance        Float    // cumulative distance
  work            Float
  power           Float
  avgPower        Float
  split           Float    // seconds per 500m
  avgSplit        Float
  strokeRate      Float
  heartRate       Float?
  strokeLength    Float?
  
  session         RowingSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  
  @@index([sessionId])
  @@index([sessionId, strokeIndex])
}

model PersonalRecord {
  id          String   @id @default(cuid())
  userId      String
  sessionId   String
  
  distance    Int      // meters (100, 500, 1000, 2000, 5000)
  bestTime    Float    // seconds
  bestPace    Float    // seconds per 500m
  avgPower    Float    // watts
  achievedAt  DateTime
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  session     RowingSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  
  @@unique([userId, distance]) // One PR per distance per user
  @@index([userId])
}

// ============================================================================
// AWARDS & ACHIEVEMENTS
// ============================================================================

model EarnedAward {
  id        String   @id @default(cuid())
  userId    String
  awardId   String   // References static award ID from awards.ts
  earnedAt  DateTime
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, awardId])
  @@index([userId])
}

model AIAwardSuggestion {
  id          String   @id @default(cuid())
  userId      String
  
  title       String
  description String
  rationale   String   @db.Text
  status      String   // 'suggested' | 'approved' | 'earned'
  
  // Structured criteria for auto-evaluation
  criteriaType       String?  // 'total_distance', 'single_session_power', etc.
  criteriaValue      Float?
  criteriaComparison String?  // 'gte', 'lte', 'eq'
  
  targetDate  DateTime?
  suggestedAt DateTime @default(now())
  approvedAt  DateTime?
  earnedAt    DateTime?
  model       String?  // AI model used
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([userId, status])
}

model GeneratedAchievement {
  id          String   @id @default(cuid())
  userId      String
  awardId     String   // Can be static or AI award ID
  
  story       String?  @db.Text
  imageUrl    String?  // Path to stored image
  hasImage    Boolean  @default(false)
  
  earnedAt    DateTime?
  generatedAt DateTime @default(now())
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, awardId])
  @@index([userId])
}

// ============================================================================
// TRAINING PLANS
// ============================================================================

model TrainingPlan {
  id          String   @id @default(cuid())
  userId      String
  
  title       String
  description String   @db.Text
  goals       String[] // Array of goal strings
  duration    Int      // weeks
  level       String   // 'beginner' | 'intermediate' | 'advanced'
  focus       String   // 'general_fitness' | 'endurance' | 'speed' | 'strength' | 'competition'
  status      String   // 'draft' | 'active' | 'completed' | 'paused'
  
  startDate   DateTime?
  
  // Progress tracking
  completedWeeks    Int @default(0)
  completedSessions Int @default(0)
  totalSessions     Int @default(0)
  adherenceRate     Float @default(0)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  weeks       TrainingWeek[]
  
  @@index([userId])
  @@index([userId, status])
}

model TrainingWeek {
  id          String   @id @default(cuid())
  planId      String
  
  weekNumber  Int
  focus       String
  totalVolume Int      // target minutes
  completed   Boolean  @default(false)
  actualVolume Float   @default(0)
  
  plan        TrainingPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  sessions    TrainingSession[]
  
  @@index([planId])
  @@index([planId, weekNumber])
}

model TrainingSession {
  id          String   @id @default(cuid())
  weekId      String
  
  day         Int      // 0-6 (Sunday = 0)
  type        String   // 'endurance' | 'interval' | 'tempo' | 'recovery' | 'strength' | 'technique' | 'rest'
  title       String
  description String   @db.Text
  duration    Int      // target minutes
  distance    Int?     // target meters
  intensity   String   // 'low' | 'medium' | 'high'
  notes       String?  @db.Text
  completed   Boolean  @default(false)
  
  // Target metrics (optional)
  targetPace       Float?
  targetPaceMin    Float?
  targetPaceMax    Float?
  targetPower      Float?
  targetPowerMin   Float?
  targetPowerMax   Float?
  targetStrokeRate Float?
  targetStrokeRateMin Float?
  targetStrokeRateMax Float?
  
  week        TrainingWeek @relation(fields: [weekId], references: [id], onDelete: Cascade)
  actualSessionLinks TrainingSessionLink[]
  
  @@index([weekId])
}

// Link between planned training sessions and actual rowing sessions
model TrainingSessionLink {
  id                  String   @id @default(cuid())
  trainingSessionId   String
  rowingSessionId     String
  
  trainingSession     TrainingSession @relation(fields: [trainingSessionId], references: [id], onDelete: Cascade)
  rowingSession       RowingSession @relation(fields: [rowingSessionId], references: [id], onDelete: Cascade)
  
  @@unique([trainingSessionId, rowingSessionId])
  @@index([trainingSessionId])
  @@index([rowingSessionId])
}

// ============================================================================
// CHAT & AI INTERACTIONS
// ============================================================================

model ChatSession {
  id        String   @id @default(cuid())
  userId    String
  
  title     String
  category  String   // 'chat' | 'explanation' | 'plan_analysis' | 'insight_discussion'
  chartId   String?  // For explanation sessions - links to chart/plan/insight
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages  ChatMessage[]
  
  @@index([userId])
  @@index([userId, category])
}

model ChatMessage {
  id        String   @id @default(cuid())
  sessionId String
  
  role      String   // 'user' | 'assistant' | 'system'
  content   String   @db.Text
  model     String?  // AI model used for assistant messages
  
  // Optional attachments
  attachmentType String?  // 'screenshot' | 'data'
  attachmentData String?  @db.Text // Base64 or JSON
  
  timestamp DateTime @default(now())
  
  session   ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  
  @@index([sessionId])
  @@index([sessionId, timestamp])
}

// ============================================================================
// AI INSIGHTS
// ============================================================================

model AIInsight {
  id          String   @id @default(cuid())
  userId      String
  
  type        String   // 'performance' | 'recommendation' | 'trend' | 'achievement' | 'warning'
  title       String
  description String   @db.Text
  priority    String   // 'high' | 'medium' | 'low'
  actionable  Boolean  @default(false)
  confidence  Float?
  evidence    String[] // Array of evidence strings
  category    String?
  
  source      String   // 'cloud-ai' | 'local-analysis'
  archived    Boolean  @default(false)
  
  dateGenerated DateTime @default(now())
  archivedAt    DateTime?
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([userId, archived])
  @@index([userId, dateGenerated])
}

// ============================================================================
// MEMORY DOCUMENTS
// ============================================================================

model MemoryDocument {
  id          String   @id @default(cuid())
  userId      String
  
  name        String
  type        String   // 'image' | 'pdf' | 'training_plan' | 'insight' | 'note'
  source      String   // 'user' | 'system'
  mimeType    String
  size        Int      // bytes
  
  description   String?  @db.Text
  extractedText String?  @db.Text
  tags          String[]
  
  // For system documents
  content     Json?
  status      String?  // 'active' | 'archived' for training plans
  
  uploadedAt  DateTime @default(now())
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  blob        MemoryBlob?
  
  @@index([userId])
  @@index([userId, type])
}

model MemoryBlob {
  id          String   @id @default(cuid())
  documentId  String   @unique
  
  data        Bytes    // Binary data
  
  document    MemoryDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
}

// ============================================================================
// USER SETTINGS
// ============================================================================

model UserSettings {
  id          String   @id @default(cuid())
  userId      String   @unique
  
  // User Preferences
  theme           String   @default("system")
  units           String   @default("metric")
  dateFormat      String   @default("MM/DD/YYYY")
  timeFormat      String   @default("24h")
  language        String   @default("en")
  timeZone        String?
  defaultChartType String  @default("line")
  animationsEnabled Boolean @default(true)
  showPromptSuggestions Boolean @default(true)
  customPrompts   String[]
  
  // Training Settings
  trainingZones   Json?    // Zone configuration
  preferredMetrics String[]
  weeklyGoalType  String   @default("sessions")
  weeklyGoalTarget Int     @default(3)
  restDayAlerts   Boolean  @default(true)
  adaptationEnabled Boolean @default(true)
  
  // Notification Settings
  sessionReminders Boolean @default(false)
  weeklyProgress   Boolean @default(true)
  achievementAlerts Boolean @default(true)
  planReminders    Boolean @default(true)
  adherenceAlerts  Boolean @default(true)
  
  // AI Settings (sensitive - API key stored separately)
  cloudAIEnabled  Boolean @default(false)
  maxTokens       Int     @default(1500)
  aiConfig        Json?   // Per-use-case config (chat, insights, etc.)
  customPrompts_ai Json?  // System prompts, etc.
  
  // Personal context for AI
  userProfileContext  String? @db.Text
  userProfileRawInput String? @db.Text
  
  // Dashboard/View Settings
  dashboardSettings Json?
  sessionsViewSettings Json?
  sessionAnalysisSettings Json?
  chartSettings Json?
  analyticsSettings Json?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Separate table for sensitive API keys (encrypted at rest)
model UserApiKey {
  id          String   @id @default(cuid())
  userId      String
  
  provider    String   // 'openai', etc.
  keyHash     String   // Hashed for verification
  encryptedKey String  @db.Text // Encrypted API key
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([userId, provider])
  @@index([userId])
}

// ============================================================================
// CHART EXPLANATIONS CACHE
// ============================================================================

model ChartExplanation {
  id            String   @id @default(cuid())
  userId        String
  chartId       String   // Unique identifier for the chart
  
  summary       String   @db.Text
  fullResponse  String   @db.Text
  chartTitle    String
  
  generatedAt   DateTime @default(now())
  
  @@unique([userId, chartId])
  @@index([userId])
}
```

---

## Migration Strategy

### Phase 1: Database Setup
1. Set up PostgreSQL database (Vercel Postgres, Supabase, or self-hosted)
2. Install Prisma and configure connection
3. Run initial migrations to create tables

### Phase 2: Authentication
1. Install and configure NextAuth.js
2. Set up authentication providers (email/password, Google, etc.)
3. Create login/register pages
4. Protect routes with middleware

### Phase 3: Data Migration
1. Create migration utility to export localStorage data
2. Create API endpoint to import data into database
3. Associate imported data with authenticated user
4. Validate data integrity after migration

### Phase 4: Service Layer Refactoring
1. Create database service modules (replacing localStorage services)
2. Update Zustand stores to use database APIs
3. Implement optimistic updates with server sync
4. Add proper error handling and retry logic

### Phase 5: Multi-User Features
1. Implement user profile management
2. Add data isolation in all queries
3. Implement proper authorization checks
4. Add user-specific settings

---

## Key Indexes for Performance

```sql
-- Sessions (most queried table)
CREATE INDEX idx_sessions_user_timestamp ON rowing_sessions(user_id, timestamp DESC);
CREATE INDEX idx_sessions_user_distance ON rowing_sessions(user_id, distance);

-- Awards
CREATE INDEX idx_earned_awards_user ON earned_awards(user_id);

-- Training Plans
CREATE INDEX idx_plans_user_status ON training_plans(user_id, status);

-- Chat
CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, timestamp);

-- Insights
CREATE INDEX idx_insights_user_archived ON ai_insights(user_id, archived);
```

---

## Security Considerations

1. **Data Isolation**: All queries MUST include `userId` filter
2. **API Key Storage**: Encrypt API keys at rest, never log them
3. **Session Management**: Use secure, httpOnly cookies
4. **Rate Limiting**: Implement rate limiting on API routes
5. **Input Validation**: Validate all user inputs with Zod schemas
6. **CORS**: Configure proper CORS policies
7. **SQL Injection**: Prisma handles this, but validate inputs anyway

---

## Backup Strategy

1. **Automated Backups**: Configure database provider's backup (daily)
2. **Export Feature**: Allow users to export their data as JSON
3. **Point-in-Time Recovery**: Enable if using managed database
4. **Data Retention**: Implement configurable retention policies

---

## Next Steps

1. Review and approve this schema design
2. Set up PostgreSQL database
3. Initialize Prisma with this schema
4. Implement NextAuth.js authentication
5. Create database service layer
6. Build migration utility
7. Update frontend to use new APIs

