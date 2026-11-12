import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fmtDateTime } from '@/lib/time';
import { SendForm } from './SendForm';

export const maxDuration = 300;

type Sub = { email: string; name: string; created_at: Date; unsubscribed_at: Date | null };

export default async function Subscribers() {
  await requireAdmin();
  const subs = await db()<Sub[]>`select email, name, created_at, unsubscribed_at from subscribers order by created_at desc limit 2000`;
  const active = subs.filter((s) => !s.unsubscribed_at);
  return (
    <div className="stack">
      <h1>Subscribers</h1>
      <p className="muted" style={{ fontSize: '1.15rem' }}>Customers who checked &quot;Join our email list&quot; at checkout. Everyone can unsubscribe with one tap from any marketing email.</p>
      <div className="stat-grid">
        <div className="stat"><div className="num">{active.length}</div>On your list</div>
        <div className="stat"><div className="num">{subs.length - active.length}</div>Unsubscribed</div>
      </div>
      <div className="row"><a className="btn" href="/admin/subscribers/export">Download Subscriber List</a></div>

      <div className="panel stack">
        <h3>Email your list</h3>
        <p className="muted">Announce new treats, a holiday menu or a special. Each email includes an unsubscribe link.</p>
        <SendForm count={active.length} />
      </div>

      <div className="panel">
        <h3>Everyone</h3>
        {subs.length === 0 && <p className="muted" style={{ marginTop: 8 }}>No subscribers yet.</p>}
        <table className="table" style={{ marginTop: 10 }}>
          <tbody>
            {subs.map((s) => (
              <tr key={s.email} style={{ opacity: s.unsubscribed_at ? 0.55 : 1 }}>
                <td><strong>{s.name || '—'}</strong><br />{s.email}</td>
                <td className="small">{s.unsubscribed_at ? 'Unsubscribed' : `Joined ${fmtDateTime(s.created_at)}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
