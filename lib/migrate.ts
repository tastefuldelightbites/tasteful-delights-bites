import { query, transaction } from './db';
import { SCHEMA_STATEMENTS } from './schema';

/** Bump this whenever lib/schema.ts or the upgrades below change. */
export const SCHEMA_VERSION = 7;

/* ------------------------------------------------------------------ */
/* Which table changes are actually missing?                          */
/* ------------------------------------------------------------------ */

type DbShape = { rels: Map<string, { rls: boolean }>; cols: Set<string> };

/** Reads the current database layout in two quick queries (no locks taken). */
async function readShape(): Promise<DbShape> {
  const [rels, cols] = await Promise.all([
    query((sql) => sql<{ relname: string; rls: boolean }[]>`
      select c.relname, c.relrowsecurity as rls from pg_class c
      join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'`, 'Checking the database layout'),
    query((sql) => sql<{ t: string; c: string }[]>`
      select table_name as t, column_name as c from information_schema.columns where table_schema = 'public'`, 'Checking the database layout'),
  ]);
  return {
    rels: new Map(rels.map((r) => [r.relname, { rls: r.rls }])),
    cols: new Set(cols.map((r) => `${r.t}.${r.c}`)),
  };
}

/**
 * True when a layout statement still has work to do. Statements that are
 * already done are skipped, so an up-to-date database is never locked by
 * "alter table" just to find out nothing needed changing.
 */
export function statementNeeded(stmt: string, shape: DbShape): boolean {
  const s = stmt.replace(/\s+/g, ' ').trim().toLowerCase();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^create (?:table|sequence|(?:unique )?index) if not exists (\w+)/))) return !shape.rels.has(m[1]);
  if ((m = s.match(/^alter table (\w+) add column if not exists (\w+)/))) return !shape.cols.has(`${m[1]}.${m[2]}`);
  if ((m = s.match(/^alter table (\w+) enable row level security$/))) return !shape.rels.get(m[1])?.rls;
  return true; // anything else: run it to be safe
}

/** The layout statements this database still needs (usually none). */
export async function missingStatements(): Promise<string[]> {
  const shape = await readShape();
  return SCHEMA_STATEMENTS.filter((stmt) => statementNeeded(stmt, shape));
}

/* ------------------------------------------------------------------ */
/* Upgrades                                                            */
/* ------------------------------------------------------------------ */

/** Database-side safety limits for the website's own login (only set once). */
export async function upgradeTo4() {
  try {
    const done = await query((sql) => sql`
      select 1 from pg_db_role_setting s join pg_roles r on r.oid = s.setrole
      where r.rolname = current_user and array_to_string(s.setconfig, ',') like '%idle_in_transaction_session_timeout%'`, 'Checking safety limits');
    if (done.length) return;
  } catch { /* fall through and try to set them */ }
  for (const stmt of [
    "alter role current_user set idle_in_transaction_session_timeout = '20s'",
    "alter role current_user set statement_timeout = '30s'",
  ]) {
    try {
      await query((sql) => sql.unsafe(stmt), 'Adding safety limits', { timeout: 5000, retries: 0 });
    } catch (e) {
      console.error('Could not set role safety limit (the per-transaction limits still apply):', e);
    }
  }
}

/**
 * Data fixes from every version, all safe to repeat. They run together in ONE
 * short transaction that also saves the new version number, so an upgrade
 * either fully finishes or changes nothing.
 */
const DATA_FIXES = `
  update products set tags = '{fan-fave}' where name in ('Milk Chocolate', 'Original Honey Bun Cake') and tags = '{}'
    and not exists (select 1 from settings where key = 'tags_seeded');
  update products set tags = '{new}' where name in ('Sweet Potato', 'Strawberry Honey Bun Cake') and tags = '{}'
    and not exists (select 1 from settings where key = 'tags_seeded');
  insert into settings (key, value) values ('tags_seeded', 'true'::jsonb) on conflict do nothing;
  update products set description = 'Our honey bun cake with a red velvet twist and sweet vanilla glaze.'
    where name = 'Red Velvet Honey Bun Cake' and description ilike '%cream cheese glaze%';
  update drops d set kind = 'weekly'
    where d.kind = 'holiday' and d.title = 'Weekly Drop'
      and not exists (select 1 from drops x where x.kind = 'weekly' and x.pickup_date = d.pickup_date)
      and d.id = (select y.id from drops y where y.title = 'Weekly Drop' and y.pickup_date = d.pickup_date order by y.created_at limit 1);

  -- Email moves to orders@tastefuldelightsbites.com.
  update settings set value = '"orders@tastefuldelightsbites.com"'::jsonb
    where key = 'notify_email' and (value::text ilike '%gmail.com%' or value::text = '""');
  -- Holiday menus lose the word "Drop"; their name is their menu category.
  update drops set title = regexp_replace(title, '\\s*drop$', '', 'i')
    where kind = 'holiday' and title ~* '\\sdrop$';
  -- Starter holiday menus (the owner can change the dates in Admin > Order Dates).
  insert into drops (kind, title, opens_at, closes_at, pickup_date, pickup_hours)
    select 'holiday', 'Thanksgiving', now(), '2026-11-22 23:59:59 America/New_York'::timestamptz, '2026-11-24', '10am – 4pm'
    where not exists (select 1 from drops where kind = 'holiday' and title ilike 'thanksgiving%' and closes_at > now())
      and not exists (select 1 from settings where key = 'menu_seed_v5');
  insert into drops (kind, title, opens_at, closes_at, pickup_date, pickup_hours)
    select 'holiday', 'Christmas Boxes', '2026-12-01 00:00:00 America/New_York'::timestamptz, '2026-12-20 23:59:59 America/New_York'::timestamptz, '2026-12-23', '10am – 4pm'
    where not exists (select 1 from drops where kind = 'holiday' and title ilike 'christmas%' and closes_at > now())
      and not exists (select 1 from settings where key = 'menu_seed_v5');
  insert into products (kind, section, name, description, options, tags, sort_order)
    select 'item', 'Thanksgiving', v.name, v.description, v.options::jsonb, '{new}', v.sort
    from (values
      ('The Thanksgiving Box', 'For smaller tables: 1 dozen gourmet cookies plus a small honey bun cake. Tell us your cookie and cake flavors in the order notes.', '[{"label":"Box","cents":5500}]', 900),
      ('The Thanksgiving Collection', 'Best value for the family: 2 dozen gourmet cookies plus a large honey bun cake. Tell us your cookie and cake flavors in the order notes.', '[{"label":"Collection","cents":11000}]', 901)
    ) as v(name, description, options, sort)
    where not exists (select 1 from products where section ilike 'thanksgiving')
      and not exists (select 1 from settings where key = 'menu_seed_v5');
  insert into settings (key, value) values ('menu_seed_v5', 'true'::jsonb) on conflict do nothing;

  -- Flavor picks: the Thanksgiving boxes let customers choose their cookie and cake flavors on the website.
  update products set
      picks = case when name ilike '%collection%'
        then '{"cookies":24,"cookie_ids":[],"cakes":1,"cake_ids":[],"cake_size":"Large"}'::jsonb
        else '{"cookies":12,"cookie_ids":[],"cakes":1,"cake_ids":[],"cake_size":"Small"}'::jsonb end,
      description = replace(description, ' Tell us your cookie and cake flavors in the order notes.', ' Choose your cookie and cake flavors when you add it to your order.')
    where section ilike 'thanksgiving' and picks is null and name in ('The Thanksgiving Box', 'The Thanksgiving Collection')
      and not exists (select 1 from settings where key = 'picks_seed_v7');
  -- Homepage photo: the Gourmet Cookies photo with its caption.
  delete from settings where key in ('hero_image_id', 'hero_caption') and not exists (select 1 from settings where key = 'picks_seed_v7');
  insert into settings (key, value) values ('picks_seed_v7', 'true'::jsonb) on conflict do nothing`;

/* ------------------------------------------------------------------ */
/* Running the upgrade                                                 */
/* ------------------------------------------------------------------ */

export async function readVersion(): Promise<number> {
  const rows = await query((sql) => sql`select value from settings where key = 'schema_version'`, 'Checking the database version');
  return Number(rows[0]?.value ?? 0);
}

/**
 * Only one server works on the upgrade at a time. The "lease" is a row in
 * settings that expires by itself after 2 minutes, in case a server is
 * stopped halfway.
 */
async function takeLease(): Promise<boolean> {
  const rows = await query((sql) => sql`
    insert into settings (key, value) values ('upgrade_lease', to_jsonb(now()::text))
    on conflict (key) do update set value = excluded.value
      where (settings.value #>> '{}')::timestamptz < now() - interval '2 minutes'
    returning 1`, 'Starting the database update', { retries: 1 });
  return rows.length > 0;
}

async function releaseLease() {
  await query((sql) => sql`delete from settings where key = 'upgrade_lease'`, 'Finishing the database update').catch(() => {});
}

/** Every data fix plus the new version number, in one short transaction. */
export async function applyDataFixes() {
  await transaction(async (tx) => {
    await tx.unsafe(DATA_FIXES);
    await tx`insert into settings (key, value) values ('schema_version', ${tx.json(SCHEMA_VERSION)})
      on conflict (key) do update set value = excluded.value`;
  }, 'Updating your menu', { timeout: 20000, retries: 2 });
}

export type UpgradeResult = { done: boolean; ran: number; message: string };

/**
 * Brings the database up to date quickly:
 *   1. read the layout and run only the table changes that are missing
 *      (on an existing site this is usually nothing at all),
 *   2. one short transaction with every data fix + the new version number.
 */
export async function migrate(opts: { force?: boolean } = {}): Promise<UpgradeResult> {
  if (!(await takeLease())) {
    if (!opts.force) return { done: false, ran: 0, message: 'Another part of the website is updating the database right now.' };
    await releaseLease();
    if (!(await takeLease())) return { done: false, ran: 0, message: 'The database update is already running. Please wait a minute.' };
  }
  try {
    const todo = await missingStatements();
    for (const stmt of todo) {
      await transaction(async (tx) => { await tx.unsafe(stmt); }, 'Updating the database', { timeout: 20000, retries: 2 });
    }
    await upgradeTo4();
    await applyDataFixes();
    console.log(`Database update finished (${todo.length} table changes were needed).`);
    return { done: true, ran: todo.length, message: 'Your database is up to date.' };
  } finally {
    await releaseLease();
  }
}

let ensured: Promise<void> | null = null;
let lastFailure = 0;

/**
 * Makes sure the database has everything this version of the site needs.
 * One quick check per server; the upgrade runs only when behind.
 *
 * Pages never wait more than a second or two for it: if the upgrade is still
 * working, the page carries on (every table it uses already exists on a
 * set-up site) and the upgrade finishes on its own.
 */
export function ensureSchema(maxWaitMs = 1500): Promise<void> {
  if (!ensured) {
    if (Date.now() - lastFailure < 60_000) return Promise.resolve();
    ensured = (async () => {
      if ((await readVersion()) >= SCHEMA_VERSION) return;
      const r = await migrate();
      if (!r.done) { ensured = null; lastFailure = Date.now() - 45_000; } // check again in ~15 seconds
    })().catch((e) => {
      ensured = null;
      lastFailure = Date.now();
      console.error('Database update failed (will try again in a minute):', e);
    });
  }
  const p = ensured;
  if (maxWaitMs <= 0) return p;
  return Promise.race([p, new Promise<void>((r) => setTimeout(r, maxWaitMs))]);
}
