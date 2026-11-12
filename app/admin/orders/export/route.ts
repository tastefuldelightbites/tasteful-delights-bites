import { isAdmin } from '@/lib/auth';
import { getDrop, ordersForDrop } from '@/lib/admin';
import { dropName } from '@/lib/menu';
import { easternToday } from '@/lib/time';

const esc = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const dollars = (c: number) => (c / 100).toFixed(2);
const when = (d: Date | null) => (d ? new Date(d).toLocaleString('en-US', { timeZone: 'America/New_York' }) : '');

/** Orders for one Drop as a spreadsheet file (opens in Numbers, Excel or Google Sheets). */
export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response('Please log in', { status: 401 });
  const id = new URL(req.url).searchParams.get('drop') ?? '';
  const drop = await getDrop(id);
  if (!drop) return new Response('Drop not found', { status: 404 });
  const orders = await ordersForDrop(drop.id);
  const head = ['Order #', 'Name', 'Phone', 'Email', 'Pickup or delivery', 'Address', 'Items', 'Treats $', 'Delivery $', 'Total $', 'Paying with', 'Paid', 'Picked up / delivered', 'Canceled', 'Notes', 'Ordered at'];
  const rows = orders.map((o) => [
    o.order_number, o.name, o.phone, o.email, o.fulfillment, o.address,
    o.items.map((it) => `${it.quantity} x ${it.flavors.length ? `${it.name} (${it.flavors.map((f) => `${f.qty} ${f.name}`).join(', ')})` : `${it.name} ${it.option_label}`}`).join('; '),
    dollars(o.subtotal_cents), dollars(o.delivery_cents), dollars(o.total_cents), o.payment_method,
    o.paid_at ? 'Yes' : 'No', o.picked_up_at ? 'Yes' : 'No', o.canceled_at ? 'Yes' : 'No', o.notes, when(o.created_at),
  ]);
  const csv = [head, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  const slug = dropName(drop).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'drop';
  const name = `orders-${slug}-${String(drop.number).padStart(3, '0')}-${easternToday()}.csv`;
  return new Response('﻿' + csv, {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"` },
  });
}
