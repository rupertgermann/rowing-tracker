-- Add posture threshold settings for mocap fault tuning.
ALTER TABLE "UserSettings" ADD COLUMN "postureThresholds" JSONB;
