import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { listDrops } from '@/lib/admin';
import { getSettings } from '@/lib/settings';
import { ensureWeeklyDrops, scheduleText } from '@/lib/schedule';
import { fmtDateTime, fmtPickupDate } from '@/lib/time';
import { dropName, dropNumber } from '@/lib/menu';
import { createHolidayDropAction } from '../actions';
import { WeeklyForm } from './WeeklyForm';
import { PauseButton } from './PauseButton';

export default async function DropsPage({ searchParams }: { searchParams: Promise<{ past?: string }> }) {
  await requireAdmin();
  const { past } = await searchParams;
  await ensureWeeklyDrops(true);
  const [drops, s] = await Promise.all([listDrops(), getSettings()]);
  const now = Date.now();
  const status = (d: { opens_at: Date; closes_at: Date; paused: boolean }) =>
    d.paused ? 'PAUSED' : new Date(d.opens_at).getTime() > now ? 'Coming up' : new Date(d.closes_at).getTime() > now ? 'OPEN NOW' : 'Finished';
  const recent = (d: { closes_at: Date }) => past || new Date(d.closes_at).getTime() > now - 14 * 86400_000;
  const weekly = drops.filter((d) => d.kind === 'weekly' && recent(d)).sort((a, b) => +new Date(a.opens_at) - +new Date(b.opens_at));
  const holiday = drops.filter((d) => d.kind !== 'weekly' && recent(d));
  const t = scheduleText(s.weekly);

  return (
    <div className="stack">
      <h1>Drops</h1>
      <p className="muted" style={{ fontSize: '1.15rem' }}>Your weekly orders repeat on their own. Holiday Drops (like Thanksgiving) are separate and show next to the weekly menu.</p>

      <div className="panel stack">
        <h3>Weekly orders</h3>
        <p style={{ fontSize: '1.1rem' }}>
          {s.weekly.enabled
            ? <>Orders open <strong>{t.order}</strong>. Pickup is the following <strong>{t.pickupDay}, {t.pickupHours}</strong>.</>
            : <strong>Weekly orders are turned off.</strong>}
        </p>
        <WeeklyForm w={s.weekly} />
      </div>

      {s.weekly.enabled && (
        <div className="panel">
          <h3>Upcoming weeks</h3>
          <p className="muted" style={{ marginTop: 6 }}>Tap Pause to skip a week (for example a holiday week). Customers will see the countdown to the next open week instead.</p>
          {weekly.map((d) => (
            <div key={d.id} className="list-row" style={{ flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <strong style={{ fontSize: '1.15rem' }}>Pickup {fmtPickupDate(d.pickup_date, true)}</strong>{' '}
                <span className="tag-pill" style={{ marginLeft: 6 }}>{status(d)}</span>
                <div className="muted small">Orders {fmtDateTime(d.opens_at)} to {fmtDateTime(d.closes_at)} · {d.order_count} orders</div>
              </div>
              <div className="row">
                {new Date(d.closes_at).getTime() > now && <PauseButton id={d.id} paused={d.paused} />}
                <Link className="btn btn-sm btn-outline" href={`/admin/drops/${d.id}`}>Limits &amp; Items</Link>
                <Link className="btn btn-sm btn-outline" href={`/admin/orders?drop=${d.id}`}>Orders</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <h3>Holiday &amp; special Drops</h3>
        <p className="muted" style={{ marginTop: 6 }}>For Thanksgiving, Christmas and other special menus. Each has its own name, dates and pickup day.</p>
        <form action={createHolidayDropAction} style={{ marginTop: 14 }}>
          <button className="btn">+ Create a Holiday Drop</button>
        </form>
        {holiday.length === 0 && <p className="muted" style={{ marginTop: 14 }}>No holiday Drops yet.</p>}
        {holiday.map((d) => (
          <div key={d.id} className="list-row" style={{ flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <strong style={{ fontSize: '1.15rem' }}>{dropName(d)}</strong> <span className="tag-pill" style={{ marginLeft: 6 }}>{status(d)}</span>
              <div className="muted small">{dropNumber(d)} · Orders {fmtDateTime(d.opens_at)} to {fmtDateTime(d.closes_at)}<br />Pickup {fmtPickupDate(d.pickup_date, true)}, {d.pickup_hours} · {d.order_count} orders</div>
            </div>
            <div className="row">
              <Link className="btn btn-sm" href={`/admin/drops/${d.id}`}>Edit</Link>
              <Link className="btn btn-sm btn-outline" href={`/admin/orders?drop=${d.id}`}>Orders</Link>
            </div>
          </div>
        ))}
      </div>
      {!past && <p><Link href="/admin/drops?past=1" style={{ fontWeight: 700 }}>Show older Drops</Link></p>}
    </div>
  );
}
