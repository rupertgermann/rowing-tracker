-- Add mocap preferences JSON column missing from previous migrations.
ALTER TABLE "UserSettings" ADD COLUMN "mocapPreferences" JSONB;
