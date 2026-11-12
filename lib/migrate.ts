import { db, setupClient, withTimeout } from './db';
import { SCHEMA_STATEMENTS } from './schema';

/** Bump this whenever lib/schema.ts or the data fixes below change. */
export const SCHEMA_VERSION = 3;

const LIMITS = "set local lock_timeout = '8s'; set local statement_timeout = '20s';";

/** Small fixes to existing data, run once per version. Safe to repeat. */
async function dataFixes(sql: ReturnType<typeof setupClient>['sql']) {
  await sql.unsafe(`begin; ${LIMITS}
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
    commit;`);
}

/** Runs the full (idempotent) schema plus data fixes through the setup connection. */
export async function migrate() {
  const { sql } = setupClient();
  try {
    for (const stmt of SCHEMA_STATEMENTS) {
      await withTimeout(sql.unsafe(`begin; ${LIMITS} ${stmt}; commit;`), 25000, 'Updating the database');
    }
    await withTimeout(dataFixes(sql), 25000, 'Updating your data');
    await withTimeout(sql`insert into settings (key, value) values ('schema_version', ${sql.json(SCHEMA_VERSION)})
      on conflict (key) do update set value = excluded.value`, 15000, 'Saving the database version');
  } finally {
    sql.end({ timeout: 2 }).catch(() => {});
  }
}

let ensured: Promise<void> | null = null;

/**
 * Makes sure the database has everything this version of the site needs.
 * Checks a version number (one quick query); only upgrades when it's behind.
 */
export function ensureSchema(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      const rows = await withTimeout(db()`select value from settings where key = 'schema_version'`, 8000, 'Checking the database version');
      if (Number(rows[0]?.value ?? 0) >= SCHEMA_VERSION) return;
      await migrate();
    })().catch((e) => { ensured = null; throw e; });
  }
  return ensured;
}
