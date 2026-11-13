'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { deliveryQuoteAction, placeOrderAction } from '@/app/actions';
import { money } from '@/lib/money';
import { cakesText, cookiesText, lineName } from '@/lib/picks';
import { useCart } from './CartProvider';

type Quote = { ok: true; miles: number; cents: number } | { ok: false; error: string } | null;

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return <h3 className="step-title"><span className="n">{n}</span>{children}</h3>;
}

type OpenDrop = { id: string; name: string; pickupText: string; closesText: string };

export function Checkout(props: {
  drops: OpenDrop[]; pickupPlace: string; payMethods: string[];
  deliveryEnabled: boolean; tiers: { max_miles: number; cents: number }[];
}) {
  const { lines, subtotal, setQty, remove, clear, ready, drop: cartDrop } = useCart();
  // The Drop this order is for (the one the treats were added from).
  const drop = props.drops.find((d) => d.id === cartDrop?.id) ?? (cartDrop ? null : props.drops[0] ?? null);
  const [payMethod, setPayMethod] = useState('');
  const [subscribe, setSubscribe] = useState(false);
  const router = useRouter();
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });
  const [mode, setMode] = useState<'pickup' | 'delivery'>('pickup');
  const [quote, setQuote] = useState<Quote>(null);
  const [quotedFor, setQuotedFor] = useState('');
  const [error, setError] = useState('');
  const [checking, startCheck] = useTransition();
  const [placing, startPlace] = useTransition();

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const deliveryOk = mode === 'delivery' && quote?.ok && quotedFor === form.address;
  const deliveryCents = deliveryOk && quote?.ok ? quote.cents : 0;
  const total = subtotal + deliveryCents;
  const tiers = [...props.tiers].sort((a, b) => a.max_miles - b.max_miles);

  const checkAddress = () => {
    setError('');
    const a = form.address;
    startCheck(async () => {
      const q = await deliveryQuoteAction(a);
      setQuote(q);
      setQuotedFor(a);
    });
  };

  // Check the delivery address by itself a moment after the customer stops typing,
  // so the delivery fee and the full total show without an extra tap.
  useEffect(() => {
    if (mode !== 'delivery') return;
    const a = form.address;
    if (a === quotedFor || a.trim().length < 10 || !/\d/.test(a) || !/[a-z]{3}/i.test(a)) return;
    const t = window.setTimeout(() => {
      startCheck(async () => {
        const q = await deliveryQuoteAction(a);
        setQuote(q);
        setQuotedFor(a);
      });
    }, 1200);
    return () => window.clearTimeout(t);
  }, [mode, form.address, quotedFor]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'delivery' && !deliveryOk) {
      if (form.address.trim().length >= 8 && !checking) checkAddress();
      setError('Please wait while we check your delivery address. Your delivery fee will be added to your total.');
      return;
    }
    if (!payMethod) {
      setError('Please choose how you will pay.');
      return;
    }
    if (!drop) {
      setError('Ordering for this pickup day is closed. Please go back to the menu.');
      return;
    }
    startPlace(async () => {
      const r = await placeOrderAction({ lines, fulfillment: mode, ...form, dropId: drop.id, paymentMethod: payMethod, subscribe, expectedTotal: total });
      if (r.ok) {
        clear();
        router.push(`/order/${r.id}`);
      } else {
        setError(r.error);
        if ('delivery' in r && r.delivery) { setQuote({ ok: true, ...r.delivery }); setQuotedFor(form.address); }
      }
    });
  };

  if (!ready) return <div className="panel center muted">Loading your order…</div>;

  if (lines.length === 0) {
    return (
      <div className="panel center stack" style={{ padding: '48px 24px' }}>
        <h3>Your order is empty</h3>
        <p className="muted">Build a cookie box or add a honey bun cake to get started.</p>
        <div style={{ marginTop: 24 }}><Link href="/#menu" className="btn">See the Menu</Link></div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="stack" style={{ maxWidth: 760, margin: '0 auto' }}>
      {drop ? (
        <div className="note ordering-from">
          This order is for <strong>{drop.name}</strong>: pickup <strong>{drop.pickupText}</strong>.
        </div>
      ) : (
        <div className="alert">Ordering for {cartDrop?.name ?? 'this pickup day'} is closed now. Please go back to the menu to start a new order for the next pickup day.</div>
      )}

      <div className="panel">
        <StepTitle n={1}>Check your order</StepTitle>
        <div style={{ marginTop: 10 }}>
          {lines.map((l) => (
            <div className="summary-line" key={l.key}>
              <div className="grow">
                <div>{l.type === 'box' ? `Cookies, ${l.label}` : lineName({ product_id: l.productId, name: l.name, option_label: l.option })}</div>
                {l.type === 'item' && cakesText(l.cakes) && <div className="flavors">{cakesText(l.cakes)}</div>}
                {cookiesText(l.flavors) && <div className="flavors">{cookiesText(l.flavors)}</div>}
                <div className="row" style={{ marginTop: 12 }}>
                  <div className="stepper">
                    <button type="button" aria-label="One less" disabled={l.quantity <= 1} onClick={() => setQty(l.key, l.quantity - 1)}>−</button>
                    <span>{l.quantity}</span>
                    <button type="button" aria-label="One more" onClick={() => setQty(l.key, l.quantity + 1)}>+</button>
                  </div>
                  <button type="button" className="btn-link" onClick={() => remove(l.key)}>Remove</button>
                </div>
              </div>
              <div style={{ fontWeight: 700 }}>{money(l.cents * l.quantity)}</div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 14 }}><Link href="/#menu" style={{ fontWeight: 700 }}>+ Add more treats</Link></p>
      </div>

      <div className="panel">
        <StepTitle n={2}>Pickup or delivery?</StepTitle>
        <div className="choice" style={{ marginTop: 18 }}>
          <button type="button" aria-pressed={mode === 'pickup'} onClick={() => setMode('pickup')}>
            <strong>{mode === 'pickup' ? '✓ ' : ''}Pickup</strong><span>Free{drop ? ` · ${drop.pickupText.split(',').slice(0, 2).join(',')}` : ''}</span>
          </button>
          <button type="button" aria-pressed={mode === 'delivery'} disabled={!props.deliveryEnabled} onClick={() => setMode('delivery')}>
            <strong>{mode === 'delivery' ? '✓ ' : ''}Delivery</strong>
            <span>{props.deliveryEnabled ? `From ${money(Math.min(...tiers.map((t) => t.cents)))}` : 'Not available'}</span>
          </button>
        </div>

        {mode === 'pickup' ? (
          <div className="note" style={{ marginTop: 18 }}>
            <strong>Pickup {drop?.pickupText ?? ''}</strong><br />
            {props.pickupPlace}
          </div>
        ) : (
          <div className="field" style={{ marginTop: 18 }}>
            <label htmlFor="address">Your delivery address</label>
            <span className="hint">Street, city and ZIP code. Delivery is {tiers.map((t, i) => `${money(t.cents)} ${i === 0 ? `within ${t.max_miles}` : `for ${tiers[i - 1].max_miles} to ${t.max_miles}`} miles`).join(', ')}.</span>
            <input id="address" className="input" autoComplete="street-address" placeholder="123 Main St, Mauldin, SC 29662" value={form.address} onChange={set('address')} />
            <button type="button" className="btn btn-outline" style={{ marginTop: 6 }} disabled={checking || form.address.trim().length < 8} onClick={checkAddress}>
              {checking ? 'Checking…' : 'Check My Address'}
            </button>
            {quote && quotedFor === form.address && (quote.ok
              ? <div className="success">Good news! You are about {quote.miles} miles away. The delivery fee is {money(quote.cents)}, so your total is {money(subtotal + quote.cents)}{drop ? `. Delivered ${drop.pickupText.split(',').slice(0, 2).join(',')}` : ''}.</div>
              : <div className="alert">{quote.error}</div>)}
          </div>
        )}
      </div>

      <div className="panel form-grid">
        <StepTitle n={3}>Your details</StepTitle>
        <div className="field"><label htmlFor="name">Full name</label><input id="name" className="input" required autoComplete="name" value={form.name} onChange={set('name')} /></div>
        <div className="field"><label htmlFor="phone">Phone number</label><input id="phone" className="input" required type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={set('phone')} /></div>
        <div className="field"><label htmlFor="email">Email</label><span className="hint">We&apos;ll email your order confirmation and pickup details here.</span><input id="email" className="input" required type="email" autoComplete="email" value={form.email} onChange={set('email')} /></div>
        <div className="field">
          <span className="flabel">How will you pay?</span>
          <span className="hint">You&apos;ll pay after ordering. No card needed on the website.</span>
          <div className="choice" style={{ gridTemplateColumns: `repeat(${Math.min(3, props.payMethods.length)}, 1fr)` }}>
            {props.payMethods.map((m) => (
              <button type="button" key={m} aria-pressed={payMethod === m} onClick={() => setPayMethod(m)}>
                <strong>{payMethod === m ? '✓ ' : ''}{m}</strong>
              </button>
            ))}
          </div>
        </div>
        <div className="field"><label htmlFor="notes">Notes (optional)</label><textarea id="notes" className="textarea" placeholder="Allergies, a gift message, or anything I should know" value={form.notes} onChange={set('notes')} /></div>

        <div className="totals">
          <div><span>Treats</span><span>{money(subtotal)}</span></div>
          {mode === 'delivery' && (
            <div>
              <span>Delivery fee{deliveryOk && quote?.ok ? ` (${quote.miles} miles)` : ''}</span>
              <span>{deliveryOk ? money(deliveryCents) : checking ? 'Checking…' : 'Enter your address'}</span>
            </div>
          )}
          <div className="grand"><span>Total</span><span>{mode === 'delivery' && !deliveryOk ? `${money(subtotal)} + delivery` : money(total)}</span></div>
        </div>

        <label className="check"><input type="checkbox" checked={subscribe} onChange={(e) => setSubscribe(e.target.checked)} /> Join our email list for new treats and holiday menus</label>

        {error && <div className="alert" role="alert">{error}</div>}
        <button className="btn btn-block" disabled={placing || !drop}>
          {placing ? 'Placing your order…' : mode === 'delivery' && !deliveryOk ? (checking ? 'Checking your address…' : 'Check My Address to See My Total') : `Place My Order · ${money(total)}`}
        </button>
        <p className="muted center">No card needed. Next you&apos;ll see how to send your payment, and we&apos;ll email you a confirmation.{drop && <> Ordering for this pickup closes {drop.closesText}.</>}</p>
      </div>
    </form>
  );
}
