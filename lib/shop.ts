import { unstable_cache } from 'next/cache';
import { getMenu, getNextDrop, getOpenDrops, getProducts, type Drop, type MenuProduct, type Product } from './menu';
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
  | { state: 'ready'; settings: Settings; openDrops: Drop[]; next: Drop | null; products: Product[]; loadedAt: number };

const READY_SQL = "select to_regclass('public.orders') as t, to_regclass('public.daily_visitors') as v";

async function loadShop(): Promise<ShopData> {
  const r = await query((sql) => sql.unsafe(READY_SQL), 'Checking the database');
  if (!(r[0]?.t && r[0]?.v)) return { state: 'missing' };
  const [settings, openDrops, next, products] = await Promise.all([getSettings(), getOpenDrops(), getNextDrop(), getProducts()]);
  return { state: 'ready', settings, openDrops, next, products, loadedAt: Date.now() };
}

const cachedShop = unstable_cache(loadShop, ['shop-data-v1'], { revalidate: 20, tags: [SHOP_TAG] });

const cachedMenu = unstable_cache(
  async (dropId: string | null): Promise<MenuProduct[]> => {
    if (!dropId) return getMenu(null);
    const data = await cachedShop();
    const drop = data.state === 'ready' ? data.openDrops.find((d) => d.id === dropId) ?? null : null;
    return getMenu(drop);
  },
  ['shop-menu-v1'],
  { revalidate: 20, tags: [SHOP_TAG] },
);

// The last good copy on this server, used if the database has a hiccup.
const g = globalThis as unknown as { __tdbShop?: Extract<ShopData, { state: 'ready' }>; __tdbMenus?: Map<string, MenuProduct[]> };

/** Menu, settings and open Drops for customer pages. Never shows "not set up" because of a slow moment. */
export async function getShopData(): Promise<ShopData | { state: 'error' }> {
  try {
    const d = await cachedShop();
    if (d.state === 'ready') g.__tdbShop = d;
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
