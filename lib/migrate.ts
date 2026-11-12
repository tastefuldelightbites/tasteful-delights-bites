import { db, query, TX_LIMITS, withTimeout } from './db';
import { SCHEMA_STATEMENTS } from './schema';

/** Bump this whenever lib/schema.ts or the upgrades below change. */
export const SCHEMA_VERSION = 4;

/** Runs one statement in its own short transaction with safety limits. */
async function step(stmt: string, what: string) {
  await withTimeout(db().unsafe(`begin; ${TX_LIMITS}; ${stmt}; commit;`), 25000, what);
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

async function setVersion(v: number) {
  await query((sql) => sql`insert into settings (key, value) values ('schema_version', ${sql.json(v)})
    on conflict (key) do update set value = excluded.value`, 'Saving the database version');
}

/** Brings the database up to date, one version at a time. */
export async function migrate(from: number) {
  if (from < 3) { await upgradeTo3(); await setVersion(3); }
  if (from < 4) { await upgradeTo4(); await setVersion(4); }
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
