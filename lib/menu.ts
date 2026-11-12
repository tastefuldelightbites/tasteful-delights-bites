import { db, query } from './db';

export const TAGS = ['new', 'fan-fave'] as const;
export type Tag = (typeof TAGS)[number];

export { ensureSchema } from './migrate';
import { ensureSchema } from './migrate';
import { ensureWeeklyDrops } from './schedule';
import { getSettings } from './settings';

export type Option = { label: string; cents: number };

export type Product = {
  id: string;
  kind: 'cookie' | 'item';
  section: string;
  name: string;
  description: string;
  image_id: string | null;
  options: Option[];
  sort_order: number;
  hidden: boolean;
  tags: Tag[];
};

export type Drop = {
  id: string;
  kind: 'weekly' | 'holiday';
  paused: boolean;
  title: string;
  opens_at: Date;
  closes_at: Date;
  pickup_date: string;
  pickup_hours: string;
  number: number;
};

export type MenuProduct = Product & { limit: number | null; sold: number; left: number | null };

export async function getProducts(includeHidden = false): Promise<Product[]> {
  await ensureSchema();
  return query((sql) => includeHidden
    ? sql<Product[]>`select id, kind, section, name, description, image_id, options, sort_order, hidden, tags from products order by sort_order, created_at`
    : sql<Product[]>`select id, kind, section, name, description, image_id, options, sort_order, hidden, tags from products where not hidden order by sort_order, created_at`, 'Loading the menu');
}

const DROP_COLS = (sql: ReturnType<typeof db>) => sql`d.*, (select count(*)::int from drops x where x.opens_at <= d.opens_at) as number`;

/** Weekly Drops only count while the weekly schedule is turned on. */
async function weeklyOn() {
  return (await getSettings()).weekly.enabled;
}

/** Every Drop customers can order from right now: weekly orders first, then holiday Drops. */
export async function getOpenDrops(): Promise<Drop[]> {
  await ensureWeeklyDrops();
  const on = await weeklyOn();
  return query((sql) => sql<Drop[]>`select ${DROP_COLS(sql)} from drops d
    where opens_at <= now() and closes_at > now() and not paused and (kind = 'holiday' or ${on})
    order by (kind = 'weekly') desc, closes_at`, 'Loading open Drops');
}

/** The first open Drop (weekly orders if open). */
export async function getOpenDrop(): Promise<Drop | null> {
  return (await getOpenDrops())[0] ?? null;
}

/** The next Drop that will open (skips paused weeks). */
export async function getNextDrop(): Promise<Drop | null> {
  await ensureWeeklyDrops();
  const on = await weeklyOn();
  const rows = await query((sql) => sql<Drop[]>`select ${DROP_COLS(sql)} from drops d
    where opens_at > now() and not paused and (kind = 'holiday' or ${on})
    order by opens_at asc limit 1`, 'Loading the next Drop');
  return rows[0] ?? null;
}

/** Upcoming holiday Drops that haven't opened yet (to announce them). */
export async function getUpcomingHolidayDrops(): Promise<Drop[]> {
  return query((sql) => sql<Drop[]>`select ${DROP_COLS(sql)} from drops d where kind = 'holiday' and opens_at > now() and not paused order by opens_at limit 3`, 'Loading Drops');
}

export async function getDropById(id: string): Promise<Drop | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await query((sql) => sql<Drop[]>`select ${DROP_COLS(sql)} from drops d where d.id = ${id}`, 'Loading the Drop');
  return rows[0] ?? null;
}

/** True if customers can order from this Drop right now. */
export async function isDropOpen(d: Drop) {
  const now = Date.now();
  if (d.paused) return false;
  if (d.kind === 'weekly' && !(await weeklyOn())) return false;
  return new Date(d.opens_at).getTime() <= now && new Date(d.closes_at).getTime() > now;
}

/** Items the owner turned off for a particular Drop. */
export async function getHiddenInDrop(dropId: string, tx?: ReturnType<typeof db>): Promise<Set<string>> {
  const run = (sql: ReturnType<typeof db>) => sql<{ product_id: string }[]>`select product_id from drop_limits where drop_id = ${dropId} and hidden`;
  const rows = tx ? await run(tx) : await query(run, 'Loading the menu');
  return new Set(rows.map((r) => r.product_id));
}

/** How many of each product are already ordered in a drop (canceled orders don't count). */
export async function getSoldCounts(dropId: string, tx?: ReturnType<typeof db>): Promise<Map<string, number>> {
  const run = (sql: ReturnType<typeof db>) => sql<{ pid: string; n: number }[]>`
    select pid, sum(n)::int as n from (
      select oi.product_id as pid, oi.quantity as n
        from order_items oi join orders o on o.id = oi.order_id
        where o.drop_id = ${dropId} and o.canceled_at is null and oi.product_id is not null
      union all
      select (f->>'id')::uuid as pid, oi.quantity * (f->>'qty')::int as n
        from order_items oi join orders o on o.id = oi.order_id
        cross join lateral jsonb_array_elements(oi.flavors) f
        where o.drop_id = ${dropId} and o.canceled_at is null
    ) t group by pid`;
  const rows = tx ? await run(tx) : await query(run, 'Loading amounts left');
  return new Map(rows.map((r) => [r.pid, r.n]));
}

export async function getLimits(dropId: string, tx?: ReturnType<typeof db>): Promise<Map<string, number>> {
  const run = (sql: ReturnType<typeof db>) => sql<{ product_id: string; qty: number }[]>`
    select product_id, qty from drop_limits where drop_id = ${dropId} and enabled`;
  const rows = tx ? await run(tx) : await query(run, 'Loading limits');
  return new Map(rows.map((r) => [r.product_id, r.qty]));
}

export async function getMenu(drop: Drop | null): Promise<MenuProduct[]> {
  const products = await getProducts();
  if (!drop) return products.map((p) => ({ ...p, limit: null, sold: 0, left: null }));
  const [sold, limits, hidden] = await Promise.all([getSoldCounts(drop.id), getLimits(drop.id), getHiddenInDrop(drop.id)]);
  return products.filter((p) => !hidden.has(p.id)).map((p) => {
    const limit = limits.has(p.id) ? limits.get(p.id)! : null;
    const s = sold.get(p.id) ?? 0;
    return { ...p, limit, sold: s, left: limit === null ? null : Math.max(0, limit - s) };
  });
}

/** The name customers see for a Drop, like "Thanksgiving Drop". */
export function dropName(d: { title?: string | null; kind?: string }): string {
  return (d.title ?? '').trim() || (d.kind === 'weekly' ? 'Weekly Orders' : 'Special Drop');
}

/** The Drop's number, like "Drop 001" (shown only in the admin). */
export function dropNumber(d: { number: number }): string {
  return `Drop ${String(d.number).padStart(3, '0')}`;
}

export function imageUrl(id: string | null | undefined) {
  return id ? `/api/img/${id}` : null;
}
