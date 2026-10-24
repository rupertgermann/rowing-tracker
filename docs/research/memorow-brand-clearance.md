# Memorow brand pre-clearance

**Issue:** [#94 — Choose a distinctive commercial brand](https://github.com/rupertgermann/rowing-tracker/issues/94)

**Research window:** 2026-08-10, approximately 08:12–08:23 CEST

**Status:** preliminary identity and market screen only — **REJECT, Legal HOLD, WIPO UNKNOWN, no legal clearance**

## Decision

**Verdict: REJECT.** `Memorow` should not advance as the commercial product name and must not be published, sold, filed, reserved, or used in an app submission.

The decisive problem is not an identical `MEMOROW` result. It is the active `MEMORO` field immediately beside it:

- EUIPO shows the registered word mark [`MEMORO`, EUTM 019295874](https://euipo.europa.eu/eSearch/#details/trademarks/019295874) in classes 9 and 42 for downloadable/interactive software and software development/design.
- DPMAregister shows two active German `MEMORO` word marks in the screened classes, including [`302024214454`](https://register.dpma.de/DPMAregister/marke/register/3020242144548/DE) in classes 9 and 42 for data/IT goods and IT services, and [`302024112234`](https://register.dpma.de/DPMAregister/marke/register/3020241122346/DE) across classes including 9, 41 and 44.
- [`Memoro`](https://apps.apple.com/us/app/memoro/id6451258411) is a current Memoro GmbH AI note-taking product on Apple and [Google Play](https://play.google.com/store/apps/details?id=com.memo.beta), while [`memoro me`](https://apps.apple.com/us/app/memoro-me/id6761647055) is Martin Forsberg's current “personal AI with memory” product. The Apple seller name matches the owner name in the EUIPO file; both products operate in the same broad AI-memory/software territory as the proposed rowing coach.

`MEMOROW` differs from `MEMORO` only by a final `W`. In the intended “memory + row” reading, English can render the ending as `row` /roʊ/; German speakers are likely to say both `Memorow` and `Memoro` approximately “Me-mo-roh”. This creates a serious visual, phonetic, semantic, software-class, and actual-market proximity signal. Exact-search zeroes and RDAP 404 responses do not offset it. **REJECT** is a product-screen decision to avoid an unnecessarily risky path, not a legal finding of infringement.

The existing private prototype may remain as explicitly rejected historical evidence only. It is not a chosen name. Every external or commercial action remains on **Legal HOLD**.

## Product and naming boundary

The relevant product is an AI-powered rowing application, not a narrow workout log. The repository describes analytics, personalized training plans, coaching insights, achievements, and motion-capture posture analysis ([README](../../README.md#L5-L9)). Its AI coach uses conversation history, workout data, achievements, and selected documents; Personal Context can inform chat, plans, and insights ([README](../../README.md#L15-L23)). The discarded private prototype recorded that cloud-provider transfer is conditional, visible retrieval traces were only a prototype concept, and health context was non-diagnostic.

This breadth defines the screen:

- classes 9, 41, 42, and 44 are starting points for software, sport/training, SaaS/software services, and possible health-service proximity;
- the product is expressly not diagnosis, treatment, medical monitoring, or a safety guarantee;
- a name must cover coach continuity, plans, analytics, documents, achievements, and optional motion analysis—not only “memory”.

The [official Nice Classification 2026](https://nclpub.wipo.int/esen/pdf-download.pdf?dateInForce=20260101&lang=en&tab=class_headings) places computer software in class 9, sport/fitness training in 41, software development and SaaS in 42, and medical/health services in 44. These four classes are research anchors, not a finished goods/services specification.

## Official register snapshot

### EUIPO eSearch plus

The official visible Basic Search was inspected without a class filter. The URL fragment reproduces the entered string, but the result is a client-rendered, time-sensitive UI response rather than a stable API record. The same-day visible results were:

| Query | Reproducible URL | Visible trade-mark count | Relevant observation |
|---|---|---:|---|
| `MEMOROW` | [EUIPO](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/MEMOROW) | 0 | Exact-string UI zero only. |
| `MEMO ROW` | [EUIPO](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/MEMO%20ROW) | 0 | Spaced-form UI zero only. |
| `MEMORO` | [EUIPO](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/MEMORO) | 6 | Includes active EUTM 019295874 in 9/42. |
| `MEMROW` | [EUIPO](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/MEMROW) | 0 | Exact-string UI zero only. |

The material hit is [`MEMORO`, 019295874](https://euipo.europa.eu/eSearch/#details/trademarks/019295874): word mark, filed 22 December 2025, registration recorded in April 2026, status `Registered`, expiry 22 December 2035, owner Martin Forsberg, Sweden. Its goods/services are broad and directly relevant:

- class 9: `Software; Interactive software; Computer programs, downloadable.`
- class 42: `Software development; Software design and development.`

An older figurative `MEMORO`, 008826687, also appears in classes 9, 38, and 41 but is expired. The other four visible Basic Search results are in different or mixed classes. This report does not treat every `MEMORO` record as equally material; the active broad 9/42 word mark is the key EU signal.

### DPMAregister

The [official DPMAregister Expert Search](https://register.dpma.de/DPMAregister/marke/experte) was used with databases `DE`, `EM`, and `IR`. Exact query template:

```text
(DB=DE OR DB=EM OR DB=IR) AND (MARKE="NAME") AND (KL=9 OR KL=41 OR KL=42 OR KL=44)
```

The variant query used `MEMO?ROW`; DPMA's on-screen field help states that `?` can stand for no, one, or multiple characters. This catches compact, spaced, and hyphenated forms but is not a phonetic or conceptual similarity search.

| Query in classes 9/41/42/44 | Visible result |
|---|---:|
| `MARKE="MEMOROW"` | 0 |
| `MARKE="MEMO?ROW"` | 0 |
| `MARKE="MEMORO"` | 4 |
| `MARKE="MEMROW"` | 0 |

The broader official [DPMA Smart Search for `MEMORO`](https://register.dpma.de/DPMAregister/smartsearch?queryString=MEMORO) returned nine mark results without the four-class restriction; [`MEMOROW`](https://register.dpma.de/DPMAregister/smartsearch?queryString=MEMOROW), [`MEMO ROW`](https://register.dpma.de/DPMAregister/smartsearch?queryString=MEMO%20ROW), and [`MEMROW`](https://register.dpma.de/DPMAregister/smartsearch?queryString=MEMROW) returned no mark result in that parallel exact-string control. The scoped expert result is the relevant count for the class screen; the unscoped count shows that the `MEMORO` family is broader than those four scoped hits.

Material direct files:

- [`MEMORO`, DE 302024214454](https://register.dpma.de/DPMAregister/marke/register/3020242144548/DE): active word mark, filed 11 April 2024, classes 9 and 42. The record covers downloadable/recorded data, IT/audiovisual/multimedia equipment, measuring/detection/control equipment, IT services, design, testing, authentication, and quality control.
- [`MEMORO`, DE 302024112234](https://register.dpma.de/DPMAregister/marke/register/3020241122346/DE): active word mark owned by Memoro AG, classes 9, 35, 36, 40, 41, 44, and 45. Its class-9 list is mainly downloadable publications/media, class 41 education and media production, and class 44 cemetery gardening; it is less directly aligned with the rowing product than the broad 9/42 marks, but still forms part of the active name field.
- DPMA also mirrors EUTM 019295874 and the expired older EUTM in the four-hit list.

These results are snapshots of exact/wildcard strings and specified databases/classes. They do not assess confusing similarity, status history outside the displayed file, earlier unregistered rights, company names, word/device marks, or every possible transliteration and pronunciation.

### WIPO/Madrid — UNKNOWN

The [WIPO Global Brand Database terms](https://www.wipo.int/en/web/global-brand-database/terms_and_conditions) prohibit automated queries and web scraping; the [official FAQ](https://www.wipo.int/en/web/global-brand-database/faqs_branddb) likewise disallows robot searches and says that failure to find a proposed mark does not establish availability. No challenge was bypassed and no automated WIPO search was performed.

The WIPO/Madrid status is therefore **UNKNOWN** for `MEMOROW`, `MEMO ROW`, `MEMO-ROW`, `MEMORO`, `MEMROW`, phonetic equivalents, translations, relevant components, and similar word/device marks. EUIPO and DPMA results do not close this global gap.

## Current first-party product and market evidence

The focused run did not establish an active first-party rowing/fitness/AI-coach product titled exactly `Memorow`, `Memo Row`, or `Memrow`. That is not proof of non-use; unindexed products, company/trade names, social identifiers, removed apps, other territories, and unregistered use remain open.

The near-name evidence is nonetheless unusually strong:

1. **Memoro GmbH — AI conversation memory/productivity.** Apple's official listing [`Memoro`](https://apps.apple.com/us/app/memoro/id6451258411) names seller `Memoro GmbH`, bundle `com.memo.beta`, category `Productivity`, and describes automatic conversation/thought capture, organization, and synchronization. The developer's [official download page](https://memoro.ai/en/download/) links both stores. The matching [Google Play listing](https://play.google.com/store/apps/details?id=com.memo.beta) describes automatic note-taking, sharing, synchronization, and the web app; Google Play showed 1K+ downloads and an update date of 27 September 2025 in this snapshot. The provider's [feature page](https://memoro.ai/en/features/) adds AI transcription, smart summaries, an audio archive, intelligent search, and “Memories”.
2. **memoro me — personal AI with memory.** Apple's official [`memoro me`](https://apps.apple.com/us/app/memoro-me/id6761647055) listing names seller `Martin Forsberg`, bundle `app.meetmemoro.memoro`, category `Productivity`, version 1.1.0 released 21 July 2026, and describes a personal AI that searches the user's history and connects conversations, email, notes, events, people, photos, and learning. The product's [first-party site](https://meetmemoro.app/) calls it “a personal AI with memory” and says its assistant uses user-added context to keep the thread. This is exceptionally close to the proposed coach-memory value proposition.
3. **Other exact `Memoro` software/health uses.** [`memoro.io`](https://memoro.io/en) is a current memory-training/learning service with spaced repetition, testing, analytics, courses, and team training. [`memoro.healthcare`](https://www.memoro.healthcare/) is a current clinical-communication SaaS that captures and retrieves patient-specific information. They are not direct rowing competitors, but they add software, training, memory, and health-adjacent name density.

The rowing/AI-coach field itself is also active: Apple's first-party listings show [`RowXL`](https://apps.apple.com/us/app/rowxl/id6753610213) with AI video coaching and training plans, [`RowBetter`](https://apps.apple.com/us/app/rowbetter/id6752589438) with history-driven AI plans and analytics, and [`asensei rowing`](https://apps.apple.com/us/app/asensei-rowing/id1335539383) with personalized programs and an AI coach. These are not close-mark findings against `Memorow`; they show why the candidate's shared `row` and coaching concepts do not create a quiet market by themselves.

## Apple App Store Search API snapshot

Apple's official [Search API documentation](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html) was followed with `entity=software&limit=200`. `resultCount` is fuzzy search output, so actual `trackName` values were inspected and only normalized exact title equality was treated as an exact-title result.

| Territory / query | Official query | `resultCount` | Representative returned `trackName` values | Exact proposed-title result |
|---|---|---:|---|---:|
| DE `Memorow` | [API](https://itunes.apple.com/search?term=Memorow&entity=software&country=de&limit=200) | 0 | none | 0 |
| DE `Memo row` | [API](https://itunes.apple.com/search?term=Memo%20row&entity=software&country=de&limit=200) | 0 | none | 0 |
| US `Memorow` | [API](https://itunes.apple.com/search?term=Memorow&entity=software&country=us&limit=200) | 150 | `AMOU: A Map Of Us`, `Artifcts`, `BlackBox Memories`, `Bond - Connect Memories` | 0 |
| US `Memo row` | [API](https://itunes.apple.com/search?term=Memo%20row&entity=software&country=us&limit=200) | 141 | `All In One Memo`, `Audio Memos Pro`, `Column Calendar and Tag Memo`, `Daily Notes` | 0 |

Near-name controls were material:

- DE `Memoro`: `resultCount` 3, including exact `trackName` `Memoro`; US `Memoro`: `resultCount` 133, including exact `Memoro`.
- DE `Memrow`: 0; US `Memrow`: 23 fuzzy results and no exact `Memrow` track name.
- The direct Apple lookup for app ID `6761647055` returned exact `trackName` `memoro me`, seller Martin Forsberg, and the personal-AI-with-memory description summarized above.

This is a dated storefront/search snapshot, not an availability guarantee or an exhaustive historical app-title database.

## Google Play snapshot and access limit

The official Google Play US English search surface was inspected for `Memorow`, `Memo row`, `Memoro`, and `Memrow`. The visible result sets did not display an identical `Memorow`, `Memo Row`, or `Memrow` title; Google Play's search ranking is fuzzy, personalized/territory-sensitive, and not a trademark or complete title database. The focused official store search is therefore evidence only of what was visibly returned at the stated time.

The direct first-party-linked [`Memoro`](https://play.google.com/store/apps/details?id=com.memo.beta) product page was accessible and is the stronger Google Play signal. No claim is made that the absence of an identical proposed title means the name is reservable.

## Official domain/RDAP snapshot

Requests were made at **2026-08-10 08:19:25 CEST**. A 404 means only that the queried endpoint returned no public RDAP domain object at that moment; it does not establish registrar checkout availability, price, premium/reserved status, legal availability, or future registration success.

| Domain | Official or registry-hosted endpoint | HTTP/result | Constrained interpretation |
|---|---|---:|---|
| `memorow.com` | [Verisign RDAP](https://rdap.verisign.com/com/v1/domain/memorow.com) | 404, empty body | No public `.com` RDAP object in this snapshot. |
| `memorow.de` | [DENIC RDAP](https://rdap.denic.de/domain/memorow.de) | 404, `No such domain.` | DENIC documents 404 as a non-registered-domain response in its [official RDAP guide](https://www.denic.de/service/whois-service/rdap-service); no checkout/legal guarantee. |
| `memorow.app` | [Google Registry RDAP](https://pubapi.registry.google/rdap/domain/memorow.app) | 404, `memorow.app not found` | No public RDAP object; Google's [RDAP terms](https://www.registry.google/policies/rdap-terms/) disclaim accuracy guarantees and reliance. |
| `memorow.io` | [Identity Digital endpoint tested](https://rdap.identitydigital.services/rdap/domain/memorow.io) | 404, but registry authority not confirmed by the current official IANA bootstrap | **UNKNOWN.** The 404 is not used as a domain-status finding because the current [IANA RDAP bootstrap](https://data.iana.org/rdap/dns.json) did not identify an authoritative `.io` endpoint in this run. |

No DNS/RDAP state should trigger a purchase. Domain, handle, company-name, and app/developer-name work remains blocked by the mark and market findings.

## Semantic, pronunciation, protectability, and breadth assessment

These are product-research judgments, not legal opinions.

| Dimension | Assessment | Risk |
|---|---|---|
| Meaning | Strong compact synthesis of `memory`/`memo` and `row`; it communicates remembered rowing context quickly once the pun is understood. | The same transparency makes both components suggestive or descriptive of the product function. |
| English speech | Plausible readings include “MEM-oh-row” and “MEM-uh-row”; the final element can clearly resolve to rowing. | Pronunciation is not self-locking, and `row` also has the unrelated /raʊ/ reading. |
| German speech | Likely “Me-mo-roh”. | This is likely identical or extremely close to how `Memoro` is pronounced in German. |
| Distinctiveness | The combined spelling is coined and more distinctive than plain `Rowing Memory` or `Row Coach`. | A coined spelling does not neutralize the active `MEMORO` word marks and uses; the extra final `W` may be visually minor and phonetically silent in the intended reading. |
| Product kernel | Excellent fit for coach continuity, history, documents, and selected context. | It foregrounds storage/recall and says less about analytics, plans, achievements, technique, motion capture, or broader adaptive coaching. |
| Health boundary | The name itself does not promise diagnosis or treatment. | Active `Memoro` healthcare use and the product's own health-context feature create avoidable adjacent-market noise even though Rowing Tracker is non-medical. |
| Search/store identity | Exact `Memorow` is relatively clean in the limited storefront queries. | Exact `Memoro` products already occupy AI memory, productivity, learning/training, and healthcare software; spelling corrections and spoken referrals may collapse the distinction. |

The DPMA's [official trademark brochure](https://www.dpma.de/docs/dpma/veroeffentlichungen/broschueren/bro_marken_dt.pdf) explains that lack of distinctiveness and exclusively descriptive indications can be absolute grounds for refusal. Whether `Memorow` itself is registrable, or conflicts with any earlier right, requires professional legal analysis. The business screen does not need to wait for that answer: the avoidable near-name field is already too crowded for this candidate.

## Risk synthesis

| Gate | Status | Why |
|---|---|---|
| Exact `MEMOROW` EUIPO/DPMA snapshot | AMBER | Visible exact-string zeroes, but no similarity clearance and UI snapshots can drift. |
| `MEMORO` EU/DE mark field | **RED** | Active word marks in directly relevant software classes 9/42; additional active DE record in 9/41/44. |
| Actual AI-memory product field | **RED** | Active `Memoro` and `memoro me` products overlap the memory/context/AI assistant kernel. |
| Pronunciation/visual distance | **RED** | Only final `W`; intended DE pronunciation likely identical and EN ending very close. |
| WIPO/Madrid | UNKNOWN | Not automatically searched; terms-compliant manual/professional search required. |
| Domains | AMBER/UNKNOWN | `.com`, `.de`, `.app` returned 404 snapshots; `.io` authority unresolved. None is a purchase guarantee. |
| Product breadth | AMBER | Strong memory/rowing fit, weaker umbrella for the rest of the product. |
| Commercial/public use | **BLOCKED** | Legal HOLD; candidate rejected at product-screen level. |

## Required disposition

1. **Remove Memorow from the active commercial-name shortlist.** Preserve it only as rejected research/prototype history so the same idea is not silently regenerated.
2. **Do not purchase domains, reserve handles, create developer accounts, file a mark, or publish the prototype under this name.** RDAP/store nulls are not authorization.
3. **If a human nevertheless wants to revive it, first obtain written professional clearance** covering `MEMOROW`, `MEMO ROW`, `MEMO-ROW`, `MEMORO`, `MEMROW`, phonetic/visual/conceptual neighbours, word/device marks, company and trade names, unregistered use, and the actual software/training/health goods and services in Germany, the EU, WIPO/Madrid, and planned markets. Until that written result exists, the status stays **REJECT / Legal HOLD**.
4. **Continue the naming process with a more distant construction.** A replacement should preserve the useful “coach continuity across rowing history” meaning without adding one letter to an active AI-memory/software name family.

## Reproduction log and limits

- **EUIPO queries:** `MEMOROW`, `MEMO ROW`, `MEMORO`, `MEMROW` in visible eSearch plus Basic Search; no class filter; counts and the material 019295874 detail recorded above.
- **DPMA queries:** `(DB=DE OR DB=EM OR DB=IR) AND (MARKE="…") AND (KL=9 OR KL=41 OR KL=42 OR KL=44)` for `MEMOROW`, `MEMO?ROW`, `MEMORO`, and `MEMROW`; direct detail records opened for the two active German `MEMORO` files.
- **WIPO:** terms and FAQ inspected; no mark query automated; result **UNKNOWN**.
- **Apple:** `entity=software`, `limit=200`, territories `de` and `us`, terms `Memorow`, `Memo row`, `Memoro`, and `Memrow`; actual `trackName` equality inspected. Direct lookup also used for `memoro me` app ID `6761647055`.
- **Google Play:** visible US-English official store searches for the same strings; direct `com.memo.beta` product page followed from the provider's first-party download page.
- **RDAP:** direct GET requests and HTTP status/body inspection at 08:19:25 CEST; `.io` kept UNKNOWN because endpoint authority was not established through the current IANA bootstrap.
- **Market search:** focused exact/near-name and first-party rowing/fitness/AI-coach queries. No secondary-source claim is used as decision evidence.

This is a time-limited pre-clearance report, not legal advice, a freedom-to-operate opinion, a complete similarity search, a domain purchase guarantee, or permission to use any mark.
