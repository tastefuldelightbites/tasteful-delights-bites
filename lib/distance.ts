import type { Settings } from './settings';

type Point = { lat: number; lng: number };

// Approximate location of the Publix at 111 W Butler Rd, Mauldin SC (used if lookup fails)
const PICKUP_FALLBACK: Point = { lat: 34.7786, lng: -82.3125 };

async function censusLookup(address: string): Promise<Point | null> {
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=${encodeURIComponent(address)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const j = await res.json();
  const m = j?.result?.addressMatches?.[0]?.coordinates;
  return m ? { lat: Number(m.y), lng: Number(m.x) } : null;
}

async function osmLookup(address: string): Promise<Point | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { 'User-Agent': 'TastefulDelightsBites-preorder/1.0' },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const j = await res.json();
  return j?.[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon) } : null;
}

export async function geocode(address: string): Promise<Point | null> {
  try {
    const a = await censusLookup(address);
    if (a) return a;
  } catch {}
  try {
    return await osmLookup(address);
  } catch {
    return null;
  }
}

function milesBetween(a: Point, b: Point) {
  const R = 3958.8;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

let pickupCache: { address: string; point: Point } | null = null;

export type DeliveryQuote =
  | { ok: true; miles: number; cents: number }
  | { ok: false; error: string };

export async function quoteDelivery(address: string, settings: Settings): Promise<DeliveryQuote> {
  if (!settings.delivery_enabled) return { ok: false, error: 'Delivery is not available this week. Pickup only.' };
  if (address.trim().length < 8) return { ok: false, error: 'Please enter your full street address, city and ZIP.' };

  if (!pickupCache || pickupCache.address !== settings.pickup_address) {
    const p = (await geocode(settings.pickup_address)) ?? PICKUP_FALLBACK;
    pickupCache = { address: settings.pickup_address, point: p };
  }
  const dest = await geocode(address);
  if (!dest) return { ok: false, error: "We couldn't find that address. Please check the street, city and ZIP code." };

  const miles = Math.round(milesBetween(pickupCache.point, dest) * 10) / 10;
  const tiers = [...settings.delivery_tiers].sort((a, b) => a.max_miles - b.max_miles);
  const tier = tiers.find((t) => miles <= t.max_miles);
  if (!tier) {
    const max = tiers.at(-1)?.max_miles ?? 0;
    return { ok: false, error: `Sorry, that address is about ${miles} miles away. We deliver up to ${max} miles — pickup is always available!` };
  }
  return { ok: true, miles, cents: tier.cents };
}
