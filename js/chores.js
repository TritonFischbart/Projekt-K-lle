// Rechnen mit Wochen für den Putzplan.
// Eine Woche geht von Montag bis Sonntag. Jede Woche rücken die Aufgaben eine Person weiter.

const DAY = 86400000;
const EPOCH = Date.UTC(2026, 0, 5); // ein Montag, ab dem gezählt wird

export function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Kalenderwoche nach ISO-Norm (wie in deutschen Kalendern).
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return { year: d.getUTCFullYear(), week: Math.ceil(((d - yearStart) / DAY + 1) / 7) };
}

export function weekKey(date) {
  const { year, week } = isoWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function weekIndex(monday) {
  return Math.round((Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()) - EPOCH) / (7 * DAY));
}

// Wer ist laut Plan für Aufgabe Nummer `choreIndex` in Woche `weekIdx` dran?
export function defaultAssignee(peopleIds, choreIndex, weekIdx) {
  const n = peopleIds.length;
  return peopleIds[(((choreIndex + weekIdx) % n) + n) % n];
}

