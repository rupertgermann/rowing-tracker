# Hosted-AI-Privacy-Grenze für CommercialBeta

Stand der Recherche: 2026-08-02
Geltungsbereich: invite-only CommercialBeta von Rowing Tracker, manuell importierte eigene SmartRow-CSV/ZIP-Dateien, gehostetes KI-Coaching. Mocap/FreeMoCap, Live-FTMS, SmartRow-Login-Automation und andere Quellen sind nicht Teil dieser Freigabe.

Dies ist eine produkt- und compliance-orientierte Arbeitsgrundlage, keine Rechtsberatung. Die mit **Fakt** und **Ableitung** markierten Aussagen sowie die vorgegebenen Release-Nachweise sollen vor dem Launch durch den Betreiber und eine qualifizierte Datenschutzberatung bestätigt werden.

## 1. Bindende Beta-Grenze

CommercialBeta darf erst freigegeben werden, wenn alle folgenden Punkte gleichzeitig gelten:

1. **Datenquelle und Zielgruppe:** CommercialBeta ist zunächst auf eingeladene, mindestens 18 Jahre alte Personen mit Wohnsitz in Deutschland beschränkt. Der Nutzer bestätigt, dass die hochgeladene SmartRow-Datei seine eigene ist und keine Daten Dritter enthält. Import erfolgt ausschließlich über den offiziellen manuellen Export; SmartRow-Passwort, API-Key, Browser-Automation und private Endpoints sind nicht Bestandteil des Produkts.
2. **Hosted AI:** Kein BYOK und kein Browser-Aufruf. Alle Modellaufrufe laufen serverseitig mit einem vom Betreiber verwalteten Schlüssel. Der Schlüssel darf weder in `NEXT_PUBLIC_*` noch an den Browser/API-Client gelangen. Hosted AI setzt einen nachgewiesenen EU-Region-Betrieb, Vertrag/DPA und eine für das konkrete Projekt genehmigte ZDR/MAM-Konfiguration voraus. Fehlt einer dieser Nachweise, bleibt Hosted AI in CommercialBeta deaktiviert; ein anderer Provider erfordert eine neue dokumentierte Prüfung.
3. **Datenminimierung:** Nur ausgewählte, normalisierte Aggregate (z. B. Distanz, Dauer, Leistung, Split, Schlagrate und ein grober Trainingszeitraum) sowie ein ausdrücklich freigegebener Trainingswunsch gehen an die KI. Roh-CSV/ZIP, Dateinamen, Nutzer-ID, E-Mail, exakte Zeitstempel, Volltextprofile, Stroke-by-Stroke-Daten und `heartRate` werden nicht gesendet. `heartRate`, `age`, `weight` und `wattPerKg` werden im Beta-Import vor der dauerhaften Speicherung und vor jedem AI-Payload entfernt. Andere detaillierte Stroke-Werte dürfen ohne diese Felder für Basis-Analyse gespeichert, aber nicht an Hosted AI gesendet werden.
4. **Keine medizinische Nutzung:** Die Beta diagnostiziert, behandelt oder verhindert keine Krankheit, ist kein Medizinprodukt und ist nicht für Notfälle bestimmt. Verletzungen, Diagnosen, Medikamente, Vorerkrankungen und ähnliche Freitexte werden nicht als Profil-/Memory-Kontext verarbeitet. Solche Eingaben werden abgefangen und mit dem Hinweis unten beantwortet.
5. **Uploads und Memory:** Bilder, PDFs, beliebige Datei-Anhänge, Rohdateien, freie Textnotizen und automatischer Memory-Tool-Retrieval sind deaktiviert. Zulässig sind nur vom System erzeugte Pläne/Insights innerhalb der unten festgelegten Aufbewahrungsfrist; sie werden nicht automatisch erneut an die KI übertragen.
6. **Einwilligung:** Speicherung/Analyse der importierten Workout-Daten und die optionale Übertragung ausgewählter Daten an Hosted AI haben getrennte, granulare Einwilligungen. Weil selbst minimierte Leistungsdaten im Nutzungskontext Gesundheitsinformationen offenbaren können, wird für beide Zwecke vorsorglich eine ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO dokumentiert. Rücknahme der AI-Einwilligung lässt Import und Basis-Auswertungen weiterlaufen, löst aber sofort einen AI-Sendestopp aus.
7. **Fail closed:** Fehlt eine Einwilligung, Provider-Freigabe, EU-Region-/ZDR-Nachweis, DPA, Löschpfad oder Sicherheitsprüfung, darf die betreffende Datenklasse nicht an die KI gehen. Eine Marketing-/Terms-Zustimmung ersetzt keine getrennte Datenschutz-Einwilligung.

**Produktentscheidung (Ableitung):** Für einen kleinen Betreiber ist es vertretbarer, Hosted AI nur für minimalisierte Workout-Aggregate anzubieten und HR/Alter/Gewicht/Watt-pro-Kilogramm, Profile, Freitext-Memory und Upload-Inhalte vollständig zu blockieren, als eine unvollständig kontrollierte Verarbeitung als „EU-only“ oder „medizinisch sicher“ zu bezeichnen.

## 2. Was im Repository aktuell tatsächlich passiert

### Fakt: manueller Import ist vorhanden, aber der alte Sync-Pfad bleibt aktiv

- Der UI-Pfad parst CSV/ZIP im Browser und sendet normalisierte Session-Daten an `/api/sessions` ([Import-UI](../../src/app/sync/page.tsx#L155-L258), [Persistenz in Chunks](../../src/lib/services/rowingSessionPersistence.ts#L279-L334)).
- Der UI-Pfad enthält weiterhin SmartRow-Anmeldung, `/api/smartrow/sync`, Rückgabe von CSV/Base64-ZIP und in der Konsole die ersten 500 Zeichen sowie Header/erste Zeilen ([Sync-Handler](../../src/app/sync/page.tsx#L315-L359)). SmartRow-E-Mail/Passwort werden in Browser-Settings vorgehalten ([Settings-Typen und Speicherung](../../src/lib/settings.ts#L430-L497)). Das ist für CommercialBeta zu entfernen oder unerreichbar zu machen.
- Die serverseitige Session-Route ist user-scoped, prüft aber derzeit im Wesentlichen nur ein nichtleeres Array; harte Zod-Schemata, Quoten, Provenienzbestätigung, Größen-/Zeilenlimits und content-freie Logs fehlen ([POST `/api/sessions`](../../src/app/api/sessions/route.ts#L60-L252)).
- CSV-Parsing ersetzt ungültige Zeitstempel durch `new Date()` und übernimmt `wattPerKg` und weitere Werte ([Parser](../../src/lib/csvParser.ts#L15-L76)); ZIP-Parsing lädt Archive vollständig und begrenzt weder Einträge noch expandierte Größe/Kompression ausreichend ([ZIP-Parser](../../src/lib/zipParser.ts#L96-L174)).

### Fakt: der aktuelle Cloud-AI-Pfad überschreitet die Beta-Grenze

- `CloudAIService.initialize` priorisiert einen nutzereigenen Key und fällt auf `NEXT_PUBLIC_OPENAI_API_KEY` zurück; der Aufruf läuft aus dem Client gegen `api.openai.com` ([AI-Konfiguration](../../src/lib/cloudAI.ts#L118-L145), [Browser-Verfügbarkeit](../../src/lib/aiConfig.ts#L34-L69)).
- Chat-Requests setzen derzeit `store: true`, reichen `previous_response_id` weiter und verwenden Tool-Aufrufe; die Responses-State-Kette ist damit nicht auf eine flüchtige Anfrage beschränkt ([Chat-Request](../../src/lib/cloudAI.ts#L376-L423), [Request-Bau](../../src/lib/cloudAI.ts#L480-L505)).
- Bilder und PDFs/Base64 werden direkt als `input_image`/`input_file` an Responses übergeben ([Cloud-AI-Anhänge](../../src/lib/cloudAI.ts#L318-L346), [Dokumentprozessor](../../src/lib/documentProcessor.ts#L75-L124), [PDF-Pfad](../../src/lib/documentProcessor.ts#L280-L333)). Diese Beta-Verarbeitung ist abzuschalten.
- `get_memory_documents` kann Nutzer-Uploads und generierte Dokumente an den Modellkontext liefern ([Tool-Definition](../../src/lib/cloudAI.ts#L230-L250), [Tool-Ausführung](../../src/lib/cloudAI.ts#L712-L764)). Das ist mit einer automatischen Einwilligung/Profilannahme unvereinbar.
- `getUserProfileContext` injiziert ausdrücklich „medical conditions, limitations“ ([Profil-Kontext](../../src/lib/cloudAI.ts#L1121-L1128)); `condenseUserProfile` fordert Diagnosen, Verletzungen, Medikamente, Alter und physische Einschränkungen an und sendet Rohprofiltext an OpenAI ([Profil-Kondensierung](../../src/lib/cloudAI.ts#L1983-L2053)). Für CommercialBeta muss dieser gesamte Pfad deaktiviert oder durch eine enge, nicht-medizinische Allowlist ersetzt werden.
- Der Chat-Systemprompt bewirbt einen „personal AI rowing coach“ und nennt Recovery/Verletzungsprävention sowie Nutrition/Lifestyle ([Systemprompt](../../src/lib/cloudAI.ts#L873-L999)); die Defaults enthalten dieselbe Gesundheits-/Medizin-Sprache ([Prompt-Defaults](../../src/lib/aiPromptDefaults.ts#L1-L120)). Das ist vor Release zu ersetzen.

### Fakt: Aufbewahrung, Löschung und Export sind nicht belastbar

- Settings definieren nur UI-Werte `sessionRetention: 365` und `chatRetention: 90`; ein nachgewiesener serverseitiger Cleanup-Job ist nicht ersichtlich ([Settings](../../src/lib/settings.ts#L90-L105), [Defaults](../../src/lib/settings.ts#L236-L249)). Diese Zahlen sind daher keine erfüllte Löschfrist.
- Chat/Insights/Pläne/Memory werden user-scoped persistiert ([Chat-API](../../src/app/api/chat/route.ts#L1-L160), [Memory-Upload](../../src/app/api/memory/upload/route.ts#L1-L80)). Memory-Dateien liegen unter `storage/memory/<userId>` und werden beim Account-Cascade nicht als Datei bereinigt ([Memory-Upload](../../src/app/api/memory/upload/route.ts#L42-L72), [Account-Löschung](../../src/app/api/user/delete/route.ts#L70-L94)).
- Der Export enthält Sessions inklusive Herzfrequenz, Chattext, Insights, Pläne und nur Metadaten/extracted text der Memory-Dokumente; Binärdaten, vollständige Memory-Inhalte, Einwilligungs-/Auditdaten und Providerdaten fehlen. Er nennt sich trotzdem „GDPR-compliant data export“ ([Export-Abfrage](../../src/app/api/user/export/route.ts#L24-L139), [Export-Kennzeichnung](../../src/app/api/user/export/route.ts#L140-L177)). Das Label muss entfernt oder durch einen vollständigen Export ersetzt werden.

## 3. Rechtsrahmen und Einordnung

### Fakten aus Primärquellen

- Art. 4 Abs. 1 und 15, Art. 5, 6, 9, 12–22, 25, 28, 30, 32–35 und 44–49 DSGVO sind im [konsolidierten DSGVO-Text (EUR-Lex)](https://eur-lex.europa.eu/eli/reg/2016/679/2016-05-04) maßgeblich. Die [EDPB-Übersicht zu Rechtsgrundlagen](https://www.edpb.europa.eu/topics/key-gdpr-concepts/legal-basis_en) trennt die sechs Art.-6-Grundlagen; besondere Kategorien benötigen zusätzlich eine Art.-9-Bedingung.
- Die EDPB beschreibt in [Guidelines 03/2020 zu Gesundheitsdaten](https://www.edpb.europa.eu/sites/edpb/files/files/file1/edpb_guidelines_202003_healthdatascientificresearchcovid19_en.pdf) Gesundheitsdaten weit: Daten, die körperliche/geistige Gesundheit betreffen oder Gesundheitsstatus offenbaren; auch Kreuzreferenzierung, Selbstauskunft und Kontext können eine zunächst neutrale Angabe zu Gesundheitsdaten machen. Deshalb werden Herzfrequenz, detaillierte Trainingsverläufe und daraus gebildete Gesundheits-/Belastbarkeitsinferenz in dieser Beta konservativ behandelt. Das ist eine Risikoeinordnung, keine Einzelfallklassifikation.
- Für Einwilligungen sind [EDPB Guidelines 05/2020](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en) maßgeblich; Controller/Processor-Rollen folgen [EDPB Guidelines 07/2020](https://www.edpb.europa.eu/documents/guideline/guidelines-072020-on-the-concepts-of-controller-and-processor-in-the-gdpr_en). Eine DPIA ist nach [EDPB SME Guidance](https://www.edpb.europa.eu/sme-data-protection-guide/be-compliant/be-compliant_en) bei voraussichtlich hohem Risiko, umfangreicher Verarbeitung sensibler Daten oder systematischer Bewertung zu prüfen.
- Die deutsche DSK weist in der [Position zu cloudbasierten digitalen Gesundheitsanwendungen](https://www.datenschutzkonferenz-online.de/media/dskb/2023_11_06_Beschluss_cloudbasierte_digitale_Gesundheitsanwendungen.pdf) auf faktische Rollenbestimmung, klare Controller-/Zwecktransparenz, sichere Betroffenenprozesse, TOMs, MFA, Least Privilege, Verschlüsselung, Access-Logging und DPIA-Risiken hin. Das Papier ist keine direkte Einstufung dieser nicht-medizinischen Beta, aber ein konservatives Sicherheits- und Transparenzsignal. Die [BfDI-Warnung zu Gesundheits-Apps/Wearables](https://www.bfdi.bund.de/SharedDocs/Pressemitteilungen/DE/2016/19_Gesundheitsapps.html) nennt Gewicht, Schritte, Schlafdauer und Herzfrequenz als potenziell gesundheitsenthüllend, sobald sie mit Identifikatoren oder Kontext verknüpft werden.
- Die [KI-Verordnung (EU) 2024/1689, EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A32024R1689) enthält insbesondere Art. 4 (AI literacy), Art. 6 (high-risk), Art. 50 (Transparenz) und Art. 113 (Anwendungszeitpunkte). Nach dem [Kommissions-Zeitplan](https://digital-strategy.ec.europa.eu/en/faqs/navigating-ai-act) gilt sie am Stichtag dieser Recherche weitgehend; Nutzer müssen erkennen können, dass sie mit KI interagieren, und KI-generierte Inhalte sind entsprechend zu kennzeichnen. Ein enges Fitness-Coaching ist voraussichtlich kein Hochrisikosystem, solange es kein Medizinprodukt, keine Beschäftigungs-/Kreditentscheidung und keine sonstige Art.-6-Kategorie wird; diese Einstufung muss bei jeder Produkterweiterung neu geprüft werden.

### Empfohlene Rechtsgrundlagen (Ableitung, vor Launch bestätigen)

| Zweck | Art. 6 DSGVO | Art. 9 DSGVO | Produktgrenze |
|---|---|---|---|
| Konto, Einladung, Authentifizierung, Import und Basis-Analyse | Art. 6 Abs. 1 lit. b (Vertrag/Vertragsanbahnung) | Keine Sonderkategorie beabsichtigt; wenn Workout-Kontext als Gesundheitsdaten qualifiziert, zusätzlich Art. 9 Abs. 2 lit. a | Nur eigener Export; keine Drittpersonendaten |
| Optionale Übertragung ausgewählter Workout-Kontexte an Hosted AI | Art. 6 Abs. 1 lit. a, getrennte ausdrückliche Einwilligung (nicht in ToS versteckt) | Vorsorglich Art. 9 Abs. 2 lit. a für gesundheitsenthüllende Workout-Kontexte; HR und medizinischer Freitext bleiben trotzdem blockiert | Widerruf stoppt AI, Basisimport bleibt |
| Betrugsabwehr, Rate-Limit, Security und content-freie Auditlogs | Art. 6 Abs. 1 lit. f; Interessenabwägung und kurze Frist dokumentieren | Keine HR-/Medizininhalte in Logs | Kein Prompt-/Antworttext in Logs |
| Gesetzliche Aufbewahrung, Steuer/Billing | Art. 6 Abs. 1 lit. c (ggf. b) | Nur soweit zwingend; trennen und sperren | Frist aus konkreter Pflicht, nicht pauschal |
| Modelltraining/Produktverbesserung durch Provider | Keine Einwilligung im Beta-Produkt; nicht erforderlich | Nicht zulassen | Provider-Opt-in aus, DPA/Settings prüfen |

Eine Einwilligung muss freiwillig, spezifisch, informiert und widerrufbar sein; Version, Zeitpunkt, Zweck, Kategorien und UI-Text sind in einem Consent Ledger zu protokollieren. Der Nutzer soll zwei getrennte Schalter sehen: (a) Import/Analyse der eigenen Workout-Datei mit dem klaren Hinweis, dass eventuell enthaltene HR vor Persistenz entfernt wird, und (b) Übermittlung der jeweils angezeigten minimierten Kontexte/Prompts an Hosted AI. Der zweite Schalter enthält vorsorglich die Art.-9-Ausdrücklichkeit; HR und medizinische Inhalte werden dadurch nicht freigeschaltet.

## 4. Datenmatrix für CommercialBeta

„AI-Eingabe“ bedeutet nur eine bewusst ausgewählte, serverseitig validierte Übermittlung; weder automatische Tool-Abfragen noch versteckte Profil-/Memory-Kontexte sind zulässig.

| Datenkategorie | Persistenz im Betreiber-System | AI-Eingabe | Art. 6 / Art. 9-Basis | Beta-Aufbewahrung | Löschung und Export |
|---|---|---|---|---|---|
| Konto/Einladung/Auth (interne ID, E-Mail, Rolle, Sessions, Einladungsstatus) | Ja | Nein | Art. 6 Abs. 1 lit. b; Security ggf. lit. f | Aktives Konto; Auth-/Security-Logs 30 Tage empfohlen; gesetzliche Fristen separat | Account-Löschung nach Re-Auth; Export maschinenlesbar inkl. Einladungsstatus, soweit vorhanden |
| Normalisierte eigene Workout-Aggregate (Datum grob, Distanz, Dauer, Leistung, Split, Schlagrate, PRs) | Ja | Ja, nur ausgewählte Felder | Art. 6 Abs. 1 lit. b; vorsorglich Art. 9 Abs. 2 lit. a, wenn Kontext Gesundheitsstatus offenbart | Solange das Konto aktiv ist; nach 12 Monaten Inaktivität warnen und 30 Tage später löschen | Sessions/PRs vollständig als JSON+CSV; Account-Löschung auch Backups/Provider-Reste abarbeiten |
| Stroke-by-Stroke ohne `heartRate` | Ja, soweit für Basis-Analyse erforderlich | Nein | Art. 6 Abs. 1 lit. b; vorsorglich Art. 9 Abs. 2 lit. a | Wie Workout-Aggregate | Alle tatsächlich gespeicherten Stroke-Felder exportieren und mit dem Workout löschen |
| `heartRate`, `age`, `weight`, `wattPerKg`, Belastbarkeits-/Gesundheitsinferenz | Nein; Alter nur als boolescher 18+-Nachweis, kein Geburtsdatum | Nein; beim Import strippen, nicht zur Gewichtsrekonstruktion nutzen | Art. 6 Abs. 1 lit. b/c für den minimierten Age-Gate-Nachweis; keine weitere Verarbeitung in der Beta | 18+-/Consent-Nachweis solange für Rechenschaft erforderlich; sonst keine Persistenz | Nachweis exportieren, soweit personenbezogen; verbotene Felder sind nicht vorhanden |
| Nutzerprompt und Chat | Ja | Ja, nur nach Nutzeraktion und Sanitization | Art. 6 Abs. 1 lit. a für AI; vorsorglich Art. 9 Abs. 2 lit. a | 90 Tage nach letzter Chat-Aktivität | Vollständiger Prompt-/Antwort-Export mit Zeit/Modell; Löschen muss DB und Indizes erreichen |
| KI-generierter Plan, Insight, Chart-Erklärung, Achievement-Story | Ja, als abgeleitete personenbezogene Daten | Nicht automatisch erneut verwenden | Art. 6 Abs. 1 lit. b/a je Zweck; Art. 9, wenn Output Gesundheitsstatus offenbart | Aktiver Plan bis Abschluss; sonst maximal 365 Tage ab Erzeugung | Inhalt, Prompt-Referenz, Modell und Erzeugungszeit exportieren; bei Account-Löschung löschen |
| Roh-CSV/ZIP und Dateimetadaten | Nein (nur flüchtig im Browser/Server) | Nein | Art. 6 Abs. 1 lit. b; Art. 9 nach Inhalt vorsorglich über Import-Einwilligung | Max. 24 Stunden als Notfall-Puffer, Ziel: request-lifetime; keine Inhaltslogs | Automatischer Ablauf; im Export ausdrücklich „nicht gespeichert“ melden |
| Bild/PDF/Base64-Anhang, Nutzer-Memory-Datei | Nein in Beta; Upload-Funktion deaktiviert | Nein | Keine Verarbeitung in Beta | Nicht annehmen/ablehnen; keine Providerkopie | Kein Export nötig, weil nicht angenommen; bestehende Dateien vor Beta entfernen |
| SmartRow-Passwort, Drittanbieter-API-Key, User-BYOK | Verboten | Nein | Nicht erforderlich, da nicht erhoben | Sofort ablehnen/niemals speichern | Falls Altbestand: Rotation/Löschung vor Invite-Release; nicht exportieren |
| Consent Ledger, Widerruf, Datenschutz-/Sicherheitsereignisse | Ja, minimiert | Nein | Art. 6 Abs. 1 lit. c/f; Consent-Nachweis zur Rechenschaft | Solange Nachweis nötig; Logs 30 Tage empfohlen, gesetzliche Ausnahmen separat | Export der eigenen Consent-Historie; Löschung nur soweit Nachweis-/Pflichtfristen es erlauben |
| Provider-Metadaten (OpenAI abuse logs, Account/Billing/Usage) | Teilweise beim Provider | Entsteht aus AI-Anfrage | Betreiber legt Art. 6-Basis für Übermittlung fest; Provider eigene Controller-/DPA-Rolle für Systemdaten | OpenAI Standard-Abuse-Monitoring bis zu 30 Tage; ZDR reduziert, ist aber nicht absolut | Betreiber stellt Lösch-/Betroffenenanfrage; Restfristen in Notice offenlegen |

## 5. Hosted-AI-Vertrag, Aufbewahrung und Transfers

### OpenAI: nur unter einem nachgewiesenen Betriebsprofil

Primärquellen:

- [OpenAI API Data Controls](https://developers.openai.com/api/docs/guides/your-data#default-usage-policies-by-endpoint): API-Ein-/Ausgaben werden standardmäßig nicht zum Training verwendet, können aber in Abuse-Monitoring-Logs und Endpoint-State liegen; Abuse-Logs können standardmäßig bis zu 30 Tage enthalten. Responses-State ist bei `store: true` bzw. den entsprechenden Endpoints anwendungseitig aufbewahrt. Files/Images haben eigene Aufbewahrungs- und Sicherheitsausnahmen.
- Dieselbe [Data-Controls-Seite, EU Data Residency](https://developers.openai.com/api/docs/guides/your-data): Regionale Speicherung/Verarbeitung erfordert ein Projekt in der gewählten Region und für nicht-US-Regionen zusätzliche Freigaben/Vertragsvoraussetzungen. `eu.api.openai.com` und ein EU-Projekt sind kein Beweis, dass Account-, Billing-, Support-, Nutzungs- oder sonstige Systemdaten ausschließlich im EWR bleiben.
- [OpenAI Business Data](https://openai.com/business-data/) beschreibt den Trainings-Default für Business/API-Daten. Für die rechtliche Rollen- und Hilfeverteilung gelten [OpenAI DPA (PDF)](https://cdn.openai.com/pdf/openai-data-processing-addendum.pdf) und der [aktuelle Subprocessor List](https://openai.com/policies/sub-processor-list/). Der DPA nennt für EWR/Schweiz OpenAI Ireland und SCC/Adequacy für Weiterübermittlungen sowie Unterstützung bei Betroffenenanfragen; die Subprocessor-Liste ist zeitabhängig.
- [OpenAI Services Agreement](https://openai.com/policies/services-agreement/) und [Service Terms](https://openai.com/en-GB/policies/service-terms/) warnen, dass Gesundheits-/medizinische Verwendungen besonderen Bedingungen unterliegen und Services nicht zur Diagnose oder Behandlung bestimmt sind. Die Beta sendet daher keine medizinischen Profile/Anweisungen.

Verbindliche technische Konfiguration: serverseitiger Operator-Key; `store: false`; kein `previous_response_id`; keine Files, Images, Batches, Background-/MCP-Aufrufe; Modell/Endpoint explizit allowlisten; Request-Body vor Versand serverseitig schema-validieren und health-/PII-Felder strippen; Provider-Trainings-Opt-in deaktiviert. ZDR (Zero Data Retention) und/oder Modified Abuse Monitoring (MAM) müssen schriftlich vom Provider für genau das Projekt, Modell und den Endpoint genehmigt sein. ZDR bedeutet nicht, dass gesetzlich erforderliche oder Sicherheits-/Missbrauchsaufbewahrung vollständig entfällt.

**Operativer Fallback:** Wenn der Betreiber ZDR/MAM/EU-Projekt nicht bekommt, bleibt Hosted AI in CommercialBeta vollständig deaktiviert. Ein Wechsel zu einem anderen EU-verarbeitenden Provider ist erst nach neuer DPA-, Subprocessor-, Retention- und Transferprüfung zulässig.

### Datenbank, Hosting, E-Mail und Subprozessoren

Rollen werden tatsächlich, nicht nur per Vertrag, bestimmt (siehe [EDPB Controller/Processor Guidelines 07/2020](https://www.edpb.europa.eu/documents/guideline/guidelines-072020-on-the-concepts-of-controller-and-processor-in-the-gdpr_en)):

| Dienst/Rolle | Beta-Einstufung | Mindestnachweis |
|---|---|---|
| Rowing Tracker Betreiber | Controller für Konto, Import, Speicherung, Coaching-Zweck, Löschung und Security | Rechtsträger, EWR-Sitz/Vertretung, Kontakt/DPO-Entscheidung, Verzeichnis der Verarbeitung (ROPA), abgeschlossene DPIA |
| OpenAI | Processor für Customer Data unter DPA; Controller für eigene Account-/System-/Abuse-Daten nach eigener Notice | DPA, Projekt-/Region-/ZDR-MAM-Nachweis, aktueller Subprocessor-Snapshot, Lösch-/DSAR-Prozess |
| PostgreSQL/Supabase (nur falls tatsächlich gewählt) | Processor | [Supabase Regionen](https://supabase.com/docs/guides/platform/regions) mit EU Frankfurt/anderem EWR-Standort; [Supabase DPA](https://supabase.com/downloads/docs/Supabase%2BDPA%2B260601.pdf); Backups/Support/Read-Replicas prüfen; TLS erzwingen ([SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement)) |
| Hosting/Runtime (Vercel, Netlify oder selbst betrieben) | Processor nur wenn in der Produktionsarchitektur aktiviert; Quellcode beweist keinen aktiven Anbieter | Vertrag/DPA, Standort und Backups; bei Vercel [DPA](https://vercel.com/legal/dpa) und [Blob Security](https://vercel.com/docs/vercel-blob/security). Vercel Blob/Mocap ist in dieser Beta out of scope. |
| Produktions-SMTP/Passwort-Mail | Processor für E-Mail-Adresse und Auth-Nachrichten | Anbieter, Länder, DPA, Retention und Subprocessor-Liste in Notice |
| SmartRow | Unabhängiger Controller/Quelle; Nutzer exportiert seine Daten | Nur offizieller Exportlink; keine Zugangsdaten/Automationsverbindung; SmartRow nicht als Rowing-Tracker-Processor darstellen |

Supabase und Vercel sind damit **keine feststehenden Tatsachen**: Im Repository gibt es Prisma/DATABASE_URL und ein Vercel-Blob-Paket, aber Blob wird nur im ausgenommenen Mocap-Pfad verwendet. Produktionsregion, Backupziel, SMTP-, Monitoring- und Zahlungsanbieter bleiben zu verifizieren und in einer Provider-Liste mit Versions-/Abrufdatum festzuhalten.

Für jede Übermittlung außerhalb EWR/Schweiz gilt: Angemessenheitsbeschluss oder SCC plus Transfer Impact Assessment und ergänzende Maßnahmen. Die [EDPB Recommendations 01/2020](https://www.edpb.europa.eu/documents/recommendation/recommendations-012020-on-measures-that-supplement-transfer-tools-to_en) sind die Primärquelle für diese Zusatzmaßnahmen. Nicht auf EU-US Data Privacy Framework verlassen, solange die konkrete Organisation/Verarbeitung nicht aktuell zertifiziert und die übrigen DSGVO-Pflichten erfüllt sind. OpenAI-EU-Region bedeutet insbesondere nicht „keine US-System-/Support-/Abuse-Verarbeitung“.

## 6. Betroffenenrechte, Aufbewahrung, Export und Löschung

### Empfohlene Beta-Fristen (Ableitung, Betreiber muss sie beschließen)

- Rohimport: nur Request-Lifetime; technisch höchstens 24 Stunden Notfall-Puffer, keine Rohdaten in Logs, Traces, Analytics oder Backups.
- Sessions, Stroke-Daten ohne HR und PRs: solange das Konto aktiv ist; nach 12 Monaten Inaktivität Warnung, nach weiteren 30 Tagen automatische Löschung.
- Chats: 90 Tage nach letzter Chat-Aktivität. Systemgenerierte Pläne/Insights/Erklärungen: aktiver Plan bis Abschluss, sonst maximal 365 Tage ab Erzeugung. Es gibt keine freien Notizen in CommercialBeta. Alle Fristen brauchen einen nachgewiesenen serverseitigen Cleanup-Job.
- Security-/Rate-Limit-Logs: 30 Tage empfohlen, content-frei; längere gesetzliche/Incident-Sperre dokumentieren.
- Consent Ledger und gesetzliche Billing-Nachweise: so lange wie Rechenschafts-/Gesetzespflicht; Zugriff minimieren und vom Trainingsinhalt trennen.
- Backups: definierte Rotation, maximal 35 Tage empfohlen; Löschvorgang markiert betroffene Backups und wartet deren Ablauf. Exakte RPO/RTO/Retention ist ein offener Infrastrukturentscheid.
- OpenAI: bei `store:false`/keinem File keine absichtlich gespeicherten Responses; Standard-Abuse-/Safety-Aufbewahrung bis zu 30 Tagen oder providerseitige Ausnahme muss in Notice genannt werden; ZDR/MAM-Nachweis kann diese Dauer reduzieren, aber nicht jede gesetzliche/sicherheitsbezogene Ausnahme ausschließen.

### Export

Der Export-Endpunkt muss ein vollständiges, maschinenlesbares JSON und CSV erzeugen und den Nutzer über nicht gespeicherte Rohdateien informieren. Er muss mindestens enthalten: Konto-/Einladungsdaten; alle Workout- und Stroke-Felder einschließlich HR, sofern gespeichert; PRs/Awards; Pläne inklusive Wochen/Sessions; Chats und Prompts; Insights/Chart-Erklärungen; generierte Outputs; zulässige Notizen/Memory-Inhalte; Settings ohne Geheimnisse; Consent-/Widerrufhistorie; AI-Modell, Request-/Response-Zeit, ausgewählten Input und Provider-Referenz, soweit verfügbar; zugängliche Audit-/Billingdaten. Binärdateien werden entweder als exportierbare Datei mitgeliefert oder ausdrücklich als „nicht gespeichert“/„nicht verfügbar“ erklärt. Provider-Abuse-Logs können nicht direkt exportiert werden; diese Einschränkung und der DSAR-Prozess sind transparent zu machen.

### Löschung/Widerruf

Account-Löschung benötigt Re-Authentifizierung (bereits vorhanden), löscht DB-Kaskaden, lokale Memory-/Upload-Dateien, Suchindizes, Logs soweit zulässig und alle Provider-Referenzen. Vor dem Löschen sind externe Dateien und OpenAI-File/Response-IDs (Beta darf keine erzeugen) zu enumerieren. Backups laufen in der dokumentierten Frist aus; das Konto wird sofort aus dem aktiven System gesperrt. Bei AI-Einwilligungswiderruf: neue AI-Requests sofort blockieren, gespeicherte AI-Inhalte nicht automatisch als Einwilligung fortschreiben und Nutzer eine selektive Löschung anbieten. [EDPB Guidelines 09/2022](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-92022-personal-data-breach-notification-under_en) und ein Incident-Runbook müssen 72-Stunden-Meldung/Betroffenenkommunikation abdecken.

## 7. Pflichttexte für UI, Privacy Notice und Terms

### Nicht-medizinischer Hinweis (UI, deutsch)

> **Kein medizinischer Rat.** Rowing Tracker und seine KI liefern ausschließlich allgemeine Informationen zur Trainingsplanung und Leistungsanalyse. Sie sind kein Arzt, keine medizinische Einrichtung und kein Medizinprodukt; sie diagnostizieren, behandeln oder verhindern keine Krankheit und sind nicht für Notfälle bestimmt. Bei Schmerzen, Symptomen, auffälliger Herzfrequenz, Vorerkrankung oder Unsicherheit Training pausieren und qualifizierte medizinische Beratung einholen. Keine Medikamente oder Behandlung aufgrund einer KI-Antwort ändern. KI-Ausgaben können falsch oder unvollständig sein und müssen vor einer Trainingsentscheidung geprüft werden.

Daneben muss jede Chat-/Planansicht sichtbar machen: „Du interagierst mit einem KI-System“ und „KI-generierte Ausgabe – vor einer Trainingsentscheidung prüfen“ (Art. 50 KI-VO). Das UI darf keine Diagnose-, Therapie-, Reha- oder sichere Leistungsversprechen formulieren; Prompts nach Verletzung/Medikation/Notfall werden abgelehnt und auf medizinische Hilfe verwiesen.

### Privacy Notice (Art. 13/14) und Einwilligungsdialog

Vor dem ersten Import/AI-Aufruf müssen Rechtsträger und Kontakt, Zwecke, Datenkategorien (inkl. HR-/Gesundheitsrisiko), Rechtsgrundlagen, Quelle SmartRow, Empfänger/Processor/Subprocessor, EWR-/Drittländertransfer, konkrete Fristen, Rechte (Auskunft, Berichtigung, Löschung, Einschränkung, Portabilität, Widerspruch), Widerruf, Beschwerdestelle, AI-/Profiling-Logik, kein Training durch den Provider (nur sofern Vertragseinstellung bestätigt) und Restaufbewahrung bei Abuse/Safety erklärt werden. Die Einwilligung ist nicht vorangekreuzt und in zwei getrennten Aktionen zu erteilen:

1. „Ich erlaube Rowing Tracker, meine eigene SmartRow-Datei zu speichern und auszuwerten; sie enthält möglicherweise Herzfrequenz-/gesundheitsnahe Daten.“
2. „Ich erlaube, die jeweils angezeigten, gekürzten Workoutdaten und meinen konkreten Trainingswunsch an den genannten Hosted-AI-Anbieter zu senden.“

Eine dritte, standardmäßig ausgeschaltete Einwilligung wäre nur für eine spätere, klar beschriebene optionale Nutzung (z. B. Qualitätsforschung) zulässig; sie ist in der Beta nicht vorgesehen.

### Terms of Service

Die Terms müssen Invite-only/Altersgrenze, eigene Daten und Drittpersonenausschluss, Verbot von SmartRow-Credentials/BYOK, nicht-medizinischen Zweck, AI-Fehler-/Prüfpflicht, keine Notfälle/Leistungs- oder Sicherheitserfolgsgarantie, SmartRow-Unabhängigkeit, akzeptable Nutzung, Zahlungs-/Kündigungsregeln und Anbieter-/Subprocessor-Link enthalten. Terms-Zustimmung und Datenschutz-/AI-Einwilligung bleiben technisch und textlich getrennt.

## 8. Release-Gates und Nachweise

Vor einem einzigen CommercialBeta-Invite müssen CI-/E2E-Tests und Betreiberakten mindestens Folgendes nachweisen:

1. SmartRow-Credentials, `/api/smartrow/sync`, private API/Browser-Automation und CSV-Inhaltslogs sind im Beta-Build entfernt/gesperrt; Negativtest bleibt grün.
2. Invite-/18+-Gate, Own-file-Attestation, Tenant-Isolation, Auth/CSRF/Rate-Limits und strikte Zod-Schemata mit Dateigrößen-, Zeilen-, Spalten-, ZIP-Eintrags-, Kompressions- und Laufzeitquoten sind getestet.
3. Rohdaten bleiben transient; Logs enthalten keine Rohdaten, E-Mail, Prompt- oder Antwortinhalte. Ungültige Zeitstempel werden abgelehnt, nicht durch „jetzt“ ersetzt.
4. Browser erhält keinen AI-Key; serverseitiger Secret-Store nutzt einen stabilen, rotierbaren Secret-Key. `store:false`, keine Response-Kette, keine Files/Images/Background/Batch/MCP, Modell-/Region-Allowlist und Provider-Trainings-Opt-out sind automatisiert geprüft.
5. Medical/profile condensation, Memory-File-Tool, Attachments, Mocap-Tools und `heartRate`/`age`/`weight`/`wattPerKg` sind im gesamten Beta-Pfad blockiert. Prompt-Injection-, Datenabfluss- und medizinische Red-Team-Fälle sind dokumentiert.
6. Consent Ledger zeichnet Version, Zweck, Kategorie, Zeitpunkt, Quelle und Widerruf auf; Widerruf verhindert nachweisbar jeden neuen AI-Request.
7. Export-/Delete-E2E-Tests prüfen DB, lokale Dateien, Indizes, Provider-Referenzen, Backups, Secrets und den vollständigen JSON/CSV-Inhalt; die irreführende „GDPR-compliant“-Behauptung ist entfernt, bis der Nachweis vollständig ist.
8. Controller-/Processor-Inventar, Art.-28-DPAs, Subprocessor-Snapshots, EU-Region-/SCC-/TIA-Nachweise, ROPA und DPIA-Entscheidung liegen versioniert vor; Supabase/Vercel/SMTP/Monitoring/Payments sind nicht als aktiv behauptet, bevor sie verifiziert sind.
9. TLS/DB-SSL, Verschlüsselung at rest, MFA/Least-Privilege, Schlüsselrotation, Admin-Break-Glass und content-freie Zugriffslogs, Backup-Rotation/Restore-Test und 72-Stunden-Breach-Runbook sind abgenommen.
10. AI-Act-Art.-4-Schulung für Betreiber/Support und Art.-50-Kennzeichnung im UI sind abgenommen; es gibt keine automatisierte Entscheidung mit rechtlicher oder ähnlich erheblicher Wirkung.

## 9. Vor Launch einzutragende Betriebsnachweise

Die Produktentscheidungen sind oben getroffen; unbekannte reale Anbieter- und Betreiberangaben dürfen nicht erfunden werden. Vor dem ersten Invite werden folgende Felder mit Dokumentlink und Verantwortlichem ausgefüllt:

- tatsächlicher Rechtsträger/Einzelunternehmer, ladungsfähige Anschrift, Datenschutzkontakt, zuständige deutsche Aufsichtsbehörde und dokumentierte DPO-Entscheidung;
- technische Durchsetzung „18+, Wohnsitz Deutschland“ und verfügbare deutsche/englische Pflichttexte;
- konkretes OpenAI-Projekt, gepinntes Modell/Endpoint sowie schriftlicher EU-Region- und ZDR/MAM-Nachweis; fehlt er, bleibt Hosted AI aus;
- tatsächlich gewählte Datenbank-, Hosting-, SMTP-, Monitoring- und Zahlungsanbieter mit Region, Backupfrist, DPA, Subprocessor-Snapshot, Transferprüfung und Lösch-SLA;
- gesetzliche Billing-/Consent-Nachweisfristen sowie die höchstens 35-tägige Backup-Rotation;
- benannte Owner für Datenschutz, Security/Incident Response und AI literacy;
- abgeschlossene DPIA vor Invite-Release sowie dokumentierte Einstufung als Nicht-Hochrisiko-System und Nicht-Medizinprodukt. Diese Einstufung wird bei jeder Zweck- oder Feature-Erweiterung neu geprüft.

## 10. Quellen- und Faktenregister

Die oben verlinkten EUR-Lex-, EDPB-, DSK-, BfDI-, OpenAI- und Supabase-Seiten sind die für diese Momentaufnahme verwendeten Primärquellen. Provider-Dokumente, Subprocessor-Listen, Regionen, Verträge und OpenAI-Endpoint-Policies sind änderlich; vor Invite-Release müssen Abrufdatum, Projektkonfiguration und Vertragssnapshot im ROPA/DPIA aktualisiert werden. Aussagen zur aktuellen Repository-Implementierung sind aus den verlinkten Dateien am Stand dieses Commits abgeleitet und keine Zusicherung, dass ein Produktionssystem bereits dieselbe Konfiguration verwendet.
