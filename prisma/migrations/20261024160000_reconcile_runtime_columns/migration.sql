-- Some installations already have these columns from schema synchronization.
ALTER TABLE "AIInsight"
    ADD COLUMN IF NOT EXISTS "feedback" TEXT,
    ADD COLUMN IF NOT EXISTS "feedbackAt" TIMESTAMP(3);

ALTER TABLE "GeneratedAchievement"
    ADD COLUMN IF NOT EXISTS "colorPalette" TEXT DEFAULT 'classic';

ALTER TABLE "RowingSession"
    ADD COLUMN IF NOT EXISTS "consistencyScore" DOUBLE PRECISION;

ALTER TABLE "UserSettings"
    ADD COLUMN IF NOT EXISTS "sessionsRevision" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "insightsRevision" INTEGER NOT NULL DEFAULT 0,
    ALTER COLUMN "timeZone" SET DEFAULT 'UTC';

ALTER INDEX IF EXISTS "StrokePostureMetric_mocapSessionId_strokeIndex_segmentationSour"
    RENAME TO "StrokePostureMetric_mocapSessionId_strokeIndex_segmentation_key";

-- Keep the legacy MemoryBlob table because it may contain uploaded document bytes.
