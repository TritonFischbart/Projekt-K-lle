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
   **https://tritonfischbart.github.io/Projekt-Koelle/**

---

## Teil C – Loslegen

1. Link öffnen → **„Mit Google anmelden“**.
2. Beim ersten Mal fragt die Seite **„Wer bist du?“** → deinen Namen antippen.
3. Link an Jul und Jana schicken – die machen dasselbe.

**Als App auf den Home-Bildschirm (iPhone/iPad):** In Safari unten auf
**Teilen** (Quadrat mit Pfeil) → **„Zum Home-Bildschirm“**.
Android/Chrome: Menü **⋮** → **„Zum Startbildschirm hinzufügen“**.

---

## Teil D – Gemeinsamer Google-Kalender

Am besten am Computer oder iPad im Browser (in der Kalender-App auf dem Handy
geht das Anlegen nicht).

### 1. Kalender anlegen
1. Öffne **https://calendar.google.com/calendar/r/settings/createcalendar**
2. Name: `WG Kölle` → **Kalender erstellen**.

### 2. Mit Jana und Jul teilen
1. Links unter „Einstellungen für meine Kalender“ auf **WG Kölle** tippen.
2. Bei **„Für bestimmte Personen oder Gruppen freigeben“** → **Personen hinzufügen**.
3. Adressen von Jana und Jul eintragen, Berechtigung:
   **„Änderungen an Terminen vornehmen“** → **Senden**.
   Die beiden bekommen eine E-Mail und sehen den Kalender dann in ihrer Kalender-App.

### 3. Öffentlich freigeben (nötig, damit die Website die Termine sieht)
1. Etwas weiter oben: **„Zugriffsberechtigungen für Termine“**.
2. Haken bei **„Öffentlich freigeben“** → Warnung bestätigen.
3. Daneben **„Alle Termindetails anzeigen“** auswählen.

> Den Kalender findet nur, wer seine lange ID kennt. Trotzdem: nichts sehr
> Privates eintragen.

### 4. Kalender-ID kopieren
1. Weiter unten bei **„Kalender integrieren“** steht die **Kalender-ID**
   (endet auf `@group.calendar.google.com`). Kopieren.

### 5. API-Schlüssel anlegen (damit die Website die Termine abholen darf)
1. Google Calendar API einschalten:
   **https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=projekt-koelle**
   → **Aktivieren**.
2. Schlüssel anlegen:
   **https://console.cloud.google.com/apis/credentials?project=projekt-koelle**
   → **„+ Anmeldedaten erstellen“** → **„API-Schlüssel“**. Schlüssel kopieren (beginnt mit `AIza`).
3. Schlüssel absichern: auf den neuen Schlüssel tippen →
   - **Anwendungseinschränkungen:** „Websites“ → **Hinzufügen**:
     `https://tritonfischbart.github.io/*`
   - **API-Einschränkungen:** „Schlüssel einschränken“ → **Google Calendar API** auswählen.
   - **Speichern**.

### 6. In der App verbinden
1. Website öffnen → unten **Kalender** → **„Kalender verbinden“**.
2. Kalender-ID und API-Schlüssel einfügen → **Speichern**.
3. Fertig – die Termine erscheinen. Neue Termine tragt ihr ganz normal in Google Kalender
   im Kalender „WG Kölle“ ein.

---

## Teil E – Push-Nachrichten (einmalig, ca. 15 Minuten)

Am besten am Computer oder iPad im Browser. Bei Fragen: Screenshot an Claude schicken.

### E1. Firebase auf den Tarif „Blaze“ umstellen
1. Öffne **https://console.firebase.google.com/project/projekt-koelle/usage/details**
2. Bei „Tarif“ / „Plan“ auf **„Upgrade“ / „Tarif ändern“** → **Blaze** wählen.
3. Ein **Rechnungskonto** mit Kreditkarte anlegen und bestätigen.
   Für eine WG fallen praktisch **0 €** an (riesiges Gratis-Kontingent).

### E2. Budget-Warnung einrichten (Sicherheit)
1. Öffne **https://console.cloud.google.com/billing/budgets**
2. **„Budget erstellen“ / „Create budget“** → Name `Kölle`, Projekt `projekt-koelle`.
3. Betrag: **1 €** → Warnungen bei 50 %, 90 %, 100 % (E-Mail an dich) → **Fertig**.

### E3. Schlüssel für Nachrichten erzeugen
1. Öffne **https://console.firebase.google.com/project/projekt-koelle/settings/cloudmessaging**
2. Ganz unten bei **„Web-Push-Zertifikate“ / „Web Push certificates“** →
   **„Schlüsselpaar generieren“ / „Generate key pair“**.
3. Den langen Schlüssel kopieren und **Claude schicken** (der ist nicht geheim).

### E4. Zugangsschlüssel für GitHub erstellen (geheim!)
Damit GitHub den Versand-Dienst bei Firebase automatisch einrichten darf.
1. Öffne **https://console.cloud.google.com/iam-admin/serviceaccounts?project=projekt-koelle**
2. **„+ Dienstkonto erstellen“ / „+ Create service account“** → Name: `github-deploy` → **Erstellen und fortfahren**.
3. Rollen: **„Bearbeiter“ / „Editor“**, **„Project IAM Admin“** und **„Cloud Functions Admin“**
   („Cloud Functions-Administrator“) auswählen → **Weiter** → **Fertig**.
   (Alle drei sind nötig, sonst bricht die Einrichtung ab. Später ergänzen geht unter
   https://console.cloud.google.com/iam-admin/iam?project=projekt-koelle → Stift ✏️.)
4. Das neue Konto anklicken → Reiter **„Schlüssel“ / „Keys“** →
   **„Schlüssel hinzufügen“ → „Neuen Schlüssel erstellen“** → **JSON** → **Erstellen**.
   Eine Datei wird heruntergeladen.

### E5. Zugangsschlüssel bei GitHub hinterlegen
1. Öffne **https://github.com/TritonFischbart/Projekt-Koelle/settings/secrets/actions**
2. **„New repository secret“** → Name: `FIREBASE_SERVICE_ACCOUNT`
3. Bei „Secret“ den **kompletten Inhalt** der heruntergeladenen Datei einfügen → **„Add secret“**.
4. Die heruntergeladene Datei danach **löschen**. **Niemandem schicken – auch nicht Claude.**

Außerdem muss die **Cloud Billing API** eingeschaltet sein:
https://console.cloud.google.com/apis/library/cloudbilling.googleapis.com?project=projekt-koelle → „Aktivieren“ / „Enable“.

### E6. Claude Bescheid geben
Claude startet dann die Einrichtung des Versand-Dienstes und trägt den Schlüssel aus E3 ein.

### E7. Auf jedem Handy einschalten
In der App oben rechts **⚙️ → Benachrichtigungen → „Auf diesem Handy einschalten“** →
Erlauben. Auf dem iPhone/iPad geht das nur in der **App vom Home-Bildschirm**.
Mit **„Test-Nachricht senden“** prüfen, ob es klappt.

---

## Wenn etwas nicht klappt

| Meldung | Lösung |
|---|---|
| „Fast geschafft! … noch nicht eingerichtet“ | Die Firebase-Daten aus Schritt 2 fehlen noch in `js/firebase-config.js`. |
| „Website-Adresse ist in Firebase noch nicht freigegeben“ | Schritt 3.4 (Autorisierte Domains) prüfen. |
| „Kein Zugang 🔒“ | Die Adresse fehlt in den Regeln (Schritt 5) oder ist falsch geschrieben. |
| Kalender: „Kalender nicht gefunden“ | Kalender-ID prüfen und ob Schritt D3 (öffentlich) erledigt ist. |
| Kalender: „Titel nicht sichtbar“ | In Google Kalender bei „Öffentlich freigeben“ **„Alle Termindetails anzeigen“** wählen (D3). |
| Kalender: „Google lehnt den Zugriff ab“ | API-Schlüssel prüfen und ob die Calendar API aktiviert ist (D5). |
| Jemand hat sich aus Versehen den falschen Namen ausgesucht | In Firebase → Firestore Database → Sammlung `members` → den falschen Eintrag löschen. Dann neu anmelden. |

Ausprobieren ohne Einrichtung: an die Adresse `?demo` anhängen, z. B.
`https://tritonfischbart.github.io/Projekt-Koelle/?demo`
