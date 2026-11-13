import type { Settings } from './settings';
import { money } from './money';
import { dropName } from './menu';
import { addDays, hoursInWords } from './time';

const TZ = 'America/New_York';

/** "Thursday, Nov 19" (South Carolina time). */
export function fmtDayShort(d: Date | string) {
  return new Date(d).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', month: 'short', day: 'numeric' });
}

/** "2026-11-25" → "Wednesday, Nov 25" */
export function fmtYmdShort(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric' });
}

/** "2026-11-25" → "Tuesday" (the day before) */
export function dayBefore(ymd: string) {
  const [y, m, d] = addDays(ymd, -1).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long' });
}

/** "Publix on Butler Rd in Mauldin" from the pickup settings. */
export function pickupSpot(s: Pick<Settings, 'pickup_place' | 'pickup_address'>) {
  const [street, city] = s.pickup_address.split(',').map((x) => x.trim());
  const road = (street ?? '').replace(/^\d+\s+/, '').replace(/^[NSEW]\s+/, '');
  return `${s.pickup_place}${road ? ` on ${road}` : ''}${city ? ` in ${city}` : ''}`;
}

/** "Delivery is $5 within 10 miles and $10 for 10 to 20 miles" */
export function deliveryLine(s: Pick<Settings, 'delivery_enabled' | 'delivery_tiers'>) {
  if (!s.delivery_enabled || s.delivery_tiers.length === 0) return '';
  const t = [...s.delivery_tiers].sort((a, b) => a.max_miles - b.max_miles);
  const parts = t.map((x, i) => `${money(x.cents)} ${i === 0 ? `within ${x.max_miles} miles` : `for ${t[i - 1].max_miles} to ${x.max_miles} miles`}`);
  return `Delivery is ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]}`;
}

export const isThanksgiving = (title: string) => /thanksgiving/i.test(title);

export type HolidayInfo = { title: string; orderBy: string; pickup: string; pickupShort: string; notes: string; delivery: string };

/**
 * The plain-words pickup details for a holiday menu, straight from its
 * settings in Admin > Order Dates (close date, pickup day and pickup hours).
 */
export function holidayInfo(h: { title: string; closes_at: Date | string; pickup_date: string; pickup_hours: string }, s: Settings): HolidayInfo {
  const name = dropName(h) || 'Holiday';
  const pickupShort = `${fmtYmdShort(h.pickup_date)} from ${hoursInWords(h.pickup_hours)}`;
  return {
    title: `${name.replace(/\p{Extended_Pictographic}|\uFE0F/gu, '').trim() || name} Orders`,
    orderBy: `Order by ${fmtDayShort(h.closes_at)}`,
    pickup: `Pickup ${pickupShort} at ${pickupSpot(s)}`,
    pickupShort,
    notes: isThanksgiving(name) ? `Need ${dayBefore(h.pickup_date)} pickup or delivery? Add it in your order notes` : '',
    delivery: deliveryLine(s),
  };
}
