# ADR-0005: freemocap sidecar contract

**Status:** Accepted  
**Date:** 2026-05-09  
**Context owner:** mocap posture analysis (see `docs/prd-mocap-posture.md`, `docs/freemocap-sample-schema.md`)

## Context

ADR-0002 scoped v1 to browser-only pose streams until real output and real needs could inform the freemocap contract. This ADR defines the active sidecar contract.

Empirical basis: freemocap v0.3.x output schema documented in `docs/freemocap-sample-schema.md`. Key facts:

- freemocap uses MediaPipe BlazePose-Heavy per camera, then triangulates to world-space 3D.
- Output shape: `(N_frames, 33, 4)` — 33 BlazePose landmarks × `[x_mm, y_mm, z_mm, confidence]`.
- Coordinate frame: world-space mm, right-handed, origin at calibration rig. Not normalized, not body-relative.
- Confidence = MediaPipe visibility [0,1], not triangulation reprojection error (separate `reprojection_error_mm` available).
- freemocap's batch `.npy` output is frame-indexed, not timestamped. The sidecar live-streaming layer adds wall-clock timestamps.

Browser-path lessons that inform the sidecar contract:
- All five v1 faults (`rounded_back_at_catch`, `early_arm_bend`, `back_opens_before_legs_drive`, `excessive_layback`, `slow_recovery_ratio`) compute cleanly from 2D side view. They don't need depth.
- The three sidecar-only fault slots (`left_right_asymmetry`, `knee_track_deviation`, `shin_not_vertical_at_catch`) genuinely require frontal-plane or depth information.
- Live coaching (post-stroke cues) is desirable for sidecar users too — the timing window is the same as the browser path.

## Decisions

### 1. `PoseFrameStream` schema version bump

The blob gains an optional `z` channel. `keypointSchemaVersion` bumps from `1` → `2`:

| Field | v1 (browser) | v2 (sidecar-3d) |
|-------|-------------|-----------------|
| `x` | normalized [0,1], image-relative | world-space mm |
| `y` | normalized [0,1], image-relative | world-space mm |
| `z` | absent | world-space mm |
| `confidence` | MediaPipe visibility [0,1] | MediaPipe visibility [0,1] |
| `coordinateSpace` | `normalized-2d` | `world-mm-3d` |

Blob header additions for v2: `coordinateSpace: "world-mm-3d"`, `cameraCount: number`, `calibrationId: string` (UUID of the Charuco calibration file used).

Existing v1 blobs are unchanged and remain readable. The blob reader branches on `keypointSchemaVersion`. The analysis pipeline accepts both; all v1 fault rules ignore `z` and work on the `{x, y}` projection regardless of source.

### 2. `PoseFrameStream` widened shape

```typescript
interface KeypointFrame {
  frameIndex: number;
  timestampMs: number;         // wall-clock Unix ms; for sidecar, from live wrapper
  keypoints: Keypoint[];
  quality: FrameQuality;
}

interface Keypoint {
  index: number;               // 0–32, BlazePose landmark index
  x: number;
  y: number;
  z?: number;                  // present only in v2 / sidecar-3d
  confidence: number;          // MediaPipe visibility [0,1]
}

interface FrameQuality {
  trackedCount: number;        // rowing-relevant landmarks with confidence ≥ 0.5
  meanConfidence: number;
  reprojectionErrorMm?: number; // sidecar-3d only
  cameraCount?: number;         // sidecar-3d only
}
```

### 3. WebSocket sidecar wire protocol

The sidecar is a local Python process exposing:

- `ws://localhost:8765/pose-stream` — streams `KeypointFrame` JSON, one message per frame
- `GET http://localhost:8765/health` — returns `{ "status": "ready", "fps": 30, "cameras": 3, "schemaVersion": 2 }`
- `POST http://localhost:8765/session/start` — arms capture, returns `{ "sessionId": "<uuid>", "calibrationId": "<uuid>" }`
- `POST http://localhost:8765/session/stop` — flushes, closes stream

No Docker is required. Users install the Python sidecar via `pip install rowing-tracker-sidecar` (separate PyPI package). The app polls the health endpoint during the readiness gate.

Port 8765 is the default; configurable in `UserSettings.sidecarPort`.

### 4. Faults available with `sidecar-3d`

All v1 faults remain available (they use `{x, y}` only; z is ignored). Three faults become available for the first time:

| Fault key | Requires | What depth enables |
|-----------|----------|--------------------|
| `left_right_asymmetry` | frontal-plane x-displacement of shoulders/hips across strokes | Lateral deviation is unambiguous in 3D |
| `knee_track_deviation` | lateral knee displacement vs ankle during drive | Frontal-plane; inferred from z-differential in side view is unreliable |
| `shin_not_vertical_at_catch` | near-side vs far-side shin disambiguation | In 2D, near/far shin superimpose; z separates them |

These three remain marked `perspective: "sidecar-3d-only"` in the fault catalog. When perspective is `side-left` or `side-right`, they surface as "requires multi-camera capture" — never silently zeroed.

Fault rules for the three sidecar-only fault slots emit `pending` severity until tuned thresholds exist. This ADR establishes that they exist and are unlocked by sidecar-3d, not their exact threshold definitions.

### 5. Metrics available with `sidecar-3d`

`PostureMetricsCalculator` gains a `sidecar-3d` branch that computes:

- All existing v1 metrics (using x, y projection; z ignored for backward compatibility)
- `lateralShoulderSymmetryMm` — mean absolute lateral displacement between left/right shoulder x-coordinates across stroke
- `lateralHipSymmetryMm` — same for hips
- `leftKneeTrackDeviationMm` / `rightKneeTrackDeviationMm` — peak lateral knee deviation from ankle x during drive phase
- `nearShinAngleDeg` — shin angle computed from the nearer (lower z) ankle/knee pair, unambiguous in 3D

### 6. Timing model for alignment

For live streaming: `timestampMs` in each frame is wall-clock epoch ms, set by the sidecar wrapper at frame capture time. This is the join key for SmartRow CSV alignment (same cross-correlation approach used in v1, `StrokeSegmentationSource.csv-aligned`).

For post-session batch mode (if user runs freemocap offline and imports the `.npy`): `timestampMs = sessionStartEpochMs + frameIndex * (1000.0 / fps)`. The import endpoint accepts a `sessionStartEpochMs` parameter.

### 7. Privacy implications of sidecar-3d

ADR-0004 tiers apply unchanged:

- **Tier 1 (raw frames):** never sent to cloud AI. The 3D keypoint array is geometrically richer than 2D — this makes the hard wall *more* important, not less.
- **Tier 3 (fault summary):** sent when `cloudAIEnabled` is true. Same format; the summary adds `"perspective": "sidecar-3d"` so the LLM knows depth metrics are available.
- **Tier 2 (per-stroke metrics):** gated on `mocapDetailedAIShare`. For sidecar-3d, tier 2 includes `lateralShoulderSymmetryMm` and other 3D-derived values. The settings UI should make this explicit: "Share detailed 3D posture measurements for richer AI analysis."

The existing `mocapDetailedAIShare` flag carries the right semantics ("I consent to sharing reconstructable body geometry"). The settings copy notes that detailed sharing includes 3D measurements.

## Consequences

**Positive**

- Contract is grounded in real freemocap output, not a speculative interface.
- `keypointSchemaVersion` already existed (ADR-0001); the version bump is a one-line change in the blob reader.
- All v1 fault logic keeps the same projected `{x, y}` rule path.
- The three sidecar-3D-only faults have a clear metric path.
- Live coaching and post-session replay both work the same way for sidecar users as for browser users.

**Negative**

- The sidecar is a separate Python install; adds setup burden for precision users (acceptable — they opted into the sidecar path).
- `world-mm-3d` coordinates require the analysis pipeline to handle unit normalization before computing angles (v1 assumes image-relative units and uses pixel ratios). The metrics calculator needs a coordinate-space adapter.
- `reprojection_error_mm` is an additional quality dimension for the UI.

**Neutral**

- The Charuco calibration step is the sidecar's responsibility. The app stores `calibrationId` in the `MocapSession` row but does not own the calibration workflow.
- Port 8765 is an arbitrary choice. If it conflicts with local tooling, `UserSettings.sidecarPort` overrides it.

## Alternatives considered

- **Normalize sidecar output to [0,1] to match v1 browser blobs.** Rejected: discards mm-scale information that makes the three sidecar-only fault slots computable. Normalization can be done at query time.
- **Use gRPC instead of WebSocket.** Rejected: WebSocket is simpler for a local loopback connection with no firewall issues; the bandwidth is trivial.
- **Support any pose model (OpenPose, ViTPose, etc.) not just BlazePose.** Rejected: the 33-landmark schema is the contract; other models would need an adapter. Defer until a concrete demand exists.
