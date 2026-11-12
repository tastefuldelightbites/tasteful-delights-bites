import { db, isRetryable, query, transaction } from './db';
import type { CheckoutInput } from './cart-types';
import { belongsTo, getHolidayTitles, getDropById, getHiddenInDrop, getLimits, getProducts, getSoldCounts, isDropOpen, dropName } from './menu';
import { getSettings } from './settings';
import { allowed, isCakeFlavor, type Pick } from './picks';
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

  const PAY = ['Cash App', 'Zelle', 'Apple Pay'];
  const paymentMethod = PAY.includes(String(input.paymentMethod)) ? String(input.paymentMethod) : '';
  if (!paymentMethod) return { ok: false, error: 'Please choose how you will pay.' };

  const drop = await getDropById(String(input.dropId ?? ''));
  if (!drop || !(await isDropOpen(drop))) {
    return { ok: false, error: `Ordering for ${drop ? dropName(drop) : 'this menu'} is closed. Please go back to the menu to see what's open now.` };
  }

  const settings = await getSettings();
  const offOnThisDrop = await getHiddenInDrop(drop.id);
  const holidayTitles = await getHolidayTitles();
  // Only items on this menu can be ordered (weekly items in a weekly order, Thanksgiving items in a Thanksgiving order).
  const allProducts = (await getProducts()).filter((p) => !offOnThisDrop.has(p.id));
  const products = new Map(allProducts.filter((p) => belongsTo(drop, p, holidayTitles)).map((p) => [p.id, p]));
  // Flavors customers can choose inside a box (cookies and honey bun cakes from the whole menu).
  const cookieFlavors = allProducts.filter((p) => p.kind === 'cookie');
  const cakeFlavors = allProducts.filter(isCakeFlavor);

  // Build the order from the real menu and prices (never trust prices from the browser).
  type Line = { product_id: string | null; name: string; option_label: string; unit_cents: number; quantity: number; flavors: Pick[]; cakes: (Pick & { size: string })[] };
  const lines: Line[] = [];
  const need = new Map<string, number>();
  const add = (id: string, n: number) => need.set(id, (need.get(id) ?? 0) + n);

  /** Checks the flavors chosen for one box against the flavors offered. Returns null if one isn't offered. */
  const takePicks = (list: unknown, ok: Map<string, { id: string; name: string }>, boxes: number): Pick[] | null => {
    const out: Pick[] = [];
    for (const f of Array.isArray(list) ? list : []) {
      const p = ok.get(String(f?.id));
      const n = Math.floor(Number(f?.qty));
      if (!p) return null;
      if (!(n >= 1 && n <= 200)) continue;
      const same = out.find((x) => x.id === p.id);
      if (same) same.qty += n; else out.push({ id: p.id, name: p.name, qty: n });
      add(p.id, n * boxes);
    }
    return out;
  };

  for (const l of input.lines) {
    const qty = Math.floor(Number(l.quantity));
    if (!(qty >= 1 && qty <= 50)) return { ok: false, error: 'Please check the quantities in your bag.' };
    if (l.type === 'box') {
      const box = settings.cookie_boxes.find((b) => b.count === Number(l.count));
      if (!box) return { ok: false, error: 'One of the cookie boxes in your bag is no longer offered. Please remove it.' };
      const ok = new Map(allowed(cookieFlavors.filter((p) => products.has(p.id)), box.flavor_ids).map((p) => [p.id, p]));
      const flavors = takePicks(l.flavors, ok, qty);
      if (!flavors) return { ok: false, error: 'A cookie flavor in your bag is no longer available. Please remove that box.' };
      const total = flavors.reduce((a, f) => a + f.qty, 0);
      if (total !== box.count) return { ok: false, error: `Each ${box.label} needs exactly ${box.count} cookie${box.count > 1 ? 's' : ''}.` };
      lines.push({ product_id: null, name: `Cookies, ${box.label}`, option_label: box.label, unit_cents: box.cents, quantity: qty, flavors, cakes: [] });
    } else {
      const p = products.get(l.productId);
      if (!p || p.kind !== 'item') return { ok: false, error: 'An item in your bag is no longer available. Please remove it.' };
      const opt = p.options.find((o) => o.label === l.option) ?? (p.options.length === 1 ? p.options[0] : undefined);
      if (!opt) return { ok: false, error: `Please choose a size for ${p.name}.` };
      add(p.id, qty);
      let flavors: Pick[] = [];
      let cakes: (Pick & { size: string })[] = [];
      if (p.picks && !(l.flavors?.length || l.cakes?.length)) {
        return { ok: false, error: `Please remove ${p.name} from your order and add it again to choose its flavors.` };
      }
      if (p.picks) {
        // A box with cookies and/or cakes: the customer's flavor picks must add up exactly.
        if (p.picks.cookies > 0) {
          const ok = new Map(allowed(cookieFlavors, p.picks.cookie_ids).map((c) => [c.id, c]));
          const got = takePicks(l.flavors, ok, qty);
          if (!got) return { ok: false, error: `A cookie flavor in ${p.name} is no longer available. Please remove it from your order and add it again.` };
          if (got.reduce((a, f) => a + f.qty, 0) !== p.picks.cookies) return { ok: false, error: `Please choose exactly ${p.picks.cookies} cookies for ${p.name}.` };
          flavors = got;
        }
        if (p.picks.cakes > 0) {
          const ok = new Map(allowed(cakeFlavors, p.picks.cake_ids).map((c) => [c.id, c]));
          const got = takePicks(l.cakes, ok, qty);
          if (!got) return { ok: false, error: `A cake flavor in ${p.name} is no longer available. Please remove it from your order and add it again.` };
          if (got.reduce((a, f) => a + f.qty, 0) !== p.picks.cakes) return { ok: false, error: `Please choose ${p.picks.cakes === 1 ? 'a cake flavor' : `${p.picks.cakes} cake flavors`} for ${p.name}.` };
          cakes = got.map((c) => ({ ...c, size: p.picks!.cake_size }));
        }
      }
      lines.push({ product_id: p.id, name: p.name, option_label: opt.label, unit_cents: opt.cents, quantity: qty, flavors, cakes });
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
    const id = await transaction(async (tx) => {
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
        (drop_id, name, phone, email, fulfillment, address, distance_miles, delivery_cents, subtotal_cents, total_cents, notes, payment_method)
        values (${drop.id}, ${name}, ${phone}, ${email}, ${fulfillment}, ${fulfillment === 'delivery' ? address : ''},
                ${miles}, ${deliveryCents}, ${subtotal}, ${total}, ${notes}, ${paymentMethod})
        returning id`;
      for (const l of lines) {
        await tx`insert into order_items (order_id, product_id, name, option_label, unit_cents, quantity, flavors, cakes, line_cents)
          values (${o.id}, ${l.product_id}, ${l.name}, ${l.option_label}, ${l.unit_cents}, ${l.quantity}, ${tx.json(l.flavors)}, ${tx.json(l.cakes)}, ${l.unit_cents * l.quantity})`;
      }
      if (input.subscribe) {
        await tx`insert into subscribers (email, name) values (${email.toLowerCase()}, ${name})
          on conflict (email) do update set unsubscribed_at = null, name = excluded.name`;
      }
      return o.id as string;
    }, 'Saving your order', { retries: 2 });
    return { ok: true, id };
  } catch (e) {
    const busy = isRetryable(e);
    const msg = e instanceof Error && e.message.startsWith('Sorry')
      ? e.message
      : busy
        ? 'We are getting a lot of orders right now. Please tap Place My Order again in a few seconds. Your order was not saved yet.'
        : 'Something went wrong placing your order. Please try again.';
    if (!(e instanceof Error && e.message.startsWith('Sorry'))) console.error(e);
    return { ok: false, error: msg };
  }
}

export type OrderRow = {
  id: string; order_number: number; drop_id: string | null; name: string; phone: string; email: string;
  fulfillment: 'pickup' | 'delivery'; address: string; distance_miles: string | null; delivery_cents: number;
  subtotal_cents: number; total_cents: number; notes: string; paid_at: Date | null; picked_up_at: Date | null;
  canceled_at: Date | null; created_at: Date; ready_at: Date | null; thanked_at: Date | null; payment_method: string;
};
export type OrderItemRow = {
  id: string; order_id: string; product_id: string | null; name: string; option_label: string;
  unit_cents: number; quantity: number; flavors: { id: string; name: string; qty: number }[]; line_cents: number;
  /** Honey bun cake flavors chosen for a box (empty for other items). */
  cakes: { id: string; name: string; qty: number; size?: string }[];
};

export async function getOrder(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [order] = await query((sql) => sql<OrderRow[]>`select * from orders where id = ${id}`, 'Loading the order');
  if (!order) return null;
  const items = await query((sql) => sql<OrderItemRow[]>`select * from order_items where order_id = ${id} order by product_id nulls first, name`, 'Loading the order');
  const [drop] = order.drop_id ? await query((sql) => sql`select * from drops where id = ${order.drop_id}`, 'Loading the order') : [];
  return { order, items, drop: drop as unknown as import('./menu').Drop | undefined };
}
