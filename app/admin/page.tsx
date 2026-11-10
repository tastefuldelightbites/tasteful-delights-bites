import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { databaseConfigured } from '@/lib/db';
import { isDatabaseReady } from '@/lib/setup';
import { getOpenDrop, getNextDrop } from '@/lib/menu';
import { getSettings } from '@/lib/settings';
import { defaultDrop, ordersForDrop, visitorStats } from '@/lib/admin';
import { fmtDateTime, fmtPickupDate } from '@/lib/time';
import { money } from '@/lib/money';
import { db } from '@/lib/db';
import { logoutAction } from './actions';
import { SetupButton } from './SetupButton';

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

  if (!(await isDatabaseReady())) {
    return (
      <div className="panel stack" style={{ maxWidth: 640 }}>
        <h2>One-time setup</h2>
        <p className="muted">Your database is connected. Tap the button once to create your menu, your first Drop, and everything the site needs.</p>
        <SetupButton />
      </div>
    );
  }

  const [open, next, s, drop, visitors] = await Promise.all([getOpenDrop(), getNextDrop(), getSettings(), defaultDrop(), visitorStats()]);
  const orders = drop ? (await ordersForDrop(drop.id)).filter((o) => !o.canceled_at) : [];
  const unpaid = orders.filter((o) => !o.paid_at);
  const sales = orders.reduce((a, o) => a + o.total_cents, 0);
  const [{ n: newRequests }] = await db()`select count(*)::int as n from custom_requests where status = 'new'`;
  const missingPay = !s.cashapp && !s.zelle && !s.applepay;

  return (
    <div className="stack" style={{ gap: 0 }}>
      <h1>Hello, <em>baker</em></h1>

      <div className="panel stack" style={{ marginTop: 24 }}>
        <h3>This week</h3>
        {open ? (
          <p style={{ fontSize: '1.15rem' }}><strong>Ordering is OPEN</strong> until {fmtDateTime(open.closes_at)}.<br />Pickup is {fmtPickupDate(open.pickup_date, true)}, {open.pickup_hours}.</p>
        ) : next ? (
          <p style={{ fontSize: '1.15rem' }}><strong>Ordering is closed.</strong> Your next Drop opens {fmtDateTime(next.opens_at)}.</p>
        ) : (
          <p style={{ fontSize: '1.15rem' }}><strong>Ordering is closed and no Drop is scheduled.</strong> Create one so customers can order.</p>
        )}
        {!open && !next && <Link className="btn" href="/admin/drops">Set Up My Next Drop</Link>}
      </div>

      {missingPay && (
        <div className="alert" style={{ marginTop: 18 }}>
          Customers can&apos;t see how to pay you yet. <Link href="/admin/settings">Add your Cash App, Zelle and Apple Pay</Link>.
        </div>
      )}

      <div className="stat-grid" style={{ marginTop: 22 }}>
        <div className="stat"><div className="num">{orders.length}</div>Orders {drop ? `in Drop ${String(drop.number).padStart(3, '0')}` : ''}</div>
        <div className="stat"><div className="num">{unpaid.length}</div>Not paid yet</div>
        <div className="stat"><div className="num">{money(sales)}</div>Total sales</div>
        <div className="stat"><div className="num">{visitors.now}</div>On the site right now</div>
        <div className="stat"><div className="num">{visitors.today}</div>Visitors today</div>
        <div className="stat"><div className="num">{newRequests}</div>New custom requests</div>
      </div>

      <div className="row" style={{ marginTop: 26 }}>
        <Link className="btn" href="/admin/orders">See Orders</Link>
        <Link className="btn btn-outline" href="/admin/orders?view=bake">Bake List</Link>
        <Link className="btn btn-outline" href="/admin/menu">Menu &amp; Photos</Link>
      </div>

      {visitors.days.length > 0 && (
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
