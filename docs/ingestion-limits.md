# Import and capture input contract

These are safety ceilings for supported imports and recordings, not physiological targets. Oversized HTTP requests return 413; malformed data returns 400. The clients display the returned error. Split a large import or start a new recording after reaching a limit.

## SmartRow imports

- Summary/stroke CSV: 8 MiB per file, at most 1,000 summary rows or 50,000 stroke rows. Numeric cells must contain finite numbers (European decimal commas supported); blank optional numeric cells retain the existing zero convention.
- ZIP: 32 MiB compressed, 2,000 directory records including folders, 8 MiB per expanded CSV, 64 MiB expanded across extracted CSVs. ZIP64 is unsupported. Unmatched/non-CSV entries are never expanded. Actual decompressed chunks count toward the budget, independent of advertised sizes. Exceeding a ZIP budget returns no sessions to save.
- Session POST and legacy migration: 16 MiB of actual request bytes, 1–1,000 sessions, and at most 50,000 stroke rows total per request. Existing browser persistence batches 25 sessions at a time. The entire request is validated before any persistence. HTTP numbers must be JSON numbers, never numeric strings or null (except optional nullable heart rate/stroke length).
- Session timestamp: a parseable date string of 1–64 characters. Stroke timestamp: exported text of 1–64 characters, including time-only values. IDs max 200 characters; source filenames max 255.
- All metrics are finite and nonnegative. Distance ≤1,000,000 m; duration/stroke elapsed time ≤604,800 s (7 days); energy ≤100,000 kcal; power ≤10,000 W; watt/kg ≤1,000; split ≤86,400 s/500m; work ≤100,000 J; stroke length ≤100 m; stroke rate ≤240 SPM; heart rate ≤300 bpm. Session stroke count is an integer ≤1,000,000; stroke index is an integer ≤50,000.

## Capture

- Create/finalize JSON: 16 KiB. Capture FPS remains >0 and ≤240; final duration is 0–28,800 seconds (8 hours). Calibration frame strings are capped at 1,024 characters; quality flags retain the existing 20 × 80-character limit.
- Pose request: 1 MiB, whole v1/v2 frames only. Frame timestamps are finite and between 0 and 8 hours in milliseconds. Confidence is [0,1]. Coordinates are finite, bounded to ±10 image-relative units for browser frames (allows off-screen MediaPipe extrapolation) or ±1,000,000 mm for sidecar frames.
- Pose recording: the smaller of 256 MiB or 8 hours of frames at the header FPS. At 30 FPS this permits about 6.15 hours for v1 or 4.64 hours for v2; at 240 FPS v2 reaches the byte cap in about 35 minutes. Higher FPS therefore reduces maximum recording time.
- Video request: 8 MiB, allowing delayed MediaRecorder delivery beyond the normal one-second chunk (~313 kB at 2.5 Mbps). Video recording: 10 GiB, enough for the nominal eight-hour stream (~9 GB). Video replay, including open-ended Range requests, streams at most 8 MiB per storage read and stops pulling after cancellation/abort. Video contents remain encoded MediaRecorder bytes; this boundary does not decode media.
- Body readers count each arriving chunk and cancel on overflow or interruption before persistence. Content-Length only permits early rejection; absent or dishonest lengths cannot bypass the limit. Persisted sizes are checked using storage metadata, inside a database row lock held through append so concurrent requests share the same quota and lifecycle status boundary. The lock does not make external storage transactional with PostgreSQL.

## Request rate and failures

The existing Redis-backed limiter uses 100/minute/user for session imports/migration, 30/minute/user for capture create/finalize, and a separate 1,800/minute/user capture chunk tier shared by pose and video. Pose flushes every 12 frames or 500 ms: at the supported 240 FPS maximum that is 1,200/minute, plus 60 video uploads/minute. These limits preserve that cadence and allow burst headroom. They retain the existing development no-Redis and Redis-error fail-open behavior; byte/recording quotas apply independently.

Rejected or interrupted request bodies do not alter stored data. Local failed appends truncate to the previous size; failed cloud index publication removes its unreferenced part after confirming the index did not publish it. If publication state cannot be read, retain the part to avoid corrupting an already published recording; recording deletion removes all parts. Failed pose initialization cleans up the blob before deleting its row; if cleanup fails, the row remains addressable for deletion. A storage append followed by a database/network failure can still have committed bytes: this work does not introduce an exactly-once upload protocol.
