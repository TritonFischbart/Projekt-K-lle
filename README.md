# Projekt Kölle

Die WG-Website von Lukas, Julian und Jana.

- 💶 **Ausgaben** – wer hat was bezahlt, wer schuldet wem wie viel, Ausgleichen mit möglichst wenigen Überweisungen
- 📅 **Kalender** – kommt bald (gemeinsamer Google-Kalender)
- 🧹 **Putzplan** – kommt bald

Einrichtung: siehe [ANLEITUNG.md](ANLEITUNG.md).
Ausprobieren ohne Einrichtung: die Website mit `?demo` am Ende der Adresse öffnen.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Gerüst der Seite |
| `css/style.css` | Aussehen (Farben, Abstände) |
| `js/app.js` | Bedienung und Anzeige |
| `js/money.js` | Rechnen: Aufteilen, Kontostände, Ausgleichs-Vorschlag |
| `js/config.js` | Namen und Kategorien |
| `js/firebase-config.js` | Verbindungsdaten zu Firebase |
| `js/firebase.js` | Anmeldung und gemeinsame Datenbank |
| `js/demo.js` | Demo-Modus mit Beispieldaten |
| `firestore.rules` | Vorlage für die Sicherheitsregeln der Datenbank |
