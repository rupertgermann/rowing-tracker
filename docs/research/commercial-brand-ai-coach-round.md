# Commercial brand screening — AI coach round

**Issue:** [#94 — Choose a distinctive commercial brand](https://github.com/rupertgermann/rowing-tracker/issues/94)

**Research window:** 2026-08-09, approximately 20:20–20:59 CEST

**Official-register and registry snapshot:** 2026-08-09, last domain request 20:59:53 CEST

**Status:** preliminary product/name screen only — **WIPO UNKNOWN, Legal HOLD, no legal clearance**

> **Superseded recommendations:** The later [RowingSage precheck](rowingsage-brand-precheck.md) demotes TempoSage and the Sage family. The [memory-coach round](commercial-brand-memory-coach-round.md) explores later candidates, and its Memorow recommendation was subsequently [rejected](memorow-brand-clearance.md). The recommendations below remain historical evidence, not an active shortlist.

> **Source snapshot:** Implementation links refer to pre-audit revision [`169bdba`](https://github.com/rupertgermann/rowing-tracker/tree/169bdba95944b96624295a77fdeba6c3840ed907), preserving the historical source anchors rather than describing current runtime behavior.

## Outcome

The exact five finalists are **CoachRecall**, **TempoSage**, **RecallRhythm**, **ContextSage**, and **CoachContextAI**. `CoachContextAI` is deliberately the one explicit-AI control, not the recommended brand direction. The two contrasting private prototypes are exactly:

1. **TempoSage** — tests an immediately understandable, calm, adaptive training-guide identity.
2. **CoachRecall** — tests whether explicit continuity (“the coach remembers”) is more compelling than performance-language.

All five remain **Legal HOLD**. No name is approved for publication, sale, registration, domain purchase, handle reservation, or app submission. Exact-string zeroes and RDAP 404 responses are snapshots, not similarity searches, availability guarantees, or legal opinions.

## Product truth used for naming

### What is real in README and source

The README describes the intended product kernel as an AI coach with conversation history and documents, tool calls to sessions/achievements/memory, personalized multi-week plans, automated insights, Personal Context across coach/plans/insights, and configurable prompts ([README](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/README.md#L15-L23)). Source inspection narrows those claims:

- **Conversation continuity, not autonomous learned memory.** Chat sessions/messages are persisted and loaded from the API ([`chatStorage.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/chatStorage.ts#L76-L102), [`chatStorage.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/chatStorage.ts#L121-L140)); the request replays only the last ten conversation messages ([`cloudAI.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/cloudAI.ts#L302-L309)). This supports “remembers the conversation/history”, not “learns you autonomously forever”.
- **Real tool calling.** The active chat request exposes `get_sessions`, `get_memory_documents`, and `get_achievements` with structured schemas ([`cloudAI.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/cloudAI.ts#L180-L299)), executes returned function calls and feeds outputs back to the model ([`cloudAI.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/cloudAI.ts#L380-L418)), and implements session/document/achievement retrieval ([`cloudAI.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/cloudAI.ts#L677-L765), [`cloudAI.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/cloudAI.ts#L798-L866)).
- **Personal Context is a shared system-prompt addition.** Users can select memory documents, combine their extracted text with free text, and generate a condensed context ([`settings/page.tsx`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/app/settings/page.tsx#L2550-L2632)). The resulting context is described as injected into chat, insights, and plans ([`settings/page.tsx`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/app/settings/page.tsx#L2673-L2681)); code appends it to the chat/system prompt and general insight system prompt ([`cloudAI.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/cloudAI.ts#L1121-L1150)) and to plan generation ([`cloudAI.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/cloudAI.ts#L1676-L1683)).
- **Personalized multi-week plans are implemented.** Plan generation accepts goals, level, focus, duration, and session history, then requests structured weeks/sessions ([`cloudAI.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/cloudAI.ts#L1395-L1438)); the Plans UI invokes it and persists the returned plan ([`plans/page.tsx`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/app/plans/page.tsx#L192-L236)).
- **Automatic insights are real.** The hook produces local insights/trends/load/anomalies ([`useAIInsights.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/hooks/useAIInsights.ts#L439-L468)) and can generate cloud insights; generated insights are also synchronized into coaching memory ([`useAIInsights.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/hooks/useAIInsights.ts#L65-L97)).
- **Chart explanations are user-triggered.** The inspected button assembles chart data plus the configured chart prompt, stores pending client state, and navigates to chat ([`ExplainChartButton.tsx`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/components/ExplainChartButton.tsx#L57-L85)). The inspected seam does not substantiate an automatic or server-cache brand promise.
- **Several use-case prompts are configurable and consumed.** Settings exposes base, chat, plan, insight, chart, and other prompt editors ([`settings/page.tsx`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/app/settings/page.tsx#L2699-L2801)); `systemPrompt`, `planGenerationPrompt`, `insightsPrompt`, `explainChartPrompt`, and `userProfilePrompt` have consumed paths. However, `chatSystemPrompt` is stored/editable ([`settings.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/settings.ts#L132-L159)) while the active `getChatSystemPrompt()` remains hard-coded ([`cloudAI.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/cloudAI.ts#L873-L998)). “Everything is configurable” would therefore overclaim.

### Binding product boundary

- **COPD is context/constraint only.** A user may state COPD as information that limits or contextualizes training. The brand and copy must never imply detection, diagnosis, treatment, therapy, pulmonary rehabilitation, medical monitoring, or guaranteed safety.
- The current source asks the model to account for medical conditions ([`cloudAI.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/cloudAI.ts#L1121-L1128)) and its profile-condensation prompt explicitly solicits health/medical considerations ([`cloudAI.ts`](https://github.com/rupertgermann/rowing-tracker/blob/169bdba95944b96624295a77fdeba6c3840ed907/src/lib/cloudAI.ts#L1982-L2019)). Robust medical refusal/guardrail enforcement was not found in the inspected path. The non-medical boundary is therefore a **required launch gate**, not an implemented safeguard.
- Motion capture is a feature and optional context source, not the commercial brand core. The name must continue to work for chat continuity, documents, plans, insights, and tool retrieval without mocap.

## Generation pool: 44 fresh hypotheses, 39 rejected

The pool excludes every exact name recorded in the earlier rounds and avoids manufacturer names and the `Row` + generic-tech pattern. Generic `…AI` variants were excluded from generative naming; `CoachContextAI` is included only as the mandated explicit-AI control.

| Disposition | Names | Count | Reason |
|---|---|---:|---|
| **Final five** | `TempoSage`, `CoachRecall`, `ContextSage`, `RecallRhythm`, `CoachContextAI` | 5 | Covers adaptive guide, remembered coach, context intelligence, continuity cadence, and one explicit-AI control. |
| **Hard collision rejects** | `PromptCurrent`, `ContextLedger`, `MemoryWeft`, `CoachLore`, `PaceMind` | 5 | Exact active AI/digital or same-field uses found; evidence below. |
| **Cox-family rejects** | `ContextCox`, `Mnemocox`, `SignalCox`, `PromptCox`, `InsightCox` | 5 | Written/spoken `cox` side meanings, German opacity, and disproportionate coxswain emphasis; fails the unguided five-second test. |
| **Generic ledger/draft/current/crew rejects** | `SenseLedger`, `MemoryDraft`, `RecallDraft`, `CounselCurrent`, `ContextCurrent`, `MemoryCurrent`, `RecallCurrent`, `PlanCurrent`, `PromptCrew`, `MemoryCrew`, `RecallCrew`, `ContextCrew`, `MindCrew`, `InsightCrew` | 14 | Crowded components, software/workgroup readings, weak personal-coach signal, or awkward speech. |
| **Opaque metaphor rejects** | `PromptCairn`, `RecallCairn`, `ContextCairn`, `MemoryCairn`, `SenseWeft`, `Mnemoraft`, `ContextChime` | 7 | Requires explanation, difficult DE/EN pronunciation, textile/hiking/audio side readings, or overengineered coinage. |
| **Clearer but weaker/crowded rejects** | `PaceSage`, `ProgressSage`, `EffortSage`, `WorkoutSage`, `RecallMentor`, `SenseDraft`, `CoachSignal`, `CoachTide` | 8 | Understandable but less distinctive, less complete across memory/plans/insights, domain-friction-prone, or too narrowly performance/analytics-led. |
| **Total** | 44 hypotheses | **44** | **39 rejects + 5 finalists.** |

### Hard-collision evidence

- **PromptCurrent — HARD REJECT:** [PromptCurrent](https://www.promptcurrent.com/) is an active exact-name AI publication.
- **ContextLedger — HARD REJECT:** the exact-name [ContextLedger project](https://tanzimhromel.com/showcase/projects/contextledger/) is an active context-accounting/memory system for coding agents, directly adjacent to AI context/memory semantics.
- **MemoryWeft — HARD REJECT:** [MemoryWeft](https://github.com/rawdev/MemoryWeft) is an exact-name graph-based AI-memory/MCP project.
- **CoachLore — HARD REJECT:** [Velo Café Cycling Club](https://velo-cafe.cc/en/pages/vc-cycling-club) offers `CoachLore` in sport/cycling coaching, an exact same-field service use.
- **PaceMind — HARD REJECT:** [PaceMind](https://pacemind.io/) and its [help page](https://pacemind.io/help.html) describe an active endurance/multisport AI coach with personalized planning, injury history, recommendations, and daily adaptation.

Two non-pool benchmark controls demonstrate why generic AI suffixes were not used as normal hypotheses: [PaceAI](https://paceai.co/about/) is already active, while [Tempo](https://www.jointempoapp.com/) markets a personal AI coach with persistent memory/history, insights, and workout generation. Their collisions do not prove anything about unsearched `…AI` strings; they show the category is crowded.

## Exactly five finalists and semantic score

Scale: 1 weak to 5 strong. Scores are product-semantics judgments, not legal scores.

| Rank | Candidate | Semantic family | Guidance clarity | Memory/context | Plans/insights | DE/EN speech | Distinctiveness | Platform friction | Total / 30 | Decision |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | **CoachRecall** | remembered personal coach | 5 | 5 | 4 | 4 | 3 | 5 | **26** | **PROTOTYPE #2**; strongest direct kernel, but English word order and study/recall association need testing. |
| 2 | **TempoSage** | adaptive training guide | 5 | 2 | 5 | 5 | 3 | 5 | **25** | **PROTOTYPE #1**; clearest calm guide/plan signal, but memory is not explicit and both words are weak components. |
| 3 | **RecallRhythm** | continuity and adaptive cadence | 3 | 5 | 4 | 4 | 4 | 5 | **25** | Best continuity challenger; may sound like memory practice or music rather than coaching. |
| 4 | **ContextSage** | personal-context intelligence | 4 | 5 | 4 | 4 | 3 | 3 | **23** | Strong Personal Context fit; `.com` is already registered and “context” can sound technical. |
| 5 | **CoachContextAI** | explicit-AI control | 5 | 5 | 4 | 3 | 1 | 5 | **23** | Private control only. Descriptive/generic, long, and likely weak as a protectable brand even though exact snapshots are clean. |

None suggests SmartRow, WaterRower, NOHRD, Concept2, OpenAI, or another manufacturer relationship. None makes motion capture the identity. All require a rowing descriptor in prototype copy.

## Official trademark-register snapshot

### Method and limits

- **EUIPO eSearch plus:** compact and spaced strings were entered in the official UI; the displayed `Trade marks` count was observed. Reproducible URLs below encode the same basic searches. A zero is only an exact-string UI result, not a similarity search.
- **DPMAregister:** official Basisrecherche with `DE`, `EM`, and `IR` selected; classes `9 41 42 44`; exact and `?` wildcard strings. The DPMA UI states that `?` matches no, one, or multiple characters. Search start: [DPMAregister](https://register.dpma.de/DPMAregister/marke/basis). UI responses were observed during the stated window and included the recorded query text.
- Classes are research anchors only. [Nice Classification 2026](https://nclpub.wipo.int/esen/pdf-download.pdf?dateInForce=20260101&lang=en&tab=class_headings) broadly covers software (9), training/sport (41), SaaS/software development (42), and medical/health services (44). Final goods/services require counsel. Class 44 remains a screen because health constraints can appear in Personal Context; it does not mean the product should offer medical services.

| Candidate | EUIPO exact | EUIPO spaced | DPMA exact, classes 9/41/42/44 | DPMA wildcard, classes 9/41/42/44 | Snapshot |
|---|---|---|---|---|---|
| **TempoSage** | [`TEMPOSAGE`: 0](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/TEMPOSAGE) | [`TEMPO SAGE`: 0](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/TEMPO%20SAGE) | `(marke="TEMPOSAGE") and (kl=9 or kl=41 or kl=42 or kl=44)` — no hits | `(marke="TEMPO?SAGE") and (kl=9 or kl=41 or kl=42 or kl=44)` — no hits | Observed 2026-08-09, approximately 20:58 CEST |
| **CoachRecall** | [`COACHRECALL`: 0](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/COACHRECALL) | [`COACH RECALL`: 0](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/COACH%20RECALL) | `(marke="COACHRECALL") and (kl=9 or kl=41 or kl=42 or kl=44)` — no hits | `(marke="COACH?RECALL") and (kl=9 or kl=41 or kl=42 or kl=44)` — no hits | Same window |
| **ContextSage** | [`CONTEXTSAGE`: 0](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/CONTEXTSAGE) | [`CONTEXT SAGE`: 0](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/CONTEXT%20SAGE) | `(marke="CONTEXTSAGE") and (kl=9 or kl=41 or kl=42 or kl=44)` — no hits | `(marke="CONTEXT?SAGE") and (kl=9 or kl=41 or kl=42 or kl=44)` — no hits | Same window |
| **RecallRhythm** | [`RECALLRHYTHM`: 0](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/RECALLRHYTHM) | [`RECALL RHYTHM`: 0](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/RECALL%20RHYTHM) | `(marke="RECALLRHYTHM") and (kl=9 or kl=41 or kl=42 or kl=44)` — no hits | `(marke="RECALL?RHYTHM") and (kl=9 or kl=41 or kl=42 or kl=44)` — no hits | Same window |
| **CoachContextAI** | [`COACHCONTEXTAI`: 0](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/COACHCONTEXTAI) | [`COACH CONTEXT AI`: 0](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/COACH%20CONTEXT%20AI) | `(marke="COACHCONTEXTAI") and (kl=9 or kl=41 or kl=42 or kl=44)` — no hits | `(marke="COACH?CONTEXT?AI") and (kl=9 or kl=41 or kl=42 or kl=44)` — no hits | Same window |

The official interfaces are dynamic. The URLs reproduce query intent but may not preserve a future result count. If a reviewer cannot reproduce the observed UI state, the current status becomes **UNKNOWN**, not a presumed zero.

### WIPO

The [WIPO Global Brand Database](https://www.wipo.int/en/web/global-brand-database) was not automated. Its [terms](https://www.wipo.int/en/web/global-brand-database/terms_and_conditions) restrict automated searching/scraping, and no challenge was bypassed. **WIPO/Madrid status is UNKNOWN for all five.** EUIPO and DPMA snapshots do not fill that gap.

## App-store snapshot

Apple's official [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html) was queried with `entity=software&limit=200`; actual `trackName` values were checked, rather than treating a fuzzy `resultCount` as an exact hit. Google Play's official US app-search page was inspected for the compact string. Storefronts, ranking, catalogues, and returned fuzzy results change continuously.

| Candidate | Apple DE compact / spaced | Apple US compact / spaced | Google Play US compact | Observed result |
|---|---|---|---|---|
| **TempoSage** | [compact](https://itunes.apple.com/search?term=TempoSage&entity=software&country=de&limit=200) / [spaced](https://itunes.apple.com/search?term=Tempo%20Sage&entity=software&country=de&limit=200) | [compact](https://itunes.apple.com/search?term=TempoSage&entity=software&country=us&limit=200) / [spaced](https://itunes.apple.com/search?term=Tempo%20Sage&entity=software&country=us&limit=200) | [compact](https://play.google.com/store/search?q=TempoSage&c=apps&hl=en&gl=US) | No identical Apple `trackName`; no identical visible Google Play app title. |
| **CoachRecall** | [compact](https://itunes.apple.com/search?term=CoachRecall&entity=software&country=de&limit=200) / [spaced](https://itunes.apple.com/search?term=Coach%20Recall&entity=software&country=de&limit=200) | [compact](https://itunes.apple.com/search?term=CoachRecall&entity=software&country=us&limit=200) / [spaced](https://itunes.apple.com/search?term=Coach%20Recall&entity=software&country=us&limit=200) | [compact](https://play.google.com/store/search?q=CoachRecall&c=apps&hl=en&gl=US) | No identical Apple `trackName`; Google Play displayed `No results for CoachRecall`. |
| **ContextSage** | [compact](https://itunes.apple.com/search?term=ContextSage&entity=software&country=de&limit=200) / [spaced](https://itunes.apple.com/search?term=Context%20Sage&entity=software&country=de&limit=200) | [compact](https://itunes.apple.com/search?term=ContextSage&entity=software&country=us&limit=200) / [spaced](https://itunes.apple.com/search?term=Context%20Sage&entity=software&country=us&limit=200) | [compact](https://play.google.com/store/search?q=ContextSage&c=apps&hl=en&gl=US) | No identical Apple `trackName`; no identical visible Google Play app title. |
| **RecallRhythm** | [compact](https://itunes.apple.com/search?term=RecallRhythm&entity=software&country=de&limit=200) / [spaced](https://itunes.apple.com/search?term=Recall%20Rhythm&entity=software&country=de&limit=200) | [compact](https://itunes.apple.com/search?term=RecallRhythm&entity=software&country=us&limit=200) / [spaced](https://itunes.apple.com/search?term=Recall%20Rhythm&entity=software&country=us&limit=200) | [compact](https://play.google.com/store/search?q=RecallRhythm&c=apps&hl=en&gl=US) | No identical Apple `trackName`; visible Google results were fuzzy (`BookRecall`, music app), not identical. |
| **CoachContextAI** | [compact](https://itunes.apple.com/search?term=CoachContextAI&entity=software&country=de&limit=200) / [spaced](https://itunes.apple.com/search?term=Coach%20Context%20AI&entity=software&country=de&limit=200) | [compact](https://itunes.apple.com/search?term=CoachContextAI&entity=software&country=us&limit=200) / [spaced](https://itunes.apple.com/search?term=Coach%20Context%20AI&entity=software&country=us&limit=200) | [compact](https://play.google.com/store/search?q=CoachContextAI&c=apps&hl=en&gl=US) | No identical Apple `trackName`; Google Play displayed `No results for CoachContextAI`. |

These are catalogue snapshots, not name reservations or proof of non-use. Removed apps, other regions, developer names, subtitles, bundle identifiers, and unindexed uses remain unknown.

## Official domain-registry snapshot — all 15 domains

Official endpoints: [Verisign RDAP help](https://www.verisign.com/news-insights/registration-data-access-protocol/help/) for `.com`, [DENIC RDAP](https://rdap.denic.de/) for `.de`, and [Google Registry RDAP](https://pubapi.registry.google/rdap/) plus its [terms](https://www.registry.google/policies/rdap-terms/) for `.app`. A 404 means only that the endpoint returned no RDAP domain object at **2026-08-09 20:59:53 CEST**. It does not guarantee registrar checkout, price, non-premium status, reservation eligibility, or legal availability.

| Candidate | `.com` | `.de` | `.app` | Permitted conclusion |
|---|---|---|---|---|
| **TempoSage** | [`temposage.com`](https://rdap.verisign.com/com/v1/domain/temposage.com): 404 | [`temposage.de`](https://rdap.denic.de/domain/temposage.de): 404 | [`temposage.app`](https://pubapi.registry.google/rdap/domain/temposage.app): 404 | No RDAP object in snapshot; no availability guarantee. |
| **CoachRecall** | [`coachrecall.com`](https://rdap.verisign.com/com/v1/domain/coachrecall.com): 404 | [`coachrecall.de`](https://rdap.denic.de/domain/coachrecall.de): 404 | [`coachrecall.app`](https://pubapi.registry.google/rdap/domain/coachrecall.app): 404 | Same. |
| **ContextSage** | [`contextsage.com`](https://rdap.verisign.com/com/v1/domain/contextsage.com): **200**, registration event `2025-05-03T17:22:06Z` | [`contextsage.de`](https://rdap.denic.de/domain/contextsage.de): 404 | [`contextsage.app`](https://pubapi.registry.google/rdap/domain/contextsage.app): 404 | `.com` object exists; owner intent, use, and acquisition path unknown. Other two have no object in snapshot. |
| **RecallRhythm** | [`recallrhythm.com`](https://rdap.verisign.com/com/v1/domain/recallrhythm.com): 404 | [`recallrhythm.de`](https://rdap.denic.de/domain/recallrhythm.de): 404 | [`recallrhythm.app`](https://pubapi.registry.google/rdap/domain/recallrhythm.app): 404 | No RDAP object in snapshot; no availability guarantee. |
| **CoachContextAI** | [`coachcontextai.com`](https://rdap.verisign.com/com/v1/domain/coachcontextai.com): 404 | [`coachcontextai.de`](https://rdap.denic.de/domain/coachcontextai.de): 404 | [`coachcontextai.app`](https://pubapi.registry.google/rdap/domain/coachcontextai.app): 404 | No RDAP object in snapshot; no availability guarantee. |

No domain was purchased, reserved, or checked out.

## Private prototype recommendation — exactly two

### 1. TempoSage

Test the plain-English promise: “a wise training guide that adapts tempo and the next multi-week plan.” It should be calm and evidence-led, not mystical. The test must ask unprompted DE/EN participants what they expect it to do, how they pronounce it, whether they infer rowing, whether it sounds medical, and whether it implies a human coach.

### 2. CoachRecall

Test the continuity promise: “a coach that can retrieve the sessions, achievements, plans, documents, and prior conversation that matter now.” The prototype must not imply hidden surveillance, autonomous learning, perfect memory, or medical recall. Compare directly with TempoSage on trust, warmth, credibility, and five-second comprehension.

`CoachContextAI` remains a naming-control card in those private interviews, not a third prototype. It measures whether explicit `AI` improves comprehension enough to compensate for genericness and weaker ownability.

## Required next gates

1. **Professional similarity clearance:** DPMA, EUIPO/TMview, WIPO/Madrid, relevant national registers, phonetic/visual/conceptual neighbours, translations, word/device marks, company names, trade names, app/product titles, and unregistered use. Exact zeroes are insufficient.
2. **Legal goods/services strategy:** counsel must define the actual 9/41/42 scope and decide how class 44 is excluded or searched given real claims and Personal Context. **Legal status stays HOLD.**
3. **Product truth gate:** either implement and verify medical refusal/guardrail behaviour or remove health-condition ingestion from the commercial path. COPD may constrain training context only; no diagnosis, treatment, rehab, monitoring, or safety claims.
4. **Prompt/configuration truth gate:** fix or accurately describe the unused `chatSystemPrompt` seam; do not market universal prompt configurability until verified.
5. **Private language test:** exact two prototypes, DE/EN, unguided five-second meaning, pronunciation, memory/privacy expectations, AI disclosure, and medical/therapy associations.
6. **Only after positive legal and product gates:** registrar checkout, price/premium/reserved state, social handles, developer-name and store-name reservation. Do not buy or publish based on this report.

## Final status

- **Product:** private prototype only for **TempoSage** and **CoachRecall**.
- **Trademark:** EUIPO/DPMA exact and limited wildcard snapshots recorded; similarity clearance not performed.
- **WIPO:** **UNKNOWN**.
- **Legal:** **HOLD for all five**.
- **Commercial/public use:** **NO GO pending professional clearance and product-safety gates**.
