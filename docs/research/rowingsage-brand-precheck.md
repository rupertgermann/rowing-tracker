# Primärquellen-Vorprüfung für `RowingSage`

**Recherchezeitpunkt:** 2026-08-09, 21:58 CEST\
**Namenspfad:** **REJECT als dritter privater Prototyp-Challenger**\
**Bestehende Sage-Familie:** **`TempoSage` Agent DEMOTE / REVIEW**\
**Aktueller nicht gewählter Challenger:** **`CoachRecall`**\
**Rechtliche Freigabe:** **HOLD**

## Kurzfazit

`RowingSage` benennt die Kategorie und eine Expertenrolle unmittelbar: eine weise bzw. erfahrene Instanz für Rudern. Das macht den Namen auf Deutsch und Englisch relativ leicht verständlich, aber gerade nicht zu einem guten Träger der eigentlichen Produktdifferenzierung – einer tief individualisierten Coach-Beziehung mit persistentem Verlauf, ausgewählten Dokumenten, Trainingstools, adaptiven Plänen und erklärten Erkenntnissen.

Die live sichtbaren exakten EUIPO-Suchen `ROWINGSAGE` und `ROWING SAGE` zeigten jeweils `Trade marks (0)`. DPMAregister zeigte für die exakte Suche und die kompakt/gespationiert/mit Bindestrich umfassende Wildcard in den Klassen 9, 41, 42 und 44 jeweils „keine Treffer“. Die offiziellen RDAP-Endpunkte lieferten für `rowingsage.com`, `rowingsage.de` und `rowingsage.app` jeweils HTTP 404. Apples offizielle Search API lieferte weder in Deutschland noch in den USA einen identischen App-Titel.

**Keiner dieser Nullbefunde ist eine Freigabe.** Gegen ein Weiterführen spricht vor allem reale Near-field-Benutzung des prägenden Bestandteils `Sage`: Apple führt aktuell `Sage: AI Fitness Coach`, Google Play `Sage AI - AI Coach & Assistant`, jeweils mit persönlichem bzw. personalisiertem Fitness-Coaching und Plänen. Diese Benutzungen sind keine festgestellte Rechtskollision mit `RowingSage`; sie schaffen aber ein konkretes Produkt-, Such- und Assoziationsrisiko im exakt relevanten AI-/Coach-/Fitnessfeld.

`RowingSage` sollte daher **nicht** als dritter Prototyp neben `TempoSage` und `CoachRecall` weitergeführt werden. Der Fund schwächt konsequenterweise die gesamte `Sage`-Namensfamilie: Der bereits gebaute `TempoSage`-Prototyp bleibt ein historisches Vergleichsartefakt, wird aber agentisch auf **DEMOTE / REVIEW** gesetzt und ist keine implizite Empfehlung mehr. `CoachRecall` bleibt der aktuelle, weiterhin nicht gewählte Challenger für die deutlich wichtigere Hypothese „persönlicher Coach mit Erinnerung“. `RowingSage` fügt hauptsächlich eine beschreibende Kategorieangabe hinzu und verschärft zugleich das `Sage`-Komponentenrisiko.

Diese Statusänderungen sind Agentenbewertungen aus der Vorprüfung, noch keine menschliche Annahme oder Namensentscheidung.

## Evidenzgrenze

Diese Untersuchung ist eine schnelle, reproduzierbare **Vorprüfung**, keine Rechtsberatung, keine Ähnlichkeitsrecherche und keine Aussage über Eintragungsfähigkeit oder Benutzungsfreiheit. Insbesondere gilt:

- Ein exakter Register-Nulltreffer schließt ähnliche Wort-, Wort-/Bild-, Klang-, Übersetzungs-, Firmen-, Werk- oder Benutzungszeichen nicht aus.
- Klassen sind Rechercheanker, keine abschließende Festlegung des Waren- und Dienstleistungsverzeichnisses.
- App-Store-, Suchmaschinen- und Domainantworten sind dynamische technische Snapshots.
- Ein RDAP-404 beweist weder Registrar-Verfügbarkeit noch Kaufbarkeit, Preis, Reservierungsstatus oder Markenrecht.
- Nicht eingetragene Kennzeichen, Firmenregister, Social Handles und weitere Länder wurden nicht vollständig geprüft.
- WIPO/Madrid bleibt ausdrücklich **UNKNOWN**.

## Methodik und reproduzierbare Abfragen

### Amtliche Markenregister

Die EUIPO-Suchen wurden als sichtbare Basic-Search-Ergebnisse in eSearch plus kontrolliert:

- [`ROWINGSAGE`](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/ROWINGSAGE)
- [`ROWING SAGE`](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/ROWING%20SAGE)

DPMAregister wurde mit den aktivierten Datenbeständen `DE`, `EM` und `IR` und ohne den Filter „Angemeldete und eingetragene Marken“ verwendet. Dadurch wurden tote oder nicht eingetragene Akten nicht absichtlich ausgeblendet. Ausgangspunkt ist die amtliche [Basisrecherche](https://register.dpma.de/DPMAregister/marke/basis).

Verwendete Suchanfragen:

```text
(marke="ROWINGSAGE") and (kl=9 or kl=41 or kl=42 or kl=44)
(marke="ROWING?SAGE") and (kl=9 or kl=41 or kl=42 or kl=44)
```

Laut der direkt an der DPMA-Eingabemaske angezeigten Hilfe steht `?` für kein, ein oder mehrere Zeichen. `ROWING?SAGE` umfasst damit insbesondere `ROWINGSAGE`, `ROWING SAGE` und `ROWING-SAGE`. Die Klassen 9, 41, 42 und 44 sind nur Startpunkte für Software, Sport-/Fitnesstraining, SaaS/Softwareentwicklung und mögliche gesundheitsnahe Dienstleistungen. Die endgültige Einordnung muss am realen Angebot und der [amtlichen Nizza-Klassifikation 2026](https://nclpub.wipo.int/esen/pdf-download.pdf?dateInForce=20260101&lang=en&tab=class_headings) fachlich bestimmt werden.

### Stores und Markt

- Apple: offizielle [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html), `entity=software`, `limit=200`, Storefronts `de` und `us`; verglichen wurde der tatsächliche `trackName`.
- Google Play: First-party-Suchseite mit kompaktem Namen, [`RowingSage`](https://play.google.com/store/search?q=RowingSage&c=apps&hl=en&gl=US).
- Markt: exakte kompakte und gespationierte Namen sowie der prägende Bestandteil `Sage` wurden gegen aktuelle First-party-Produkt- und Store-Seiten im Rowing-, AI-, Coach- und Fitnessfeld geprüft. Dokumentiert werden nur konkrete Primärquellenfunde; Suchmaschinenabwesenheit wird nicht als Nichtbenutzung ausgegeben.

### Domains

- `.com`: offizieller [Verisign-RDAP-Endpunkt](https://www.verisign.com/news-insights/registration-data-access-protocol/help/)
- `.de`: offizieller [DENIC-RDAP-Endpunkt](https://rdap.denic.de/)
- `.app`: offizieller [Google Registry RDAP](https://pubapi.registry.google/rdap/) und dessen [Nutzungsbedingungen](https://www.registry.google/policies/rdap-terms/)

## Amtliche Registermatrix

| Register | Zeichen / Suchstring | Sichtbare Antwort am 2026-08-09 | Belastbare Aussage |
|---|---|---:|---|
| EUIPO eSearch plus | [`ROWINGSAGE`](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/ROWINGSAGE) | `Trade marks (0)`; „No results were found using the criteria introduced.“ | Exakter UI-Nullsnapshot; keine Ähnlichkeits- oder Rechtsfreigabe. |
| EUIPO eSearch plus | [`ROWING SAGE`](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/ROWING%20SAGE) | `Trade marks (0)`; „No results were found using the criteria introduced.“ | Gespationierter UI-Nullsnapshot; keine Ähnlichkeits- oder Rechtsfreigabe. |
| DPMAregister, DE/EM/IR | `(marke="ROWINGSAGE") and (kl=9 or kl=41 or kl=42 or kl=44)` | „Die Datenbankabfrage lieferte keine Treffer.“ | Exakter Klassen-Nullsnapshot; keine Freigabe. |
| DPMAregister, DE/EM/IR | `(marke="ROWING?SAGE") and (kl=9 or kl=41 or kl=42 or kl=44)` | „Die Datenbankabfrage lieferte keine Treffer.“ | Wildcard-Nullsnapshot für kompakt/Trennzeichen/gespationiert; keine phonetische oder semantische Ähnlichkeitsrecherche. |

Die EUIPO- und DPMA-Antworten sind diesmal technisch sichtbar reproduziert worden. Trotzdem bleiben sie auf Zeichenfolge, konkrete Datenbestände, Klassen und Zeitpunkt begrenzt. Gerade die unten belegte reale `Sage`-Benutzung zeigt, warum ein exakter Nulltreffer keine Marktrealität oder Ähnlichkeitsbewertung ersetzt.

## WIPO/Madrid: UNKNOWN

Die [WIPO Global Brand Database](https://www.wipo.int/en/web/global-brand-database) wurde **nicht automatisiert abgefragt**. WIPOs [Nutzungsbedingungen](https://www.wipo.int/en/web/global-brand-database/terms_and_conditions) und [FAQ](https://www.wipo.int/en/web/global-brand-database/faqs_branddb) beschränken automatisierte Abfragen und Scraping. Es wurde keine Challenge umgangen und kein WIPO-Nulltreffer behauptet.

Der globale WIPO-/Madrid-Status lautet deshalb für `ROWINGSAGE`, `ROWING SAGE`, `ROWING-SAGE`, ähnliche `ROWING … SAGE`-Zeichen und relevante `SAGE`-Zeichen **UNKNOWN**. Eine manuelle professionelle Recherche muss Zeichen-, Klang-, Bedeutungs- und Warenähnlichkeit sowie Rechtsstände auswerten.

## Aktuelle Produkt-, AI-, Coach- und App-Nutzung

### Kein belegter exakter Same-field-Treffer

In diesem begrenzten Primärquellenlauf wurde kein aktuelles First-party-Angebot mit dem exakten Produktnamen `RowingSage` oder `Rowing Sage` belegt. Das ist **kein Nachweis der Nichtbenutzung**: Firmenkennzeichen, nicht indexierte Angebote, Social Handles, entfernte Apps, weitere Storefronts und nicht eingetragene Rechte bleiben offen.

### Relevante Near-field-Nutzung des Bestandteils `Sage`

| Primärquelle | Aktuelle Benutzung | Bedeutung für `RowingSage` |
|---|---|---|
| Apple App Store: [`Sage: AI Fitness Coach`](https://apps.apple.com/ca/app/sage-ai-fitness-coach/id6777168646) | Health-&-Fitness-App von Friday Technologies SRL; beschreibt sich als persönlicher AI-Fitness-Coach, erstellt einen Plan, verfolgt Fortschritt und passt Coaching an. Copyright 2026. | Direkte Nähe zu AI, persönlichem Fitness-Coaching, Plan und Fortschritt. Kein `RowingSage`-Recht belegt, aber konkretes Risiko, wie eine Rudervariante oder Erweiterung von `Sage` zu wirken. |
| Google Play: [`Sage AI - AI Coach & Assistant`](https://play.google.com/store/apps/details?id=io.mondayhero.sageai&hl=en-US) | Aktive App; nennt Coaches als persönliche Wachstumspartner und einen Fitness Trainer, der einen maßgeschneiderten Plan erstellt. | Besetzt `Sage` ausdrücklich zusammen mit `AI`, `Coach`, Fitness und personalisierten Plänen. Das ist ein Produkt-/Suchsignal, keine Markenrechtsfeststellung. |
| Sage Group: [Strategic Report 2025](https://www.sage.com/investors/-/media/files/investors/documents/pdf/overview/sage-strategic-report-2025.pdf) | Die Softwareanbieterin dokumentiert `Sage Copilot` und AI agents als Teil ihrer aktuellen Produktstrategie. | Zusätzlich stark belegte `Sage`-Software-/AI-Landschaft. Sachlich weiter von Rowing entfernt, aber relevant für Suchbarkeit und Softwareassoziation. |

Diese Quellen erlauben **nicht** die Aussage, ein `Sage`-Rechteinhaber könne `RowingSage` rechtlich verhindern. Sie zeigen aber, dass der Bestandteil weder leer noch im digitalen Coach-/AI-/Fitnessmarkt neutral ist. Eine professionelle Recherche muss die jeweiligen Zeichen, Inhaber, Territorien, Rechtsstände und Waren-/Dienstleistungsverzeichnisse erst bewerten.

### Dichtes Rowing-Coach-/Insight-Feld

- [RowIQ](https://www.rowiqapp.com/) positioniert sich als aktuelle Ruder-Trainingsplattform mit Readiness, Plänen, AI-Coach und Klartext-Insights; die First-party-[App-Store-Seite `RowIQLive`](https://apps.apple.com/us/app/rowiqlive/id6761737498) ist erreichbar.
- [StrokeIQ](https://www.strokeiq.app/) positioniert sich als AI-gestützte Ruderanalyse- und Coachingplattform.
- [RowHero](https://rowhero.com/) bietet Live-Ergdaten, Schlaganalyse, Feedback und Trainingsverwaltung.

Diese Namen sind keine engen Zeichenkollisionen mit `RowingSage`. Sie belegen aber, dass die Zielgruppe bereits mehrere funktional nahe Rowing-Coach-/Insight-Angebote unterscheiden muss. Ein aus Kategorie plus Expertenlob gebildeter Name braucht deshalb besonders starke eigenständige Identität.

## Apple-App-Store-Protokoll

| Suchstring / URL | DE-Antwort | US-Antwort | Exakter `trackName` |
|---|---:|---:|---:|
| [`RowingSage` DE](https://itunes.apple.com/search?term=RowingSage&entity=software&country=de&limit=200) / [US](https://itunes.apple.com/search?term=RowingSage&entity=software&country=us&limit=200) | `resultCount: 0` | `resultCount: 168` | DE 0 / US 0 |
| [`Rowing Sage` DE](https://itunes.apple.com/search?term=Rowing%20Sage&entity=software&country=de&limit=200) / [US](https://itunes.apple.com/search?term=Rowing%20Sage&entity=software&country=us&limit=200) | `resultCount: 0` | `resultCount: 44` | DE 0 / US 0 |

Die breite US-Antwort auf `RowingSage` enthielt unter anderem die realen `trackName`-Werte `Row House - Indoor Rowing`, `Hydrow`, `ErgData`, `asensei rowing`, `EXR | Virtual indoor rowing`, `RowingCoach`, `RowHero`, `RowIQLive`, `SmartRow`, `Rowlytics: Rowing Analytics`, `Splash Rowing: Coach & Plans` und `Remote Rowing Coach`. Die gespationierte US-Suche enthielt zusätzlich unter anderem `Studio Sage`, aber ebenfalls weder `RowingSage` noch `Rowing Sage`.

Die API ist eine fuzzy Katalogsuche und kein Markenregister. `resultCount: 0` bzw. kein identischer `trackName` beweist weder Namensreservierung noch App-Store-Verfügbarkeit und erfasst andere Länder, Untertitel, Entwickler-/Bundle-Namen, entfernte Apps oder Firmenkennzeichen nicht vollständig.

## Google-Play-Protokoll und Zugriffsgrenze

Die First-party-Suche [`RowingSage`](https://play.google.com/store/search?q=RowingSage&c=apps&hl=en&gl=US) antwortete im technischen Abruf mit HTTP 200; der ausgelieferte Seiten-Payload enthielt sichtbar `No results for RowingSage`. Die dynamische Seite war in diesem Lauf jedoch nicht stabil als vollständige, titelgenaue Ergebnisliste mit dauerhaft adressierbaren Ergebniskarten auswertbar. Wiederholte Vorkommen des Suchstrings in HTML-/Anfragedaten sind für sich keine App-Treffer.

Damit ist ein dynamischer kompakter Google-Play-Nullsnapshot dokumentiert, aber weder Store-Namensverfügbarkeit noch Nichtbenutzung. Andere Länder, entfernte oder nicht indexierte Apps, Entwickler-/Bundle-Namen und künftige Katalogänderungen bleiben **UNKNOWN**. Die konkreten aktuellen `Sage`-Apps oben sind hingegen über ihre First-party-Detailseiten belegt.

## Offizielle Domain-RDAP-Snapshots

| Domain | Amtliche Abfrage | Antwort am 2026-08-09 | Zulässige Aussage |
|---|---|---|---|
| `rowingsage.com` | [Verisign RDAP](https://rdap.verisign.com/com/v1/domain/rowingsage.com) | HTTP 404, leerer Response-Body | Kein öffentliches RDAP-Domainobjekt zum Prüfzeitpunkt. |
| `rowingsage.de` | [DENIC RDAP](https://rdap.denic.de/domain/rowingsage.de) | HTTP 404, `No such domain.` | Kein öffentliches RDAP-Domainobjekt zum Prüfzeitpunkt. |
| `rowingsage.app` | [Google Registry RDAP](https://pubapi.registry.google/rdap/domain/rowingsage.app) | HTTP 404, `rowingsage.app not found` | Kein öffentliches RDAP-Domainobjekt zum Prüfzeitpunkt. |

Diese Antworten sind keine Checkout-, Preis-, Premium-, Reservierungs- oder Rechtsgarantie. Wegen des Namenspfad-REJECT wird aus ihnen ausdrücklich keine Kaufempfehlung abgeleitet und es wurde nichts registriert.

## Qualitativer Vergleich: `RowingSage`, `TempoSage`, `CoachRecall`

| Kriterium | `RowingSage` | `TempoSage` | `CoachRecall` |
|---|---|---|---|
| Rowing-Fit | **Sehr hoch:** Kategorie wird direkt genannt. | Mittel: `Tempo` passt zu Ausdauer/Rhythmus, braucht aber Rowing-Descriptor. | Niedrig im Wortzeichen; braucht Rowing-Descriptor. |
| AI-/Coach-Signal | `Sage` signalisiert weise Expertise, aber weder ausdrücklich AI noch persönliche Coach-Beziehung. | `Sage` signalisiert ruhige Expertise; Anpassung lässt sich über `Tempo` erzählen. | **Hoch:** `Coach` nennt die Beziehung unmittelbar. |
| Individualisierung / Memory | Schwach: kein Hinweis auf persönlichen Verlauf, Dokumente oder Erinnerung. | Mittel-schwach: langfristige Anpassung ist erzählbar, aber nicht explizit. | **Sehr hoch:** `Recall` trägt Erinnerung und bisherige Entscheidungen direkt. |
| DE-/EN-Sprechbarkeit | EN natürlich „rowing sage“; DE ungefähr „Rou-ing-Sejdsch“, verständlich, aber komplett englisch. | DE/EN kurz und relativ stabil, ungefähr „Tempo-Sejdsch“. | EN klar; DE verständlich, aber `recall` verlangt mehr Englischkenntnis und hat abweichende Betonung. |
| Deskriptivität / vorläufiges Schutzrisiko | **Hoch:** Kategorie `Rowing` plus anpreisende Expertenrolle `Sage`; möglicherweise schwache Gesamtprägung. | Mittel: `Tempo` ist trainingsnah, die Kombination bleibt abstrakter. | Mittel: funktional suggestiv, aber weder Sportart noch konkrete Softwareleistung werden direkt bezeichnet. |
| Produktbreite | **Eng:** bindet die Dachmarke dauerhaft an Rowing; Erweiterungen zu allgemeinem Ausdauer-Coaching werden schwerer. | Breiter über Rudern und Ausdauertraining skalierbar. | Breit für persönliche Coaching- und Memory-Funktionen; Sportkontext muss per Descriptor gesetzt werden. |
| Herstellerunabhängigkeit | Gut: keine SmartRow-, WaterRower-, NOHRD- oder Concept2-Anlehnung. | Gut. | Gut. |
| Aktuelles Komponentenrisiko | **Erhöht:** `Sage` ist real in AI-Fitness-Coach-/Assistant-Apps benutzt. | **Erhöht:** derselbe direkte AI-Fitness-Coach-Fund schwächt die gesamte `Sage`-Familie; daher Agent DEMOTE / REVIEW trotz geringerer Gefahr, wie eine reine Rudervariante zu wirken. | Kein `Sage`-Risiko; separate professionelle Suche bleibt erforderlich. |

Die Bewertung zur möglichen Schutzschwäche ist eine Produkt-/Recherchehypothese, keine Rechtsmeinung. Das DPMA nennt fehlende Unterscheidungskraft und ausschließlich beschreibende Angaben als mögliche absolute Schutzhindernisse in seiner [amtlichen Markeninformation](https://www.dpma.de/docs/dpma/veroeffentlichungen/broschueren/bro_marken_dt.pdf). Ob das Gesamtzeichen `RowingSage` diese Schwelle tatsächlich unterschreitet, darf nur fachlich beurteilt werden.

## Entscheidung und nächste Gates

### Produktentscheidung: REJECT als dritter Challenger

`RowingSage` wird **nicht** als dritter privater Prototyp-Challenger zugelassen.

1. Der Name kommuniziert `Rowing`, aber nicht den eigentlichen Markenkern aus persönlicher Beziehung, persistentem Gedächtnis, Dokumenten und erklärter Anpassung.
2. Die Verbindung aus Kategorie und Expertenrolle ist leicht verständlich, aber voraussichtlich schwächer und beschreibungsnäher als nötig.
3. Aktuelle `Sage`-AI-/Fitness-Coach-Apps erzeugen konkretes Such- und Assoziationsrisiko. Das ist kein behaupteter Rechtskonflikt, genügt aber als Produktgrund gegen weitere Investition.
4. `RowingSage` liefert keine dritte, ausreichend eigenständige Hypothese. Der neue Komponentenfund verhindert zugleich, `TempoSage` unverändert als empfohlenen Gegenpol stehenzulassen: `TempoSage` wird agentisch auf **DEMOTE / REVIEW** gesetzt; `CoachRecall` bleibt als nicht gewählter Challenger offen.

Die Nutzerin oder der Nutzer hat weder den `RowingSage`-REJECT noch die `TempoSage`-Herabstufung angenommen. Der bestehende `TempoSage`-Prototyp wird nicht gelöscht oder umgedeutet; er dokumentiert weiterhin die zuvor autorisierte Vergleichsrunde.

### Rechtlicher Status: HOLD

Der REJECT ist keine Aussage, `RowingSage` sei rechtlich unbenutzbar, und die Register-Nullsnapshots sind keine Freigabe. Sollte der Name später erneut geöffnet werden, sind vor jeder externen Nutzung mindestens erforderlich:

1. professionelle Identitäts- und Ähnlichkeitsrecherche in DPMA, EUIPO/TMview und WIPO/Madrid für `ROWINGSAGE`, `ROWING SAGE`, `ROWING-SAGE`, `SAGE`-Coach-/Fitness-/Softwarezeichen sowie Klang- und Bedeutungsvarianten;
2. rechtliche Bewertung der aktuellen `Sage: AI Fitness Coach`-, `Sage AI - AI Coach & Assistant`- und weiteren `Sage`-Softwarebenutzung nach Territorium, Inhaber, Rechtsstand und konkreten Waren/Dienstleistungen;
3. Firmen-, Produkt-, App-, Domain-, Social- und nicht eingetragene Benutzungskennzeichenrecherche;
4. produktgenaues Waren-/Dienstleistungsverzeichnis und ausdrückliche Bestätigung der nichtmedizinischen Positionierung;
5. erneuter Live-Store- und Registrar-Checkout-Snapshot unmittelbar vor einer Entscheidung – ohne aus technischen Nullantworten Verfügbarkeit abzuleiten.

Bis dahin gilt: **`RowingSage` Agent REJECT als dritter Prototyp; `TempoSage` Agent DEMOTE / REVIEW; `CoachRecall` aktueller, nicht gewählter Challenger; rechtliche Freigabe HOLD; keine Domain- oder Namensverfügbarkeitsgarantie.**
