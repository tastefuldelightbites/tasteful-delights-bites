'use client';
import { useMemo, useState } from 'react';
import type { MenuProduct } from '@/lib/menu';
import type { CookieBox } from '@/lib/settings';
import type { CartDrop } from '@/lib/cart-types';
import { money } from '@/lib/money';
import { useCart } from './CartProvider';
import { CookieBuilder } from './CookieBuilder';

export function Photo({ p, eager = false }: { p: { name: string; image_id: string | null }; eager?: boolean }) {
  return p.image_id ? (
    <img src={`/api/img/${p.image_id}`} alt={p.name} loading={eager ? 'eager' : 'lazy'} />
  ) : (
    <div className="no-photo"><span>{p.name}</span></div>
  );
}

/** Small plain-word labels: New, Customer favorite, Only 5 left, Sold out. */
function Tags({ p }: { p: MenuProduct }) {
  const out = p.left !== null && p.left <= 0;
  const tags: { text: string; solid?: boolean }[] = [];
  if (out) tags.push({ text: 'Sold out', solid: true });
  else {
    if (p.left !== null) tags.push({ text: `Only ${p.left} left`, solid: true });
    if (p.tags?.includes('new')) tags.push({ text: 'New Item' });
    if (p.tags?.includes('fan-fave')) tags.push({ text: 'Customer favorite' });
  }
  if (tags.length === 0) return null;
  return <div className="card-tags">{tags.map((t) => <span key={t.text} className={`tag-pill ${t.solid ? 'solid' : ''}`}>{t.text}</span>)}</div>;
}

/** How many of each product are already in the order. */
export function useBagUsage() {
  const { lines } = useCart();
  return useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lines) {
      if (l.type === 'box') for (const f of l.flavors) m.set(f.id, (m.get(f.id) ?? 0) + f.qty * l.quantity);
      else m.set(l.productId, (m.get(l.productId) ?? 0) + l.quantity);
    }
    return m;
  }, [lines]);
}

export function Menu({ products, boxes, open, drop, note, holiday = false, closedNote }: {
  products: MenuProduct[]; boxes: CookieBox[]; open: boolean; drop: CartDrop | null;
  /** Order deadline and pickup date shown under each section heading. */
  note?: React.ReactNode; holiday?: boolean; closedNote?: string;
}) {
  const cookies = products.filter((p) => p.kind === 'cookie');
  const items = products.filter((p) => p.kind === 'item');
  const sections = Array.from(new Set(items.map((p) => p.section || 'More Treats')));
  const [builder, setBuilder] = useState<{ start?: string; box?: number } | null>(null);

  return (
    <>
      {cookies.length > 0 && (
        <section className="section" style={{ borderTop: 0 }}>
          <div className="wrap">
            <div className="section-head reveal">
              <span className="label">Build your box</span>
              <h2>Cookies</h2>
              {note && <p className="section-note">{note}</p>}
              <p>Tap a box size to start. Then choose any mix of flavors.</p>
              <div className="box-sizes">
                {boxes.map((b) => (
                  <button key={b.count} className="box-size" disabled={!open} onClick={() => setBuilder({ box: b.count })} aria-label={`Start a ${b.label} for ${money(b.cents)}`}>
                    <b>{b.label}</b>
                    <span>{money(b.cents)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid">
              {cookies.map((p, i) => (
                <article key={p.id} className={`card reveal ${p.left === 0 ? 'is-soldout' : ''}`}>
                  <div className="photo"><Photo p={p} eager={i < 2} /></div>
                  <div className="card-body">
                    <Tags p={p} />
                    {p.section && p.section !== 'Cookies' && <p className="card-cat">{p.section}</p>}
                    <h3>{p.name}</h3>
                    {p.description && <p className="desc">{p.description}</p>}
                    {open && (
                      <div className="actions">
                        <button className="btn btn-block" disabled={p.left === 0} onClick={() => setBuilder({ start: p.id })}>
                          {p.left === 0 ? 'Sold Out' : 'Add to My Box'}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {sections.map((sec) => (
        <section className="section" key={sec}>
          <div className="wrap">
            <div className="section-head reveal">
              <span className="label">{holiday ? 'Holiday menu' : sec === 'Honey Bun Cakes' ? 'The signature' : 'Fresh this week'}</span>
              <h2>{sec}</h2>
              {note && (holiday || (cookies.length === 0 && sec === sections[0])) && <p className="section-note">{note}</p>}
              {sec === 'Honey Bun Cakes' && <p>Where it all started. Choose a size, then add it to your order.</p>}
            </div>
            <div className="grid">
              {items.filter((p) => (p.section || 'More Treats') === sec).map((p) => <ItemCard key={p.id} p={p} open={open} drop={drop} />)}
            </div>
          </div>
        </section>
      ))}

      {!open && closedNote && (
        <div className="wrap center" style={{ paddingBottom: 50 }}>
          <p className="note" style={{ display: 'inline-block' }}>{closedNote}</p>
        </div>
      )}

      {builder && drop && <CookieBuilder cookies={cookies} boxes={boxes} drop={drop} startWith={builder.start} startBox={builder.box} onClose={() => setBuilder(null)} />}
    </>
  );
}

function ItemCard({ p, open, drop }: { p: MenuProduct; open: boolean; drop: CartDrop | null }) {
  const { add, showToast } = useCart();
  const usage = useBagUsage();
  const [opt, setOpt] = useState(p.options[0]?.label ?? '');
  const option = p.options.find((o) => o.label === opt) ?? p.options[0];
  const inBag = usage.get(p.id) ?? 0;
  const canAdd = p.left === null || p.left - inBag > 0;
  const priceText = p.options.map((o) => `${o.label} ${money(o.cents)}`).join(' · ');

  return (
    <article className={`card reveal ${p.left === 0 ? 'is-soldout' : ''}`}>
      <div className="photo"><Photo p={p} /></div>
      <div className="card-body">
        <Tags p={p} />
        <h3>{p.name}</h3>
        {priceText && <p className="price">{priceText}</p>}
        {p.description && <p className="desc">{p.description}</p>}
        {open && option && (
          <div className="actions">
            {p.options.length > 1 && (
              <div className="choice-2" role="group" aria-label={`Size for ${p.name}`}>
                {p.options.map((o) => (
                  <button key={o.label} aria-pressed={o.label === option.label} onClick={() => setOpt(o.label)}>
                    {o.label}<span>{money(o.cents)}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              className="btn btn-block"
              disabled={!canAdd}
              onClick={() => {
                if (!drop) return;
                if (add({ key: `item:${p.id}:${option.label}`, type: 'item', productId: p.id, name: p.name, option: option.label, cents: option.cents, quantity: 1 }, drop)) {
                  showToast(`${option.label} ${p.name} added`);
                }
              }}
            >
              {p.left === 0 ? 'Sold Out' : !canAdd ? 'All in your order' : p.options.length > 1 ? `Add ${option.label} to My Order` : 'Add to My Order'}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
