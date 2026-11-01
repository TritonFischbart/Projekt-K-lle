// Zugangsdaten für Firebase (die gemeinsame Datenbank).
// Diese Werte sind nicht geheim – sie sagen der Website nur, wo die Datenbank liegt.
// Geschützt werden eure Daten durch die Regeln in firestore.rules.

export const firebaseConfig = {
  apiKey: 'AIzaSyB-YzxrYXXHTWutYB6rsuLv17R4-XMxnAo',
  authDomain: 'projekt-koelle.firebaseapp.com',
  projectId: 'projekt-koelle',
  storageBucket: 'projekt-koelle.firebasestorage.app',
  messagingSenderId: '64746922011',
  appId: '1:64746922011:web:7cccdf1a9bf9566ea6d8be',
  // Öffentlicher Schlüssel für Push-Nachrichten (Firebase → Projekteinstellungen →
  // Cloud Messaging → Web-Push-Zertifikate). Leer = Benachrichtigungen noch nicht eingerichtet.
  vapidKey: 'BFp82DjFjqtCqDs9NZC1tmbHZPiDuobr3jfbrTtk9QNR4T9sOiG-QQxwiIbnhrofRxyepgri_qvK-ytPlxmUTbs',
};
