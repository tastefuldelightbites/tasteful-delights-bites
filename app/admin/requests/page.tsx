import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fmtDateTime } from '@/lib/time';
import { RequestDone } from './RequestDone';

type R = { id: string; name: string; phone: string; email: string; event_date: string; details: string; status: string; created_at: Date };

export default async function Requests() {
  await requireAdmin();
  const rows = await db()<R[]>`select * from custom_requests order by (status = 'new') desc, created_at desc limit 200`;
  return (
    <div className="stack">
      <h1>Custom Requests</h1>
      <p className="muted" style={{ fontSize: '1.15rem' }}>Large and custom order requests from your website. Reach out by phone or email, then mark them done.</p>
      {rows.length === 0 && <p>No requests yet.</p>}
      {rows.map((r) => (
        <div key={r.id} className="order-card" style={{ opacity: r.status === 'done' ? 0.6 : 1 }}>
          <h3>{r.name}</h3>
          <p className="muted"><a href={`tel:${r.phone}`}>{r.phone}</a> · <a href={`mailto:${r.email}`}>{r.email}</a><br />Sent {fmtDateTime(r.created_at)}{r.event_date && ` · Needed by ${r.event_date}`}</p>
          <p style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{r.details}</p>
          <RequestDone id={r.id} done={r.status === 'done'} />
        </div>
      ))}
    </div>
  );
}
