import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { getDrop } from '@/lib/admin';
import { dropName, dropNumber, getProducts, getSoldCounts } from '@/lib/menu';
import { db } from '@/lib/db';
import { fmtDateTime, fmtPickupDate, toEasternLocal } from '@/lib/time';
import { DropForm } from './DropForm';

export default async function EditDrop({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { created } = await searchParams;
  const drop = await getDrop(id);
  if (!drop) notFound();
  const [products, sold, limitRows] = await Promise.all([
    getProducts(true),
    getSoldCounts(drop.id),
    db()<{ product_id: string; enabled: boolean; qty: number; hidden: boolean }[]>`select product_id, enabled, qty, hidden from drop_limits where drop_id = ${drop.id}`,
  ]);
  const limits = Object.fromEntries(limitRows.map((l) => [l.product_id, { enabled: l.enabled, qty: l.qty, hidden: l.hidden }]));
  const weekly = drop.kind === 'weekly';
  return (
    <div className="stack">
      <p><Link href="/admin/order-dates" style={{ fontWeight: 700 }}>← All Order Dates</Link></p>
      <h1>{weekly ? `Pickup ${fmtPickupDate(drop.pickup_date, true)}` : dropName(drop)}</h1>
      <p className="muted">{weekly ? `${dropName(drop)} · orders ${fmtDateTime(drop.opens_at)} to ${fmtDateTime(drop.closes_at)}` : `Order by ${fmtDateTime(drop.closes_at)} · pickup ${fmtPickupDate(drop.pickup_date, true)}`}</p>
      {weekly && <p className="muted">Weekly dates follow your weekly schedule (change it on the Order Dates page). Here you can choose which items to offer this week and set limits.</p>}
      {created && <div className="success">Your new holiday menu is ready! Give it a name (this is also the menu category, like Thanksgiving), check the dates, then tap Save.</div>}
      <DropForm
        drop={{ id: drop.id, weekly, title: dropName(drop), opens: toEasternLocal(new Date(drop.opens_at)), closes: toEasternLocal(new Date(drop.closes_at)), pickup: drop.pickup_date, hours: drop.pickup_hours }}
        products={products.map((p) => ({ id: p.id, name: p.name, kind: p.kind, hidden: p.hidden, sold: sold.get(p.id) ?? 0, limit: limits[p.id] ?? { enabled: false, qty: 0, hidden: false } }))}
      />
    </div>
  );
}
