# PRD: Motion-capture posture analysis (freemocap integration)

## Problem Statement

I row indoors and the app already gives me deep performance analytics from SmartRow CSV (pace, power, stroke rate, PRs, training load). But the data is blind to **how I move**. Bad posture and stroke sequencing silently cap my power output, waste effort, and risk injury (lower-back rounding at the catch, early arm bend, opening the back too soon, asymmetric drive). I have no coach watching me. I want the app to see me row and tell me what's wrong with my technique — both while I'm rowing and after the session, alongside the metrics I already track.

## Solution

Integrate markerless motion capture so the app analyzes the rower's posture and stroke mechanics from video, derives per-stroke biomechanical metrics, detects posture faults, and delivers actionable coaching cues. Two capture paths:

1. **Browser path (default)** — single webcam, in-browser MediaPipe Pose. Zero install. Live feedback during rowing, plus replay after.
2. **Sidecar path (precision)** — local Python sidecar running [freemocap](https://github.com/freemocap/freemocap) with one or more cameras for 3D-accurate skeletons. For users who want serious technique work.

Pose data is stored raw (keypoints per frame) and aligned to existing `RowingSession` / `StrokeData` so users can scrub video, see skeleton overlay, see flagged faults at exact stroke phases, and watch posture trends evolve next to power/pace trends.

## User Stories

1. As a rower, I want to start a webcam-based mocap session in one click, so that I can get posture feedback without installing software.
2. As a rower, I want the app to detect my rowing machine in frame and confirm I'm positioned correctly, so that capture quality is good before I start.
3. As a rower, I want a calibration step (sit at catch, sit at finish), so that the analyzer knows my anatomy and machine geometry.
4. As a rower, I want live audio + visual cues during rowing ("back rounded", "arms bent early", "slow down recovery"), so that I can correct in real time.
5. As a rower, I want live cues to be quiet and non-nagging by default, so that they don't break my flow.
6. As a rower, I want every stroke segmented into catch / drive / finish / recovery automatically, so that faults are reported at the exact phase they occur.
7. As a rower, I want per-stroke posture metrics computed (back angle at catch, shin vertical, hip-knee timing offset, layback angle, sequencing delay, left-right asymmetry), so that I have objective measurements not just opinions.
8. As a rower, I want detected faults categorized by severity (info / warning / critical), so that I focus on the worst issues first.
9. As a rower, I want a post-session posture replay screen, so that I can review my session video with skeleton overlay and fault annotations.
10. As a rower, I want the replay timeline aligned with my SmartRow `StrokeData`, so that I can correlate posture issues with power / split / stroke-rate dips.
11. As a rower, I want to scrub to any stroke and see the skeleton frozen at catch / finish, so that I can study my position.
12. As a rower, I want to compare a fault-heavy stroke against a clean stroke from the same session side-by-side, so that I see the contrast.
13. As a rower, I want a coaching summary at session end (top 3 issues, frequency, suggested drills), so that I leave the session with a clear next action.
14. As a rower, I want fault frequency tracked over time on the dashboard, so that I see whether my technique is actually improving.
15. As a rower, I want posture metrics surfaced inside the existing AI insights system, so that the AI can correlate posture with performance regressions.
16. As a serious user, I want to opt into the freemocap sidecar with multi-camera 3D capture, so that I get precision metrics for technical work.
17. As a serious user, I want clear setup instructions for the Python sidecar, so that I can install it without expert help.
18. As a serious user, I want browser captures and sidecar captures to share the same analysis pipeline and UI, so that the experience is consistent.
19. As a privacy-conscious user, I want all video and pose data stored locally / in my own database by default, so that my body footage is not uploaded to third parties.
20. As a privacy-conscious user, I want explicit opt-in before any pose data is sent to cloud AI, so that I control externalization.
21. As a rower, I want to delete a mocap session (video + pose + metrics) with one action, so that I can clean up storage.
22. As a rower, I want to know which past `RowingSession` rows have linked mocap data, so that I can find sessions worth reviewing.
23. As a rower, I want to attach a mocap session to an existing CSV-imported `RowingSession`, so that historical sessions can also gain video context.
24. As a rower, I want fault thresholds to be configurable (e.g., "warn me only if back angle < 15° at catch"), so that the system adapts to my body and goals.
25. As a rower, I want sensible default thresholds based on standard rowing technique references, so that I don't have to tune anything to start.
26. As a rower, I want the app to flag if camera framing degrades mid-session (occlusion, low light, person leaves frame), so that I trust the metrics.
27. As a rower, I want capture FPS, model confidence, and tracked-keypoint counts shown as quality indicators, so that I can judge whether a session's analysis is reliable.
28. As a rower, I want webcam access permission to be requested only when I start a capture, so that the app doesn't ask for camera on every page load.
29. As a rower, I want to record without analysis if I'm just collecting footage, so that I can defer analysis to later.
30. As a rower, I want re-analysis on demand (e.g., after fault rules improve), so that old sessions benefit from updated detectors.
31. As a rower, I want the existing chat/AI to answer questions about my mocap data ("why does my back round at stroke 80?"), so that posture insights are conversational.
32. As a rower, I want training plans to incorporate posture goals ("reduce early-arm-bend faults below 10%/session"), so that technique is a first-class plan dimension.
33. As a rower, I want posture-derived achievements ("100 strokes with clean catch"), so that good technique earns recognition same as PRs.
34. As a rower on a phone/tablet, I want a graceful degraded mode that records video for later replay even if live analysis is too heavy, so that mobile is still useful.
35. As a developer, I want the analysis pipeline (segment → metrics → faults) to be pure / deterministic on a frame stream, so that fixture-driven tests verify correctness.
36. As a developer, I want browser capture and freemocap sidecar to emit the same `PoseFrameStream` schema, so that downstream code is source-agnostic.

## Implementation Decisions

### Core deep modules

- **PoseCaptureSource** — interface emitting `PoseFrameStream` (timestamped keypoint frames + confidence + source-quality signals). Two implementations:
  - `BrowserPoseSource` — webcam + MediaPipe Pose (33-keypoint or BlazePose-Heavy) in browser, runs in Web Worker.
  - `FreemocapSidecarSource` — WebSocket client to local freemocap sidecar. Sidecar is a separate Python service wrapping freemocap and exposing health, session, and streaming pose APIs on localhost.
- **StrokePhaseSegmenter** — pure function: `PoseFrameStream → Stroke[]`. Each `Stroke` has phase boundaries (catch, drive-start, finish, recovery-start) and frame indices. Detection rule based on hip-knee distance / handle-position proxy / seat travel.
- **PostureMetricsCalculator** — pure function: `Stroke → PostureMetrics`. Computes: back angle at catch, back angle at finish, layback angle, shin vertical at catch, hip-knee opening offset (drive sequence), arm-bend onset frame, left-right asymmetry index, knee track deviation.
- **PostureFaultDetector** — pure function: `PostureMetrics + thresholds → PostureFault[]`. Severity levels: info / warning / critical. Rule-based v1; pluggable so ML model can replace later.
- **CoachingAdvisor** — `PostureFault[] + session history → CoachingCue[]`. Rule-based default cues; cloud AI augmentation behind existing `cloudAI` gate.
- **PostureSessionRepository** — Prisma-hidden read/write of `MocapSession`, `StrokePostureMetric`, `PostureFault`, plus byte-range access to the stored `PoseFrameStream` blob.

### Integrated modules

- `aiAnalysis.ts` — prompt context includes posture summary when mocap data is present.
- `AIInsight` generation — posture insights use the same insight pipeline and feedback model as performance insights.
- Dashboard / `analytics` — posture-fault frequency can be charted alongside performance trends.
- `trainingPlans` — optional posture goals on a `TrainingPlan`.
- `awards` — posture-derived achievement criteria.
- Chat tool surface — AI context can include mocap summaries without exposing raw pose frames.
- `RowingSession` lookup — sessions expose linked mocap markers through the `mocapSession` relation.

### Schema

- `MocapSession` — id, userId, rowingSessionId? (nullable, exclusive link to CSV session), videoStoragePath, poseStreamPath, source ("browser" / "sidecar"), captureModelVersion, capturePerspective, captureFps, calibrationCatchFrame?, calibrationFinishFrame?, calibrationId?, cameraCount?, durationSec, qualityScore, qualityFlags, status, createdAt.
- `PoseFrameStream` blob — raw frame stream stored as a binary blob on the storage backend and referenced by `MocapSession.poseStreamPath`; not stored as Postgres `PoseFrame` rows.
- `StrokePostureMetric` — id, mocapSessionId, strokeIndex, phaseBoundariesJson, metricsJson (back angle catch/finish, layback, shin-vertical, sequencing offsets, asymmetry, etc.), strokeDataId? (link to existing `StrokeData` row).
- `PostureFault` — id, mocapSessionId, strokeIndex, faultType, severity, evidenceJson (frame index + metric value + threshold), createdAt.
- `UserSettings.postureThresholds: Json?` — user-tunable rule thresholds.
- `UserSettings.mocapPreferences: Json?` — capture source default, live-cue verbosity, audio on/off.
- `UserSettings.sidecarPort: Int?` — optional local sidecar port override; defaults to `8765`.

### Architectural decisions

- **Pose source abstraction is the deep boundary.** Browser MediaPipe and freemocap sidecar both produce versioned `PoseFrameStream` blobs. All downstream analysis is source-agnostic after schema adaptation.
- **Analysis is pure.** `StrokePhaseSegmenter`, `PostureMetricsCalculator`, `PostureFaultDetector` are pure functions over data structures. No I/O, no DB. Tested with fixture frame streams.
- **Live and replay share the pipeline.** Live mode runs the same segmenter/metrics/detector incrementally as frames arrive; replay runs them on the stored stream. No duplicate logic.
- **Storage contract.** Raw pose data is stored as one binary `PoseFrameStream` blob per `MocapSession`, alongside the video file on the same storage backend (`storage/` dir or Vercel Blob in deployed env). Postgres stores the `MocapSession` row and derived rows only.
- **Sidecar contract.** freemocap sidecar is an opt-in local Python service. It communicates over localhost HTTP and WebSocket, uses `keypointSchemaVersion = 2`, and degrades cleanly when unreachable.
- **Privacy.** Video + pose data are user-scoped, never sent to cloud unless cloud-AI is explicitly enabled in `UserSettings.cloudAIEnabled`. Coaching cues by default run on local rules.
- **Frame budget.** Browser path targets ≥ 24 fps on a mid-tier laptop. Heavier work (full re-analysis, summaries) deferred to post-session. Mobile falls back to record-only when CPU is insufficient.
- **Calibration.** Browser capture stores catch + finish reference frames per `MocapSession`. Sidecar capture stores the sidecar's Charuco `calibrationId` for traceability.
- **Coordinate alignment.** Browser path = 2D side view + heuristics. Sidecar path = 3D. Metric extraction respects whichever is available; faults that require 3D are skipped on 2D path with a clear UI marker.
- **Stroke alignment with SmartRow.** When a `RowingSession` (CSV) is linked, the segmenter's stroke timeline is aligned to `StrokeData` timestamps via cross-correlation; metrics get joined to `StrokeData` rows.

### API contracts

- `POST /api/mocap/sessions` — create a mocap session for browser capture (`side-left` / `side-right`) or sidecar capture (`sidecar-3d`).
- `GET /api/mocap/sessions/:id` — full mocap detail incl. metrics + faults + frame index.
- `POST /api/mocap/sessions/:id/pose-stream` — append complete encoded pose-frame chunks to the session's `PoseFrameStream` blob.
- `GET /api/mocap/sessions/:id/pose-stream` — byte-range reads from the session's `PoseFrameStream` blob for replay and re-analysis.
- `POST /api/mocap/sessions/:id/video` — append recorded video chunks to the same storage backend.
- `POST /api/mocap/sessions/:id/finalize` — guarded finalize from `capturing`; updates duration and quality, finalizes pose stream metadata, runs `pose-segmented` analysis for analyzable captures, and returns `analysisMode`. `skipAnalysis` finalizes as `record-only`.
- `POST /api/mocap/sessions/:id/reanalyze` — guarded re-analysis with current rules; returns normalized `{ ok, analysisMode, strokeMetricCount, faultCount }`.
- `POST /api/mocap/sessions/:id/link/:rowingSessionId` — attach mocap to an existing CSV session and re-segment to `csv-aligned`.
- `POST /api/mocap/sessions/:id/unlink` — remove the CSV link and re-run `pose-segmented` analysis.
- `GET /api/mocap/sessions/:id/assignment-candidates` — list same-user `RowingSession` rows that can be linked.
- `POST /api/mocap/sessions/:id/sidecar/connect` — verify sidecar health, start the sidecar session, and persist `calibrationId` / `cameraCount`.
- `GET /api/mocap/sessions/:id/sidecar/status` — proxy sidecar health from `localhost:<port>/health`.
- `POST /api/mocap/sessions/:id/sidecar/stop` — stop the sidecar session.
- `DELETE /api/mocap/sessions/:id` — cascade delete metrics, faults, video, and pose data.
- Sidecar port is configurable through `UserSettings.sidecarPort`; the default is `8765`.

## Testing Decisions

A good test verifies external behavior of a deep module given a fixed input. It does not assert on private structure, intermediate variables, or implementation choices. The pose pipeline is uniquely well-suited because the core modules are pure functions over data.

### Modules to test

- **StrokePhaseSegmenter** — fixture: synthetic and recorded `PoseFrameStream` files representing clean strokes, missed catch, paused recovery, asymmetric drive. Assert: correct stroke count, phase boundary frame indices within tolerance.
- **PostureMetricsCalculator** — fixture: hand-labeled `Stroke` with known geometry. Assert: computed angles within ±2° of ground truth.
- **PostureFaultDetector** — fixture: `PostureMetrics` instances crafted to cross / not-cross thresholds. Assert: correct fault types and severities emitted; no false positives on clean reference.

### Modules NOT tested at unit level

- UI views (`LiveCoachingView`, `PostureReplayView`, `PostureTrendsCard`) — covered by manual QA + Playwright smoke tests for golden path.
- `BrowserPoseSource` / `FreemocapSidecarSource` — thin adapters; correctness depends on external libs / services. Smoke-test only.
- `PostureSessionRepository` — covered indirectly by API integration tests.

### Prior art

- Existing analytics tests (if present in `src/lib`) for trend computation patterns.
- Existing parser tests around `csvParser.ts` / `strokeParser.ts` style: pure-function over fixture data.

### Test fixtures

- Bundle 5–10 short pose recordings (≤ 30 s each) covering: clean rowing, early arm bend, rounded back, slow recovery, asymmetry, lost tracking. Stored as JSON `PoseFrameStream` snapshots in the test fixture directory.

## Out of Scope

- Multi-user / coach views over mocap data.
- Public sharing of mocap video or skeleton clips.
- Smartphone-only mode as primary target (mobile is degraded record-only).
- Hardware sensors (IMU on seat, force sensors on handle / footplate).
- Strava / TrainingPeaks export of posture data.
- ML-trained fault detectors (v1 is rule-based; ML pluggable later).
- On-water rowing capture.
- Real-time streaming of mocap to a remote coach.
- Custom freemocap installation flows beyond the documented Python sidecar.

## Resolved Decisions

This section reflects the current architectural contract for mocap posture analysis.

### Architecture (see `docs/adr/`)

- **ADR-0001** — raw `PoseFrameStream` is stored as one binary blob per `MocapSession` alongside the video, not as Postgres JSONB rows. The `PoseFrame` Prisma model from `### Schema additions` is dropped; replaced by `MocapSession.poseStreamPath`.
- **ADR-0002** — browser-path v1 scope used a 2D `PoseFrameStream` contract. ADR-0005 supersedes the sidecar deferral.
- **ADR-0003** — browser capture runs MediaPipe in a Web Worker and persists via HTTP chunk uploads. Server-side lifecycle execution covers finalize, reanalysis, linking, and unlinking.
- **ADR-0004** — cloud-AI mocap payload is `PostureFault` summary (tier 3) by default; per-stroke metrics (tier 2) opt-in via `UserSettings.mocapDetailedAIShare`; raw frames (tier 1) never cross to cloud.
- **ADR-0005** — freemocap sidecar uses a localhost HTTP/WebSocket contract and `PoseFrameStream` v2 with `world-mm-3d` keypoints.

### Domain terms (see `CONTEXT.md`)

`CapturePerspective`, `StrokeSegmentationSource`, `MocapSession`, `CueLatencyBand`, `PoseFrameStream`, `Calibration`, `PostureFault` (v1 catalog), `FaultThresholds`. Use these exact terms in code, issues, and UI copy.

### Locked design choices

- **Browser path is side-view only.** `side-left` or `side-right`. Front-view and depth-only metrics are `requires-multi-cam` on browser captures.
- **Capture finalization = `pose-segmented` or `record-only`.** Analyzable captures run pose-segmented analysis on finalize. Video-only captures use `analysisMode: "record-only"`.
- **Linking = `csv-aligned`.** Live SmartRow CSV streaming is not available; CSV arrives post-session. Linking a `RowingSession` to a `MocapSession` triggers mandatory atomic re-analysis to `csv-aligned`.
- **Live cues are `post-stroke`** (≤ 1 s after stroke completes), not intra-stroke. Fault detector runs at stroke granularity only.
- **Calibration is per-session, not per-user.** Two reference frames (catch, finish) captured at session start, stored on `MocapSession`.
- **Auto-link prompt** on CSV import when capture window overlaps within ±2 minutes; user always confirms, never silent. Linking is bidirectional, exclusive, reversible (`unlink` endpoint).
- **Side-view fault catalog is fixed at 5 thresholded types**: `rounded_back_at_catch`, `early_arm_bend`, `back_opens_before_legs_drive`, `excessive_layback`, `slow_recovery_ratio`.
- **Sidecar-3D fault slots are explicit**: `left_right_asymmetry`, `knee_track_deviation`, and `shin_not_vertical_at_catch` use sidecar metrics and emit `pending` severity until tuned thresholds exist.
- **Default thresholds are hand-coded and versioned** (`postureThresholdsV1`). Conservative bands. Auto-migrate on version bump unless user has set `userOverridden: true`.

### Current Ship Scope

**Available:** browser capture, record-only capture, sidecar capture, versioned `PoseFrameStream` v1/v2 storage, replay, pose-segmented analysis, CSV-aligned linking, guarded lifecycle endpoints, sidecar mock contract tests, and cloud-AI payload tiers.

**Product backlog:** side-by-side stroke comparison, richer posture trend surfaces, posture-aware training-plan and achievement workflows, and tuned thresholds for the sidecar-3D-only fault slots.

## Further Notes

- freemocap upstream is GPL-licensed Python. Sidecar runs as separate process; no GPL code is linked into Next.js app. Confirm license interaction during implementation.
- Browser MediaPipe Pose is Apache-2.0 and ships as JS package — no licensing concern.
- Deep-module boundary (`PoseFrameStream` as universal contract between capture and analysis) is the key bet — lets source change without rewriting analysis, and lets analysis evolve without touching capture. Contract reviewed and stabilized first.
- Browser path targets ≥ 24 fps on a mid-tier laptop. Live-cue delivery is post-stroke (≤ 1 s lag), not intra-stroke.
- Storage growth is dominated by video plus `PoseFrameStream` blobs on the storage backend. Retention policy (auto-purge raw pose/video after N days, keep metrics) is a likely follow-up.
