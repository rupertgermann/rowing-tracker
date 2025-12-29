# Database Schema (Condensed, current)

- **Stack**: PostgreSQL + Prisma + NextAuth.
- **Hosting**: Dev via Docker Postgres; Prod via Supabase/Vercel Postgres/Railway.
- **Migrations**: `npx prisma generate` → `npx prisma migrate dev` (dev) / `npx prisma migrate deploy` (prod).

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

## Notes & Operations
- Indexes are defined via Prisma; main filters are on `userId`, timestamps, status/archived.
- Security: all queries scoped by `userId`; API keys encrypted (UserApiKey, AES-256-GCM, hashed); NextAuth enforced on routes.
- Backups: enable managed backups/PITR; allow user export if needed.

