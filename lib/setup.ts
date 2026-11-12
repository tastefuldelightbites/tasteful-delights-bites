import { db, query, transaction, withTimeout } from './db';
import { SCHEMA_STATEMENTS } from './schema';
import { applyDataFixes, upgradeTo4 } from './migrate';

const READY_SQL = "select to_regclass('public.orders') as t, to_regclass('public.daily_visitors') as v";

/**
 * Admin check: can we reach the database, and are the tables there?
 * Uses the shared pool with a time limit and retries. Never hangs.
 */
export async function checkDatabase(): Promise<{ ready: boolean; error?: string }> {
  try {
    const r = await query((sql) => sql.unsafe(READY_SQL), 'Connecting to the database');
    return { ready: Boolean(r[0]?.t && r[0]?.v) };
  } catch (e) {
    return { ready: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Customer pages: "ready" (tables exist), "missing" (setup never run) or
 * "error" (database busy or unreachable right now, so try again; it does NOT mean "not set up").
 */
export async function databaseState(): Promise<'ready' | 'missing' | 'error'> {
  try {
    const r = await query((sql) => sql.unsafe(READY_SQL), 'Checking the database');
    return r[0]?.t && r[0]?.v ? 'ready' : 'missing';
  } catch {
    return 'error';
  }
}

export async function isDatabaseReady(): Promise<boolean> {
  return (await databaseState()) === 'ready';
}

const STARTING_COOKIES = [
  ['Milk Chocolate', 'Gooey milk chocolate chunks in a buttery, golden cookie.'],
  ["S'mores", 'Graham cracker, toasted marshmallow and chocolate in every bite.'],
  ['Red Velvet with White Chocolate', 'Velvety cocoa cookie loaded with creamy white chocolate.'],
  ['Cookies n Cream', 'Crushed chocolate sandwich cookies folded into a sweet cream cookie.'],
  ['Sweet Potato', 'Warm spices and real sweet potato — a Southern favorite.'],
  ['Snickerdoodle', 'Soft and chewy, rolled in cinnamon sugar.'],
];

const STARTING_CAKES = [
  ['Original Honey Bun Cake', 'Moist cinnamon swirl cake finished with a sweet vanilla glaze.'],
  ['Red Velvet Honey Bun Cake', 'Our honey bun cake with a red velvet twist and sweet vanilla glaze.'],
  ['Strawberry Honey Bun Cake', 'Bright strawberry swirl with a glossy sweet glaze.'],
];

/**
 * Setup is split into many small steps so each request to the website is quick:
 *   step 0      clear out any stuck setup work left over from earlier tries
 *   steps 1..N  create each table (one statement each)
 *   last step   add the starting menu
 */
export const SETUP_STEP_COUNT = SCHEMA_STATEMENTS.length + 2;

async function withSetupClient<T>(what: string, fn: (sql: ReturnType<typeof db>) => Promise<T>): Promise<T> {
  try {
    return await withTimeout(fn(db()), 25000, what);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${what}: ${msg}`);
  }
}

export async function runSetupStep(i: number) {
  if (i === 0) {
    // Earlier setup attempts may have left table-creating work stuck in the
    // database, holding connections open. End only those (this site's own
    // setup work that has been running for over 20 seconds).
    await withSetupClient('Clearing stuck setup work', (sql) => sql`
      select count(pg_terminate_backend(pid))::int as n
      from pg_stat_activity
      where usename = current_user
        and pid <> pg_backend_pid()
        and datname = current_database()
        and state <> 'idle'
        and now() - coalesce(xact_start, query_start) > interval '20 seconds'
        and (query ~* '^\\s*(begin;\\s*)?(set local|create |alter table|select to_regclass)' or state like 'idle in transaction%')`);
    return;
  }
  if (i <= SCHEMA_STATEMENTS.length) {
    const stmt = SCHEMA_STATEMENTS[i - 1];
    const label = stmt.split('\n')[0].replace(/\s*\($/, '').slice(0, 60);
    await withSetupClient(`Step ${i + 1} (${label})`, () => transaction(async (tx) => { await tx.unsafe(stmt); }, `Step ${i + 1}`, { timeout: 25000 }));
    return;
  }
  await seedMenu();
}

/** Adds the starting menu, only if the menu is empty. */
async function seedMenu() {
  await upgradeTo4();
  await withSetupClient('Adding your starting menu', async (sql) => {
    await sql`insert into settings (key, value) values ('tags_seeded', 'true'::jsonb) on conflict do nothing`;
    const [{ n }] = await sql`select count(*)::int as n from products`;
    if (n > 0) return;
    const sizes = [{ label: 'Small', cents: 1500 }, { label: 'Large', cents: 3500 }];
    await transaction(async (tx) => {
      let k = 0;
      for (const [name, description] of STARTING_COOKIES) {
        await tx`insert into products (kind, section, name, description, sort_order)
          values ('cookie', 'Cookies', ${name}, ${description}, ${k++})`;
      }
      for (const [name, description] of STARTING_CAKES) {
        await tx`insert into products (kind, section, name, description, options, sort_order)
          values ('item', 'Honey Bun Cakes', ${name}, ${description}, ${tx.json(sizes)}, ${k++})`;
      }
    }, 'Adding your starting menu');
  });
  // Holiday menus, Thanksgiving items and the database version number.
  await withSetupClient('Adding your holiday menus', () => applyDataFixes());
}

/** Runs every step in one go (used for local testing). The first Drop is created by the owner in Admin → Drops. */
export async function runSetup() {
  for (let i = 0; i < SETUP_STEP_COUNT; i++) await runSetupStep(i);
}

/** The complete setup as one block of SQL, for pasting into Supabase's SQL Editor (backup method). */
export function fullSetupSql(): string {
  const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
  const rows = [
    ...STARTING_COOKIES.map(([n, d], i) => `('cookie', 'Cookies', ${q(n)}, ${q(d)}, '[]'::jsonb, ${i})`),
    ...STARTING_CAKES.map(([n, d], i) => `('item', 'Honey Bun Cakes', ${q(n)}, ${q(d)}, '[{"label":"Small","cents":1500},{"label":"Large","cents":3500}]'::jsonb, ${STARTING_COOKIES.length + i})`),
  ];
  return `-- Tasteful Delights Bites: database setup (safe to run more than once)
${SCHEMA_STATEMENTS.map((x) => x + ';').join('\n\n')}

insert into products (kind, section, name, description, options, sort_order)
select * from (values
  ${rows.join(',\n  ')}
) as v(kind, section, name, description, options, sort_order)
where not exists (select 1 from products);
`;
}
