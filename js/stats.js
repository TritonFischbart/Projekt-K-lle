// Auswertungen: Monatsübersicht der Ausgaben und Putz-Statistik.

import { monthKey, addMonths } from './recurring.js?v=10';

export function monthStats(expenses, month) {
  const inMonth = expenses.filter((e) => (e.date ?? '').startsWith(month));
  const byCategory = {};
  const byPayer = {};
  let total = 0;
  for (const e of inMonth) {
    total += e.amountCents;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amountCents;
    byPayer[e.paidBy] = (byPayer[e.paidBy] ?? 0) + e.amountCents;
  }
  return { month, total, count: inMonth.length, byCategory, byPayer };
}

// Summen der letzten `n` Monate bis einschließlich `month`.
export function monthTrend(expenses, month, n = 6) {
  return Array.from({ length: n }, (_, i) => {
    const m = addMonths(month, i - n + 1);
    return { month: m, total: monthStats(expenses, m).total };
  });
}

export const currentMonth = () => monthKey(new Date());

// Wer hat wie oft geputzt bzw. übernommen?
// chores: gespeicherte Wochen-Einträge; planned(doc) liefert, wer laut Plan dran war.
export function choreStats(peopleIds, chores, planned) {
  const stats = Object.fromEntries(peopleIds.map((id) => [id, { done: 0, taken: 0 }]));
  for (const c of chores) {
    if (c.doneBy && stats[c.doneBy]) stats[c.doneBy].done += 1;
    const plan = planned(c);
    if (plan && c.assignee && c.assignee !== plan && stats[c.assignee]) stats[c.assignee].taken += 1;
  }
  return stats;
}
