# ADR-0001: Store raw PoseFrameStream as a binary blob, not Postgres JSONB

**Status:** Accepted
**Date:** 2026-05-08
**Context owner:** mocap posture analysis (see `docs/prd-mocap-posture.md`)

## Context

Mocap sessions produce a stream of pose keypoint frames at ~24 fps. A 30-minute session yields ~43,200 frames at ~2-4 KB each — roughly 100 MB of raw pose data per session, on top of the recorded video.

The original PRD draft proposed a `PoseFrame` table in Postgres with a JSONB `keypointsJson` column, indexed on `(mocapSessionId, frameIndex)`. This would let downstream code load any frame via Prisma the same way other entities are loaded.

We considered the actual access patterns:

- **Re-analysis** — stream all frames of one session through the pure pipeline. Sequential.
- **Replay scrubbing** — random access to a frame by index. Localised reads.
- **Stroke window read** — load all frames between two `frameIndex` values. Contiguous range.
- **Cross-session ad-hoc SQL on individual frames** — none. All queries that span sessions operate on derived rows (`StrokePostureMetric`, `PostureFault`), not raw frames.

There are no query patterns that benefit from per-frame SQL. The JSONB design optimises for a use case that doesn't exist.

## Decision

Store the raw `PoseFrameStream` for each `MocapSession` as a **single binary blob** on the same storage backend as the recorded video — local `storage/` directory in development, Vercel Blob in deployed environments. The `MocapSession` row holds a `poseStreamPath: string` pointing at it.

Format: packed Float32 array of keypoints, prefixed by a small header carrying `{ fps, keypointSchemaVersion, frameCount, keypointsPerFrame }`. Random access by frame index = byte-range read at `header_size + frameIndex * frame_stride`.

Postgres holds only the **derived** rows: `StrokePostureMetric`, `PostureFault`, plus the `MocapSession` row itself. These are small, indexable, queryable, and cheap to back up.

Re-analysis streams the blob through the pipeline and rewrites the derived rows atomically. Scrubbing fetches byte-ranges. The Prisma schema stays compact.

## Consequences

**Positive**

- Postgres footprint stays proportional to derived data, not raw capture volume. No 43k-row inserts per session, no JSONB TOAST bloat, no expensive vacuum.
- Re-analysis is a sequential file read instead of a 43k-row Prisma scan.
- Backups, replication, and DB restore stay cheap as mocap usage grows.
- Pose-stream blob lives next to the video on the same storage backend, so retention / purge / quota logic is one decision, not two.

**Negative**

- A custom serialiser is required (header + packed Float32 layout, version field). Schema evolution of the keypoint format requires a versioned reader.
- No ad-hoc SQL on raw frames. If a future need emerges (unlikely, but e.g. cross-session frame-level statistics), it would mean adding an index/materialisation layer on top of the blobs.
- Storage backend abstraction must support byte-range reads (Vercel Blob does; local filesystem does trivially).

**Neutral**

- A user-initiated "purge raw frames, keep metrics" action becomes "delete the blob"; derived rows are untouched. This matches the PRD's footnote about retention pressure.
- The `PoseFrame` Prisma model in the PRD's schema-additions section is dropped; replaced by `MocapSession.poseStreamPath`.

## Alternatives considered

- **Postgres JSONB row-per-frame (the PRD's original proposal).** Rejected for the bloat / vacuum / re-analysis cost reasons above, given that no query pattern needs per-frame SQL.
- **Parquet / Arrow file format instead of packed Float32.** More tooling-friendly, but adds a dependency for a one-shape data stream where a 32-byte header + flat array is sufficient. Revisit if cross-session analytics on raw frames ever becomes a real need.
- **Object store with one file per frame.** Random access via filename, but 43k tiny files per session is a worse storage pattern than one ~100 MB blob.
