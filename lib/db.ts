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

/**
 * ONE shared connection pool per server instance, reused by every request.
 *
 * Vercel runs the site as serverless functions, so we always go through
 * Supabase's "transaction" pooler (port 6543): a database connection is only
 * borrowed for the length of one query or one transaction, then handed back.
 * That is what lets 50+ people browse at once on Supabase's small free plan.
 */
function makeClient() {
  const d = findDatabase();
  if (!d) throw new Error('Database is not connected yet (no POSTGRES_URL found).');
  const u = new URL(d.url);
  // Strip extra query options (sslmode, supa, pgbouncer...) and set SSL ourselves.
  u.search = '';
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  return postgres(u.toString(), {
    ssl: local ? false : 'require',
    prepare: false,          // required by Supabase's transaction pooler
    max: Number(process.env.DB_POOL_MAX ?? 4), // connections per server instance (the pooler shares them)
    idle_timeout: 15,        // close idle connections after 15 seconds
    max_lifetime: 60 * 5,    // replace connections every 5 minutes
    connect_timeout: 10,     // never wait forever to connect
  });
}

const g = globalThis as unknown as { __tdbSql?: ReturnType<typeof postgres>; __tdbTimeouts?: number[] };

export function db() {
  if (!g.__tdbSql) g.__tdbSql = makeClient();
  return g.__tdbSql;
}

/**
 * If several requests time out close together, the pool's connections are
 * probably dead (for example after the server instance was frozen). Start a
 * fresh pool; the old one finishes its work and closes on its own.
 */
function noteTimeout() {
  const now = Date.now();
  const recent = (g.__tdbTimeouts ?? []).filter((t) => now - t < 30_000);
  recent.push(now);
  g.__tdbTimeouts = recent;
  if (recent.length >= 3 && g.__tdbSql) {
    const old = g.__tdbSql;
    g.__tdbSql = undefined;
    g.__tdbTimeouts = [];
    old.end({ timeout: 30 }).catch(() => {});
  }
}

export class TimeoutError extends Error {}

/** Rejects with a clear message if a database step takes too long, instead of hanging. */
export function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise<T>((_, reject) => {
      t = setTimeout(() => {
        noteTimeout();
        reject(new TimeoutError(`${what} took longer than ${Math.round(ms / 1000)} seconds.`));
      }, ms);
    }),
  ]);
}

/** Errors that are worth simply trying again (busy, dropped or slow connections). */
export function isRetryable(e: unknown) {
  if (e instanceof TimeoutError || e instanceof BadAnswerError) return true;
  const err = e as { code?: string; message?: string };
  const code = String(err?.code ?? '');
  const msg = String(err?.message ?? '');
  return (
    ['CONNECTION_CLOSED', 'CONNECTION_DESTROYED', 'CONNECTION_ENDED', 'CONNECT_TIMEOUT', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN',
      '57P01', '57P03', '53300', '53400', '08000', '08003', '08006', '08001', '08004', '55P03', '57014', '40001', '40P01'].includes(code) ||
    /too many (clients|connections)|remaining connection slots|Max client connections|connection terminated|server closed the connection|timeout/i.test(msg)
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs a database read with a time limit and automatic retries.
 * Example: await query((sql) => sql`select 1`, 'Checking')
 */
export async function query<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>, what: string, opts: { timeout?: number; retries?: number; expect?: string[] } = {}): Promise<T> {
  const retries = opts.retries ?? 2;
  for (let attempt = 0; ; attempt++) {
    try {
      const rows = await withTimeout(fn(db()), opts.timeout ?? 8000, what);
      if (opts.expect) checkShape(rows, opts.expect, what);
      return rows;
    } catch (e) {
      if (e instanceof BadAnswerError) freshPool(); // that connection is confused; start clean
      if (attempt >= retries || !isRetryable(e)) throw e;
      await sleep(300 * 2 ** attempt + Math.random() * 200);
    }
  }
}

/**
 * A database answer that doesn't have the columns the question asked for.
 * This happened on Vercel after a request was frozen mid-way: the next
 * question on that connection got a wrong answer. It is always retried on a
 * fresh connection, and never saved into the menu snapshot.
 */
export class BadAnswerError extends Error {}

function checkShape(rows: unknown, cols: string[], what: string) {
  if (!Array.isArray(rows)) return;
  for (const r of rows) {
    if (!r || typeof r !== 'object' || cols.some((c) => !(c in (r as Record<string, unknown>)))) {
      throw new BadAnswerError(`${what}: the database sent back an unexpected answer.`);
    }
  }
}

/** Start a brand-new connection pool (the old one finishes and closes on its own). */
export function freshPool() {
  const old = g.__tdbSql;
  g.__tdbSql = undefined;
  g.__tdbTimeouts = [];
  old?.end({ timeout: 10 }).catch(() => {});
}

/** Safety limits applied inside every transaction, so a stuck request can never hold the database. */
export const TX_LIMITS = "set local statement_timeout = '15s'; set local lock_timeout = '5s'; set local idle_in_transaction_session_timeout = '15s'";

/**
 * Runs a transaction with database-side safety limits. If this server freezes or
 * crashes mid-transaction, the database itself cancels it after 15 seconds and
 * frees the connection and any locks, so the site can't get stuck.
 */
export async function transaction<T>(fn: (tx: postgres.TransactionSql) => Promise<T>, what: string, opts: { timeout?: number; retries?: number } = {}): Promise<T> {
  const retries = opts.retries ?? 0;
  for (let attempt = 0; ; attempt++) {
    try {
      return await withTimeout(
        db().begin(async (tx) => {
          await tx.unsafe(TX_LIMITS);
          return fn(tx);
        }) as Promise<T>,
        opts.timeout ?? 20000,
        what,
      );
    } catch (e) {
      // Only retry when the database definitely did not save anything (lock wait, timeout, conflict).
      const code = String((e as { code?: string })?.code ?? '');
      const safe = ['55P03', '57014', '40001', '40P01', '53300', 'CONNECT_TIMEOUT', 'ECONNREFUSED'].includes(code);
      if (attempt >= retries || !safe) throw e;
      await sleep(400 * 2 ** attempt + Math.random() * 300);
    }
  }
}
