import { query, transaction } from './db';

/**
 * A cookie box size. count = how many cookies it holds.
 * flavor_ids = which cookie flavors customers can choose (empty = every cookie flavor on the menu).
 */
export type CookieBox = { label: string; count: number; cents: number; flavor_ids?: string[] };

/** The big homepage photo when the owner hasn't chosen one: the gourmet cookie box. */
export const DEFAULT_HERO_PHOTO = '/hero-cookies.jpg';

/** The repeating weekly order schedule. Days: 0 = Sunday … 6 = Saturday. Times are "HH:MM" (24-hour, South Carolina time). */
export type Weekly = {
  enabled: boolean;
  title: string;
  open_day: number;
  open_time: string;
  close_day: number;
  close_time: string;
  pickup_day: number;
  pickup_hours: string;
};

export const DEFAULT_WEEKLY: Weekly = {
  enabled: true,
  title: 'Weekly Orders',
  open_day: 3,
  open_time: '00:00',
  close_day: 0,
  close_time: '23:59',
  pickup_day: 6,
  pickup_hours: '10am – 4pm',
};

export const DEFAULT_CARE = `Cookies: Keep in an airtight container at room temperature and enjoy within 3 to 4 days. For that fresh-baked feel, warm a cookie in the microwave for 8 to 10 seconds. To freeze, wrap well and freeze up to 2 months.

Honey bun cakes: Keep covered at room temperature for up to 2 days, or in the refrigerator for up to 5 days. Warm a slice for 10 to 15 seconds before serving. To freeze, wrap tightly and freeze up to 1 month.`;

export type Settings = {
  weekly: Weekly;
  hero_product_id: string | null;
  notify_email: string;
  care_instructions: string;
  ntfy_topic: string;
  business_name: string;
  tagline: string;
  logo_image_id: string | null;
  /** Big homepage photo (inside the arch). null = the gourmet cookie photo. */
  hero_image_id: string | null;
  /** Words under the homepage photo. */
  hero_caption: string;
  cashapp: string;
  zelle: string;
  applepay: string;
  payment_note: string;
  contact_phone: string;
  contact_email: string;
  instagram: string;
  pickup_place: string;
  pickup_address: string;
  cookie_boxes: CookieBox[];
  delivery_enabled: boolean;
  delivery_tiers: { max_miles: number; cents: number }[];
};

export const DEFAULT_SETTINGS: Settings = {
  weekly: DEFAULT_WEEKLY,
  hero_product_id: null,
  notify_email: 'orders@tastefuldelightsbites.com',
  care_instructions: DEFAULT_CARE,
  ntfy_topic: '',
  business_name: 'Tasteful Delights Bites',
  tagline: 'Small-batch cookies & honey bun cakes, baked with love in Mauldin, SC.',
  logo_image_id: null,
  hero_image_id: null,
  hero_caption: 'Gourmet Cookies',
  cashapp: '',
  zelle: '',
  applepay: '',
  payment_note: 'Please send payment within 24 hours and include your order number in the note.',
  contact_phone: '',
  contact_email: '',
  instagram: '',
  pickup_place: 'Publix',
  pickup_address: '111 W Butler Rd, Mauldin, SC 29662',
  cookie_boxes: [
    { label: 'Single', count: 1, cents: 500 },
    { label: 'Box of 4', count: 4, cents: 1800 },
    { label: 'Dozen', count: 12, cents: 4200 },
  ],
  delivery_enabled: true,
  delivery_tiers: [
    { max_miles: 10, cents: 500 },
    { max_miles: 20, cents: 1000 },
  ],
};

/**
 * Reads all settings (with a time limit and automatic retries).
 * If the database can't be reached, this throws instead of quietly returning
 * blank defaults, so nothing is ever saved over your real settings by mistake.
 */
export async function getSettings(): Promise<Settings> {
  const rows = await query((sql) => sql<{ key: string; value: unknown }[]>`select key, value from settings`, 'Loading settings');
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.value;
  s.weekly = { ...DEFAULT_WEEKLY, ...((s.weekly as Partial<Weekly>) ?? {}) };
  return s as Settings;
}

export async function saveSettings(patch: Partial<Settings>) {
  await transaction(async (sql) => {
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === undefined) {
        await sql`insert into settings (key, value) values (${key}, 'null'::jsonb)
          on conflict (key) do update set value = excluded.value`;
      } else {
        await sql`insert into settings (key, value) values (${key}, ${sql.json(value as never)})
          on conflict (key) do update set value = excluded.value`;
      }
    }
  }, 'Saving settings', { retries: 2 });
}
