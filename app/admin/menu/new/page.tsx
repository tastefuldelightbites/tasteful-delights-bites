import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { ProductForm } from '../ProductForm';
import { flavorLists } from '../flavors';

export default async function NewProduct({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requireAdmin();
  const kind = (await searchParams).kind === 'cookie' ? 'cookie' : 'item';
  const flavors = await flavorLists();
  return (
    <div className="stack">
      <p><Link href="/admin/menu" style={{ fontWeight: 700 }}>← Back to Menu</Link></p>
      <h1>{kind === 'cookie' ? 'New cookie flavor' : 'New cake or item'}</h1>
      <ProductForm p={{ kind, name: '', description: '', section: kind === 'cookie' ? 'Cookies' : 'Honey Bun Cakes', options: kind === 'item' ? [{ label: 'Small', cents: 1500 }, { label: 'Large', cents: 3500 }] : [], tags: [], hidden: false, image_id: null, picks: null }} cookieFlavors={flavors.cookies} cakeFlavors={flavors.cakes} />
    </div>
  );
}
