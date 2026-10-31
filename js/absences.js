// Urlaubs-Modus: Wer ist wann nicht da?
// Abwesenheiten: { person, from: "2026-11-10", to: "2026-11-20", note }

const DAY = 86400000;
const dayNumber = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
};
const isoOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// An wie vielen Tagen der Woche (ab `monday`) ist die Person weg?
export function awayDaysInWeek(absences, person, monday) {
  const start = dayNumber(isoOf(monday));
  const days = new Set();
  for (const a of absences) {
    if (a.person !== person) continue;
    const from = Math.max(dayNumber(a.from), start);
    const to = Math.min(dayNumber(a.to), start + 6);
    for (let d = from; d <= to; d += 1) days.add(d);
  }
  return days.size;
}

// Ab 4 Tagen Abwesenheit bekommt die Person in dieser Woche keine Putzaufgabe.
export const isAwayForWeek = (absences, person, monday) => awayDaysInWeek(absences, person, monday) >= 4;

export function isAwayOn(absences, person, date = new Date()) {
  const day = isoOf(date);
  return absences.some((a) => a.person === person && a.from <= day && day <= a.to);
}

// Aktuelle und kommende Abwesenheiten (bereits vergangene fallen weg), sortiert nach Beginn.
export function upcomingAbsences(absences, today = new Date()) {
  const day = isoOf(today);
  return absences.filter((a) => a.to >= day).sort((a, b) => a.from.localeCompare(b.from));
}
