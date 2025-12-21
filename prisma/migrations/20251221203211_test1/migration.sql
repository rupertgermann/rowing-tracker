-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "RowingSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "distance" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "energy" INTEGER NOT NULL,
    "strokeCount" INTEGER NOT NULL,
    "avgPower" DOUBLE PRECISION NOT NULL,
    "maxPower" DOUBLE PRECISION NOT NULL,
    "wattPerKg" DOUBLE PRECISION NOT NULL,
    "avgSplit" DOUBLE PRECISION NOT NULL,
    "minSplit" DOUBLE PRECISION NOT NULL,
    "avgWork" DOUBLE PRECISION NOT NULL,
    "avgStrokeLength" DOUBLE PRECISION NOT NULL,
    "avgStrokeRate" DOUBLE PRECISION NOT NULL,
    "maxStrokeRate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceFile" TEXT,

    CONSTRAINT "RowingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrokeData" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "strokeIndex" INTEGER NOT NULL,
    "time" DOUBLE PRECISION NOT NULL,
    "timestamp" TEXT NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "work" DOUBLE PRECISION NOT NULL,
    "power" DOUBLE PRECISION NOT NULL,
    "avgPower" DOUBLE PRECISION NOT NULL,
    "split" DOUBLE PRECISION NOT NULL,
    "avgSplit" DOUBLE PRECISION NOT NULL,
    "strokeRate" DOUBLE PRECISION NOT NULL,
    "heartRate" DOUBLE PRECISION,
    "strokeLength" DOUBLE PRECISION,

    CONSTRAINT "StrokeData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "distance" INTEGER NOT NULL,
    "bestTime" DOUBLE PRECISION NOT NULL,
    "bestPace" DOUBLE PRECISION NOT NULL,
    "avgPower" DOUBLE PRECISION NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EarnedAward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EarnedAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAwardSuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "criteriaType" TEXT,
    "criteriaValue" DOUBLE PRECISION,
    "criteriaComparison" TEXT,
    "targetDate" TIMESTAMP(3),
    "suggestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "earnedAt" TIMESTAMP(3),
    "model" TEXT,

    CONSTRAINT "AIAwardSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "story" TEXT,
    "imageUrl" TEXT,
    "hasImage" BOOLEAN NOT NULL DEFAULT false,
    "earnedAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "goals" TEXT[],
    "duration" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "focus" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "completedWeeks" INTEGER NOT NULL DEFAULT 0,
    "completedSessions" INTEGER NOT NULL DEFAULT 0,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "adherenceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingWeek" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "focus" TEXT NOT NULL,
    "totalVolume" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "actualVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "TrainingWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "distance" INTEGER,
    "intensity" TEXT NOT NULL,
    "notes" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "targetPace" DOUBLE PRECISION,
    "targetPaceMin" DOUBLE PRECISION,
    "targetPaceMax" DOUBLE PRECISION,
    "targetPower" DOUBLE PRECISION,
    "targetPowerMin" DOUBLE PRECISION,
    "targetPowerMax" DOUBLE PRECISION,
    "targetStrokeRate" DOUBLE PRECISION,
    "targetStrokeRateMin" DOUBLE PRECISION,
    "targetStrokeRateMax" DOUBLE PRECISION,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSessionLink" (
    "id" TEXT NOT NULL,
    "trainingSessionId" TEXT NOT NULL,
    "rowingSessionId" TEXT NOT NULL,

    CONSTRAINT "TrainingSessionLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "chartId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "attachmentType" TEXT,
    "attachmentData" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "actionable" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION,
    "evidence" TEXT[],
    "category" TEXT,
    "source" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "dateGenerated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "AIInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "description" TEXT,
    "extractedText" TEXT,
    "tags" TEXT[],
    "content" JSONB,
    "status" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryBlob" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "MemoryBlob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "units" TEXT NOT NULL DEFAULT 'metric',
    "dateFormat" TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
    "timeFormat" TEXT NOT NULL DEFAULT '24h',
    "language" TEXT NOT NULL DEFAULT 'en',
    "timeZone" TEXT,
    "defaultChartType" TEXT NOT NULL DEFAULT 'line',
    "animationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "showPromptSuggestions" BOOLEAN NOT NULL DEFAULT true,
    "customPrompts" TEXT[],
    "trainingZones" JSONB,
    "preferredMetrics" TEXT[],
    "weeklyGoalType" TEXT NOT NULL DEFAULT 'sessions',
    "weeklyGoalTarget" INTEGER NOT NULL DEFAULT 3,
    "restDayAlerts" BOOLEAN NOT NULL DEFAULT true,
    "adaptationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sessionReminders" BOOLEAN NOT NULL DEFAULT false,
    "weeklyProgress" BOOLEAN NOT NULL DEFAULT true,
    "achievementAlerts" BOOLEAN NOT NULL DEFAULT true,
    "planReminders" BOOLEAN NOT NULL DEFAULT true,
    "adherenceAlerts" BOOLEAN NOT NULL DEFAULT true,
    "cloudAIEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maxTokens" INTEGER NOT NULL DEFAULT 1500,
    "aiConfig" JSONB,
    "customPromptsAi" JSONB,
    "userProfileContext" TEXT,
    "userProfileRawInput" TEXT,
    "dashboardSettings" JSONB,
    "sessionsViewSettings" JSONB,
    "sessionAnalysisSettings" JSONB,
    "chartSettings" JSONB,
    "analyticsSettings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartExplanation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chartId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "fullResponse" TEXT NOT NULL,
    "chartTitle" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChartExplanation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_sessionToken_key" ON "AuthSession"("sessionToken");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "RowingSession_userId_idx" ON "RowingSession"("userId");

-- CreateIndex
CREATE INDEX "RowingSession_userId_timestamp_idx" ON "RowingSession"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "RowingSession_userId_distance_idx" ON "RowingSession"("userId", "distance");

-- CreateIndex
CREATE UNIQUE INDEX "RowingSession_userId_timestamp_distance_key" ON "RowingSession"("userId", "timestamp", "distance");

-- CreateIndex
CREATE INDEX "StrokeData_sessionId_idx" ON "StrokeData"("sessionId");

-- CreateIndex
CREATE INDEX "StrokeData_sessionId_strokeIndex_idx" ON "StrokeData"("sessionId", "strokeIndex");

-- CreateIndex
CREATE INDEX "PersonalRecord_userId_idx" ON "PersonalRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalRecord_userId_distance_key" ON "PersonalRecord"("userId", "distance");

-- CreateIndex
CREATE INDEX "EarnedAward_userId_idx" ON "EarnedAward"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EarnedAward_userId_awardId_key" ON "EarnedAward"("userId", "awardId");

-- CreateIndex
CREATE INDEX "AIAwardSuggestion_userId_idx" ON "AIAwardSuggestion"("userId");

-- CreateIndex
CREATE INDEX "AIAwardSuggestion_userId_status_idx" ON "AIAwardSuggestion"("userId", "status");

-- CreateIndex
CREATE INDEX "GeneratedAchievement_userId_idx" ON "GeneratedAchievement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedAchievement_userId_awardId_key" ON "GeneratedAchievement"("userId", "awardId");

-- CreateIndex
CREATE INDEX "TrainingPlan_userId_idx" ON "TrainingPlan"("userId");

-- CreateIndex
CREATE INDEX "TrainingPlan_userId_status_idx" ON "TrainingPlan"("userId", "status");

-- CreateIndex
CREATE INDEX "TrainingWeek_planId_idx" ON "TrainingWeek"("planId");

-- CreateIndex
CREATE INDEX "TrainingWeek_planId_weekNumber_idx" ON "TrainingWeek"("planId", "weekNumber");

-- CreateIndex
CREATE INDEX "TrainingSession_weekId_idx" ON "TrainingSession"("weekId");

-- CreateIndex
CREATE INDEX "TrainingSessionLink_trainingSessionId_idx" ON "TrainingSessionLink"("trainingSessionId");

-- CreateIndex
CREATE INDEX "TrainingSessionLink_rowingSessionId_idx" ON "TrainingSessionLink"("rowingSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingSessionLink_trainingSessionId_rowingSessionId_key" ON "TrainingSessionLink"("trainingSessionId", "rowingSessionId");

-- CreateIndex
CREATE INDEX "ChatSession_userId_idx" ON "ChatSession"("userId");

-- CreateIndex
CREATE INDEX "ChatSession_userId_category_idx" ON "ChatSession"("userId", "category");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_timestamp_idx" ON "ChatMessage"("sessionId", "timestamp");

-- CreateIndex
CREATE INDEX "AIInsight_userId_idx" ON "AIInsight"("userId");

-- CreateIndex
CREATE INDEX "AIInsight_userId_archived_idx" ON "AIInsight"("userId", "archived");

-- CreateIndex
CREATE INDEX "AIInsight_userId_dateGenerated_idx" ON "AIInsight"("userId", "dateGenerated");

-- CreateIndex
CREATE INDEX "MemoryDocument_userId_idx" ON "MemoryDocument"("userId");

-- CreateIndex
CREATE INDEX "MemoryDocument_userId_type_idx" ON "MemoryDocument"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryBlob_documentId_key" ON "MemoryBlob"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "UserApiKey_userId_idx" ON "UserApiKey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserApiKey_userId_provider_key" ON "UserApiKey"("userId", "provider");

-- CreateIndex
CREATE INDEX "ChartExplanation_userId_idx" ON "ChartExplanation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChartExplanation_userId_chartId_key" ON "ChartExplanation"("userId", "chartId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RowingSession" ADD CONSTRAINT "RowingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrokeData" ADD CONSTRAINT "StrokeData_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RowingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalRecord" ADD CONSTRAINT "PersonalRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalRecord" ADD CONSTRAINT "PersonalRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RowingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarnedAward" ADD CONSTRAINT "EarnedAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAwardSuggestion" ADD CONSTRAINT "AIAwardSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedAchievement" ADD CONSTRAINT "GeneratedAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingWeek" ADD CONSTRAINT "TrainingWeek_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "TrainingWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSessionLink" ADD CONSTRAINT "TrainingSessionLink_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSessionLink" ADD CONSTRAINT "TrainingSessionLink_rowingSessionId_fkey" FOREIGN KEY ("rowingSessionId") REFERENCES "RowingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryDocument" ADD CONSTRAINT "MemoryDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryBlob" ADD CONSTRAINT "MemoryBlob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "MemoryDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserApiKey" ADD CONSTRAINT "UserApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartExplanation" ADD CONSTRAINT "ChartExplanation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
