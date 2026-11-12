/**
 * Flavor picks: which cookie flavors and cake flavors a customer chose for a box.
 * Shared by the menu, checkout, the order page, admin orders, emails, phone alerts and the bake list.
 */

/** One chosen flavor (a cookie or honey bun cake from the menu) and how many. */
export type Pick = { id: string; name: string; qty: number };

/**
 * What a box item holds (set by the owner in Menu & Photos → Edit).
 * cookies = how many cookies the customer picks; cookie_ids = which flavors (empty = every cookie flavor).
 * cakes = how many honey bun cakes; cake_ids = which cake flavors (empty = every honey bun cake);
 * cake_size = for example "Small" or "Large" (for the bake list).
 */
export type BoxPicks = { cookies: number; cookie_ids: string[]; cakes: number; cake_ids: string[]; cake_size: string };

export const NO_PICKS: BoxPicks = { cookies: 0, cookie_ids: [], cakes: 0, cake_ids: [], cake_size: '' };

/** Reads picks saved on a product, fixing up anything missing. */
export function readPicks(v: unknown): BoxPicks | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Partial<BoxPicks>;
  const n = (x: unknown) => Math.max(0, Math.min(200, Math.floor(Number(x) || 0)));
  const ids = (x: unknown) => (Array.isArray(x) ? x.filter((i) => typeof i === 'string' && /^[0-9a-f-]{36}$/i.test(i)) : []);
  const p: BoxPicks = { cookies: n(o.cookies), cookie_ids: ids(o.cookie_ids), cakes: n(o.cakes), cake_ids: ids(o.cake_ids), cake_size: String(o.cake_size ?? '').slice(0, 30) };
  return p.cookies > 0 || p.cakes > 0 ? p : null;
}

/** "Red Velvet Honey Bun Cake" → "Red Velvet" (shorter for buttons and lists). */
export function cakeShort(name: string) {
  return name.replace(/\s*honey\s*bun\s*cakes?\s*$/i, '').trim() || name;
}

/** Is this product one of the honey bun cake flavors? */
export function isCakeFlavor(p: { kind: string; section: string; name: string; picks?: unknown }) {
  return p.kind === 'item' && !p.picks && (/honey bun cake/i.test(p.section) || /honey bun cake/i.test(p.name));
}

/** Allowed flavors from a list (empty list of ids = all). */
export function allowed<T extends { id: string }>(all: T[], ids: string[] | undefined): T[] {
  if (!ids || ids.length === 0) return all;
  const set = new Set(ids);
  return all.filter((p) => set.has(p.id));
}

/**
 * Baker's Choice: spreads `count` as evenly as possible over the flavors,
 * never more than each flavor has left.
 */
export function evenMix(count: number, flavors: { id: string; max: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  let left = count;
  const open = flavors.filter((f) => f.max > 0);
  while (left > 0 && open.some((f) => (out[f.id] ?? 0) < f.max)) {
    for (const f of open) {
      if (left === 0) break;
      if ((out[f.id] ?? 0) < f.max) { out[f.id] = (out[f.id] ?? 0) + 1; left--; }
    }
  }
  return out;
}

const sum = (l: Pick[] | undefined) => (l ?? []).reduce((s, p) => s + p.qty, 0);

/** "12 cookies: 3 Milk Chocolate, 3 S'mores…" */
export function cookiesText(flavors: Pick[] | undefined) {
  if (!flavors?.length) return '';
  const n = sum(flavors);
  return `${n} cookie${n === 1 ? '' : 's'}: ${flavors.map((f) => `${f.qty} ${f.name}`).join(', ')}`;
}

/** "Cake: Red Velvet (Small)" */
export function cakesText(cakes: (Pick & { size?: string })[] | undefined) {
  if (!cakes?.length) return '';
  const list = cakes.map((c) => `${c.qty > 1 ? `${c.qty} ` : ''}${cakeShort(c.name)}${c.size ? ` (${c.size})` : ''}`).join(', ');
  return `${sum(cakes) > 1 ? 'Cakes' : 'Cake'}: ${list}`;
}

/** Both kinds of picks on one line, for emails, the phone alert and lists. */
export function picksText(it: { flavors?: Pick[]; cakes?: (Pick & { size?: string })[] }, sep = ' · ') {
  return [cakesText(it.cakes), cookiesText(it.flavors)].filter(Boolean).join(sep);
}

/** Name of an order line: "Cookies, Dozen", "The Thanksgiving Box" or "Original Honey Bun Cake (Small)". */
export function lineName(it: { product_id: string | null; name: string; option_label: string }) {
  if (!it.product_id) return it.name;
  // Skip the size when the name already says it ("The Thanksgiving Box", size "Box").
  const said = it.option_label && it.name.toLowerCase().includes(it.option_label.toLowerCase());
  return it.option_label && !said ? `${it.name} (${it.option_label})` : it.name;
}
