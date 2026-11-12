import { query } from './db';
import type { Drop } from './menu';
import type { OrderItemRow, OrderRow } from './orders';
import { addDays, easternToday } from './time';

export async function listDrops(): Promise<(Drop & { order_count: number })[]> {
  return query((sql) => sql`
    select d.*,
      (select count(*)::int from drops x where x.opens_at <= d.opens_at) as number,
      (select count(*)::int from orders o where o.drop_id = d.id and o.canceled_at is null) as order_count
    from drops d order by d.opens_at desc`, 'Loading order dates') as never;
}

export async function getDrop(id: string): Promise<Drop | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [d] = await query((sql) => sql<Drop[]>`select d.*, (select count(*)::int from drops x where x.opens_at <= d.opens_at) as number from drops d where id = ${id}`, 'Loading order dates');
  return d ?? null;
}

/** The order dates the owner most likely wants to see: this week's (weekly first), else the newest that has started, else the next. */
export async function defaultDrop(): Promise<Drop | null> {
  const [d] = await query((sql) => sql<Drop[]>`
    select d.*, (select count(*)::int from drops x where x.opens_at <= d.opens_at) as number from drops d
    order by (opens_at <= now()) desc, (kind = 'weekly') desc, opens_at desc limit 1`, 'Loading order dates');
  return d ?? null;
}

export type OrderWithItems = OrderRow & { items: OrderItemRow[] };

export async function ordersForDrop(dropId: string): Promise<OrderWithItems[]> {
  const orders = await query((sql) => sql<OrderRow[]>`select * from orders where drop_id = ${dropId} order by order_number`, 'Loading orders');
  if (orders.length === 0) return [];
  const items = await query((sql) => sql<OrderItemRow[]>`select * from order_items where order_id in ${sql(orders.map((o) => o.id))} order by product_id nulls first, name`, 'Loading orders');
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
  const [[{ now }], days] = await Promise.all([
    query((sql) => sql`select count(*)::int as now from visitor_pings where last_seen > now() - interval '5 minutes'`, 'Loading visitors'),
    query((sql) => sql<{ day: string; n: number }[]>`select day, count(*)::int as n from daily_visitors where day >= ${addDays(easternToday(), -13)} group by day order by day desc`, 'Loading visitors'),
  ]);
  const today = days.find((d) => d.day === easternToday())?.n ?? 0;
  return { now: now as number, today, days };
}
