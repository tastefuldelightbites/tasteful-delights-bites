import postgres from 'postgres';

// Finds the database address. When Supabase is connected through Vercel,
// Vercel fills these in automatically.
function findDatabaseUrl(): string | undefined {
  const preferred = ['POSTGRES_URL', 'DATABASE_URL', 'SUPABASE_DB_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL_NON_POOLING'];
  for (const k of preferred) if (process.env[k]) return process.env[k];
  // Vercel may add a custom prefix, e.g. STORAGE_POSTGRES_URL
  const key = Object.keys(process.env).find((k) => k.endsWith('_POSTGRES_URL'));
  return key ? process.env[key] : undefined;
}

export function databaseConfigured() {
  return Boolean(findDatabaseUrl());
}

function makeClient() {
  const raw = findDatabaseUrl();
  if (!raw) throw new Error('Database is not connected yet (no POSTGRES_URL found).');
  const u = new URL(raw);
  // Strip extra query options (sslmode, supa, pgbouncer...) and set SSL ourselves.
  u.search = '';
  return postgres(u.toString(), {
    ssl: u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? false : 'require',
    prepare: false, // required for Supabase's connection pooler
    max: 3,
    idle_timeout: 20,
  });
}

const g = globalThis as unknown as { __tdbSql?: ReturnType<typeof postgres> };

export function db() {
  if (!g.__tdbSql) g.__tdbSql = makeClient();
  return g.__tdbSql;
}
