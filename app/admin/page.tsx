import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { databaseConfigured } from '@/lib/db';
import { isDatabaseReady } from '@/lib/setup';
import { getOpenDrop, getNextDrop } from '@/lib/menu';
import { getSettings } from '@/lib/settings';
import { fmtDateTime, fmtPickupDate } from '@/lib/time';
import { logoutAction } from './actions';
import { SetupButton } from './SetupButton';

export default async function AdminHome() {
  await requireAdmin();

  if (!databaseConfigured()) {
    return (
      <div className="panel stack">
        <h2>Database not connected</h2>
        <p className="muted">Vercel can&apos;t find your Supabase database yet. Go back to the setup steps and connect Supabase to this project, then redeploy.</p>
      </div>
    );
  }

  if (!(await isDatabaseReady())) {
    return (
      <div className="panel stack" style={{ maxWidth: 620 }}>
        <h2>One-time setup</h2>
        <p className="muted">Your database is connected. Tap the button below once to create your menu, your first weekly drop, and everything the site needs.</p>
        <SetupButton />
      </div>
    );
  }

  const [open, next, s] = await Promise.all([getOpenDrop(), getNextDrop(), getSettings()]);
  const missingPay = !s.cashapp && !s.zelle && !s.venmo;

  return (
    <div className="stack">
      <h1 style={{ fontSize: '2.4rem' }}>Hello, <span className="gold-text">baker</span></h1>
      {missingPay && (
        <div className="note">Add your Cash App, Zelle and Venmo in <Link href="/admin/settings">Settings</Link> so customers know how to pay you.</div>
      )}
      <div className="panel stack">
        <h3>This week</h3>
        {open ? (
          <p>Orders are <strong style={{ color: 'var(--gold)', fontWeight: 400 }}>open</strong> until {fmtDateTime(open.closes_at)}. Pickup {fmtPickupDate(open.pickup_date, true)}.</p>
        ) : next ? (
          <p>Orders are closed. Next drop opens {fmtDateTime(next.opens_at)}.</p>
        ) : (
          <p>Orders are closed and no upcoming drop is scheduled.</p>
        )}
      </div>
      <div className="panel stack">
        <h3>Coming in the next stages</h3>
        <p className="muted small">Menu &amp; photos, weekly drops and limits, orders, printing, bake list, spreadsheet export and visitor counts.</p>
      </div>
      <form action={logoutAction}><button className="btn btn-sm btn-ghost">Log out</button></form>
    </div>
  );
}
