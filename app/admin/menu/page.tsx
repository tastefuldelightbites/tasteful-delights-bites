import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { getProducts } from '@/lib/menu';
import { getSettings } from '@/lib/settings';
import { money } from '@/lib/money';
import { MenuRowButtons } from './MenuRowButtons';

export default async function MenuAdmin({ searchParams }: { searchParams: Promise<{ added?: string; removed?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [products, s] = await Promise.all([getProducts(true), getSettings()]);
  return (
    <div className="stack">
      <h1>Menu &amp; Photos</h1>
      {sp.added && <div className="success">Item added to your menu.</div>}
      {sp.removed && <div className="success">Item removed.</div>}
      <p className="muted" style={{ fontSize: '1.15rem' }}>Tap Edit to change a name, price or photo. Hide takes an item off the website without deleting it.</p>
      <div className="row">
        <Link className="btn" href="/admin/menu/new?kind=cookie">+ Add a Cookie Flavor</Link>
        <Link className="btn btn-outline" href="/admin/menu/new?kind=item">+ Add a Cake or Other Item</Link>
      </div>
      <p className="muted">Cookie box prices: {s.cookie_boxes.map((b) => `${b.label} ${money(b.cents)}`).join(' · ')}</p>
      <div>
        {products.map((p, i) => (
          <div key={p.id} className="list-row" style={{ flexWrap: 'wrap', opacity: p.hidden ? 0.6 : 1 }}>
            <div className="thumb">{p.image_id ? <img src={`/api/img/${p.image_id}`} alt="" /> : null}</div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <strong style={{ fontSize: '1.15rem' }}>{p.name}</strong>
              <div className="muted small">
                {p.kind === 'cookie' ? `Cookie flavor · ${p.section}` : `${p.section} · ${p.options.map((o) => `${o.label} ${money(o.cents)}`).join(', ')}`}
                {p.hidden && ' · HIDDEN'}{!p.image_id && ' · no photo yet'}
              </div>
            </div>
            <div className="row">
              <Link className="btn btn-sm" href={`/admin/menu/${p.id}`}>Edit</Link>
              <MenuRowButtons id={p.id} hidden={p.hidden} isNew={(p.tags ?? []).includes('new')} first={i === 0} last={i === products.length - 1} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
