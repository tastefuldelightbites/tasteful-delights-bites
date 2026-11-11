import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { listDrops } from '@/lib/admin';
import { fmtDateTime, fmtPickupDate } from '@/lib/time';
import { dropName, dropNumber } from '@/lib/menu';
import { createNextDropAction } from '../actions';

export default async function DropsPage() {
  await requireAdmin();
  const drops = await listDrops();
  const now = Date.now();
  const status = (o: Date, c: Date) => (new Date(o).getTime() > now ? 'Coming up' : new Date(c).getTime() > now ? 'OPEN NOW' : 'Finished');

  return (
    <div className="stack">
      <h1>Drops</h1>
      <p className="muted" style={{ fontSize: '1.15rem' }}>A Drop is one week of ordering. Customers can only order while a Drop is open.</p>
      <form action={createNextDropAction}>
        <button className="btn">+ Create a New Drop</button>
      </form>
      <p className="muted">One tap makes this week&apos;s Drop (or next week&apos;s, if this week already has one). It opens Wednesday, closes Monday at 11:59pm, and pickup is Saturday. If it&apos;s already Wednesday or later, ordering opens right away. You can change the dates after.</p>

      <div style={{ marginTop: 10 }}>
        {drops.length === 0 && <p>No Drops yet.</p>}
        {drops.map((d) => (
          <div key={d.id} className="list-row" style={{ flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h3>{dropName(d)} <span className="tag-pill" style={{ verticalAlign: 'middle', marginLeft: 8 }}>{status(d.opens_at, d.closes_at)}</span></h3>
              <p className="muted">{dropNumber(d)} · Opens {fmtDateTime(d.opens_at)} · Closes {fmtDateTime(d.closes_at)}<br />Pickup {fmtPickupDate(d.pickup_date, true)}, {d.pickup_hours} · {d.order_count} orders</p>
            </div>
            <div className="row">
              <Link className="btn btn-sm" href={`/admin/drops/${d.id}`}>Edit Dates &amp; Limits</Link>
              <Link className="btn btn-sm btn-outline" href={`/admin/orders?drop=${d.id}`}>Orders</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
