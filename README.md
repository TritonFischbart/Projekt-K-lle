# Projekt Kölle

Die WG-Website von Jana, Jul und Lukas.

- 💶 **Ausgaben** – wer hat was bezahlt, wer schuldet wem wie viel, Ausgleichen mit möglichst wenigen Überweisungen, Daueraufträge, Monatsübersicht und Suche
- 🏠 **Start** – Übersicht mit Terminen, Kontostand, Einkauf, Putzaufgabe, Abstimmungen und „Wer ist weg?“
- 📅 **Kalender** – Termine aus dem gemeinsamen Google-Kalender (über die Startseite)
- 🛒 **Einkauf** – gemeinsame Einkaufsliste, sortiert wie im Supermarkt, mit Schnellauswahl; Besorgtes wird durchgestrichen
- 🧹 **Putzplan** – Bereiche direkt in der App bearbeitbar; wechselt jede Woche, mit Erledigt-Haken und „Ich übernehme“
- 📌 **Infos** – Schwarzes Brett und Datensicherung

Einrichtung: siehe [ANLEITUNG.md](ANLEITUNG.md). Notizen für Claude: [CLAUDE.md](CLAUDE.md).
Ausprobieren ohne Einrichtung: die Website mit `?demo` am Ende der Adresse öffnen.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Gerüst der Seite |
| `css/style.css` | Aussehen (Farben, Abstände) |
| `js/app.js` | Bedienung und Anzeige |
| `js/money.js` | Rechnen: Aufteilen, Kontostände, Ausgleichs-Vorschlag |
| `js/chores.js` | Putzplan: Wochen und wer dran ist |
| `js/calendar.js` | Kalender: Termine von Google abholen und sortieren |
| `js/shopcats.js` | Einkauf: Kategorien in Supermarkt-Reihenfolge |
| `js/recurring.js` | Daueraufträge |
| `js/stats.js` | Monatsübersicht |
| `js/export.js` | Datensicherung |
| `js/absences.js` | Urlaubs-Modus |
| `js/config.js` | Namen, Kategorien und Standard-Putzbereiche |
| `js/firebase-config.js` | Verbindungsdaten zu Firebase |
| `js/firebase.js` | Anmeldung und gemeinsame Datenbank |
| `js/demo.js` | Demo-Modus mit Beispieldaten |
| `firestore.rules` | Vorlage für die Sicherheitsregeln der Datenbank |
