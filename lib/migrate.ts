import { db, query, transaction, withTimeout } from './db';
import { SCHEMA_STATEMENTS } from './schema';

/** Bump this whenever lib/schema.ts or the upgrades below change. */
export const SCHEMA_VERSION = 5;

/** Runs one statement in its own short transaction with safety limits. */
async function step(stmt: string, what: string) {
  await transaction(async (tx) => { await tx.unsafe(stmt); }, what, { timeout: 25000 });
}

/** Version 3: tables and columns for the weekly schedule, emails and the email list, plus small data fixes. */
async function upgradeTo3() {
  for (const stmt of SCHEMA_STATEMENTS) await step(stmt, 'Updating the database');
  await step(`
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
        and d.id = (select y.id from drops y where y.title = 'Weekly Drop' and y.pickup_date = d.pickup_date order by y.created_at limit 1)`, 'Updating your data');
}

/**
 * Version 4: database-side safety limits for every connection the website
 * uses. If a request is ever cut off in the middle of its work, the database
 * cancels it on its own instead of holding a connection forever.
 */
export async function upgradeTo4() {
  for (const stmt of [
    "alter role current_user set idle_in_transaction_session_timeout = '20s'",
    "alter role current_user set statement_timeout = '30s'",
  ]) {
    try {
      await withTimeout(db().unsafe(stmt), 10000, 'Adding safety limits');
    } catch (e) {
      console.error('Could not set role safety limit (the per-transaction limits still apply):', e);
    }
  }
}

/**
 * Version 5: email moves to orders@tastefuldelightsbites.com; holiday menus
 * lose the word "Drop"; Thanksgiving and Christmas Boxes menus are added with
 * starter dates (the owner can change them in Admin > Order Dates), plus the
 * two Thanksgiving boxes from the flyer.
 */
async function upgradeTo5() {
  await step(`
    update settings set value = '"orders@tastefuldelightsbites.com"'::jsonb
      where key = 'notify_email' and (value::text ilike '%gmail.com%' or value::text = '""');
    update drops set title = regexp_replace(title, '\\s*drop$', '', 'i')
      where kind = 'holiday' and title ~* '\\sdrop$';
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
    insert into settings (key, value) values ('menu_seed_v5', 'true'::jsonb) on conflict do nothing`, 'Updating your menu');
}

async function setVersion(v: number) {
  await query((sql) => sql`insert into settings (key, value) values ('schema_version', ${sql.json(v)})
    on conflict (key) do update set value = excluded.value`, 'Saving the database version');
}

/** Brings the database up to date, one version at a time. */
export async function migrate(from: number) {
  if (from < 3) { await upgradeTo3(); await setVersion(3); }
  if (from < 4) { await upgradeTo4(); await setVersion(4); }
  if (from < 5) { await upgradeTo5(); await setVersion(5); }
}

let ensured: Promise<void> | null = null;
let lastFailure = 0;

/**
 * Makes sure the database has everything this version of the site needs.
 * One quick check per server instance; upgrades only when behind. After a
 * failed upgrade it waits a minute before trying again (never a retry storm).
 */
export function ensureSchema(): Promise<void> {
  if (!ensured) {
    if (Date.now() - lastFailure < 60_000) return Promise.resolve();
    ensured = (async () => {
      const rows = await query((sql) => sql`select value from settings where key = 'schema_version'`, 'Checking the database version');
      const v = Number(rows[0]?.value ?? 0);
      if (v >= SCHEMA_VERSION) return;
      await migrate(v);
    })().catch((e) => {
      ensured = null;
      lastFailure = Date.now();
      console.error('Database upgrade failed (will try again in a minute):', e);
    });
  }
  return ensured;
}
