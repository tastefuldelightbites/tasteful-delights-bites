import { query, transaction } from './db';
import { ensureSchema } from './migrate';
import { getSettings, type Weekly } from './settings';
import { addDays, easternParts, easternToDate, easternToday } from './time';

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type Window = { opens_at: Date; closes_at: Date; pickup_date: string };

function at(ymd: string, hhmm: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  // "11:59" means the very end of that minute.
  return easternToDate(y, m, d, h, mi, mi === 59 ? 59 : 0);
}

/**
 * The weekly order windows, starting with the one before this week.
 * Example (default schedule): orders open Wed Nov 11 12:00 AM, close Sun Nov 15
 * 11:59 PM, and are picked up the following Saturday, Nov 21.
 */
export function weeklyWindows(w: Weekly, count = 7, now = new Date()): Window[] {
  const today = easternToday(now);
  const wd = easternParts(now).weekday;
  const back = (wd - w.open_day + 7) % 7;
  const firstOpen = addDays(today, -back - 7);
  let closeOffset = (w.close_day - w.open_day + 7) % 7;
  if (closeOffset === 0 && w.close_time <= w.open_time) closeOffset = 7;
  const pickupOffset = (w.pickup_day - w.close_day + 7) % 7 || 7; // the pickup day *after* ordering closes
  const out: Window[] = [];
  for (let k = 0; k < count + 1; k++) {
    const openYmd = addDays(firstOpen, 7 * k);
    const closeYmd = addDays(openYmd, closeOffset);
    out.push({ opens_at: at(openYmd, w.open_time), closes_at: at(closeYmd, w.close_time), pickup_date: addDays(closeYmd, pickupOffset) });
  }
  return out;
}

/** Plain-words description of the schedule, e.g. "Order Wednesday 12:00 AM to Sunday 11:59 PM. Pickup the following Saturday, 10am – 4pm." */
export function scheduleText(w: Weekly) {
  const t = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    const ap = h >= 12 ? 'PM' : 'AM';
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
  };
  return {
    order: `${DAY_NAMES[w.open_day]} ${t(w.open_time)} to ${DAY_NAMES[w.close_day]} ${t(w.close_time)}`,
    openDay: DAY_NAMES[w.open_day],
    closeDay: DAY_NAMES[w.close_day],
    pickupDay: DAY_NAMES[w.pickup_day],
    pickupHours: w.pickup_hours,
  };
}

let lastEnsure = 0;
let running: Promise<void> | null = null;

/**
 * Keeps the next several weekly Drops in the database so orders, limits and
 * pauses can attach to them. Reads first and only writes what is missing or
 * changed. Runs at most every 5 minutes per server; after a failure it waits
 * a minute (never retries on every request).
 */
export async function ensureWeeklyDrops(force = false) {
  if (!force && Date.now() - lastEnsure < 5 * 60_000) return;
  if (running) return running;
  lastEnsure = Date.now();
  running = (async () => {
    try {
      await ensureSchema();
      const s = await getSettings();
      const w = s.weekly;
      if (!w.enabled) return;
      const wins = weeklyWindows(w);
      const dates = wins.map((x) => x.pickup_date);
      const have = await query((sql) => sql<{ pickup_date: string; opens_at: Date; closes_at: Date; title: string; pickup_hours: string }[]>`
        select pickup_date, opens_at, closes_at, title, pickup_hours from drops
        where kind = 'weekly' and pickup_date = any(${dates}::text[])`, 'Checking the weekly schedule');
      const byDate = new Map(have.map((h) => [h.pickup_date, h]));
      const todo = wins.filter((win) => {
        const h = byDate.get(win.pickup_date);
        return !h || +new Date(h.opens_at) !== +win.opens_at || +new Date(h.closes_at) !== +win.closes_at || h.title !== w.title || h.pickup_hours !== w.pickup_hours;
      });
      const seeded = await query((sql) => sql`select 1 from settings where key = 'pause_seed_2026_11_28'`, 'Checking the weekly schedule');
      if (todo.length === 0 && seeded.length > 0) return;
      await transaction(async (tx) => {
        for (const win of todo) {
          await tx`
            insert into drops (kind, title, opens_at, closes_at, pickup_date, pickup_hours)
            values ('weekly', ${w.title}, ${win.opens_at}, ${win.closes_at}, ${win.pickup_date}, ${w.pickup_hours})
            on conflict (pickup_date) where kind = 'weekly'
            do update set title = excluded.title, opens_at = excluded.opens_at, closes_at = excluded.closes_at, pickup_hours = excluded.pickup_hours`;
        }
        // Remove future weekly Drops that no longer match the schedule (only if nobody ordered).
        await tx`
          delete from drops d where d.kind = 'weekly' and d.opens_at > now()
            and not (d.pickup_date = any(${dates}::text[]))
            and not exists (select 1 from orders o where o.drop_id = d.id)`;
        // One-time: pause the Thanksgiving week (pickup Saturday, November 28, 2026), as requested.
        if (seeded.length === 0) {
          await tx`update drops set paused = true where kind = 'weekly' and pickup_date = '2026-11-28'`;
          await tx`insert into settings (key, value) values ('pause_seed_2026_11_28', 'true'::jsonb) on conflict do nothing`;
        }
      }, 'Updating the weekly schedule', { retries: 1 });
    } catch (e) {
      lastEnsure = Date.now() - 4 * 60_000; // try again in about a minute
      console.error('ensureWeeklyDrops failed', e);
    } finally {
      running = null;
    }
  })();
  return running;
}
