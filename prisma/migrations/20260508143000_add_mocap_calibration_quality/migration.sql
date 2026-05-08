ALTER TABLE "MocapSession"
ADD COLUMN "calibrationCatchFrame" JSONB,
ADD COLUMN "calibrationFinishFrame" JSONB,
ADD COLUMN "qualityFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
