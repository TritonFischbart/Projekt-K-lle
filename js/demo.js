// Demo-Modus (Adresse mit ?demo am Ende): Beispieldaten nur im Browser,
// damit man die Seite ohne Firebase ausprobieren kann. Nichts wird gespeichert.

import { weekKey } from './chores.js?v=25';

// Einfacher gezeichneter Grundriss als Beispielbild
function demoFloorPlan() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520"><rect width="800" height="520" fill="#fff"/>
    <g fill="none" stroke="#222" stroke-width="8"><rect x="20" y="20" width="760" height="480"/>
    <path d="M300 20v200M300 300v200M300 300h200M500 20v280M500 380v120M20 260h280"/></g>
    <g font-family="sans-serif" font-size="28" fill="#555"><text x="80" y="140">Jana</text><text x="80" y="390">Jul</text>
    <text x="360" y="420">Bad</text><text x="330" y="150">Küche</text><text x="590" y="200">Lukas</text><text x="560" y="450">Flur</text></g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function lastMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function createDemoBackend() {
  const user = { uid: 'demo-lukas', email: 'lukas@beispiel.de', displayName: 'Lukas' };
  const all = ['jana', 'julian', 'lukas'];
  const created = (n) => new Date(Date.now() - n * 86400000);

  const store = {
    members: [
      { id: 'lukas', uid: 'demo-lukas' },
      { id: 'julian', uid: 'demo-julian' },
      { id: 'jana', uid: 'demo-jana' },
    ],
    expenses: [
      { id: 'e1', description: 'Wocheneinkauf Rewe', amountCents: 6420, paidBy: 'lukas', splitAmong: all, category: 'lebensmittel', date: daysAgo(1), createdAt: created(1), settlementId: null },
      { id: 'e2', description: 'Klopapier & Spülmittel', amountCents: 1290, paidBy: 'jana', splitAmong: all, category: 'haushalt', date: daysAgo(3), createdAt: created(3), settlementId: null },
      { id: 'e3', description: 'Internet Oktober', amountCents: 3999, paidBy: 'lukas', splitAmong: all, category: 'nebenkosten', date: daysAgo(5), createdAt: created(5), settlementId: null },
      { id: 'e4', description: 'Kinotickets', amountCents: 2400, paidBy: 'julian', splitAmong: ['julian', 'jana'], category: 'freizeit', date: daysAgo(6), createdAt: created(6), settlementId: null },
      { id: 'e5', description: 'Pizza-Abend', amountCents: 3600, paidBy: 'jana', splitAmong: all, category: 'lebensmittel', date: daysAgo(30), createdAt: created(30), settlementId: 's1' },
      { id: 'e6', description: 'Putzmittel dm', amountCents: 1850, paidBy: 'julian', splitAmong: all, category: 'haushalt', date: daysAgo(34), createdAt: created(34), settlementId: 's1' },
    ],
    payments: [],
    settlements: [
      { id: 's1', createdAt: created(28), createdBy: 'jana', expenseCount: 2, totalCents: 5450 },
    ],
    chores: [],
    recurring: [
      // lastBooked im Vormonat -> wird beim Öffnen der Demo automatisch für diesen Monat eingetragen
      { id: 'r1', description: 'Internet', amountCents: 3999, paidBy: 'lukas', splitAmong: all, category: 'nebenkosten', dayOfMonth: 1, lastBooked: lastMonth() },
      { id: 'r2', description: 'Netflix', amountCents: 1799, paidBy: 'jana', splitAmong: all, category: 'freizeit', dayOfMonth: 28, lastBooked: thisMonth() },
    ],
    noteImages: [
      { id: 'img1', noteId: 'n3', data: demoFloorPlan(), width: 800, height: 520, createdBy: 'lukas', createdAt: created(10) },
    ],
    absences: [
      { id: 'a1', person: 'jana', from: daysAgo(-1), to: daysAgo(-4), note: 'Hamburg' },
      { id: 'a2', person: 'julian', from: daysAgo(-20), to: daysAgo(-27), note: 'Urlaub' },
    ],
    invites: [
      { id: 'inv1', emoji: '🍳', title: 'Ich koche – wer isst mit?', note: 'Spaghetti Bolo', kind: 'food',
        at: (() => { const d = new Date(); d.setHours(23, 59, 0, 0); return d.toISOString(); })(),
        responses: { julian: 'yes' }, createdBy: 'jana', createdAt: created(0) },
    ],
    polls: [
      { id: 'p1', question: 'Pizza oder Sushi am Freitag?', options: ['Pizza 🍕', 'Sushi 🍣', 'Selber kochen'], votes: { jana: 1, julian: 0 }, closed: false, createdBy: 'jana', createdAt: created(1) },
    ],
    notes: [
      { id: 'n1', title: '📶 WLAN', text: 'Netzwerk: Koelle-WG\nPasswort: DomBlick2026!', createdBy: 'lukas', createdAt: created(20), updatedBy: 'lukas', updatedAt: created(20) },
      { id: 'n3', title: '📐 Grundriss', text: 'Aus dem Exposé, 3 Zimmer, 78 m²', createdBy: 'lukas', createdAt: created(25), updatedBy: 'lukas', updatedAt: created(10) },
      { id: 'n2', title: '🏠 Vermieter & Hausverwaltung', text: 'Herr Beispiel\nTelefon: 0221 123456', createdBy: 'jana', createdAt: created(15), updatedBy: 'jana', updatedAt: created(4) },
    ],
    pushSettings: [],
    pushTokens: [],
    pushTests: [],
    settings: [
      { id: 'putzplan', areas: [
        { id: 'bad', name: 'Bad', icon: '🛁', details: 'Toilette, Waschbecken, Dusche, Spiegel', every: 1 },
        { id: 'kueche', name: 'Küche', icon: '🍳', details: 'Arbeitsflächen, Herd, Spüle', every: 1 },
        { id: 'boeden', name: 'Böden', icon: '🧹', details: 'Saugen & Wischen', every: 1 },
        { id: 'muell', name: 'Müll', icon: '🗑️', details: 'Restmüll, Bio, Gelber Sack', every: 1 },
        { id: 'altglas', name: 'Altglas', icon: '🍾', details: 'Zum Container bringen', every: 2 },
      ] },
      { id: 'kalender', calendarId: 'demo@group.calendar.google.com', apiKey: 'AIzaDemoDemoDemoDemoDemoDemo' },
    ],
    favorites: [
      { id: 'milch', name: 'Milch', count: 6, lastUsed: created(2) },
      { id: 'klopapier', name: 'Klopapier', count: 4, lastUsed: created(3) },
      { id: 'eier', name: 'Eier', count: 3, lastUsed: created(5) },
      { id: 'brot', name: 'Brot', count: 3, lastUsed: created(6) },
      { id: 'sp%C3%BClmittel', name: 'Spülmittel', count: 2, lastUsed: created(9) },
      { id: 'kaffee', name: 'Kaffee', count: 2, lastUsed: created(12) },
    ],
    shopping: [
      { id: 'i1', name: 'Milch', addedBy: 'jana', createdAt: created(2), doneBy: null, doneAt: null },
      { id: 'i4', name: 'Bananen', addedBy: 'jana', createdAt: created(2), doneBy: null, doneAt: null },
      { id: 'i5', name: 'Hafermilch', addedBy: 'lukas', createdAt: created(1), doneBy: null, doneAt: null },
      { id: 'i6', name: 'Brötchen', addedBy: 'julian', createdAt: created(1), doneBy: null, doneAt: null },
      { id: 'i2', name: 'Spülmaschinentabs', addedBy: 'julian', createdAt: created(1), doneBy: null, doneAt: null },
      { id: 'i3', name: 'Klopapier', addedBy: 'lukas', createdAt: created(3), doneBy: 'jana', doneAt: created(1) },
    ],
  };

  // Putzplan-Beispiel: In dieser Woche hat schon jemand eine Aufgabe erledigt.
  const key = weekKey(new Date());
  store.chores.push({ id: `${key}_kueche`, week: key, chore: 'kueche', assignee: 'jana', doneBy: 'jana', doneAt: new Date() });

  const listeners = {};
  let userCallbacks = [];
  let currentUser = user;
  let nextId = 1;

  const snapshot = (name) => store[name].map((item) => ({ ...item }));
  const notify = (name) => (listeners[name] ?? []).forEach((cb) => cb(snapshot(name)));
  const find = (name, id) => store[name].find((item) => item.id === id);

  return {
    isDemo: true,

    onUser(callback) {
      userCallbacks.push(callback);
      setTimeout(() => callback(currentUser), 0);
      return () => { userCallbacks = userCallbacks.filter((cb) => cb !== callback); };
    },
    async login() {
      currentUser = user;
      userCallbacks.forEach((cb) => cb(currentUser));
    },
    async logout() {
      currentUser = null;
      userCallbacks.forEach((cb) => cb(currentUser));
    },

    watch(name, onData) {
      (listeners[name] ??= []).push(onData);
      setTimeout(() => onData(snapshot(name)), 0);
      return () => { listeners[name] = listeners[name].filter((cb) => cb !== onData); };
    },

    async add(name, data) {
      store[name].push({ id: `demo${nextId++}`, ...data });
      notify(name);
    },
    async update(name, id, data) {
      const item = find(name, id);
      // "votes.lukas" wie bei Firestore: verschachteltes Feld setzen
      for (const [key, value] of Object.entries(data)) {
        const [field, sub] = key.split('.');
        if (sub) item[field] = { ...(item[field] ?? {}), [sub]: value };
        else item[key] = value;
      }
      notify(name);
    },
    async remove(name, id) {
      store[name] = store[name].filter((item) => item.id !== id);
      notify(name);
    },
    async set(name, id, data) {
      store[name] = store[name].filter((item) => item.id !== id);
      store[name].push({ id, ...data });
      notify(name);
    },
    async settleAll(settlement, expenseIds, paymentIds) {
      const id = `demo${nextId++}`;
      store.settlements.push({ id, ...settlement });
      expenseIds.forEach((eid) => { find('expenses', eid).settlementId = id; });
      paymentIds.forEach((pid) => { find('payments', pid).settlementId = id; });
      ['settlements', 'expenses', 'payments'].forEach(notify);
    },

    now: () => new Date(),

    // Push im Demo-Modus nur zum Ausprobieren der Oberfläche
    pushReady: true,
    async pushSupported() { return true; },
    async enablePush() { return 'demo-token'; },
    async disablePush() {},
    async onPushMessage() {},

    // Beispieltermine statt echter Google-Termine
    demoEvents() {
      const at = (days, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d; };
      const day = (days) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + days); return d; };
      return [
        { id: 'k1', title: 'WG-Abend: Pizza & Film', location: 'Wohnzimmer', allDay: false, start: at(0, 20), end: at(0, 23), link: '' },
        { id: 'k2', title: 'Jana in Hamburg', location: '', allDay: true, start: day(1), end: day(4), link: '' },
        { id: 'k3', title: 'Vermieter kommt (Heizung)', location: '', allDay: false, start: at(2, 9, 30), end: at(2, 10, 30), link: '' },
        { id: 'k4', title: 'Sperrmüll', location: 'vor dem Haus', allDay: true, start: day(6), end: day(7), link: '' },
        { id: 'k5', title: 'Geburtstag Jul 🎂', location: '', allDay: true, start: day(12), end: day(13), link: '' },
        { id: 'k6', title: 'Weiberfastnacht 🎭', location: 'Heumarkt', allDay: true, start: day(102), end: day(103), link: '' },
        { id: 'k7', title: 'Rosenmontagszug', location: 'Innenstadt', allDay: false, start: at(106, 10), end: at(106, 18), link: '' },
      ];
    },
  };
}
