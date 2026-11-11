# Audit remediation: 2026-11-11

[Index](index.md) · [Implementation spec](https://github.com/rupertgermann/rowing-tracker/issues/140) · [Domain glossary](../../CONTEXT.md)

## Scope and source history

On 2026-11-11, Rupert approved implementing the existing 18 audit tickets, this `docs/wiki/` location, and validation through existing public service/route seams, isolated browser flows, disposable PostgreSQL, and synthetic-key builds. The [parent spec](https://github.com/rupertgermann/rowing-tracker/issues/140) records the accepted behavior and tests; the linked tickets retain their detailed acceptance criteria. This record does not create a second ticket breakdown.

The audit cites [rupertgermann/rowing-tracker@ac37858](https://github.com/rupertgermann/rowing-tracker/commit/ac378582e7298ec57a9a16e650a60326e0e362ca). Implementation started from `rupertgermann/rowing-tracker@eb26493`, preserving earlier local audit fixes, on the isolated `feat/audit-remediation` integration branch. The original checkout, production, live databases, and daily-driver preview/build channels were outside the authorized mutation scope.

## Decisions recorded on 2026-11-11

- Account-generation ownership precedes partial-import UI reconciliation and preference-aware analytics. Stale asynchronous results must not repopulate another account's state, even when counts/revisions match.
- Linked RowingSession replacement, stroke clearing, and deletion use a transactional unlink-first HTTP 409 guard. Existing lifecycle re-analysis owns unlinking; obsolete CSV-derived measurements must not survive input deletion.
- Posture work proceeds geometry → projection reuse → calibration → actual CSV catch-window re-segmentation. StrokeData lacks phase durations, so finish timing comes from pose evidence. Stored labels, UI, and domain wording must distinguish that mixed provenance. Raw world coordinates and unsupported/low-confidence states remain meaningful.
- Password revocation uses a database-backed per-user session version, followed by atomic registration with shared initial settings defaults.
- Operator AI secrets belong on the server. Hosted prerequisites fail closed; per-user achievement configuration follows that boundary. The [hosted-AI decision](../research/hosted-ai-privacy-boundary.md) remains the source for prerequisites, not evidence of a completed CommercialBeta launch.
- Export means an explicitly limited summary, not a portable backup. Unsupported export/backup settings are removed. System-memory replacement/activation becomes atomic and idempotent. Import/capture validation gets bounded input, expanded-ZIP, recording, and request-rate contracts.
- Compatible dependency fixes start early. Application CI lands after integration; intended required checks are documented without changing repository protection.

These decisions respect the [binary blob](../adr/0001-pose-frame-stream-as-binary-blob.md), [browser analysis](../adr/0003-browser-side-analysis-pipeline.md), [AI payload tiers](../adr/0004-cloud-ai-mocap-payload-tiers.md), and [sidecar contract](../adr/0005-freemocap-sidecar-contract.md) ADRs as read at baseline `eb26493`. CommercialBeta still excludes Mocap/FreeMoCap in that baseline's domain contract; fixing existing posture workflows does not expand that beta.

## Initial task graph and status snapshot

GitHub reported all 18 tickets OPEN on 2026-11-11 when the parent spec was published. “Open” below records that snapshot, not a claim that implementation has not subsequently started. Completion evidence is appended below rather than rewriting history.

| Ticket | Blocked by | 2026-11-11 publication snapshot |
|---|---|---|
| [#122 Account isolation](https://github.com/rupertgermann/rowing-tracker/issues/122) | None | Open |
| [#123 Linked-data integrity](https://github.com/rupertgermann/rowing-tracker/issues/123) | None | Open |
| [#124 Dependency remediation](https://github.com/rupertgermann/rowing-tracker/issues/124) | None; early priority | Open |
| [#125 Server-owned AI secrets](https://github.com/rupertgermann/rowing-tracker/issues/125) | None | Open |
| [#126 Calibration](https://github.com/rupertgermann/rowing-tracker/issues/126) | #130 | Open |
| [#127 CSV re-segmentation](https://github.com/rupertgermann/rowing-tracker/issues/127) | #126 | Open |
| [#128 Projection geometry](https://github.com/rupertgermann/rowing-tracker/issues/128) | None | Open |
| [#129 Session revocation](https://github.com/rupertgermann/rowing-tracker/issues/129) | None | Open |
| [#130 Projection reuse](https://github.com/rupertgermann/rowing-tracker/issues/130) | #128 | Open |
| [#131 Summary export](https://github.com/rupertgermann/rowing-tracker/issues/131) | None | Open |
| [#132 Validation and quotas](https://github.com/rupertgermann/rowing-tracker/issues/132) | None | Open |
| [#133 Unsupported settings](https://github.com/rupertgermann/rowing-tracker/issues/133) | None | Open |
| [#134 User AI configuration](https://github.com/rupertgermann/rowing-tracker/issues/134) | #125 | Open |
| [#135 Atomic memory replacement](https://github.com/rupertgermann/rowing-tracker/issues/135) | None | Open |
| [#136 Partial import UI](https://github.com/rupertgermann/rowing-tracker/issues/136) | #122 | Open |
| [#137 Application CI](https://github.com/rupertgermann/rowing-tracker/issues/137) | #122–#136, #138, #139 | Open |
| [#138 Atomic registration](https://github.com/rupertgermann/rowing-tracker/issues/138) | #129 | Open |
| [#139 Analytics timestamps](https://github.com/rupertgermann/rowing-tracker/issues/139) | #122 | Open |

## Verification and implementation evidence

On 2026-11-11, the coordinator reported `npm test` at `rupertgermann/rowing-tracker@eb26493`: **351 passed, 0 failed**, comprising 285 top-level tests and 21 suites. This established a baseline, not completion of the findings. The local run log was `/tmp/rowing-audit-implementation/baseline-tests.log`; that temporary pointer is supporting session evidence, not a durable repository artifact.

On 2026-11-11, the coordinator reported [#128](https://github.com/rupertgermann/rowing-tracker/issues/128) implemented at `rupertgermann/rowing-tracker@b27b165`, with **13 focused tests passing**, pending final review. Later on 2026-11-11, integration merge `rupertgermann/rowing-tracker@1756946` included that implementation. Final review and real-recording qualification remained outstanding.

The 2026-11-11 validation plan used a disposable PostgreSQL 16 instance, isolated browser servers, controlled provider responses, and synthetic build keys. Route/service behavior and exact user-visible paths must be exercised; transactional failure and concurrency checks need disposable database evidence. Summary-export categories and all three unsupported settings require explicit mechanical coverage.

**Qualification limit recorded on 2026-11-11:** known-angle fixtures, reference poses, offset strokes, and long synthetic captures can establish algorithmic behavior and bounded projection work. They do not establish real-camera accuracy, calibrated-recording validity, or coaching efficacy. Real-recording qualification must remain an explicit outstanding item until actual evidence exists. Production deployment, secret-history inspection/rotation, and repository-protection changes require separate authorization.

## Continuing this record

Append a dated entry for each completed ticket with its repository commit, public behavior tested, commands/results, and remaining limits. Mark an earlier decision superseded when a later approved decision replaces it. Reconcile all 18 tickets before declaring the remediation complete; code completion and real-recording qualification are separate claims.
