// Datensicherung: Daten als Datei speichern.

// Firestore-Zeitstempel und Datumswerte in lesbaren Text umwandeln.
export function toPlain(value) {
  if (value == null) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]));
  return value;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Tabelle für Excel (deutsches Format: Semikolon, Komma als Dezimalzeichen).
export function expensesCsv(expenses, { personName, categoryName }) {
  const header = ['Datum', 'Beschreibung', 'Kategorie', 'Betrag (€)', 'Bezahlt von', 'Für', 'Abgerechnet'];
  const rows = [...expenses]
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .map((e) => [
      e.date,
      e.description,
      categoryName(e.category),
      (e.amountCents / 100).toFixed(2).replace('.', ','),
      personName(e.paidBy),
      e.shares
        ? Object.entries(e.shares).map(([id, cents]) => `${personName(id)} ${(cents / 100).toFixed(2).replace('.', ',')}`).join(', ')
        : (e.splitAmong ?? []).map(personName).join(', '),
      e.settlementId ? 'ja' : 'nein',
    ]);
  // ﻿ am Anfang, damit Excel Umlaute richtig anzeigt.
  return `﻿${[header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n')}`;
}
