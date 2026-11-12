import { query } from '@/lib/db';
import { easternToday } from '@/lib/time';

// Anonymous visitor counter for the admin dashboard. One quick statement,
// short time limit, no retries: if the database is busy, this visit just isn't counted.
export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    const vid = String(id ?? '').slice(0, 64);
    const ua = req.headers.get('user-agent') ?? '';
    if (!vid || /bot|crawl|spider|preview/i.test(ua)) return new Response(null, { status: 204 });
    await query((sql) => sql`
      with p as (
        insert into visitor_pings (visitor_id, last_seen) values (${vid}, now())
        on conflict (visitor_id) do update set last_seen = now()
      )
      insert into daily_visitors (day, visitor_id) values (${easternToday()}, ${vid}) on conflict do nothing`, 'Counting a visit', { timeout: 4000, retries: 0 });
  } catch {}
  return new Response(null, { status: 204 });
}
