import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { getProducts } from '@/lib/menu';
import { ProductForm } from '../ProductForm';

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const p = (await getProducts(true)).find((x) => x.id === id);
  if (!p) notFound();
  return (
    <div className="stack">
      <p><Link href="/admin/menu" style={{ fontWeight: 700 }}>← Back to Menu</Link></p>
      <h1>Edit {p.name}</h1>
      <ProductForm p={{ ...p, tags: p.tags ?? [] }} />
    </div>
  );
}
