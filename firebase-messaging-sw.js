// Empfängt Push-Nachrichten, wenn die App geschlossen ist, und zeigt sie an.
// Muss im Hauptordner liegen. Werte wie in js/firebase-config.js.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyB-YzxrYXXHTWutYB6rsuLv17R4-XMxnAo',
  authDomain: 'projekt-koelle.firebaseapp.com',
  projectId: 'projekt-koelle',
  storageBucket: 'projekt-koelle.firebasestorage.app',
  messagingSenderId: '64746922011',
  appId: '1:64746922011:web:7cccdf1a9bf9566ea6d8be',
});

// Nachrichten mit Titel und Text zeigt Firebase automatisch an;
// ein Tipp darauf öffnet die App (Link wird vom Versand-Dienst mitgeschickt).
firebase.messaging();
