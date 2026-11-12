import { query } from '@/lib/db';

// Photos never change once uploaded (a new upload gets a new id), so they are
// cached everywhere: by Vercel's network, by browsers, and in memory here.
const memory = new Map<string, { mime: string; data: Uint8Array }>();
const MAX_ITEMS = 60;

const headers = (mime: string) => ({
  'content-type': mime,
  'cache-control': 'public, max-age=31536000, s-maxage=31536000, immutable',
  'cdn-cache-control': 'public, max-age=31536000, immutable',
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found', { status: 404 });
  let hit = memory.get(id);
  if (!hit) {
    try {
      const [img] = await query((sql) => sql<{ mime: string; data: Buffer }[]>`select mime, data from images where id = ${id}`, 'Loading a photo');
      if (!img) return new Response('Not found', { status: 404 });
      hit = { mime: img.mime, data: new Uint8Array(img.data) };
      if (memory.size >= MAX_ITEMS) memory.delete(memory.keys().next().value!);
      memory.set(id, hit);
    } catch {
      // Busy moment: tell the browser to try again shortly (not cached).
      return new Response('Busy, try again', { status: 503, headers: { 'retry-after': '2', 'cache-control': 'no-store' } });
    }
  }
  return new Response(hit.data as unknown as BodyInit, { headers: headers(hit.mime) });
}
