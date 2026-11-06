'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deliveryQuoteAction, placeOrderAction } from '@/app/actions';
import { money } from '@/lib/money';
import { useCart } from './CartProvider';
import { Sparkle } from './Sparkle';

type Quote = { ok: true; miles: number; cents: number } | { ok: false; error: string } | null;

export function Checkout(props: {
  open: boolean; pickupText: string; closesText: string; pickupPlace: string;
  deliveryEnabled: boolean; tiers: { max_miles: number; cents: number }[];
}) {
  const { lines, subtotal, setQty, remove, clear, ready } = useCart();
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

  const deliveryCents = mode === 'delivery' && quote?.ok && quotedFor === form.address ? quote.cents : 0;
  const total = subtotal + deliveryCents;

  const checkAddress = () => {
    setError('');
    const a = form.address;
    startCheck(async () => {
      const q = await deliveryQuoteAction(a);
      setQuote(q);
      setQuotedFor(a);
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'delivery' && !(quote?.ok && quotedFor === form.address)) {
      setError('Please tap "Check my address" to confirm delivery first.');
      return;
    }
    startPlace(async () => {
      const r = await placeOrderAction({ lines, fulfillment: mode, ...form });
      if (r.ok) {
        clear();
        router.push(`/order/${r.id}`);
      } else {
        setError(r.error);
      }
    });
  };

  if (!ready) return <div className="panel center muted">Loading your bag…</div>;

  if (lines.length === 0) {
    return (
      <div className="panel center stack" style={{ padding: 48 }}>
        <Sparkle size={18} />
        <h3>Your bag is empty</h3>
        <p className="muted">Build a cookie box or add a honey bun cake to get started.</p>
        <div style={{ marginTop: 20 }}><Link href="/#menu" className="btn btn-gold">See the menu</Link></div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 26, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
      <div className="panel">
        <h3 style={{ marginBottom: 6 }}>Order summary</h3>
        {lines.map((l) => (
          <div className="summary-line" key={l.key}>
            <div className="grow">
              <div>{l.type === 'box' ? `Cookies — ${l.label}` : `${l.name}${l.option ? ` (${l.option})` : ''}`}</div>
              {l.type === 'box' && <div className="flavors">{l.flavors.map((f) => `${f.qty}× ${f.name}`).join(' · ')}</div>}
              <div className="row" style={{ marginTop: 10, gap: 10 }}>
                <div className="stepper">
                  <button aria-label="One less" disabled={l.quantity <= 1} onClick={() => setQty(l.key, l.quantity - 1)}>−</button>
                  <span>{l.quantity}</span>
                  <button aria-label="One more" onClick={() => setQty(l.key, l.quantity + 1)}>+</button>
                </div>
                <button className="btn btn-sm btn-ghost" onClick={() => remove(l.key)}>Remove</button>
              </div>
            </div>
            <div>{money(l.cents * l.quantity)}</div>
          </div>
        ))}
        <div className="totals">
          <div><span className="muted">Subtotal</span><span>{money(subtotal)}</span></div>
          {mode === 'delivery' && <div><span className="muted">Delivery</span><span>{deliveryCents ? money(deliveryCents) : '—'}</span></div>}
          <div className="grand serif"><span>Total</span><span>{money(total)}</span></div>
        </div>
        <p className="small faint" style={{ marginTop: 14 }}>
          <Link href="/#menu">+ Add more treats</Link>
        </p>
      </div>

      <form className="panel form-grid" onSubmit={submit}>
        <h3>Your details</h3>
        {!props.open && <div className="alert">Orders are closed right now. You can place your order when the next Drop opens.</div>}
        <div className="field"><label htmlFor="name">Full name</label><input id="name" className="input" required autoComplete="name" value={form.name} onChange={set('name')} /></div>
        <div className="form-grid two">
          <div className="field"><label htmlFor="phone">Phone</label><input id="phone" className="input" required type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={set('phone')} /></div>
          <div className="field"><label htmlFor="email">Email</label><input id="email" className="input" required type="email" autoComplete="email" value={form.email} onChange={set('email')} /></div>
        </div>

        <div className="field">
          <span className="label">How would you like it?</span>
          <div className="choice">
            <button type="button" aria-pressed={mode === 'pickup'} onClick={() => setMode('pickup')}>
              <strong>Pickup</strong><span>Free · Saturday</span>
            </button>
            <button type="button" aria-pressed={mode === 'delivery'} disabled={!props.deliveryEnabled} onClick={() => setMode('delivery')}>
              <strong>Delivery</strong><span>{props.deliveryEnabled ? `${money(Math.min(...props.tiers.map((t) => t.cents)))}+ · up to ${Math.max(...props.tiers.map((t) => t.max_miles))} mi` : 'Not available'}</span>
            </button>
          </div>
        </div>

        {mode === 'pickup' ? (
          <div className="note">
            <strong style={{ fontWeight: 400 }}>{props.pickupText || 'Saturday, 10am – 4pm'}</strong><br />
            <span className="muted">{props.pickupPlace}</span>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="address">Delivery address</label>
            <input id="address" className="input" autoComplete="street-address" placeholder="Street, city, ZIP" value={form.address}
              onChange={(e) => { set('address')(e); }} />
            <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} disabled={checking || form.address.trim().length < 8} onClick={checkAddress}>
              {checking ? 'Checking…' : 'Check my address'}
            </button>
            {quote && quotedFor === form.address && (quote.ok
              ? <div className="success">Great news — about {quote.miles} miles away. Delivery is {money(quote.cents)}. Delivered Saturday{props.pickupText ? ` (${props.pickupText.split(',').slice(0, 2).join(',')})` : ''}.</div>
              : <div className="alert">{quote.error}</div>)}
          </div>
        )}

        <div className="field"><label htmlFor="notes">Notes (optional)</label><textarea id="notes" className="textarea" placeholder="Allergies, gift message, anything I should know" value={form.notes} onChange={set('notes')} /></div>

        {error && <div className="alert" role="alert">{error}</div>}
        <button className="btn btn-gold btn-block" disabled={placing || !props.open}>
          {placing ? 'Placing your order…' : `Place order · ${money(total)}`}
        </button>
        <p className="small faint center">No card needed. You&apos;ll see how to pay with Cash App, Zelle or Apple Pay next.{props.closesText && <> Orders close {props.closesText}.</>}</p>
      </form>
    </div>
  );
}
