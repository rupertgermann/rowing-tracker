-- CreateTable
CREATE TABLE "MocapSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rowingSessionId" TEXT,
    "videoStoragePath" TEXT NOT NULL,
    "poseStreamPath" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "captureModelVersion" TEXT NOT NULL,
    "capturePerspective" TEXT NOT NULL,
    "captureFps" DOUBLE PRECISION NOT NULL,
    "durationSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qualityScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'capturing',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MocapSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MocapSession_rowingSessionId_key" ON "MocapSession"("rowingSessionId");

-- CreateIndex
CREATE INDEX "MocapSession_userId_idx" ON "MocapSession"("userId");

-- CreateIndex
CREATE INDEX "MocapSession_userId_createdAt_idx" ON "MocapSession"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "MocapSession" ADD CONSTRAINT "MocapSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MocapSession" ADD CONSTRAINT "MocapSession_rowingSessionId_fkey" FOREIGN KEY ("rowingSessionId") REFERENCES "RowingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
