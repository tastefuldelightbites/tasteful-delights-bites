import { db } from './db';
import type { CheckoutInput } from './cart-types';
import { getLimits, getOpenDrop, getProducts, getSoldCounts } from './menu';
import { getSettings } from './settings';
import { quoteDelivery } from './distance';

export type PlaceResult = { ok: true; id: string } | { ok: false; error: string };

const clean = (s: unknown, max = 300) => String(s ?? '').trim().slice(0, max);

export async function placeOrder(input: CheckoutInput): Promise<PlaceResult> {
  const name = clean(input.name, 120);
  const phone = clean(input.phone, 40);
  const email = clean(input.email, 160);
  const notes = clean(input.notes, 1000);
  const fulfillment = input.fulfillment === 'delivery' ? 'delivery' : 'pickup';
  const address = clean(input.address, 300);

  if (!name) return { ok: false, error: 'Please enter your name.' };
  if (phone.replace(/\D/g, '').length < 10) return { ok: false, error: 'Please enter a valid phone number.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Please enter a valid email address.' };
  if (!Array.isArray(input.lines) || input.lines.length === 0) return { ok: false, error: 'Your bag is empty.' };
  if (input.lines.length > 50) return { ok: false, error: 'That is a lot of items! Please use the custom order form.' };

  const drop = await getOpenDrop();
  if (!drop) return { ok: false, error: 'Orders are closed right now. Please check back when the next Drop opens.' };

  const settings = await getSettings();
  const products = new Map((await getProducts()).map((p) => [p.id, p]));

  // Build the order from the real menu and prices (never trust prices from the browser).
  type Line = { product_id: string | null; name: string; option_label: string; unit_cents: number; quantity: number; flavors: { id: string; name: string; qty: number }[] };
  const lines: Line[] = [];
  const need = new Map<string, number>();
  const add = (id: string, n: number) => need.set(id, (need.get(id) ?? 0) + n);

  for (const l of input.lines) {
    const qty = Math.floor(Number(l.quantity));
    if (!(qty >= 1 && qty <= 50)) return { ok: false, error: 'Please check the quantities in your bag.' };
    if (l.type === 'box') {
      const box = settings.cookie_boxes.find((b) => b.count === Number(l.count));
      if (!box) return { ok: false, error: 'One of the cookie boxes in your bag is no longer offered. Please remove it.' };
      const flavors: Line['flavors'] = [];
      let total = 0;
      for (const f of l.flavors ?? []) {
        const p = products.get(f.id);
        const n = Math.floor(Number(f.qty));
        if (!p || p.kind !== 'cookie') return { ok: false, error: 'A cookie flavor in your bag is no longer available. Please remove that box.' };
        if (n < 1) continue;
        flavors.push({ id: p.id, name: p.name, qty: n });
        total += n;
        add(p.id, n * qty);
      }
      if (total !== box.count) return { ok: false, error: `Each ${box.label} needs exactly ${box.count} cookie${box.count > 1 ? 's' : ''}.` };
      lines.push({ product_id: null, name: `Cookies, ${box.label}`, option_label: box.label, unit_cents: box.cents, quantity: qty, flavors });
    } else {
      const p = products.get(l.productId);
      if (!p || p.kind !== 'item') return { ok: false, error: 'An item in your bag is no longer available. Please remove it.' };
      const opt = p.options.find((o) => o.label === l.option) ?? (p.options.length === 1 ? p.options[0] : undefined);
      if (!opt) return { ok: false, error: `Please choose a size for ${p.name}.` };
      add(p.id, qty);
      lines.push({ product_id: p.id, name: p.name, option_label: opt.label, unit_cents: opt.cents, quantity: qty, flavors: [] });
    }
  }

  let deliveryCents = 0;
  let miles: number | null = null;
  if (fulfillment === 'delivery') {
    const q = await quoteDelivery(address, settings);
    if (!q.ok) return { ok: false, error: q.error };
    deliveryCents = q.cents;
    miles = q.miles;
  }

  const subtotal = lines.reduce((s, l) => s + l.unit_cents * l.quantity, 0);
  const total = subtotal + deliveryCents;

  try {
    const id = await db().begin(async (tx) => {
      // One order at a time per drop so we never sell more than the limit.
      await tx`select pg_advisory_xact_lock(hashtext(${drop.id}))`;
      const [sold, limits] = await Promise.all([getSoldCounts(drop.id, tx as never), getLimits(drop.id, tx as never)]);
      for (const [pid, n] of need) {
        const limit = limits.get(pid);
        if (limit === undefined) continue;
        const left = Math.max(0, limit - (sold.get(pid) ?? 0));
        if (n > left) {
          const pname = products.get(pid)?.name ?? 'An item';
          throw new Error(left === 0 ? `Sorry — ${pname} just sold out. Please update your bag.` : `Sorry — only ${left} ${pname} left. Please update your bag.`);
        }
      }
      const [o] = await tx`insert into orders
        (drop_id, name, phone, email, fulfillment, address, distance_miles, delivery_cents, subtotal_cents, total_cents, notes)
        values (${drop.id}, ${name}, ${phone}, ${email}, ${fulfillment}, ${fulfillment === 'delivery' ? address : ''},
                ${miles}, ${deliveryCents}, ${subtotal}, ${total}, ${notes})
        returning id`;
      for (const l of lines) {
        await tx`insert into order_items (order_id, product_id, name, option_label, unit_cents, quantity, flavors, line_cents)
          values (${o.id}, ${l.product_id}, ${l.name}, ${l.option_label}, ${l.unit_cents}, ${l.quantity}, ${tx.json(l.flavors)}, ${l.unit_cents * l.quantity})`;
      }
      return o.id as string;
    });
    return { ok: true, id };
  } catch (e) {
    const msg = e instanceof Error && e.message.startsWith('Sorry') ? e.message : 'Something went wrong placing your order. Please try again.';
    if (!(e instanceof Error && e.message.startsWith('Sorry'))) console.error(e);
    return { ok: false, error: msg };
  }
}

export type OrderRow = {
  id: string; order_number: number; drop_id: string | null; name: string; phone: string; email: string;
  fulfillment: 'pickup' | 'delivery'; address: string; distance_miles: string | null; delivery_cents: number;
  subtotal_cents: number; total_cents: number; notes: string; paid_at: Date | null; picked_up_at: Date | null;
  canceled_at: Date | null; created_at: Date;
};
export type OrderItemRow = {
  id: string; order_id: string; product_id: string | null; name: string; option_label: string;
  unit_cents: number; quantity: number; flavors: { id: string; name: string; qty: number }[]; line_cents: number;
};

export async function getOrder(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const sql = db();
  const [order] = await sql<OrderRow[]>`select * from orders where id = ${id}`;
  if (!order) return null;
  const items = await sql<OrderItemRow[]>`select * from order_items where order_id = ${id} order by product_id nulls first, name`;
  const [drop] = order.drop_id ? await sql`select * from drops where id = ${order.drop_id}` : [];
  return { order, items, drop: drop as unknown as import('./menu').Drop | undefined };
}
