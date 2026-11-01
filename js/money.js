// Rechnen mit Geld. Alle Beträge sind in Cent (ganze Zahlen),
// damit beim Teilen keine Rundungsfehler entstehen.

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export function formatEuro(cents) {
  return euro.format(cents / 100);
}

// "12,50", "12.5" oder "12 €" -> 1250. Ungültige Eingaben -> null.
export function parseEuro(input) {
  const text = String(input ?? '').replace(/\s|€/g, '');
  if (!/^\d{1,6}([.,]\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(parseFloat(text.replace(',', '.')) * 100);
  return cents > 0 ? cents : null;
}

// Teilt einen Betrag gleichmäßig. Übrige Cents gehen der Reihe nach
// an die ersten Personen (in der Reihenfolge von `order`).
export function splitAmount(amountCents, ids, order = ids) {
  const sorted = order.filter((id) => ids.includes(id));
  const shares = {};
  if (!sorted.length) return shares;
  const base = Math.floor(amountCents / sorted.length);
  let rest = amountCents - base * sorted.length;
  for (const id of sorted) {
    shares[id] = base + (rest > 0 ? 1 : 0);
    rest -= 1;
  }
  return shares;
}

// Anteile einer Ausgabe: bei "ungleich aufteilen" die gespeicherten Beträge
// (wenn sie genau aufgehen), sonst gleichmäßig auf alle in splitAmong.
export function expenseShares(expense, order) {
  const ids = expense.splitAmong ?? [];
  const custom = expense.shares;
  if (custom) {
    const entries = order.filter((id) => ids.includes(id) && custom[id] > 0).map((id) => [id, custom[id]]);
    const sum = entries.reduce((total, [, cents]) => total + cents, 0);
    if (entries.length && sum === expense.amountCents) return Object.fromEntries(entries);
  }
  return splitAmount(expense.amountCents, ids, order);
}

// Aufteilen nach Posten (Kassenbon): Jeder Posten wird gleich auf seine Personen verteilt.
// Erst am Ende wird auf ganze Cent gerundet – übrige Cent bekommt, wer am knappsten
// abgerundet wurde. So ergibt die Summe immer genau den Gesamtbetrag.
// items: [{ cents, for: [personIds] }]
export function itemShares(items, order) {
  const exact = Object.fromEntries(order.map((id) => [id, 0]));
  let total = 0;
  for (const item of items) {
    const ids = order.filter((id) => (item.for ?? []).includes(id));
    if (!ids.length || !(item.cents > 0)) continue;
    total += item.cents;
    for (const id of ids) exact[id] += item.cents / ids.length;
  }
  const shares = Object.fromEntries(order.map((id) => [id, Math.floor(exact[id] + 1e-9)]));
  let rest = total - order.reduce((sum, id) => sum + shares[id], 0);
  const byRemainder = [...order].sort((a, b) => (exact[b] - shares[b]) - (exact[a] - shares[a]));
  for (const id of byRemainder) {
    if (rest <= 0) break;
    if (exact[id] - shares[id] > 1e-9) { shares[id] += 1; rest -= 1; }
  }
  return Object.fromEntries(order.filter((id) => shares[id] > 0).map((id) => [id, shares[id]]));
}

// Kontostand pro Person: positiv = bekommt Geld, negativ = schuldet Geld.
export function computeBalances(peopleIds, expenses, payments) {
  const balances = Object.fromEntries(peopleIds.map((id) => [id, 0]));
  for (const e of expenses) {
    if (!(e.paidBy in balances)) continue;
    const shares = expenseShares(e, peopleIds);
    if (!Object.keys(shares).length) continue;
    balances[e.paidBy] += e.amountCents;
    for (const [id, share] of Object.entries(shares)) balances[id] -= share;
  }
  for (const p of payments) {
    if (!(p.from in balances) || !(p.to in balances)) continue;
    balances[p.from] += p.amountCents;
    balances[p.to] -= p.amountCents;
  }
  return balances;
}

// Möglichst wenige Überweisungen: Wer am meisten schuldet, zahlt an den,
// der am meisten bekommt – so lange, bis alle bei 0 sind.
export function suggestTransfers(balances, order = Object.keys(balances)) {
  const debtors = order.filter((id) => balances[id] < 0).map((id) => ({ id, amount: -balances[id] }));
  const creditors = order.filter((id) => balances[id] > 0).map((id) => ({ id, amount: balances[id] }));
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  while (debtors.length && creditors.length) {
    const d = debtors[0];
    const c = creditors[0];
    const amount = Math.min(d.amount, c.amount);
    transfers.push({ from: d.id, to: c.id, amountCents: amount });
    d.amount -= amount;
    c.amount -= amount;
    if (d.amount === 0) debtors.shift();
    if (c.amount === 0) creditors.shift();
  }
  return transfers;
}
