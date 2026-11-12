'use client';
import { useEffect, useMemo, useState } from 'react';
import type { MenuProduct, Option } from '@/lib/menu';
import type { CookieBox } from '@/lib/settings';
import type { CartDrop } from '@/lib/cart-types';
import { allowed, cakeShort, evenMix, isCakeFlavor } from '@/lib/picks';
import { money } from '@/lib/money';
import { useCart } from './CartProvider';
import { useBagUsage } from './Menu';

type Counts = Record<string, number>;
const total = (c: Counts) => Object.values(c).reduce((s, n) => s + n, 0);

/**
 * "Pick your flavors" for anything with cookies or cakes inside:
 *   - a cookie box (Single, Box of 4, Dozen): choose the size, then the cookies;
 *   - a box item like The Thanksgiving Box: choose its cookies and its cake flavor.
 * Big + and − buttons, a running count ("7 of 12"), and a Baker's Choice button.
 * The Add button only works when the count is exactly right.
 */
export function BoxBuilder(props: {
  drop: CartDrop;
  onClose: () => void;
  /** Every cookie and cake flavor on the menu (with amounts left). */
  flavors: MenuProduct[];
  /** Cookie box mode. */
  boxes?: CookieBox[]; startBox?: number; startWith?: string;
  /** Box item mode. */
  item?: { p: MenuProduct; option: Option };
  /** Order-by and pickup details (holiday boxes). */
  note?: string[];
}) {
  const { drop, onClose, flavors, boxes = [], item } = props;
  const { add, showToast } = useCart();
  const usage = useBagUsage();

  const defaultBox = boxes.find((b) => b.count === (props.startBox ?? 4)) ?? boxes[0];
  const [boxCount, setBoxCount] = useState(defaultBox?.count ?? 0);
  const box = item ? null : boxes.find((b) => b.count === boxCount) ?? defaultBox ?? null;

  const allCookies = useMemo(() => flavors.filter((p) => p.kind === 'cookie'), [flavors]);
  const allCakes = useMemo(() => flavors.filter(isCakeFlavor), [flavors]);
  const cookieChoices = item ? allowed(allCookies, item.p.picks?.cookie_ids) : allowed(allCookies, box?.flavor_ids);
  const cakeChoices = item ? allowed(allCakes, item.p.picks?.cake_ids) : [];
  const cookieCount = item ? item.p.picks?.cookies ?? 0 : box?.count ?? 0;
  const cakeCount = item ? item.p.picks?.cakes ?? 0 : 0;
  const cakeSize = item?.p.picks?.cake_size ?? '';

  const [cookies, setCookies] = useState<Counts>(props.startWith ? { [props.startWith]: 1 } : {});
  const [cakes, setCakes] = useState<Counts>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const maxFor = (p: MenuProduct) => (p.left === null ? Infinity : p.left - (usage.get(p.id) ?? 0));
  const chosen = total(cookies);
  const cookiesLeft = cookieCount - chosen;
  const cakesChosen = total(cakes);
  const cakesLeft = cakeCount - cakesChosen;
  const ready = cookiesLeft === 0 && cakesLeft === 0 && (cookieCount > 0 || cakeCount > 0);

  const chooseBox = (count: number) => {
    setBoxCount(count);
    setCookies((cur) => {
      let left = count;
      const next: Counts = {};
      for (const [id, n] of Object.entries(cur)) {
        const take = Math.min(n, left);
        if (take > 0) next[id] = take;
        left -= take;
      }
      return next;
    });
  };

  const step = (set: React.Dispatch<React.SetStateAction<Counts>>, id: string, d: number) =>
    set((cur) => {
      const n = Math.max(0, (cur[id] ?? 0) + d);
      const next = { ...cur, [id]: n };
      if (n === 0) delete next[id];
      return next;
    });

  const bakersChoice = () => setCookies(evenMix(cookieCount, cookieChoices.map((c) => ({ id: c.id, max: maxFor(c) }))));

  const toList = (c: Counts, from: MenuProduct[]) => from.filter((p) => c[p.id]).map((p) => ({ id: p.id, name: p.name, qty: c[p.id] }));

  const addToOrder = () => {
    const fl = toList(cookies, cookieChoices);
    const sig = (l: { id: string; qty: number }[]) => l.map((f) => `${f.id}x${f.qty}`).sort().join(',');
    if (item) {
      const ck = toList(cakes, cakeChoices);
      const key = `item:${item.p.id}:${item.option.label}:${sig(fl)}:${sig(ck)}`;
      if (add({ key, type: 'item', productId: item.p.id, name: item.p.name, option: item.option.label, cents: item.option.cents, quantity: 1, flavors: fl, cakes: ck }, drop)) {
        showToast(`${item.p.name} added to your order`);
      }
    } else if (box) {
      const key = `box:${box.count}:${sig(fl)}`;
      if (add({ key, type: 'box', count: box.count, label: box.label, cents: box.cents, flavors: fl, quantity: 1 }, drop)) {
        showToast(`${box.label} added to your order`);
      }
    }
    onClose();
  };

  const title = item ? item.p.name : 'Build your box';
  const price = item ? item.option.cents : box?.cents ?? 0;
  const what = item ? item.p.name : box?.label ?? 'box';
  let n = 0; // step letters

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Pick your flavors: ${title}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="close-x" onClick={onClose}>Close</button>
        </div>
        {item && <p className="muted" style={{ fontSize: '1.1rem' }}>{money(price)}{item.p.picks?.cookies ? ` · ${item.p.picks.cookies} cookies` : ''}{cakeCount ? ` · ${cakeCount} ${cakeSize ? `${cakeSize.toLowerCase()} ` : ''}honey bun cake${cakeCount > 1 ? 's' : ''}` : ''}</p>}

        {props.note && props.note.length > 0 && <div className="card-dates" style={{ marginTop: 14 }}>{props.note.map((l) => <p key={l}>{l}</p>)}</div>}

        {!item && (
          <>
            <p className="flabel">Step {String.fromCharCode(65 + n++)}: Choose a box size</p>
            <div className="box-sizes" role="group" aria-label="Box size" style={{ marginTop: 12 }}>
              {boxes.map((b) => (
                <button key={b.count} className="box-size" aria-pressed={b.count === box?.count} onClick={() => chooseBox(b.count)}>
                  <b>{b.label}</b>
                  <span>{money(b.cents)}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {cakeCount > 0 && (
          <div className="pick-group">
            <p className="flabel">Step {String.fromCharCode(65 + n++)}: Choose your {cakeSize ? `${cakeSize.toLowerCase()} ` : ''}honey bun cake{cakeCount > 1 ? 's' : ''}</p>
            <p className="pick-count" aria-live="polite">
              {cakeCount === 1 ? (cakesLeft === 0 ? '✓ Cake chosen' : 'Tap one flavor') : `${cakesChosen} of ${cakeCount} chosen`}
            </p>
            {cakeCount === 1 ? (
              <div className="cake-choices" role="group" aria-label="Cake flavor">
                {cakeChoices.map((c) => {
                  const out = maxFor(c) <= 0;
                  return (
                    <button key={c.id} className="cake-choice" aria-pressed={Boolean(cakes[c.id])} disabled={out} onClick={() => setCakes({ [c.id]: 1 })}>
                      <span className="thumb">{c.image_id && <img src={`/api/img/${c.image_id}`} alt="" />}</span>
                      <b>{cakeShort(c.name)}</b>
                      {out && <small>Sold out</small>}
                    </button>
                  );
                })}
              </div>
            ) : (
              cakeChoices.map((c) => <FlavorRow key={c.id} p={c} name={cakeShort(c.name)} n={cakes[c.id] ?? 0} max={maxFor(c)} full={cakesLeft <= 0} onStep={(d) => step(setCakes, c.id, d)} />)
            )}
          </div>
        )}

        {cookieCount > 0 && (
          <div className="pick-group">
            <p className="flabel">Step {String.fromCharCode(65 + n++)}: Choose your {cookieCount} cookie{cookieCount > 1 ? 's' : ''}</p>
            <div className="pick-bar">
              <p className="pick-count" aria-live="polite">
                <span className="big-count">{chosen} of {cookieCount}</span> {cookiesLeft > 0 ? `chosen · pick ${cookiesLeft} more` : 'chosen ✓'}
              </p>
              {cookieCount > 1 && (
                <button type="button" className="btn btn-outline bakers-choice" onClick={bakersChoice}>Baker&apos;s Choice</button>
              )}
            </div>
            {cookieCount > 1 && <p className="hint" style={{ marginTop: 4 }}>Baker&apos;s Choice fills your box with an even mix. You can still change it.</p>}
            {cookieChoices.map((c) => (
              <FlavorRow key={c.id} p={c} name={c.name} n={cookies[c.id] ?? 0} max={maxFor(c)} full={cookiesLeft <= 0} onStep={(d) => step(setCookies, c.id, d)} />
            ))}
            {chosen > 0 && <p style={{ marginTop: 12 }}><button type="button" className="btn-link" onClick={() => setCookies({})}>Start over</button></p>}
          </div>
        )}

        <div className="sheet-foot">
          <button className="btn btn-block" disabled={!ready} onClick={addToOrder}>
            {ready
              ? `Add ${what} to My Order · ${money(price)}`
              : cakesLeft > 0 && cookiesLeft <= 0
                ? `Choose your cake flavor to continue`
                : `Choose ${cookiesLeft} more cookie${cookiesLeft === 1 ? '' : 's'} to continue`}
          </button>
        </div>
      </div>
    </div>
  );
}

function FlavorRow({ p, name, n, max, full, onStep }: { p: MenuProduct; name: string; n: number; max: number; full: boolean; onStep: (d: number) => void }) {
  const out = max <= 0;
  return (
    <div className="flavor-row">
      <div className="thumb">{p.image_id && <img src={`/api/img/${p.image_id}`} alt="" />}</div>
      <div className="fname">
        {name}
        {p.left !== null && <small>{out ? 'Sold out' : `Only ${Math.max(0, max)} left`}</small>}
      </div>
      <div className="stepper">
        <button aria-label={`Remove one ${name}`} disabled={n === 0} onClick={() => onStep(-1)}>−</button>
        <span aria-label={`${n} ${name}`}>{n}</span>
        <button aria-label={`Add one ${name}`} disabled={full || n >= max} onClick={() => onStep(1)}>+</button>
      </div>
    </div>
  );
}
