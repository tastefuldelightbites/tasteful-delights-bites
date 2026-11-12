import Link from 'next/link';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Unsubscribe · Tasteful Delights Bites', robots: { index: false } };

export default async function Unsubscribe({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rows = /^[a-f0-9]{32}$/.test(token)
    ? await db()`update subscribers set unsubscribed_at = coalesce(unsubscribed_at, now()) where token = ${token} returning email`
    : [];
  return (
    <div className="wrap narrow center" style={{ padding: '90px 22px' }}>
      <img src="/logo.png" alt="Tasteful Delights Bites" width={110} height={110} style={{ margin: '0 auto 26px' }} />
      <h1 style={{ fontSize: '2.6rem' }}>{rows.length ? <>You&apos;re <em>unsubscribed.</em></> : <>Link not found</>}</h1>
      <p className="muted" style={{ marginTop: 16 }}>
        {rows.length ? `${rows[0].email} won't get any more marketing emails from us. You'll still get emails about orders you place.` : 'This unsubscribe link is not valid. If you keep getting emails, just reply to one and we will remove you.'}
      </p>
      <p style={{ marginTop: 26 }}><Link className="btn btn-outline" href="/">Back to the website</Link></p>
    </div>
  );
}
