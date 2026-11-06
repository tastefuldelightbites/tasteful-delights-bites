import { db } from '@/lib/db';
import { easternToday } from '@/lib/time';

// Anonymous visitor counter for the admin dashboard.
export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    const vid = String(id ?? '').slice(0, 64);
    const ua = req.headers.get('user-agent') ?? '';
    if (!vid || /bot|crawl|spider|preview/i.test(ua)) return new Response(null, { status: 204 });
    const sql = db();
    await sql`insert into visitor_pings (visitor_id, last_seen) values (${vid}, now())
      on conflict (visitor_id) do update set last_seen = now()`;
    await sql`insert into daily_visitors (day, visitor_id) values (${easternToday()}, ${vid}) on conflict do nothing`;
  } catch {}
  return new Response(null, { status: 204 });
}
