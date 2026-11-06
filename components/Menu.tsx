'use client';
import { useMemo, useState } from 'react';
import type { MenuProduct } from '@/lib/menu';
import type { CookieBox } from '@/lib/settings';
import { money } from '@/lib/money';
import { useCart } from './CartProvider';
import { Sparkle } from './Sparkle';
import { CookieBuilder } from './CookieBuilder';

export function Photo({ p, eager = false }: { p: { name: string; image_id: string | null }; eager?: boolean }) {
  return p.image_id ? (
    <img src={`/api/img/${p.image_id}`} alt={p.name} loading={eager ? 'eager' : 'lazy'} />
  ) : (
    <div className="placeholder">
      <div className="stack" style={{ display: 'grid', justifyItems: 'center' }}>
        <Sparkle size={18} />
        <span>{p.name}</span>
      </div>
    </div>
  );
}

function LeftBadge({ left }: { left: number | null }) {
  if (left === null) return null;
  if (left <= 0) return <span className="badge soldout">Sold out</span>;
  return <span className="badge">{left} left</span>;
}

/** How many of each product are already sitting in the bag. */
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

export function Menu({ products, boxes, open }: { products: MenuProduct[]; boxes: CookieBox[]; open: boolean }) {
  const cookies = products.filter((p) => p.kind === 'cookie');
  const items = products.filter((p) => p.kind === 'item');
  const sections = Array.from(new Set(items.map((p) => p.section || 'More treats')));
  const [builder, setBuilder] = useState<{ start?: string } | null>(null);

  return (
    <>
      {cookies.length > 0 && (
        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <p className="eyebrow"><Sparkle size={9} /> The cookie menu</p>
              <h2>Cookies</h2>
              <p>Pick your favorites and mix flavors in any box.</p>
              <div className="price-pills">
                {boxes.map((b) => (
                  <span key={b.count} className="pill">{b.label} <strong>{money(b.cents)}</strong></span>
                ))}
              </div>
              {open && (
                <div style={{ marginTop: 26 }}>
                  <button className="btn btn-gold" onClick={() => setBuilder({})}>Build your box</button>
                </div>
              )}
            </div>
            <div className="grid">
              {cookies.map((p, i) => (
                <article key={p.id} className="card">
                  <div className="photo">
                    <Photo p={p} eager={i < 2} />
                    <div className="badge-wrap" style={{ position: 'absolute', top: 14, left: 14 }}><LeftBadge left={p.left} /></div>
                  </div>
                  <div className="card-body">
                    <div className="card-title"><h3>{p.name}</h3></div>
                    {p.description && <p className="desc">{p.description}</p>}
                    {open && (
                      <div className="actions">
                        <button className="btn btn-sm" disabled={p.left === 0} onClick={() => setBuilder({ start: p.id })}>
                          {p.left === 0 ? 'Sold out' : 'Add to a box'}
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
            <div className="section-head">
              <p className="eyebrow"><Sparkle size={9} /> Fresh this week</p>
              <h2>{sec}</h2>
            </div>
            <div className="grid">
              {items.filter((p) => (p.section || 'More treats') === sec).map((p) => (
                <ItemCard key={p.id} p={p} open={open} />
              ))}
            </div>
          </div>
        </section>
      ))}

      {!open && (
        <div className="wrap center" style={{ paddingBottom: 40 }}>
          <p className="note" style={{ display: 'inline-block' }}>Ordering opens when the next weekly drop starts. See you Wednesday!</p>
        </div>
      )}

      {builder && <CookieBuilder cookies={cookies} boxes={boxes} startWith={builder.start} onClose={() => setBuilder(null)} />}
    </>
  );
}

function ItemCard({ p, open }: { p: MenuProduct; open: boolean }) {
  const { add, showToast } = useCart();
  const usage = useBagUsage();
  const [opt, setOpt] = useState(p.options[0]?.label ?? '');
  const option = p.options.find((o) => o.label === opt) ?? p.options[0];
  const inBag = usage.get(p.id) ?? 0;
  const canAdd = p.left === null || p.left - inBag > 0;
  const prices = p.options.map((o) => o.cents);
  const priceText = prices.length === 0 ? '' : Math.min(...prices) === Math.max(...prices) ? money(prices[0]) : `from ${money(Math.min(...prices))}`;

  return (
    <article className="card">
      <div className="photo">
        <Photo p={p} />
        <div style={{ position: 'absolute', top: 14, left: 14 }}><LeftBadge left={p.left} /></div>
      </div>
      <div className="card-body">
        <div className="card-title">
          <h3>{p.name}</h3>
          <span className="price">{option ? money(option.cents) : priceText}</span>
        </div>
        {p.description && <p className="desc">{p.description}</p>}
        {open && option && (
          <div className="actions">
            {p.options.length > 1 && (
              <div className="seg" role="group" aria-label="Size">
                {p.options.map((o) => (
                  <button key={o.label} aria-pressed={o.label === option.label} onClick={() => setOpt(o.label)}>
                    {o.label} · {money(o.cents)}
                  </button>
                ))}
              </div>
            )}
            <button
              className="btn btn-sm btn-gold"
              disabled={!canAdd}
              onClick={() => {
                add({ key: `item:${p.id}:${option.label}`, type: 'item', productId: p.id, name: p.name, option: option.label, cents: option.cents, quantity: 1 });
                showToast(`Added ${option.label} ${p.name}`);
              }}
            >
              {p.left === 0 ? 'Sold out' : canAdd ? 'Add to bag' : 'All in your bag'}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
