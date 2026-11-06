import { db } from './db';

export const TAGS = ['new', 'fan-fave'] as const;
export type Tag = (typeof TAGS)[number];

let ensured: Promise<void> | null = null;
/** Small automatic database upgrades for sites set up before a feature existed. */
export function ensureSchema() {
  if (!ensured) {
    ensured = (async () => {
      const sql = db();
      await sql`alter table products add column if not exists tags text[] not null default '{}'`;
      const done = await sql`select 1 from settings where key = 'tags_seeded'`;
      if (done.length === 0) {
        await sql`update products set tags = '{fan-fave}' where name in ('Milk Chocolate', 'Original Honey Bun Cake') and tags = '{}'`;
        await sql`update products set tags = '{new}' where name in ('Sweet Potato', 'Strawberry Honey Bun Cake') and tags = '{}'`;
        await sql`insert into settings (key, value) values ('tags_seeded', 'true'::jsonb) on conflict do nothing`;
      }
    })().catch((e) => { ensured = null; throw e; });
  }
  return ensured;
}

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
  const sql = db();
  return includeHidden
    ? sql<Product[]>`select id, kind, section, name, description, image_id, options, sort_order, hidden, tags from products order by sort_order, created_at`
    : sql<Product[]>`select id, kind, section, name, description, image_id, options, sort_order, hidden, tags from products where not hidden order by sort_order, created_at`;
}

/** The drop that is open right now, if any. */
export async function getOpenDrop(): Promise<Drop | null> {
  const rows = await db()<Drop[]>`select d.*, (select count(*)::int from drops x where x.opens_at <= d.opens_at) as number from drops d where opens_at <= now() and closes_at > now() order by opens_at desc limit 1`;
  return rows[0] ?? null;
}

/** The next drop that hasn't opened yet. */
export async function getNextDrop(): Promise<Drop | null> {
  const rows = await db()<Drop[]>`select d.*, (select count(*)::int from drops x where x.opens_at <= d.opens_at) as number from drops d where opens_at > now() order by opens_at asc limit 1`;
  return rows[0] ?? null;
}

/** How many of each product are already ordered in a drop (canceled orders don't count). */
export async function getSoldCounts(dropId: string, tx = db()): Promise<Map<string, number>> {
  const rows = await tx<{ pid: string; n: number }[]>`
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
  return new Map(rows.map((r) => [r.pid, r.n]));
}

export async function getLimits(dropId: string, tx = db()): Promise<Map<string, number>> {
  const rows = await tx<{ product_id: string; qty: number }[]>`
    select product_id, qty from drop_limits where drop_id = ${dropId} and enabled`;
  return new Map(rows.map((r) => [r.product_id, r.qty]));
}

export async function getMenu(drop: Drop | null): Promise<MenuProduct[]> {
  const products = await getProducts();
  if (!drop) return products.map((p) => ({ ...p, limit: null, sold: 0, left: null }));
  const [sold, limits] = await Promise.all([getSoldCounts(drop.id), getLimits(drop.id)]);
  return products.map((p) => {
    const limit = limits.has(p.id) ? limits.get(p.id)! : null;
    const s = sold.get(p.id) ?? 0;
    return { ...p, limit, sold: s, left: limit === null ? null : Math.max(0, limit - s) };
  });
}

export function imageUrl(id: string | null | undefined) {
  return id ? `/api/img/${id}` : null;
}
