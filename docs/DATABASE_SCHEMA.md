# Database Schema (Condensed, current)

- **Stack**: PostgreSQL + Prisma v7 + NextAuth.js v4.
- **Hosting**: Dev via Docker Postgres; Prod via Supabase (pooler + direct URL) or any managed Postgres.
- **Migrations**: `npx prisma generate` → `npx prisma migrate dev` (dev) / `npx prisma migrate deploy` (prod).
- **Adapter**: `@prisma/adapter-pg` over `pg` `Pool` (configured in `prisma.config.ts`).
- **Source of truth**: `prisma/schema.prisma`. This document is a condensed, annotated mirror.

## Core Models (Prisma)
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
  passwordHash  String?   // For email/password auth (bcrypt)
  role          String    @default("user") // 'user' | 'admin'
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  accounts              Account[]
  sessions              AuthSession[]
  rowingSessions        RowingSession[]
  mocapSessions         MocapSession[]
  personalRecords       PersonalRecord[]
  earnedAwards          EarnedAward[]
  aiAwards              AIAwardSuggestion[]
  generatedAchievements GeneratedAchievement[]
  trainingPlans         TrainingPlan[]
  chatSessions          ChatSession[]
  aiInsights            AIInsight[]
  memoryDocuments       MemoryDocument[]
  settings              UserSettings?
  apiKeys               UserApiKey[]
  chartExplanations     ChartExplanation[]

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

model PasswordResetToken {
  id        String   @id @default(cuid())
  email     String
  token     String   @unique
  expires   DateTime
  createdAt DateTime @default(now())

  @@index([email])
  @@index([token])
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
  consistencyScore Float?  // Pre-computed power-CV-based consistency (0–100)
  
  // Metadata
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  importedAt      DateTime @default(now())
  sourceFile      String?  // Original CSV filename
  
  // Relations
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  strokeData      StrokeData[]
  mocapSession    MocapSession?
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
  mocapMetrics    StrokePostureMetric[]
  
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
// MOCAP (motion-capture posture analysis — see docs/prd-mocap-posture.md)
// ============================================================================

model MocapSession {
  id                     String   @id @default(cuid())
  userId                 String
  rowingSessionId        String?  @unique // Bidirectional, exclusive link to RowingSession
  videoStoragePath       String   // Path to recorded video on backend (FS or Vercel Blob)
  poseStreamPath         String   // Path to PoseFrameStream binary blob (see ADR-0001)
  source                 String   // 'browser' | 'sidecar'
  captureModelVersion    String   // e.g. 'mediapipe-pose-landmarker-lite@0.10.35'
  capturePerspective     String   // 'side-left' | 'side-right' | 'sidecar-3d'
  captureFps             Float
  calibrationCatchFrame  Json?    // Per-session catch baseline (encoded pose frame)
  calibrationFinishFrame Json?    // Per-session finish baseline (encoded pose frame)
  durationSec            Float    @default(0)
  qualityScore           Float?
  qualityFlags           String[] @default([])
  status                 String   @default("capturing") // capturing | analyzing | ready | linked
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  user                 User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  rowingSession        RowingSession?        @relation(fields: [rowingSessionId], references: [id], onDelete: SetNull)
  strokePostureMetrics StrokePostureMetric[]
  postureFaults        PostureFault[]

  @@index([userId])
  @@index([userId, createdAt])
}

model StrokePostureMetric {
  id                  String   @id @default(cuid())
  mocapSessionId      String
  strokeIndex         Int
  phaseBoundariesJson Json     // catch / drive / finish / recovery boundaries
  metricsJson         Json     // back angle, layback, sequencing offsets, etc.
  segmentationSource  String   // 'pose-segmented' | 'csv-aligned'
  strokeDataId        String?  // Joined to StrokeData when csv-aligned
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  mocapSession MocapSession @relation(fields: [mocapSessionId], references: [id], onDelete: Cascade)
  strokeData   StrokeData?  @relation(fields: [strokeDataId], references: [id], onDelete: SetNull)

  @@unique([mocapSessionId, strokeIndex, segmentationSource])
  @@index([mocapSessionId])
  @@index([strokeDataId])
}

model PostureFault {
  id             String   @id @default(cuid())
  mocapSessionId String
  strokeIndex    Int
  faultType      String   // see CONTEXT.md PostureFault catalog
  severity       String   // 'info' | 'warning' | 'critical'
  phase          String   // 'catch' | 'drive' | 'finish' | 'recovery'
  evidenceJson   Json     // frame index + metric value + threshold
  createdAt      DateTime @default(now())

  mocapSession MocapSession @relation(fields: [mocapSessionId], references: [id], onDelete: Cascade)

  @@index([mocapSessionId])
  @@index([mocapSessionId, strokeIndex])
  @@index([faultType, severity])
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
  id                 String    @id @default(cuid())
  userId             String
  title              String
  description        String
  rationale          String    @db.Text
  status             String    // 'suggested' | 'approved' | 'earned'

  // Structured criteria for auto-evaluation
  criteriaType       String?   // 'total_distance', 'single_session_power', etc.
  criteriaValue      Float?
  criteriaComparison String?   // 'gte' | 'lte' | 'eq'

  targetDate         DateTime?
  suggestedAt        DateTime  @default(now())
  approvedAt         DateTime?
  earnedAt           DateTime?
  model              String?   // AI model used

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, status])
}

model GeneratedAchievement {
  id           String    @id @default(cuid())
  userId       String
  awardId      String    // Can be static or AI award ID
  story        String?   @db.Text
  imageUrl     String?   // Path to stored image
  hasImage     Boolean   @default(false)
  colorPalette String?   @default("classic") // Image color palette
  earnedAt     DateTime?
  generatedAt  DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

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
  id            String    @id @default(cuid())
  userId        String

  type          String    // 'performance' | 'recommendation' | 'trend' | 'achievement' | 'warning'
  title         String
  description   String    @db.Text
  priority      String    // 'high' | 'medium' | 'low'
  actionable    Boolean   @default(false)
  confidence    Float?
  evidence      String[]  // Evidence strings backing the insight
  category      String?

  source        String    // 'cloud-ai' | 'local-analysis'
  archived      Boolean   @default(false)

  dateGenerated DateTime  @default(now())
  archivedAt    DateTime?

  // User feedback collected from /insights
  feedback      String?   // 'helpful' | 'not_helpful' | 'action_taken'
  feedbackAt    DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, archived])
  @@index([userId, dateGenerated])
}

// ============================================================================
// MEMORY DOCUMENTS
// ============================================================================

model MemoryDocument {
  id            String   @id @default(cuid())
  userId        String

  name          String
  type          String   // 'image' | 'pdf' | 'training_plan' | 'insight' | 'note'
  source        String   // 'user' | 'system'
  mimeType      String
  size          Int      // bytes
  filePath      String?  // FS path or Vercel Blob URL; nullable for system docs

  description   String?  @db.Text
  extractedText String?  @db.Text
  tags          String[]

  // For system documents (training plans, insights, etc.)
  content       Json?
  status        String?  // 'active' | 'archived' for training plans

  uploadedAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, type])
}

// ============================================================================
// USER SETTINGS
// ============================================================================

model UserSettings {
  id                      String   @id @default(cuid())
  userId                  String   @unique

  // User Preferences
  theme                   String   @default("system")
  units                   String   @default("metric")
  dateFormat              String   @default("MM/DD/YYYY")
  timeFormat              String   @default("24h")
  language                String   @default("en")
  timeZone                String?  @default("UTC")
  defaultChartType        String   @default("line")
  animationsEnabled       Boolean  @default(true)
  showPromptSuggestions   Boolean  @default(true)
  customPrompts           String[]

  // Training Settings
  trainingZones           Json?
  preferredMetrics        String[]
  weeklyGoalType          String   @default("sessions")
  weeklyGoalTarget        Int      @default(3)
  restDayAlerts           Boolean  @default(true)
  adaptationEnabled       Boolean  @default(true)

  // Notification Settings
  sessionReminders        Boolean  @default(false)
  weeklyProgress          Boolean  @default(true)
  achievementAlerts       Boolean  @default(true)
  planReminders           Boolean  @default(true)
  adherenceAlerts         Boolean  @default(true)

  // AI Settings (API keys stored separately in UserApiKey)
  cloudAIEnabled          Boolean  @default(false)
  mocapDetailedAIShare    Boolean  @default(false) // ADR-0004: opt-in to share per-stroke metrics with cloud AI
  maxTokens               Int      @default(1500)
  aiConfig                Json?    // Per-use-case AI config (chat, insights, plans, ...)
  customPromptsAi         Json?    // Base / chat / plan / insights prompt overrides

  // Personal context for AI
  userProfileContext      String?  @db.Text
  userProfileRawInput     String?  @db.Text

  // Mocap (posture analysis)
  postureThresholds       Json?    // Per-fault threshold overrides; respects userOverridden flag
  mocapPreferences        Json?    // Capture source default, live-cue verbosity, audio on/off

  // Dashboard / View Settings
  dashboardSettings       Json?
  sessionsViewSettings    Json?
  sessionAnalysisSettings Json?
  chartSettings           Json?
  analyticsSettings       Json?

  // Cache-busting revisions bumped by mutations to invalidate client caches
  sessionsRevision        Int      @default(0)
  insightsRevision        Int      @default(0)

  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Separate table for sensitive API keys (AES-256-GCM encrypted at rest)
model UserApiKey {
  id           String   @id @default(cuid())
  userId       String

  provider     String   // 'openai', etc.
  keyHash      String   // Hashed for verification
  encryptedKey String   @db.Text // Encrypted API key

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, provider])
  @@index([userId])
}

// ============================================================================
// CHART EXPLANATIONS CACHE
// ============================================================================

model ChartExplanation {
  id           String   @id @default(cuid())
  userId       String
  chartId      String   // Unique identifier for the chart (may include time-range suffix)

  summary      String   @db.Text
  fullResponse String   @db.Text
  chartTitle   String

  generatedAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, chartId])
  @@index([userId])
}
```

---

## Notes & Operations

- **Source of truth**: `prisma/schema.prisma`. If this document and the schema disagree, the schema wins.
- **Indexes**: defined via Prisma; primary filters are `userId`, timestamps, `status` / `archived`, and mocap session id.
- **Security**: all queries are scoped by `userId`; API keys are AES-256-GCM encrypted (`UserApiKey`); NextAuth is enforced on protected routes; admin endpoints additionally checked through `src/lib/adminAuth.ts`.
- **Mocap storage**: video and `PoseFrameStream` blobs live on the storage backend (`storage/` directory or Vercel Blob), never in Postgres; see ADR-0001 and ADR-0003.
- **Cache invalidation**: mutations bump `UserSettings.sessionsRevision` / `insightsRevision` so client caches discard stale data without a full refetch protocol.
- **Backups**: enable managed backups / PITR on the Postgres host; user-initiated export is available via `/api/user/export`.
- **One-off scripts**:
  - `npm run admin:promote -- <email>` — set `User.role = 'admin'`.
  - `npx tsx scripts/backfill-consistency.ts` — backfill `RowingSession.consistencyScore` from existing `StrokeData` and bump `sessionsRevision` for affected users.

