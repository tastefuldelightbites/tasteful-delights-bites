'use client';
import { useEffect, useState } from 'react';
import type { MenuProduct } from '@/lib/menu';
import type { CookieBox } from '@/lib/settings';
import { money } from '@/lib/money';
import { useCart } from './CartProvider';
import { useBagUsage } from './Menu';
import type { CartDrop } from '@/lib/cart-types';

/** Step-by-step cookie box builder: choose a size, then choose flavors. */
export function CookieBuilder({ cookies, boxes, drop, startWith, startBox, onClose }: {
  cookies: MenuProduct[]; boxes: CookieBox[]; drop: CartDrop; startWith?: string; startBox?: number; onClose: () => void;
}) {
  const { add, showToast } = useCart();
  const usage = useBagUsage();
  const defaultBox = boxes.find((b) => b.count === (startBox ?? 4)) ?? boxes[0];
  const [boxCount, setBoxCount] = useState(defaultBox?.count ?? 1);
  const box = boxes.find((b) => b.count === boxCount) ?? defaultBox;
  const [picks, setPicks] = useState<Record<string, number>>(startWith ? { [startWith]: 1 } : {});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  if (!box) return null;
  const chosen = Object.values(picks).reduce((s, n) => s + n, 0);
  const remaining = box.count - chosen;
  const maxFor = (p: MenuProduct) => (p.left === null ? Infinity : p.left - (usage.get(p.id) ?? 0));

  const chooseBox = (count: number) => {
    setBoxCount(count);
    setPicks((cur) => {
      let left = count;
      const next: Record<string, number> = {};
      for (const [id, n] of Object.entries(cur)) {
        const take = Math.min(n, left);
        if (take > 0) next[id] = take;
        left -= take;
      }
      return next;
    });
  };

  const change = (p: MenuProduct, d: number) =>
    setPicks((cur) => {
      const n = Math.max(0, (cur[p.id] ?? 0) + d);
      const next = { ...cur, [p.id]: n };
      if (n === 0) delete next[p.id];
      return next;
    });

  const addToOrder = () => {
    const flavors = cookies.filter((c) => picks[c.id]).map((c) => ({ id: c.id, name: c.name, qty: picks[c.id] }));
    const key = `box:${box.count}:` + flavors.map((f) => `${f.id}x${f.qty}`).sort().join(',');
    if (add({ key, type: 'box', count: box.count, label: box.label, cents: box.cents, flavors, quantity: 1 }, drop)) {
      showToast(`${box.label} added to your order`);
    }
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Build your cookie box" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Build your box</h2>
          <button className="close-x" onClick={onClose}>Close</button>
        </div>

        <p className="flabel">Step A: Choose a box size</p>
        <div className="box-sizes" role="group" aria-label="Box size" style={{ marginTop: 12 }}>
          {boxes.map((b) => (
            <button key={b.count} className="box-size" aria-pressed={b.count === box.count} onClick={() => chooseBox(b.count)}>
              <b>{b.label}</b>
              <span>{money(b.cents)}</span>
            </button>
          ))}
        </div>

        <p className="flabel" style={{ marginTop: 28 }}>Step B: Choose your flavors</p>
        <p className="builder-status" aria-live="polite" style={{ marginTop: 6 }}>
          {remaining > 0
            ? `${chosen} of ${box.count} chosen. Pick ${remaining} more.`
            : `All ${box.count} chosen. You're ready!`}
        </p>

        <div style={{ marginTop: 8 }}>
          {cookies.map((c) => {
            const n = picks[c.id] ?? 0;
            const max = maxFor(c);
            const out = max <= 0;
            return (
              <div className="flavor-row" key={c.id}>
                <div className="thumb">{c.image_id && <img src={`/api/img/${c.image_id}`} alt="" />}</div>
                <div className="fname">
                  {c.name}
                  {c.left !== null && <small>{out ? 'Sold out' : `Only ${Math.max(0, max)} left`}</small>}
                </div>
                <div className="stepper">
                  <button aria-label={`Remove one ${c.name}`} disabled={n === 0} onClick={() => change(c, -1)}>−</button>
                  <span aria-label={`${n} ${c.name}`}>{n}</span>
                  <button aria-label={`Add one ${c.name}`} disabled={remaining <= 0 || n >= max} onClick={() => change(c, 1)}>+</button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 24 }}>
          <button className="btn btn-block" disabled={remaining !== 0} onClick={addToOrder}>
            {remaining === 0 ? `Add ${box.label} to My Order · ${money(box.cents)}` : `Choose ${remaining} more to continue`}
          </button>
        </div>
      </div>
    </div>
  );
}
