# ADR-0003: Run the analysis pipeline in the browser; server is dumb storage in live mode

**Status:** Accepted
**Date:** 2026-05-08
**Context owner:** mocap posture analysis (see `docs/prd-mocap-posture.md`)

## Context

The mocap pipeline has two consumer paths:

- **Live capture** — pose inference at ~24 fps, stroke segmentation, per-stroke metrics, fault detection, coaching cues delivered with `post-stroke` latency (≤1 s after stroke end; see `CueLatencyBand` in CONTEXT.md).
- **Post-session re-analysis** — same pipeline rerun on stored frames after a `RowingSession` is linked, or after fault rules are updated.

The PRD draft proposed a `WebSocket /api/mocap/live` where the server "emits incremental faults / cues." That implies server-side analysis during capture. Two issues:

1. Round-tripping pose frames to a server adds tens to hundreds of milliseconds of network latency per stroke window, blowing the post-stroke budget.
2. The server has no information the client doesn't — pose frames originate in the browser, and analysis is pure functions over those frames. There's nothing for the server to compute that the client can't.

The PRD also commits to a privacy stance: "all video and pose data stored locally / in my own database by default … explicit opt-in before any pose data is sent to cloud AI." Server-side live analysis routes pose data through the server unconditionally, conflicting with that stance for users who would otherwise capture and view locally.

## Decision

Run the full analysis pipeline (segmenter, metrics calculator, fault detector, coaching advisor) **in the browser** during live capture. The pipeline is implemented as pure functions over `PoseFrameStream`, with no I/O, no DB calls, and no server dependency.

Pose inference runs in a **Web Worker with OffscreenCanvas** using MediaPipe Tasks (WASM build). WebGPU acceleration is future-opt-in, not v1 default.

Live persistence uses short HTTP chunk uploads, not a long-lived WebSocket:

- `POST /api/mocap/sessions/:id/pose-stream` appends whole encoded `PoseFrameStream` frames to the pose blob.
- `POST /api/mocap/sessions/:id/video` appends `MediaRecorder` video chunks to the video blob.
- `POST /api/mocap/sessions/:id/finalize` patches the pose header `frameCount` and flips the session from `capturing` to `ready`.

The server does not run the analysis pipeline during live capture and does not emit faults or cues over the upload transport.

The same pipeline code runs server-side on demand for **re-analysis** — `POST /api/mocap/sessions/:id/reanalyze` reads the blob, runs the pure pipeline, rewrites derived rows. That's the only server-side execution path.

## Consequences

**Positive**

- Live `post-stroke` latency budget is achievable — no network round trip for analysis.
- Privacy posture matches the PRD: faults and cues are computed locally; pose data only leaves the browser when the user has opted into persistence (and never reaches a third-party AI service unless `cloudAIEnabled` is set).
- The pipeline is one codebase. Pure functions over data structures are portable: same code runs in a Web Worker live and on a Vercel Function for re-analysis.
- If a user denies upload permission or the network drops, live coaching keeps working — the browser has everything it needs.
- HTTP chunk uploads fit the Vercel deployment target without introducing a third-party socket provider. Chunks are independently retriable, and finalize can validate that only complete pose frames reached storage.

**Negative**

- Bundle size grows by the size of the analysis pipeline (segmenter, metrics, fault detector, default thresholds, coaching cue text). Mitigated by: pipeline is pure logic, no large model weights; lazy-loaded on the mocap route, not the dashboard.
- Re-analysis on the server requires a runtime that can execute the same TypeScript modules. Vercel Functions on Node.js handle this; no isomorphic concerns for pure code.
- The upload transport is less "live" than a persistent socket. v1 does not need server-to-client capture messages because live cues are computed in-browser.
- If the pipeline ever needs heavy compute (ML model inference for fault detection — explicitly out of v1 scope per PRD), the browser path becomes constrained. At that point, this decision can be revisited for the heavy-compute branch only; the rule-based v1 path stays browser-side.

**Neutral**

- The PRD's `CoachingAdvisor` cloud-AI augmentation (behind `cloudAIEnabled`) is unaffected: that's an opt-in, post-session enrichment that already routes through existing `cloudAI.ts` infrastructure.

## Alternatives considered

- **Server-side analysis with live WebSocket fault stream (the PRD's draft).** Rejected for the latency and privacy reasons above.
- **Persistence-only WebSocket (`/api/mocap/live`).** Rejected for v1 because the deployment target does not provide arbitrary long-lived WebSocket handling without another provider, and the server has no live messages to send back.
- **Hybrid: client computes, server validates.** Rejected as duplicate work — server has nothing to validate against. The client's frames are ground truth.
- **Pose inference on the server (upload video, server runs MediaPipe).** Rejected: kills live latency, defeats the local-first privacy stance, and adds GPU/CPU server cost for compute the client can do.
