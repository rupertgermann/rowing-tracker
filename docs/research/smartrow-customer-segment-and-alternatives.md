# Erreichbares SmartRow-Kundensegment und Alternativen

**Ticket:** [Size the reachable SmartRow customer segment and alternatives](https://github.com/rupertgermann/rowing-tracker/issues/88)

**Map:** [Wayfind the Rowing Tracker monetization model](https://github.com/rupertgermann/rowing-tracker/issues/87)  
**Stand:** 2026-08-02 · Primärquellen-Recherche

## Kurzantwort

SmartRow ist ein **realer, aber kleiner und öffentlich nur unvollständig messbarer Nischenmarkt**. Als Größenordnung ist eine globale beobachtbare Produkt-Community von **10.000 bis rund 50.000+ Personen** vertretbar: Google Play weist 10.000+ Downloads aus; SmartRow selbst wirbt mit 50.000+ SmartRowern. Stärker als diese Proxies ist die öffentliche Challenge-API: In den sieben abgeschlossenen Monats-Challenges von Januar bis Juli 2026 erschienen **5.450 eindeutige Teilnehmer**, davon 3.974 in mindestens zwei Challenges und 759 in allen sieben. Auch dieser Wert ist weder ein Maß für alle aktiven individuellen SmartRow-Besitzer noch für direkt erreichbare Kaufinteressenten.

Für die Planung wird deshalb bis zu besseren Daten ein **Arbeits-Ceiling von 50.000 SmartRow-Nutzern weltweit** verwendet, nicht als bestätigter TAM. „50.000+“ ist formal eine Untergrenze der Herstellerbehauptung, kein mathematisches Maximum; 50.000 dient hier bewusst nur als konservativer, runder Szenario-Nenner. Die 5.450 Challenge-Teilnehmer bilden den belastbareren **engaged core**. Wie viele davon unabhängig erreichbar oder zahlungsbereit sind, bleibt offen; die Sensitivitätsrechnung unten zeigt deshalb mehrere Penetrationsraten statt eines Forecasts.

Die Zahlungsbereitschaft ist zweigeteilt:

- Der offizielle SmartRow Power Pulley kostet etwa **300 €** und digitale Ruderprodukte zeigen Abopreise zwischen **4 und 15 pro Monat**; hoch integrierte Angebote reichen bis **39 US-Dollar pro Monat**.
- Gleichzeitig liefert SmartRow selbst ohne Abo bereits präzise Daten, Historie, Workouts, Rennen und Exporte. WaterRower Connect, Intervals.icu und auslaufend Rowsandall setzen starke kostenlose bzw. sehr günstige Anker. **Ein weiteres Dashboard ist deshalb nicht monetarisierbar genug.**

Der erste Paid-Offer sollte ausschließlich auf den Job zielen, den diese Produkte nur teilweise erledigen: **„Sag mir anhand meiner eigenen letzten SmartRow-Workouts, was ich als Nächstes trainieren soll, mit welchen Zielwerten und warum.“** Der beste erste CoreCustomer ist ein selbst trainierender individueller SmartRow-Besitzer mit exportierbaren Workouts, der regelmäßig rudert und aus den Messwerten keine verlässliche nächste Trainingsentscheidung ableitet. SmartRows aktuelle Power-Pulley- und Power-Handle-Produkte unterstützen mehr als 60 Marken; eine Verengung auf WaterRower wäre eine spätere Akquisitionsentscheidung, kein Marktgrößenbefund.

## Evidenzklassen

Dieser Bericht trennt bewusst:

- **Harte Fakten:** aktuell sichtbare Preise, Funktionen, Plattform-Metadaten und angekündigte Produktänderungen.
- **Proxies:** Downloads, Ratings, Herstellerangaben wie „50.000+ Nutzer“ und Reviewvolumen. Sie zeigen Größenordnungen, nicht aktive oder zahlende Nutzer.
- **Annahmen:** Penetrationsraten in der Sensitivitätsrechnung und spätere Qualifizierungs-, Erreichbarkeits- oder Conversion-Modelle.
- **Unbekanntes:** verkaufte SmartRow-Geräte, aktive Nutzer, Exportquote, Nutzungsfrequenz, Geografie, Retention und tatsächliche Zahlungsbereitschaft für dieses Angebot.

## 1. Was über die Marktgröße wirklich bekannt ist

| Befund | Klasse | Bedeutung |
| --- | --- | --- |
| SmartRow bewirbt auf der offiziellen Power-Pulley-Seite eine Community von **50.000+ SmartRowern weltweit**. Die aktuelle Produktfamilie unterstützt neben WaterRower zahlreiche weitere Geräte und die App-Store-Beschreibung nennt inzwischen über 60 Marken. | Herstellerangabe/Proxy · [SmartRow Power Pulley](https://smartrow.fit/shop/smartrow-for-waterrower/), [Google Play](https://play.google.com/store/apps/details?id=nl.appsint.handle&hl=en) (Abruf: 2026-08-02) | 50.000+ ist die beste öffentliche Größenordnung für das gesamte SmartRow-Ökosystem, aber keine Zahl für individuelle WaterRower-Besitzer und kein MAU-Wert. |
| Die öffentliche SmartRow-API listet für Januar bis August 2026 monatliche Challenges. Die abgeschlossenen Challenges Januar–Juli hatten 3.575, 3.050, 2.789, 2.456, 2.415, 2.219 und 1.891 eindeutige Teilnehmer. Über die sieben Monate dedupliziert waren es 5.450 Personen; 3.974 nahmen mindestens zweimal, 759 an allen sieben Challenges teil. | Harter API-Aggregatbefund · [Challenge-Liste](https://smartrow.fit/api/challenge), Leaderboards [Jan](https://smartrow.fit/api/dist-leaderboard?challenge=76), [Feb](https://smartrow.fit/api/dist-leaderboard?challenge=77), [Mär](https://smartrow.fit/api/dist-leaderboard?challenge=78), [Apr](https://smartrow.fit/api/dist-leaderboard?challenge=79), [Mai](https://smartrow.fit/api/dist-leaderboard?challenge=80), [Jun](https://smartrow.fit/api/dist-leaderboard?challenge=81), [Jul](https://smartrow.fit/api/dist-leaderboard?challenge=82) (Abruf und Aggregation: 2026-08-02) | Das ist der stärkste öffentliche Aktivitätsproxy: eine wiederkehrend engagierte Gruppe im niedrigen vierstelligen Bereich pro Monat. Challenge-Teilnahme ist trotzdem weder MAU noch Zahlungs- oder Kontaktierbarkeitsnachweis. |
| Google Play zeigt **10.000+ Downloads**, 206 Reviews in der Top Card und ein Update vom 24.07.2026. Die SmartRow-App ist ohne passende SmartRow-Hardware nur begrenzt sinnvoll. | Plattform-Proxy · [Google Play](https://play.google.com/store/apps/details?id=nl.appsint.handle&hl=en) (Abruf: 2026-08-02) | Das belegt eine fünfstellige Android-Verbreitung, nicht 10.000 aktuelle Eigentümer: Neuinstallationen, Gerätewechsel, Interessenten und gemeinsam genutzte Hardware sind nicht trennbar. |
| Apple veröffentlicht keine Installationszahlen. Sichtbar sind regional 219 Bewertungen in Deutschland, 74 in den USA und 50 in Großbritannien; die App ist dort als kostenlos und englischsprachig gelistet. | Plattform-Proxy · [App Store DE](https://apps.apple.com/de/app/smartrow/id1223542275), [US](https://apps.apple.com/us/app/smartrow/id1223542275), [GB](https://apps.apple.com/gb/app/smartrow/id1223542275) (Abruf: 2026-08-02) | Deutschland/DACH und englischsprachige Märkte sind plausible Startregionen. Ratings dürfen nicht in Nutzerzahlen umgerechnet werden. |
| WaterRower bewirbt für WaterRower Connect eine Community von **70.000+ WaterRower-Nutzern**. WaterRower Connect funktioniert mit S4 Bluetooth, ComModule und SmartRow. | Herstellerangabe/Proxy · [WaterRower-Produktseite](https://www.waterrower.com/wr_us/waterrower/), [Connect-Kompatibilität](https://www.waterrower.com/wr_ca/apps/waterrower-connect/) (Abruf: 2026-08-02) | Diese größere Zahl ist kein zusätzliches SmartRow-Segment. Die Definition und Überlappung mit den 50.000 SmartRowern ist unbekannt. |
| Der SmartRow-Power-Pulley kostet beim offiziellen deutschen WaterRower-/NOHRD-Angebot **300 € inklusive MwSt.** | Harter Preisfakt · [WaterRower/NOHRD DE](https://www.nohrd.com/de/waterrower/) (Abruf: 2026-08-02) | Eigentümer haben bereits spürbar in präzise Trainingsdaten investiert; das qualifiziert Interesse und Kaufkraft, beweist aber keine Abo-Bereitschaft. |

### Abgeleitete Größenordnung

Die vertretbare Aussage ist daher nicht „der Markt hat 50.000 Kunden“, sondern:

1. **Beobachtbares Ökosystem:** 10.000 Android-Downloads bis 50.000+ herstellerseitig behauptete Community-Mitglieder weltweit.
2. **Beobachtbar engagierte Teilmenge:** 5.450 eindeutige Teilnehmer in sieben Monats-Challenges, 3.974 davon wiederholt.
3. **CoreCustomer-Teilmenge:** unbekannt. Es fehlen öffentliche Zahlen zum Anteil individueller SmartRow-Hardwarebesitzer, CSV-Exporteure und selbst trainierender Personen mit Coaching-Bedarf.
4. **Direkt erreichbare Zielgruppe:** ebenfalls unbekannt. Die Hersteller-Community gehört SmartRow/WaterRower; API- und App-Store-Nutzer dürfen nicht individuell als Akquisitionsliste behandelt werden.

Bis Interviews, Landingpage und ein realer Akquisitionskanal gemessen wurden, gilt deshalb folgende Größenordnung:

| Stufe | Evidenz | Größenordnung |
| --- | --- | --- |
| Öffentlich beobachtbare SmartRow-Basis | Plattform- und Herstellerproxies | **10.000–50.000+** weltweit |
| Beobachtbar engagiert | eindeutige Teilnehmer der abgeschlossenen Challenges Januar–Juli 2026 | **5.450**, davon **3.974 wiederholt** |

### Sensitivität, nicht Forecast

Die folgenden Werte zeigen nur, wie viele Kunden unterschiedliche Penetrationsannahmen mathematisch bedeuten würden. Sie sagen nichts über tatsächliche Erreichbarkeit, Conversion oder Retention aus.

| Bezugsbasis | Penetration | Rechnerische Kunden |
| --- | ---: | ---: |
| 50.000 beobachtbares Ökosystem-Ceiling | 0,5 % | 250 |
| 50.000 beobachtbares Ökosystem-Ceiling | 1 % | 500 |
| 50.000 beobachtbares Ökosystem-Ceiling | 3 % | 1.500 |
| 50.000 beobachtbares Ökosystem-Ceiling | 5 % | 2.500 |
| 5.450 engagierte Challenge-Teilnehmer | 1 % | 55 |
| 5.450 engagierte Challenge-Teilnehmer | 3 % | 164 |
| 5.450 engagierte Challenge-Teilnehmer | 5 % | 273 |
| 5.450 engagierte Challenge-Teilnehmer | 10 % | 545 |

SmartRow reicht damit als **Wedge für eine bezahlte Beta**, aber noch nicht als belegter großer Stand-alone-Markt. Umsatz und Tragfähigkeit hängen vom noch offenen Preis, den variablen Kosten und realer Retention ab. Relevantes Wachstum jenseits dieser Nische könnte später zusätzliche kompatible Datenquellen oder eine Partnerschaft erfordern; beides ist hier nicht entschieden.

### Challenge-Kohorte: demografischer und geografischer Proxy

Die Challenge-API stellt Profilattribute je Leaderboard-Eintrag bereit. Für diesen Bericht wurden nur Aggregate über die 5.450 deduplizierten Teilnehmer berechnet; Namen und IDs wurden nicht übernommen:

- 3.979 Teilnehmer, also rund **73 %**, lagen in den Altersklassen 36–59;
- das Profilfeld Geschlecht enthielt 4.872 „Male“ und 578 „Female“, rund **89 % zu 11 %**;
- die Kohorte umfasste **73 verschiedene Länderwerte**.

Quelle und Methode: Challenges 76–82 aus der [offiziellen Challenge-Liste](https://smartrow.fit/api/challenge), je Challenge `dist-leaderboard`, Deduplizierung über `user_id`, Aggregation von Teilnahmehäufigkeit und Profilklassen (Abruf: 2026-08-02). Die API ist dynamisch; die Zahlen sind ein Stichtags-Snapshot. Challenge-Teilnehmer sind selbstselektiert und wahrscheinlich leistungs- und wettbewerbsorientierter als die Gesamtbasis. Das Geschlechterfeld bildet nur die von der API gelieferten binären Kategorien ab und darf nicht als vollständige Demografie des Marktes interpretiert werden.

## 2. Beobachtbares Nutzerverhalten

### Harte Produkt- und Workflow-Signale

- SmartRow positioniert seine Nutzer als datenorientierte Selbsttrainer: direkte Leistungsmessung, Force Curve, persönliche Rekorde, Historie, Sessionvergleich und mehr als 50 strukturierte Workouts gehören inzwischen zum kostenlosen Angebot. Die aktuelle Play-Store-Beschreibung verspricht außerdem Video-/Live-Training, Challenges und Rennen und betont ausdrücklich **kein Abo und keine versteckten Monatskosten** ([Google Play](https://play.google.com/store/apps/details?id=nl.appsint.handle&hl=en), Abruf: 2026-08-02).
- Die Nutzer kombinieren Systeme: SmartRow nennt Dual-Bluetooth/Broadcast zu EXR, Kinomap, Peloton, Zwift und ErgZone sowie Strava-Sharing. Das offizielle Portal erlaubt Downloads in mehreren Formaten und empfiehlt ausdrücklich Spreadsheet- oder weitergehende Analyse mit AI-Tools ([Google Play](https://play.google.com/store/apps/details?id=nl.appsint.handle&hl=en), [SmartRow FAQ](https://smartrow.fit/faq-smartrow-app/), Abruf: 2026-08-02).
- Der manuelle CommercialBeta-Workflow ist technisch plausibel: SmartRow dokumentiert den Export einzelner oder aller Workouts als CSV sowie TCX-Exporte für andere Dienste ([SmartRow FAQ](https://smartrow.fit/faq-smartrow-app/), Abruf: 2026-08-02).
- SmartRow-Nutzer können bereits in der Hersteller-App gegeneinander und gegen eigene Bestleistungen antreten. Monatliche Challenges und Live-/On-demand-Rennen sind kein freier Differenzierungsraum ([SmartRow Power Pulley](https://smartrow.fit/shop/smartrow-for-waterrower/), Abruf: 2026-08-02).

### Qualitative Review-Proxies

Die sichtbaren App-Store-Stimmen sind keine repräsentative Stichprobe, zeigen aber wiederkehrende Jobs und Friktionen:

- präzise Leistung, Kraftkurve, Verlauf und Strava-/Health-Weitergabe werden als Kernnutzen beschrieben;
- Nutzer wünschen verlässlichere Integrationen, bessere Herzfrequenzdaten und weniger Reibung bei Intervallen und Exporten;
- einzelne Nutzer verwenden SmartRow gerade als Datenquelle und EXR oder andere Apps als Erlebnis-/Trainingsschicht.

Belege sind die aktuellen Reviewbereiche bei [Google Play](https://play.google.com/store/apps/details?id=nl.appsint.handle&hl=en), [App Store DE](https://apps.apple.com/de/app/smartrow/id1223542275) und [App Store US](https://apps.apple.com/us/app/smartrow/id1223542275?see-all=reviews) (Abruf jeweils: 2026-08-02). Daraus darf keine Häufigkeit abgeleitet werden; es sind Interviewhypothesen.

### Konsequenz

CSV-Import und Charts lösen keinen neuen Job. Der monetarisierbare Moment liegt **nach** der Analyse: Unsicherheit reduzieren, eine nächste Trainingsentscheidung treffen und Fortschritt über mehrere Wochen an einem persönlichen Ziel messen.

## 3. Aktuelle Alternativen

| Alternative | Aktuelles Angebot | Preis-/Skalensignal | Konsequenz für Rowing Tracker |
| --- | --- | --- | --- |
| **SmartRow App/Portal** | Präzise Schlagdaten, Force Curve, Verlauf, Vergleiche, 50+ Workouts, Video, Rennen, Challenges, Export; kein Abo. | Kostenlos zur ca. 300-€-Hardware · [Google Play](https://play.google.com/store/apps/details?id=nl.appsint.handle&hl=en), [NOHRD-Preis](https://www.nohrd.com/de/waterrower/) (Abruf: 2026-08-02) | Basisanalysen, Workoutbibliothek, Leaderboards und einfache Technikhinweise sind keine tragfähige Paid-Differenzierung. |
| **WaterRower Connect** | Echtzeitdaten, Historie, Vergleich, Strava/Apple Health und Community kostenlos; Premium ergänzt Trainerkurse, Scenic Videos und erweiterte Session-Screens; SmartRow-kompatibel. | ab **4,99 US-Dollar/Monat** · [offizielle Produktseite](https://www.waterrower.com/wr_ca/apps/waterrower-connect/) (Abruf: 2026-08-02) | Setzt einen niedrigen Preisanker direkt im WaterRower-Ökosystem. Paid muss über Inhalte und Screens hinausgehen. |
| **Intervals.icu** | Multisport-Historie, tiefe Analyse, Trainingsplanung, Workout Builder, Coaching/Chat und Integrationen; Rudern wird als eigene Disziplin unterstützt. | Kern dauerhaft kostenlos; Supporter **4 US-Dollar/Monat**; 160.000+ aktive Athleten laut Betreiber · [Produkt](https://www.intervals.icu/), [Preise](https://www.intervals.icu/pricing/) (Abruf: 2026-08-02) | Mächtiger kostenloser Ersatz für generisches Analyse-/Planungsprodukt. Eine SmartRow-spezifische, sofort verständliche Coaching-Antwort muss weniger Arbeit verlangen. |
| **EXR** | Virtuelle Ruderwelt, strukturierte Workouts, Training, Rennen und Fortschritt; SmartRow-kompatibel. | **9,95 €/Monat** im Jahresplan, 11,95 € halbjährlich, 14,95 € monatlich · [Preise](https://exrgame.com/pricing), [SmartRow-Partnersignal](https://smartrow.fit/shop/smartrow-for-waterrower/) (Abruf: 2026-08-02) | Belegt sichtbare Aboangebote im SmartRow-Ökosystem, verkauft aber Erlebnis/Motivation statt bloßer Analyse. |
| **Kinomap** | Scenic Videos, Coaching-Videos, strukturierte Workouts, Live-Sessions und Events; SmartRow-kompatibel. | **11,99 US-Dollar/Monat**, 89,99 US-Dollar/Jahr · [Preise](https://www.kinomap.com/get-started), [SmartRow-Kompatibilität](https://smartrow.fit/shop/smartrow-for-waterrower/) (Abruf: 2026-08-02) | Weiteres Zahlungsbereitschaftssignal für geführtes Training; nicht mit Videoangebot kopieren. |
| **Ergatta Upgrade** | WaterRower-Touchscreen, gamifizierte Workouts, personalisierte Programme, Community und Coach AI/Formfeedback; mit besonderer Halterung SmartRow-kompatibel. | **549 US-Dollar Hardware**, 39 US-Dollar monatlich bzw. 32,50 US-Dollar/Monat jährlich; 100.000+ Mitglieder laut Anbieter · [Upgrade-Paket](https://ergatta.com/products/upgrade-package) (Abruf: 2026-08-02) | Belegt eine hochpreisige Outcome-/Engagement-Schicht. Für CommercialBeta bleibt Form-/Mocap-Analyse ausgeschlossen; Differenzierung muss aus Workoutdaten kommen. |
| **Rowsandall** | Ruderspezifische Analyse, Planung und Coaching; unterstützt SmartRow CSV direkt. | Schließt zum **31.12.2026**; keine neuen Aboverlängerungen seit 01.01.2026. Betreiber nennt schneller steigende Infrastrukturkosten als Aboerlöse. · [EOL-Ankündigung](https://analytics.rowsandall.com/2025/12/07/the-last-year-rowsandall-will-disappear-what-now/) (Abruf: 2026-08-02) | Kurzfristige Lücke, aber deutliche Warnung: eine kleine Zielgruppe plus komplexes Analyseprodukt trägt den SaaS-Betrieb nicht automatisch. |

Rowsandall hatte bereits 2025 teurere Self-Coach-/Coach-Tarife in einen einfacheren Pro-Plan überführt und nannte zu wenige Nutzer der komplexeren Tarife als Grund ([offizielle Planänderung](https://analytics.rowsandall.com/2025/01/01/plan-and-subscription-changes-lower-prices/), Abruf: 2026-08-02). Die geplante Migration zu Intervals.icu reduziert das Opportunity Window zusätzlich: SmartRow CSV und ruderspezifische Felder stehen auf der Portierungsliste, während die Umsetzung im März 2026 noch nicht abgeschlossen war ([EOL-/Migrationsliste](https://analytics.rowsandall.com/2025/12/07/the-last-year-rowsandall-will-disappear-what-now/), [Migrationsstand](https://analytics.rowsandall.com/2026/03/17/update-on-rowsandall-to-intervals-icu-migration/), Abruf: 2026-08-02).

## 4. Zahlungsbereitschaft: positive und negative Signale

### Positive Signale

1. **Vorqualifizierte Hardwareausgabe:** Der SmartRow Power Pulley kostet im offiziellen deutschen Shop 300 € und wird über präzisere, vergleichbare Trainingsdaten verkauft ([NOHRD](https://www.nohrd.com/de/waterrower/), Abruf: 2026-08-02).
2. **Mehrere laufende Aboangebote:** WaterRower Connect, EXR und Kinomap bepreisen digitale Ruderschichten sichtbar zwischen 4,99 und 14,95 pro Monat ([WaterRower Connect](https://www.waterrower.com/wr_ca/apps/waterrower-connect/), [EXR](https://exrgame.com/pricing), [Kinomap](https://www.kinomap.com/get-started), Abruf: 2026-08-02).
3. **Höherer Outcome-Preis ist möglich:** Ergatta verlangt 32,50–39 US-Dollar pro Monat für Personalisierung, Engagement, Programme und Coach AI – allerdings in einem integrierten Hardware-/Content-Ökosystem ([Ergatta](https://ergatta.com/products/upgrade-package), Abruf: 2026-08-02).
4. **Datenportabilität ist etabliert:** SmartRow selbst ermöglicht CSV/TCX-Export und nennt weitergehende AI-Analyse als Verwendung. Das senkt die Verhaltenshürde für einen manuellen Beta-Import ([Google Play](https://play.google.com/store/apps/details?id=nl.appsint.handle&hl=en), [FAQ](https://smartrow.fit/faq-smartrow-app/), Abruf: 2026-08-02).

### Negative Signale

1. **Der Default ist kostenlos:** SmartRow wirbt ausdrücklich ohne Abo; Intervals.icu bietet den Kern für 0 US-Dollar, WaterRower Connect viele Kernfunktionen kostenlos ([SmartRow](https://play.google.com/store/apps/details?id=nl.appsint.handle&hl=en), [Intervals.icu](https://www.intervals.icu/pricing/), [WaterRower Connect](https://www.waterrower.com/wr_ca/apps/waterrower-connect/), Abruf: 2026-08-02).
2. **Pure Analytics hat einen niedrigen Anker:** Intervals.icu verlangt nur 4 US-Dollar für Supporter; kostenlose Funktionen umfassen bereits Analyse und Planung ([Intervals.icu Pricing](https://www.intervals.icu/pricing/), Abruf: 2026-08-02).
3. **Nischen-SaaS-Betrieb ist nachweislich schwierig:** Rowsandall berichtet steigende Nutzerzahlen, aber schneller wachsende Infrastrukturkosten als Aboerlöse und beendet den Dienst ([Rowsandall EOL](https://analytics.rowsandall.com/2025/12/07/the-last-year-rowsandall-will-disappear-what-now/), Abruf: 2026-08-02).
4. **Preise sind keine Conversion:** Die Existenz von EXR-, Kinomap- oder Ergatta-Tarifen beweist nicht, welcher Anteil der SmartRow-Besitzer zahlt, bleibt oder für ein datenbasiertes AI-Coaching zahlen würde.

**Schlussfolgerung:** Die Quellen stützen einen zu testenden Korridor für ein wertorientiertes Coaching-Angebot, aber noch keinen finalen Preis. [Establish unit economics and a defensible price corridor](https://github.com/rupertgermann/rowing-tracker/issues/92) muss echte Zahlungsdaten und Kosten zusammenführen. Für diese Marktentscheidung zählt nur: Unterhalb von generischer Analyse, oberhalb von Charts – bezahlt wird die konkrete Trainingsentscheidung und ihre wiederholte Anpassung.

## 5. Konsequenz für den ersten CoreCustomer-Offer

### Enger CoreCustomer

> Ein individueller SmartRow-Besitzer mit exportierbaren Workouts in DACH oder einem englischsprachigen Markt, der regelmäßig selbständig trainiert, mehrere historische Workouts exportieren kann und zwar Daten sieht, aber unsicher ist, welches Training als Nächstes den gewünschten Fortschritt bringt.

Das gilt unabhängig davon, ob die Daten von einem Power Pulley oder Power Handle und damit von WaterRower oder einer anderen offiziell unterstützten Gerätemarke stammen. Welches Hardware-/Community-Segment zuerst angesprochen wird, entscheidet das nachgelagerte Ticket [Choose the first permission-led acquisition path](https://github.com/rupertgermann/rowing-tracker/issues/93).

Nicht Ziel des ersten Offers sind Gelegenheitsnutzer, Coaches/Clubs, Personen ohne SmartRow, Käufer primär wegen virtueller Landschaften/Rennen sowie Nutzer, die bereits einem persönlichen Coach oder einem zufriedenstellenden strukturierten System folgen.

### Empfohlenes PaidOutcome

**„SmartRow Training Review + nächste drei Einheiten“**

Nach einem CSV/ZIP-Import erhält der Nutzer:

1. eine verständliche Bewertung der letzten Trainingswochen gegen sein selbst gewähltes Ziel;
2. einen nicht offensichtlichen, mit den eigenen Daten belegten Engpass oder Fortschritt;
3. drei konkrete nächste Einheiten mit Zielwerten für Leistung/Pace, Schlagfrequenz und optional Herzfrequenz;
4. eine kurze Begründung, woran die nächste Anpassung gemessen wird;
5. nach neuen Imports eine fortlaufende Anpassung und einen Wochenrückblick.

Free bleiben Import, Verlauf und Basisdiagramme. Paid ist die wiederholte, personalisierte Entscheidungshilfe. Ausgeschlossen bleiben Live-Rudern, Video-/Scenic Content, Rennen, Hardwaresteuerung und Mocap/Formanalyse.

### Noch nicht entschieden

Konkrete Schwellen für Interviews, Aktivierung, wiederholte Nutzung, Zahlung und Abbruch gehören in [Define the paid-beta validation contract](https://github.com/rupertgermann/rowing-tracker/issues/95). Dieser Bericht liefert dafür Marktgrößen- und Wettbewerbsevidenz, beschließt aber keinen zweiten Wayfinder-Baustein.

## 6. Offene Unbekannte und nächste Forschungsschritte

Vor einer größeren Investition müssen durch Interviews, Landingpage-Experimente oder eine offizielle Anfrage an SmartRow geklärt werden:

- Zahl verkaufter Power Pulleys und Power Handles, Geräte-/Markenverteilung und Anteil individueller Besitzer;
- monatlich aktive Nutzer und durchschnittliche Workouts pro aktivem Nutzer;
- Anteil der Nutzer, die CSV/ZIP exportieren oder Strava/EXR/Kinomap verbinden;
- Länder- und Sprachverteilung;
- Anteil selbst trainierender Nutzer ohne Coach/Plan;
- wichtigste Ziele: Gesundheit, Gewichtsreduktion, 2k-Leistung, Ausdauer, Wettkampf oder allgemeine Regelmäßigkeit;
- aktuelle Nutzung und Zufriedenheit mit SmartRow Insights, WaterRower Connect, EXR, Kinomap, Intervals.icu und Rowsandall;
- reale Conversion und Retention bei zwei bis drei bezahlten Offer-Varianten.

Ohne diese Daten bleibt die korrekte strategische Haltung: **nischenfähige Beta ja, belegtes großes Geschäft nein**. Das Angebot muss zunächst mit echten Zahlungen beweisen, dass bessere nächste Trainingsentscheidungen einen wiederholten Wert besitzen; erst danach ist eine Erweiterung über SmartRow hinaus rational.
