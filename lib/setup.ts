import { db } from './db';
import { SCHEMA_SQL } from './schema';
import { standardDropFor } from './time';

export async function isDatabaseReady(): Promise<boolean> {
  try {
    const r = await db()`select to_regclass('public.orders') as t, to_regclass('public.daily_visitors') as v`;
    return Boolean(r[0]?.t && r[0]?.v);
  } catch {
    return false;
  }
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

export async function runSetup() {
  const sql = db();
  await sql.unsafe(SCHEMA_SQL);

  const [{ n }] = await sql`select count(*)::int as n from products`;
  if (n === 0) {
    let i = 0;
    for (const [name, description] of STARTING_COOKIES) {
      await sql`insert into products (kind, section, name, description, sort_order)
        values ('cookie', 'Cookies', ${name}, ${description}, ${i++})`;
    }
    const sizes = [{ label: 'Small', cents: 1500 }, { label: 'Large', cents: 3500 }];
    for (const [name, description] of STARTING_CAKES) {
      await sql`insert into products (kind, section, name, description, options, sort_order)
        values ('item', 'Honey Bun Cakes', ${name}, ${description}, ${sql.json(sizes)}, ${i++})`;
    }
  }

  const [{ d }] = await sql`select count(*)::int as d from drops`;
  if (d === 0) {
    const w = standardDropFor();
    await sql`insert into drops (title, opens_at, closes_at, pickup_date)
      values ('Weekly Drop', ${w.opens_at}, ${w.closes_at}, ${w.pickup_date})`;
  }
}
