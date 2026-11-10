import postgres from 'postgres';

const KEYS = ['POSTGRES_URL', 'DATABASE_URL', 'SUPABASE_DB_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL_NON_POOLING'];

/**
 * Finds the database address. When Supabase is connected through Vercel,
 * Vercel fills these in automatically (sometimes with a prefix like STORAGE_).
 * Prefers Supabase's connection pooler, which works from Vercel.
 */
function findDatabase(): { key: string; url: string } | undefined {
  const found: { key: string; url: string }[] = [];
  for (const k of KEYS) if (process.env[k]) found.push({ key: k, url: process.env[k]! });
  for (const k of Object.keys(process.env)) {
    if (KEYS.some((base) => k !== base && k.endsWith('_' + base)) && process.env[k]) found.push({ key: k, url: process.env[k]! });
  }
  const isPooler = (u: string) => /pooler\.supabase\.com/i.test(u);
  return found.find((f) => isPooler(f.url) && /:6543\b/.test(f.url)) ?? found.find((f) => isPooler(f.url)) ?? found[0];
}

export function databaseConfigured() {
  return Boolean(findDatabase());
}

/** Safe description of which database we're using (no password), for the setup screen. */
export function describeDatabase(): string {
  const d = findDatabase();
  if (!d) return 'No database address found in Vercel settings.';
  try {
    const u = new URL(d.url);
    return `${d.key} → ${u.hostname}:${u.port || '5432'}`;
  } catch {
    return `${d.key} (address could not be read)`;
  }
}

function makeClient() {
  const d = findDatabase();
  if (!d) throw new Error('Database is not connected yet (no POSTGRES_URL found).');
  const u = new URL(d.url);
  // Strip extra query options (sslmode, supa, pgbouncer...) and set SSL ourselves.
  u.search = '';
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  return postgres(u.toString(), {
    ssl: local ? false : 'require',
    prepare: false, // required for Supabase's connection pooler
    max: 3,
    idle_timeout: 20,
    max_lifetime: 60 * 5,
    connect_timeout: 10, // never wait forever to connect
  });
}

const g = globalThis as unknown as { __tdbSql?: ReturnType<typeof postgres> };

export function db() {
  if (!g.__tdbSql) g.__tdbSql = makeClient();
  return g.__tdbSql;
}

/** Rejects with a clear message if a database step takes too long, instead of hanging. */
export function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise<T>((_, reject) => {
      t = setTimeout(() => {
        // Drop the stuck connection so the next try starts fresh.
        const old = g.__tdbSql;
        g.__tdbSql = undefined;
        old?.end({ timeout: 1 }).catch(() => {});
        reject(new Error(`${what} took longer than ${Math.round(ms / 1000)} seconds.`));
      }, ms);
    }),
  ]);
}
