-- Add sidecar metadata columns used by MocapSession create flow.
ALTER TABLE "MocapSession"
ADD COLUMN "calibrationId" TEXT,
ADD COLUMN "cameraCount" INTEGER;
