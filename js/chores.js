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


// Passendes Symbol zum Namen eines Putzbereichs ("Müll" -> 🗑️, "Altglas" -> 🍾).
// Kommen mehrere Stichwörter vor, zählt das, was zuerst im Namen steht.
const AREA_ICONS = [
  ['altglas', '🍾'], ['glas', '🍾'], ['flaschen', '🍾'], ['pfand', '🍾'],
  ['altpapier', '📦'], ['papier', '📦'], ['karton', '📦'],
  ['gelber sack', '♻️'], ['gelbe tonne', '♻️'], ['plastik', '♻️'], ['wertstoff', '♻️'], ['recycling', '♻️'],
  ['müll', '🗑️'], ['abfall', '🗑️'], ['bio', '🗑️'],
  ['bad', '🛁'], ['dusche', '🚿'], ['toilette', '🚽'], ['klo', '🚽'], ['wc', '🚽'],
  ['küche', '🍳'], ['herd', '🍳'], ['spülmaschine', '🍽️'], ['geschirr', '🍽️'], ['abwasch', '🍽️'],
  ['kühlschrank', '❄️'],
  ['böden', '🧹'], ['boden', '🧹'], ['saugen', '🧹'], ['wischen', '🧹'], ['flur', '🧹'], ['treppe', '🧹'],
  ['fenster', '🪟'], ['wäsche', '🧺'], ['handtücher', '🧺'],
  ['pflanzen', '🪴'], ['blumen', '🪴'], ['gießen', '🪴'],
  ['balkon', '🌿'], ['terrasse', '🌿'], ['einkauf', '🛒'], ['staub', '🪶'],
];

export const DEFAULT_AREA_ICON = '🧽';

export function guessAreaIcon(name) {
  const text = String(name ?? '').toLowerCase();
  let best = null;
  for (const [word, icon] of AREA_ICONS) {
    const at = text.indexOf(word);
    if (at >= 0 && (!best || at < best.at || (at === best.at && word.length > best.length))) {
      best = { at, length: word.length, icon };
    }
  }
  return best?.icon ?? DEFAULT_AREA_ICON;
}

// Auswahl zum Antippen im Bearbeiten-Fenster
export const AREA_ICON_CHOICES = ['🛁', '🚿', '🚽', '🍳', '🍽️', '❄️', '🧹', '🧽', '🧼', '🪣', '🗑️', '♻️', '🍾', '📦', '🪟', '🧺', '🪴', '🌿', '🛒', '🪶', '🛏️', '🚪', '🐾', '✨'];

// ---------- Häufigkeit und gerechte Verteilung ----------

// every: 1 = jede Woche, 2 = alle 2 Wochen, 4 = alle 4 Wochen.
// Die Bereiche werden über die Wochen verteilt (Bereich 1 in geraden, Bereich 2 in ungeraden …),
// damit nicht alle seltenen Aufgaben in dieselbe Woche fallen.
export function isDueInWeek(every, areaIndex, weekIdx) {
  const n = Math.max(1, Number(every) || 1);
  return (((weekIdx - areaIndex) % n) + n) % n === 0;
}

// In wie vielen Wochen ist der Bereich wieder dran? (0 = diese Woche)
export function weeksUntilDue(every, areaIndex, weekIdx) {
  for (let d = 0; d < 8; d += 1) if (isDueInWeek(every, areaIndex, weekIdx + d)) return d;
  return 0;
}

// Plan einer Woche: nur fällige Bereiche, der Reihe nach auf die Anwesenden verteilt.
// So hat jede Person höchstens eine Aufgabe mehr als die anderen, und wer
// "die Extra-Aufgabe" bekommt, wechselt jede Woche.
// Ergebnis: [{ area, index, planned, base }] – base = wer ohne Abwesenheiten dran wäre.
export function planWeek(peopleIds, presentIds, areas, weekIdx) {
  const pool = presentIds.length ? presentIds : peopleIds;
  const mod = (a, n) => ((a % n) + n) % n;
  return areas
    .map((area, index) => ({ area, index }))
    .filter(({ area, index }) => isDueInWeek(area.every, index, weekIdx))
    .map((item, k) => {
      const base = peopleIds[mod(weekIdx + k, peopleIds.length)];
      const planned = pool.length === peopleIds.length ? base : pool[mod(weekIdx + k, pool.length)];
      return { ...item, base, planned };
    });
}
