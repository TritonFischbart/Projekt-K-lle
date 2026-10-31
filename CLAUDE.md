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
- Live: **https://tritonfischbart.github.io/Projekt-K-lle/**
- Demo mit Beispieldaten (ohne Login, speichert nichts): an die Adresse `?demo` anhängen.

## Wie mit Lukas arbeiten

- **Immer auf Deutsch**, einfach und ohne Fachchinesisch erklären. Lukas ist
  Anfänger und kann nicht programmieren.
- Fachbegriffe kurz erklären (z. B. „Pull Request = Anfrage, die Änderungen zu übernehmen“).
- **Nach jeder fertigen Änderung automatisch eine Pull Request nach `main`
  erstellen** (Lukas hat das ausdrücklich erlaubt) und den Link schicken.
  Lukas tippt dann selbst auf „Merge pull request“ → „Confirm merge“.
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
| `css/style.css` | Design (grün, hell/dunkel, Handy & iPad) |
| `js/app.js` | Hauptprogramm: Anmeldung, Anzeige, Bedienung aller Bereiche |
| `js/config.js` | Personen (Reihenfolge/Farben), Ausgaben-Kategorien, Standard-Putzbereiche |
| `js/money.js` | Geld in Cent, Aufteilen, Kontostände, Ausgleichs-Vorschlag |
| `js/chores.js` | Putzplan: Wochen (ISO-KW, ab Montag), Rotation |
| `js/calendar.js` | Google-Termine abholen und nach Tagen gruppieren |
| `js/shopcats.js` | Einkaufs-Kategorien (Supermarkt-Reihenfolge) + automatische Zuordnung |
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

## Funktionen und Entscheidungen

### Allgemein
- Name **„Projekt Kölle“**, Farbe **grün**, Logo: **Kölner Dom** (Westfassade, zwei Türme).
- Personen-Reihenfolge: **Jana, Jul, Lukas**. Farben: Jana hellbraun `#a97b50`,
  Jul blau `#2b6cb0`, Lukas grün `#2f7d4f`.
- Untere Leiste: **Ausgaben · Einkauf · Putzplan · Kalender**.
- Startseite (Ausgaben) zeigt oben Hinweise: „Heute in der WG“ (Kalender) und
  „Diese Woche bist du dran mit …“ (Putzplan).
- Kann als App auf den Home-Bildschirm gelegt werden (Manifest + Icons).

### 💶 Ausgaben
- Beträge in **Cent**. Aufteilung **immer gleichmäßig** auf die ausgewählten Personen.
- Kategorien: Lebensmittel, Haushalt, Internet & Strom, Freizeit, Sonstiges.
- Einträge bearbeiten und löschen erlaubt.
- Ausgleichs-Vorschlag mit möglichst wenigen Überweisungen.
- „Ausgeglichen“: beides gewünscht – einzelne Überweisungen abhaken **und**
  „Alles ausgeglichen – neu starten“ (alles auf 0, alte Einträge unter
  „Frühere Abrechnungen“).

### 🛒 Einkauf
- Jeder trägt ein, was fehlt (mehrere mit Komma). Antippen = besorgt
  (durchgestrichen, mit Name). „Liste aufräumen“ entfernt Besorgtes.
- **Schnellauswahl**: ab 2× eingetragen erscheint ein Knopf; „Bearbeiten“ zum Entfernen.
- **Kategorien in Supermarkt-Reihenfolge** (orientiert am Weg durch einen
  typischen Laden): Obst & Gemüse → Brot → Kühlregal → Fleisch & Fisch → Tiefkühl
  → Vorrat → Frühstück → Süßes → Getränke → Drogerie → Haushalt → Sonstiges.
  Automatische Zuordnung per Stichwort (bei zusammengesetzten Wörtern zählt das
  Ende: „Orangensaft“ → Getränke). Kategorie lässt sich pro Eintrag ändern; die
  App merkt sich das in `favorites`.

### 🧹 Putzplan
- Standard-Bereiche: Bad, Küche, Böden & Müll – **in der App bearbeitbar**.
- Wechsel **jede Woche** (Montag), Rotation der Reihe nach.
- „Erledigt ✓“, „Ich übernehme“ (spontan tauschen), „Zurückgeben“.
- Erinnerungen vorerst nur als Hinweis in der App (roter Punkt, Startseite).

### 📅 Kalender
- Variante „eigenes Design“ (nicht eingebettet): nächste 60 Tage, gruppiert nach Tagen,
  „＋ Termin eintragen“ öffnet Google Kalender, Aktualisierung alle 5 Minuten.

## Ideen für später (noch nicht gebaut)

- **Push-Nachrichten** (z. B. Putz-Erinnerung) – Lukas will das später.
  Zeitgesteuerte Erinnerungen bräuchten vermutlich Cloud Functions → Firebase-Tarif
  „Blaze“ mit Kreditkarte. Vorher mit Lukas klären.
- Einkauf → „Als Ausgabe eintragen“.
- Monatsübersicht der Ausgaben.

## Testen

- Diese Cloud-Umgebung erreicht **Firebase, Google-APIs und github.io nicht** →
  echte Verbindung kann nur Lukas testen. Immer im **Demo-Modus** testen:
  `python3 -m http.server 8123` im Projektordner, dann mit Playwright
  `http://localhost:8123/?demo` auf iPhone- und iPad-Größe öffnen.
- Reine Logik (`money.js`, `chores.js`, `calendar.js`, `shopcats.js`) lässt sich
  direkt mit Node testen.
- Prüfen, dass die Seite auf Handy-Breite nicht breiter als der Bildschirm wird.
