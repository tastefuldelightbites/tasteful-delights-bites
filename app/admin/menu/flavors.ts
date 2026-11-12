import { getProducts } from '@/lib/menu';
import { isCakeFlavor } from '@/lib/picks';

/** Cookie flavors and honey bun cake flavors on the menu (for "Pick your flavors" settings). */
export async function flavorLists() {
  const all = await getProducts(true);
  return {
    cookies: all.filter((p) => p.kind === 'cookie').map((p) => ({ id: p.id, name: p.name + (p.hidden ? ' (hidden)' : '') })),
    cakes: all.filter(isCakeFlavor).map((p) => ({ id: p.id, name: p.name + (p.hidden ? ' (hidden)' : '') })),
  };
}
