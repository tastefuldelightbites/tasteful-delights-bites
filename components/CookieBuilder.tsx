'use client';
import { useEffect, useState } from 'react';
import type { MenuProduct } from '@/lib/menu';
import type { CookieBox } from '@/lib/settings';
import { money } from '@/lib/money';
import { useCart } from './CartProvider';
import { useBagUsage } from './Menu';
import { Sparkle } from './Sparkle';

export function CookieBuilder({ cookies, boxes, startWith, onClose }: {
  cookies: MenuProduct[]; boxes: CookieBox[]; startWith?: string; onClose: () => void;
}) {
  const { add, showToast } = useCart();
  const usage = useBagUsage();
  const defaultBox = boxes.find((b) => b.count === 4) ?? boxes[0];
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
    // trim picks if the new box is smaller
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

  const autoFill = () => {
    // Fill the rest of the box evenly with available flavors
    const avail = cookies.filter((c) => maxFor(c) > (picks[c.id] ?? 0));
    if (avail.length === 0) return;
    const next = { ...picks };
    let left = remaining;
    let i = 0;
    let guard = 0;
    while (left > 0 && guard++ < 500) {
      const c = avail[i % avail.length];
      if ((next[c.id] ?? 0) < maxFor(c)) { next[c.id] = (next[c.id] ?? 0) + 1; left--; }
      i++;
    }
    setPicks(next);
  };

  const addToBag = () => {
    const flavors = cookies.filter((c) => picks[c.id]).map((c) => ({ id: c.id, name: c.name, qty: picks[c.id] }));
    const key = `box:${box.count}:` + flavors.map((f) => `${f.id}x${f.qty}`).sort().join(',');
    add({ key, type: 'box', count: box.count, label: box.label, cents: box.cents, flavors, quantity: 1 });
    showToast(`${box.label} added to your bag`);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Build your cookie box" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <p className="eyebrow"><Sparkle size={9} /> Build your box</p>
            <h2 style={{ fontSize: '1.9rem', marginTop: 6 }}>Pick your flavors</h2>
          </div>
          <button className="close-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="seg seg-even" role="group" aria-label="Box size" style={{ marginBottom: 18 }}>
          {boxes.map((b) => (
            <button key={b.count} aria-pressed={b.count === box.count} onClick={() => chooseBox(b.count)}>
              <span style={{ display: 'block' }}>{b.label}</span>
              <span style={{ display: 'block', color: 'var(--gold)' }}>{money(b.cents)}</span>
            </button>
          ))}
        </div>

        <div className="row small">
          <span>{chosen} of {box.count} chosen</span>
          <span className="spacer" />
          {remaining > 0 && box.count > 1 && <button className="btn btn-sm btn-ghost" onClick={autoFill}>Mix the rest for me</button>}
        </div>
        <div className="progress"><div style={{ width: `${(chosen / box.count) * 100}%` }} /></div>

        <div>
          {cookies.map((c) => {
            const n = picks[c.id] ?? 0;
            const max = maxFor(c);
            const out = max <= 0;
            return (
              <div className="flavor-row" key={c.id}>
                <div className="thumb">{c.image_id && <img src={`/api/img/${c.image_id}`} alt="" />}</div>
                <div className="fname">
                  {c.name}
                  {c.left !== null && <small>{out ? 'Sold out' : `${Math.max(0, max)} left`}</small>}
                </div>
                <div className="stepper">
                  <button aria-label={`Remove one ${c.name}`} disabled={n === 0} onClick={() => change(c, -1)}>−</button>
                  <span>{n}</span>
                  <button aria-label={`Add one ${c.name}`} disabled={remaining <= 0 || n >= max} onClick={() => change(c, 1)}>+</button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 22 }}>
          <button className="btn btn-gold btn-block" disabled={remaining !== 0} onClick={addToBag}>
            {remaining === 0 ? `Add ${box.label} · ${money(box.cents)}` : `Choose ${remaining} more`}
          </button>
        </div>
      </div>
    </div>
  );
}
