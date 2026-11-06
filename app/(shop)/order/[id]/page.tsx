import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getOrder } from '@/lib/orders';
import { getSettings } from '@/lib/settings';
import { money } from '@/lib/money';
import { fmtPickupDate } from '@/lib/time';
import { Sparkle } from '@/components/Sparkle';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Thank you! · Tasteful Delights Bites' };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, s] = await Promise.all([getOrder(id), getSettings()]);
  if (!data) notFound();
  const { order, items, drop } = data;
  const amount = (order.total_cents / 100).toFixed(2);
  const cash = s.cashapp.replace(/^\$/, '').trim();
  const venmo = s.venmo.replace(/^@/, '').trim();
  const pay: { name: string; handle: string; href: string | null }[] = [];
  if (cash) pay.push({ name: 'Cash App', handle: '$' + cash, href: `https://cash.app/$${cash}/${amount}` });
  if (venmo) pay.push({ name: 'Venmo', handle: '@' + venmo, href: `https://venmo.com/u/${venmo}` });
  if (s.zelle) pay.push({ name: 'Zelle', handle: s.zelle, href: null });

  return (
    <section className="section">
      <div className="wrap narrow stack">
        <div className="center stack">
          <Sparkle size={22} animate />
          <p className="eyebrow">Order #{order.order_number}</p>
          <h1 style={{ fontSize: 'clamp(2.2rem, 6vw, 3.4rem)' }}>
            Thank you, <span className="gold-text">{order.name.split(' ')[0]}!</span>
          </h1>
          <p className="muted">
            {order.canceled_at
              ? 'This order was canceled.'
              : order.paid_at
                ? 'Your payment has been received. See you soon!'
                : 'Your order is saved. One last step — send your payment below to lock it in.'}
          </p>
        </div>

        {!order.paid_at && !order.canceled_at && (
          <div className="panel stack" style={{ marginTop: 34 }}>
            <div className="row">
              <h3>Pay {money(order.total_cents)}</h3>
              <span className="spacer" />
              <span className="pill">Note: Order #{order.order_number}</span>
            </div>
            <div className="pay-grid">
              {pay.length === 0 && <p className="muted">Payment details coming soon — I&apos;ll reach out to you directly.</p>}
              {pay.map((p) => (
                <div className="pay-card" key={p.name}>
                  <span className="eyebrow">{p.name}</span>
                  <span className="handle">{p.handle}</span>
                  {p.href ? (
                    <a className="btn btn-sm btn-gold" href={p.href} target="_blank" rel="noreferrer">Open {p.name}</a>
                  ) : (
                    <span className="small muted">Send from your bank&apos;s app</span>
                  )}
                </div>
              ))}
            </div>
            <p className="small muted">{s.payment_note}</p>
          </div>
        )}

        <div className="panel" style={{ marginTop: 22 }}>
          <h3 style={{ marginBottom: 6 }}>Your order</h3>
          {items.map((it) => (
            <div className="summary-line" key={it.id}>
              <div className="grow">
                <div>
                  {it.quantity}× {it.flavors.length ? it.name : `${it.name}${it.option_label ? ` (${it.option_label})` : ''}`}
                </div>
                {it.flavors.length > 0 && <div className="flavors">{it.flavors.map((f) => `${f.qty}× ${f.name}`).join(' · ')}</div>}
              </div>
              <div>{money(it.line_cents)}</div>
            </div>
          ))}
          <div className="totals">
            <div><span className="muted">Subtotal</span><span>{money(order.subtotal_cents)}</span></div>
            {order.fulfillment === 'delivery' && <div><span className="muted">Delivery</span><span>{money(order.delivery_cents)}</span></div>}
            <div className="grand serif"><span>Total</span><span>{money(order.total_cents)}</span></div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 22 }}>
          <h3 style={{ marginBottom: 8 }}>{order.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}</h3>
          <p>{drop ? `${fmtPickupDate(drop.pickup_date, true)}, ${drop.pickup_hours}` : 'Saturday'}</p>
          <p className="muted">{order.fulfillment === 'pickup' ? `${s.pickup_place}, ${s.pickup_address}` : order.address}</p>
          <p className="small faint" style={{ marginTop: 12 }}>
            {s.contact_phone ? <>Questions? Text <a href={`sms:${s.contact_phone}`}>{s.contact_phone}</a>. </> : null}
            Bookmark this page to check your order anytime.
          </p>
        </div>

        <div className="center" style={{ marginTop: 30 }}>
          <Link className="btn" href="/">Back to the menu</Link>
        </div>
      </div>
    </section>
  );
}
