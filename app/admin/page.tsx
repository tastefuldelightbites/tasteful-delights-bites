import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { databaseConfigured, describeDatabase, query } from '@/lib/db';
import { readVersion, SCHEMA_VERSION } from '@/lib/migrate';
import { checkDatabase } from '@/lib/setup';
import { dropName, getOpenDrop, getNextDrop, type Drop } from '@/lib/menu';
import { getSettings } from '@/lib/settings';
import { defaultDrop, ordersForDrop, visitorStats } from '@/lib/admin';
import { fmtDateTime, fmtPickupDate } from '@/lib/time';
import { money } from '@/lib/money';
import { logoutAction } from './actions';
import { SetupButton } from './SetupButton';
import { UpgradeButton } from './UpgradeButton';

export const maxDuration = 60;

/** Waits up to 12 seconds for one part of the page; on trouble, shows the fallback instead. */
function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    p.catch((e) => { console.error('Dashboard part failed:', e); return fallback; }),
    new Promise<T>((r) => setTimeout(() => r(fallback), 12000)),
  ]);
}

export default async function AdminHome() {
  await requireAdmin();

  if (!databaseConfigured()) {
    return (
      <div className="panel stack">
        <h2>Database not connected</h2>
        <p className="muted">Vercel can&apos;t find your Supabase database yet. Connect Supabase to this project in Vercel (Storage tab), then redeploy.</p>
      </div>
    );
  }

  const check = await checkDatabase();
  if (!check.ready) {
    return (
      <div className="panel stack" style={{ maxWidth: 680 }}>
        <h2>One-time setup</h2>
        {check.error ? (
          <div className="alert">
            The website can&apos;t reach your database right now: {check.error}
            <br /><span style={{ fontWeight: 500 }}>Database: {describeDatabase()}</span>
          </div>
        ) : (
          <p className="muted">Your database is connected. Tap the button once to create your menu and everything the site needs. It takes up to a minute.</p>
        )}
        <SetupButton />
      </div>
    );
  }

  // Each part of the dashboard loads on its own. If one part is slow, the
  // rest of the page still shows (that part just shows a dash).
  const [version, open, next, s, drop, visitors, newRequests] = await Promise.all([
    safe(readVersion(), -1),
    safe<Drop | null | undefined>(getOpenDrop(), undefined),
    safe<Drop | null | undefined>(getNextDrop(), undefined),
    safe(getSettings(), null),
    safe(defaultDrop(), null),
    safe(visitorStats(), null),
    safe(query((sql) => sql`select count(*)::int as n from custom_requests where status = 'new'`, 'Loading custom requests').then((r) => r[0].n as number), null),
  ]);
  const orders = drop ? (await safe(ordersForDrop(drop.id), [])).filter((o) => !o.canceled_at) : [];
  const partial = open === undefined || next === undefined || s === null || visitors === null || newRequests === null;
  const unpaid = orders.filter((o) => !o.paid_at);
  const sales = orders.reduce((a, o) => a + o.total_cents, 0);
  const missingPay = s !== null && !s.cashapp && !s.zelle && !s.applepay;

  return (
    <div className="stack" style={{ gap: 0 }}>
      <h1>Hello, <em>baker</em></h1>

      {version >= 0 && version < SCHEMA_VERSION && <UpgradeButton />}
      {partial && (
        <div className="note" style={{ marginTop: 18 }}>Part of this page is still loading. Pull down to refresh in a minute.</div>
      )}

      <div className="panel stack" style={{ marginTop: 24 }}>
        <h3>This week</h3>
        {open === undefined || (!open && next === undefined) ? (
          <p style={{ fontSize: '1.15rem' }}>Still loading this week&apos;s dates…</p>
        ) : open ? (
          <p style={{ fontSize: '1.15rem' }}><strong>Ordering is OPEN</strong> until {fmtDateTime(open.closes_at)}.<br />Pickup is {fmtPickupDate(open.pickup_date, true)}, {open.pickup_hours}.</p>
        ) : next ? (
          <p style={{ fontSize: '1.15rem' }}><strong>Ordering is closed.</strong> Ordering opens again {fmtDateTime(next.opens_at)}.</p>
        ) : (
          <p style={{ fontSize: '1.15rem' }}><strong>Ordering is closed and nothing is scheduled.</strong> Check your Order Dates so customers can order.</p>
        )}
        {open === null && next === null && <Link className="btn" href="/admin/order-dates">Open My Order Dates</Link>}
      </div>

      {missingPay && (
        <div className="alert" style={{ marginTop: 18 }}>
          Customers can&apos;t see how to pay you yet. <Link href="/admin/settings">Add your Cash App, Zelle and Apple Pay</Link>.
        </div>
      )}

      <div className="stat-grid" style={{ marginTop: 22 }}>
        <div className="stat"><div className="num">{orders.length}</div>Orders {drop ? `in ${dropName(drop)}` : ''}</div>
        <div className="stat"><div className="num">{unpaid.length}</div>Not paid yet</div>
        <div className="stat"><div className="num">{money(sales)}</div>Total sales</div>
        <div className="stat"><div className="num">{visitors?.now ?? '–'}</div>On the site right now</div>
        <div className="stat"><div className="num">{visitors?.today ?? '–'}</div>Visitors today</div>
        <div className="stat"><div className="num">{newRequests ?? '–'}</div>New custom requests</div>
      </div>

      <div className="row" style={{ marginTop: 26 }}>
        <Link className="btn" href="/admin/orders">See Orders</Link>
        <Link className="btn btn-outline" href="/admin/orders?view=bake">Bake List</Link>
        <Link className="btn btn-outline" href="/admin/menu">Menu &amp; Photos</Link>
      </div>

      {visitors && visitors.days.length > 0 && (
        <div className="panel" style={{ marginTop: 30 }}>
          <h3>Visitors by day</h3>
          <table className="table" style={{ marginTop: 10 }}>
            <thead><tr><th>Day</th><th>Visitors</th></tr></thead>
            <tbody>{visitors.days.map((d) => <tr key={d.day}><td>{fmtPickupDate(d.day, true)}</td><td>{d.n}</td></tr>)}</tbody>
          </table>
        </div>
      )}

      <form action={logoutAction} style={{ marginTop: 34 }}><button className="btn btn-sm btn-outline">Log Out</button></form>
    </div>
  );
}
