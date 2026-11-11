// Safety ceilings, not physiological targets; see docs/ingestion-limits.md.
export const INGESTION_LIMITS = {
  sessionBodyBytes: 16 * 1024 * 1024,
  sessions: 1000,
  strokes: 50_000,
  csvBytes: 8 * 1024 * 1024,
  zipBytes: 32 * 1024 * 1024,
  zipEntries: 2000,
  zipExpandedBytes: 64 * 1024 * 1024,
  captureBodyBytes: 16 * 1024,
  poseChunkBytes: 1024 * 1024,
  videoChunkBytes: 8 * 1024 * 1024,
  poseBytes: 256 * 1024 * 1024,
  videoBytes: 10 * 1024 * 1024 * 1024,
  recordingSeconds: 8 * 60 * 60,
} as const;
