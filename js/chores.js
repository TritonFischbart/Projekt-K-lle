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
