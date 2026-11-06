import { db } from './db';

export type CookieBox = { label: string; count: number; cents: number };

export type Settings = {
  business_name: string;
  tagline: string;
  logo_image_id: string | null;
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
  business_name: 'Tasteful Delights Bites',
  tagline: 'Small-batch cookies & honey bun cakes, baked with love in Mauldin, SC.',
  logo_image_id: null,
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

export async function getSettings(): Promise<Settings> {
  try {
    const rows = await db()<{ key: string; value: unknown }[]>`select key, value from settings`;
    const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const r of rows) s[r.key] = r.value;
    return s as Settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(patch: Partial<Settings>) {
  await db().begin(async (sql) => {
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === undefined) {
        await sql`insert into settings (key, value) values (${key}, 'null'::jsonb)
          on conflict (key) do update set value = excluded.value`;
      } else {
        await sql`insert into settings (key, value) values (${key}, ${sql.json(value as never)})
          on conflict (key) do update set value = excluded.value`;
      }
    }
  });
}
