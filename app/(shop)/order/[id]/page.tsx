import { notFound } from 'next/navigation';
import { cakesText, cookiesText, lineName } from '@/lib/picks';
import Link from 'next/link';
import { getOrder } from '@/lib/orders';
import { getSettings } from '@/lib/settings';
import { money } from '@/lib/money';
import { fmtPickupDate } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Thank you! · Tasteful Delights Bites' };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, s] = await Promise.all([getOrder(id), getSettings()]);
  if (!data) notFound();
  const { order, items, drop } = data;
  const amount = (order.total_cents / 100).toFixed(2);
  const cash = s.cashapp.replace(/^\$/, '').trim();
  const pay: { name: string; handle: string; href: string | null; hint?: string; label?: string }[] = [];
  if (cash) pay.push({ name: 'Cash App', handle: '$' + cash, href: `https://cash.app/$${cash}/${amount}` });
  if (s.zelle) pay.push({ name: 'Zelle', handle: s.zelle, href: null, hint: "Send from your bank's app" });
  const apple = (s.applepay ?? '').trim();
  if (apple) {
    const to = apple.includes('@') ? apple : apple.replace(/[^\d+]/g, '');
    pay.push({ name: 'Apple Pay', handle: apple, href: `sms:${to}&body=${encodeURIComponent(`Order #${order.order_number}`)}`, hint: 'Open Messages, tap + then Apple Cash', label: 'Open Messages' });
  }

  // The payment method the customer picked goes first.
  pay.sort((a, b) => Number(b.name === order.payment_method) - Number(a.name === order.payment_method));

  return (
    <section className="section">
      <div className="wrap narrow stack">
        <div className="center stack">
          <span className="label">Order number {order.order_number}</span>
          <h1 style={{ fontSize: 'clamp(2.6rem, 8vw, 3.8rem)' }}>
            Thank you, <em>{order.name.split(' ')[0]}!</em>
          </h1>
          <p className="muted">
            {order.canceled_at
              ? 'This order was canceled.'
              : order.paid_at
                ? 'Your payment has been received. See you soon!'
                : 'Your order is saved. One last step: send your payment below.'}
          </p>
        </div>

        {!order.paid_at && !order.canceled_at && (
          <div className="panel stack" style={{ marginTop: 34 }}>
            <h3>Please send {money(order.total_cents)}</h3>
            <p style={{ fontSize: '1.15rem' }}>Choose one way to pay below. In the payment note, write <strong>Order {order.order_number}</strong>.</p>
            <div className="pay-grid">
              {pay.length === 0 && <p className="muted">Payment details coming soon — I&apos;ll reach out to you directly.</p>}
              {pay.map((p) => (
                <div className="pay-card" key={p.name}>
                  <span className="pay-name">{p.name}{p.name === order.payment_method ? ' · your choice' : ''}</span>
                  <span className="handle">{p.handle}</span>
                  {p.hint && p.href && <span className="small muted">{p.hint}</span>}
                  {p.href ? (
                    <a className="btn btn-sm" href={p.href} target="_blank" rel="noreferrer">{p.label ?? `Open ${p.name}`}</a>
                  ) : (
                    <span className="small muted">{p.hint}</span>
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
                  {it.quantity} × {lineName(it)}
                </div>
                {cakesText(it.cakes) && <div className="flavors">{cakesText(it.cakes)}</div>}
                {cookiesText(it.flavors) && <div className="flavors">{cookiesText(it.flavors)}</div>}
              </div>
              <div>{money(it.line_cents)}</div>
            </div>
          ))}
          <div className="totals">
            <div><span className="muted">Subtotal</span><span>{money(order.subtotal_cents)}</span></div>
            {order.fulfillment === 'delivery' && <div><span className="muted">Delivery</span><span>{money(order.delivery_cents)}</span></div>}
            <div className="grand"><span>Total</span><span>{money(order.total_cents)}</span></div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 22 }}>
          <h3 style={{ marginBottom: 8 }}>{order.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}</h3>
          <p>{drop ? `${fmtPickupDate(drop.pickup_date, true)}, ${drop.pickup_hours}` : ''}</p>
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
