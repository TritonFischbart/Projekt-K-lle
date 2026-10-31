// Die WG-Mitglieder und die Kategorien für Ausgaben.
// Hier kannst du Namen, Farben oder Kategorien ändern.

export const PEOPLE = [
  { id: 'jana', name: 'Jana', color: '#a97b50' },
  { id: 'julian', name: 'Jul', color: '#2b6cb0' },
  { id: 'lukas', name: 'Lukas', color: '#2f7d4f' },
];

export const CATEGORIES = [
  { id: 'lebensmittel', name: 'Lebensmittel', icon: '🛒' },
  { id: 'haushalt', name: 'Haushalt', icon: '🧽' },
  { id: 'nebenkosten', name: 'Internet & Strom', icon: '💡' },
  { id: 'freizeit', name: 'Freizeit', icon: '🎉' },
  { id: 'sonstiges', name: 'Sonstiges', icon: '📦' },
];

// Die Bereiche im Putzplan. Jede Woche rücken sie eine Person weiter.
export const CHORES = [
  { id: 'bad', name: 'Bad', icon: '🛁', details: 'Toilette, Waschbecken, Dusche, Spiegel' },
  { id: 'kueche', name: 'Küche', icon: '🍳', details: 'Arbeitsflächen, Herd, Spüle, Kühlschrank checken' },
  { id: 'boeden', name: 'Böden & Müll', icon: '🧹', details: 'Saugen & Wischen in Flur und Gemeinschaftsräumen, Müll & Altglas raus' },
];
