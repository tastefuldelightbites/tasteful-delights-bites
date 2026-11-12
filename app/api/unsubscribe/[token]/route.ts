import { db } from '@/lib/db';

/** One-click unsubscribe used by email apps (List-Unsubscribe header). */
async function handle(token: string) {
  if (/^[a-f0-9]{32}$/.test(token)) await db()`update subscribers set unsubscribed_at = coalesce(unsubscribed_at, now()) where token = ${token}`;
  return new Response('Unsubscribed', { status: 200 });
}
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) { return handle((await params).token); }
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) { return handle((await params).token); }
