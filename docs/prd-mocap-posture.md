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
17. As a serious user, I want clear setup instructions for the sidecar (Docker / Python), so that I can install it without expert help.
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

### New deep modules

- **PoseCaptureSource** — interface emitting `PoseFrameStream` (timestamped keypoint frames + confidence + source-quality signals). Two implementations:
  - `BrowserPoseSource` — webcam + MediaPipe Pose (33-keypoint or BlazePose-Heavy) in browser, runs in Web Worker.
  - `FreemocapSidecarSource` — WebSocket client to local freemocap sidecar. Sidecar is a separate Python service (Docker image) wrapping freemocap, exposing a streaming pose API.
- **StrokePhaseSegmenter** — pure function: `PoseFrameStream → Stroke[]`. Each `Stroke` has phase boundaries (catch, drive-start, finish, recovery-start) and frame indices. Detection rule based on hip-knee distance / handle-position proxy / seat travel.
- **PostureMetricsCalculator** — pure function: `Stroke → PostureMetrics`. Computes: back angle at catch, back angle at finish, layback angle, shin vertical at catch, hip-knee opening offset (drive sequence), arm-bend onset frame, left-right asymmetry index, knee track deviation.
- **PostureFaultDetector** — pure function: `PostureMetrics + thresholds → PostureFault[]`. Severity levels: info / warning / critical. Rule-based v1; pluggable so ML model can replace later.
- **CoachingAdvisor** — `PostureFault[] + session history → CoachingCue[]`. Rule-based default cues; cloud AI augmentation behind existing `cloudAI` gate.
- **PostureSessionRepository** — Prisma-hidden read/write of `MocapSession`, `PoseFrame`, `StrokePostureMetric`, `PostureFault`.

### Modified modules

- `aiAnalysis.ts` — extend prompt context to include posture summary when mocap data present.
- `AIInsight` generation — new `category: "posture"` insights.
- Dashboard / `analytics` — add posture-fault-frequency-over-time card.
- `trainingPlans` — optional posture goals on a `TrainingPlan`.
- `awards` — posture-derived achievement criteria.
- Chat tool surface — expose mocap query functions to AI.
- Existing `RowingSession` lookup — surface a "has mocap" badge.

### Schema additions

- `MocapSession` — id, userId, rowingSessionId? (nullable, can attach to existing CSV session), videoStoragePath, source ("browser" / "sidecar"), captureModelVersion, captureFps, durationSec, qualityScore, status, createdAt.
- `PoseFrame` — id, mocapSessionId, frameIndex, timestampMs, keypointsJson (compact array), confidenceJson, sourceFlags. Stored raw for full replay (per user choice). Indexed by `mocapSessionId, frameIndex`.
- `StrokePostureMetric` — id, mocapSessionId, strokeIndex, phaseBoundariesJson, metricsJson (back angle catch/finish, layback, shin-vertical, sequencing offsets, asymmetry, etc.), strokeDataId? (link to existing `StrokeData` row).
- `PostureFault` — id, mocapSessionId, strokeIndex, faultType, severity, evidenceJson (frame index + metric value + threshold), createdAt.
- `UserSettings.postureThresholds: Json?` — user-tunable rule thresholds.
- `UserSettings.mocapPreferences: Json?` — capture source default, live-cue verbosity, audio on/off.

### Architectural decisions

- **Pose source abstraction is the deep boundary.** Browser MediaPipe and freemocap sidecar both produce identical `PoseFrameStream` shape. All downstream analysis is source-agnostic. This is the core deepening play.
- **Analysis is pure.** `StrokePhaseSegmenter`, `PostureMetricsCalculator`, `PostureFaultDetector` are pure functions over data structures. No I/O, no DB. Tested with fixture frame streams.
- **Live and replay share the pipeline.** Live mode runs the same segmenter/metrics/detector incrementally as frames arrive; replay runs them on the stored stream. No duplicate logic.
- **Storage contract.** Raw `PoseFrame` rows are large but enable full replay + re-analysis when rules improve. Stored in Postgres (JSONB columns); video file stored on existing storage backend (`storage/` dir or Vercel Blob in deployed env). User may purge raw frames per session if storage pressure rises (derived metrics retained).
- **Sidecar contract.** freemocap sidecar is an opt-in local Docker service. Communicates via WebSocket on localhost. Versioned schema. App degrades cleanly if sidecar is offline.
- **Privacy.** Video + pose data are user-scoped, never sent to cloud unless cloud-AI is explicitly enabled in `UserSettings.cloudAIEnabled`. Coaching cues by default run on local rules.
- **Frame budget.** Browser path targets ≥ 24 fps on a mid-tier laptop. Heavier work (full re-analysis, summaries) deferred to post-session. Mobile falls back to record-only when CPU is insufficient.
- **Calibration.** Two-pose calibration (catch + finish) at session start establishes per-user joint baselines. Stored on user profile. Re-runnable.
- **Coordinate alignment.** Browser path = 2D side view + heuristics. Sidecar path = 3D. Metric extraction respects whichever is available; faults that require 3D are skipped on 2D path with a clear UI marker.
- **Stroke alignment with SmartRow.** When a `RowingSession` (CSV) is linked, the segmenter's stroke timeline is aligned to `StrokeData` timestamps via cross-correlation; metrics get joined to `StrokeData` rows.

### API contracts

- `POST /api/mocap/sessions` — create new mocap session (browser uploads chunked video + pose stream, or sidecar streams directly).
- `GET /api/mocap/sessions/:id` — full mocap detail incl. metrics + faults + frame index.
- `POST /api/mocap/sessions/:id/reanalyze` — re-run pipeline with current rules.
- `POST /api/mocap/sessions/:id/link/:rowingSessionId` — attach mocap to existing CSV session.
- `DELETE /api/mocap/sessions/:id` — cascade delete frames, metrics, faults, video.
- WebSocket `/api/mocap/live` — live capture stream from browser; server emits incremental faults / cues.
- Sidecar local URL configurable in settings; health-check endpoint required.

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
- Custom freemocap installation flows beyond the documented Docker sidecar.

## Further Notes

- freemocap upstream is GPL-licensed Python. Sidecar runs as separate process; no GPL code is linked into Next.js app. Confirm license interaction during implementation.
- Browser MediaPipe Pose is Apache-2.0 and ships as JS package — no licensing concern.
- Phase 1 ships browser path + analysis pipeline + replay UI + dashboard widget. Phase 2 ships freemocap sidecar + 3D-aware metrics. Phase 3 ships AI-augmented cues + posture-aware training plans + posture achievements.
- Deep-module boundary (`PoseFrameStream` as universal contract between capture and analysis) is the key bet — lets source change without rewriting analysis, and lets analysis evolve without touching capture. Contract reviewed and stabilized first.
- Performance baseline must be measured early on target dev machine; if browser pipeline cannot hit 24 fps, live-cue feature ships as post-stroke (≤ 1 s lag) instead of intra-stroke.
- Storage growth: raw `PoseFrame` rows ~2–4 KB per frame × 24 fps × 30 min = ~100 MB per session worst-case. Retention policy (auto-purge raw frames after N days, keep metrics + video) is a likely follow-up.
