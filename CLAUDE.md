# CLAUDE.md – Projekt Kölle

Notizen für zukünftige Claude-Sitzungen. Hier steht alles Wichtige, was in
früheren Gesprächen besprochen und entschieden wurde.

> ⚠️ Dieses Repository ist **öffentlich**. Hier niemals E-Mail-Adressen,
> Kalender-IDs, API-Schlüssel oder andere private Daten eintragen.

---

## Wer und was

- WG-Website für die Dreier-WG in **Köln**: **Jana, Jul und Lukas**.
- Auftraggeber ist **Lukas** (GitHub-Konto `TritonFischbart`). „Triton“ war ein
  früherer Platzhalter-Name – in der App heißt er **Lukas**.
- **Jul** heißt intern weiterhin `julian` (die ID bleibt, damit alte Daten passen).
- **Es wird keine neuen Mitbewohner geben** – eine Funktion zum Wechseln von Personen
  ist ausdrücklich nicht gewünscht.
- Live: **https://tritonfischbart.github.io/Projekt-K-lle/**
- Demo mit Beispieldaten (ohne Login, speichert nichts): an die Adresse `?demo` anhängen.

## Wie mit Lukas arbeiten

- **Immer auf Deutsch**, einfach und ohne Fachchinesisch erklären. Lukas ist
  Anfänger und kann nicht programmieren.
- Fachbegriffe kurz erklären (z. B. „Pull Request = Anfrage, die Änderungen zu übernehmen“).
- **Nach jeder fertigen und getesteten Änderung eine Pull Request nach `main`
  erstellen und sie selbst mergen** (Lukas hat das ausdrücklich so gewünscht).
  Danach den Link schicken und kurz sagen, dass es in ein paar Minuten online ist.
- Vor dem Weiterarbeiten prüfen, ob die letzte Pull Request schon gemergt ist.
  Wenn ja: Arbeitszweig neu von `main` starten. Wenn sie noch offen ist:
  weitere Commits auf denselben Zweig (die PR aktualisiert sich).
- Nach dem Merge dauert es ein paar Minuten, bis die Seite aktualisiert ist
  (GitHub-Pages-Cache). Tipp für Lukas: kurz warten oder privaten Tab nutzen.
- Lukas soll Dateien **nicht direkt auf GitHub bearbeiten**, während Claude
  arbeitet (gab schon mal einen README-Konflikt).
- Lukas schickt gern Screenshots, wenn er bei Google/Firebase-Einstellungen hängt.
  Die Oberflächen dort sind teils Englisch, teils Deutsch → beide Begriffe nennen.

## Technik

- **Reine statische Website**: HTML, CSS, JavaScript (ES-Module), **kein Build-Schritt**,
  keine Frameworks, kein npm.
- **Hosting:** GitHub Pages aus `main`, Ordner `/ (root)`. Datei `.nojekyll` vorhanden.
- **Datenbank & Login:** Firebase (Gratis-Tarif „Spark“), Projekt-ID `projekt-koelle`.
  - Firestore, Standort `europe-west3` (Frankfurt), Produktionsmodus.
  - Anmeldung: Google (Popup, bei Bedarf Redirect). Autorisierte Domain:
    `tritonfischbart.github.io`.
  - **Sicherheitsregeln:** Nur die drei WG-E-Mail-Adressen dürfen lesen/schreiben.
    Die echten Adressen stehen **nur in der Firebase-Konsole**; `firestore.rules`
    im Repo ist eine Vorlage mit Platzhaltern. Lukas' Google-Konto nutzt eine
    AOL-Adresse (funktioniert).
  - Firebase-SDK per CDN: `https://www.gstatic.com/firebasejs/10.12.2/…`
  - Die Firebase-Konfiguration in `js/firebase-config.js` ist nicht geheim.
- **Google Kalender:** gemeinsamer Kalender „WG Kölle“ (öffentlich freigegeben,
  mit Jana und Jul geteilt). Termine werden per Google Calendar API (API-Schlüssel,
  beschränkt auf `https://tritonfischbart.github.io/*` und die Calendar API) abgeholt.
  **Kalender-ID und API-Schlüssel stehen nur in Firestore** (`settings/kalender`),
  eingetragen über die App („Kalender verbinden“).

### Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Gerüst, Tabs, Dialoge (Ausgabe, Putz-Bereiche, Kalender, Einkaufs-Kategorie) |
| `css/style.css` | Design (rot-weiß, hell/dunkel, Handy & iPad) |
| `js/app.js` | Hauptprogramm: Anmeldung, Anzeige, Bedienung aller Bereiche |
| `js/config.js` | Personen (Reihenfolge/Farben), Ausgaben-Kategorien, Standard-Putzbereiche |
| `js/money.js` | Geld in Cent, Aufteilen, Kontostände, Ausgleichs-Vorschlag |
| `js/chores.js` | Putzplan: Wochen (ISO-KW, ab Montag), Rotation |
| `js/calendar.js` | Google-Termine abholen und nach Tagen gruppieren |
| `js/shopcats.js` | Einkaufs-Kategorien (Supermarkt-Reihenfolge) + automatische Zuordnung |
| `js/recurring.js` | Daueraufträge: welche Monate fällig sind |
| `js/stats.js` | Monatsübersicht der Ausgaben |
| `js/export.js` | Datensicherung (JSON) und Ausgaben-Tabelle (CSV für Excel) |
| `js/absences.js` | Urlaubs-Modus: wer wann weg ist |
| `js/images.js` | Bilder fürs Schwarze Brett auf dem Handy verkleinern |
| `js/firebase.js` | Firebase-Anbindung (Backend) |
| `js/demo.js` | Demo-Backend mit Beispieldaten (`?demo`) |
| `manifest.webmanifest`, `icons/` | App-Symbol (Kölner Dom) für den Home-Bildschirm |
| `ANLEITUNG.md` | Einrichtungs-Anleitung für Lukas (Firebase, Pages, Kalender) |

### Wichtige Regeln im Code

- **Versionsnummer `?v=N`**: Bei jeder Änderung an CSS/JS die Nummer überall
  erhöhen (in `index.html`, allen Imports in `js/app.js` und `js/demo.js`),
  sonst laden Handys alte Dateien. Aktuell: siehe `index.html`.
- Beide Backends (`firebase.js`, `demo.js`) haben dieselben Funktionen:
  `onUser, login, logout, watch, add, update, remove, set, settleAll, now`
  (Demo zusätzlich `demoEvents`). Neue Funktionen in beiden ergänzen.
- Texte aus der Datenbank immer mit `esc()` ausgeben (Schutz vor HTML-Einschleusung).
- Formulare liegen als `<dialog>` statisch in `index.html` – nicht in Bereiche
  rendern, die bei jeder Datenänderung neu gezeichnet werden (sonst gehen Eingaben verloren).

### Firestore-Sammlungen

| Sammlung | Inhalt |
|---|---|
| `members/{jana,julian,lukas}` | Wer welcher Person zugeordnet ist (`uid`, `email`) – beim ersten Login „Wer bist du?“ |
| `expenses` | Ausgaben: `description, amountCents, paidBy, splitAmong[], category, date, settlementId` |
| `payments` | Abgehakte Überweisungen: `from, to, amountCents, date, settlementId` |
| `settlements` | Abrechnungen („Alles ausgeglichen“): `expenseCount, totalCents, createdAt` |
| `chores/{KW}_{bereich}` | Putzplan-Status pro Woche: `assignee, doneBy, doneAt` |
| `settings/putzplan` | In der App bearbeitete Putzbereiche (`areas[]`) |
| `settings/kalender` | `calendarId`, `apiKey` |
| `shopping` | Einkaufsliste: `name, category, addedBy, doneBy, doneAt` |
| `favorites/{name}` | Wie oft etwas gekauft wurde + gemerkte Kategorie (Schnellauswahl) |
| `recurring` | Daueraufträge: `description, amountCents, paidBy, splitAmong, category, dayOfMonth (1–28), lastBooked ("2026-11")` |
| `notes` | Schwarzes Brett: `title, text, createdBy, updatedBy` (ID wird in der App erzeugt) |
| `noteImages` | Bilder zu Notizen: `noteId, data` (JPEG als Data-URL, max. ~0,9 MB), `width, height` |
| `settings/backup` | Wann zuletzt gesichert wurde (`at`, `by`) |
| `absences` | Abwesenheiten: `person, from, to ("2026-11-10"), note` |
| `polls` | Abstimmungen: `question, options[], votes {person: index}, closed, closedAt` (Stimme per `votes.{person}` speichern) |

Ausgaben aus Daueraufträgen haben die feste ID `rec_{auftrag}_{monat}` und das Feld
`recurringId` – so wird auch bei zwei gleichzeitig geöffneten Handys nichts doppelt gebucht.
Einkäufe, die schon als Ausgabe eingetragen wurden, haben `expensed: true`.

## Funktionen und Entscheidungen

### Allgemein
- Name **„Projekt Kölle“**, Logo: **Kölner Dom** (Westfassade, zwei Türme), weiß auf rotem Grund.
- Design konsequent in den **Kölner Stadtfarben Rot und Weiß** (`--brand: #ed1c24`, kräftiges Rot wie beim 1. FC Köln,
  rote Kopfzeile, weißer Hintergrund, rotes Logo). Anfangs war es grün – Lukas wollte
  ausdrücklich **kein Grün mehr im Design**. Wer Geld bekommt/schuldet, zeigen Text und
  Vorzeichen (+ / −), nicht die Farbe. (Lukas' Personenfarbe ist weiterhin grün.)
- **Hell/Dunkel wechselt automatisch** mit der Einstellung des Handys – das ist ausdrücklich
  gewünscht (kurz war es „immer hell“, Lukas wollte den automatischen Wechsel zurück).
- Lukas wollte **keine Putz-Statistik** („wer wie oft geputzt hat“) – klingt blöd. Nicht wieder einbauen.
- Personen-Reihenfolge: **Jana, Jul, Lukas**. Farben: Jana hellbraun `#a97b50`,
  Jul blau `#2b6cb0`, Lukas grün `#2f7d4f`.
- Untere Leiste: **Start · Ausgaben · Einkauf · Putzplan · Infos**. Der **Kalender**
  hat keinen eigenen Knopf mehr – er hängt an der Startseite („Ganzer Kalender ›“,
  „‹ Zur Übersicht“), damit die Leiste auf dem Handy nicht zu voll wird.
- **Start (Übersicht)**: Begrüßung, nächste Termine, Kontostand, Einkaufsliste, eigene
  Putzaufgabe (mit „Erledigt“), Abstimmungen, „Wer ist weg?“.
- **Rückgängig**: Gelöschte Ausgaben, Daueraufträge, Überweisungen, Einkäufe, Notizen,
  Abstimmungen und Abwesenheiten lassen sich 6 Sekunden lang über die Meldung zurückholen.
- **Offline-Hinweis** oben, wenn das Handy kein Netz hat (Firestore speichert später).
- Kann als App auf den Home-Bildschirm gelegt werden (Manifest + Icons).

### 💶 Ausgaben
- Beträge in **Cent**. Aufteilung **immer gleichmäßig** auf die ausgewählten Personen.
- Kategorien: Lebensmittel, Haushalt, Internet & Strom, Freizeit, Sonstiges.
- Einträge bearbeiten und löschen erlaubt.
- Ausgleichs-Vorschlag mit möglichst wenigen Überweisungen.
- **Suche** („🔍 Suchen“ bei den Einträgen): Beschreibung, Kategorie, Person, Betrag –
  auch in früheren Abrechnungen.
- „Ausgeglichen“: beides gewünscht – einzelne Überweisungen abhaken **und**
  „Alles ausgeglichen – neu starten“ (alles auf 0, alte Einträge unter
  „Frühere Abrechnungen“).
- **Monatsübersicht**: Summe pro Monat, Balken der letzten 6 Monate, nach Kategorie
  und nach Person (zählt alle Ausgaben, auch abgerechnete).
- **Daueraufträge** (z. B. Internet, Netflix): werden am gewählten Tag (1.–28.)
  automatisch eingetragen, sobald jemand die App öffnet. Markiert mit 🔁.

### 🛒 Einkauf
- Jeder trägt ein, was fehlt (mehrere mit Komma). Antippen = besorgt
  (durchgestrichen, mit Name). „Liste aufräumen“ entfernt Besorgtes.
- **Schnellauswahl**: ab 2× eingetragen erscheint ein Knopf; „Bearbeiten“ zum Entfernen.
- **Mengen**: „2x Milch“, „Milch 2x“, „500 g Hack“, „3 Dosen Tomaten“ → Menge wird
  als kleines Schild angezeigt (Feld `amount`), Name bleibt für Kategorie/Schnellauswahl.
- **Als Ausgabe eintragen**: eigene besorgte Sachen werden mit einem Tipp als Ausgabe
  vorausgefüllt (nur noch Betrag eingeben).
- **Kategorien in Supermarkt-Reihenfolge** (orientiert am Weg durch einen
  typischen Laden): Obst & Gemüse → Brot → Kühlregal → Fleisch & Fisch → Tiefkühl
  → Vorrat → Frühstück → Süßes → Getränke → Drogerie → Haushalt → Sonstiges.
  Automatische Zuordnung per Stichwort (bei zusammengesetzten Wörtern zählt das
  Ende: „Orangensaft“ → Getränke). Kategorie lässt sich pro Eintrag ändern; die
  App merkt sich das in `favorites`.

### 🧹 Putzplan
- Standard-Bereiche: Bad, Küche, Böden & Müll – **in der App bearbeitbar**.
- **Symbole der Bereiche**: werden beim Tippen des Namens automatisch passend gewählt
  (Müll 🗑️, Altglas 🍾, Papier 📦 …, siehe `guessAreaIcon` in `chores.js`) und lassen sich
  per Antippen aus einer Auswahl ändern. Bereiche mit dem alten Standard-Symbol 🧽 bekommen
  beim Öffnen von „Bereiche bearbeiten“ automatisch ein passendes. Löschen-Knopf ist ✕
  (nicht 🗑, sonst Verwechslung mit Müll).
- Wechsel **jede Woche** (Montag), Rotation der Reihe nach.
- „Erledigt ✓“, „Ich übernehme“ (spontan tauschen), „Zurückgeben“.
- Erinnerungen vorerst nur als Hinweis in der App (roter Punkt, Startseite).
- **Urlaubs-Modus**: Wer in einer Woche mindestens 4 Tage weg ist, bekommt keine
  Putzaufgabe; seine Bereiche gehen an die Anwesenden („statt Jana – nicht da“).

### 🗳️ Abstimmungen
- Auf der Startseite: Frage + 2–6 Antworten (oder „Ja / Nein“). Antippen = abstimmen,
  nochmal tippen = Stimme zurücknehmen. „Beenden“ zeigt das Ergebnis (bleibt 7 Tage sichtbar).
  Roter Punkt an „Start“, solange man selbst noch nicht abgestimmt hat.

### 📌 Infos
- **Schwarzes Brett**: Notizen mit Vorlagen (WLAN, Vermieter, Zählerstände, Schlüssel,
  Notfall). „Text kopieren“ z. B. fürs WLAN-Passwort.
- **Bilder** an Notizen (z. B. Grundriss aus dem Exposé): werden auf dem Handy auf
  max. 1600 px / < 0,9 MB verkleinert und **in Firestore** gespeichert (kostenlos, kein
  Firebase Storage/„Blaze“ nötig). Vorschaubilder, Tippen = groß, nochmal = Zoom.
  PDFs gehen nicht direkt → Screenshot der Seite.
- **Datensicherung**: „Alle Daten sichern“ (JSON, ohne API-Schlüssel) und „Ausgaben
  als Tabelle (Excel)“. Auf dem Handy über „Teilen“ speichern. Hinweis, wenn die letzte
  Sicherung über 30 Tage her ist.
- **Sicherung zurückspielen**: JSON-Datei auswählen → Einträge aus der Sicherung werden
  wiederhergestellt/auf deren Stand gesetzt, neuere Einträge bleiben erhalten.

### 📅 Kalender
- Variante „eigenes Design“ (nicht eingebettet): nächste 60 Tage, gruppiert nach Tagen,
  „＋ Termin eintragen“ öffnet Google Kalender, Aktualisierung alle 5 Minuten.

## Merkliste / To-do für später (noch nicht gebaut)

> Die Aufgaben stehen auch als **GitHub-Issues** im Projekt (Reiter „Issues“):
> #10 Test mit Jana und Jul · #11 Termine direkt eintragen · #12 Push-Nachrichten ·
> #13 Kassenbon-Fotos · #14 Müllabfuhr-Termine · #15 Ideen-Sammlung.
> Wenn etwas davon erledigt ist, das Issue schließen und hier austragen.

- **Termine direkt in der App eintragen** (statt über Google Kalender). Von Lukas
  ausdrücklich auf die Merkliste gesetzt. Hürde: Schreibzugriff auf Google Kalender
  braucht eine Google-Anmeldung mit Kalender-Berechtigung (OAuth, Zustimmungsbildschirm
  in der Google Cloud Console, im Testmodus Nutzer eintragen) – vorher mit Lukas klären.

- **Push-Nachrichten** (z. B. Putz-Erinnerung) – Lukas will das später.
  Zeitgesteuerte Erinnerungen bräuchten vermutlich Cloud Functions → Firebase-Tarif
  „Blaze“ mit Kreditkarte. Vorher mit Lukas klären.
- **Kassenbon-Fotos** bei Ausgaben – bräuchte Firebase Storage (ebenfalls „Blaze“).
- **Müllabfuhr-Termine** der AWB Köln in den Google-Kalender übernehmen (ohne Code).
- Prüfen, ob die Google-Anmeldung in der Home-Bildschirm-App auf allen Handys klappt
  (Teil des Tests mit Jana und Jul, #10).
- **Ideen-Sammlung** (#15, erst nach dem Test entscheiden): mehrere Einkaufslisten,
  „Ich geh jetzt einkaufen“, Schnell-Notizen auf der Startseite, Bewertung für den WG-Abend.

## Testen

- Diese Cloud-Umgebung erreicht **Firebase, Google-APIs und github.io nicht** →
  echte Verbindung kann nur Lukas testen. Immer im **Demo-Modus** testen:
  `python3 -m http.server 8123` im Projektordner, dann mit Playwright
  `http://localhost:8123/?demo` auf iPhone- und iPad-Größe öffnen.
- Reine Logik (`money.js`, `chores.js`, `calendar.js`, `shopcats.js`) lässt sich
  direkt mit Node testen.
- Prüfen, dass die Seite auf Handy-Breite nicht breiter als der Bildschirm wird.
