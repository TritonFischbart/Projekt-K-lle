// Hauptprogramm: Anmeldung, Anzeige und Bedienung der Website.

// Die Nummer hinter ?v= bei jeder Änderung erhöhen (auch in index.html),
// damit Handys sofort die neuen Dateien laden statt alter gespeicherter.
import { PEOPLE, CATEGORIES, CHORES } from './config.js?v=15';
import { parseEuro, formatEuro, splitAmount, computeBalances, suggestTransfers } from './money.js?v=15';
import { mondayOf, addDays, isoWeek, weekKey, weekIndex, defaultAssignee } from './chores.js?v=15';
import { fetchEvents, groupByDay, newEventLink } from './calendar.js?v=15';
import { SHOP_CATEGORIES, guessCategory, parseShoppingInput } from './shopcats.js?v=15';
import { isAwayForWeek, isAwayOn, upcomingAbsences } from './absences.js?v=15';
import { monthKey, addMonths, initialLastBooked, dueMonths, recurringExpenseId } from './recurring.js?v=15';
import { monthStats, monthTrend, currentMonth } from './stats.js?v=15';
import { toPlain, expensesCsv } from './export.js?v=15';
import { firebaseConfig } from './firebase-config.js?v=15';

const PERSON_IDS = PEOPLE.map((p) => p.id);
const $ = (selector) => document.querySelector(selector);

const state = {
  user: null,
  me: null,
  members: {},
  expenses: [],
  payments: [],
  settlements: [],
  chores: {},
  choreWeekOffset: 0,
  areas: null,
  shopping: [],
  favorites: [],
  quickEdit: false,
  shopCatItem: null,
  notes: [],
  recurring: [],
  backup: null,
  monthOffset: 0,
  formMode: 'expense',
  pendingShopIds: [],
  loaded: {},
  editingNote: null,
  calendar: { config: null, events: null, error: null, loading: false, loadedAt: 0 },
  tab: 'start',
  absences: [],
  polls: [],
  editingId: null,
};

let backend = null;
let unsubscribers = [];

// ---------- Kleine Helfer ----------

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const person = (id) => PEOPLE.find((p) => p.id === id);
const personName = (id) => person(id)?.name ?? 'Unbekannt';
const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'string') return Date.parse(ts) || 0;
  return Number(ts) || 0;
}

function avatar(id, small = false) {
  const p = person(id);
  return `<span class="avatar${small ? ' small' : ''}" style="--c:${p?.color ?? '#888'}" aria-hidden="true">${esc(p?.name?.[0] ?? '?')}</span>`;
}

function forWhom(ids) {
  const sorted = PERSON_IDS.filter((id) => ids.includes(id));
  if (sorted.length === PERSON_IDS.length) return 'für alle';
  return `für ${sorted.map(personName).join(' & ')}`;
}

function amountClass(cents) {
  return cents > 0 ? 'plus' : cents < 0 ? 'minus' : 'even';
}

const activeExpenses = () => state.expenses.filter((e) => !e.settlementId);
const activePayments = () => state.payments.filter((p) => !p.settlementId);

let toastTimer;
let toastUndo = null;
function toast(message, isError = false, undo = null) {
  const el = $('#toast');
  $('#toast-text').textContent = message;
  toastUndo = undo;
  $('#toast-undo').hidden = !undo;
  el.className = `toast show${isError ? ' error' : ''}${undo ? ' has-action' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; toastUndo = null; }, undo ? 6000 : 2800);
}

// Löschen mit "Rückgängig": die gelöschten Einträge werden kurz gemerkt.
function removeWithUndo(message, items) {
  items.forEach(({ col, doc }) => backend.remove(col, doc.id).catch(showError));
  toast(message, false, () => {
    items.forEach(({ col, doc }) => {
      const { id, ...data } = doc;
      backend.set(col, id, data).catch(showError);
    });
    toast('Wiederhergestellt ✓');
  });
}

function showError(err) {
  console.error(err);
  if (err?.code === 'permission-denied') return showNoAccess();
  toast(`Das hat nicht geklappt: ${err?.message ?? err}`, true);
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => { el.hidden = el.id !== `screen-${name}`; });
}

// ---------- Start & Anmeldung ----------

async function start() {
  const params = new URLSearchParams(location.search);
  const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('HIER');
  try {
    if (params.has('demo')) {
      backend = (await import('./demo.js?v=15')).createDemoBackend();
    } else if (configured) {
      backend = (await import('./firebase.js?v=15')).createFirebaseBackend(firebaseConfig);
    } else {
      showScreen('setup');
      return;
    }
  } catch (err) {
    console.error(err);
    $('#setup-text').textContent = 'Die Verbindung zur Datenbank konnte nicht geladen werden. Bist du online?';
    showScreen('setup');
    return;
  }
  $('#demo-banner').hidden = !backend.isDemo;
  backend.onUser(handleUser);
}

function handleUser(user) {
  stopListeners();
  state.user = user;
  state.me = null;
  if (!user) {
    showScreen('login');
    return;
  }
  showScreen('loading');
  listen('members', (docs) => {
    state.members = Object.fromEntries(docs.map((d) => [d.id, d]));
    route();
  });
  listen('expenses', (docs) => { state.expenses = docs; state.loaded.expenses = true; scheduleRecurring(); renderAll(); });
  listen('recurring', (docs) => { state.recurring = docs; state.loaded.recurring = true; scheduleRecurring(); renderAll(); });
  listen('notes', (docs) => { state.notes = docs; renderAll(); });
  listen('absences', (docs) => { state.absences = docs; renderAll(); });
  listen('polls', (docs) => { state.polls = docs; renderAll(); });
  listen('payments', (docs) => { state.payments = docs; renderAll(); });
  listen('settlements', (docs) => { state.settlements = docs; renderAll(); });
  listen('chores', (docs) => { state.chores = Object.fromEntries(docs.map((d) => [d.id, d])); renderAll(); });
  listen('settings', (docs) => {
    const plan = docs.find((d) => d.id === 'putzplan');
    state.areas = plan?.areas?.length ? plan.areas : null;
    state.backup = docs.find((d) => d.id === 'backup') ?? null;
    const kal = docs.find((d) => d.id === 'kalender');
    const config = kal?.calendarId && kal?.apiKey ? { calendarId: kal.calendarId, apiKey: kal.apiKey } : null;
    const changed = JSON.stringify(config) !== JSON.stringify(state.calendar.config);
    state.calendar.config = config;
    if (changed) {
      state.calendar.events = null;
      state.calendar.error = null;
      loadEvents();
    }
    renderAll();
  });
  listen('shopping', (docs) => { state.shopping = docs; renderAll(); });
  listen('favorites', (docs) => { state.favorites = docs; renderAll(); });
}

function listen(name, callback) {
  unsubscribers.push(backend.watch(name, callback, showError));
}

function stopListeners() {
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  unsubscribers = [];
}

// Entscheidet, welcher Bildschirm gezeigt wird, sobald die Mitglieder geladen sind.
function route() {
  const mine = PEOPLE.find((p) => state.members[p.id]?.uid === state.user.uid);
  if (mine) {
    const firstTime = !state.me;
    state.me = mine.id;
    if (firstTime) {
      showScreen('app');
      renderHeader();
      switchTab(state.tab);
    }
    renderAll();
    return;
  }

  state.me = null;
  const free = PEOPLE.filter((p) => !state.members[p.id]?.uid);
  if (!free.length) {
    showNoAccess('Alle drei Plätze sind schon vergeben.');
    return;
  }
  $('#pick-list').innerHTML = free.map((p) => `
    <button class="pick-btn" data-action="claim" data-person="${p.id}">
      ${avatar(p.id)}<span>${esc(p.name)}</span>
    </button>`).join('');
  showScreen('pick');
}

function showNoAccess(extra = '') {
  stopListeners();
  $('#noaccess-text').textContent =
    `Du bist als ${state.user?.email ?? 'unbekannt'} angemeldet. Diese Adresse ist (noch) nicht für die WG freigeschaltet. ${extra}`;
  showScreen('noaccess');
}

async function doLogin() {
  $('#login-error').textContent = '';
  try {
    await backend.login();
  } catch (err) {
    console.error(err);
    $('#login-error').textContent =
      err?.code === 'auth/unauthorized-domain'
        ? 'Diese Website-Adresse ist in Firebase noch nicht freigegeben (siehe ANLEITUNG.md, „Autorisierte Domains“).'
        : err?.code === 'auth/network-request-failed'
          ? 'Keine Internetverbindung?'
          : `Anmeldung fehlgeschlagen: ${err?.message ?? err}`;
  }
}

function claim(id) {
  if (!confirm(`Bist du ${personName(id)}? Das lässt sich später nicht einfach ändern.`)) return;
  backend.set('members', id, {
    uid: state.user.uid,
    email: state.user.email ?? '',
    claimedAt: backend.now(),
  }).catch(showError);
}

function renderHeader() {
  const button = $('#me-button');
  button.innerHTML = avatar(state.me);
  button.setAttribute('aria-label', `Angemeldet als ${personName(state.me)} – abmelden`);
}

function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tab').forEach((section) => { section.hidden = section.id !== `tab-${tab}`; });
  const barTab = tab === 'kalender' ? 'start' : tab;
  document.querySelectorAll('.tabbar button').forEach((b) => {
    if (b.dataset.tab === barTab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  $('.fab').hidden = tab !== 'ausgaben';
  if (tab !== 'putzplan') state.choreWeekOffset = 0;
  if (['kalender', 'start'].includes(tab) && Date.now() - state.calendar.loadedAt > 60000) loadEvents();
  window.scrollTo(0, 0);
}

function renderAll() {
  if (!state.me) return;
  renderAusgaben();
  renderEinkauf();
  renderPutzplan();
  renderKalender();
  renderInfos();
  renderStart();
  const open = myOpenChores().length;
  const tabButton = document.querySelector('.tabbar [data-tab=putzplan]');
  tabButton.classList.toggle('has-badge', open > 0);
  // Punkt an "Start", solange eine Abstimmung auf deine Stimme wartet
  document.querySelector('.tabbar [data-tab=start]').classList.toggle('has-badge', openPolls().some((p) => p.votes?.[state.me] == null));
}

// ---------- Ausgaben anzeigen ----------

function renderAusgaben() {
  if (!state.me) return;
  const openHistory = new Set([...document.querySelectorAll('details.history[open]')].map((d) => d.dataset.id));

  const expenses = activeExpenses();
  const payments = activePayments();
  const balances = computeBalances(PERSON_IDS, expenses, payments);
  const transfers = suggestTransfers(balances, PERSON_IDS);

  $('#tab-ausgaben').innerHTML = [
    heroCard(balances[state.me]),
    balancesCard(balances),
    transfersCard(transfers, expenses.length + payments.length > 0),
    entriesCard(expenses, payments),
    monthCard(),
    recurringCard(),
    historyCard(openHistory),
  ].join('');
}

function heroCard(balance) {
  const text = balance > 0 ? 'du bekommst noch' : balance < 0 ? 'du schuldest noch' : 'du bist ausgeglichen';
  return `
    <section class="card hero ${amountClass(balance)}">
      <p class="hero-label">Hallo ${esc(personName(state.me))}, ${text}</p>
      <p class="hero-amount">${balance === 0 ? '🎉' : formatEuro(Math.abs(balance))}</p>
    </section>`;
}

function balancesCard(balances) {
  const rows = PEOPLE.map((p) => {
    const b = balances[p.id];
    const label = b > 0 ? 'bekommt' : b < 0 ? 'schuldet' : 'ausgeglichen';
    return `
      <li class="row">
        ${avatar(p.id)}
        <span class="row-name">${esc(p.name)}${p.id === state.me ? ' (du)' : ''}<small>${label}</small></span>
        <span class="amount ${amountClass(b)}">${b === 0 ? '–' : `${b > 0 ? '+' : '−'} ${formatEuro(Math.abs(b))}`}</span>
      </li>`;
  }).join('');
  return `<section class="card"><h2>Kontostände</h2><ul class="rows">${rows}</ul></section>`;
}

function transfersCard(transfers, hasEntries) {
  const list = transfers.length
    ? `<ul class="transfers">${transfers.map((t) => `
        <li class="transfer">
          <span class="transfer-who">
            ${avatar(t.from, true)}<span class="arrow">→</span>${avatar(t.to, true)}
            <span class="transfer-text"><strong>${esc(personName(t.from))}</strong> zahlt <strong>${esc(personName(t.to))}</strong></span>
          </span>
          <span class="transfer-right">
            <span class="amount">${formatEuro(t.amountCents)}</span>
            <button class="btn small" data-action="mark-paid" data-from="${t.from}" data-to="${t.to}" data-amount="${t.amountCents}">Überwiesen ✓</button>
          </span>
        </li>`).join('')}</ul>`
    : '<p class="empty">Niemand schuldet jemandem etwas. 🎉</p>';

  const settle = hasEntries
    ? `<button class="btn outline full" data-action="settle-all">Alles ausgeglichen – neu starten</button>
       <p class="hint">Setzt alles auf 0. Die Einträge bleiben unter „Frühere Abrechnungen“ sichtbar.</p>`
    : '';

  return `<section class="card"><h2>So gleicht ihr aus</h2>${list}${settle}</section>`;
}

// ---------- Monatsübersicht ----------

function monthName(key, short = false) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('de-DE', short ? { month: 'short' } : { month: 'long', year: 'numeric' });
}

function barList(entries, label) {
  const max = Math.max(...entries.map(([, cents]) => cents), 1);
  return `<ul class="bars">${entries.map(([key, cents]) => `
    <li>
      <div class="bar-label"><span>${label(key)}</span><span class="amount">${formatEuro(cents)}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, (cents / max) * 100)}%"></div></div>
    </li>`).join('')}</ul>`;
}

function monthCard() {
  if (!state.expenses.length) return '';
  const month = addMonths(currentMonth(), state.monthOffset);
  const stats = monthStats(state.expenses, month);
  const trend = monthTrend(state.expenses, month, 6);
  const trendMax = Math.max(...trend.map((t) => t.total), 1);

  const categories = Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]);
  const payers = PERSON_IDS.filter((id) => stats.byPayer[id]).map((id) => [id, stats.byPayer[id]]);

  return `
    <section class="card">
      <div class="week-nav">
        <button class="icon-btn" data-action="month" data-step="-1" aria-label="Monat zurück">‹</button>
        <button class="week-title" data-action="month" data-step="0">
          <strong>Monatsübersicht</strong>
          <small>${monthName(month)}</small>
        </button>
        <button class="icon-btn" data-action="month" data-step="1" aria-label="Monat vor"${state.monthOffset >= 0 ? ' disabled' : ''}>›</button>
      </div>
      <p class="month-total">${formatEuro(stats.total)}<small>${stats.count} Ausgaben</small></p>
      <div class="trend" aria-label="Ausgaben der letzten 6 Monate">${trend.map((t) => `
        <div class="trend-col${t.month === month ? ' active' : ''}">
          <div class="trend-bar" style="height:${Math.max(4, (t.total / trendMax) * 100)}%"></div>
          <span>${monthName(t.month, true)}</span>
        </div>`).join('')}</div>
      ${stats.count ? `
        <h3 class="sub-title">Wofür</h3>
        ${barList(categories, (id) => `${categoryOf(id).icon} ${esc(categoryOf(id).name)}`)}
        <h3 class="sub-title">Wer hat bezahlt</h3>
        ${barList(payers, (id) => esc(personName(id)))}` : '<p class="empty">In diesem Monat gibt es keine Ausgaben.</p>'}
    </section>`;
}

// ---------- Daueraufträge ----------

function recurringCard() {
  const items = [...state.recurring].sort((a, b) => a.dayOfMonth - b.dayOfMonth);
  const list = items.length
    ? `<ul class="entries">${items.map((r) => `
        <li><button class="entry" data-action="edit-recurring" data-id="${esc(r.id)}">
          <span class="entry-icon" aria-hidden="true">🔁</span>
          <span class="entry-main">
            <span class="entry-title">${esc(r.description)}</span>
            <span class="entry-sub">jeden ${r.dayOfMonth}. · ${esc(personName(r.paidBy))} zahlt · ${esc(forWhom(r.splitAmong ?? []))}</span>
          </span>
          <span class="entry-right"><span class="amount">${formatEuro(r.amountCents)}</span></span>
        </button></li>`).join('')}</ul>`
    : '<p class="empty">Noch keine. Zum Beispiel Internet, Strom oder Netflix.</p>';
  return `
    <section class="card">
      <div class="card-head"><h2>Daueraufträge</h2><button class="link-btn" data-action="add-recurring">＋ Neu</button></div>
      ${list}
      <p class="hint">Werden jeden Monat automatisch als Ausgabe eingetragen.</p>
    </section>`;
}

// Fällige Daueraufträge eintragen – kurz warten, bis die Daten vom Server da sind.
let recurringTimer;
const bookedThisSession = new Set();
function scheduleRecurring() {
  if (!state.loaded.expenses || !state.loaded.recurring) return;
  clearTimeout(recurringTimer);
  recurringTimer = setTimeout(bookRecurring, backend.isDemo ? 300 : 3000);
}

function bookRecurring() {
  for (const rec of state.recurring) {
    const months = dueMonths(rec);
    if (!months.length) continue;
    for (const month of months) {
      const id = recurringExpenseId(rec.id, month);
      if (bookedThisSession.has(id) || state.expenses.some((e) => e.id === id)) continue;
      bookedThisSession.add(id);
      backend.set('expenses', id, {
        description: rec.description,
        amountCents: rec.amountCents,
        paidBy: rec.paidBy,
        splitAmong: rec.splitAmong,
        category: rec.category,
        date: `${month}-${String(rec.dayOfMonth).padStart(2, '0')}`,
        recurringId: rec.id,
        createdAt: backend.now(),
        createdBy: 'auto',
        settlementId: null,
      }).catch(showError);
      toast(`Dauerauftrag eingetragen: ${rec.description}`);
    }
    backend.update('recurring', rec.id, { lastBooked: months[months.length - 1] }).catch(showError);
  }
}

function sortedEntries(expenses, payments) {
  return [
    ...expenses.map((e) => ({ type: 'expense', item: e })),
    ...payments.map((p) => ({ type: 'payment', item: p })),
  ].sort((a, b) => (b.item.date ?? '').localeCompare(a.item.date ?? '')
    || toMillis(b.item.createdAt) - toMillis(a.item.createdAt));
}

function expenseRow(e, readonly) {
  const c = categoryOf(e.category);
  const myShare = splitAmount(e.amountCents, e.splitAmong ?? [], PERSON_IDS)[state.me];
  const inner = `
    <span class="entry-icon" aria-hidden="true">${c.icon}</span>
    <span class="entry-main">
      <span class="entry-title">${e.recurringId ? '🔁 ' : ''}${esc(e.description)}</span>
      <span class="entry-sub">${esc(personName(e.paidBy))} hat bezahlt · ${esc(forWhom(e.splitAmong ?? []))} · ${formatDate(e.date)}</span>
    </span>
    <span class="entry-right">
      <span class="amount">${formatEuro(e.amountCents)}</span>
      <span class="entry-share">${myShare ? `dein Anteil ${formatEuro(myShare)}` : 'ohne dich'}</span>
    </span>`;
  return readonly
    ? `<li><div class="entry">${inner}</div></li>`
    : `<li><button class="entry" data-action="edit-expense" data-id="${esc(e.id)}">${inner}</button></li>`;
}

function paymentRow(p, readonly) {
  return `
    <li><div class="entry">
      <span class="entry-icon" aria-hidden="true">💸</span>
      <span class="entry-main">
        <span class="entry-title">${esc(personName(p.from))} → ${esc(personName(p.to))}</span>
        <span class="entry-sub">Überweisung · ${formatDate(p.date)}</span>
      </span>
      <span class="entry-right">
        <span class="amount">${formatEuro(p.amountCents)}</span>
        ${readonly ? '' : `<button class="link-btn" data-action="undo-payment" data-id="${esc(p.id)}">Rückgängig</button>`}
      </span>
    </div></li>`;
}

function entryList(expenses, payments, readonly) {
  return `<ul class="entries">${sortedEntries(expenses, payments)
    .map(({ type, item }) => (type === 'expense' ? expenseRow(item, readonly) : paymentRow(item, readonly)))
    .join('')}</ul>`;
}

function entriesCard(expenses, payments) {
  const body = expenses.length + payments.length
    ? entryList(expenses, payments, false)
    : '<p class="empty">Noch keine Ausgaben. Tippe unten auf „＋ Ausgabe“.</p>';
  return `<section class="card">
    <div class="card-head"><h2>Einträge</h2><button class="link-btn" data-action="search-open">🔍 Suchen</button></div>
    ${body}
  </section>`;
}

function historyCard(openIds) {
  if (!state.settlements.length) return '';
  const items = [...state.settlements]
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
    .map((s) => {
      const day = new Date(toMillis(s.createdAt)).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
      const expenses = state.expenses.filter((e) => e.settlementId === s.id);
      const payments = state.payments.filter((p) => p.settlementId === s.id);
      return `
        <details class="history" data-id="${esc(s.id)}"${openIds.has(s.id) ? ' open' : ''}>
          <summary><span>Abrechnung vom ${day}</span><span class="muted">${s.expenseCount} Ausgaben · ${formatEuro(s.totalCents ?? 0)}</span></summary>
          ${entryList(expenses, payments, true)}
        </details>`;
    }).join('');
  return `<section class="card"><h2>Frühere Abrechnungen</h2>${items}</section>`;
}

// ---------- Putzplan ----------

// Die Bereiche aus der App – oder die Standard-Bereiche aus config.js.
const choreAreas = () => state.areas ?? CHORES;

// Alle Aufgaben einer Woche mit der Person, die (nach Tausch) dran ist.
function weekChores(monday) {
  const key = weekKey(monday);
  const idx = weekIndex(monday);
  // Wer in dieser Woche (fast) die ganze Zeit weg ist, bekommt keine Aufgabe.
  const present = PERSON_IDS.filter((id) => !isAwayForWeek(state.absences, id, monday));
  return choreAreas().map((chore, i) => {
    const docId = `${key}_${chore.id}`;
    const saved = state.chores[docId];
    const base = defaultAssignee(PERSON_IDS, i, idx);
    const away = present.length && !present.includes(base);
    const planned = away ? present[(i + idx) % present.length] : base;
    return {
      chore,
      docId,
      week: key,
      planned,
      awayPerson: away ? base : null,
      assignee: saved?.assignee ?? planned,
      doneBy: saved?.doneBy ?? null,
      saved,
    };
  });
}

const thisMonday = () => mondayOf(new Date());
const myOpenChores = () => weekChores(thisMonday()).filter((c) => c.assignee === state.me && !c.doneBy);


function weekTitle(offset, monday) {
  if (offset === 0) return 'Diese Woche';
  if (offset === 1) return 'Nächste Woche';
  if (offset === -1) return 'Letzte Woche';
  return `KW ${isoWeek(monday).week}`;
}

function weekRange(monday) {
  const opts = { day: 'numeric', month: 'short' };
  return `KW ${isoWeek(monday).week} · ${monday.toLocaleDateString('de-DE', opts)} – ${addDays(monday, 6).toLocaleDateString('de-DE', opts)}`;
}

function saveChore(c, changes) {
  backend.set('chores', c.docId, {
    week: c.week,
    chore: c.chore.id,
    assignee: c.assignee,
    doneBy: c.doneBy,
    doneAt: c.saved?.doneAt ?? null,
    ...changes,
    updatedBy: state.me,
    updatedAt: backend.now(),
  }).catch(showError);
}

function findChore(docId) {
  const monday = addDays(thisMonday(), state.choreWeekOffset * 7);
  return weekChores(monday).find((c) => c.docId === docId);
}

function choreDoneThisWeek(docId) {
  const c = weekChores(thisMonday()).find((x) => x.docId === docId);
  if (!c) return;
  saveChore(c, { doneBy: state.me, doneAt: backend.now() });
  toast(`${c.chore.name} erledigt – danke! 💪`);
}

function choreDone(docId) {
  const c = findChore(docId);
  if (!c) return;
  saveChore(c, { doneBy: state.me, doneAt: backend.now() });
  toast(`${c.chore.name} erledigt – danke! 💪`);
}

function choreUndo(docId) {
  const c = findChore(docId);
  if (c) saveChore(c, { doneBy: null, doneAt: null });
}

function choreTake(docId) {
  const c = findChore(docId);
  if (!c || !confirm(`Übernimmst du ${c.chore.name} für ${personName(c.assignee)}?`)) return;
  saveChore(c, { assignee: state.me });
  toast(`Du hast ${c.chore.name} übernommen ✓`);
}

function choreGiveBack(docId) {
  const c = findChore(docId);
  if (!c || !confirm(`${c.chore.name} wieder an ${personName(c.planned)} zurückgeben?`)) return;
  saveChore(c, { assignee: c.planned });
}

function choreItem(c, offset) {
  const mine = c.assignee === state.me;
  const swapped = c.assignee !== c.planned;
  const who = `
    <span class="chore-who">
      ${avatar(c.assignee, true)}
      <span>${mine ? 'Du' : esc(personName(c.assignee))}${swapped ? ` <em>(übernommen von ${esc(personName(c.planned))})</em>` : ''}${c.awayPerson && !swapped ? ` <em>(statt ${esc(personName(c.awayPerson))} – nicht da)</em>` : ''}</span>
    </span>`;

  let actions = '';
  if (c.doneBy) {
    actions = `
      <span class="done-label">✓ erledigt${c.doneBy !== c.assignee ? ` von ${esc(personName(c.doneBy))}` : ''}</span>
      <button class="link-btn" data-action="chore-undo" data-id="${c.docId}">Rückgängig</button>`;
  } else {
    if (mine && offset <= 0) actions += `<button class="btn small primary" data-action="chore-done" data-id="${c.docId}">Erledigt ✓</button>`;
    if (!mine) actions += `<button class="btn small" data-action="chore-take" data-id="${c.docId}">Ich übernehme</button>`;
    if (swapped && (mine || c.planned === state.me)) actions += `<button class="link-btn" data-action="chore-giveback" data-id="${c.docId}">Zurückgeben</button>`;
  }

  return `
    <li class="chore${c.doneBy ? ' done' : ''}${mine ? ' mine' : ''}">
      <span class="entry-icon" aria-hidden="true">${c.doneBy ? '✅' : c.chore.icon}</span>
      <span class="entry-main">
        <span class="entry-title">${esc(c.chore.name)}</span>
        <span class="entry-sub">${esc(c.chore.details)}</span>
        ${who}
      </span>
      <span class="chore-actions">${actions}</span>
    </li>`;
}

function choreHero() {
  const all = weekChores(thisMonday()).filter((c) => c.assignee === state.me);
  const open = all.filter((c) => !c.doneBy);
  if (!all.length) {
    return '<section class="card hero even"><p class="hero-label">Diese Woche hast du keine Aufgabe</p><p class="hero-amount">😎</p></section>';
  }
  if (!open.length) {
    return '<section class="card hero even"><p class="hero-label">Deine Aufgaben für diese Woche sind erledigt</p><p class="hero-amount">💪</p></section>';
  }
  return `
    <section class="card hero plus">
      <p class="hero-label">Diese Woche bist du dran mit</p>
      <p class="hero-amount chore-hero">${open.map((c) => `${c.chore.icon} ${esc(c.chore.name)}`).join('<br>')}</p>
    </section>`;
}

function upcomingCard() {
  const columns = `style="grid-template-columns: 52px repeat(${choreAreas().length}, minmax(0, 1fr))"`;
  const rows = [1, 2, 3, 4].map((n) => {
    const monday = addDays(thisMonday(), n * 7);
    const cells = weekChores(monday).map((c) => `
      <span class="plan-cell">${avatar(c.assignee, true)}<span>${esc(personName(c.assignee))}</span></span>`).join('');
    return `<li class="plan-row" ${columns}><span class="plan-week">KW ${isoWeek(monday).week}</span>${cells}</li>`;
  }).join('');
  const head = choreAreas().map((c) => `<span class="plan-cell head">${c.icon} ${esc(c.name)}</span>`).join('');
  return `
    <section class="card">
      <h2>Die nächsten Wochen</h2>
      <ul class="plan"><li class="plan-row plan-head" ${columns}><span class="plan-week"></span>${head}</li>${rows}</ul>
    </section>`;
}

function renderPutzplan() {
  const offset = state.choreWeekOffset;
  const monday = addDays(thisMonday(), offset * 7);
  $('#tab-putzplan').innerHTML = `
    ${choreHero()}
    <section class="card">
      <div class="week-nav">
        <button class="icon-btn" data-action="week" data-step="-1" aria-label="Woche zurück">‹</button>
        <button class="week-title" data-action="week" data-step="0">
          <strong>${weekTitle(offset, monday)}</strong>
          <small>${weekRange(monday)}</small>
        </button>
        <button class="icon-btn" data-action="week" data-step="1" aria-label="Woche vor">›</button>
      </div>
      <ul class="chores">${weekChores(monday).map((c) => choreItem(c, offset)).join('')}</ul>
      <p class="hint">Jemand hat spontan Zeit? Mit „Ich übernehme“ könnt ihr Aufgaben tauschen.</p>
    </section>
    <button class="btn outline full" data-action="edit-areas">✏️ Bereiche bearbeiten</button>
    ${upcomingCard()}`;
}

// ---------- Putzplan-Bereiche bearbeiten ----------

function areaRow(area) {
  return `
    <div class="area-row" data-id="${esc(area.id)}">
      <input class="area-icon" value="${esc(area.icon)}" maxlength="4" aria-label="Symbol">
      <div class="area-fields">
        <input class="area-name" value="${esc(area.name)}" maxlength="30" placeholder="Name, z. B. Bad">
        <input class="area-details" value="${esc(area.details)}" maxlength="120" placeholder="Was gehört dazu?">
      </div>
      <button type="button" class="icon-btn" data-action="remove-area" aria-label="Bereich löschen">🗑</button>
    </div>`;
}

function openAreasForm() {
  $('#areas-list').innerHTML = choreAreas().map(areaRow).join('');
  $('#areas-error').textContent = '';
  $('#areas-dialog').showModal();
}

function addArea() {
  const id = `b${Date.now().toString(36)}`;
  $('#areas-list').insertAdjacentHTML('beforeend', areaRow({ id, icon: '🧽', name: '', details: '' }));
  $(`#areas-list [data-id="${id}"] .area-name`).focus();
}

function onSubmitAreas(event) {
  event.preventDefault();
  const areas = [...document.querySelectorAll('#areas-list .area-row')].map((row) => ({
    id: row.dataset.id,
    icon: row.querySelector('.area-icon').value.trim() || '🧽',
    name: row.querySelector('.area-name').value.trim(),
    details: row.querySelector('.area-details').value.trim(),
  }));
  const problem = !areas.length ? 'Es muss mindestens einen Bereich geben.'
    : areas.some((a) => !a.name) ? 'Bitte jedem Bereich einen Namen geben.'
      : areas.length > 8 ? 'Bitte höchstens 8 Bereiche.'
        : '';
  if (problem) {
    $('#areas-error').textContent = problem;
    return;
  }
  backend.set('settings', 'putzplan', { areas, updatedBy: state.me, updatedAt: backend.now() }).catch(showError);
  $('#areas-dialog').close();
  toast('Putzplan geändert ✓');
}

// ---------- Einkaufsliste ----------

function renderEinkauf() {
  const open = state.shopping.filter((i) => !i.doneBy)
    .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
  const done = state.shopping.filter((i) => i.doneBy)
    .sort((a, b) => toMillis(b.doneAt) - toMillis(a.doneAt));

  const groups = SHOP_CATEGORIES
    .map((cat) => ({ cat, items: open.filter((i) => shopCategoryOf(i) === cat.id) }))
    .filter((g) => g.items.length);
  const openList = open.length
    ? `${groups.map((g) => `
        <h3 class="shop-cat">${g.cat.icon} ${esc(g.cat.name)}</h3>
        <ul class="shop">${g.items.map((i) => `
          <li class="shop-row">
            <button class="shop-item" data-action="shop-toggle" data-id="${esc(i.id)}">
              <span class="shop-check" aria-hidden="true"></span>
              <span class="shop-name">${i.amount ? `<span class="shop-amount">${esc(i.amount)}</span> ` : ''}${esc(i.name)}</span>
              <span class="shop-meta">${esc(personName(i.addedBy))}</span>
            </button>
            <button class="icon-btn small" data-action="shop-category" data-id="${esc(i.id)}" aria-label="Kategorie von ${esc(i.name)} ändern">${g.cat.icon}</button>
            <button class="icon-btn small" data-action="shop-delete" data-id="${esc(i.id)}" aria-label="${esc(i.name)} löschen">✕</button>
          </li>`).join('')}</ul>`).join('')}
       <p class="hint">Antippen, wenn du es besorgt hast. Falsche Kategorie? Tippe auf das Symbol rechts.</p>`
    : '<p class="empty">Alles da! Nichts auf der Liste. 🎉</p>';

  const myBought = myUnbilledShopping();
  const doneCard = done.length ? `
    <section class="card">
      <div class="card-head"><h2>Besorgt</h2><button class="link-btn" data-action="shop-clear">Liste aufräumen</button></div>
      <ul class="shop">${done.map((i) => `
        <li class="shop-row">
          <button class="shop-item done" data-action="shop-toggle" data-id="${esc(i.id)}">
            <span class="shop-check" aria-hidden="true">✓</span>
            <span class="shop-name">${i.amount ? `<span class="shop-amount">${esc(i.amount)}</span> ` : ''}${esc(i.name)}</span>
            <span class="shop-meta">von ${esc(personName(i.doneBy))}</span>
          </button>
        </li>`).join('')}</ul>
      ${myBought.length ? `<button class="btn primary full" data-action="shop-to-expense">🧾 Als Ausgabe eintragen (${myBought.length} ${myBought.length === 1 ? 'Sache' : 'Sachen'})</button>
        <p class="hint">Trägt deine besorgten Sachen als Ausgabe ein – du musst nur noch den Betrag eingeben.</p>` : ''}
    </section>` : '';

  $('#shop-list').innerHTML = `
    <section class="card">
      <div class="card-head"><h2>Fehlt noch</h2>${open.length ? `<span class="total">${open.length}</span>` : ''}</div>
      ${openList}
    </section>
    ${doneCard}`;

  $('#shop-quick').innerHTML = renderQuickPicks();

  const tabButton = document.querySelector('.tabbar [data-tab=einkauf]');
  tabButton.dataset.count = open.length || '';
}

// Schnellauswahl: Was mindestens so oft eingetragen wurde, erscheint als Knopf.
const QUICK_MIN_COUNT = 2;
const QUICK_MAX = 10;

// Firestore erlaubt keinen "/" in Namen von Einträgen.
const favoriteId = (name) => encodeURIComponent(name.trim().toLowerCase());
const openShoppingNames = () => new Set(state.shopping.filter((i) => !i.doneBy).map((i) => i.name.toLowerCase()));

function renderQuickPicks() {
  const onList = openShoppingNames();
  const picks = state.favorites
    .filter((f) => f.count >= QUICK_MIN_COUNT && (state.quickEdit || !onList.has(f.name.toLowerCase())))
    .sort((a, b) => b.count - a.count || toMillis(b.lastUsed) - toMillis(a.lastUsed))
    .slice(0, QUICK_MAX);
  if (!picks.length) {
    state.quickEdit = false;
    return '';
  }
  const action = state.quickEdit ? 'quick-remove' : 'quick-add';
  return `
    <section class="card quick${state.quickEdit ? ' editing' : ''}">
      <div class="card-head">
        <h2>Schnellauswahl</h2>
        <button class="link-btn" data-action="quick-edit">${state.quickEdit ? 'Fertig' : 'Bearbeiten'}</button>
      </div>
      <div class="quick-chips">${picks.map((f) => `
        <button class="quick-chip" data-action="${action}" data-id="${esc(f.id)}">
          ${state.quickEdit ? '✕' : '＋'} ${esc(f.name)}
        </button>`).join('')}</div>
      ${state.quickEdit ? '<p class="hint">Antippen, um es aus der Schnellauswahl zu entfernen.</p>' : ''}
    </section>`;
}

// entries: Texte wie "2x Milch" oder Objekte { name, amount }
function addShoppingItems(entries) {
  const onList = openShoppingNames();
  const parsed = entries.map((e) => (typeof e === 'string' ? parseShoppingInput(e) : e)).filter((e) => e.name);
  const seen = new Set();
  const fresh = parsed.filter((e) => {
    const key = e.name.toLowerCase();
    if (onList.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  fresh.forEach(({ name, amount }) => {
    const id = favoriteId(name);
    const known = state.favorites.find((f) => f.id === id);
    const category = known?.category ?? guessCategory(name);
    backend.add('shopping', { name: known?.name ?? name, amount: amount ?? '', category, addedBy: state.me, createdAt: backend.now(), doneBy: null, doneAt: null }).catch(showError);
    // Mitzählen, wie oft etwas gebraucht wird (und in welcher Kategorie).
    backend.set('favorites', id, {
      name: known?.name ?? name,
      count: (known?.count ?? 0) + 1,
      category,
      lastUsed: backend.now(),
    }).catch(showError);
  });
  if (fresh.length < parsed.length) toast('Steht schon auf der Liste');
}

function onSubmitShopping(event) {
  event.preventDefault();
  const input = $('#shop-input');
  // Mehrere Sachen auf einmal: "Milch, Eier, Brot"
  const names = input.value.split(',').map((n) => n.trim()).filter(Boolean);
  if (!names.length) return;
  addShoppingItems(names);
  input.value = '';
}

// Kategorie eines Einkaufs: gespeichert, sonst geraten.
function shopCategoryOf(item) {
  const id = item.category ?? guessCategory(item.name);
  return SHOP_CATEGORIES.some((c) => c.id === id) ? id : 'sonstiges';
}

function openShopCategory(id) {
  const item = state.shopping.find((i) => i.id === id);
  if (!item) return;
  state.shopCatItem = id;
  const current = shopCategoryOf(item);
  $('#shopcat-title').textContent = `Kategorie für „${item.name}“`;
  $('#shopcat-list').innerHTML = SHOP_CATEGORIES.map((c) => `
    <button type="button" class="chip-btn${c.id === current ? ' active' : ''}" data-action="shop-setcat" data-cat="${c.id}">${c.icon} ${esc(c.name)}</button>`).join('');
  $('#shopcat-dialog').showModal();
}

function setShopCategory(category) {
  const item = state.shopping.find((i) => i.id === state.shopCatItem);
  $('#shopcat-dialog').close();
  if (!item) return;
  backend.update('shopping', item.id, { category }).catch(showError);
  // Für das nächste Mal merken.
  const favId = favoriteId(item.name);
  const known = state.favorites.find((f) => f.id === favId);
  backend.set('favorites', favId, {
    name: known?.name ?? item.name,
    count: known?.count ?? 0,
    lastUsed: known?.lastUsed ?? backend.now(),
    category,
  }).catch(showError);
}

function quickAdd(id) {
  const fav = state.favorites.find((f) => f.id === id);
  if (fav) addShoppingItems([{ name: fav.name, amount: '' }]);
}

function quickRemove(id) {
  const fav = state.favorites.find((f) => f.id === id);
  if (fav && confirm(`„${fav.name}“ aus der Schnellauswahl entfernen?`)) backend.remove('favorites', id).catch(showError);
}

const myUnbilledShopping = () => state.shopping.filter((i) => i.doneBy === state.me && !i.expensed);

function shopToExpense() {
  const items = myUnbilledShopping();
  if (!items.length) return;
  let description = `Einkauf: ${items.map((i) => i.name).join(', ')}`;
  if (description.length > 80) description = `${description.slice(0, 77)}…`;
  const onlyHousehold = items.every((i) => ['drogerie', 'haushalt'].includes(shopCategoryOf(i)));
  openExpenseForm(null, {
    prefill: { description, category: onlyHousehold ? 'haushalt' : 'lebensmittel' },
    shopIds: items.map((i) => i.id),
  });
}

function shopToggle(id) {
  const item = state.shopping.find((i) => i.id === id);
  if (!item) return;
  backend.update('shopping', id, item.doneBy
    ? { doneBy: null, doneAt: null }
    : { doneBy: state.me, doneAt: backend.now() }).catch(showError);
}

function shopDelete(id) {
  const item = state.shopping.find((i) => i.id === id);
  if (item) removeWithUndo(`„${item.name}“ gelöscht`, [{ col: 'shopping', doc: item }]);
}

function shopClear() {
  const done = state.shopping.filter((i) => i.doneBy);
  if (!done.length) return;
  removeWithUndo(`${done.length} besorgte ${done.length === 1 ? 'Sache' : 'Sachen'} entfernt`, done.map((doc) => ({ col: 'shopping', doc })));
}

// ---------- Kalender ----------

const sameDay = (a, b) => a.toDateString() === b.toDateString();
const timeOf = (d) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

async function loadEvents() {
  const cal = state.calendar;
  if (!cal.config || cal.loading) return;
  cal.loading = true;
  renderKalender();
  try {
    cal.events = backend.isDemo ? backend.demoEvents() : await fetchEvents(cal.config);
    cal.error = null;
  } catch (err) {
    console.error(err);
    cal.error = err;
  }
  cal.loading = false;
  cal.loadedAt = Date.now();
  renderAll();
}

function calendarErrorText(err) {
  if (err?.status === 404) return 'Kalender nicht gefunden. Stimmt die Kalender-ID? Ist der Kalender öffentlich freigegeben?';
  if (err?.status === 400 || err?.status === 403) return 'Google lehnt den Zugriff ab. Stimmt der API-Schlüssel und ist die Google Calendar API aktiviert?';
  return 'Die Termine konnten nicht geladen werden. Bist du online?';
}

function eventTime(e, day) {
  if (e.allDay) return 'ganztägig';
  if (!sameDay(e.start, day)) return `bis ${timeOf(e.end)}`;
  return sameDay(e.start, e.end) ? `${timeOf(e.start)} – ${timeOf(e.end)}` : `ab ${timeOf(e.start)}`;
}

function dayTitle(day) {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (sameDay(day, today)) return 'Heute';
  if (sameDay(day, tomorrow)) return 'Morgen';
  return day.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}



function renderKalender() {
  const cal = state.calendar;
  const el = $('#tab-kalender');
  const back = '<button class="back-link" data-action="tab" data-tab="start">‹ Zur Übersicht</button>';
  if (!cal.config) {
    el.innerHTML = `${back}
      <section class="card soon">
        <div class="soon-icon">📅</div>
        <h2>Gemeinsamer Kalender</h2>
        <p>Verbinde euren WG-Kalender von Google. Dann erscheinen hier alle Termine – und auf der Startseite, was heute ansteht.</p>
        <button class="btn primary" data-action="calendar-settings">Kalender verbinden</button>
      </section>`;
    return;
  }

  let body;
  if (cal.error) {
    body = `<p class="error">${esc(calendarErrorText(cal.error))}</p>
      <button class="btn outline full" data-action="calendar-settings">Einstellungen prüfen</button>`;
  } else if (!cal.events) {
    body = '<div class="center-pad"><div class="spinner"></div></div>';
  } else {
    const groups = groupByDay(cal.events);
    body = groups.length
      ? groups.map((g) => `
        <div class="day">
          <h3 class="day-title${sameDay(g.day, new Date()) ? ' today' : ''}">${dayTitle(g.day)}</h3>
          <ul class="events">${g.events.map((e) => `
            <li><a class="event" href="${esc(e.link)}" target="_blank" rel="noopener">
              <span class="event-time">${eventTime(e, g.day)}</span>
              <span class="event-main">
                <span class="event-title${e.hiddenTitle ? ' muted' : ''}">${esc(e.title)}</span>
                ${e.location ? `<span class="event-sub">📍 ${esc(e.location)}</span>` : ''}
              </span>
            </a></li>`).join('')}</ul>
        </div>`).join('')
      : '<p class="empty">In den nächsten 60 Tagen steht nichts an.</p>';
  }

  const allHidden = cal.events?.length > 0 && cal.events.every((e) => e.hiddenTitle);
  const titleHint = allHidden ? `
    <section class="card notice">
      <strong>Die Titel der Termine sind nicht sichtbar.</strong>
      <p>Google gibt gerade nur „frei/belegt“ heraus. In Google Kalender bei „WG Kölle“ →
      „Zugriffsberechtigungen für Termine“ neben „Öffentlich freigeben“
      <strong>„Alle Termindetails anzeigen“</strong> auswählen. Danach hier auf „Aktualisieren“ tippen.</p>
    </section>` : '';

  el.innerHTML = `${back}
    ${titleHint}
    <section class="card">
      <div class="card-head">
        <h2>Nächste Termine</h2>
        <button class="link-btn" data-action="calendar-reload">${cal.loading ? 'Lädt …' : 'Aktualisieren'}</button>
      </div>
      ${body}
    </section>
    <a class="btn primary full" href="${esc(newEventLink(cal.config.calendarId))}" target="_blank" rel="noopener">＋ Termin eintragen</a>
    <p class="hint">Öffnet Google Kalender. Achte darauf, dass euer WG-Kalender ausgewählt ist.</p>
    <button class="btn outline full" data-action="calendar-settings">⚙️ Kalender-Einstellungen</button>`;
}

function openCalendarForm() {
  $('#c-id').value = state.calendar.config?.calendarId ?? '';
  $('#c-key').value = state.calendar.config?.apiKey ?? '';
  $('#c-remove').hidden = !state.calendar.config;
  $('#c-error').textContent = '';
  $('#calendar-dialog').showModal();
}

function onSubmitCalendar(event) {
  event.preventDefault();
  const calendarId = $('#c-id').value.trim();
  const apiKey = $('#c-key').value.trim();
  const problem = !calendarId.includes('@') ? 'Die Kalender-ID sieht nicht richtig aus. Sie endet meist auf @group.calendar.google.com.'
    : !/^AIza[\w-]{20,}$/.test(apiKey) ? 'Der API-Schlüssel sieht nicht richtig aus. Er beginnt mit „AIza“.'
      : '';
  if (problem) {
    $('#c-error').textContent = problem;
    return;
  }
  backend.set('settings', 'kalender', { calendarId, apiKey, updatedBy: state.me, updatedAt: backend.now() }).catch(showError);
  $('#calendar-dialog').close();
  toast('Kalender gespeichert ✓');
}

function removeCalendar() {
  if (!confirm('Kalender von der Website trennen? Die Termine bei Google bleiben erhalten.')) return;
  backend.remove('settings', 'kalender').catch(showError);
  $('#calendar-dialog').close();
}

// ---------- Infos: Schwarzes Brett & Datensicherung ----------

const NOTE_TEMPLATES = [
  { title: '📶 WLAN', text: 'Netzwerk: \nPasswort: ' },
  { title: '🏠 Vermieter & Hausverwaltung', text: 'Name: \nTelefon: \nE-Mail: ' },
  { title: '🔢 Zählerstände', text: 'Strom: \nGas: \nWasser: ' },
  { title: '🔑 Schlüssel', text: 'Ersatzschlüssel bei: ' },
  { title: '🚨 Notfall & Handwerker', text: 'Hausmeister: \nSchlüsseldienst: ' },
];

function renderInfos() {
  const notes = [...state.notes].sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
  const existing = new Set(notes.map((n) => n.title));
  const templates = NOTE_TEMPLATES.filter((t) => !existing.has(t.title));

  const noteCards = notes.map((n) => `
    <article class="card note">
      <div class="card-head"><h2>${esc(n.title)}</h2><button class="link-btn" data-action="note-edit" data-id="${esc(n.id)}">Bearbeiten</button></div>
      ${n.text ? `<p class="note-text">${esc(n.text)}</p>` : ''}
      <div class="note-foot">
        <span>${esc(personName(n.updatedBy ?? n.createdBy))} · ${new Date(toMillis(n.updatedAt ?? n.createdAt) || Date.now()).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</span>
        ${n.text ? `<button class="link-btn" data-action="note-copy" data-id="${esc(n.id)}">Text kopieren</button>` : ''}
      </div>
    </article>`).join('');

  const last = state.backup?.at ? new Date(toMillis(state.backup.at)) : null;
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  const backupInfo = last
    ? `Letzte Sicherung: ${days === 0 ? 'heute' : days === 1 ? 'gestern' : `vor ${days} Tagen`} von ${esc(personName(state.backup.by))}.`
    : 'Es wurde noch keine Sicherung gemacht.';

  $('#tab-infos').innerHTML = `
    <section class="card">
      <div class="card-head"><h2>📌 Schwarzes Brett</h2><button class="link-btn" data-action="note-new">＋ Notiz</button></div>
      <p class="hint left">Alles, was man in der WG immer wieder sucht.</p>
      ${templates.length ? `<div class="quick-chips">${templates.map((t, i) => `
        <button class="quick-chip" data-action="note-template" data-index="${NOTE_TEMPLATES.indexOf(t)}">＋ ${esc(t.title)}</button>`).join('')}</div>` : ''}
    </section>
    ${noteCards}
    <section class="card${days === null || days > 30 ? ' notice' : ''}">
      <h2>💾 Datensicherung</h2>
      <p class="hint left">${backupInfo} Am besten einmal im Monat sichern und die Datei z. B. in iCloud oder Google Drive ablegen.</p>
      <div class="stack">
        <button class="btn primary full" data-action="export-json">Alle Daten sichern</button>
        <button class="btn outline full" data-action="export-csv">Ausgaben als Tabelle (Excel)</button>
        <button class="btn outline full" data-action="restore-open">Sicherung zurückspielen</button>
      </div>
    </section>`;
}

function openNoteForm(note, template) {
  state.editingNote = note?.id ?? null;
  $('#note-title-head').textContent = note ? 'Notiz bearbeiten' : 'Neue Notiz';
  $('#n-title').value = note?.title ?? template?.title ?? '';
  $('#n-text').value = note?.text ?? template?.text ?? '';
  $('#n-delete').hidden = !note;
  $('#n-error').textContent = '';
  $('#note-dialog').showModal();
}

function onSubmitNote(event) {
  event.preventDefault();
  const title = $('#n-title').value.trim();
  const text = $('#n-text').value.trim();
  if (!title) {
    $('#n-error').textContent = 'Bitte eine Überschrift eingeben.';
    return;
  }
  const id = state.editingNote;
  const saving = id
    ? backend.update('notes', id, { title, text, updatedBy: state.me, updatedAt: backend.now() })
    : backend.add('notes', { title, text, createdBy: state.me, createdAt: backend.now(), updatedBy: state.me, updatedAt: backend.now() });
  saving.catch(showError);
  $('#note-dialog').close();
  toast('Notiz gespeichert ✓');
}

function deleteNote() {
  const note = state.notes.find((n) => n.id === state.editingNote);
  if (!note) return;
  $('#note-dialog').close();
  removeWithUndo('Notiz gelöscht', [{ col: 'notes', doc: note }]);
}

async function copyNote(id) {
  const note = state.notes.find((n) => n.id === id);
  if (!note) return;
  try {
    await navigator.clipboard.writeText(note.text);
    toast('Kopiert ✓');
  } catch {
    toast('Kopieren hat nicht geklappt – Text bitte markieren.', true);
  }
}

// Datei speichern: auf dem Handy über "Teilen" (z. B. in Dateien/iCloud), sonst als Download.
async function saveFile(filename, text, type) {
  const file = new File([text], filename, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch (err) {
      if (err?.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(file);
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

async function exportJson() {
  const data = toPlain({
    app: 'Projekt Kölle',
    exportedAt: new Date(),
    exportedBy: state.me,
    expenses: state.expenses,
    payments: state.payments,
    settlements: state.settlements,
    recurring: state.recurring,
    shopping: state.shopping,
    favorites: state.favorites,
    chores: Object.values(state.chores),
    choreAreas: state.areas,
    notes: state.notes,
    absences: state.absences,
    polls: state.polls,
  });
  const saved = await saveFile(`projekt-koelle-sicherung-${todayISO()}.json`, JSON.stringify(data, null, 2), 'application/json');
  if (saved) {
    backend.set('settings', 'backup', { at: backend.now(), by: state.me }).catch(showError);
    toast('Sicherung erstellt ✓');
  }
}

async function exportCsv() {
  const csv = expensesCsv(state.expenses, {
    personName,
    categoryName: (id) => categoryOf(id).name,
  });
  await saveFile(`projekt-koelle-ausgaben-${todayISO()}.csv`, csv, 'text/csv');
}

// ---------- Start: Übersicht ----------

const openPolls = () => state.polls.filter((p) => !p.closed);
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shortDate = (iso) => formatDate(iso);

function renderStart() {
  const now = new Date();
  const hour = now.getHours();
  const hello = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
  const balance = computeBalances(PERSON_IDS, activeExpenses(), activePayments())[state.me];
  const myChores = weekChores(thisMonday()).filter((c) => c.assignee === state.me);
  const openShop = state.shopping.filter((i) => !i.doneBy);
  const meAway = isAwayOn(state.absences, state.me);

  $('#tab-start').innerHTML = `
    <section class="start-hello">
      <h1>${hello}, ${esc(personName(state.me))}!</h1>
      <p>${now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}${meAway ? ' · du bist gerade nicht da 🌴' : ''}</p>
    </section>
    ${startCalendarCard()}
    <div class="start-grid">
      <button class="card tile" data-action="tab" data-tab="ausgaben">
        <span class="tile-icon">💶</span>
        <span class="tile-label">${balance > 0 ? 'Du bekommst' : balance < 0 ? 'Du schuldest' : 'Kontostand'}</span>
        <strong class="tile-value">${balance === 0 ? 'ausgeglichen' : formatEuro(Math.abs(balance))}</strong>
      </button>
      <button class="card tile" data-action="tab" data-tab="einkauf">
        <span class="tile-icon">🛒</span>
        <span class="tile-label">Einkaufsliste</span>
        <strong class="tile-value">${openShop.length ? `${openShop.length} ${openShop.length === 1 ? 'Sache fehlt' : 'Sachen fehlen'}` : 'alles da'}</strong>
      </button>
    </div>
    ${startChoreCard(myChores)}
    ${pollsCard()}
    ${absencesCard()}`;
}

function startCalendarCard() {
  const cal = state.calendar;
  if (!cal.config) {
    return `<button class="card banner" data-action="tab" data-tab="kalender">
      <span class="banner-icon" aria-hidden="true">📅</span>
      <span class="banner-text">Kalender<strong>Noch nicht verbunden</strong></span>
      <span class="banner-arrow" aria-hidden="true">›</span>
    </button>`;
  }
  const groups = groupByDay(cal.events ?? []).slice(0, 3);
  const body = cal.error ? `<p class="error">${esc(calendarErrorText(cal.error))}</p>`
    : !cal.events ? '<div class="center-pad"><div class="spinner"></div></div>'
      : groups.length ? groups.map((g) => `
        <div class="start-day">
          <span class="start-day-title${sameDay(g.day, new Date()) ? ' today' : ''}">${dayTitle(g.day)}</span>
          ${g.events.slice(0, 3).map((e) => `<span class="start-event"><span>${e.allDay ? 'ganztägig' : sameDay(e.start, g.day) ? timeOf(e.start) : 'läuft'}</span>${esc(e.title)}</span>`).join('')}
        </div>`).join('')
        : '<p class="empty">Keine Termine in den nächsten Wochen.</p>';
  return `
    <section class="card">
      <div class="card-head"><h2>📅 Nächste Termine</h2><button class="link-btn" data-action="tab" data-tab="kalender">Ganzer Kalender ›</button></div>
      ${body}
    </section>`;
}

function startChoreCard(myChores) {
  if (!myChores.length) {
    return `<button class="card banner" data-action="tab" data-tab="putzplan">
      <span class="banner-icon" aria-hidden="true">😎</span>
      <span class="banner-text">Putzplan<strong>Diese Woche hast du frei</strong></span>
      <span class="banner-arrow" aria-hidden="true">›</span>
    </button>`;
  }
  return `
    <section class="card">
      <div class="card-head"><h2>🧹 Deine Aufgabe diese Woche</h2><button class="link-btn" data-action="tab" data-tab="putzplan">Putzplan ›</button></div>
      ${myChores.map((c) => `
        <div class="start-chore${c.doneBy ? ' done' : ''}">
          <span class="start-chore-name">${c.chore.icon} ${esc(c.chore.name)}</span>
          ${c.doneBy ? '<span class="done-label">✓ erledigt</span>'
            : `<button class="btn small primary" data-action="chore-done-start" data-id="${c.docId}">Erledigt ✓</button>`}
        </div>`).join('')}
    </section>`;
}

// ---------- Abwesenheiten ----------

function absencesCard() {
  const list = upcomingAbsences(state.absences);
  const items = list.map((a) => `
    <li class="row">
      ${avatar(a.person, true)}
      <span class="row-name">${esc(personName(a.person))}
        <small>${a.from === a.to ? shortDate(a.from) : `${shortDate(a.from)} – ${shortDate(a.to)}`}${a.note ? ` · ${esc(a.note)}` : ''}${isAwayOn(state.absences, a.person) && a.from <= isoDay(new Date()) ? ' · gerade weg' : ''}</small>
      </span>
      <button class="icon-btn small" data-action="absence-delete" data-id="${esc(a.id)}" aria-label="Abwesenheit löschen">✕</button>
    </li>`).join('');
  return `
    <section class="card">
      <div class="card-head"><h2>🌴 Wer ist weg?</h2><button class="link-btn" data-action="absence-new">＋ Eintragen</button></div>
      ${items ? `<ul class="rows">${items}</ul>` : '<p class="empty">Alle sind da.</p>'}
    </section>`;
}

function openAbsenceForm() {
  $('#a-person').innerHTML = PEOPLE.map((p) => chip('absPerson', 'radio', p.id, p.name, p.id === state.me)).join('');
  $('#a-from').value = todayISO();
  $('#a-to').value = todayISO();
  $('#a-note').value = '';
  $('#a-error').textContent = '';
  $('#absence-dialog').showModal();
}

function onSubmitAbsence(event) {
  event.preventDefault();
  const person = $('#absence-form input[name=absPerson]:checked')?.value ?? state.me;
  const from = $('#a-from').value;
  const to = $('#a-to').value;
  if (!from || !to || to < from) {
    $('#a-error').textContent = 'Bitte ein gültiges Von- und Bis-Datum wählen.';
    return;
  }
  backend.add('absences', { person, from, to, note: $('#a-note').value.trim(), createdBy: state.me, createdAt: backend.now() }).catch(showError);
  $('#absence-dialog').close();
  toast('Eingetragen ✓ Der Putzplan passt sich an.');
}

function deleteAbsence(id) {
  const absence = state.absences.find((a) => a.id === id);
  if (absence) removeWithUndo('Abwesenheit gelöscht', [{ col: 'absences', doc: absence }]);
}

// ---------- Abstimmungen ----------

function pollsCard() {
  const weekAgo = Date.now() - 7 * 86400000;
  const polls = state.polls
    .filter((p) => !p.closed || toMillis(p.closedAt) > weekAgo)
    .sort((a, b) => (a.closed - b.closed) || (toMillis(b.createdAt) - toMillis(a.createdAt)));
  const cards = polls.map((p) => {
    const votes = p.votes ?? {};
    const counts = p.options.map((_, i) => PERSON_IDS.filter((id) => votes[id] === i));
    const max = Math.max(...counts.map((c) => c.length));
    const voted = PERSON_IDS.filter((id) => votes[id] != null).length;
    return `
      <div class="poll${p.closed ? ' closed' : ''}">
        <p class="poll-question">${esc(p.question)}</p>
        <div class="poll-options">${p.options.map((opt, i) => `
          <button class="poll-option${votes[state.me] === i ? ' mine' : ''}${p.closed && max > 0 && counts[i].length === max ? ' winner' : ''}"
            ${p.closed ? 'disabled' : `data-action="poll-vote" data-id="${esc(p.id)}" data-index="${i}"`}>
            <span class="poll-text">${esc(opt)}</span>
            <span class="poll-voters">${counts[i].map((id) => avatar(id, true)).join('')}</span>
          </button>`).join('')}</div>
        <div class="poll-foot">
          <span>${p.closed ? 'Beendet' : `${voted} von ${PERSON_IDS.length} haben abgestimmt`}</span>
          <span>
            ${p.closed ? '' : `<button class="link-btn" data-action="poll-close" data-id="${esc(p.id)}">Beenden</button>`}
            <button class="link-btn" data-action="poll-delete" data-id="${esc(p.id)}">Löschen</button>
          </span>
        </div>
      </div>`;
  }).join('');
  return `
    <section class="card">
      <div class="card-head"><h2>🗳️ Abstimmungen</h2><button class="link-btn" data-action="poll-new">＋ Neu</button></div>
      ${cards || '<p class="empty">Gerade keine Abstimmung. Zum Beispiel: „Pizza oder Sushi am Freitag?“</p>'}
    </section>`;
}

function pollOptionInput(value = '') {
  return `<input class="poll-input" maxlength="60" placeholder="Antwort" value="${esc(value)}" autocomplete="off">`;
}

function openPollForm() {
  $('#p-question').value = '';
  $('#p-options').innerHTML = pollOptionInput() + pollOptionInput();
  $('#p-error').textContent = '';
  $('#poll-dialog').showModal();
  $('#p-question').focus();
}

function onSubmitPoll(event) {
  event.preventDefault();
  const question = $('#p-question').value.trim();
  const options = [...document.querySelectorAll('#p-options .poll-input')].map((i) => i.value.trim()).filter(Boolean);
  const problem = !question ? 'Bitte eine Frage eingeben.' : options.length < 2 ? 'Bitte mindestens zwei Antworten eingeben.' : '';
  if (problem) {
    $('#p-error').textContent = problem;
    return;
  }
  backend.add('polls', { question, options, votes: {}, closed: false, createdBy: state.me, createdAt: backend.now() }).catch(showError);
  $('#poll-dialog').close();
  toast('Abstimmung gestartet ✓');
}

function votePoll(id, index) {
  const poll = state.polls.find((p) => p.id === id);
  if (!poll || poll.closed) return;
  // Nochmal auf die eigene Antwort tippen nimmt die Stimme zurück.
  const value = poll.votes?.[state.me] === index ? null : index;
  backend.update('polls', id, { [`votes.${state.me}`]: value }).catch(showError);
}

function closePoll(id) {
  backend.update('polls', id, { closed: true, closedAt: backend.now() }).catch(showError);
}

function deletePoll(id) {
  const poll = state.polls.find((p) => p.id === id);
  if (poll) removeWithUndo('Abstimmung gelöscht', [{ col: 'polls', doc: poll }]);
}

// ---------- Suche bei den Ausgaben ----------

function openSearch() {
  $('#search-input').value = '';
  renderSearch();
  $('#search-dialog').showModal();
  $('#search-input').focus();
}

function renderSearch() {
  const q = $('#search-input').value.trim().toLowerCase();
  const el = $('#search-results');
  if (q.length < 2) {
    el.innerHTML = '<p class="hint">Suche nach Beschreibung, Kategorie, Person oder Betrag – auch in früheren Abrechnungen.</p>';
    return;
  }
  const hits = state.expenses.filter((e) => [
    e.description, categoryOf(e.category).name, personName(e.paidBy),
    formatEuro(e.amountCents), (e.amountCents / 100).toFixed(2).replace('.', ','),
  ].some((t) => String(t).toLowerCase().includes(q)))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, 50);
  el.innerHTML = hits.length
    ? `<p class="hint">${hits.length === 50 ? 'Die neuesten 50 Treffer' : `${hits.length} ${hits.length === 1 ? 'Treffer' : 'Treffer'}`}</p>
       <ul class="entries">${hits.map((e) => expenseRow({ ...e, date: e.date }, true).replace('<span class="entry-sub">', `<span class="entry-sub">${e.settlementId ? 'abgerechnet · ' : ''}`)).join('')}</ul>`
    : '<p class="empty">Nichts gefunden.</p>';
}

// ---------- Sicherung zurückspielen ----------

const RESTORE_COLLECTIONS = ['expenses', 'payments', 'settlements', 'recurring', 'shopping', 'favorites', 'chores', 'notes', 'absences', 'polls'];

async function restoreBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    toast('Die Datei konnte nicht gelesen werden.', true);
    return;
  }
  if (data?.app !== 'Projekt Kölle') {
    toast('Das ist keine Sicherung von Projekt Kölle.', true);
    return;
  }
  const counts = RESTORE_COLLECTIONS.map((c) => (Array.isArray(data[c]) ? data[c].length : 0));
  const total = counts.reduce((a, b) => a + b, 0);
  const when = data.exportedAt ? new Date(data.exportedAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) : 'unbekannt';
  if (!confirm(`Sicherung vom ${when} mit ${total} Einträgen zurückspielen?\n\nEinträge aus der Sicherung werden wiederhergestellt bzw. auf den Stand der Sicherung gesetzt. Neuere Einträge bleiben erhalten.`)) return;
  for (const col of RESTORE_COLLECTIONS) {
    for (const item of data[col] ?? []) {
      if (!item?.id) continue;
      const { id, ...rest } = item;
      backend.set(col, id, rest).catch(showError);
    }
  }
  if (Array.isArray(data.choreAreas) && data.choreAreas.length) {
    backend.set('settings', 'putzplan', { areas: data.choreAreas, updatedBy: state.me, updatedAt: backend.now() }).catch(showError);
  }
  toast(`Sicherung zurückgespielt ✓ (${total} Einträge)`);
}

// ---------- Offline-Hinweis ----------

function updateOnline() {
  $('#offline-banner').hidden = navigator.onLine;
}

// ---------- Formular ----------

function chip(name, type, value, label, checked) {
  return `<label class="chip"><input type="${type}" name="${name}" value="${esc(value)}"${checked ? ' checked' : ''}><span>${esc(label)}</span></label>`;
}

// opts.mode: 'expense' oder 'recurring'; opts.prefill: Vorschlagswerte; opts.shopIds: Einkäufe, die abgerechnet werden
function openExpenseForm(expense, opts = {}) {
  if (expense?.settlementId) {
    toast('Abgerechnete Einträge können nicht mehr geändert werden.');
    return;
  }
  const recurring = opts.mode === 'recurring';
  state.formMode = recurring ? 'recurring' : 'expense';
  state.pendingShopIds = opts.shopIds ?? [];
  state.editingId = expense?.id ?? null;
  const prefill = opts.prefill ?? {};
  $('#form-title').textContent = recurring
    ? (expense ? 'Dauerauftrag bearbeiten' : 'Neuer Dauerauftrag')
    : (expense ? 'Ausgabe bearbeiten' : 'Neue Ausgabe');
  $('#f-amount').value = expense ? (expense.amountCents / 100).toFixed(2).replace('.', ',') : '';
  $('#f-desc').value = expense?.description ?? prefill.description ?? '';
  $('#f-date').value = expense?.date ?? todayISO();
  $('#f-date-row').hidden = recurring;
  $('#f-day-row').hidden = !recurring;
  const day = expense?.dayOfMonth ?? 1;
  $('#f-day').innerHTML = Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}"${i + 1 === day ? ' selected' : ''}>${i + 1}.</option>`).join('');

  const category = expense?.category ?? prefill.category ?? CATEGORIES[0].id;
  const paidBy = expense?.paidBy ?? state.me;
  const split = expense?.splitAmong ?? PERSON_IDS;
  $('#f-category').innerHTML = CATEGORIES.map((c) => chip('category', 'radio', c.id, `${c.icon} ${c.name}`, c.id === category)).join('');
  $('#f-paidby').innerHTML = PEOPLE.map((p) => chip('paidBy', 'radio', p.id, p.name, p.id === paidBy)).join('');
  $('#f-split').innerHTML = PEOPLE.map((p) => chip('split', 'checkbox', p.id, p.name, split.includes(p.id))).join('');

  $('#f-delete').hidden = !expense;
  $('#f-error').textContent = '';
  updateSplitHint();
  $('#expense-dialog').showModal();
  if (!expense) $('#f-amount').focus();
}

function readForm() {
  const form = $('#expense-form');
  return {
    amountCents: parseEuro($('#f-amount').value),
    description: $('#f-desc').value.trim(),
    category: form.querySelector('input[name=category]:checked')?.value ?? 'sonstiges',
    paidBy: form.querySelector('input[name=paidBy]:checked')?.value ?? state.me,
    splitAmong: [...form.querySelectorAll('input[name=split]:checked')].map((i) => i.value),
    date: $('#f-date').value || todayISO(),
  };
}

function updateSplitHint() {
  const { amountCents, splitAmong } = readForm();
  const hint = $('#f-split-hint');
  if (!splitAmong.length) {
    hint.textContent = 'Bitte mindestens eine Person auswählen.';
  } else if (splitAmong.length === 1) {
    hint.textContent = `${personName(splitAmong[0])} trägt alles.`;
  } else if (amountCents) {
    const shares = Object.values(splitAmount(amountCents, splitAmong, PERSON_IDS));
    const even = Math.min(...shares) === Math.max(...shares);
    hint.textContent = `Das sind ${even ? '' : 'ca. '}${formatEuro(Math.min(...shares))} pro Person.`;
  } else {
    hint.textContent = '';
  }
}

function onSubmitExpense(event) {
  event.preventDefault();
  const data = readForm();
  const problem = !data.amountCents ? 'Bitte einen gültigen Betrag eingeben, z. B. 12,50.'
    : !data.description ? 'Bitte eingeben, wofür das Geld war.'
      : !data.splitAmong.length ? 'Bitte bei „Für wen?“ mindestens eine Person auswählen.'
        : '';
  if (problem) {
    $('#f-error').textContent = problem;
    return;
  }

  const id = state.editingId;
  if (state.formMode === 'recurring') {
    const { date, ...rest } = data;
    const rec = { ...rest, dayOfMonth: Number($('#f-day').value) };
    const saving = id
      ? backend.update('recurring', id, { ...rec, updatedAt: backend.now(), updatedBy: state.me })
      : backend.add('recurring', { ...rec, lastBooked: initialLastBooked(rec.dayOfMonth), createdAt: backend.now(), createdBy: state.me });
    saving.catch(showError);
    $('#expense-dialog').close();
    toast(id ? 'Dauerauftrag geändert ✓' : 'Dauerauftrag angelegt ✓');
    return;
  }

  const saving = id
    ? backend.update('expenses', id, { ...data, updatedAt: backend.now(), updatedBy: state.me })
    : backend.add('expenses', { ...data, createdAt: backend.now(), createdBy: state.me, settlementId: null });
  saving.catch(showError);
  // Besorgte Einkäufe als abgerechnet markieren
  state.pendingShopIds.forEach((shopId) => backend.update('shopping', shopId, { expensed: true }).catch(showError));
  state.pendingShopIds = [];
  $('#expense-dialog').close();
  toast(id ? 'Änderung gespeichert ✓' : 'Ausgabe eingetragen ✓');
}

function deleteExpense() {
  const id = state.editingId;
  if (state.formMode === 'recurring') {
    const rec = state.recurring.find((r) => r.id === id);
    if (!rec) return;
    $('#expense-dialog').close();
    removeWithUndo('Dauerauftrag gelöscht (eingetragene Ausgaben bleiben)', [{ col: 'recurring', doc: rec }]);
    return;
  }
  const expense = state.expenses.find((e) => e.id === id);
  if (!expense) return;
  $('#expense-dialog').close();
  removeWithUndo('Ausgabe gelöscht', [{ col: 'expenses', doc: expense }]);
}

// ---------- Ausgleichen ----------

function markPaid(from, to, amountCents) {
  if (!confirm(`Hat ${personName(from)} ${formatEuro(amountCents)} an ${personName(to)} überwiesen?`)) return;
  backend.add('payments', {
    from, to, amountCents,
    date: todayISO(),
    createdAt: backend.now(),
    createdBy: state.me,
    settlementId: null,
  }).catch(showError);
  toast('Als bezahlt abgehakt ✓');
}

function undoPayment(id) {
  const payment = state.payments.find((p) => p.id === id);
  if (payment) removeWithUndo('Überweisung entfernt', [{ col: 'payments', doc: payment }]);
}

function settleAll() {
  const expenses = activeExpenses();
  const payments = activePayments();
  const stillOpen = suggestTransfers(computeBalances(PERSON_IDS, expenses, payments), PERSON_IDS).length > 0;
  const question = stillOpen
    ? 'Achtung: Noch nicht alle Überweisungen sind abgehakt. Wenn ihr jetzt abrechnet, steht trotzdem alles wieder auf 0.\n\nTrotzdem abrechnen?'
    : 'Alles auf 0 setzen und neu starten? Die bisherigen Einträge bleiben unter „Frühere Abrechnungen“ sichtbar.';
  if (!confirm(question)) return;

  backend.settleAll(
    {
      createdAt: backend.now(),
      createdBy: state.me,
      expenseCount: expenses.length,
      totalCents: expenses.reduce((sum, e) => sum + e.amountCents, 0),
    },
    expenses.map((e) => e.id),
    payments.map((p) => p.id),
  ).catch(showError);
  toast('Abgerechnet – alles steht wieder auf 0 ✓');
}

// ---------- Klicks ----------

function onClick(event) {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  const { action } = el.dataset;
  switch (action) {
    case 'login': doLogin(); break;
    case 'logout': if (confirm('Abmelden?')) backend.logout(); break;
    case 'claim': claim(el.dataset.person); break;
    case 'tab': switchTab(el.dataset.tab); break;
    case 'add-expense': openExpenseForm(); break;
    case 'edit-expense': openExpenseForm(state.expenses.find((e) => e.id === el.dataset.id)); break;
    case 'close-form': el.closest('dialog').close(); break;
    case 'edit-areas': openAreasForm(); break;
    case 'add-area': addArea(); break;
    case 'remove-area': el.closest('.area-row').remove(); break;
    case 'shop-toggle': shopToggle(el.dataset.id); break;
    case 'shop-delete': shopDelete(el.dataset.id); break;
    case 'shop-clear': shopClear(); break;
    case 'quick-add': quickAdd(el.dataset.id); break;
    case 'chore-done-start': choreDoneThisWeek(el.dataset.id); break;
    case 'absence-new': openAbsenceForm(); break;
    case 'absence-delete': deleteAbsence(el.dataset.id); break;
    case 'poll-new': openPollForm(); break;
    case 'poll-add-option':
      if (document.querySelectorAll('#p-options .poll-input').length < 6) $('#p-options').insertAdjacentHTML('beforeend', pollOptionInput());
      break;
    case 'poll-yesno': $('#p-options').innerHTML = pollOptionInput('Ja') + pollOptionInput('Nein'); break;
    case 'poll-vote': votePoll(el.dataset.id, Number(el.dataset.index)); break;
    case 'poll-close': closePoll(el.dataset.id); break;
    case 'poll-delete': deletePoll(el.dataset.id); break;
    case 'search-open': openSearch(); break;
    case 'restore-open': $('#restore-file').click(); break;
    case 'shop-to-expense': shopToExpense(); break;
    case 'add-recurring': openExpenseForm(null, { mode: 'recurring' }); break;
    case 'edit-recurring': openExpenseForm(state.recurring.find((r) => r.id === el.dataset.id), { mode: 'recurring' }); break;
    case 'month': {
      const step = Number(el.dataset.step);
      state.monthOffset = step === 0 ? 0 : Math.min(0, state.monthOffset + step);
      renderAusgaben();
      break;
    }
    case 'note-new': openNoteForm(); break;
    case 'note-template': openNoteForm(null, NOTE_TEMPLATES[Number(el.dataset.index)]); break;
    case 'note-edit': openNoteForm(state.notes.find((n) => n.id === el.dataset.id)); break;
    case 'note-delete': deleteNote(); break;
    case 'note-copy': copyNote(el.dataset.id); break;
    case 'export-json': exportJson(); break;
    case 'export-csv': exportCsv(); break;
    case 'shop-category': openShopCategory(el.dataset.id); break;
    case 'shop-setcat': setShopCategory(el.dataset.cat); break;
    case 'quick-remove': quickRemove(el.dataset.id); break;
    case 'calendar-settings': openCalendarForm(); break;
    case 'calendar-reload': loadEvents(); break;
    case 'calendar-remove': removeCalendar(); break;
    case 'quick-edit': state.quickEdit = !state.quickEdit; renderEinkauf(); break;
    case 'delete-expense': deleteExpense(); break;
    case 'mark-paid': markPaid(el.dataset.from, el.dataset.to, Number(el.dataset.amount)); break;
    case 'undo-payment': undoPayment(el.dataset.id); break;
    case 'settle-all': settleAll(); break;
    case 'chore-done': choreDone(el.dataset.id); break;
    case 'chore-undo': choreUndo(el.dataset.id); break;
    case 'chore-take': choreTake(el.dataset.id); break;
    case 'chore-giveback': choreGiveBack(el.dataset.id); break;
    case 'week': {
      const step = Number(el.dataset.step);
      state.choreWeekOffset = step === 0 ? 0 : state.choreWeekOffset + step;
      renderPutzplan();
      break;
    }
    default: break;
  }
}

document.addEventListener('click', onClick);
$('#expense-form').addEventListener('submit', onSubmitExpense);
$('#expense-form').addEventListener('input', updateSplitHint);
$('#expense-form').addEventListener('change', updateSplitHint);
$('#areas-form').addEventListener('submit', onSubmitAreas);
$('#calendar-form').addEventListener('submit', onSubmitCalendar);
$('#note-form').addEventListener('submit', onSubmitNote);
$('#absence-form').addEventListener('submit', onSubmitAbsence);
$('#poll-form').addEventListener('submit', onSubmitPoll);
$('#search-input').addEventListener('input', renderSearch);
$('#restore-file').addEventListener('change', (event) => {
  const file = event.target.files[0];
  event.target.value = '';
  if (file) restoreBackup(file);
});
$('#toast-undo').addEventListener('click', () => {
  const undo = toastUndo;
  $('#toast').className = 'toast';
  toastUndo = null;
  undo?.();
});
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
updateOnline();
// Termine regelmäßig und beim Zurückkehren zur App neu laden.
setInterval(() => loadEvents(), 5 * 60 * 1000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - state.calendar.loadedAt > 60000) loadEvents();
});
$('#shop-form').addEventListener('submit', onSubmitShopping);
// Tippen neben ein Formular schließt es.
document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
}));

start();
