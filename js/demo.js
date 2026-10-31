// Demo-Modus (Adresse mit ?demo am Ende): Beispieldaten nur im Browser,
// damit man die Seite ohne Firebase ausprobieren kann. Nichts wird gespeichert.

import { weekKey } from './chores.js?v=8';

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
    settings: [
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
      Object.assign(find(name, id), data);
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
      ];
    },
  };
}
