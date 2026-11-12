import { isAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { easternToday } from '@/lib/time';

const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** Subscriber list as a spreadsheet file. */
export async function GET() {
  if (!(await isAdmin())) return new Response('Please log in', { status: 401 });
  const rows = await db()<{ email: string; name: string; created_at: Date; unsubscribed_at: Date | null }[]>`select email, name, created_at, unsubscribed_at from subscribers order by created_at`;
  const when = (d: Date | null) => (d ? new Date(d).toLocaleString('en-US', { timeZone: 'America/New_York' }) : '');
  const csv = [['Email', 'Name', 'Joined', 'Subscribed?'], ...rows.map((r) => [r.email, r.name, when(r.created_at), r.unsubscribed_at ? `No (unsubscribed ${when(r.unsubscribed_at)})` : 'Yes'])]
    .map((r) => r.map(esc).join(',')).join('\r\n');
  return new Response('﻿' + csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="subscribers-${easternToday()}.csv"` } });
}
