-- Add posture goals for training plans and sidecar port settings.

CREATE TABLE "PlanPostureGoal" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "faultType" TEXT NOT NULL,
    "targetRate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanPostureGoal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanPostureGoal_planId_key" ON "PlanPostureGoal"("planId");
CREATE INDEX "PlanPostureGoal_planId_idx" ON "PlanPostureGoal"("planId");

ALTER TABLE "PlanPostureGoal" ADD CONSTRAINT "PlanPostureGoal_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserSettings" ADD COLUMN "sidecarPort" INTEGER;
