// Verbindung zu Firebase: Anmeldung mit Google und die gemeinsame Datenbank.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getMessaging,
  getToken,
  deleteToken,
  isSupported as isMessagingSupported,
  onMessage,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js';

export function createFirebaseBackend(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  // Lokaler Zwischenspeicher: Die Seite lädt schneller und funktioniert kurz auch offline.
  let db;
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    db = getFirestore(app);
  }

  getRedirectResult(auth).catch((err) => console.error(err));

  return {
    isDemo: false,

    onUser: (callback) => onAuthStateChanged(auth, callback),

    async login() {
      try {
        await signInWithPopup(auth, provider);
      } catch (err) {
        if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(err.code)) {
          return signInWithRedirect(auth, provider);
        }
        if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(err.code)) return;
        throw err;
      }
    },

    logout: () => signOut(auth),

    watch(name, onData, onError) {
      return onSnapshot(
        collection(db, name),
        (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))),
        onError,
      );
    },

    add: (name, data) => addDoc(collection(db, name), data),
    update: (name, id, data) => updateDoc(doc(db, name, id), data),
    remove: (name, id) => deleteDoc(doc(db, name, id)),
    set: (name, id, data) => setDoc(doc(db, name, id), data),

    // Legt eine Abrechnung an und ordnet ihr alle offenen Einträge zu.
    async settleAll(settlement, expenseIds, paymentIds) {
      const ref = doc(collection(db, 'settlements'));
      const updates = [
        ...expenseIds.map((id) => doc(db, 'expenses', id)),
        ...paymentIds.map((id) => doc(db, 'payments', id)),
      ];
      let batch = writeBatch(db);
      batch.set(ref, settlement);
      let count = 1;
      for (const docRef of updates) {
        batch.update(docRef, { settlementId: ref.id });
        count += 1;
        if (count >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) await batch.commit();
    },

    now: () => serverTimestamp(),

    // ---------- Push-Nachrichten ----------
    pushReady: Boolean(config.vapidKey),

    async pushSupported() {
      return 'Notification' in window && 'serviceWorker' in navigator && (await isMessagingSupported());
    },

    // Fragt nach Erlaubnis und liefert die "Adresse" dieses Handys für Nachrichten.
    async enablePush() {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw Object.assign(new Error('Nicht erlaubt'), { code: 'denied' });
      const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
      return getToken(getMessaging(app), { vapidKey: config.vapidKey, serviceWorkerRegistration: registration });
    },

    async disablePush() {
      await deleteToken(getMessaging(app)).catch(() => {});
    },

    // Nachricht kommt an, während die App offen ist
    async onPushMessage(callback) {
      if (await this.pushSupported()) onMessage(getMessaging(app), (payload) => callback(payload.notification ?? {}));
    },
  };
}
