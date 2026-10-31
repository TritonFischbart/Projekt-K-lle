// Hauptprogramm: Anmeldung, Anzeige und Bedienung der Website.

// Die Nummer hinter ?v= bei jeder Änderung erhöhen (auch in index.html),
// damit Handys sofort die neuen Dateien laden statt alter gespeicherter.
import { PEOPLE, CATEGORIES, CHORES } from './config.js?v=9';
import { parseEuro, formatEuro, splitAmount, computeBalances, suggestTransfers } from './money.js?v=9';
import { mondayOf, addDays, isoWeek, weekKey, weekIndex, defaultAssignee } from './chores.js?v=9';
import { fetchEvents, groupByDay, newEventLink } from './calendar.js?v=9';
import { SHOP_CATEGORIES, guessCategory } from './shopcats.js?v=9';
import { firebaseConfig } from './firebase-config.js?v=9';

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
  calendar: { config: null, events: null, error: null, loading: false, loadedAt: 0 },
  tab: 'ausgaben',
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
function toast(message, isError = false) {
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast show${isError ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2800);
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
      backend = (await import('./demo.js?v=9')).createDemoBackend();
    } else if (configured) {
      backend = (await import('./firebase.js?v=9')).createFirebaseBackend(firebaseConfig);
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
  listen('expenses', (docs) => { state.expenses = docs; renderAll(); });
  listen('payments', (docs) => { state.payments = docs; renderAll(); });
  listen('settlements', (docs) => { state.settlements = docs; renderAll(); });
  listen('chores', (docs) => { state.chores = Object.fromEntries(docs.map((d) => [d.id, d])); renderAll(); });
  listen('settings', (docs) => {
    const plan = docs.find((d) => d.id === 'putzplan');
    state.areas = plan?.areas?.length ? plan.areas : null;
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
  document.querySelectorAll('.tabbar button').forEach((b) => {
    if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  $('.fab').hidden = tab !== 'ausgaben';
  if (tab !== 'putzplan') state.choreWeekOffset = 0;
  if (tab === 'kalender' && Date.now() - state.calendar.loadedAt > 60000) loadEvents();
  window.scrollTo(0, 0);
}

function renderAll() {
  if (!state.me) return;
  renderAusgaben();
  renderEinkauf();
  renderPutzplan();
  renderKalender();
  const open = myOpenChores().length;
  const tabButton = document.querySelector('.tabbar [data-tab=putzplan]');
  tabButton.classList.toggle('has-badge', open > 0);
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
    todayBanner(),
    choreBanner(),
    heroCard(balances[state.me]),
    balancesCard(balances),
    transfersCard(transfers, expenses.length + payments.length > 0),
    categoryCard(expenses),
    entriesCard(expenses, payments),
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
        <span class="amount ${amountClass(b)}">${b === 0 ? '–' : formatEuro(Math.abs(b))}</span>
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

function categoryCard(expenses) {
  if (!expenses.length) return '';
  const totals = {};
  for (const e of expenses) totals[categoryOf(e.category).id] = (totals[categoryOf(e.category).id] ?? 0) + e.amountCents;
  const sum = Object.values(totals).reduce((a, b) => a + b, 0);
  const max = Math.max(...Object.values(totals));
  const bars = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([id, cents]) => {
      const c = categoryOf(id);
      return `
        <li>
          <div class="bar-label"><span>${c.icon} ${esc(c.name)}</span><span class="amount">${formatEuro(cents)}</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, (cents / max) * 100)}%"></div></div>
        </li>`;
    }).join('');
  return `
    <section class="card">
      <div class="card-head"><h2>Nach Kategorie</h2><span class="total">gesamt ${formatEuro(sum)}</span></div>
      <ul class="bars">${bars}</ul>
    </section>`;
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
      <span class="entry-title">${esc(e.description)}</span>
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
  return `<section class="card"><h2>Einträge</h2>${body}</section>`;
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
  return choreAreas().map((chore, i) => {
    const docId = `${key}_${chore.id}`;
    const saved = state.chores[docId];
    const planned = defaultAssignee(PERSON_IDS, i, idx);
    return {
      chore,
      docId,
      week: key,
      planned,
      assignee: saved?.assignee ?? planned,
      doneBy: saved?.doneBy ?? null,
      saved,
    };
  });
}

const thisMonday = () => mondayOf(new Date());
const myOpenChores = () => weekChores(thisMonday()).filter((c) => c.assignee === state.me && !c.doneBy);

function choreBanner() {
  const open = myOpenChores();
  if (!open.length) return '';
  return `
    <button class="card banner" data-action="tab" data-tab="putzplan">
      <span class="banner-icon" aria-hidden="true">${open[0].chore.icon}</span>
      <span class="banner-text">Diese Woche bist du dran mit:<strong>${open.map((c) => esc(c.chore.name)).join(' & ')}</strong></span>
      <span class="banner-arrow" aria-hidden="true">›</span>
    </button>`;
}

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
      <span>${mine ? 'Du' : esc(personName(c.assignee))}${swapped ? ` <em>(übernommen von ${esc(personName(c.planned))})</em>` : ''}</span>
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
              <span class="shop-name">${esc(i.name)}</span>
              <span class="shop-meta">${esc(personName(i.addedBy))}</span>
            </button>
            <button class="icon-btn small" data-action="shop-category" data-id="${esc(i.id)}" aria-label="Kategorie von ${esc(i.name)} ändern">${g.cat.icon}</button>
            <button class="icon-btn small" data-action="shop-delete" data-id="${esc(i.id)}" aria-label="${esc(i.name)} löschen">✕</button>
          </li>`).join('')}</ul>`).join('')}
       <p class="hint">Antippen, wenn du es besorgt hast. Falsche Kategorie? Tippe auf das Symbol rechts.</p>`
    : '<p class="empty">Alles da! Nichts auf der Liste. 🎉</p>';

  const doneCard = done.length ? `
    <section class="card">
      <div class="card-head"><h2>Besorgt</h2><button class="link-btn" data-action="shop-clear">Liste aufräumen</button></div>
      <ul class="shop">${done.map((i) => `
        <li class="shop-row">
          <button class="shop-item done" data-action="shop-toggle" data-id="${esc(i.id)}">
            <span class="shop-check" aria-hidden="true">✓</span>
            <span class="shop-name">${esc(i.name)}</span>
            <span class="shop-meta">von ${esc(personName(i.doneBy))}</span>
          </button>
        </li>`).join('')}</ul>
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

function addShoppingItems(names) {
  const onList = openShoppingNames();
  const fresh = [...new Set(names)].filter((n) => !onList.has(n.toLowerCase()));
  fresh.forEach((name) => {
    const id = favoriteId(name);
    const known = state.favorites.find((f) => f.id === id);
    const category = known?.category ?? guessCategory(name);
    backend.add('shopping', { name: known?.name ?? name, category, addedBy: state.me, createdAt: backend.now(), doneBy: null, doneAt: null }).catch(showError);
    // Mitzählen, wie oft etwas gebraucht wird (und in welcher Kategorie).
    backend.set('favorites', id, {
      name: known?.name ?? name,
      count: (known?.count ?? 0) + 1,
      category,
      lastUsed: backend.now(),
    }).catch(showError);
  });
  if (fresh.length < names.length) toast('Steht schon auf der Liste');
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
  if (fav) addShoppingItems([fav.name]);
}

function quickRemove(id) {
  const fav = state.favorites.find((f) => f.id === id);
  if (fav && confirm(`„${fav.name}“ aus der Schnellauswahl entfernen?`)) backend.remove('favorites', id).catch(showError);
}

function shopToggle(id) {
  const item = state.shopping.find((i) => i.id === id);
  if (!item) return;
  backend.update('shopping', id, item.doneBy
    ? { doneBy: null, doneAt: null }
    : { doneBy: state.me, doneAt: backend.now() }).catch(showError);
}

function shopDelete(id) {
  backend.remove('shopping', id).catch(showError);
}

function shopClear() {
  const done = state.shopping.filter((i) => i.doneBy);
  if (!confirm(`${done.length} besorgte Sachen von der Liste entfernen?`)) return;
  done.forEach((i) => backend.remove('shopping', i.id).catch(showError));
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

function todayEvents() {
  const groups = groupByDay(state.calendar.events ?? []);
  return groups.length && sameDay(groups[0].day, new Date()) ? groups[0].events : [];
}

function todayBanner() {
  const events = todayEvents();
  if (!events.length) return '';
  const text = events.slice(0, 3)
    .map((e) => `${esc(e.title)}${e.allDay ? '' : ` · ${timeOf(e.start)}`}`).join('<br>');
  return `
    <button class="card banner" data-action="tab" data-tab="kalender">
      <span class="banner-icon" aria-hidden="true">📅</span>
      <span class="banner-text">Heute in der WG:<strong>${text}</strong></span>
      <span class="banner-arrow" aria-hidden="true">›</span>
    </button>`;
}

function renderKalender() {
  const cal = state.calendar;
  const el = $('#tab-kalender');
  if (!cal.config) {
    el.innerHTML = `
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

  el.innerHTML = `
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

// ---------- Formular ----------

function chip(name, type, value, label, checked) {
  return `<label class="chip"><input type="${type}" name="${name}" value="${esc(value)}"${checked ? ' checked' : ''}><span>${esc(label)}</span></label>`;
}

function openExpenseForm(expense) {
  if (expense?.settlementId) {
    toast('Abgerechnete Einträge können nicht mehr geändert werden.');
    return;
  }
  state.editingId = expense?.id ?? null;
  $('#form-title').textContent = expense ? 'Ausgabe bearbeiten' : 'Neue Ausgabe';
  $('#f-amount').value = expense ? (expense.amountCents / 100).toFixed(2).replace('.', ',') : '';
  $('#f-desc').value = expense?.description ?? '';
  $('#f-date').value = expense?.date ?? todayISO();

  const category = expense?.category ?? CATEGORIES[0].id;
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
  const saving = id
    ? backend.update('expenses', id, { ...data, updatedAt: backend.now(), updatedBy: state.me })
    : backend.add('expenses', { ...data, createdAt: backend.now(), createdBy: state.me, settlementId: null });
  saving.catch(showError);
  $('#expense-dialog').close();
  toast(id ? 'Änderung gespeichert ✓' : 'Ausgabe eingetragen ✓');
}

function deleteExpense() {
  const id = state.editingId;
  if (!id || !confirm('Diese Ausgabe wirklich löschen?')) return;
  backend.remove('expenses', id).catch(showError);
  $('#expense-dialog').close();
  toast('Ausgabe gelöscht');
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
  if (!confirm('Diese Überweisung wieder entfernen?')) return;
  backend.remove('payments', id).catch(showError);
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
