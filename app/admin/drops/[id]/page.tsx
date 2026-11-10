import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { getDrop } from '@/lib/admin';
import { getProducts, getSoldCounts } from '@/lib/menu';
import { db } from '@/lib/db';
import { toEasternLocal } from '@/lib/time';
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
    db()<{ product_id: string; enabled: boolean; qty: number }[]>`select product_id, enabled, qty from drop_limits where drop_id = ${drop.id}`,
  ]);
  const limits = Object.fromEntries(limitRows.map((l) => [l.product_id, { enabled: l.enabled, qty: l.qty }]));
  return (
    <div className="stack">
      <p><Link href="/admin/drops" style={{ fontWeight: 700 }}>← All Drops</Link></p>
      <h1>Drop {String(drop.number).padStart(3, '0')}</h1>
      {created && <div className="success">Your new Drop is ready! Check the dates below, set any limits, then tap Save.</div>}
      <DropForm
        drop={{ id: drop.id, opens: toEasternLocal(new Date(drop.opens_at)), closes: toEasternLocal(new Date(drop.closes_at)), pickup: drop.pickup_date, hours: drop.pickup_hours }}
        products={products.map((p) => ({ id: p.id, name: p.name, kind: p.kind, hidden: p.hidden, sold: sold.get(p.id) ?? 0, limit: limits[p.id] ?? { enabled: false, qty: 0 } }))}
      />
    </div>
  );
}
