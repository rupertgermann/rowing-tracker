# Unit Economics und belastbarer Preiskorridor für den Paid Plan

> **Historische Recherche.** Die Monetarisierungspläne für Rowing Tracker wurden eingestellt. Es gibt kein kostenpflichtiges Abo. Der aktuelle Code steht unter [GPLv3-only](../../LICENSE).

**Ticket:** [Establish unit economics and a defensible price corridor](https://github.com/rupertgermann/rowing-tracker/issues/92)

**Map:** [Wayfind the Rowing Tracker monetization model](https://github.com/rupertgermann/rowing-tracker/issues/87)

**Stand:** 2026-08-02 · Deutschland-only, invite-only CommercialBeta · alle Endkundenpreise brutto inklusive 19 % deutscher Umsatzsteuer

Dies ist eine Produkt- und Planungsentscheidung, keine Steuer- oder Rechtsberatung. Anbieterpreise, Wechselkurse, individuelle Verträge und steuerliche Einordnung müssen unmittelbar vor dem ersten Verkauf bestätigt werden.

## Kurzentscheidung

Der Paid Plan ist bei kontrollierter AI- und Support-Nutzung wirtschaftlich plausibel. Er ist jedoch **kein Unlimited-AI-Produkt** und bei 20 zahlenden Personen noch eine Lernkohorte, kein profitabler Betrieb.

1. **Planungsanker:** **14,99 € pro Monat** oder **149 € pro Jahr**, jeweils brutto inklusive 19 % USt. Das Jahresabo entspricht 12,42 € pro Monat und rund 17 % Rabatt gegenüber zwölf Monatszahlungen.
2. **Belastbarer Testkorridor:** **12,99–16,99 € pro Monat** beziehungsweise **129–169 € pro Jahr**. 12,99/129 ist die konditionale harte Untergrenze, nicht der bevorzugte Preis; sie setzt nachgewiesen höchstens 1,00 € AI-Kosten und keinen zusätzlichen Provider-Fixpreis voraus. Darunter wird weder rabattiert noch dauerhaft verkauft, solange das Produkt Hosted AI und persönlichen Support enthält.
3. **Checkout-Reihenfolge:** Die ersten 20 zahlenden Beta-Nutzer erhalten nur das Monatsabo zu 14,99 €. Das Jahresabo zu 149 € wird erst freigeschaltet, wenn mindestens acht Wochen bezahlte Nutzung, die Supportzeit und die tatsächliche AI-Kostenverteilung vorliegen. Der Jahrespreis ist trotzdem jetzt als Planungsanker beschlossen.
4. **Keine kostenlose Testphase:** Zahlung beginnt an Tag 1. Das ersetzt oder verkürzt weder den unten beschriebenen 14-Tage-Erstattungsweg noch unabdingbare gesetzliche Rechte.
5. **Zahlung und Steuer:** Für die Beta wird **Paddle als Merchant of Record (MoR)** verwendet, vorbehaltlich erfolgreicher Anbieterprüfung und Vertragsfreigabe. Paddle veröffentlicht 5 % plus 0,50 US-Dollar pro Checkout-Transaktion ohne monatliche Grundgebühr und übernimmt als MoR unter anderem Zahlungsabwicklung, indirekte Steuer-Compliance, Rechnungen, Fraud/Disputes und Payment-Support ([Paddle Pricing](https://www.paddle.com/pricing), [Paddle MSA § 3](https://www.paddle.com/legal/terms)). Im Modell wird der fixe Dollarbetrag konservativ als **0,50 €** angesetzt; tatsächliche Abrechnungs-/FX-Regeln sind vor Launch zu verifizieren.
6. **AI-Fair-Use pro Kalendermonat:** 13 Workout-Reviews, vier Wochenreviews/Plananpassungen, ein vollständiger Plan-Neustart und 20 Coaching-Nachfragen, also höchstens **38 abrechenbare AI-Aktionen**. Kein Rollover, keine Bilder, Dateien, Memory, Mocap, medizinischen Inhalte oder versteckten Tool-Loops. Interner Kostenansatz: **1,00 € pro zahlender Person und Monat**; Warnung bei 0,75 €, harte Sperre bei 1,25 €.
7. **Support:** asynchron per E-Mail, Antwortziel zwei deutsche Werktage, keine Lösungs-/Uptime-SLA. Produkt-/Account-/Import-/Billing-/Datenschutzprobleme sind enthalten; Trainingsberatung, Dateninterpretation durch einen Menschen, Telefonsupport und individuelle Pläne sind ausgeschlossen. Der nachhaltige interne Zielwert ist **drei Minuten Support pro zahlender Person und Monat zu 60 €/h = 3,00 €**. Einmaliges manuelles Beta-Onboarding ist als Lern-/CAC-Aufwand auf höchstens 15 aktive Minuten pro Person gedeckelt und wird getrennt erfasst.
8. **Reserve und Margenziele:** 5 % des Bruttopreises werden für Refunds/Chargebacks reserviert. Technische Bruttomarge nach Payment, Refundreserve und AI muss mindestens 75 % des Nettoumsatzes betragen. Bei 100 Zahlenden muss der vollständig belastete Deckungsbeitrag nach Support und 60 € Basis-Fixkosten mindestens 40 % des Nettoumsatzes erreichen.
9. **OpenAI-Vertragsgrenze:** Der veröffentlichte 10-%-Aufschlag für regionale Verarbeitung ist im AI-Budget enthalten. Ein unbekannter fixer Preis oder Mindestumsatz für EU-Projekt plus genehmigtes ZDR/MAM ist **nicht** eingerechnet. Für die erste, monatlich zahlende 20er-Lernkohorte ist während des vorab festgelegten Beta-Zeitraums eine bewusst nicht nachhaltige Validierungsgrenze von **höchstens 40 € pro Monat** erlaubt; danach bleiben rund 12,7 % Deckungsbeitragsmarge. Ab 100 Zahlenden gilt die nachhaltige Jahresanker-Formel in Abschnitt 8: rund 90 € bei 100 und 690 € bei 500 Zahlenden. Überschreitet ein Angebot die jeweils geltende Grenze, startet Hosted AI nicht.

## 1. Bindender Scope und Evidenzklassen

Der Bericht übernimmt die bereits beschlossene [Hosted-AI-Privacy-Grenze](./hosted-ai-privacy-boundary.md): Deutschland, 18+, ausschließlich serverseitiger Operator-Key, EU-Projekt, DPA und genehmigtes ZDR/MAM; keine Herzfrequenz, Alter, Gewicht, Watt/kg, Uploads, Profile, Memory, Mocap/FreeMoCap oder medizinische Beratung. Fehlende Provider-Nachweise schalten Hosted AI ab.

Die Kosten werden in vier Klassen getrennt:

- **Veröffentlichter Preis:** aktuell auf der offiziellen Anbieter-/Gesetzesseite sichtbar.
- **Modellannahme:** vorsichtiger Planungswert, noch keine reale Rechnung.
- **Produktentscheidung:** Grenze, die CommercialBeta technisch und vertraglich durchsetzen muss.
- **Unbekannt/Quote:** darf nicht stillschweigend als 0 € behandelt werden und besitzt ein eigenes Go/No-go-Gate.

Alle USD-Kosten werden im Basismodell vorsichtig mit **1 USD = 1 EUR** geplant. Das ist kein Wechselkurs-Fakt, sondern ein einfaches Risikopolster. Umsatz ist immer ohne Umsatzsteuer zu rechnen; der deutsche Regelsteuersatz beträgt 19 % ([§ 12 Abs. 1 UStG](https://www.gesetze-im-internet.de/ustg_1980/__12.html)).

## 2. Was der aktuelle Code für die Kostenrechnung bedeutet

### Fakt: Modelle und maximale Ausgaben sind vorhanden, Usage-Metering fehlt

- Die aktuellen Defaults verwenden `gpt-5.4-mini` für Chat und Insights, `gpt-5.5` mit hohem Reasoning für Trainingspläne sowie global `maxTokens: 4000` ([Settings](../../src/lib/settings.ts#L259-L284)). Titel werden separat mit `gpt-5.4-nano` und maximal 50 Output-Tokens erzeugt ([Cloud AI](../../src/lib/cloudAI.ts#L436-L455)).
- Insights, neue Trainingspläne, Planänderungen und Adherence-Analysen können jeweils bis zu 4.000 Output-/Reasoning-Tokens anfordern ([Insights](../../src/lib/cloudAI.ts#L1068-L1079), [Planerzeugung](../../src/lib/cloudAI.ts#L1411-L1422), [Planänderung](../../src/lib/cloudAI.ts#L1490-L1501), [Adherence](../../src/lib/cloudAI.ts#L1567-L1577)).
- Die Antwortverarbeitung gibt derzeit ID und Text zurück, aber keine `usage`-Werte. Ohne gespeicherte Input-, Cached-Input-, Output- und Reasoning-Tokens je Aktion können Kostenlimit, Refundanalyse und Preisvalidierung nicht belegt werden ([API-Aufruf](../../src/lib/cloudAI.ts#L546-L562)). Usage-Metering ist deshalb ein Release-Gate.

### Fakt: der bestehende Client-Pfad ist weder privacy- noch kostenfest

- Der Key kommt aktuell aus Nutzersettings oder `NEXT_PUBLIC_OPENAI_API_KEY`; die AI-Anfrage läuft aus dem Client ([Initialisierung](../../src/lib/cloudAI.ts#L123-L147), [Umgebungsbeispiel](../../.env.example#L47-L57)).
- Chat setzt `store: true`, kann `previous_response_id` fortführen und bis zu fünf Tool-Turns auslösen ([Chat-Loop](../../src/lib/cloudAI.ts#L376-L424)). Eine sichtbare Chataktion ist damit nicht zwingend genau ein Modellaufruf.
- Das serverseitige `/api/chat`-Limit von 20 Requests pro Minute begrenzt momentan das Speichern von Chatdaten, nicht verlässlich die direkten Browser-Aufrufe bei OpenAI ([Chat-Route](../../src/app/api/chat/route.ts#L167-L183), [Client-Aufruf](../../src/hooks/useChat.ts#L314-L365)).
- Das Repository enthält Vercel Blob, Upstash Redis/Ratelimit und Nodemailer, aber keinen fest gewählten Produktions-SMTP- oder Observability-Dienst ([Dependencies](../../package.json#L45-L87), [Environment](../../.env.example#L34-L64)). Blob/Mocap und AI-Bildgenerierung sind im Beta-Angebot ausgeschlossen und werden daher mit 0 € modelliert.

**Produktentscheidung:** CommercialBeta erhält genau einen serverseitigen, metergestützten Responses-Aufruf pro abrechenbarer AI-Aktion, `store:false`, keine Tools/Attachments/Response-Kette und ein gepinntes Modell-Snapshot. Provider-Usage und intern geschätzte Usage werden je Aktion content-frei gespeichert. Fehlende Usage-Werte sind ein Fehler, kein kostenloser Request.

## 3. Aktuelle Anbieterpreise

### OpenAI

- `gpt-5.4-mini` kostet veröffentlicht **0,75 US-Dollar pro 1 Mio. Input-Tokens** und **4,50 US-Dollar pro 1 Mio. Output-Tokens**; `gpt-5.4-nano` kostet 0,20/1,25 US-Dollar ([OpenAI GPT-5.4 mini/nano](https://openai.com/index/introducing-gpt-5-4-mini-and-nano/), [Modellseite](https://developers.openai.com/api/docs/models/gpt-5.4-mini)).
- `gpt-5.5` kostet **5 US-Dollar pro 1 Mio. Input-Tokens** und **30 US-Dollar pro 1 Mio. Output-Tokens** ([OpenAI GPT-5.5](https://developers.openai.com/api/docs/models/gpt-5.5)). Reasoning-Tokens werden als Output berechnet; das Produkt muss sie innerhalb des Output-Caps messen.
- OpenAI veröffentlicht für data-residency-fähige Modelle ab 5. März 2026 einen **10-%-Aufschlag**. Europa unterstützt `/v1/responses` mit regionaler Speicherung und Verarbeitung für die hier verwendeten Snapshots, erfordert für Nicht-US-Regionen aber Genehmigung für MAM oder ZDR und ein Modified-Retention-Amendment ([OpenAI Data Controls](https://developers.openai.com/api/docs/guides/your-data#data-residency-controls)). ZDR/MAM ist genehmigungspflichtig; ein öffentlicher fester Zusatzpreis wird dort nicht genannt.
- Standardmäßig können Abuse-Monitoring-Inhalte bis zu 30 Tage gehalten werden. Bei Responses beträgt Application-State standardmäßig mindestens 30 Tage; ZDR behandelt `store` als `false` ([OpenAI Data Controls](https://developers.openai.com/api/docs/guides/your-data#data-retention-controls-for-abuse-monitoring)). Diese Bedingungen sind nicht gegen ein günstigeres Kostenmodell eintauschbar.

### Hosting, Datenbank und Hilfsdienste

- Vercel Pro veröffentlicht eine **20-US-Dollar-Plattformgebühr pro Monat** mit einem Deploying Seat und 20 US-Dollar Usage Credit ([Vercel Pro](https://vercel.com/docs/plans/pro-plan)). Die Vercel-DPA gilt für Pro und Enterprise; Functions laufen ohne Konfiguration standardmäßig in `iad1`/USA, während `fra1` Frankfurt verfügbar ist ([Vercel DPA](https://vercel.com/legal/dpa), [Vercel Regions](https://vercel.com/docs/regions)). Frankfurt-/DPA-Konfiguration ist Release-Gate, kein Preisaufschlag im Modell.
- Supabase Pro startet bei **25 US-Dollar pro Monat**, enthält 100.000 MAU, 8 GB Datenbank, 250 GB Egress, tägliche Backups mit sieben Tagen Aufbewahrung und 10 US-Dollar Compute Credit für ein Micro-Projekt ([Supabase Pricing](https://supabase.com/pricing), [Compute](https://supabase.com/docs/guides/platform/manage-your-usage/compute), [Backups](https://supabase.com/docs/guides/platform/backups)). Frankfurt ist als Region verfügbar; der aktuelle DPA ist separat zu akzeptieren ([Supabase Regions](https://supabase.com/docs/guides/platform/regions), [Supabase DPA](https://supabase.com/downloads/docs/Supabase%2BDPA%2B260601.pdf)).
- Upstash Redis veröffentlicht 0,20 US-Dollar pro 100.000 Commands im Pay-as-you-go-Tarif sowie einen Fixed-Tarif ab 10 US-Dollar pro Monat; der Free-Tarif umfasst 500.000 Commands ([Upstash Redis Pricing](https://upstash.com/pricing/redis)). Der Beta-Stack rechnet Upstash, SMTP, Domain und content-freies Monitoring gemeinsam in einer 15-€-Reserve, bis die echten Anbieter feststehen.
- Das Modell setzt daher **60 € technische Basis-Fixkosten pro Monat** an: 20 € Vercel + 25 € Supabase + 15 € Betriebsreserve. Vercel-/Supabase-Preise sind in USD veröffentlicht; die 1:1-Umrechnung und 15 € Reserve sind Annahmen. Steuerberatung, Rechtsprüfung, Gewerbe, Versicherung, Entwicklung und Betreiberlohn außerhalb des gemessenen Supports sind nicht enthalten: Der Deckungsbeitrag ist nicht Gewinn.

### Payment-Optionen

| Option | Veröffentlichter Preis | Verantwortung | Beta-Entscheidung |
| --- | --- | --- | --- |
| Paddle Checkout | 5 % + 0,50 US-Dollar pro Checkout; keine Monatsgebühr | Paddle ist Reseller/MoR und bündelt Payment, Billing, indirekte Steuer-Compliance, Rechnungen, Fraud/Disputes und Payment-Support ([Pricing](https://www.paddle.com/pricing), [MSA](https://www.paddle.com/legal/terms)) | **Gewählt**, vorbehaltlich Anbieter-Onboarding, DPA/Data-Sharing- und Produktfreigabe |
| Stripe direkt | 1,5 % + 0,25 € für Standard-EEA-Karten; Billing PAYG weitere 0,7 % des Billing-Volumens; Tax Basic 0,5 % No-Code bzw. 0,45 € API-Transaktion ([Stripe DE](https://stripe.com/en-de/pricing)) | Rowing Tracker bleibt Verkäufer und trägt VAT-Registrierung/-Abführung, Widerruf, Rechnungen und Support selbst; Stripe Tax berechnet, ist aber kein MoR | Fallback erst nach Steuer-/Rechtsfreigabe |
| Stripe Managed Payments | weitere 3,5 % zusätzlich zu Payments; MoR-Leistungen ([Stripe DE](https://stripe.com/en-de/pricing)) | MoR | Nicht parallel integrieren; vor einem Wechsel neu vergleichen |

Bei 14,99 € kostet Paddle im Modell 1,25 € je Monatszahlung. Stripe direkt mit EEA-Karte, Billing und Tax Basic läge rechnerisch bei etwa 0,65 €; die Differenz beträgt rund 0,59 € je Zahlung beziehungsweise 297 € bei 500 Monatszahlungen. Bis dahin ist die eingesparte Betreiber-/Steuerkomplexität wertvoller als zwei Payment-Integrationen. **Review-Gate:** bei 500 Zahlenden oder 250 € nachgewiesener monatlicher Gebührenersparnis wird MoR versus direkter PSP neu entschieden.

## 4. AI-Usage-Vertrag für eine Person mit drei Workouts pro Woche

Die folgende Allowance ist eine Produktentscheidung. Imports, Verlauf und lokale Basisdiagramme sind nicht AI-limitiert; nur Hosted-AI-Aktionen zählen.

| Aktion | Monatsmenge | Modell | harter Token-Cap je Aktion | Monatskosten bei Listenpreis inkl. EU +10 % |
| --- | ---: | --- | ---: | ---: |
| Direktes Workout-Review mit einer nächsten Empfehlung | 13 | `gpt-5.4-mini` | 4.000 Input / 800 Output inkl. Reasoning | ca. 0,09 € |
| Wochenreview und Anpassung der nächsten drei Einheiten | 4 | `gpt-5.4-mini` | 12.000 Input / 2.000 Output inkl. Reasoning | ca. 0,08 € |
| Vollständiger Plan-Neustart | 1 | `gpt-5.5` | 30.000 Input / 6.000 Output inkl. Reasoning | ca. 0,36 € |
| Coaching-Nachfrage | 20 | `gpt-5.4-mini` | 8.000 Input / 1.500 Output inkl. Reasoning | ca. 0,28 € |
| Kurztitel, Systemoverhead, Rundung | innerhalb der obigen 38 Aktionen | `gpt-5.4-nano`/kein eigener Aufruf bevorzugt | minimal | < 0,02 € |
| **Listenpreis-Summe** | **38** | | | **ca. 0,84 €** |

Formel: `(Inputtokens / 1.000.000 × Inputpreis + Outputtokens / 1.000.000 × Outputpreis) × 1,10`. Mit 1 USD = 1 EUR und einem Puffer für Rundung, Retry und Modellabweichung werden **1,00 € AI-COGS pro Nutzer/Monat** geplant.

Harte Regeln:

- Ein Kalendermonat endet bei 38 Aktionen. Keine Übertragung in den Folgemonat, kein käufliches Token-Add-on in der Beta.
- Nutzer sehen verbleibende Reviews/Plananpassungen/Nachfragen, nicht eine irreführende „unbegrenzte“ Zusage.
- Der Server warnt bei 0,75 € gemessenen Providerkosten; bei 1,25 € oder Erreichen eines Feature-Caps wird Hosted AI bis zum nächsten Zyklus gesperrt. Import/Charts bleiben verfügbar.
- Automatische Retries zählen in die interne Kostengrenze, aber nicht doppelt gegen die Nutzer-Allowance, solange kein Ergebnis geliefert wurde. Höchstens ein Retry.
- AI-Bilder, Achievement-Bilder/-Stories, Uploads/PDFs, Memory, Tool-Aufrufe, lange Response-Ketten, Mocap und medizinische Verarbeitung gehören nicht zum Paid Plan.
- Der Plan-Neustart ist der einzige `gpt-5.5`-Call. Workout-/Wochenreview und Chat bleiben auf dem gepinnten Mini-Snapshot, bis ein Eval einen Qualitätsmangel belegt. Modellwechsel benötigen Kosten-/Qualitäts-Rebenchmarking.

## 5. Unit-Economics-Formel

Für einen Bruttopreis `G`, `N` zahlende Nutzer und einen optionalen monatlichen ZDR/MAM-Fixpreis `Z` gilt:

```text
Nettoumsatz je Nutzer             R = G / 1,19
Paddle Monatszahlung              Pm = 0,05 × G + 0,50
Paddle Jahreszahlung pro Monat    Pa = (0,05 × Jahrespreis + 0,50) / 12
Refund-/Chargebackreserve         F = 0,05 × G
AI-Kostenreserve                  A = 1,00
Steady-State-Support              S = 3 min × 60 €/h = 3,00
Basis-Fixkosten je Nutzer         B = 60 / N
Deckungsbeitrag je Nutzer         C = R − P − F − A − S − B − Z/N
Deckungsbeitragsmarge             M = C / R
```

Nicht enthalten sind einmalige Entwicklung, juristische Prüfung, DPIA/ROPA, Payment-Onboarding, Steuerberatung und Beta-Interviews. Diese Kosten müssen als separates Launchbudget freigegeben werden. Ebenfalls nicht enthalten: Einkommen-/Gewerbesteuer und Betreiberlohn jenseits der gemessenen Supportzeit.

## 6. Szenarien bei 20, 100 und 500 Zahlenden

### Anker: 14,99 € monatlich

Pro Nutzer und Monat: 14,99 € brutto; 12,60 € Nettoumsatz; 1,25 € Paddle; 0,75 € Refundreserve; 1,00 € AI; 3,00 € Support. Vor den 60 € Basis-Fixkosten bleiben 6,60 €.

| Zahlende | Bruttoumsatz/Monat | Nettoumsatz nach USt | Basis-Fixkosten pro Nutzer | Deckungsbeitrag gesamt | Deckungsbeitrag pro Nutzer | Marge auf Nettoumsatz |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 299,80 € | 251,93 € | 3,00 € | 71,95 € | **3,60 €** | **28,6 %** |
| 100 | 1.499,00 € | 1.259,66 € | 0,60 € | 599,76 € | **6,00 €** | **47,6 %** |
| 500 | 7.495,00 € | 6.298,32 € | 0,12 € | 3.238,78 € | **6,48 €** | **51,4 %** |

### Anker: 149 € jährlich, auf Monatsbasis verteilt

Pro Nutzer und Monat: 12,42 € brutto; 10,43 € Nettoumsatz; 0,66 € Paddle; 0,62 € Refundreserve; 1,00 € AI; 3,00 € Support. Vor Basis-Fixkosten bleiben 5,15 €.

| Zahlende | Bruttoäquivalent/Monat | Nettoumsatz nach USt | Basis-Fixkosten pro Nutzer | Deckungsbeitrag gesamt | Deckungsbeitrag pro Nutzer | Marge auf Nettoumsatz |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 248,33 € | 208,68 € | 3,00 € | 43,01 € | **2,15 €** | **20,6 %** |
| 100 | 1.241,67 € | 1.043,42 € | 0,60 € | 455,07 € | **4,55 €** | **43,6 %** |
| 500 | 6.208,33 € | 5.217,09 € | 0,12 € | 2.515,36 € | **5,03 €** | **48,2 %** |

Das 20-Nutzer-Szenario finanziert den laufenden technischen Stack, aber keine realistische Produktentwicklung, Compliance-Beratung oder intensives Onboarding. Es ist eine bezahlte Lernkohorte. 100 Zahlende sind die erste Größenordnung, in der die beschlossene Marge und ein kleiner Reinvestitionsbetrag gleichzeitig plausibel werden.

## 7. Preis- und Kostensensitivität

### Preiskorridor bei 100 Zahlenden

Annahmen: Paddle, 5 % Refundreserve, 1 € AI, drei Minuten Support, 60 € Basis-Fixkosten.

| Preis | Effektiver Bruttopreis/Monat | Deckungsbeitrag pro Nutzer | Marge auf Nettoumsatz | Einordnung |
| --- | ---: | ---: | ---: | --- |
| 12,99 € monatlich | 12,99 € | 4,52 € | 41,4 % | konditionale Untergrenze; nur bei gemessener AI ≤0,90 € und ohne Provider-Fixpreis |
| **14,99 € monatlich** | **14,99 €** | **6,00 €** | **47,6 %** | **Planungsanker** |
| 16,99 € monatlich | 16,99 € | 7,48 € | 52,4 % | Zahlungsbereitschafts-Test, nicht stillschweigend als Default |
| 129 € jährlich | 10,75 € | 3,32 € | 36,7 % | harte Jahresuntergrenze; verfehlt 40-%-Ziel knapp |
| **149 € jährlich** | **12,42 €** | **4,55 €** | **43,6 %** | **Planungsanker nach Retention-Gate** |
| 169 € jährlich | 14,08 € | 5,78 € | 48,9 % | oberer Preistest |

Der Anker liegt damit am oberen Rand von EXRs heute sichtbarem 14,95-€-Monatspreis, aber weit unter dem hoch integrierten Ergatta-Angebot. Das ist nur vertretbar, wenn Rowing Tracker wirklich die bezahlte Outcome-Zusage liefert: eigene Daten in eine nachvollziehbare nächste Trainingsentscheidung und deren wiederholte Anpassung übersetzen. Der Wettbewerbsvergleich und seine Primärquellen stehen im [Marktbericht](./smartrow-customer-segment-and-alternatives.md#3-aktuelle-alternativen).

### Sensitivität von AI und Support am Monatsanker, 100 Zahlende

Jede zusätzliche Supportminute kostet bei 60 €/h exakt 1 € je Nutzer und Monat. Support ist deshalb der größere Hebel als Modell-Tokens.

| AI-Kosten/Nutzer | 3 min Support | 6 min Support | 12 min Support |
| ---: | ---: | ---: | ---: |
| 0,50 € | 6,50 € (51,6 %) | 3,50 € (27,8 %) | −2,50 € |
| **1,00 €** | **6,00 € (47,6 %)** | **3,00 € (23,8 %)** | **−3,00 €** |
| 3,00 € | 4,00 € (31,7 %) | 1,00 € (7,9 %) | −5,00 € |

**Hard gate:** Überschreitet der rollierende Acht-Wochen-Mittelwert drei Supportminuten oder 1 € AI-Kosten pro zahlender Person, ist der Anker nicht mehr bestätigt. Zuerst werden Ursachen/UX/Allowance korrigiert; nicht stillschweigend mehr Kosten akzeptieren. Ab sechs Minuten Support oder 3 € AI-Kosten darf nicht unter 16,99 € verkauft werden, ohne die Marge neu zu rechnen.

## 8. ZDR/MAM-Quote: explizites Go/No-go

Die 10 % EU-Processing-Uplift sind in der 1-€-AI-Reserve enthalten. Nicht enthalten ist ein möglicher fixer Mindestumsatz, Enterprise-Vertrag oder Supportpreis. OpenAI nennt öffentlich Genehmigungs- und Amendment-Pflichten, aber keinen Standardpreis; deshalb ist 0 € keine belastbare Annahme ([Data Controls](https://developers.openai.com/api/docs/guides/your-data#additional-requirements-for-non-us-regions)).

Für mindestens 35 % vollständig belastete Deckungsbeitragsmarge im konservativeren Jahresanker gilt ab dem Annual-/100-Payer-Gate:

```text
Z_max(N) = max(0, N × (5,1507 € − 35 % × 10,4342 €) − 60 €)
         = max(0, 1,4987 € × N − 60 €)
```

`Z` ist dabei ausschließlich der **inkrementelle** fixe Providerbetrag zusätzlich zu den bereits budgetierten 1 € Usage pro Nutzer. Nennt OpenAI einen gesamten monatlichen Mindestumsatz `M`, der Tokenverbrauch einschließt, wird zuerst `Z = max(0, M − N × 1 €)` berechnet. Nennt OpenAI dagegen eine separate Plattform-/Retention-Gebühr, ist `Z` diese volle Gebühr. Akzeptiert wird nur `Z ≤ Z_max(N)` für die zum Vertragsstart bereits zahlende, nicht bloß prognostizierte Kohorte.

**Begrenzte 20er-Validierungsausnahme:** Die erste Kohorte zahlt ausschließlich monatlich. Ohne Providerzusatz verbleiben 71,95 € Deckungsbeitrag beziehungsweise 28,6 % Marge. Der Betreiber darf davon höchstens **40 € pro Monat** als explizite Validierungsausgabe für einen fixen ZDR/MAM-Betrag einsetzen; es verbleiben 31,95 € beziehungsweise rund **12,7 %** Marge. Diese Ausnahme gilt nur für die erste 20er-Kohorte und höchstens für den vorab festgelegten Beta-Zeitraum. Sie ist kein steady-state-Nachweis. Bei `Z > 40 €` startet die 20er-Beta nicht; ab dem Annual-/100-Payer-Gate entfällt die Ausnahme und nur die 35-%-Formel gilt.

| Zahlende/Kohorte | maximaler fixer ZDR/MAM-Zusatzpreis/Monat | Entscheidung |
| ---: | ---: | --- |
| 20, monatliche Lernkohorte | **40 €** | befristete Validierungsausgabe; nur ca. 12,7 % Marge, nicht nachhaltig; darüber kein Start |
| 100 | **ca. 90 €** | darüber Hosted AI aus oder Preis/Paket neu entscheiden |
| 500 | **ca. 690 €** | Quote plus tatsächliche Usage/Supportkosten neu prüfen |

Ein einmaliges Setup-Entgelt kann aus einem separat freigegebenen Compliance-Launchbudget kommen; es darf nicht als monatlich tragfähige Unit Economics dargestellt werden. Ein verpflichtendes Scale-Tier, Mindest-Tokenpaket oder Enterprise-Sitz wird nur akzeptiert, wenn dieselbe Formel mit der realen Zahl zahlender Personen weiterhin erfüllt ist. Fehlt die schriftliche Genehmigung, bleibt AI gemäß Privacy-Grenze aus; lokale Charts/Import dürfen nicht als gleichwertiger Paid Plan weiter zum AI-Preis verkauft werden.

## 9. Refund, Widerruf, Kündigung und Reserve

Primärquellen und konservative Beta-Policy:

- Verbraucher haben bei online geschlossenen Dienstleistungsverträgen grundsätzlich 14 Tage Widerrufsrecht ([Your Europe](https://europa.eu/youreurope/citizens/consumers/shopping/returns/index_de.htm), [§ 356 BGB](https://www.gesetze-im-internet.de/bgb/__356.html)). Wertersatz für bereits erbrachte Dienstleistungen setzt unter anderem das ausdrückliche Verlangen zum Beginn vor Ablauf der Widerrufsfrist und korrekte Information voraus ([§ 357a BGB](https://www.gesetze-im-internet.de/bgb/__357a.html)). Der Checkout darf das nicht durch eine pauschale „sofort kein Widerruf“-Checkbox ersetzen.
- Paddle beschreibt sich als Reseller/MoR. Die Buyer Terms nennen für EU/EEA-Verbraucher 14 Tage und eine Ausnahme nach ausdrücklicher Zustimmung zum vorzeitigen Leistungsbeginn; die Supplier Terms erlauben Paddle unter anderem Refunds binnen 14 Tagen von Kauf oder Subscription Renewal ([Paddle Buyer Terms](https://www.paddle.com/legal/buyer-terms), [Paddle MSA § 10](https://www.paddle.com/legal/terms), [Refund Policy](https://www.paddle.com/legal/refund-policy)). Die konkrete Checkout-Konfiguration muss durch Rechtsberatung bestätigt werden.
- Deutsche zahlungspflichtige Online-Bestellungen brauchen eine eindeutig zahlungspflichtige Schaltfläche ([§ 312j BGB](https://www.gesetze-im-internet.de/bgb/__312j.html)). Ein online abschließbares Dauerschuldverhältnis benötigt einen ständig verfügbaren, unmittelbar zugänglichen Kündigungsbutton und elektronische Bestätigung ([§ 312k BGB](https://www.gesetze-im-internet.de/bgb/__312k.html)). Automatische Verlängerungen in AGB dürfen bei Verbrauchern nur unbefristet mit höchstens einmonatiger Kündigungsfrist weiterlaufen ([§ 309 Nr. 9 BGB](https://www.gesetze-im-internet.de/bgb/__309.html)).

**Produktpolicy:** Es gibt keine kostenlose Testphase; das Abo ist ab Tag 1 bezahlt. Der Erstattungsweg und gesetzliche Rechte bleiben vollständig bestehen.

1. Voller Refund auf Anfrage innerhalb 14 Kalendertagen nach Erstkauf; aus Kulanz auch innerhalb 14 Tagen nach einer Jahresverlängerung. Gesetzliche Mangel-/Erstattungsrechte bleiben unberührt.
2. Außerhalb dieses Fensters kein automatischer Pro-rata-Refund, außer gesetzliche Pflicht, erheblicher nachgewiesener Ausfall oder Doppelabbuchung. Paddle führt Refund/Payment-Support aus; Rowing Tracker unterstützt Produktfälle.
3. Monats- und Jahresabo sind jederzeit per sichtbarem Kündigungsbutton zum Ende der bezahlten Periode kündbar. Jahresverlängerungen werden 30 Tage vorher erinnert.
4. 5 % des Bruttoumsatzes bleiben als Refund-/Chargebackreserve. Paddles Vertragsbedingungen erlauben bei einem Chargeback neben dem zurückgebuchten Betrag eine Gebühr von **bis zu 20 GBP/USD/EUR**; operative Hilfeseiten können niedrigere aktuelle Werte zeigen. Gebühren können bei Refunds einbehalten werden ([Paddle MSA § 10.4](https://www.paddle.com/legal/terms), [Retained Fees](https://developer.paddle.com/changelog/2025/retained-fees-payout-totals/)). Überschreiten Refunds plus verlorene Chargebacks rollierend drei Monate lang 5 %, werden Akquisition und Jahresverkauf pausiert.

## 10. Support-SLA und Kostenkontrolle

**Enthalten:** Accountzugang, fehlerhafter eigener CSV/ZIP-Import, nachvollziehbare Produktfehler, Billing/Refund/Cancellation, Export/Löschung/Privacy-Anfrage und Meldung sicherheitsrelevanter Vorfälle.

**Nicht enthalten:** menschliche Trainings- oder medizinische Beratung, Bewertung einer AI-Antwort durch einen Coach, Telefon/Video, Datenbereinigung fremder Formate, SmartRow-Login-/Exportvertretung, individuelle Softwareanpassung oder zugesagte Lösungszeit.

**Serviceziel:** erste substanzielle Antwort innerhalb von zwei deutschen Werktagen per E-Mail; kein 24/7- oder Uptime-SLA. Paddle bearbeitet reine Payment-/Invoice-/Refund-Fragen als MoR. Die App muss Self-Service für Kündigung, Export, Löschung und AI-Allowance bieten.

**Messung:** Jede Supportinteraktion erhält Kategorie und aktive Minuten. Steady state: maximal drei Minuten je zahlender Person und Monat über acht Wochen. Die ersten 20 Personen dürfen einmalig höchstens 15 aktive Minuten manuelles Beta-Onboarding erhalten; diese Minuten werden als Lern-/CAC-Aufwand separat ausgewiesen und dürfen nicht im steady-state-Support verschwinden. Vor Annual-Launch muss der reguläre Supportwert unter drei Minuten liegen.

## 11. Harte Viability- und Release-Gates

CommercialBeta darf keine Zahlung annehmen, bevor alle Punkte erfüllt sind:

1. **Provider:** Paddle-Onboarding/Produktfreigabe, MoR-/Data-Sharing-Vertrag und Webhook-/Refund-/Cancellation-Test sind abgeschlossen. Vercel/Supabase/SMTP/Upstash/Monitoring haben gewählte EU-Region, DPA, Subprocessor-Snapshot und Löschweg.
2. **AI-Vertrag:** OpenAI-DPA, EU-Projekt, konkreter gepinnter Snapshot, genehmigtes ZDR/MAM und Modified-Retention-Amendment sind schriftlich belegt. Der fixe Quote-Wert erfüllt Abschnitt 8; sonst AI aus.
3. **Server/Metering:** Kein `NEXT_PUBLIC`-/User-Key, kein Browser-OpenAI, `store:false`, keine Tools/Files/Memory/Response-Kette. Jede Aktion speichert content-frei Modell, Snapshot, Input/Cached-Input/Output/Reasoning, Providerkosten, EU-Aufschlag, Erfolg/Retry und Nutzer-Allowance.
4. **Cost controls:** 38-Aktionen-Cap, 0,75-€-Warnung, 1,25-€-Hard-Cap, OpenAI-Projektbudget, Rate-Limit fail-closed und Paddle-Webhook-Idempotenz sind getestet. Ein Fehler darf weder unlimitiert Tokens noch doppelte Zahlung auslösen.
5. **Margen:** technischer Gross Margin mindestens 75 %; bei 100 Zahlenden vollständig belastete Contribution mindestens 40 % am monatlichen und jährlichen Anker. AI rollierend ≤1 €, Support ≤3 Minuten und Refund/Chargeback ≤5 % je zahlender Person/Monat.
6. **Verbraucherrecht:** Bruttopreis/USt, Laufzeit, automatische Verlängerung, Kündigung, Fair Use, AI-/Nichtmedizin-Hinweis, Widerrufsbelehrung/-formular und Payment-Schaltfläche sind vor Kauf sichtbar; Checkout, Refund und Kündigungsbutton wurden juristisch geprüft und E2E getestet.
7. **Jahresabo:** erst nach mindestens acht Wochen Paid-Retention und gemessenen AI-/Support-/Refund-Kosten; bei der ersten 20er-Kohorte nur Monatsabo.
8. **Scale:** Vor 100 und 500 Zahlenden werden Datenbankwachstum, Vercel/Supabase/Redis/SMTP-Overage, Support, MAM/ZDR-Quote und tatsächlicher Payment-Mix neu gerechnet. 8 GB Supabase-DB und enthaltene Credits sind kein dauerhafter Freibrief für Stroke-by-Stroke-Wachstum.

## 12. Inputs für das nachgelagerte Offer- und Validation-Ticket

Folgende Produktentscheidungen sind jetzt bindend und müssen nicht erneut erfunden werden:

- Preiskorridor 12,99–16,99 € monatlich / 129–169 € jährlich, Anker 14,99/149, alle Preise brutto inkl. 19 % USt;
- erste 20 Zahlende nur monatlich; Annual nach Acht-Wochen-Gate;
- keine kostenlose Testphase; Zahlung ab Tag 1, 14-Tage-Erstattungsweg und gesetzliche Rechte bleiben bestehen;
- Paddle MoR als Beta-Mechanismus, Stripe nur dokumentierter Fallback/500-Payer-Review;
- 38 AI-Aktionen und 1 € AI-Budget je Nutzer/Monat, keine Unlimited-Sprache;
- E-Mail-Support in zwei Werktagen, enger Scope, drei Minuten internes Supportbudget;
- 14-Tage-Vollrefund-Policy, sichtbare Self-Service-Kündigung, 5-%-Reserve;
- Zielmargen 75 % technisch und 40 % fully loaded bei 100 Zahlenden;
- ZDR/MAM-Fixpreis nur innerhalb der expliziten Formel.

Vor dem ersten Verkauf trägt der Betreiber mit Beleg ein:

- Rechtsträger, USt-/Kleinunternehmerstatus und Bestätigung, dass 19 % tatsächlich auszuweisen sind; dieses Modell setzt normalen 19-%-USt-Ausweis voraus;
- Paddle-Vertragswährung, genaue 0,50-USD-Umrechnung, Refund-/Fee-Regel und Seller-Payout;
- reale Vercel-, Supabase-, SMTP-, Redis-, Domain- und Monitoring-Rechnungen sowie Regionen/DPAs;
- OpenAI-Projekt, Snapshot, EU-/ZDR/MAM-Nachweis, Quote und reale Tokenkosten aus einem repräsentativen Eval-Satz;
- freigegebenes einmaliges Budget für Recht/Steuer/DPIA/Payment-Integration und Betreiberzeit;
- gemessene Aktivierung, achtwöchige Paid-Retention, Refunds, Supportminuten und AI-Kosten aus der 20er-Kohorte.

Wenn diese Felder nicht belegt sind, bleibt die korrekte Aussage: **Der Preis ist als Testvertrag beschlossen; nachhaltige Nachfrage und reale Profitabilität sind noch nicht bewiesen.**
