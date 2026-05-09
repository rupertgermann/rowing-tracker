# Context

Domain glossary for rowing-tracker. Terms here are canonical — use them in code, issues, and UI copy. If a concept isn't here, either it's not yet domain-load-bearing, or there's a gap to resolve via `/grill-with-docs`.

## Glossary

### CapturePerspective

Which physical viewpoint a mocap session was recorded from. Determines which posture metrics are computable.

- `side-left` — single webcam, rower's left side facing camera. Browser path.
- `side-right` — single webcam, rower's right side facing camera. Browser path.
- `sidecar-3d` — multi-camera 3D capture via freemocap sidecar. All metrics available.

Browser path emits `side-left` or `side-right` only. Metrics that require `sidecar-3d` (left-right asymmetry, knee track deviation) are marked **unavailable** on side captures — never silently zeroed or estimated. UI surfaces the unavailable state as "requires multi-camera capture."

### StrokeSegmentationSource

How a mocap session's stroke phase boundaries (catch / drive / finish / recovery) were derived.

- `pose-segmented` — boundaries computed from the pose stream alone (hip-knee distance signal). Used during live capture, when no CSV is available yet. Lower confidence; downstream metrics tagged accordingly.
- `csv-aligned` — boundaries taken from `StrokeData` rows (SmartRow ground truth), with the pose stream time-aligned to them via cross-correlation. Used in post-session replay after the user imports the SmartRow CSV and links it to the mocap session.

A mocap session always begins life as `pose-segmented`. When linked to a `RowingSession` (CSV import), re-segmentation to `csv-aligned` is **mandatory** — re-run metrics and faults atomically with the link. Never leave a linked session at `pose-segmented`.

### MocapSession

A captured rowing session containing video + pose stream + derived metrics + faults. Independent of `RowingSession` (which is CSV/erg-derived). May exist standalone (no CSV linked) or be linked to exactly one `RowingSession`.

Lifecycle states (proposed): `capturing` → `analyzing` → `ready` → optionally `linked` (when joined to a `RowingSession`).

**Linking to a `RowingSession`** is bidirectional and exclusive — one `MocapSession` is linked to at most one `RowingSession` and vice versa. Either side may be unlinked; relinking is allowed. Linking triggers mandatory re-analysis (`pose-segmented` → `csv-aligned`) as a background job; the mocap row goes back to `analyzing` until it completes. Unlinking reverts to `pose-segmented` and re-runs metrics. CSV import auto-prompts to link when a capture window overlaps a new `RowingSession` by ±2 minutes — user confirms, never silent.

### CueLatencyBand

When a coaching cue is delivered relative to the stroke that triggered it.

- `intra-stroke` — fired mid-stroke from per-frame rules. **Out of v1 scope.** Pose-segmented stroke boundaries are too noisy for reliable real-time fault attribution within a 2.5s stroke window.
- `post-stroke` — fired ≤1s after stroke completes. The "live coaching" experience in v1.
- `post-session` — surfaced in replay / coaching summary after capture ends.

v1 fault detector runs at the **stroke** granularity only — one pass per closed stroke. No per-frame fault rule path.

### PoseFrameStream

A timestamped sequence of keypoint frames with confidence values, produced by a `PoseCaptureSource` and consumed by the analysis pipeline.

**v1 shape (`keypointSchemaVersion: 1`):** 2D side-view keypoints — `{x, y, confidence}` per keypoint, normalized [0,1] image-relative coordinates. `coordinateSpace: "normalized-2d"`. Browser path only.

**v2 shape (`keypointSchemaVersion: 2`):** 3D world-space keypoints — `{x, y, z, confidence}` per keypoint, units in millimeters. `coordinateSpace: "world-mm-3d"`. Sidecar path only (see ADR-0005). Blob header adds `cameraCount` and `calibrationId`. v1 blobs remain readable — the reader branches on `keypointSchemaVersion`. All v1 fault rules ignore `z` and work on `{x, y}` projection for both versions.

33 BlazePose landmarks; 13 are rowing-relevant (nose, shoulders, elbows, wrists, hips, knees, ankles). The rest are captured but unused. Confidence = MediaPipe visibility [0,1]. v2 adds `reprojectionErrorMm` quality field (triangulation accuracy).

### PostureFault (v1 catalog)

Stroke-granular faults the v1 detector emits. All computable from a 2D side-view `PoseFrameStream`. Each fault is named, attributed to a stroke phase, and has severity bands defined in `FaultThresholds`.

| Fault key | Phase | Severity bands |
| --- | --- | --- |
| `rounded_back_at_catch` | catch | warning < 30°, critical < 20° (back angle) |
| `early_arm_bend` | drive | info / warning by frame-offset of arm-bend onset vs leg-extension completion |
| `back_opens_before_legs_drive` | drive | warning if torso angle changes before legs start extending |
| `excessive_layback` | finish | info > 30°, warning > 45° (torso past vertical) |
| `slow_recovery_ratio` | recovery | warning > 2.5, critical > 3.5 (recovery / drive duration ratio) |

**Excluded from v1**, surfaced as "metric available, detection deferred" or "requires multi-camera capture":

- `left_right_asymmetry` — needs front view or `sidecar-3d`
- `knee_track_deviation` — needs front view or `sidecar-3d`
- `shin_not_vertical_at_catch` — disambiguating near-side shin from far-side shin in 2D is unreliable

**Unlocked by `sidecar-3d` (Phase 2):** all three deferred faults above become computable. Lateral displacement is unambiguous in 3D; near/far shin disambiguated by z-coordinate. Fault rules and thresholds to be defined in follow-up implementation issues.

`perspective` field on each fault: `"browser"` or `"sidecar-3d"`. When perspective is browser, the three sidecar-3d-only faults surface as "requires multi-camera capture" — never silently zeroed.

This catalog is the canonical vocabulary. Test fixtures, threshold tuning, coaching cue copy, and AI prompt context all reference these exact keys. Anything outside this list is out of v1 scope.

### FaultThresholds

The numeric bands a `PostureFault` rule fires against (e.g. "back angle at catch < threshold → rounded-back fault"). Stored on `UserSettings.postureThresholds: Json?`.

**Defaults are hand-coded, conservative, and versioned in code** (`postureThresholdsV1`, `postureThresholdsV2`, …). Each default carries a source comment citing rowing-technique references. Conservative bands = wide tolerances, fewer false positives, fewer angry users in v1.

Migration: when a new defaults version ships, users who haven't touched their thresholds upgrade automatically. Users with `userOverridden: true` keep their custom values; never stomp explicit customisation.

### Calibration

Two distinct calibration concepts — do not conflate:

**Browser calibration** — a pair of reference pose frames captured before recording starts: one at **catch** position, one at **finish** position. Used as pixel-space baselines for downstream metric calculations. Stored per `MocapSession` (see ADR-0001). Recapture (~10 s) required at the start of each session.

**Sidecar Charuco calibration** — a multi-camera extrinsic calibration using a Charuco board. Establishes shared 3D world-space coordinate frame across cameras. Owned and executed by the freemocap sidecar, not by the app. The app stores `calibrationId` (UUID) in `MocapSession` for traceability, but does not own the calibration workflow. Charuco calibration is reusable across sessions as long as cameras don't move; users re-run it when the rig changes.

**Storage:** persisted as one binary blob per `MocapSession`, alongside the video file (see ADR-0001). Not a Postgres table. The `MocapSession` row points at it via `poseStreamPath`. Blob header carries `fps`, `keypointSchemaVersion`, `frameCount`, `coordinateSpace`, and (v2 only) `calibrationId`, `cameraCount`. Random access by frame index = byte-range read.
