# freemocap Output Sample & Schema Reference

Representative output documented from freemocap v0.3.x (BlazePose-Heavy backend). Used as the empirical basis for ADR-0005.

## How freemocap produces data

1. Records synchronized video from 2+ calibrated cameras (Charuco board calibration).
2. Runs MediaPipe BlazePose-Heavy per camera → per-frame 2D keypoints.
3. Triangulates 2D keypoints across camera views → 3D world-space keypoints.
4. Writes `(N_frames, 33, 4)` NumPy array: `[x_mm, y_mm, z_mm, confidence]`.

Post-session batch mode only. Real-time streaming requires a thin wrapper (what the sidecar provides).

## Keypoint schema — BlazePose 33-landmark set

| Index | Name | Rowing relevance |
|-------|------|-----------------|
| 0 | nose | head position |
| 11 | left_shoulder | back angle, torso |
| 12 | right_shoulder | back angle, torso |
| 13 | left_elbow | arm-bend detection |
| 14 | right_elbow | arm-bend detection |
| 15 | left_wrist | handle proxy |
| 16 | right_wrist | handle proxy |
| 23 | left_hip | torso origin, drive sequence |
| 24 | right_hip | torso origin, drive sequence |
| 25 | left_knee | leg extension, knee track |
| 26 | right_knee | leg extension, knee track |
| 27 | left_ankle | foot/footrest proxy |
| 28 | right_ankle | foot/footrest proxy |

Remaining 20 landmarks (face mesh points, finger tips) are captured but unused in rowing analysis.

## Coordinate frame

- **Origin:** calibration rig origin (Charuco board position). Not body-relative.
- **Units:** millimeters.
- **Axes:** right-handed. Approximate orientation after standard rig placement: x=lateral (left→right from camera perspective), y=vertical (up), z=depth (toward camera = positive).
- **Not normalized.** Raw world-space; values depend on rig geometry and rower distance.

Contrast with browser path: MediaPipe in-browser emits **normalized** 2D `[0,1]` coordinates. Sidecar emits **absolute mm** 3D coordinates. The blob header's `coordinateSpace` field distinguishes them.

## Confidence semantics

freemocap passes through MediaPipe's `visibility` score unchanged:

- `1.0` = landmark clearly visible, high confidence
- `0.5` = landmark partially occluded or inferred
- `0.0` = landmark not detected / outside frame

For rowing sidecar usage, mean per-frame confidence < 0.6 across the 13 rowing-relevant landmarks = session quality flag `low_tracking`.

Confidence is **not** a triangulation reprojection error — it is the per-camera MediaPipe visibility, averaged across cameras before triangulation. A separate `reprojection_error_mm` field is available from freemocap's 3D output and should be surfaced as an additional quality signal.

## Timing model

freemocap's post-session `.npy` output is **frame-indexed, not timestamped**. Timing reconstruction: `t_ms = frame_index * (1000.0 / fps)` relative to session start.

The sidecar live-streaming mode (see ADR-0005) adds an explicit `timestamp_ms` field (Unix epoch ms, wall clock of the frame's capture) to each WebSocket message. This is the authoritative timestamp for `PoseFrameStream` alignment with SmartRow CSV data.

## Representative single-frame JSON (sidecar wire format)

```json
{
  "schema_version": 2,
  "frame_index": 312,
  "timestamp_ms": 1746787234512,
  "source": "sidecar-3d",
  "fps": 30,
  "keypoints": [
    { "index": 0,  "name": "nose",           "x": -42.3, "y": 1204.1, "z": 88.2,  "confidence": 0.97 },
    { "index": 11, "name": "left_shoulder",  "x": -98.7, "y": 1102.4, "z": 71.5,  "confidence": 0.96 },
    { "index": 12, "name": "right_shoulder", "x":  87.2, "y": 1099.8, "z": 69.3,  "confidence": 0.95 },
    { "index": 13, "name": "left_elbow",     "x": -142.1,"y": 958.2,  "z": 112.4, "confidence": 0.93 },
    { "index": 14, "name": "right_elbow",    "x":  138.9,"y": 961.7,  "z": 110.8, "confidence": 0.92 },
    { "index": 15, "name": "left_wrist",     "x": -188.4,"y": 842.3,  "z": 134.7, "confidence": 0.91 },
    { "index": 16, "name": "right_wrist",    "x":  182.7,"y": 845.1,  "z": 133.2, "confidence": 0.90 },
    { "index": 23, "name": "left_hip",       "x": -78.3, "y": 812.6,  "z": 22.1,  "confidence": 0.98 },
    { "index": 24, "name": "right_hip",      "x":  74.9, "y": 810.2,  "z": 21.8,  "confidence": 0.98 },
    { "index": 25, "name": "left_knee",      "x": -91.2, "y": 512.4,  "z": -88.4, "confidence": 0.97 },
    { "index": 26, "name": "right_knee",     "x":  87.6, "y": 514.8,  "z": -87.1, "confidence": 0.97 },
    { "index": 27, "name": "left_ankle",     "x": -84.7, "y": 182.3,  "z": -134.2,"confidence": 0.95 },
    { "index": 28, "name": "right_ankle",    "x":  81.3, "y": 184.7,  "z": -133.8,"confidence": 0.95 }
  ],
  "quality": {
    "tracked_count": 13,
    "mean_confidence": 0.951,
    "reprojection_error_mm": 4.2,
    "camera_count": 3
  }
}
```

All 33 landmarks are transmitted; only the 13 listed above are used by the analysis pipeline. `tracked_count` counts only the 13 rowing-relevant landmarks with confidence ≥ 0.5.
