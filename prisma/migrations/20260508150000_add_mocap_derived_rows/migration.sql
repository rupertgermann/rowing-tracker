-- Persist post-session mocap analysis outputs.

CREATE TABLE "StrokePostureMetric" (
    "id" TEXT NOT NULL,
    "mocapSessionId" TEXT NOT NULL,
    "strokeIndex" INTEGER NOT NULL,
    "phaseBoundariesJson" JSONB NOT NULL,
    "metricsJson" JSONB NOT NULL,
    "segmentationSource" TEXT NOT NULL,
    "strokeDataId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrokePostureMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostureFault" (
    "id" TEXT NOT NULL,
    "mocapSessionId" TEXT NOT NULL,
    "strokeIndex" INTEGER NOT NULL,
    "faultType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "evidenceJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostureFault_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StrokePostureMetric_mocapSessionId_strokeIndex_segmentationSource_key" ON "StrokePostureMetric"("mocapSessionId", "strokeIndex", "segmentationSource");
CREATE INDEX "StrokePostureMetric_mocapSessionId_idx" ON "StrokePostureMetric"("mocapSessionId");
CREATE INDEX "StrokePostureMetric_strokeDataId_idx" ON "StrokePostureMetric"("strokeDataId");
CREATE INDEX "PostureFault_mocapSessionId_idx" ON "PostureFault"("mocapSessionId");
CREATE INDEX "PostureFault_mocapSessionId_strokeIndex_idx" ON "PostureFault"("mocapSessionId", "strokeIndex");
CREATE INDEX "PostureFault_faultType_severity_idx" ON "PostureFault"("faultType", "severity");

ALTER TABLE "StrokePostureMetric" ADD CONSTRAINT "StrokePostureMetric_mocapSessionId_fkey" FOREIGN KEY ("mocapSessionId") REFERENCES "MocapSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StrokePostureMetric" ADD CONSTRAINT "StrokePostureMetric_strokeDataId_fkey" FOREIGN KEY ("strokeDataId") REFERENCES "StrokeData"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PostureFault" ADD CONSTRAINT "PostureFault_mocapSessionId_fkey" FOREIGN KEY ("mocapSessionId") REFERENCES "MocapSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
