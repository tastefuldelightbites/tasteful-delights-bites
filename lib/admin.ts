import { db } from './db';
import type { Drop } from './menu';
import type { OrderItemRow, OrderRow } from './orders';
import { easternToday } from './time';

export async function listDrops(): Promise<(Drop & { order_count: number })[]> {
  return db()`
    select d.*,
      (select count(*)::int from drops x where x.opens_at <= d.opens_at) as number,
      (select count(*)::int from orders o where o.drop_id = d.id and o.canceled_at is null) as order_count
    from drops d order by d.opens_at desc`;
}

export async function getDrop(id: string): Promise<Drop | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [d] = await db()<Drop[]>`select d.*, (select count(*)::int from drops x where x.opens_at <= d.opens_at) as number from drops d where id = ${id}`;
  return d ?? null;
}

/** The Drop the owner most likely wants to see: the open one, else the latest that has started, else the newest. */
export async function defaultDrop(): Promise<Drop | null> {
  const [d] = await db()<Drop[]>`
    select d.*, (select count(*)::int from drops x where x.opens_at <= d.opens_at) as number from drops d
    order by (opens_at <= now()) desc, opens_at desc limit 1`;
  return d ?? null;
}

export type OrderWithItems = OrderRow & { items: OrderItemRow[] };

export async function ordersForDrop(dropId: string): Promise<OrderWithItems[]> {
  const sql = db();
  const orders = await sql<OrderRow[]>`select * from orders where drop_id = ${dropId} order by order_number`;
  if (orders.length === 0) return [];
  const items = await sql<OrderItemRow[]>`select * from order_items where order_id in ${sql(orders.map((o) => o.id))} order by product_id nulls first, name`;
  return orders.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id) }));
}

/** Everything to bake for a Drop: cookies by flavor, other items by size. Canceled orders are skipped. */
export function bakeList(orders: OrderWithItems[]) {
  const cookies = new Map<string, number>();
  const items = new Map<string, number>();
  const boxes = new Map<string, number>();
  for (const o of orders) {
    if (o.canceled_at) continue;
    for (const it of o.items) {
      if (it.flavors.length) {
        boxes.set(it.option_label, (boxes.get(it.option_label) ?? 0) + it.quantity);
        for (const f of it.flavors) cookies.set(f.name, (cookies.get(f.name) ?? 0) + f.qty * it.quantity);
      } else {
        const k = `${it.name}${it.option_label ? ` (${it.option_label})` : ''}`;
        items.set(k, (items.get(k) ?? 0) + it.quantity);
      }
    }
  }
  const sort = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  return { cookies: sort(cookies), items: sort(items), boxes: sort(boxes), totalCookies: [...cookies.values()].reduce((a, b) => a + b, 0) };
}

export async function visitorStats() {
  const sql = db();
  const [{ now }] = await sql`select count(*)::int as now from visitor_pings where last_seen > now() - interval '5 minutes'`;
  const days = await sql<{ day: string; n: number }[]>`select day, count(*)::int as n from daily_visitors group by day order by day desc limit 14`;
  const today = days.find((d) => d.day === easternToday())?.n ?? 0;
  return { now: now as number, today, days };
}
