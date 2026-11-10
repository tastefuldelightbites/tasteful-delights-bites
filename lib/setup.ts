import { db, withTimeout } from './db';
import { SCHEMA_STATEMENTS } from './schema';

/** Checks the database: can we reach it, and are the tables there? Never hangs. */
export async function checkDatabase(): Promise<{ ready: boolean; error?: string }> {
  try {
    const r = await withTimeout(
      db()`select to_regclass('public.orders') as t, to_regclass('public.daily_visitors') as v`,
      12000, 'Connecting to the database',
    );
    return { ready: Boolean(r[0]?.t && r[0]?.v) };
  } catch (e) {
    return { ready: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function isDatabaseReady(): Promise<boolean> {
  return (await checkDatabase()).ready;
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
  ['Red Velvet Honey Bun Cake', 'Our honey bun cake with a red velvet twist and cream cheese glaze.'],
  ['Strawberry Honey Bun Cake', 'Bright strawberry swirl with a glossy sweet glaze.'],
];

/** Setup is split into many small steps so each request to the website is quick. */
export const SETUP_STEP_COUNT = SCHEMA_STATEMENTS.length + 1;

export async function runSetupStep(i: number) {
  if (i < SCHEMA_STATEMENTS.length) {
    const stmt = SCHEMA_STATEMENTS[i];
    const label = stmt.split('\n')[0].replace(/\s*\($/, '').slice(0, 60);
    await withTimeout(db().unsafe(stmt), 15000, `Setup step ${i + 1} (${label})`);
    return;
  }
  await seedMenu();
}

/** Adds the starting menu, only if the menu is empty. */
async function seedMenu() {
  const sql = db();
  const [{ n }] = await withTimeout(sql`select count(*)::int as n from products`, 15000, 'Checking the menu');
  if (n > 0) return;
  const sizes = [{ label: 'Small', cents: 1500 }, { label: 'Large', cents: 3500 }];
  await withTimeout(sql.begin(async (tx) => {
    let i = 0;
    for (const [name, description] of STARTING_COOKIES) {
      await tx`insert into products (kind, section, name, description, sort_order)
        values ('cookie', 'Cookies', ${name}, ${description}, ${i++})`;
    }
    for (const [name, description] of STARTING_CAKES) {
      await tx`insert into products (kind, section, name, description, options, sort_order)
        values ('item', 'Honey Bun Cakes', ${name}, ${description}, ${tx.json(sizes)}, ${i++})`;
    }
  }), 20000, 'Adding your starting menu');
}

/** Runs every step in one go (used for local testing). The first Drop is created by the owner in Admin → Drops. */
export async function runSetup() {
  for (let i = 0; i < SETUP_STEP_COUNT; i++) await runSetupStep(i);
}
