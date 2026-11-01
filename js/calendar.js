// Termine aus dem gemeinsamen Google-Kalender abholen und nach Tagen sortieren.

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// "2026-11-07" -> 7. November, 0 Uhr (Ortszeit)
function localDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function eventsUrl(calendarId, apiKey, from, to, pageToken = '') {
  const params = new URLSearchParams({
    key: apiKey,
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  if (pageToken) params.set('pageToken', pageToken);
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
}

export function normalizeEvent(item) {
  const allDay = Boolean(item.start?.date);
  const start = allDay ? localDate(item.start.date) : new Date(item.start?.dateTime);
  const end = allDay
    ? localDate(item.end?.date ?? item.start.date)
    : new Date(item.end?.dateTime ?? item.start?.dateTime);
  return {
    id: item.id,
    // Ohne Titel: entweder wirklich leer oder Google gibt ihn nicht heraus
    // (Kalender nur als "frei/belegt" freigegeben oder Termin auf "privat").
    title: item.summary || 'Titel nicht sichtbar',
    hiddenTitle: !item.summary,
    location: item.location || '',
    allDay,
    start,
    end,
    link: item.htmlLink || '',
  };
}

// Gruppiert Termine nach Tag. Termine, die schon vor heute begonnen haben
// und noch laufen, erscheinen unter "heute".
export function groupByDay(events, now = new Date()) {
  const today = startOfDay(now);
  const groups = new Map();
  for (const e of events) {
    if (e.end <= today) continue;
    const day = e.start < today ? today : startOfDay(e.start);
    const key = day.getTime();
    if (!groups.has(key)) groups.set(key, { day, events: [] });
    groups.get(key).events.push(e);
  }
  const groupsSorted = [...groups.values()].sort((a, b) => a.day - b.day);
  // Ganztägige Termine zuerst, dann nach Uhrzeit.
  groupsSorted.forEach((g) => g.events.sort((a, b) => (b.allDay - a.allDay) || (a.start - b.start)));
  return groupsSorted;
}

// Termine der nächsten 12 Monate (bei sehr vielen Terminen in mehreren Portionen).
export const CALENDAR_DAYS = 366;

export async function fetchEvents({ calendarId, apiKey }, days = CALENDAR_DAYS) {
  const from = startOfDay(new Date());
  const to = addDays(from, days);
  const items = [];
  let pageToken = '';
  for (let page = 0; page < 4; page += 1) {
    const response = await fetch(eventsUrl(calendarId, apiKey, from, to, pageToken));
    if (!response.ok) {
      const err = new Error(`Google antwortet mit Fehler ${response.status}`);
      err.status = response.status;
      throw err;
    }
    const data = await response.json();
    items.push(...(data.items ?? []));
    pageToken = data.nextPageToken ?? '';
    if (!pageToken) break;
  }
  return items.filter((i) => i.status !== 'cancelled').map(normalizeEvent);
}

// Link, um in Google Kalender einen neuen Termin anzulegen.
export function newEventLink(calendarId) {
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&src=${encodeURIComponent(calendarId)}`;
}
