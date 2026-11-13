import { unstable_cache } from 'next/cache';
import { getActiveHolidays, getHolidayTitles, getMenu, getNextDrop, getNextWeeklyDrop, getOpenDrops, getProducts, type Drop, type MenuProduct, type Product } from './menu';
import { getSettings, type Settings } from './settings';
import { query } from './db';

/**
 * Customer pages read the menu from a shared snapshot that refreshes about
 * every 20 seconds (and right away whenever the owner changes something or an
 * order comes in). 50 people opening the site at once cost about one database
 * read instead of hundreds. Checkout always re-checks prices and amounts live.
 */
export const SHOP_TAG = 'shop';

export type ShopData =
  | { state: 'missing' }
  | { state: 'ready'; settings: Settings; openDrops: Drop[]; next: Drop | null; nextWeekly: Drop | null; products: Product[]; holidays: Drop[]; holidayTitles: string[]; loadedAt: number };

const READY_SQL = "select to_regclass('public.orders') as t, to_regclass('public.daily_visitors') as v";

/**
 * A wrong-shaped database answer must never be saved in the shared snapshot
 * (it would be shown to every customer for a while). Throwing here means the
 * last good snapshot keeps being used instead.
 */
function check(ok: boolean, what: string) {
  if (!ok) throw new Error(`${what}: the database sent back an unexpected answer.`);
}
const isDrop = (d: unknown) => !!d && typeof (d as Drop).id === 'string' && typeof (d as Drop).pickup_date === 'string' && typeof (d as Drop).kind === 'string';
const isProduct = (p: unknown) => !!p && typeof (p as Product).id === 'string' && typeof (p as Product).name === 'string' && typeof (p as Product).section === 'string';

async function loadShop(): Promise<ShopData> {
  const r = await query((sql) => sql.unsafe(READY_SQL), 'Checking the database');
  check(Array.isArray(r) && r.length === 1 && 't' in r[0] && 'v' in r[0], 'Checking the database');
  if (!(r[0].t && r[0].v)) return { state: 'missing' };
  const [settings, openDrops, next, nextWeekly, products, holidays, holidayTitles] = await Promise.all([
    getSettings(), getOpenDrops(), getNextDrop(), getNextWeeklyDrop(), getProducts(), getActiveHolidays(), getHolidayTitles(),
  ]);
  check(!!settings && typeof settings === 'object' && !!settings.weekly && Array.isArray(settings.cookie_boxes), 'Loading settings');
  check(openDrops.every(isDrop) && holidays.every(isDrop) && (!next || isDrop(next)) && (!nextWeekly || isDrop(nextWeekly)), 'Loading order dates');
  check(products.every(isProduct), 'Loading the menu');
  return { state: 'ready', settings, openDrops, next, nextWeekly, products, holidays, holidayTitles, loadedAt: Date.now() };
}

const cachedShop = unstable_cache(loadShop, ['shop-data-v5'], { revalidate: 20, tags: [SHOP_TAG] });

const cachedMenu = unstable_cache(
  async (dropId: string | null): Promise<MenuProduct[]> => {
    if (!dropId) return getMenu(null);
    const data = await cachedShop();
    const drop = data.state === 'ready' ? [...data.openDrops, ...data.holidays].find((d) => d.id === dropId) ?? null : null;
    const menu = await getMenu(drop);
    check(menu.every(isProduct), 'Loading the menu');
    return menu;
  },
  ['shop-menu-v5'],
  { revalidate: 20, tags: [SHOP_TAG] },
);

// The last good copy on this server, used if the database has a hiccup.
const g = globalThis as unknown as { __tdbShop?: Extract<ShopData, { state: 'ready' }>; __tdbMenus?: Map<string, MenuProduct[]> };

/** Menu, settings and open Drops for customer pages. Never shows "not set up" because of a slow moment. */
export async function getShopData(): Promise<ShopData | { state: 'error' }> {
  try {
    const d = await cachedShop();
    if (d.state === 'ready') g.__tdbShop = d;
    // "Almost ready" is only for a site that was never set up: if this server
    // has seen the menu before, keep showing it.
    if (d.state === 'missing' && g.__tdbShop) return g.__tdbShop;
    return d;
  } catch (e) {
    console.error('Shop data failed, using the last good copy if there is one', e);
    return g.__tdbShop ?? { state: 'error' };
  }
}

export async function getShopMenu(dropId: string | null): Promise<MenuProduct[] | null> {
  const key = dropId ?? 'none';
  g.__tdbMenus ??= new Map();
  try {
    const m = await cachedMenu(dropId);
    g.__tdbMenus.set(key, m);
    return m;
  } catch (e) {
    console.error('Menu failed, using the last good copy if there is one', e);
    return g.__tdbMenus.get(key) ?? null;
  }
}
