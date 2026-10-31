# Projekt Kölle

Die WG-Website von Jana, Jul und Lukas.

- 💶 **Ausgaben** – wer hat was bezahlt, wer schuldet wem wie viel, Ausgleichen mit möglichst wenigen Überweisungen
- 📅 **Kalender** – Termine aus dem gemeinsamen Google-Kalender, „Heute“ auf der Startseite
- 🛒 **Einkauf** – gemeinsame Einkaufsliste mit Schnellauswahl für häufige Sachen, Besorgtes wird durchgestrichen
- 🧹 **Putzplan** – Bereiche direkt in der App bearbeitbar; wechselt jede Woche, mit Erledigt-Haken und „Ich übernehme“

Einrichtung: siehe [ANLEITUNG.md](ANLEITUNG.md).
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
| `js/config.js` | Namen, Kategorien und Standard-Putzbereiche |
| `js/firebase-config.js` | Verbindungsdaten zu Firebase |
| `js/firebase.js` | Anmeldung und gemeinsame Datenbank |
| `js/demo.js` | Demo-Modus mit Beispieldaten |
| `firestore.rules` | Vorlage für die Sicherheitsregeln der Datenbank |
