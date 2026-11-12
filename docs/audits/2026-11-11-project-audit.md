# Project audit — 11 November 2026

What this repo does: Rowing Tracker imports SmartRow workouts, provides training history and analytics, and adds AI coaching, plans, achievements, and optional posture capture. This review assumes individual rowers sharing a hosted instance, with years of workouts per account, plus local camera sidecars.

## Scope and result

Mapped the original 450 tracked files, searched source/config/test references across the repository, and reviewed the important persistence, authentication, import, settings, storage, AI, cache, and capture flows. This was a broad audit with deeper inspection at data and security boundaries, not a claim that every line, research document, binary asset, or possible defect was exhaustively reviewed.

Changes are local on `feat/project-audit`. No deployment, live database, real SmartRow account, paid AI call, or daily-driver preview was used. No dependencies or database migrations were changed. Existing migration paths were retained because their users' old data cannot be inferred from a source scan.

## GitHub tracking

All 18 remaining findings have open `needs-triage` issues.

| Finding | Issue |
| --- | --- |
| 1 | [Account changes do not reset all browser state](https://github.com/rupertgermann/rowing-tracker/issues/122) |
| 2 | [Changing rowing data can leave linked posture analysis stale](https://github.com/rupertgermann/rowing-tracker/issues/123) |
| 3 | [Dependency advisories need reachability and upgrade triage](https://github.com/rupertgermann/rowing-tracker/issues/124) |
| 4 | [A public environment fallback can expose an operator's AI key](https://github.com/rupertgermann/rowing-tracker/issues/125) |
| 5 | [Browser calibration is required but ignored by measurement code](https://github.com/rupertgermann/rowing-tracker/issues/126) |
| 6 | [“CSV-aligned” currently means matching, not re-segmentation](https://github.com/rupertgermann/rowing-tracker/issues/127) |
| 7 | [3D projection can distort posture angles](https://github.com/rupertgermann/rowing-tracker/issues/128) |
| 8 | [Password recovery does not revoke existing JWT sessions](https://github.com/rupertgermann/rowing-tracker/issues/129) |
| 9 | [Sidecar analysis repeats a whole-recording transformation for every stroke](https://github.com/rupertgermann/rowing-tracker/issues/130) |
| 10 | [Export is not a complete backup](https://github.com/rupertgermann/rowing-tracker/issues/131) |
| 11 | [Import and capture endpoints lack a consistent validation/size contract](https://github.com/rupertgermann/rowing-tracker/issues/132) |
| 12 | [Some accepted settings are silently discarded](https://github.com/rupertgermann/rowing-tracker/issues/133) |
| 13 | [Achievement text/suggestion routes ignore saved model configuration](https://github.com/rupertgermann/rowing-tracker/issues/134) |
| 14 | [Replacing a system memory document can delete the old copy before the new one saves](https://github.com/rupertgermann/rowing-tracker/issues/135) |
| 15 | [Partial import failures still leave the active UI behind the database](https://github.com/rupertgermann/rowing-tracker/issues/136) |
| 16 | [CI does not cover most application changes](https://github.com/rupertgermann/rowing-tracker/issues/137) |
| 17 | [Registration can create an account and then report failure](https://github.com/rupertgermann/rowing-tracker/issues/138) |
| 18 | [API-backed analytics still formats dates in the server time zone](https://github.com/rupertgermann/rowing-tracker/issues/139) |

## Fixed

| Problem | Smallest change | Evidence |
| --- | --- | --- |
| Anonymous callers could run achievement AI generation or start SmartRow browser automation. | Require a session and use the existing AI/sensitive rate limiter before parsing or expensive work in all four POST routes. | `tests/auditRoutes.test.ts` checks anonymous and throttled requests before any provider/browser work. Rate limiting still depends on configured Redis. |
| A personal record could reference another account's rowing session. | Check all supplied session IDs against the authenticated owner's sessions before writing; reject non-string IDs, including Prisma-style mutation objects. | The route test checks foreign IDs, mutation objects, and an owned session. |
| Password updates and reset-token deletion could partially succeed; reset lacked throttling. | Hash first, then claim an unexpired token and change the password in one transaction. Apply the existing auth limiter. | Tests cover failed password writes, lost token claims, successful reset, reuse, and throttling. Database boundaries are mocked. |
| Failed email delivery could log a live password-reset link in production. | Remove reset-link logging and restrict the delivery warning to development. | Both missing-mail-config and failed-delivery production paths are tested. |
| Rowing deletion removed strokes separately and could fail before invalidating caches. Capture deletion never invalidated cached rowing links. | Rely on the database cascade; transactionally delete and bump the existing sessions revision. Apply the same revision update to capture deletion. | Route tests cover failed revision writes and capture-file deletion/retry. |
| The first settings save discarded most supplied fields. Invalid time-zone strings could later crash formatting. | Reuse the update field set for creation; validate the zone with `Intl.DateTimeFormat`. | First-save test checks every supplied field and rejects an invalid zone before persistence. |
| Bad CSV timestamps became a workout dated now, or impossible dates rolled forward. | Parse SmartRow UTC timestamps consistently; report malformed and rolled-over dates as row errors. | CSV tests include missing dates, invalid month/hour, 30 February, and valid timestamps. |
| Session/date labels mixed browser-local day/year with a selected-zone month/time. | Use the selected zone for every date component; remove a redundant month/year switch. | Unit tests span Berlin/Los Angeles year boundaries and all three date formats; Chromium verifies the actual session-detail header. |
| A failed later import chunk left caches containing data from before earlier committed chunks. | Invalidate session and analytics caches on HTTP/network failures too. | Two-chunk tests cover both failure types. This does not roll back earlier chunks or refresh the active store immediately. |
| Starting the sidecar twice could orphan the first capture. | Reject a second start under the existing lock. | HTTP contract test verifies 409 and that stop still refers to the original session. |
| Dead code and repository debris increased maintenance work. | Delete the unused `useAnalyticsData` hook and its exclusive helpers, unused `/api/test/settings-sync` route, two empty schema artifacts, JMeter log, tracked test result, and five unreferenced starter SVGs. Ignore generated test reports/logs. | Repository-wide reference searches plus lint, type checking, build, and existing tests. |
| Documentation overstated offline support, encrypted key storage, cloud file storage, export completeness, and capture throttling. | Correct README/environment guidance and give the partial JSON export a factual name. | Compared claims to the owning source paths. |

## Must fix or decide before relying on hosted multi-user behavior

1. **Account changes do not reset all browser state.**
   - **What this is:** Settings, AI configuration, analytics caches, and the application store outlive individual pages.
   - **Problem:** [Settings initialization](../../src/lib/settings.ts#L415) is guarded by a singleton boolean, not an account ID. [Data synchronization](../../src/hooks/useDataSync.ts) resets its own flags on logout but not that singleton or outstanding work; [analytics](../../src/hooks/useLazyAnalytics.ts#L225) displays an unowned cache before checking the server. Normal navigation logout clears matching local-storage keys, but expiry, another tab, and in-flight requests do not share a complete reset boundary.
   - **Fix / decision:** Establish one account-change boundary that clears sensitive in-memory state, cancels/discards old-account results, and scopes caches/settings initialization by user ID. Include logout, expiry, and cross-tab switching tests.
   - **If skipped:** A new account can see stale information or inherit old configuration; matching revision/count values do not establish cache ownership.

2. **Changing rowing data can leave linked posture analysis stale.**
   - **What this is:** A capture may be linked to imported rowing strokes.
   - **Problem:** [Session writes](../../src/app/api/sessions/route.ts) delete/recreate stroke rows. [Schema cascades](../../prisma/schema.prisma#L207) null the capture/session references on deletion, while computed `csv-aligned` metrics and faults survive. Clearing strokes, reimporting, or deleting a rowing session can therefore leave a ready capture displaying analysis of removed inputs.
   - **Fix / decision:** Choose explicit unlink-first behavior or coordinated reanalysis through the existing lifecycle. The deletion/cache fixes in this audit do not solve this semantic inconsistency.
   - **If skipped:** A capture can present obsolete measurements as current CSV-aligned analysis.

3. **Dependency advisories need reachability and upgrade triage.**
   - **What this is:** The installed dependency tree includes authentication, framework, database, and tooling packages.
   - **Problem:** `npm audit --json` reports **53 affected dependency nodes: 4 critical, 34 high, 15 moderate**, including transitive and development packages. These are registry classifications, not 53 demonstrated exploits. See the [captured dependency report](2026-11-11-dependencies.json). The enabled email provider uses the default normalizer, which makes the [upstream Auth.js normalization advisory](https://github.com/nextauthjs/next-auth/security/advisories/GHSA-7rqj-j65f-68wh) particularly relevant; the upstream page and npm feed differ in severity labeling.
   - **Fix / decision:** Prioritize Auth.js/Next.js and runtime dependencies, verify affected features, then upgrade compatible versions and exercise password, magic-link, OAuth, image, and database paths. Do not run a blind force-fix.
   - **If skipped:** Known affected versions remain installed; actual exploitability depends on each advisory and deployment.

4. **A public environment fallback can expose an operator's AI key.**
   - **What this is:** [AI initialization](../../src/lib/aiConfig.ts#L58) and [CloudAIService](../../src/lib/cloudAI.ts#L125) read `NEXT_PUBLIC_OPENAI_API_KEY` in browser code.
   - **Problem:** Setting that variable during a deployed build makes its value available to browser clients. This is a deployment-dependent risk; real environment values and historical bundles were not inspected. The existing [hosted-AI research decision](../research/hosted-ai-privacy-boundary.md) already calls for server-owned keys.
   - **Fix / decision:** Retire the public fallback for hosted use and implement the agreed server-owned AI path. Inspect deployment history and rotate only if a real key was exposed. The example and README no longer recommend placing a secret there.
   - **If skipped:** An operator key configured this way remains recoverable outside the authenticated UI.

5. **Browser calibration is required but ignored by measurement code.**
   - **What this is:** Capture collects catch/finish reference poses.
   - **Problem:** [PostureMetricsCalculator](../../src/lib/mocap/analysis/postureMetrics.ts#L22) explicitly ignores calibration; [server analysis](../../src/lib/mocap/sessionAnalysis.ts) does not pass it through. This conflicts with the baseline-relative comparisons described in `CONTEXT.md`.
   - **Fix / decision:** Define which metrics are calibration-relative, then implement and validate those measurements against representative recordings. Do not invent calibration mathematics as an audit cleanup.
   - **If skipped:** Users complete a calibration step that does not affect the reported measurements.

6. **“CSV-aligned” currently means matching, not re-segmentation.**
   - **What this is:** Linked analysis is advertised as deriving stroke boundaries from SmartRow ground truth.
   - **Problem:** [Linked analysis](../../src/lib/mocap/sessionAnalysis.ts#L119) computes pose-based metrics first, then attaches CSV matches/offsets and changes the segmentation label. It does not recompute boundaries or metrics from those matches.
   - **Fix / decision:** Decide whether this feature promises association or actual re-segmentation; implement the latter or rename the former consistently with the domain contract.
   - **If skipped:** The analysis label implies a stronger source of measurement than the implementation provides.

7. **3D projection can distort posture angles.**
   - **What this is:** Sidecar world coordinates are projected into a side view for angle calculations.
   - **Problem:** [Projection](../../src/lib/mocap/analysis/projection.ts#L50) scales horizontal and vertical coordinates by different whole-recording ranges. A vector with equal physical components is no longer 45 degrees when those ranges differ; an unrelated extreme frame can change all projected angles.
   - **Fix / decision:** Specify the coordinate/orientation contract and preserve geometry with a common scale or direct world-coordinate angle calculation. Validate against calibrated recordings.
   - **If skipped:** Angle thresholds can produce different faults for the same posture depending on recording bounds.

8. **Password recovery does not revoke existing JWT sessions.**
   - **What this is:** Authentication uses signed session tokens rather than a database lookup on each request.
   - **Problem:** [JWT callbacks](../../src/lib/auth.ts) retain the original token identity, while password change/reset only changes the password hash. A previously issued token remains valid afterward.
   - **Fix / decision:** Choose a revocation policy, such as a per-user session version or password-change timestamp checked during authentication; account deletion should use the same policy.
   - **If skipped:** Resetting a compromised password does not by itself remove existing authenticated sessions.

## Should fix after choosing the intended behavior

9. **Sidecar analysis repeats a whole-recording transformation for every stroke.**
   - **What this is:** [Post-session analysis](../../src/lib/mocap/analysis/postSessionAnalysis.ts#L60) calls the metrics calculator once per stroke.
   - **Problem:** Each call projects all frames again. For 54,000 frames and 600 strokes, that is roughly 32 million projected frame objects plus keypoints. This is a count from the loop structure, not a measured production latency.
   - **Fix / decision:** Project once per immutable analysis input and share the result, preserving the original 3D stream for 3D measurements. Coordinate with finding 7 to avoid optimizing incorrect geometry.
   - **If skipped:** Longer multi-camera captures waste CPU and allocation time.

10. **Export is not a complete backup.**
    - **What this is:** [Account export](../../src/app/api/user/export/route.ts) downloads JSON.
    - **Problem:** It omits Mocap sessions, pose/video files, uploaded files and portions of memory content, and drops some stored stroke fields. The misleading compliance label has been removed, but the missing data remains.
    - **Fix / decision:** Decide between a complete portable archive and a clearly scoped summary export. A full archive needs file handling and restore/version decisions.
    - **If skipped:** Deleting an account after exporting can destroy information the export cannot recover.

11. **Import and capture endpoints lack a consistent validation/size contract.**
    - **What this is:** Browser parsers send data to authenticated persistence endpoints.
    - **Problem:** [Session POST](../../src/app/api/sessions/route.ts) primarily checks for a nonempty array, so invalid numeric values can reach persistence and malformed input can become a 500. [Pose](../../src/app/api/mocap/sessions/[id]/pose-stream/route.ts) and [video](../../src/app/api/mocap/sessions/[id]/video/route.ts) buffer complete request bodies without an application byte quota; capture upload/finalize routes do not use the rate limiter. [ZIP parsing](../../src/lib/zipParser.ts) does not set an expanded-size budget.
    - **Fix / decision:** Define supported session/stroke ranges and realistic recording/import limits, validate before persistence/buffering, and use capture-appropriate throttling. Reusing the generic 30/minute upload tier without checking chunk frequency could break normal recording.
    - **If skipped:** Bad imports can produce misleading data, while oversized inputs can exhaust memory or storage.

12. **Some accepted settings are silently discarded.**
    - **What this is:** Data-management settings are sent to `/api/settings`.
    - **Problem:** [The schema](../../src/lib/validations/settings.ts) accepts `exportFormat`, `backupEnabled`, and `lastBackup`; the route does not persist them and `UserSettings` has no matching columns. The first-save fix does not add nonexistent storage fields.
    - **Fix / decision:** Decide whether these are local-only preferences, persisted behavior, or unsupported controls to remove. Match the API, UI, and schema to that decision.
    - **If skipped:** A successful save can be followed by defaults returning after reinitialization, and the backup toggle overstates behavior.

13. **Achievement text/suggestion routes ignore saved model configuration.**
    - **What this is:** Users can choose AI configuration in Settings.
    - **Problem:** [Story](../../src/app/api/achievements/story/route.ts#L35) and [suggestion](../../src/app/api/achievements/suggestions/route.ts#L110) routes call the browser-oriented `SettingsService` on the server. They do not load the authenticated user's database configuration, so they use defaults despite comments saying otherwise.
    - **Fix / decision:** Read the authenticated user's saved configuration with explicit server defaults, and decide how partial/legacy configurations are resolved.
    - **If skipped:** These AI features can use a different model/reasoning setting than the user selected.

14. **Replacing a system memory document can delete the old copy before the new one saves.**
    - **What this is:** Generated plans and insights are added to memory.
    - **Problem:** [addSystemDocument](../../src/lib/memoryStorage.ts#L144) deletes duplicates and archives active plans before issuing the create request. A failed create leaves the old document gone or the old plan archived.
    - **Fix / decision:** Move replacement/activation into a server-side operation with transaction semantics, or update an existing document and defer cleanup until success. Define duplicate identity once.
    - **If skipped:** A network or persistence failure can lose the prior memory entry.

15. **Partial import failures still leave the active UI behind the database.**
    - **What this is:** Large imports save in chunks.
    - **Problem:** [The persistence service](../../src/lib/services/rowingSessionPersistence.ts) can commit early chunks and later return failure. [Import orchestration](../../src/lib/smartrowImportPersistence.ts) only updates the active store on success. This audit clears stale caches, but it does not refresh the visible store or report the committed subset.
    - **Fix / decision:** Choose a partial-success result with committed counts/rows, or force a fresh list after any failed multi-chunk import. Preserve safe retries.
    - **If skipped:** Users can see an import failure while some workouts exist server-side until refresh.

16. **CI does not cover most application changes.**
    - **What this is:** Repository-owned automated validation runs on pull requests.
    - **Problem:** The sole [workflow](../../.github/workflows/sidecar-release.yml) is path-filtered and runs the sidecar subset. An auth/import/settings change can receive no application test, lint, type, or build check from this repository.
    - **Fix / decision:** Add a small application gate and choose its required status checks. Keep hardware tests separate.
    - **If skipped:** The focused fixes above can regress without any repository-owned merge check catching them.

17. **Registration can create an account and then report failure.**
    - **What this is:** [Registration](../../src/app/api/auth/register/route.ts) creates the user and then creates settings separately.
    - **Problem:** If the settings write fails, the account remains, the route returns 500, and retry reports that the email already exists. The settings creation also bypasses the shared application defaults.
    - **Fix / decision:** Use a nested user/settings create or transaction with the shared defaults; confirm how existing incomplete registrations should recover.
    - **If skipped:** A transient database failure can leave a confusing half-completed signup.

18. **API-backed analytics still formats dates in the server time zone.**
    - **What this is:** Analytics uses precomputed chart labels from `/api/analytics`.
    - **Problem:** [The API formatter](../../src/app/api/analytics/route.ts#L64) uses the server locale/time zone, and [the page](../../src/app/analytics/page.tsx#L638) keeps that label. A workout at 23:30 UTC on 31 December can still say “Dec 31” there while the repaired Berlin session detail correctly says 1 January.
    - **Fix / decision:** Format raw timestamps at the display boundary using current preferences, or include preferences in the server formatting and cache identity. The shared date-helper fix covers its callers, not these preformatted API labels.
    - **If skipped:** Analytics labels and session details can disagree around midnight or after changing preferences.

## Validation and limits

- Baseline: 335 tests passed; lint passed.
- Updated full suite: 351 tests passed, including sidecar package installation and synthetic HTTP/WebSocket contracts.
- Lint and isolated TypeScript check passed. The shared checkout's generated `.next` types changed during the audit, so the final type check used the isolated copy.
- Isolated production build passed using `next build --webpack`. It retains the existing `unpdf/pdfjs` dynamic-dependency warning. The default Turbopack build was not validated.
- Nine Chromium tests passed against an isolated production server on port 4317, with fake API data and an unusable test database URL. These include session detail/date formatting, chart rendering, capture/finalize failures, and replay comparison. Chromium initially could not start inside the sandbox; the authorized local rerun passed.
- `git diff --check` passed. An architect reviewed the changed code and removed-file references.
- No live database transaction/concurrency test, deployment secret review, real SMTP/OAuth/SmartRow/OpenAI call, actual camera calibration, production load test, or legal/compliance assessment was performed. Existing migration integration tests were not run against a database. The date and route tests prove the tested paths, not every browser interaction.

Lean: 423 fewer runtime source lines across `src/` and `sidecar/`; no dependencies added or removed. Tests and the review report are separate from that count.

Verdict: clear local defects are fixed and dead code reduced. Review account-state isolation, linked-analysis correctness, and runtime dependency upgrades first; the project should not be described as fully audited or free of defects.
