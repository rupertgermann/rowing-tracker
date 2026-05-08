# ADR-0004: Cloud-AI mocap payload — fault-summary by default, detailed metrics opt-in, raw frames never

**Status:** Accepted
**Date:** 2026-05-08
**Context owner:** mocap posture analysis (see `docs/prd-mocap-posture.md`)

## Context

When `UserSettings.cloudAIEnabled` is on, the existing `aiAnalysis.ts` flow sends a context payload to a third-party LLM (Anthropic/OpenAI). The mocap PRD asks for posture data to be included in that context so the AI can correlate posture with performance.

Pose data is unusually sensitive among the things this app handles. A raw `PoseFrameStream` is essentially a low-resolution biometric capture of a user's body in motion — sending it to a third-party API conflicts with the project's standing privacy posture (`prd.md` §13.4.1) even when the user has enabled cloud AI for textual training data.

But "cloud AI off entirely for mocap" loses the feature's biggest payoff: the LLM correlating posture faults with power/pace dips and giving narrative coaching.

There are three plausible payload tiers:

1. **Raw `PoseFrameStream`** — keypoints over time. Biometric. Also useless to a text LLM, which can't reason over keypoint arrays.
2. **`StrokePostureMetric` rows** — angles, offsets, asymmetry numbers per stroke. Numeric, geometric, not directly biometric, but reconstructs a coarse body model.
3. **`PostureFault` summary** — fault counts by type, severity, phase, plus session-level quality flags. Most compressed; most LLM-friendly; shares no body geometry.

## Decision

Three tiers, three policies:

- **Tier 1 (raw frames):** never sent to cloud AI. No flag, no opt-in. Hard wall.
- **Tier 3 (fault summary):** sent when `cloudAIEnabled` is true. This is the default mocap → cloud-AI payload.
- **Tier 2 (per-stroke metrics):** sent only when both `cloudAIEnabled` AND a new `UserSettings.mocapDetailedAIShare` flag are true. Off by default.

The fault-summary contract (tier 3) is fixed:

```
Mocap summary:
- Faults: <fault_type> (<count>, severity=<level>) ...
- Quality: <tracked_frames_pct>% tracked, <perspective>, <fps>fps
- Strokes analyzed: <n>
```

No keypoints, no per-frame data, no per-stroke geometry, no video. Future fault types extend this format; the contract stays additive.

## Consequences

**Positive**

- Default cloud-AI behaviour preserves user privacy: aggregate fault counts share *no* reconstructable body geometry.
- Power-user "share more for better insights" is one explicit toggle away — clear consent path, not buried in cloud-AI's general flag.
- The LLM gets enough signal from tier 3 to write useful coaching ("you had 12 rounded-back faults at catch — work on lat engagement before the drive") without ever holding biometric data.
- Hard wall on tier 1 means no future bug or refactor can accidentally leak raw pose data — the code path doesn't exist.

**Negative**

- Two flags (`cloudAIEnabled`, `mocapDetailedAIShare`) instead of one. Slightly more UX surface in settings.
- Tier 3 may not be enough for the most fine-grained AI queries ("why did my back round more on stroke 80 specifically?"). Those queries require tier 2 — user opts in or the answer stays generic.

**Neutral**

- Existing `cloudAI.ts` and `aiAnalysis.ts` get a new context-builder for mocap that materialises only tier 3 by default; tier 2 enrichment is gated and additive.

## Alternatives considered

- **Single flag covering both tier 2 and tier 3.** Rejected: collapses two distinct privacy decisions ("share that I had faults" vs "share my exact body geometry") into one toggle that users can't reason about.
- **No detailed share at all (tier 3 only, ever).** Rejected: forecloses the per-stroke AI query feature without user input. The opt-in pathway preserves it for users who want it.
- **Anonymise tier 2 by removing identifying joint configuration.** Rejected: the data being shared *is* joint geometry. Anonymising it would mean removing the signal that makes it useful.
