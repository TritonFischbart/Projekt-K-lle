# Anleitung: Projekt Kölle einrichten

Das dauert ungefähr 15–20 Minuten. Am besten am Computer, es geht aber auch am iPad.
Du brauchst dein Google-Konto.

---

## Teil A – Firebase (die gemeinsame Datenbank)

### 1. Projekt anlegen
1. Öffne **https://console.firebase.google.com** und melde dich mit deinem Google-Konto an.
2. Klicke auf **„Projekt erstellen“** (oder „Firebase-Projekt erstellen“).
3. Name: `projekt-koelle` → weiter.
4. **Google Analytics** brauchst du nicht → ausschalten → **Projekt erstellen**.

### 2. Die Website bei Firebase anmelden
1. Auf der Projekt-Startseite klickst du auf das Symbol **`</>`** („Web“).
2. App-Spitzname: `Projekt Kölle`. **Firebase Hosting NICHT ankreuzen.** → **App registrieren**.
3. Jetzt siehst du einen Code-Block mit `const firebaseConfig = { apiKey: ..., ... }`.
   **Kopiere diesen Block und schick ihn mir im Chat.** Ich trage ihn ein.
   (Diese Werte sind nicht geheim – das ist in Ordnung.)
4. → **Weiter zur Konsole**.

### 3. Anmeldung mit Google einschalten
1. Links im Menü: **Build → Authentication** → **Jetzt starten**.
2. Reiter **„Anmeldemethode“** (Sign-in method) → **Google** auswählen.
3. Schalter auf **Aktivieren**, bei „Support-E-Mail“ deine Adresse auswählen → **Speichern**.
4. Reiter **„Einstellungen“** (Settings) → **„Autorisierte Domains“** → **Domain hinzufügen**:
   `tritonfischbart.github.io` → **Hinzufügen**.

### 4. Datenbank anlegen
1. Links im Menü: **Build → Firestore Database** → **Datenbank erstellen**.
2. Standort: **`europe-west3 (Frankfurt)`** → weiter.
   (Der Standort lässt sich später nicht ändern.)
3. **„Im Produktionsmodus starten“** auswählen → **Erstellen**.

### 5. Schutz einrichten (nur ihr drei dürft rein)
1. In Firestore Database oben den Reiter **„Regeln“** (Rules) öffnen.
2. Alles, was dort steht, löschen.
3. Den Inhalt der Datei **`firestore.rules`** aus diesem Projekt hineinkopieren.
4. Die drei Beispiel-Adressen (`adresse-lukas@gmail.com` usw.) durch **eure echten
   Google-Adressen** ersetzen. Wichtig: Hochkommas `' '` und Kommas stehen lassen.
5. **Veröffentlichen** klicken.

> Die echten Adressen stehen dann nur in Firebase – nicht im öffentlichen GitHub-Projekt.

---

## Teil B – GitHub Pages (die Website ins Internet stellen)

Voraussetzung: Mein Code ist im Haupt-Zweig `main` angekommen (das erledigen wir zusammen).

1. Öffne dein Projekt auf **github.com** → **Settings**.
2. Links: **Pages**.
3. Bei „Build and deployment“ → Source: **Deploy from a branch**.
4. Branch: **`main`**, Ordner: **`/ (root)`** → **Save**.
5. Nach 1–2 Minuten ist die Seite online unter:
   **https://tritonfischbart.github.io/Projekt-K-lle/**

---

## Teil C – Loslegen

1. Link öffnen → **„Mit Google anmelden“**.
2. Beim ersten Mal fragt die Seite **„Wer bist du?“** → deinen Namen antippen.
3. Link an Julian und Jana schicken – die machen dasselbe.

**Als App auf den Home-Bildschirm (iPhone/iPad):** In Safari unten auf
**Teilen** (Quadrat mit Pfeil) → **„Zum Home-Bildschirm“**.
Android/Chrome: Menü **⋮** → **„Zum Startbildschirm hinzufügen“**.

---

## Wenn etwas nicht klappt

| Meldung | Lösung |
|---|---|
| „Fast geschafft! … noch nicht eingerichtet“ | Die Firebase-Daten aus Schritt 2 fehlen noch in `js/firebase-config.js`. |
| „Website-Adresse ist in Firebase noch nicht freigegeben“ | Schritt 3.4 (Autorisierte Domains) prüfen. |
| „Kein Zugang 🔒“ | Die Adresse fehlt in den Regeln (Schritt 5) oder ist falsch geschrieben. |
| Jemand hat sich aus Versehen den falschen Namen ausgesucht | In Firebase → Firestore Database → Sammlung `members` → den falschen Eintrag löschen. Dann neu anmelden. |

Ausprobieren ohne Einrichtung: an die Adresse `?demo` anhängen, z. B.
`https://tritonfischbart.github.io/Projekt-K-lle/?demo`
