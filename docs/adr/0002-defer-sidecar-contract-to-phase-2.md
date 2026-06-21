# ADR-0002: Browser-only PoseFrameStream v1 scope

**Status:** Superseded by ADR-0005

**Date:** 2026-05-08

**Context owner:** mocap posture analysis (see `docs/prd-mocap-posture.md`)

## Context

The first `PoseFrameStream` implementation had one production capture source: browser MediaPipe. The project needed a durable capture-to-analysis boundary without guessing at freemocap's concrete output shape before sidecar integration work had real sample data.

ADR-0001 made widening cheap by storing pose data as a versioned binary blob with a `keypointSchemaVersion` header.

## Decision

`PoseFrameStream` v1 is scoped to the browser path:

- 2D keypoints: `{ x, y, confidence }`
- normalized image-relative coordinates
- source-quality flags
- no depth channel
- no sidecar-specific health, session, or WebSocket contract

The sidecar contract is defined by ADR-0005. Sidecar captures use `PoseFrameStream` v2 with `world-mm-3d` coordinates while v1 browser blobs remain readable.

## Consequences

**Positive**

- Browser capture shipped against one real implementation.
- v1 blobs stayed compact and easy to analyze for side-view faults.
- The later sidecar contract could use freemocap's actual `(frames, landmarks, [x_mm, y_mm, z_mm, confidence])` output.

**Negative**

- v1 side-view captures cannot compute depth-only or front-plane metrics.
- The analysis pipeline must branch on `keypointSchemaVersion` and coordinate space.

**Neutral**

- Existing v1 captures continue to use the same reader path.
- ADR-0005 owns the localhost sidecar contract, schema v2, and 3D metric behavior.
