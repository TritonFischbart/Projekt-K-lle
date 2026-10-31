// Daueraufträge: Ausgaben, die jeden Monat automatisch eingetragen werden.
// Monate werden als "2026-11" geschrieben.

export function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
}

// Beim Anlegen: Ist der Tag in diesem Monat schon vorbei, wird erst ab nächstem Monat gebucht.
export function initialLastBooked(dayOfMonth, today = new Date()) {
  const current = monthKey(today);
  return today.getDate() >= dayOfMonth ? current : addMonths(current, -1);
}

// Welche Monate müssen noch eingetragen werden? (höchstens 12 auf einmal)
export function dueMonths(rec, today = new Date()) {
  const current = monthKey(today);
  const due = [];
  let month = addMonths(rec.lastBooked, 1);
  while (month <= current && due.length < 12) {
    if (month < current || today.getDate() >= rec.dayOfMonth) due.push(month);
    month = addMonths(month, 1);
  }
  return due;
}

// Feste ID pro Auftrag und Monat: so wird nichts doppelt eingetragen,
// auch wenn zwei Handys gleichzeitig die App öffnen.
export const recurringExpenseId = (recId, month) => `rec_${recId}_${month}`;
