export const TZ = 'America/New_York';

function offsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - utcMs;
}

/** Converts an Eastern-time wall clock to a real Date. month is 1-12. */
export function easternToDate(y: number, m: number, d: number, h = 0, mi = 0, s = 0): Date {
  const guess = Date.UTC(y, m - 1, d, h, mi, s);
  let ts = guess - offsetMs(guess);
  ts = guess - offsetMs(ts);
  return new Date(ts);
}

/** "2026-11-06T09:30" style string (Eastern) -> Date */
export function parseEasternLocal(v: string): Date {
  const [date, time = '00:00'] = v.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return easternToDate(y, m, d, h, mi);
}

/** Date -> "2026-11-06T09:30" in Eastern (for datetime-local inputs) */
export function toEasternLocal(date: Date): string {
  const p = easternParts(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function easternParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { year: +get('year'), month: +get('month'), day: +get('day'), hour: +get('hour'), minute: +get('minute'), weekday: wd };
}

export function easternToday(date = new Date()): string {
  const p = easternParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/**
 * The standard weekly schedule: opens Wednesday 12:00am, closes the following
 * Monday 11:59pm, pickup that Saturday. Returns the current window, or the
 * next one if we are on a Tuesday (between drops).
 */
export function standardDropFor(date = new Date(), weeksAhead = 0) {
  const p = easternParts(date);
  const today = easternToday(date);
  // days since the most recent Wednesday (Wed=3)
  const since = (p.weekday - 3 + 7) % 7;
  let wed = addDays(today, -since);
  // Tuesday: last window closed Monday night, so move to tomorrow's Wednesday
  if (p.weekday === 2) wed = addDays(today, 1);
  wed = addDays(wed, 7 * weeksAhead);
  const mon = addDays(wed, 5);
  const sat = addDays(wed, 10);
  const [wy, wm, wdd] = wed.split('-').map(Number);
  const [my, mm, md] = mon.split('-').map(Number);
  return {
    opens_at: easternToDate(wy, wm, wdd, 0, 0),
    closes_at: easternToDate(my, mm, md, 23, 59, 59),
    pickup_date: sat,
  };
}

export function fmtDateTime(d: Date | string) {
  return new Date(d).toLocaleString('en-US', {
    timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function fmtPickupDate(ymd: string, long = false) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', {
    timeZone: 'UTC', weekday: long ? 'long' : 'short', month: long ? 'long' : 'short', day: 'numeric',
  });
}

/** "Wednesday, November 18 at 12:00 AM" */
export function fmtOpening(d: Date | string) {
  const x = new Date(d);
  const day = x.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric' });
  const time = x.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
  return `${day} at ${time}`;
}
