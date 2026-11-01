// Push-Nachrichten: WER bekommt WAS. Reine Logik ohne Firebase, damit sie testbar ist.
// Die Dateien in ./shared werden beim Bereitstellen aus /js kopiert (gleiche Regeln wie in der App).

import { PEOPLE, CHORES, PUSH_TYPES as TYPE_LIST } from './shared/config.js';
import { planWeek, mondayOf, weekKey, weekIndex } from './shared/chores.js';
import { isAwayForWeek } from './shared/absences.js';
import { expenseShares, formatEuro } from './shared/money.js';

export const PERSON_IDS = PEOPLE.map((p) => p.id);
export const personName = (id) => PEOPLE.find((p) => p.id === id)?.name ?? 'Jemand';

// Nachrichtenarten mit Standardwert (Liste in js/config.js, gemeinsam mit der App)
export const PUSH_TYPES = Object.fromEntries(TYPE_LIST.map((t) => [t.id, t.default]));

export function wants(settings, person, type) {
  return settings?.[person]?.types?.[type] ?? PUSH_TYPES[type] ?? false;
}

const others = (person) => PERSON_IDS.filter((id) => id !== person);

function inviteWhen(at, now = new Date()) {
  if (!at) return 'jetzt';
  const d = new Date(at);
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return sameDay ? `heute ${time}` : d.toDateString() === tomorrow.toDateString() ? `morgen ${time}` : time;
}

// ---------- Ereignisse ----------

export function inviteMessages(inv, now = new Date()) {
  return others(inv.createdBy).map((person) => ({
    person,
    type: 'invites',
    title: `${inv.emoji || '🙋'} ${personName(inv.createdBy)}: ${inv.title}`,
    body: [inviteWhen(inv.at, now), inv.note].filter(Boolean).join(' · ') + ' – bist du dabei?',
  }));
}

export function pollMessages(poll) {
  return others(poll.createdBy).map((person) => ({
    person,
    type: 'polls',
    title: `🗳️ ${personName(poll.createdBy)} fragt: ${poll.question}`,
    body: `Antworten: ${(poll.options ?? []).join(' / ')}`,
  }));
}

export function expenseMessages(expense) {
  // Automatisch gebuchte Daueraufträge nicht melden (sonst jeden Monat Nachrichten)
  if (!expense || expense.createdBy === 'auto') return [];
  const shares = expenseShares(expense, PERSON_IDS);
  return Object.entries(shares)
    .filter(([person, cents]) => cents > 0 && person !== expense.createdBy)
    .map(([person, cents]) => ({
      person,
      type: 'expenses',
      title: `💶 ${personName(expense.paidBy)} hat „${expense.description}“ eingetragen`,
      body: `${formatEuro(expense.amountCents)} – dein Anteil ${formatEuro(cents)}`,
    }));
}

// ---------- Putzplan ----------

// Wie in der App (weekChores): fällige Bereiche, Abwesenheiten, Tausch und Erledigt.
export function weekChores({ areas, absences = [], chores = {} }, monday) {
  const key = weekKey(monday);
  const present = PERSON_IDS.filter((id) => !isAwayForWeek(absences, id, monday));
  return planWeek(PERSON_IDS, present, areas?.length ? areas : CHORES, weekIndex(monday)).map(({ area, planned }) => {
    const saved = chores[`${key}_${area.id}`];
    return { area, assignee: saved?.assignee ?? planned, doneBy: saved?.doneBy ?? null };
  });
}

const list = (items) => items.map((c) => `${c.area.icon} ${c.area.name}`).join(', ');

// Montag: "Diese Woche bist du dran mit …"
export function choreWeekStartMessages(data, now = new Date()) {
  const week = weekChores(data, mondayOf(now));
  return PERSON_IDS
    .map((person) => ({ person, mine: week.filter((c) => c.assignee === person) }))
    .filter(({ mine }) => mine.length)
    .map(({ person, mine }) => ({
      person,
      type: 'chores',
      title: '🧹 Neue Putzwoche',
      body: `Diese Woche bist du dran mit: ${list(mine)}`,
    }));
}

// Sonntag: nur, wenn noch etwas offen ist
export function choreReminderMessages(data, now = new Date()) {
  const week = weekChores(data, mondayOf(now));
  return PERSON_IDS
    .map((person) => ({ person, open: week.filter((c) => c.assignee === person && !c.doneBy) }))
    .filter(({ open }) => open.length)
    .map(({ person, open }) => ({
      person,
      type: 'chores',
      title: '🧹 Noch offen diese Woche',
      body: `${list(open)} – heute ist der letzte Tag. Schon erledigt? Dann kurz abhaken.`,
    }));
}

// ---------- Kalender & Einkauf ----------

export function calendarMessages(todayEvents) {
  if (!todayEvents?.length) return [];
  const text = todayEvents.slice(0, 4).map((e) => (e.allDay ? e.title : `${e.title} (${e.start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })})`)).join(', ');
  return PERSON_IDS.map((person) => ({ person, type: 'calendar', title: '📅 Heute in der WG', body: text }));
}

export function shoppingMessages(openItems) {
  if (!openItems?.length) return [];
  const names = openItems.slice(0, 6).map((i) => (i.amount ? `${i.amount} ${i.name}` : i.name)).join(', ');
  const more = openItems.length > 6 ? ` und ${openItems.length - 6} mehr` : '';
  return PERSON_IDS.map((person) => ({
    person,
    type: 'shopping',
    title: `🛒 ${openItems.length} ${openItems.length === 1 ? 'Sache fehlt' : 'Sachen fehlen'}`,
    body: `${names}${more}`,
  }));
}

// Welche Aufgaben stehen zu dieser Stunde an? (ein stündlicher Lauf erledigt alles)
export function dueJobs(now = new Date()) {
  const day = now.getDay(); // 0 = Sonntag, 1 = Montag
  const hour = now.getHours();
  const jobs = [];
  if (day === 1 && hour === 9) jobs.push('choreWeekStart');
  if (day === 0 && hour === 18) jobs.push('choreReminder');
  if (hour === 8) jobs.push('calendar');
  if (hour === 19) jobs.push('shopping');
  return jobs;
}
