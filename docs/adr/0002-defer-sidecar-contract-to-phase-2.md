# ADR-0002: Defer freemocap sidecar contract design to Phase 2

**Status:** Accepted
**Date:** 2026-05-08
**Context owner:** mocap posture analysis (see `docs/prd-mocap-posture.md`)

## Context

The PRD names `PoseFrameStream` as "the universal contract between capture and analysis" and calls source-abstraction "the deepening play" — the architectural bet that lets the capture source change (browser webcam → freemocap sidecar) without rewriting the analysis pipeline.

The PRD's Phase 1 ships browser-only. Phase 2 ships the sidecar. But the PRD designs the sidecar contract up front: WebSocket protocol, Docker image, health-check API, versioned schema, 3D depth-bearing keypoints.

A contract designed against one real implementation and one imagined implementation is, in practice, a contract designed against the imagined one. We don't yet know:

- The exact shape of keypoints freemocap emits (count, ordering, coordinate frame, confidence semantics).
- Which fault rules actually benefit from 3D depth in practice — vs. which are answered just as well from 2D side view with calibrated heuristics.
- Whether the live coaching path even applies to multi-camera 3D capture, or whether sidecar usage is exclusively post-session technique work.

Locking those decisions now means picking guesses; widening the contract later is cheap because of ADR-0001 (the blob has a `keypointSchemaVersion` header field).

## Decision

In v1, design `PoseFrameStream` against the **browser path only**: 2D keypoints (x, y), per-keypoint confidence, source-quality flags. No depth field. No sidecar process, no WebSocket protocol, no Docker image, no health-check API.

Treat the sidecar as not-yet-existent. Phase 2 will design its contract against the realities of freemocap's actual output and the lessons of v1's fault rules — at that point, the schema version on stored blobs bumps, the reader handles both versions, and the analysis pipeline gains a 3D-aware path where it matters.

## Consequences

**Positive**

- One real implementation, no premature abstraction. The "interface" is just whatever shape `BrowserPoseSource` emits.
- Faster v1: no sidecar contract review, no Docker image, no two-process integration testing.
- Phase 2 sidecar work starts from real demand (specific fault rules that need depth) rather than a speculative interface.

**Negative**

- When Phase 2 lands, `PoseFrameStream` widens from `{x, y, conf}` to `{x, y, z?, conf}`. Versioned blob reader handles old captures; pipeline gains a depth-aware branch.
- Until Phase 2, the abstraction the PRD originally called "the deepening play" doesn't exist as such — the analysis pipeline is coupled to one source. Acceptable, because there is only one source.

**Neutral**

- Anything in the PRD's `### API contracts` section that is sidecar-specific (sidecar local URL, sidecar health-check) is out of v1 scope. The browser API (`POST /api/mocap/sessions`, `POST|GET /api/mocap/sessions/:id/pose-stream`, `POST /api/mocap/sessions/:id/video`, `POST /api/mocap/sessions/:id/finalize`, `GET /api/mocap/sessions/:id`, `POST /api/mocap/sessions/:id/reanalyze`, `POST /api/mocap/sessions/:id/link/:rowingSessionId`, `DELETE /api/mocap/sessions/:id`) stays.

## Alternatives considered

- **Lock both contracts now (the PRD's original plan).** Rejected. Single-implementation abstraction is an interface waiting for its second implementation — and the second implementation's real shape is unknown until freemocap is wired up.
- **Build a stub sidecar in v1 to validate the contract.** Rejected as scope creep — a stub doesn't surface the schema mismatches that a real freemocap integration would.
