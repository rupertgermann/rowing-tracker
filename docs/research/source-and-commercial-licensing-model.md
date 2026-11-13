# Source- und kommerzielles Lizenzmodell

> **Historische Recherche.** Die Monetarisierungspläne für Rowing Tracker wurden eingestellt. Es gibt kein kostenpflichtiges Abo. Der aktuelle Code steht unter [GPLv3-only](../../LICENSE). Die frühere MIT-Veröffentlichung bleibt unter ihren ursprünglichen Bedingungen verfügbar.

**Ticket:** [Choose the future source and commercial licensing model](https://github.com/rupertgermann/rowing-tracker/issues/90)

**Map:** [Wayfind the Rowing Tracker monetization model](https://github.com/rupertgermann/rowing-tracker/issues/87)
**Stand:** 2026-08-02 · Recherchebericht, keine Rechtsberatung

## Entscheidung

Das Produktmodell ist **privates proprietäres Produkt mit späterem, neuem MIT-Community-Kern**:

1. Das bestehende Repository bleibt privat und bleibt ab dem Cutoff proprietär. Es wird nicht wieder vollständig öffentlich gemacht.
2. Revisionen bis einschließlich `d38df10faabb812ac8f24a0fd28c30530067764e` bleiben unter den damals erteilten MIT-Bedingungen. Ein späterer Export darf diese historischen Rechte nicht als widerrufen darstellen.
3. Ein späteres Community-Repository wird als **neues, bereinigtes Repository unter MIT** veröffentlicht. Es erhält nur ausdrücklich freigegebene Kernbestandteile; Paid-Code, private Betriebslogik, Billing/Entitlements, AI-Coaching und Mocap werden nicht exportiert.
4. Die CommercialBeta enthält **keine Mocap-Funktionalität**: weder Browser-Aufnahme noch Video-/Pose-Uploads, Browser- oder Sidecar-Analyse, FreeMoCap-Installation, -Auslieferung oder -Betrieb. Der vorhandene Code darf privat dormant bleiben. FreeMoCap bleibt separat AGPL-3.0; eine spätere Reaktivierung ist eine eigene Lizenz- und Architekturentscheidung.
5. Externe Beiträge zum privaten Produkt werden bis zu einer dokumentierten Rechteklärung nicht angenommen. Für freigegebene Beiträge ist ein schriftlicher Rechte-Grant bzw. eine Abtretung erforderlich, der proprietäre kommerzielle Nutzung, Bearbeitung, Unterlizenzierung und einen möglichen MIT-Export des betreffenden Codes abdeckt; die konkrete Vertragsform prüft Rechtsberatung.

Diese Entscheidung ist **kein Dual-Licensing des vollständigen privaten Repositories**. Sie trennt die bereits erteilte historische MIT-Lizenz, die gegenwärtige proprietäre Produktquelle und einen möglichen zukünftigen MIT-Kern.

## Geprüfte Repo- und Issue-Fakten

| Befund | Evidenz und Konsequenz |
| --- | --- |
| Das GitHub-Repository ist aktuell privat; GitHub meldet keine erkannte Repository-Lizenz. | [Repository-Metadaten](https://github.com/rupertgermann/rowing-tracker) (Status am 2026-08-02). Das stützt „nicht erneut vollständig öffentlich“, ersetzt aber keine Datei-/Komponentenprüfung. |
| `LICENSE` grenzt den Cutoff bei `d38df10…` ab, erklärt spätere Revisionen für proprietär, erhält historische MIT-Rechte und nennt Drittkomponenten als separat lizenziert. | [LICENSE im Commit `19ba647`](https://github.com/rupertgermann/rowing-tracker/blob/19ba647ab073e93babc5140fe5b35a33e7cfb58b/LICENSE#L1-L30). Der annotierte Tag dokumentiert denselben Stichtag als „last commit publicly released under the MIT License“: [Cutoff-Tag](https://github.com/rupertgermann/rowing-tracker/tree/mit-public-cutoff-2026-08-02). |
| Die historische Revision enthält den vollständigen MIT-Text. Die MIT-Lizenz gewährt den dortigen Empfängern u. a. Nutzung, Kopieren, Änderung, Veröffentlichung und Weitergabe unter Beibehaltung des Hinweises. | [historisches LICENSE](https://github.com/rupertgermann/rowing-tracker/blob/d38df10faabb812ac8f24a0fd28c30530067764e/LICENSE) · [OSI-MIT-Text](https://opensource.org/license/mit). Deshalb werden alte MIT-Rechte nicht durch den neuen privaten Hinweis neu lizenziert oder zurückgenommen. |
| Die npm-Metadaten setzen `private: true` und `license: UNLICENSED`. npm dokumentiert `UNLICENSED` als Wert für Pakete, denen keine Nutzungsrechte eingeräumt werden sollen, und empfiehlt zusätzlich `private: true` gegen versehentliche Veröffentlichung. | [package.json](https://github.com/rupertgermann/rowing-tracker/blob/19ba647ab073e93babc5140fe5b35a33e7cfb58b/package.json#L1-L11) · [npm package.json-Dokumentation](https://docs.npmjs.com/cli/configuring-npm/package-json/#license). |
| Der Sidecar selbst ist als `Proprietary` markiert; FreeMoCap ist nur eine optionale Python-Extra-Abhängigkeit (`freemocap>=1.8,<2`). | [sidecar/pyproject.toml](https://github.com/rupertgermann/rowing-tracker/blob/19ba647ab073e93babc5140fe5b35a33e7cfb58b/sidecar/pyproject.toml#L5-L19). Die CommercialBeta darf dieses Extra deshalb nicht installieren oder ausliefern. |
| Die npm-Lockdatei enthält nicht nur MIT: z. B. `jszip` als `(MIT OR GPL-3.0-or-later)` und optionale `sharp`/libvips-Artefakte unter LGPL-3.0-or-later bzw. zusammengesetzten Ausdrücken. | [jszip-Lockeintrag](https://github.com/rupertgermann/rowing-tracker/blob/19ba647ab073e93babc5140fe5b35a33e7cfb58b/package-lock.json#L7878-L7888) · [sharp-Lockeintrag](https://github.com/rupertgermann/rowing-tracker/blob/19ba647ab073e93babc5140fe5b35a33e7cfb58b/package-lock.json#L1222-L1235). Vor einem öffentlichen Export ist ein vollständiger SBOM-/Notice-Check erforderlich; der Lockfile-Befund ist keine abschließende Rechtsfreigabe. |
| Die lokale Git-Historie hat einen menschlichen Autor (Rupert Germann); die abgefragten gemergten GitHub-PRs wurden von `rupertgermann` eröffnet. Es gibt keine `CONTRIBUTING.md`, CLA- oder Rechteabtretungsdatei im Repository; die README enthält weiterhin generische Fork/PR-Anweisungen. | [Commit-Historie](https://github.com/rupertgermann/rowing-tracker/commits/main) · [gemergte PRs](https://github.com/rupertgermann/rowing-tracker/pulls?q=is%3Apr+is%3Amerged) · [README-Contributing](https://github.com/rupertgermann/rowing-tracker/blob/19ba647ab073e93babc5140fe5b35a33e7cfb58b/README.md#contributing). Das ist ein Audit-Signal, kein abschließender Nachweis der urheberrechtlichen Rechtekette; externe PR-/Issue-Beiträge und Arbeitgeberrechte müssen vor Annahme geprüft werden. |
| Die Monetarisierungs-Map beschreibt die CommercialBeta als eingeladenes, gehostetes Angebot mit manuellem SmartRow-CSV/ZIP-Import ohne SmartRow-Zugangsdaten; kostenlose Grundlage sind Import, Historie und Basisanalysen, bezahlt werden personalisierte Trainingsführung/AI-Coaching. | [Map-Ticket](https://github.com/rupertgermann/rowing-tracker/issues/87). Diese Begriffe bilden die In-/Out-of-scope-Grenze unten. |

## Bewertung der Alternativen

| Modell | Bewertung für dieses Ticket | Beschluss |
| --- | --- | --- |
| **Privates proprietäres Produkt + neuer MIT-Kern** | Erhält die historischen MIT-Rechte, verlangt keine nachträgliche Relizenzierung des vollständigen privaten Verlaufs und erlaubt eine klare Paid-/Free-Grenze. Der neue MIT-Kern muss aus einer bereinigten Quelle mit eigener Historie und geprüften Drittkomponenten entstehen. | **Gewählt.** |
| **AGPL-3.0 mit kommerziellem Dual Licensing** | Die AGPL ist für Netzwerkanwendungen bewusst stark copyleft: Abschnitt 13 verlangt bei einer modifizierten netzwerkfähigen Version ein kostenlos zugängliches Angebot des Corresponding Source für interagierende Nutzer ([offizieller AGPL-Text](https://www.gnu.org/licenses/agpl-3.0.html#section13)). Die FSF bestätigt, dass ein Copyright-Inhaber parallel unter mehreren Lizenzen veröffentlichen kann, weist aber ebenfalls darauf hin, dass nur die jeweiligen Rechteinhaber Ausnahmen oder zusätzliche Rechte erteilen können ([GPL-FAQ, Parallel-Lizenzen](https://www.gnu.org/licenses/gpl-faq.html#HeardOtherLicense), [GPL-FAQ, Rechteinhaber](https://www.gnu.org/licenses/gpl-faq.html#GPLIncompatibleLibs)). Für den vollständigen privaten Verlauf wäre daher zuerst eine belastbare Rechtekette aller Beiträge und Abhängigkeiten nötig; das passt nicht zum bestätigten Cutoff-/Clean-Export-Modell. | **Nicht gewählt.** AGPL bleibt eine mögliche spätere Lizenz für separat bereinigte Community-Komponenten, nicht die Lizenz des privaten Paid-Produkts. |
| **FSL (Functional Source License)** | Die offizielle FSL-Seite bezeichnet FSL als Fair-Source-Lizenz und wandelt jede bereitgestellte Version nach zwei Jahren in Apache 2.0 oder MIT um; der Zeitpunkt hängt von der jeweils bereitgestellten Version ab ([FSL-FAQ](https://fsl.software/)). Dieses zeitbasierte Modell würde eine zusätzliche Versionierungs- und Erwartungslogik einführen, die der hier gewollten stabilen privaten Quelle plus explizitem MIT-Export nicht hilft. | **Nicht gewählt.** |
| **MIT plus proprietäre Services / Open Core im selben öffentlichen Verlauf** | MIT ist permissiv und gut für einen Community-Kern geeignet ([OSI-MIT-Text](https://opensource.org/license/mit)). Eine Veröffentlichung des bestehenden vollständigen Verlaufs würde jedoch die beschlossene Paid-Grenze und private Produktlogik offenlegen. Die tragfähige Variante ist deshalb nicht „aktuelles Repo öffentlich“, sondern ein neuer, bereinigter MIT-Export ohne Paid-Code. | **Nur als spätere Exportform**, nicht als Lizenzierung des aktuellen Repositories. |

## Historical MIT: unveränderliche Grenze

Der Stichtag ist eine Versionsgrenze, keine nachträgliche Relizenzierung: Der Tag und die damalige `LICENSE` sind die Belege dafür, was bis `d38df10…` öffentlich unter MIT angeboten wurde ([Tag](https://github.com/rupertgermann/rowing-tracker/tree/mit-public-cutoff-2026-08-02), [historischer LICENSE-Stand](https://github.com/rupertgermann/rowing-tracker/blob/d38df10faabb812ac8f24a0fd28c30530067764e/LICENSE)). Der heutige proprietäre Hinweis gilt laut eigener Formulierung für spätere Revisionen und sagt ausdrücklich, dass bereits gewährte historische MIT-Rechte nicht widerrufen werden ([aktueller LICENSE-Stand](https://github.com/rupertgermann/rowing-tracker/blob/19ba647ab073e93babc5140fe5b35a33e7cfb58b/LICENSE#L8-L22)).

Für einen späteren öffentlichen Kern sind daher diese Regeln verbindlich:

- keine Behauptung, das Gesamtprojekt sei rückwirkend proprietär;
- neue Repository-Historie oder klar markierter Exportpunkt;
- jede exportierte Datei und jede Abhängigkeit muss einzeln auf Rechte, Notices und Herkunft geprüft werden;
- Paid-Code, interne Prompts, Billing/Entitlements, Betriebsgeheimnisse und Mocap-Code dürfen nicht aus dem privaten Verlauf in den MIT-Kern gelangen.

## FreeMoCap/AGPL und CommercialBeta

FreeMoCap kennzeichnet sein offizielles Projekt als AGPL-3.0 ([offizielles Repository](https://github.com/freemocap/freemocap), [offizieller LICENSE-Text](https://raw.githubusercontent.com/freemocap/freemocap/main/LICENSE)). Die AGPL-Präambel und Abschnitt 13 adressieren gerade öffentlich erreichbare Netzwerkversionen und verlangen bei einer modifizierten netzwerkfähigen Version einen Zugang zum Corresponding Source ([AGPL-Text, Präambel](https://www.gnu.org/licenses/agpl-3.0.html#preamble), [AGPL-Text, Abschnitt 13](https://www.gnu.org/licenses/agpl-3.0.html#section13)). Die genaue Einordnung einer konkreten Kopplung ist nicht pauschal aus „Sidecar“ ableitbar; die FSF beschreibt die Grenze zwischen getrennten und kombinierten Programmen als kontextabhängige Rechtsfrage ([GPL-FAQ, Aggregation](https://www.gnu.org/licenses/gpl-faq.html#MereAggregation)).

Für die CommercialBeta gilt deshalb die konservative, produktseitig eindeutige Grenze:

**In scope:** eingeladene gehostete Beta, manueller SmartRow-CSV/ZIP-Import ohne SmartRow-Credentials, Verlauf/Basisanalysen sowie validiertes AI-Coaching und personalisierte Trainingsführung gemäß Map ([Map-Ticket](https://github.com/rupertgermann/rowing-tracker/issues/87)).

**Out of scope:** sämtliche Mocap-Nutzerpfade (Browser und Sidecar), Kamera-/Video-/Pose-Aufnahme und -Uploads, Pose-Analyse und Mocap-AI-Kontext, FreeMoCap-Paket oder Sidecar-Extra in Installations-/Distributionsartefakten, Mocap-Routen/APIs im Beta-Angebot sowie Betrieb oder Support dieser Funktion. Der private Mocap-Code bleibt bis zu einer neuen Entscheidung dormant; README und UI-/API-Gates müssen diese Grenze technisch sichtbar erzwingen ([aktuelle README-Mocap-Dokumentation](https://github.com/rupertgermann/rowing-tracker/blob/19ba647ab073e93babc5140fe5b35a33e7cfb58b/README.md#motion-capture--posture-analysis-mocap), [Sidecar-Manifest](https://github.com/rupertgermann/rowing-tracker/blob/19ba647ab073e93babc5140fe5b35a33e7cfb58b/sidecar/pyproject.toml#L15-L19)).

## Contribution-Policy für die private Quelle

Bis die folgende Policy umgesetzt und geprüft ist, bleibt der private Verlauf maintainer-only:

1. Vor Merge: Name/Identität, Urheberstellung, Arbeitgeber-/Auftraggeberfreigabe und Herkunft jeder wesentlichen Änderung dokumentieren.
2. Schriftlicher Rechte-Grant bzw. Abtretung vor Merge: Nutzung und Bearbeitung im proprietären Produkt, kommerzielle Bereitstellung, Unterlizenzierung und ein möglicher MIT-Export des ausdrücklich freigegebenen Codes müssen umfasst sein.
3. Drittcode und generierte Assets benötigen ihre eigene Lizenz-/Notice-Referenz; sie werden nicht durch einen Contributor-Grant „mitlizenziert“.
4. Der Grant wird gemeinsam mit PR/Commit-ID archiviert; ohne Nachweis kein Merge. Der generische README-Fork/PR-Text darf erst wieder als Einladung dienen, wenn diese Policy veröffentlicht und technisch durchgesetzt ist ([README](https://github.com/rupertgermann/rowing-tracker/blob/19ba647ab073e93babc5140fe5b35a33e7cfb58b/README.md#contributing)).

Die FSF weist für parallele Lizenzen und Lizenz-Ausnahmen ausdrücklich auf die Rolle des jeweiligen Copyright-Inhabers hin ([GPL-FAQ](https://www.gnu.org/licenses/gpl-faq.html#HeardOtherLicense)); die konkrete Abtretungs-/Lizenzvereinbarung ist daher juristisch prüfen zu lassen.

## Risiken und Restfragen

- **Abhängigkeiten:** Der Lockfile-Snapshot enthält LGPL/MPL-, duale GPL/MIT- und weitere Notices ([Lockfile](https://github.com/rupertgermann/rowing-tracker/blob/19ba647ab073e93babc5140fe5b35a33e7cfb58b/package-lock.json)). Vor jedem MIT-Export: reproduzierbares SBOM für npm **und** Python-Extras, SPDX-Auswertung, Notice-Bundle und Prüfung der tatsächlich gebündelten optionalen Plattformpakete.
- **Rechtekette:** Lokale Git-/PR-Autoren sind ein positives Signal, beweisen aber weder Arbeitgeberrechte noch Rechte an importierten Assets, früheren Forks oder externen Beiträgen. Vor Ticketabschluss sollte der Maintainer die GitHub-PRs/Forks und alle nicht selbst erstellten Assets einmal explizit sign-offen ([PR-Übersicht](https://github.com/rupertgermann/rowing-tracker/pulls)).
- **Beta-Gates:** Mocap ist im aktuellen README noch prominent beschrieben ([README-Mocap](https://github.com/rupertgermann/rowing-tracker/blob/19ba647ab073e93babc5140fe5b35a33e7cfb58b/README.md#motion-capture--posture-analysis-mocap)); UI, Routen, APIs, Bundling und Telemetrie müssen vor der Beta denselben Out-of-scope-Beschluss erzwingen.
- **Reaktivierung:** FreeMoCap darf erst nach separater Lizenz-/Architekturprüfung, Contribution-Audit, Datenschutz-/Speicherentscheidung und erneuter CommercialBeta-Freigabe aktiviert werden. Die AGPL-Pflichten sind versions- und integrationsabhängig; dieser Bericht ist keine Freigabe für eine konkrete Distribution.
- **Rechtsberatung:** Die Quellen dokumentieren Lizenztexte und Projektfakten. Sie ersetzen keine Prüfung durch im relevanten Rechtsraum qualifizierte Software-/IP-Rechtsberatung, insbesondere nicht für Rechteketten, Arbeitgeberrechte, kombinierte Werke, SaaS-Bereitstellung oder AGPL-Abgrenzung.

## Ergebnis für „Choose the future source and commercial licensing model“

**Modell beschlossen:** aktuelles privates Repository proprietär; historische Revisionen bis zum MIT-Cutoff bleiben MIT; späterer Community-Kern als neues bereinigtes MIT-Repository; CommercialBeta ohne Mocap/FreeMoCap; externe Beiträge nur nach eindeutigem schriftlichem Rechte-Grant. AGPL-Dual-Licensing und FSL werden für diesen Produktstand verworfen. Offen bleiben nur die Umsetzungsgates (Rechte- und Dependency-Inventar, Beta-Deaktivierung und spätere saubere Exportpipeline), nicht die Grundentscheidung.
