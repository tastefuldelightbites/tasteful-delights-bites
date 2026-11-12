import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { getProducts } from '@/lib/menu';
import { DEFAULT_HERO_PHOTO, getSettings } from '@/lib/settings';
import { HeroForm } from './HeroForm';
import { CookieBoxesForm } from './CookieBoxesForm';
import { money } from '@/lib/money';
import { MenuRowButtons } from './MenuRowButtons';

export default async function MenuAdmin({ searchParams }: { searchParams: Promise<{ added?: string; removed?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [products, s] = await Promise.all([getProducts(true), getSettings()]);
  return (
    <div className="stack">
      <h1>Menu &amp; Photos</h1>
      <p className="row" style={{ gap: 10 }}>
        <a className="btn btn-sm btn-outline" href="#homepage-photo">Homepage Photo</a>
        <a className="btn btn-sm btn-outline" href="#cookie-boxes">Cookie Box Sizes</a>
        <a className="btn btn-sm btn-outline" href="#items">Menu Items</a>
      </p>
      <HeroForm imageId={s.hero_image_id} caption={s.hero_caption ?? ''} defaultSrc={DEFAULT_HERO_PHOTO} />
      <CookieBoxesForm boxes={s.cookie_boxes} cookies={products.filter((p) => p.kind === 'cookie').map((p) => ({ id: p.id, name: p.name + (p.hidden ? ' (hidden)' : '') }))} />
      <h2 id="items" style={{ fontSize: '1.8rem', marginTop: 20 }}>Menu Items</h2>
      {sp.added && <div className="success">Item added to your menu.</div>}
      {sp.removed && <div className="success">Item removed.</div>}
      <p className="muted" style={{ fontSize: '1.15rem' }}>Tap Edit to change a name, price or photo. Hide takes an item off the website without deleting it.</p>
      <div className="row">
        <Link className="btn" href="/admin/menu/new?kind=cookie">+ Add a Cookie Flavor</Link>
        <Link className="btn btn-outline" href="/admin/menu/new?kind=item">+ Add a Cake or Other Item</Link>
      </div>
      <div>
        {products.map((p, i) => (
          <div key={p.id} className="list-row" style={{ flexWrap: 'wrap', opacity: p.hidden ? 0.6 : 1 }}>
            <div className="thumb">{p.image_id ? <img src={`/api/img/${p.image_id}`} alt="" /> : null}</div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <strong style={{ fontSize: '1.15rem' }}>{p.name}</strong>
              <div className="muted small">
                {p.kind === 'cookie' ? `Cookie flavor · ${p.section}` : `${p.section} · ${p.options.map((o) => `${o.label} ${money(o.cents)}`).join(', ')}`}
                {p.picks && ` · customers pick ${[p.picks.cookies ? `${p.picks.cookies} cookies` : '', p.picks.cakes ? `${p.picks.cakes} cake flavor${p.picks.cakes > 1 ? 's' : ''}` : ''].filter(Boolean).join(' + ')}`}
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
