# Kommerziell sichere SmartRow-Datenübernahme

> **Historische Recherche.** Die Monetarisierungspläne für Rowing Tracker wurden eingestellt. Es gibt kein kostenpflichtiges Abo. Der aktuelle Code steht unter [GPLv3-only](../../LICENSE).

**Ticket:** [Determine the commercially safe SmartRow data-ingestion boundary](https://github.com/rupertgermann/rowing-tracker/issues/89)

**Map:** [Wayfind the Rowing Tracker monetization model](https://github.com/rupertgermann/rowing-tracker/issues/87)

**Stand:** 2026-08-02 · Primärquellen- und Repository-Recherche

## Kurzantwort

Die CommercialBeta sollte genau **einen** SmartRow-Eingang anbieten:

> Ein eingeloggter CoreCustomer exportiert seine eigenen Workouts selbst über die offizielle SmartRow-Oberfläche und lädt die daraus entstandene CSV beziehungsweise das offizielle Detailarchiv manuell in Rowing Tracker hoch.

Die App fragt **niemals** nach SmartRow-Benutzername oder -Passwort, meldet sich nicht bei SmartRow an, automatisiert keine Browser-Sitzung, ruft keine undokumentierten SmartRow-Endpunkte auf und empfängt in der Beta keine Live-Daten per Bluetooth/FTMS. Strava, Apple Health, Garmin, TrainingPeaks und andere Vermittler sind ebenfalls keine Beta-Datenquelle.

Diese Grenze ist nicht nur die technisch einfachste, sondern wird durch die stärkste gefundene SmartRow-Primärquelle positiv gestützt: SmartRow erklärt in seiner FAQ, dass Nutzer einzelne oder alle Workouts unter „My Workouts“ exportieren und diese Dateien **manuell in einen Dienst ihrer Wahl hochladen** können. Unterstützt werden dort CSV sowie TCX; das offizielle Portal bietet getrennt eine CSV-Liste und Workout-Dateien an ([SmartRow FAQ](https://smartrow.fit/faq-smartrow-app/), [SmartRow Portal](https://smartrow.fit/my-workouts/), Abruf: 2026-08-02).

Das ist keine allgemeine Erlaubnis für Credential-Sharing, automatisierte Logins, private APIs, Scraping oder Reverse Engineering. Für diese Wege wurde weder eine öffentliche SmartRow-API noch ein Entwicklerprogramm noch eine Rowing Tracker erteilte Genehmigung gefunden. Sie bleiben bis zu einer veröffentlichten Schnittstelle oder schriftlichen Vereinbarung außerhalb der Beta. SmartRow beschreibt seine bekannten Live-Broadcast-Integrationen als in enger Zusammenarbeit mit den jeweiligen Drittanbieter-Entwicklern optimiert. Die technisch standardkonforme Nutzung von FTMS ist davon getrennt zu prüfen; für SmartRow-gebrandete, „offizielle“ oder partnerschaftliche Integrationsaussagen wäre jedenfalls eine schriftliche Freigabe erforderlich.

**Entscheidung:** Manual-first ist die verbindliche CommercialBeta-Grenze. Alles Automatische ist nicht „später einfach anschaltbar“, sondern ein eigener Partnership-, Vertrags-, Marken-, Architektur- und Datenschutzentscheid.

## Einordnung und Haftungshinweis

Dieser Bericht ist eine konservative Produkt- und Engineering-Empfehlung auf Basis öffentlich erreichbarer Primärquellen und des Repository-Stands `4eaab158fcbf1116ae67dbb33b86c54049599f68`. Er ist **keine Rechtsberatung** und ersetzt insbesondere keine Prüfung der für Betreiber und Beta-Nutzer geltenden Verträge, Datenschutzpflichten und nationalen Gesetze.

Die Recherche trennt:

- **Fakten:** ausdrückliche Aussagen in offiziellen SmartRow-, Plattform- und EU-Quellen sowie gegenwärtiges Verhalten im Repository;
- **Inference:** konservative Schlussfolgerungen für eine kommerzielle Beta, wo die Quellen keinen konkreten Drittanbieterfall regeln;
- **Unbekanntes:** nicht öffentlich dokumentierte Verträge, Rechte, APIs und technische Details.

Die separate Frage, auf welcher Rechtsgrundlage Rowing Tracker importierte Workout- und Herzfrequenzdaten sowie daraus erzeugtes AI-Coaching verarbeitet, wie lange die Daten gespeichert werden und welche Anbieter Daten erhalten, wird hier bewusst **nicht** gelöst. Sie gehört in [Define the hosted AI privacy boundary](https://github.com/rupertgermann/rowing-tracker/issues/91).

## 1. Was SmartRow offiziell anbietet

### 1.1 Nutzerinitiierter Export ist ein vorgesehener Weg

Die aktuelle SmartRow-FAQ und der aktuelle Google-Play-Eintrag machen fünf relevante Aussagen:

1. Nutzer können Workouts für Strava sowie als TCX für Garmin Connect und TrainingPeaks oder als CSV für Excel exportieren.
2. Unter „My Workouts“ lassen sich ein einzelnes Workout oder alle Workouts exportieren.
3. Die exportierten Dateien dürfen anschließend manuell in einen Dienst der Wahl hochgeladen werden.
4. Für Garmin ist der manuelle Export/Import gerade deshalb vorgesehen, weil keine automatische Kooperation besteht.
5. Der am 24.07.2026 aktualisierte Google-Play-Eintrag nennt Downloads aus dem Portal ausdrücklich als Weg, Workout-Daten in anderen Apps, Tabellen oder KI-Tools zu verwenden.

Quellen: [SmartRow FAQ, Export und Drittanbieter-Upload](https://smartrow.fit/faq-smartrow-app/) und [SmartRow bei Google Play, App-Beschreibung, Aktualisierung 24.07.2026](https://play.google.com/store/apps/details?id=nl.appsint.handle) (Abruf: 2026-08-02). Auch die offizielle App-Store-Versionshistorie beschreibt das Webportal als Ort, an dem Nutzer Workout-Dateien in unterschiedlichen Formaten herunterladen und in Garmin, TrainingPeaks oder Excel weiterverwenden können ([Apple App Store, Version 4.0.1](https://apps.apple.com/us/app/smartrow/id1223542275), Abruf: 2026-08-02).

Das öffentlich ausgelieferte SmartRow-Portal unterscheidet gegenwärtig zwischen „List of your workouts“ als Spreadsheet-CSV und „Workout files“ als FIT, TCX oder Spreadsheet-CSV. Bei „Export all“ verwendet das Portal eigene Bulk-Exportvarianten; deren URL-Struktur ist eine Implementierungsinformation des Portals, keine veröffentlichte Drittanbieter-API ([offizielles SmartRow-Portal](https://smartrow.fit/portal/#/log), [aktuell ausgeliefertes Portal-Bundle](https://smartrow.fit/portal/main-es2015.0000f96a690a49fad1c6.js), Abruf: 2026-08-02).

**Inference:** Wenn der Nutzer die Exportfunktion selbst bedient und die dadurch erhaltene Datei selbst hochlädt, nutzt Rowing Tracker den von SmartRow ausdrücklich vorgesehenen Portabilitäts- und Drittanbieter-Workflow. Rowing Tracker greift dabei weder auf das SmartRow-Konto noch auf SmartRow-Infrastruktur zu.

### 1.2 SmartRow-Credentials sind kein freigegebener Integrationsweg

SmartRows Privacy Policy nennt E-Mail, Passwort und Namen als personenbezogene Informationen des SmartRow-Dienstes und beschreibt Workout-Daten auf dessen Servern sowie optionale Weitergabe an Apple Health oder Strava ([SmartRow Privacy Policy](https://smartrow.fit/privacy-policy/), Abruf: 2026-08-02). Sie sagt nicht, dass Nutzer ihr SmartRow-Passwort an unabhängige kommerzielle Dienste weitergeben sollen oder dass solche Dienste damit automatisierte Sitzungen betreiben dürfen.

Auf der öffentlichen SmartRow-Seite, im offiziellen Sitemap-Inventar, in der FAQ, den Store-Einträgen und dem Portal wurde keine öffentliche Entwickler-API, kein OAuth-Verfahren für unabhängige Dienste, kein API-Vertrag und keine Drittanbieter-Dokumentation gefunden ([SmartRow Sitemap](https://smartrow.fit/page-sitemap.xml), [FAQ](https://smartrow.fit/faq-smartrow-app/), [Google Play](https://play.google.com/store/apps/details?id=nl.appsint.handle), [Apple App Store](https://apps.apple.com/us/app/smartrow/id1223542275), Abruf: 2026-08-02).

**Unbekannt:** Es kann nicht ausgeschlossen werden, dass eingeloggten Nutzern zusätzliche Bedingungen angezeigt werden oder SmartRow nicht öffentliche Partnervereinbarungen anbietet. Eine öffentliche Nutzungsbedingungs-/API-Lizenzseite für das App-/Portal-Konto wurde nicht gefunden; die sichtbare „Returns & Refunds Policy“ gilt ausdrücklich nur für den Online-Shop ([SmartRow Returns & Refunds](https://smartrow.fit/returns-refunds-policy/), Abruf: 2026-08-02). Dieses Fehlen ist keine Erlaubnis.

### 1.3 Broadcast und FTMS sind ein anderer Produktweg

SmartRow bietet Bluetooth-Broadcast an EXR, Kinomap, Zwift, BitGym, Regatta, ImersU, Holofit und ErgZone an. Die FAQ sagt ausdrücklich, SmartRow habe die Verbindung und das Echtzeiterlebnis **in enger Zusammenarbeit mit den Entwicklern** dieser Apps optimiert ([SmartRow FAQ, Broadcasting](https://smartrow.fit/faq-smartrow-app/), [Broadcasting Manual](https://smartrow.fit/static/Broadcasting-Manual.pdf), Abruf: 2026-08-02). Für den neuen Power Handle bewirbt SmartRow FTMS und Dual-Bluetooth als Produktfunktion ([SmartRow Power Handle](https://smartrow.fit/smartrow-power-handle/), Abruf: 2026-08-02).

**Fakt:** FTMS ist ein standardisierter Integrationspfad, und SmartRow bewirbt Interoperabilität. **Inference:** Eine markenneutrale, standardkonforme FTMS-Nutzung ist von einer SmartRow-Partnerschaft zu unterscheiden und nicht allein wegen der kooperativ optimierten Broadcast-Integrationen pauschal genehmigungspflichtig. Sie benötigt aber eine separate Prüfung der technischen Spezifikation, einschlägigen Standard-/Lizenzbedingungen, Gerätekompatibilität, Browser-, Support- und Datenschutzgrenzen. Da Live-Rudern für das PaidOutcome nicht erforderlich ist, bleibt es außerhalb der Beta. Für SmartRow-spezifisches Co-Marketing sowie Aussagen wie „offiziell“, „Partner“ oder „in Kooperation mit SmartRow“ ist vorab eine schriftliche Freigabe erforderlich.

### 1.4 Strava, Apple Health und andere Vermittler

SmartRow kann laut eigener FAQ das SmartRow-Konto mit Strava verbinden und Workout-Daten optional an Strava beziehungsweise Apple Health senden. Das macht diese Plattformen aber nicht zu lizenzfreien Stellvertretern für eine Rowing-Tracker-Integration.

- Die offizielle Strava-API verlangt eine registrierte Anwendung, OAuth2-Autorisierung durch jeden Nutzer und die Einhaltung von API Agreement, API Policy und Brand Guidelines. Neue Apps starten mit begrenzter Athletenzahl; für Skalierung ist ein Review vorgesehen ([Strava API-Dokumentation](https://developers.strava.com/docs/), [OAuth](https://developers.strava.com/docs/authentication/), [Getting Started](https://developers.strava.com/docs/getting-started/), Abruf: 2026-08-02).
- Apple Health setzt eine native HealthKit-Integration, granulare Nutzerfreigaben pro Datentyp, klare Zweckbeschreibung und eine eigene Privacy Policy voraus. Apple untersagt bestimmte Weitergaben und Werbenutzungen ([Apple HealthKit Privacy](https://developer.apple.com/documentation/healthkit/protecting-user-privacy), Abruf: 2026-08-02).
- SmartRow sieht TCX/FIT als manuell exportierbare Austauschformate vor. Der aktuelle Rowing-Tracker-Importer unterstützt diese Formate jedoch nicht, und für die erste Beta liefern sie keinen Vorteil gegenüber dem direkten SmartRow-CSV-/Detailarchiv.

**Entscheidung:** Kein Strava-OAuth, kein Apple Health, kein Garmin-/TrainingPeaks-Connector und kein Import aus einem fremden Plattformkonto in der CommercialBeta. Ein vom Nutzer selbst bereitgestellter TCX-/FIT-Export ist als Konzept nicht untersagt, wird aber aus Produkt- und Implementierungsgründen abgewiesen, bis ein eigener Format- und Datenschutzentscheid vorliegt.

## 2. EU-Leitplanken, ohne daraus eine Scheinerlaubnis abzuleiten

### Datenportabilität

Art. 20 DSGVO gibt betroffenen Personen unter seinen Voraussetzungen das Recht, eigene bereitgestellte personenbezogene Daten in einem strukturierten, gängigen, maschinenlesbaren Format zu erhalten und an einen anderen Verantwortlichen zu übermitteln. Die direkte Übertragung zwischen Verantwortlichen gilt nur, soweit technisch machbar; Rechte und Freiheiten anderer dürfen nicht beeinträchtigt werden ([DSGVO, Art. 20](https://eur-lex.europa.eu/eli/reg/2016/679/2016-05-04), Abruf: 2026-08-02).

**Inference:** Das stützt einen nutzerkontrollierten Datei-Workflow. Art. 20 ist aber keine API-Lizenz, keine Genehmigung zur Passwortweitergabe und kein Freibrief für automatisierte Logins oder Reverse Engineering.

### Workout- und Herzfrequenzdaten

Die DSGVO definiert Gesundheitsdaten als personenbezogene Daten zur körperlichen oder geistigen Gesundheit, die Informationen über den Gesundheitszustand offenbaren. Art. 9 behandelt Gesundheitsdaten als besondere Kategorie und nennt unter anderem ausdrückliche Einwilligung für konkrete Zwecke als mögliche Ausnahme vom grundsätzlichen Verarbeitungsverbot ([DSGVO, Art. 4 Nr. 15 und Art. 9](https://eur-lex.europa.eu/eli/reg/2016/679/2016-05-04), Abruf: 2026-08-02).

**Inference:** SmartRow-Dateien enthalten Leistungs-, Gewichtsableitungs- und optional Herzfrequenzdaten; je Kontext und Auswertung können sie Gesundheitsinformationen offenbaren. Die Beta muss sie deshalb mindestens so schützen, als könnten besondere Kategorien betroffen sein. Datenminimierung, Privacy by Design und angemessene technische Schutzmaßnahmen folgen aus Art. 5, 25 und 32 DSGVO. Welche Rechtsgrundlage und Einwilligungsarchitektur konkret verwendet wird, entscheidet das separate Privacy-Ticket.

### Reverse Engineering und Marke

Die EU-Software-Richtlinie enthält begrenzte Ausnahmen für Beobachtung/Test durch Berechtigte und für zur Interoperabilität unerlässliche Dekompilierung unter engen Bedingungen. Gewonnene Informationen dürfen nicht beliebig für andere Zwecke oder ein wesentlich ähnliches Produkt verwendet werden ([Richtlinie 2009/24/EG, Art. 5 und 6](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX%3A32009L0024), Abruf: 2026-08-02).

**Inference:** Ob eine konkrete technische Untersuchung erlaubt wäre, ist ein einzelfallabhängiger Rechtsentscheid. Die CommercialBeta soll nicht davon abhängen. Undokumentierte API-Nutzung, Protokollanalyse und Reverse Engineering bleiben deshalb gesperrt, bis Notwendigkeit, Vertrag, Rechte und Implementierung separat geprüft sind.

Das EU-Markenrecht erlaubt unter Voraussetzungen eine ehrliche, notwendige Bezugnahme auf fremde Marken, um Waren oder Dienste des Inhabers zu identifizieren beziehungsweise den Verwendungszweck des eigenen Angebots zu beschreiben; die Benutzung muss den anständigen Gepflogenheiten in Gewerbe und Handel entsprechen ([Verordnung (EU) 2017/1001, Art. 14](https://eur-lex.europa.eu/eli/reg/2017/1001), Abruf: 2026-08-02).

**Inference:** „Importiert SmartRow-Exportdateien“ ist eine sachliche Kompatibilitätsbeschreibung. SmartRow im Produktnamen, SmartRow-Logos, „offiziell“, „Partner“, „verifiziert“ oder eine optisch verwechselbare Darstellung sind ohne Erlaubnis zu vermeiden.

## 3. Verbindliche Allow / Permission Required / Prohibited-for-Beta-Matrix

Die Kategorien sind Produktfreigaben, keine abschließenden Aussagen über Legalität.

| Weg | Einstufung | CommercialBeta-Regel | Voraussetzung für später |
| --- | --- | --- | --- |
| Nutzer exportiert seine Workout-Liste selbst im offiziellen SmartRow-Portal als CSV und lädt sie manuell hoch | **ALLOW** | Kernweg; nur für eingeloggten CoreCustomer und mit Herkunfts-/Berechtigungsbestätigung | Keine SmartRow-Integration nötig; Formatänderungen beobachten |
| Nutzer exportiert die offiziellen detaillierten Workout-Dateien selbst und lädt das vom Portal gelieferte CSV-/ZIP-Archiv hoch | **ALLOW, technisch gehärtet** | Nur `.zip` mit ausschließlich passenden SmartRow-CSV-Einträgen; keine verschachtelten Archive oder Fremddateien | Belastbare Dateigrenzen, Signatur-, Schema- und ZIP-Bomb-Schutz |
| Einzelne TCX-/FIT-Datei, die der Nutzer selbst offiziell exportiert hat | **ALLOW IN PRINCIPLE, OUT OF BETA** | Mit freundlicher Erklärung abweisen; aktueller Importer und PaidOutcome benötigen sie nicht | Separater Format-, Datenqualitäts- und Privacy-Entscheid |
| Direkte SmartRow-API/OAuth/Partner-Schnittstelle | **PERMISSION REQUIRED** | Nicht öffentlich dokumentiert beziehungsweise Rowing Tracker nicht angeboten | Veröffentlichte Schnittstelle oder schriftliche Vereinbarung mit Ergometer Innovations B.V. |
| SmartRow-Credentials an Rowing Tracker übergeben | **PROHIBITED FOR BETA** | Kein Feld, keine Speicherung, keine Übertragung, kein Support-Workaround | Nur neu bewerten, falls SmartRow einen offiziellen, passwortlosen OAuth-/Tokenweg anbietet |
| Serverseitiger Playwright-/Browser-Login in das SmartRow-Konto | **PROHIBITED FOR BETA** | Route und UI im ausgelieferten Produkt nicht erreichbar; auch keine „experimentelle“ Flag | Schriftliche Freigabe/Vertrag plus Security- und Privacy-Spezifikation |
| Aufruf undokumentierter Portal-Endpunkte, Session-Cookie-Wiederverwendung oder automatisierter Export | **PROHIBITED FOR BETA** | Keine private API, kein Scraping, kein Background Sync | Offizielle API oder ausdrückliche Genehmigung und dokumentierter Vertrag |
| Reverse Engineering der SmartRow-App, des Portal-Codes oder proprietärer Protokolle | **PROHIBITED FOR BETA** | Kein Beta-Dependency | Eigener Rechts-, Notwendigkeits- und Interoperabilitätsentscheid |
| SmartRow-Bluetooth-Broadcast oder direkte FTMS-Verbindung | **OUT OF BETA; SEPARATE STANDARD-/PRODUCT REVIEW** | Kein Live-Rudern und keine Hardwareintegration | Markenneutrale Standardnutzung technisch und hinsichtlich Standard-/Lizenz-, Geräte-, Browser- und Datenschutzgrenzen prüfen; schriftliche SmartRow-Freigabe jedenfalls für gebrandete, „offizielle“, partnerschaftliche oder kooperativ optimierte Integration |
| Strava-Import per OAuth/API | **THIRD-PARTY PERMISSION REQUIRED / OUT OF BETA** | Nicht anbieten | Strava-Appregistrierung, OAuth, API-Vertrag/Policy, Brand-Regeln und Privacy-Entscheid |
| Apple-Health-Import | **PLATFORM PERMISSION REQUIRED / OUT OF BETA** | Nicht anbieten | Native App, HealthKit-Entitlements/-Freigaben, Plattformregeln und Privacy-Entscheid |
| Garmin-, TrainingPeaks-, EXR-, Kinomap- oder andere Account-Connectoren | **THIRD-PARTY PERMISSION REQUIRED / OUT OF BETA** | Nicht anbieten | Jeweils offizielle API, Vertrag, Nutzerautorisierung und Herkunftsmodell |
| Datei aus einem Coach-, Club- oder fremden SmartRow-Konto | **PROHIBITED FOR BETA** | CoreCustomer darf nur eigene Daten hochladen; keine Stellvertreter-/Mehrpersonenfunktion | Eigener B2B-/Coach-Vertrag, Rollenmodell und Datenschutzentscheid |
| SmartRow-Name als sachliche Herkunfts-/Kompatibilitätsangabe | **ALLOW WITH INDEPENDENCE COPY** | Nur Plain Text; keine Logos, kein SmartRow-Produktname für Rowing Tracker, kein Partnersignal | Markenfreigabe, falls prominentere Co-Marketing-Nutzung gewünscht wird |

## 4. Lokaler Repository-Befund

### Was bereits zur Entscheidung passt

- Die Sync-Seite verarbeitet eine vom Nutzer ausgewählte `.csv` oder `.zip` im Browser. Die rohe Datei wird dabei nicht als Datei an den Rowing-Tracker-Server gesendet; der Client parst sie und sendet normalisierte Sessions in JSON-Chunks an `/api/sessions` ([`src/app/sync/page.tsx`](../../src/app/sync/page.tsx), Zeilen 144–258; [`src/lib/services/rowingSessionPersistence.ts`](../../src/lib/services/rowingSessionPersistence.ts), Zeilen 279–335).
- Der Summary-Parser erkennt Semikolon- und Kommaformat und verlangt zentrale SmartRow-Header. Der Detailparser verlangt `Stroke (#)`, `Second (#)` und `Actual power (W)`; optional wird Herzfrequenz importiert ([`src/lib/csvParser.ts`](../../src/lib/csvParser.ts), Zeilen 93–355; [`src/lib/strokeParser.ts`](../../src/lib/strokeParser.ts), Zeilen 25–114).
- Persistierte Sessions und Schlagdaten sind einem authentifizierten Rowing-Tracker-Nutzer zugeordnet; `/api/sessions` prüft die Rowing-Tracker-Session und scoped Lesen/Schreiben auf `userId` ([`src/app/api/sessions/route.ts`](../../src/app/api/sessions/route.ts), Zeilen 12–275; [`prisma/schema.prisma`](../../prisma/schema.prisma), Zeilen 104–160).
- Raw-Dateien werden im jetzigen Manual-Flow nicht dauerhaft gespeichert. Die Datenbank speichert normalisierte Session- und Stroke-Felder, darunter optional `heartRate`.

### Was der CommercialBeta-Grenze widerspricht

- `/api/smartrow/sync` startet serverseitig Playwright, nimmt SmartRow-E-Mail und -Passwort entgegen, meldet sich in das Portal ein, sucht private Exportlinks und lädt Daten automatisiert herunter ([`src/app/api/smartrow/sync/route.ts`](../../src/app/api/smartrow/sync/route.ts), Zeilen 1–415).
- Diese Route enthält selbst keine Rowing-Tracker-Authentifizierungsprüfung. Sie protokolliert außerdem Exportlink-Texte/-URLs, CSV-Header und mehrere Rohdatenzeilen. Die Client-Seite protokolliert bei Auto-Sync die ersten 500 Zeichen sowie Beispielzeilen der CSV ([`src/app/smartrow/sync/route.ts`](../../src/app/api/smartrow/sync/route.ts), Zeilen 104–200; [`src/app/sync/page.tsx`](../../src/app/sync/page.tsx), Zeilen 315–402).
- SmartRow-Credentials werden zwar laut Implementierung nie in der Datenbank gespeichert, aber im Klartext innerhalb der lokalen Browser-Settings in `localStorage` gehalten und bei jedem Auto-Sync an den Rowing-Tracker-Server gesendet ([`src/lib/settings.ts`](../../src/lib/settings.ts), Zeilen 102–106, 245–249 und 430–498; [`src/app/sync/page.tsx`](../../src/app/sync/page.tsx), Zeilen 315–349).
- README und UI bewerben die automatische Synchronisation derzeit als empfohlenen Weg. Eine bloß versteckte Schaltfläche würde die verbotene Serverroute und Credential-Oberfläche nicht beseitigen.

**Konsequenz:** Der CommercialBeta-Build muss Auto-Sync serverseitig sperren beziehungsweise entfernen. „Keine Credentials“ ist eine Artefakt- und API-Eigenschaft, keine UI-Konvention.

### Sicherheits- und Herkunftslücken im manuellen Import

- Der ZIP-Parser lädt das gesamte Archiv mit JSZip, filtert lediglich auf Dateinamen mit `.csv` und verarbeitet alle Treffer. Es gibt keine sichtbaren Grenzen für komprimierte Größe, unkomprimierte Gesamtgröße, Anzahl der Einträge, Größe eines Eintrags oder Kompressionsverhältnis ([`src/lib/zipParser.ts`](../../src/lib/zipParser.ts), Zeilen 93–174).
- `accept=".csv,.zip"` und Dateiendungen sind nur Client-Hinweise. Es fehlen Magic-Byte-/MIME-Prüfung, serverseitige Import-Schema-Validierung und belastbare Zahlenbereiche.
- `/api/sessions` prüft derzeit nur, ob `sessions` ein nicht leeres Array ist. Es gibt kein striktes Zod-Schema für Session- und Stroke-Felder, keine serverseitige Mengenbegrenzung und keine Herkunfts-Attestation ([`src/app/api/sessions/route.ts`](../../src/app/api/sessions/route.ts), Zeilen 60–255).
- Ein ungültiger Summary-Zeitstempel fällt im Parser auf `new Date()` zurück, statt die Zeile abzulehnen. Dadurch können beschädigte oder fremde Dateien als aktuelle Session erscheinen ([`src/lib/csvParser.ts`](../../src/lib/csvParser.ts), Zeilen 15–37).
- `RowingSession.sourceFile` ist nullable, aber der Parser setzt aktuell keine belastbare Herkunft. Es fehlen `sourceKind`, Parser-/Schema-Version und Zeitpunkt der Nutzerbestätigung ([`prisma/schema.prisma`](../../prisma/schema.prisma), Zeilen 104–137).

Diese Lücken bedeuten nicht, dass der Manual-Flow verworfen werden muss. Sie definieren die technische Härtung vor dem ersten externen Beta-Upload.

## 5. Minimaler CommercialBeta-Vertrag

### Was angeboten wird

1. Anmeldung bei Rowing Tracker.
2. Kurze Anleitung mit Link zu SmartRows offizieller „My Workouts“-Seite.
3. Manueller Upload einer offiziellen SmartRow-Summary-CSV.
4. Optional danach manueller Upload des direkt von SmartRow exportierten Detailarchivs, um Schlagdaten an bereits importierte Sessions anzureichern.
5. Speicherung nur der für Verlauf, Basisanalyse und den später separat geregelten PaidOutcome erforderlichen normalisierten Felder; keine Speicherung der Originaldatei per Default.

### Erforderliche Nutzerbestätigung

Vor dem ersten Import, nicht in AGB versteckt:

> **Ich bestätige, dass diese Datei aus meinem eigenen SmartRow-Konto stammt, dass ich zu ihrem Upload und ihrer Auswertung berechtigt bin und dass sie keine Workout- oder Gesundheitsdaten anderer Personen enthält.**

Daneben eine dauerhafte Sicherheitsinformation:

> **Exportiere deine Workouts selbst bei SmartRow unter „My Workouts“ und lade die Datei hier hoch. Rowing Tracker benötigt niemals dein SmartRow-Passwort.**

Diese Bestätigung dokumentiert Herkunft und Berechtigung. Sie ist **keine** Ersatz-Einwilligung für alle Datenschutz- oder AI-Verarbeitungszwecke.

### Unabhängigkeits- und Markencopy

In Importhilfe, Footer/Legal und jeder SmartRow-bezogenen Landingpage:

> **Rowing Tracker ist ein unabhängiger Dienst und nicht mit SmartRow oder Ergometer Innovations B.V. verbunden, von ihnen unterstützt oder autorisiert. SmartRow wird ausschließlich verwendet, um die Herkunft kompatibler, vom Nutzer selbst exportierter Workout-Dateien zu beschreiben. Alle Marken gehören ihren jeweiligen Inhabern.**

Zusätzliche Regeln:

- eigener Produktname und eigenes Logo deutlich dominierend;
- SmartRow nur als Plain-Text-Quelle/Kompatibilität, nicht im Produktnamen;
- keine SmartRow-Logos, Screenshots oder nachgebaute Portal-Optik ohne Erlaubnis;
- nicht „SmartRow Sync“, sondern „SmartRow-Export importieren“;
- keine Aussagen wie „offiziell“, „Partner“, „zertifiziert“ oder „verifiziert“.

## 6. Technische Gates vor externem Beta-Zugang

Die spätere Umsetzung muss mindestens durch automatisierte Akzeptanztests beweisen:

1. **Credential-Negativvertrag:** Im CommercialBeta-Artefakt gibt es kein SmartRow-E-Mail-/Passwortfeld, keinen SmartRow-Credential-Key im Local Storage, keinen Request mit SmartRow-Credentials und keine erreichbare Playwright-/Auto-Sync-Route.
2. **Nur manuelle Herkunft:** Import setzt `sourceKind = smartrow-manual-export`, eine Parser-/Schema-Version, einen bereinigten Originaldateinamen und `userAttestedAt`. Ein Clientwert allein gilt nicht als vertrauenswürdige Validierung; der Server prüft das Persistenzschema unabhängig.
3. **Datei-Allowlist:** Nur CSV und ZIP; CSV per Header/Encoding/Delimiter, ZIP per Magic Bytes und Inhalt validieren. TCX, FIT, JSON, verschachtelte Archive, verschlüsselte Archive, Symlinks und Nicht-CSV-Einträge werden abgewiesen.
4. **Ressourcenlimits:** Vor Entpacken gelten konfigurierte, getestete Grenzen für Uploadgröße, Entry-Anzahl, Einzelgröße, unkomprimierte Gesamtgröße, Kompressionsverhältnis und Verarbeitungszeit. Startwerte werden gegen echte SmartRow-Exportarchive kalibriert, nicht geraten.
5. **Striktes Datenschema:** Ungültige Zeitstempel, negative oder unrealistische Dauer/Distanz/Leistung, nicht-finite Werte, zu viele Sessions/Strokes und unbekannte Header-Versionen werden mit verständlicher Meldung abgewiesen. Kein `new Date()`-Fallback für beschädigte Daten.
6. **Keine Rohdatenlogs:** Keine CSV-Zeilen, Workoutwerte, Herzfrequenzdaten, Dateiinhalte, Credentials, Cookies oder privaten Export-URLs in Browser-, Server- oder Observability-Logs. Fehler verwenden Request-ID, Parsercode und aggregierte Zähler.
7. **Datenminimierung:** Originaldatei standardmäßig nur transient im Browser beziehungsweise in einem kurzlebigen Quarantänepfad verarbeiten und danach verwerfen; dauerhaft nur deklarierte normalisierte Felder speichern. Export und Löschung bleiben pro Nutzer möglich.
8. **Tenant-Isolation und Missbrauchsschutz:** Upload und Persistenz erfordern Authentifizierung, Rate Limits, serverseitige Mengenlimits und `userId`-Scoping. Direkte API-Aufrufe dürfen Clientvalidierung nicht umgehen.
9. **Affiliation-Test:** UI und Metadaten enthalten die Unabhängigkeitscopy; kein SmartRow-Logo und kein Partnersignal. Produktname und Browser-/Share-Metadaten bleiben Rowing Tracker.
10. **Format-Drift:** Bekannte SmartRow-Summary- und Detail-Fixtures haben versionsbezogene Contract-Tests. Unbekannte Varianten werden nicht stillschweigend als Nullwerte importiert, sondern als nicht unterstützt gemeldet.

Das Datenschutz-Ticket muss vor dem Hosted-AI-Einsatz zusätzlich Rechtsgrundlage, Informationspflichten, besondere Kategorien, Auftragsverarbeiter/Unterauftragsverarbeiter, Transfers, Aufbewahrung, Löschung, Datenexport und AI-Input-Grenze festlegen.

## 7. Fakten, Inferences und Unknowns im Abschluss

### Fakten

- SmartRow erlaubt in seiner offiziellen FAQ den manuellen Upload selbst exportierter Workout-Dateien in einen Dienst nach Wahl.
- SmartRows am 24.07.2026 aktualisierter Google-Play-Eintrag nennt die Verwendung von Portal-Downloads in anderen Apps, Tabellen und KI-Tools ausdrücklich als vorgesehenen Weg.
- CSV, TCX und FIT sind sichtbare Exportformate; „Export all“ ist ein offizieller Nutzer-Workflow.
- SmartRow dokumentiert Strava/Apple Health und Bluetooth-Broadcast als eigene beziehungsweise kooperativ optimierte Integrationen.
- Es wurde kein öffentliches SmartRow-Entwicklerprogramm und keine Drittanbieter-API-Lizenz gefunden.
- Der aktuelle Rowing-Tracker-Code besitzt sowohl einen passenden manuellen CSV/ZIP-Weg als auch einen widersprechenden Credential-/Playwright-Weg.
- Der aktuelle Manual-Importer benötigt vor externer Nutzung Ressourcen-, Schema-, Herkunfts- und Logging-Härtung.

### Inferences/Entscheidungen

- Nutzerinitiierter manueller Export/Upload ist der kommerziell risikoärmste und für die PaidOutcome-Validierung ausreichende Weg.
- Das Recht auf Datenportabilität stützt Nutzerkontrolle, genehmigt aber keine beliebige technische Integration.
- Credentials, private APIs, Browserautomation und Reverse Engineering sind für die Beta gesperrt.
- FTMS, Strava, Apple Health und andere Connectoren sind eigenständige spätere Integrationsprodukte, keine Abkürzung für die Beta. Eine markenneutrale FTMS-Standardnutzung ist separat von SmartRow-Partnerschafts- und Brandingfragen zu prüfen.
- SmartRow wird nur beschreibend und zusammen mit eindeutiger Unabhängigkeitscopy verwendet.

### Unknowns

- Welche App-/Portal-Nutzungsbedingungen einzelne SmartRow-Nutzer bei Registrierung akzeptiert haben.
- Ob Ergometer Innovations B.V. Rowing Tracker eine Partnerschaft, API oder Markenfreigabe anbieten würde.
- Ob das Bulk-Exportarchiv und seine Dateinamen/Formate dauerhaft stabil bleiben.
- Welche Workoutfelder im konkreten Betreiber-/Nutzungskontext als Gesundheitsdaten nach Art. 9 behandelt werden müssen.
- Welche Limits reale langjährige SmartRow-Exportarchive benötigen.
- Welche Datenqualität und SmartRow-spezifische Detailtiefe bei Import über Strava, Apple Health oder TCX/FIT erhalten bliebe.

## Empfohlener nächster Schritt

Die Wayfinder-Entscheidung kann mit der Manual-first-Grenze geschlossen werden. Die Implementierung sollte danach nicht ad hoc erfolgen, sondern als eigener Spec-/Ticket-Satz: Auto-Sync und Credentials aus dem CommercialBeta-Artefakt entfernen, den manuellen Import härten, Herkunft/Copy verankern und erst dann externe Beta-Dateien akzeptieren.

Parallel kann der Betreiber SmartRow schriftlich und eng fragen, ob eine unabhängige, nutzerinitiierte CSV-/ZIP-Analyse aus ihrer Sicht Einwände auslöst und ob es ein offizielles Partner-/API-Programm gibt. Bis zu einer ausdrücklichen Antwort ändert diese Anfrage die Beta-Grenze nicht.

## Primärquellen

- [SmartRow FAQ: Export, manuelle Drittanbieter-Uploads, Strava und Broadcasting](https://smartrow.fit/faq-smartrow-app/)
- [SmartRow My Workouts/Portal](https://smartrow.fit/my-workouts/)
- [SmartRow Privacy Policy](https://smartrow.fit/privacy-policy/)
- [SmartRow Broadcasting Manual](https://smartrow.fit/static/Broadcasting-Manual.pdf)
- [SmartRow Power Handle/FTMS](https://smartrow.fit/smartrow-power-handle/)
- [SmartRow Sitemap](https://smartrow.fit/page-sitemap.xml)
- [SmartRow bei Google Play](https://play.google.com/store/apps/details?id=nl.appsint.handle)
- [SmartRow im Apple App Store](https://apps.apple.com/us/app/smartrow/id1223542275)
- [DSGVO, Verordnung (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/2016-05-04)
- [EU-Software-Richtlinie 2009/24/EG](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX%3A32009L0024)
- [EU-Markenverordnung 2017/1001](https://eur-lex.europa.eu/eli/reg/2017/1001)
- [Strava API Docs](https://developers.strava.com/docs/), [OAuth](https://developers.strava.com/docs/authentication/), [Brand Guidelines](https://developers.strava.com/guidelines/)
- [Apple HealthKit: Protecting User Privacy](https://developer.apple.com/documentation/healthkit/protecting-user-privacy)

Alle Webquellen wurden am 2026-08-02 abgerufen. Repository-Quellen beziehen sich auf Commit `4eaab158fcbf1116ae67dbb33b86c54049599f68`.
