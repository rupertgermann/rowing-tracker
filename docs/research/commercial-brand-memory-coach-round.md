# Commercial brand screening — memory-coach round

**Issue:** [#94 — Choose a distinctive commercial brand](https://github.com/rupertgermann/rowing-tracker/issues/94)

**Research window:** 2026-08-09, approximately 22:27–22:44 CEST

**Status:** preliminary product/name screen only — **WIPO UNKNOWN, Legal HOLD, no legal clearance**

> **Superseded recommendation:** Memorow was subsequently [rejected](memorow-brand-clearance.md) and is no longer an active candidate. The ranking and prototype recommendation below are retained as historical evidence. No product name has been selected.

> **Source snapshot:** Implementation links refer to pre-audit revision [`169bdba`](https://github.com/rupertgermann/rowing-tracker/tree/169bdba95944b96624295a77fdeba6c3840ed907), preserving the historical source anchors rather than describing current runtime behavior.

## Outcome

This round advances exactly five new candidates, in this order:

1. **Memorow**
2. **RowTuned**
3. **RowerEcho**
4. **RowMentor**
5. **PaceThread**

The maximum two new private prototype recommendations are **Memorow** and **RowTuned**, compared directly with the existing **CoachRecall benchmark**. CoachRecall is not a finalist in this round and is not a chosen brand. The comparison tests three materially different hypotheses: explicit memory plus rowing, rowing-specific personalization, and explicit coach-memory continuity.

All five new names remain **Legal HOLD**. No candidate is approved for public use, sale, trademark filing, domain purchase, handle reservation, developer-name reservation, or app submission. Register zeroes, absent identical store titles, and RDAP 404 responses are time-limited technical observations, never clearance or availability.

## Product truth and naming boundary

The product kernel is broader than workout analytics. The README describes conversation history and selected documents, tools that retrieve sessions/achievements/memory documents, personalized multi-week plans, automated insights, and Personal Context across coach/plans/insights ([README](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/README.md#L15-L23)). Source-backed limits from the prior AI-coach round remain binding:

- Chat continuity is persisted conversation data, not autonomous learning or perfect lifelong memory. Only the last ten conversation messages are replayed in the inspected request path ([`cloudAI.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/cloudAI.ts#L302-L309)).
- The active coach can retrieve sessions, memory documents, and achievements through real tool calls ([`cloudAI.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/cloudAI.ts#L180-L299), [`cloudAI.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/cloudAI.ts#L677-L866)).
- Personal Context can combine selected document text with free text and is injected into chat, insights, and plans ([`settings/page.tsx`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/app/settings/page.tsx#L2550-L2681), [`cloudAI.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/cloudAI.ts#L1121-L1150), [`cloudAI.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/cloudAI.ts#L1676-L1683)).
- Personalized plans and automated/local plus cloud insights are implemented ([`cloudAI.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/cloudAI.ts#L1395-L1438), [`useAIInsights.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/hooks/useAIInsights.ts#L65-L97)).
- `chatSystemPrompt` is stored/editable while the inspected active `getChatSystemPrompt()` remains hard-coded. A name or descriptor must not imply that every prompt is configurable ([`settings.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/settings.ts#L132-L159), [`cloudAI.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/cloudAI.ts#L873-L998)).
- Health information, including COPD, may constrain training context only. The product must not imply detection, diagnosis, treatment, therapy, pulmonary rehabilitation, medical monitoring, or guaranteed safety. A verified non-medical refusal/guardrail remains a launch gate, not an assumed runtime property.
- Motion capture is optional context, not the brand core. A viable name must still cover coach continuity, documents, plans, insights, and retrieval without mocap.

## Historical exclusion gate

No exact name from an earlier round was reactivated. CoachRecall appears only as the required benchmark. The complete recorded families are excluded as follows:

| Earlier source | Excluded exact names |
|---|---|
| [Initial commercial screen](./commercial-brand-name-screening.md) | `PaceHelm`, `Ruderlotse`, `Rowerly`, `Oarbit`, `Rowloom`, `PullPilot`, `Splitcraft`, `StrokePilot`, `NextStroke` |
| [Round three](./commercial-brand-round-three.md) | `TempoRoot`, `SteadyWake`, `TraceTide`, `PaceMosaic`, `Kineweave`, `QuietMettle`, `KindPace`, `MotionLore`, `SessionAtlas`, `OwnCourse`, `CourseArc`, `OwnArc`, `Tideframe`, `MorrowArc`, `ErgWeave`, `CourseWeave`, `Cadentra`, `ClearWake`, `PaceLeaf`, `OarLume`, `FormWake`, `RowAware` |
| [AI-coach round](./commercial-brand-ai-coach-round.md) | `TempoSage`, `CoachRecall`, `ContextSage`, `RecallRhythm`, `CoachContextAI`, `PromptCurrent`, `ContextLedger`, `MemoryWeft`, `CoachLore`, `PaceMind`, `ContextCox`, `Mnemocox`, `SignalCox`, `PromptCox`, `InsightCox`, `SenseLedger`, `MemoryDraft`, `RecallDraft`, `CounselCurrent`, `ContextCurrent`, `MemoryCurrent`, `RecallCurrent`, `PlanCurrent`, `PromptCrew`, `MemoryCrew`, `RecallCrew`, `ContextCrew`, `MindCrew`, `InsightCrew`, `PromptCairn`, `RecallCairn`, `ContextCairn`, `MemoryCairn`, `SenseWeft`, `Mnemoraft`, `ContextChime`, `PaceSage`, `ProgressSage`, `EffortSage`, `WorkoutSage`, `RecallMentor`, `SenseDraft`, `CoachSignal`, `CoachTide` |
| [RowAware clearance](./rowaware-brand-clearance.md) and [RowingSage precheck](./rowingsage-brand-precheck.md) | `RowAware`, `RowingSage`; the entire new `…Sage` family remains excluded because current `Sage` AI/fitness-coach use weakened both `RowingSage` and `TempoSage` |
| Earlier P33 / round-three scouting-only record | `PaceWeave`, `Coxfolio`, `Coxora`, `Effortune`, `TempoSage AI`, `PaceAI`, `TempoAI`, `PacePersona`, `CoachPersona`, `OarAI`, `CoxAI` |
| Earlier P33 scouting record | `CoachThread` — historical HOLD candidate; `.com` registered and adjacent current AI-dating-coach use. It cannot become a new finalist here. |

This is an exact-name history gate, not a claim that every shared word is legally unavailable. The whole `Sage` construction family is the deliberate broader exception and was not used for generation.

## Generation pool — 45 fresh hypotheses in four families

The 45 exact hypotheses below were generated after the history gate. Five survived; 40 were rejected before or during formal screening.

| Family | New exact hypotheses | Count | Filter outcome |
|---|---|---:|---|
| **Remembered coach / carried context** | `Memorow`, `CoachAttuned`, `CoachArchive`, `CoachMemento`, `CoachContinuum`, `CoachHistory`, `MemoryHelm`, `CoachKeepsake`, `CoachRecord`, `CoachCarry`, `RecallGuide` | 11 | `Memorow` final. `CoachAttuned` rejected on current near-field use; the rest were more generic, awkward, overpromising, or weaker in the unguided five-second test. |
| **Rowing-specific personalization** | `RowTuned`, `RowTune`, `RowerTuned`, `PaceTuned`, `OarTuned`, `RowAttuned`, `RowerAttuned`, `OarAttuned`, `PaceAttuned`, `RowGuide`, `RowerGuide`, `OarGuide`, `PaceGuide` | 13 | `RowTuned` final. Alternatives were more imperative, more generic/descriptive, less natural in DE/EN, or carried stronger component/domain friction. |
| **Continuity thread / historical echo** | `RowerEcho`, `PaceThread`, `OarThread`, `RowerThread`, `PlanThread`, `SessionThread`, `TrainingThread`, `TempoThread`, `PaceEcho`, `OarEcho`, `RowEcho`, `PlanEcho`, `SessionEcho`, `TrainingEcho` | 14 | `RowerEcho` and `PaceThread` final. `SessionThread` is established SDK/programming terminology; the remaining forms were colder, less rowing-specific, or less immediately meaningful. |
| **Mentor / reflective mind** | `RowMentor`, `OarMind`, `OarMentor`, `RowerMentor`, `PaceMentor`, `MemoryOar`, `MemoryPace` | 7 | `RowMentor` final. `OarMind` and `OarMentor` were less clear in five seconds; the remaining names were less natural or more descriptive. |
| **Total** | **45 fresh exact hypotheses** | **45** | **5 finalists + 40 rejects.** |

The additional seeds `RowerMind`, `MemoRow`, `PaceMirror`, and `CoachThread` were evaluated but not counted as fresh hypotheses: `RowerMind` and `CoachThread` had existing use/history, `PaceMirror` had an exact product collision, and `MemoRow` was treated as a spelling/control variant of `Memorow`, not a second candidate.

## Reject ledger and material collisions

| Name / group | Primary-source or direct evidence | Decision |
|---|---|---|
| **RowerMind** | The founder's [first-party biography](https://www.gizemtoska.com/hakkimda) states that she developed `RowerMind` psychological training; the use combines rowing, mindfulness, and psychological education. | **HARD REJECT** — exact rowing/well-being/coaching-adjacent use. |
| **PaceMirror** | Current retailer product pages offer the exact phrase [`mo.view pace mirror`](https://www.louis-moto.com/en/motogadget-mo-view-pace-mirror-glassless-1-piece-10040862) as a motorcycle bar-end mirror. | **HARD REJECT** — avoid an established exact product phrase and severe search noise. |
| **CoachThread** | Historical P33 candidate, not fresh. Existing `.com` registration and current adjacent AI-dating-coach “coach thread” use were already recorded. | **HISTORY REJECT** — cannot be silently recycled. |
| **SessionThread** | The official project documentation exposes a literal [`SessionThread` class](https://www.brics.dk/JWIG/doc-public/dk/brics/jwig/SessionThread.html); the term also recurs across SDK/thread APIs. | **REJECT** — technical class name, cold semantics, severe search noise. |
| **CoachAttuned** | [Attuned TalkCoach](https://www.attuned.ai/ai-coach-for-managers/) is a current personalized AI coach grounded in member profiles, motivator data, and trends; [Attuned Coaching](https://www.attunedcoaching.com/) offers personalized wellness-coaching plans. | **REJECT** — almost the same “coach tuned to personal data” concept even without an exact compact-title hit. |
| **RowTune** | Semantically cleaner as noun/imperative, but [`rowtune.com`](https://rdap.verisign.com/com/v1/domain/rowtune.com) returned an RDAP object while `RowTuned` did not in this snapshot. It also says less clearly “already adapted to you.” | **REJECT in favour of RowTuned**; domain state alone is not a legal conclusion. |
| **OarMind / OarMentor** | No material same-field exact hit was established in the limited first-party run, but both require explanation in German and neither carries the product's memory/continuity kernel clearly. | **SEMANTIC REJECT** — formal nulls do not rescue weak five-second meaning. |
| **Entire Sage family** | Current [`Sage: AI Fitness Coach`](https://apps.apple.com/ca/app/sage-ai-fitness-coach/id6777168646) and [`Sage AI - AI Coach & Assistant`](https://play.google.com/store/apps/details?id=io.mondayhero.sageai&hl=en-US) use `Sage` for personal AI/fitness coaching and plans. | **FAMILY REJECT / REVIEW** — no new `Sage` construction enters this round. |

## Exactly five finalists — semantic ranking

Scores are product judgments from 1 (weak) to 5 (strong), not legal scores.

| Rank | Candidate | Five-second hypothesis | Coach clarity | Memory / continuity | Rowing clarity | DE/EN speech | Distinctiveness | Total / 25 | Decision |
|---:|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | **Memorow** | “My rowing history is remembered and used.” | 3 | 5 | 5 | 4 | 5 | **22** | **PROTOTYPE #1**; strongest compact synthesis, but pun comprehension and pronunciation must be tested. |
| 2 | **RowTuned** | “Rowing guidance tuned to me.” | 4 | 3 | 5 | 5 | 4 | **21** | **PROTOTYPE #2**; strongest immediate personalization/rowing signal, but memory and AI are implicit. |
| 3 | **RowerEcho** | “My earlier rowing work echoes into today's advice.” | 3 | 4 | 5 | 4 | 4 | **20** | HOLD challenger; `echo` may imply repetition rather than adaptation. |
| 4 | **RowMentor** | “A mentor for rowing.” | 5 | 2 | 5 | 5 | 2 | **19** | HOLD control for plain clarity; highly descriptive and memory-poor. |
| 5 | **PaceThread** | “A continuous thread across training and pace.” | 3 | 4 | 3 | 4 | 4 | **18** | HOLD; continuity is present, but rowing and personal coach meaning are not immediate. |

### DE/EN speech and unguided five-second risks

| Candidate | Intended / likely English | Likely German | Five-second failure to test |
|---|---|---|---|
| **Memorow** | Ambiguous between “MEM-oh-row” and “MEM-uh-row” | likely “Me-mo-roh” | The coinage may not resolve into memory + rowing, or may sound like a memo/table-row tool. Pronunciation is not locked before testing. |
| **RowTuned** | “row tuned” (`row` as `/roʊ/`) | “Rou-tjuhnd” | May sound like equipment or music tuning rather than a personalized coach; English `row` also has the unrelated `/raʊ/` reading. |
| **RowerEcho** | “ROH-er echo” | “Rou-er-Ecko” | Fairly speakable, but `echo` may imply repetition, voice/audio, or a device rather than reflective adaptation. |
| **RowMentor** | “row mentor” | “Rou-Mentor” | Immediately understandable but strongly descriptive; says neither AI nor memory and may imply a human coach. |
| **PaceThread** | “pace thread” | “Pejs-Thred” | German speakers may avoid or vary the `th`; the phrase may read as a social/software thread and does not identify rowing in five seconds. |

### Benchmark: CoachRecall

`CoachRecall` remains the non-finalist benchmark because it states both the relationship and retrieval/continuity most directly. Its weaknesses also remain: reversed/unnatural English word order for some speakers, a study/test or product-recall association, no rowing cue, and likely weak/descriptive components. No prior agent recommendation for it has been human-accepted.

The private comparison should ask, without explanation, what each name does after five seconds, how participants pronounce it in German and English, whether it sounds like a human or AI coach, what they think is remembered, whether “memory” feels useful or surveillant, and whether any name sounds medical. A descriptor may be shown only after the unprompted answer.

## Official trademark-register snapshot

### Method and hard limits

- **EUIPO eSearch plus:** compact and spaced forms were inspected as visible Basic Search results. The URL reproduces query intent; the word after `#` is client-side and cannot be validated with curl. “Exact” below means exact query spelling, not a legal exact-match operator. Because an earlier run observed a transient false zero for `SMARTROW`, every zero remains a fragile UI snapshot.
- **DPMAregister Expert Search:** Expert Search was used because four Nice classes were required. Databases `DE`, `EM`, and `IR` were included. Exact template: `(DB=DE OR DB=EM OR DB=IR) AND (MARKE="NAME") AND (KL=9 OR KL=41 OR KL=42 OR KL=44)`. Variant template used `WORD1?WORD2`; the official field help says `?` can represent zero, one, or multiple characters.
- Classes 9, 41, 42, and 44 are research anchors for software, sport/training, SaaS/software services, and possible health-service proximity. They are not a final goods/services strategy. The [Nice Classification 2026](https://nclpub.wipo.int/esen/pdf-download.pdf?dateInForce=20260101&lang=en&tab=class_headings) and counsel must govern any filing.

| Candidate | EUIPO compact | EUIPO spaced | DPMA exact, DE/EM/IR, 9/41/42/44 | DPMA wildcard, same scope |
|---|---|---|---|---|
| **Memorow** | [`MEMOROW`: 0](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/MEMOROW) | [`MEMO ROW`: 0](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/MEMO%20ROW) | `MARKE="MEMOROW"` — no hits | `MARKE="MEMO?ROW"` — no hits |
| **RowTuned** | [`ROWTUNED`: 0](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/ROWTUNED) | [`ROW TUNED`: 0](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/ROW%20TUNED) | `MARKE="ROWTUNED"` — no hits | `MARKE="ROW?TUNED"` — no hits |
| **RowerEcho** | [`ROWERECHO`: 0](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/ROWERECHO) | [`ROWER ECHO`: 0](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/ROWER%20ECHO) | `MARKE="ROWERECHO"` — no hits | `MARKE="ROWER?ECHO"` — no hits |
| **RowMentor** | [`ROWMENTOR`: 0](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/ROWMENTOR) | [`ROW MENTOR`: 0](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/ROW%20MENTOR) | `MARKE="ROWMENTOR"` — no hits | `MARKE="ROW?MENTOR"` — no hits |
| **PaceThread** | [`PACETHREAD`: 0](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/PACETHREAD) | [`PACE THREAD`: 0](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/PACE%20THREAD) | `MARKE="PACETHREAD"` — no hits | `MARKE="PACE?THREAD"` — no hits |

The visible responses were observed on 2026-08-09 during the research window. They are not similarity searches. A future reviewer who cannot reproduce them must record **UNKNOWN**, not inherit the zero.

### WIPO/Madrid — UNKNOWN

The [WIPO Global Brand Database](https://www.wipo.int/en/web/global-brand-database) was not automated. Its [terms](https://www.wipo.int/en/web/global-brand-database/terms_and_conditions) and [FAQ](https://www.wipo.int/en/web/global-brand-database/faqs_branddb) restrict automated querying and scraping. No challenge was bypassed and no WIPO zero is claimed. The WIPO/Madrid status for all five, their spaced/hyphenated forms, phonetic/conceptual neighbours, and relevant components is **UNKNOWN** pending a compliant professional search.

## Current first-party market and near-field check

No active first-party Rowing/Fitness/AI-coach product using any of the five exact compact or spaced titles was established in this limited run. That is not proof of non-use. Companies, trade names, unregistered use, removed apps, social accounts, package names, other jurisdictions, and non-indexed products remain open.

The same field is demonstrably dense:

- [RowIQ](https://www.rowiqapp.com/) markets rowing readiness, plans, an AI coach, and insights; its [`RowIQLive` App Store listing](https://apps.apple.com/us/app/rowiqlive/id6761737498) is current.
- [StrokeIQ](https://www.strokeiq.app/) positions itself as AI-assisted rowing analysis and coaching.
- [RowHero](https://rowhero.com/) offers live erg data, stroke analysis, feedback, and training management.
- [Attuned TalkCoach](https://www.attuned.ai/ai-coach-for-managers/) shows that the adjacent “personal data + tailored AI coach + specific next move” concept is already actively marketed outside sport.

These are not close-mark findings against the five finalists. They are evidence that generic `Row…`, `Coach`, `Mentor`, `Pace`, memory, and personalization language cannot be assumed ownable or searchable without professional analysis.

## Apple App Store snapshot — compact and spaced, DE and US

Apple's official [Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html) was queried with `entity=software&limit=200`. Actual `trackName` values were inspected; fuzzy `resultCount` was not treated as an identity result.

| Candidate | DE compact / spaced | US compact / spaced | Representative returned `trackName` values | Exact-title result |
|---|---:|---:|---|---|
| **Memorow** | [compact](https://itunes.apple.com/search?term=Memorow&entity=software&country=de&limit=200) 0 / [spaced](https://itunes.apple.com/search?term=Memo%20row&entity=software&country=de&limit=200) 0 | [compact](https://itunes.apple.com/search?term=Memorow&entity=software&country=us&limit=200) 150 / [spaced](https://itunes.apple.com/search?term=Memo%20row&entity=software&country=us&limit=200) 141 | `Timehop - Memories Then & Now`, `Memorize Texts - MemoCoach`, `Notepad - handy quickly memo` | No `Memorow` or `Memo row` trackName. |
| **RowTuned** | [compact](https://itunes.apple.com/search?term=RowTuned&entity=software&country=de&limit=200) 0 / [spaced](https://itunes.apple.com/search?term=Row%20Tuned&entity=software&country=de&limit=200) 0 | [compact](https://itunes.apple.com/search?term=RowTuned&entity=software&country=us&limit=200) 17 / [spaced](https://itunes.apple.com/search?term=Row%20Tuned&entity=software&country=us&limit=200) 62 | `Four In A Row Connect`, `Pro Guitar Tuner`, `KeyTuner` | No `RowTuned` or `Row Tuned` trackName. |
| **RowerEcho** | [compact](https://itunes.apple.com/search?term=RowerEcho&entity=software&country=de&limit=200) 0 / [spaced](https://itunes.apple.com/search?term=Rower%20Echo&entity=software&country=de&limit=200) 3 | [compact](https://itunes.apple.com/search?term=RowerEcho&entity=software&country=us&limit=200) 150 / [spaced](https://itunes.apple.com/search?term=Rower%20Echo&entity=software&country=us&limit=200) 152 | `asensei rowing`, `ErgZone`, `Hydrow`, `Echo: Watch Heart Rate Monitor` | No `RowerEcho` or `Rower Echo` trackName. |
| **RowMentor** | [compact](https://itunes.apple.com/search?term=RowMentor&entity=software&country=de&limit=200) 0 / [spaced](https://itunes.apple.com/search?term=Row%20Mentor&entity=software&country=de&limit=200) 2 | [compact](https://itunes.apple.com/search?term=RowMentor&entity=software&country=us&limit=200) 6 / [spaced](https://itunes.apple.com/search?term=Row%20Mentor&entity=software&country=us&limit=200) 148 | `PVRenju: Renju & Gomoku`, `Bridge Mentor`, `MentorPRO` | No `RowMentor` or `Row Mentor` trackName. |
| **PaceThread** | [compact](https://itunes.apple.com/search?term=PaceThread&entity=software&country=de&limit=200) 0 / [spaced](https://itunes.apple.com/search?term=Pace%20Thread&entity=software&country=de&limit=200) 20 | [compact](https://itunes.apple.com/search?term=PaceThread&entity=software&country=us&limit=200) 42 / [spaced](https://itunes.apple.com/search?term=Pace%20Thread&entity=software&country=us&limit=200) 163 | `LinkedIn: Business-Netzwerk`, `Reddit`, `Pace: Running Pace Calculator`, `Pacer Pedometer Step Counter` | No `PaceThread` or `Pace Thread` trackName. |

The API is fuzzy, storefront-specific, and dynamic. Missing identical `trackName` values do not reserve a name or prove non-use.

## Google Play first-party snapshot

The compact forms were inspected at Google's first-party US app-search pages:

| Candidate | First-party query | Visible result at snapshot |
|---|---|---|
| **Memorow** | [Google Play](https://play.google.com/store/search?q=Memorow&c=apps&hl=en&gl=US) | Dynamic response did not yield a stable, title-exact card/null determination: **UNKNOWN**. |
| **RowTuned** | [Google Play](https://play.google.com/store/search?q=RowTuned&c=apps&hl=en&gl=US) | Dynamic response did not yield a stable, title-exact card/null determination: **UNKNOWN**. |
| **RowerEcho** | [Google Play](https://play.google.com/store/search?q=RowerEcho&c=apps&hl=en&gl=US) | Dynamic response did not yield a stable, title-exact card/null determination: **UNKNOWN**. |
| **RowMentor** | [Google Play](https://play.google.com/store/search?q=RowMentor&c=apps&hl=en&gl=US) | Page payload displayed `No results for RowMentor`. |
| **PaceThread** | [Google Play](https://play.google.com/store/search?q=PaceThread&c=apps&hl=en&gl=US) | Page payload displayed `No results for PaceThread`. |

Google Play's page title and HTML repeat the query string; those repetitions are not app hits. Dynamic ranking, other countries, removed apps, subtitles, developer names, bundle identifiers, and unindexed use remain unknown. Even the explicit RowMentor/PaceThread null payloads are not reservations or availability conclusions.

## Official RDAP snapshot — all 15 domains

Endpoints: official [Verisign RDAP](https://www.verisign.com/news-insights/registration-data-access-protocol/help/) for `.com`, DENIC's official trial [RDAP service](https://rdap.denic.de/) for `.de`, and [Google Registry RDAP](https://pubapi.registry.google/rdap/) for `.app`. All requests below returned HTTP 404 on 2026-08-09 during the research window.

| Candidate | `.com` | `.de` | `.app` | Permitted conclusion |
|---|---|---|---|---|
| **Memorow** | [`memorow.com`: 404](https://rdap.verisign.com/com/v1/domain/memorow.com) | [`memorow.de`: 404](https://rdap.denic.de/domain/memorow.de) | [`memorow.app`: 404](https://pubapi.registry.google/rdap/domain/memorow.app) | No public RDAP object in this snapshot. |
| **RowTuned** | [`rowtuned.com`: 404](https://rdap.verisign.com/com/v1/domain/rowtuned.com) | [`rowtuned.de`: 404](https://rdap.denic.de/domain/rowtuned.de) | [`rowtuned.app`: 404](https://pubapi.registry.google/rdap/domain/rowtuned.app) | Same. |
| **RowerEcho** | [`rowerecho.com`: 404](https://rdap.verisign.com/com/v1/domain/rowerecho.com) | [`rowerecho.de`: 404](https://rdap.denic.de/domain/rowerecho.de) | [`rowerecho.app`: 404](https://pubapi.registry.google/rdap/domain/rowerecho.app) | Same. |
| **RowMentor** | [`rowmentor.com`: 404](https://rdap.verisign.com/com/v1/domain/rowmentor.com) | [`rowmentor.de`: 404](https://rdap.denic.de/domain/rowmentor.de) | [`rowmentor.app`: 404](https://pubapi.registry.google/rdap/domain/rowmentor.app) | Same. |
| **PaceThread** | [`pacethread.com`: 404](https://rdap.verisign.com/com/v1/domain/pacethread.com) | [`pacethread.de`: 404](https://rdap.denic.de/domain/pacethread.de) | [`pacethread.app`: 404](https://pubapi.registry.google/rdap/domain/pacethread.app) | Same. |

A 404 means only that the endpoint returned no domain object at that time. It does not establish registrar checkout, price, premium/reserved status, eligibility, ownership freedom, or legal availability. No domain was purchased, reserved, or put into checkout.

## Private prototype recommendation — maximum two new names

### 1. Memorow vs CoachRecall

Test whether the coined `memory + row` identity gives enough immediate meaning while adding rowing specificity that CoachRecall lacks. The card must not imply perfect recall, passive surveillance, autonomous learning, or retention beyond actual product behaviour. Primary failure conditions: participants do not hear “memory + row,” pronounce it inconsistently, or read it as a memo/table-row tool.

### 2. RowTuned vs CoachRecall

Test whether “rowing guidance tuned to me” is more trustworthy and immediately commercial than explicit memory language. The card may state that selected history/documents inform recommendations, but must not backfill memory into the wordmark. Primary failure conditions: it sounds like equipment tuning, music, a manufacturer feature, or a finished performance guarantee.

`RowerEcho`, `RowMentor`, and `PaceThread` remain text-only research controls, not three more prototypes. The prototype recommendation is an agent research outcome, not a human name decision.

## Required next gates

1. **Professional identity and similarity clearance:** DPMA, EUIPO/TMview, WIPO/Madrid, relevant national registers, compact/spaced/hyphenated forms, phonetic/visual/conceptual neighbours, translations, components, word/device marks, company names, trade names, product/app titles, and unregistered use.
2. **Goods/services and non-medical boundary:** counsel must define the actual 9/41/42 scope and explicitly assess/exclude class 44 based on real services and claims. Personal health context must not become diagnosis, treatment, rehabilitation, monitoring, or safety advice.
3. **Runtime truth gate:** verify medical refusal/guardrail behaviour or remove health-condition ingestion from the commercial path; accurately describe the unused `chatSystemPrompt` seam; never promise perfect or autonomous memory.
4. **Private language test:** DE/EN, unprompted five-second meaning, pronunciation, rowing comprehension, coach-vs-tool reading, privacy/memory expectations, manufacturer association, and medical/therapy association.
5. **Only after positive legal, product, and human gates:** re-run current store/company/domain/handle checks, inspect registrar checkout and premium/reserved status, and decide filing/ownership. Technical nulls from this report authorize nothing.

## Final status

- **Exactly five new finalists:** Memorow, RowTuned, RowerEcho, RowMentor, PaceThread.
- **At most two new private prototypes:** Memorow and RowTuned, each compared with CoachRecall.
- **CoachRecall:** benchmark only; not finalist and not human-selected.
- **Sage family:** excluded from this round.
- **Trademark:** limited EUIPO exact-query and DPMA Expert exact/wildcard snapshots recorded; no similarity clearance.
- **WIPO/Madrid:** **UNKNOWN**.
- **Legal:** **HOLD for all five**.
- **Commercial/public use:** **NO GO**.
- **External mutations:** none; no domains, handles, store names, marks, commits, or accounts changed.
