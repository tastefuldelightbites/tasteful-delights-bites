import { getOrder, type OrderItemRow, type OrderRow } from './orders';
import { getSettings, type Settings } from './settings';
import { dropName, type Drop } from './menu';
import { money } from './money';
import { fmtPickupDate } from './time';
import { box, button, emailLayout, esc, paragraphs, rowsTable, sendEmail, siteUrl, toText } from './email';

/* ------------------------------------------------------------------ */
/* Phone alerts (ntfy: free app, no account needed)                    */
/* ------------------------------------------------------------------ */

/**
 * Turns whatever was typed or pasted into a clean ntfy topic name.
 * "https://ntfy.sh/tdb-orders-abc", "ntfy.sh/tdb-orders-abc" or " tdb-orders-abc " all become "tdb-orders-abc".
 */
export function cleanTopic(v: string | null | undefined): string {
  let t = String(v ?? '').trim().replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, '');
  t = t.split(/[?#]/)[0].replace(/\/+$/, '');
  if (t.includes('/')) t = t.slice(t.lastIndexOf('/') + 1);
  return t.replace(/[^A-Za-z0-9_-]/g, '');
}

const NTFY_SERVER = (process.env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/$/, '');

export type PushResult = { ok: boolean; error?: string; url?: string; id?: string };

/**
 * Posts a notification straight to https://ntfy.sh/<topic> (the same way
 * posting from Safari does), waits for ntfy's answer, and checks that ntfy
 * accepted it for the right topic.
 */
export async function pushToPhone(title: string, message: string, click?: string): Promise<PushResult> {
  const s = await getSettings();
  const topic = cleanTopic(s.ntfy_topic);
  if (!topic) return { ok: false, error: 'Phone alerts are not set up yet: the alert name in Settings is empty.' };
  const url = `${NTFY_SERVER}/${encodeURIComponent(topic)}`;
  // Title, priority and link go in the address (safe for any letters or emoji); the message is the body.
  const q = new URLSearchParams({ title, priority: '5', tags: 'cake' });
  if (click) q.set('click', click);
  try {
    const res = await fetch(`${url}?${q.toString()}`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: message,
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, url, error: `ntfy.sh answered ${res.status} ${res.statusText}: ${text.slice(0, 200)}` };
    let body: { id?: string; topic?: string; event?: string } = {};
    try { body = JSON.parse(text); } catch { /* not JSON */ }
    if (!body.id) return { ok: false, url, error: `ntfy.sh answered but did not confirm the message: ${text.slice(0, 200) || '(empty answer)'}` };
    if (body.topic && body.topic !== topic) return { ok: false, url, error: `ntfy.sh put the message in "${body.topic}" instead of "${topic}".` };
    return { ok: true, url, id: body.id };
  } catch (e) {
    console.error('Push failed', e);
    const err = e as Error & { cause?: { code?: string; message?: string } };
    const why = err.name === 'TimeoutError' ? 'ntfy.sh did not answer within 10 seconds' : `${err.message}${err.cause ? ` (${err.cause.code ?? err.cause.message})` : ''}`;
    return { ok: false, url, error: `Could not reach ntfy.sh: ${why}` };
  }
}

/* ------------------------------------------------------------------ */
/* Order emails                                                        */
/* ------------------------------------------------------------------ */

function itemLines(items: OrderItemRow[]) {
  return items.map((it) => {
    const name = it.flavors.length ? `${esc(it.name)}<br><span style="color:#6B6B6B;font-size:14px;">${esc(it.flavors.map((f) => `${f.qty} ${f.name}`).join(', '))}</span>` : `${esc(it.name)}${it.option_label ? ` (${esc(it.option_label)})` : ''}`;
    return [`${it.quantity} × ${name}`, money(it.line_cents)] as [string, string];
  });
}

function totals(o: OrderRow): [string, string][] {
  const rows: [string, string][] = [['Treats', money(o.subtotal_cents)]];
  if (o.fulfillment === 'delivery') rows.push(['Delivery', money(o.delivery_cents)]);
  rows.push(['<strong>Total</strong>', `<strong>${money(o.total_cents)}</strong>`]);
  return rows;
}

function pickupWhen(drop: Drop | undefined) {
  return drop ? `${fmtPickupDate(drop.pickup_date, true)}, ${drop.pickup_hours}` : '';
}

function payDetails(s: Settings, chosen: string, total: number, orderNo: number) {
  const ways: { name: string; how: string }[] = [];
  if (s.cashapp) ways.push({ name: 'Cash App', how: `Send to <strong>$${esc(s.cashapp.replace(/^\$/, ''))}</strong> · <a href="https://cash.app/$${encodeURIComponent(s.cashapp.replace(/^\$/, ''))}/${(total / 100).toFixed(2)}" style="color:#2A2A2A;">open Cash App</a>` });
  if (s.zelle) ways.push({ name: 'Zelle', how: `Send to <strong>${esc(s.zelle)}</strong> from your bank's app` });
  if (s.applepay) ways.push({ name: 'Apple Pay', how: `Send Apple Cash to <strong>${esc(s.applepay)}</strong> in Messages` });
  ways.sort((a, b) => Number(b.name === chosen) - Number(a.name === chosen));
  if (ways.length === 0) return `<p>I'll reach out with payment details shortly.</p>`;
  return box(`<strong>Please send ${money(total)}</strong> and write <strong>Order ${orderNo}</strong> in the payment note.<br><br>${ways
    .map((w) => `<strong>${w.name}${w.name === chosen ? ' (your choice)' : ''}:</strong> ${w.how}`).join('<br>')}`);
}

function whereBlock(o: OrderRow, drop: Drop | undefined, s: Settings) {
  return o.fulfillment === 'delivery'
    ? box(`<strong>Delivery${drop ? ` · ${esc(dropName(drop))}` : ''}</strong><br>${esc(pickupWhen(drop).split(',').slice(0, 2).join(','))}<br>${esc(o.address)}`)
    : box(`<strong>Pickup${drop ? ` · ${esc(dropName(drop))}` : ''}</strong><br>${esc(pickupWhen(drop))}<br>${esc(s.pickup_place)}, ${esc(s.pickup_address)}`);
}

/** Owner alert + customer confirmation + phone alert for a new order. Never throws. */
export async function notifyNewOrder(orderId: string) {
  try {
    const data = await getOrder(orderId);
    if (!data) return;
    const { order: o, items, drop } = data;
    const s = await getSettings();
    const first = o.name.split(' ')[0];
    const where = o.fulfillment === 'delivery' ? `Delivery to ${o.address}` : `Pickup ${pickupWhen(drop)}`;
    const admin = `${siteUrl()}/admin/orders${o.drop_id ? `?drop=${o.drop_id}` : ''}`;

    // 1) Alert to the owner
    const ownerHtml = emailLayout({
      preheader: `${o.name} · ${money(o.total_cents)} · ${o.payment_method}`,
      heading: `New order #${o.order_number}`,
      body: `${rowsTable([
        ['Name', esc(o.name)],
        ['Phone', `<a href="tel:${esc(o.phone)}" style="color:#2A2A2A;">${esc(o.phone)}</a>`],
        ['Email', esc(o.email)],
        ['Paying with', esc(o.payment_method || 'Not chosen')],
        ['Order for', esc(drop ? dropName(drop) : '')],
        [o.fulfillment === 'delivery' ? 'Delivery' : 'Pickup', esc(o.fulfillment === 'delivery' ? `${o.address} (${o.distance_miles} mi)` : pickupWhen(drop))],
      ])}${rowsTable([...itemLines(items), ...totals(o)])}${o.notes ? box(`<strong>Note:</strong> ${esc(o.notes)}`) : ''}${button(admin, 'Open my orders')}`,
    });
    await sendEmail({ to: s.notify_email, subject: `New order #${o.order_number}: ${o.name}, ${money(o.total_cents)}`, html: ownerHtml, text: toText(ownerHtml), replyTo: o.email });

    // 2) Confirmation to the customer
    const custHtml = emailLayout({
      preheader: `Order ${o.order_number} · ${where}`,
      heading: `Thank you, ${esc(first)}!`,
      body: `<p style="margin:0 0 14px;">Your order is in, and I can't wait to bake for you. Here are your details.</p>
        ${payDetails(s, o.payment_method, o.total_cents, o.order_number)}
        ${whereBlock(o, drop, s)}
        <p style="margin:18px 0 4px;"><strong>Your order #${o.order_number}</strong></p>
        ${rowsTable([...itemLines(items), ...totals(o)])}
        ${button(`${siteUrl()}/order/${o.id}`, 'View my order')}
        <p style="margin:14px 0 0;">Questions? Just reply to this email${s.contact_phone ? ` or text ${esc(s.contact_phone)}` : ''}.</p>
        <p style="margin:14px 0 0;">With love,<br>Tasteful Delights Bites</p>`,
    });
    await sendEmail({ to: o.email, subject: `Your Tasteful Delights order #${o.order_number}`, html: custHtml, text: toText(custHtml), replyTo: s.notify_email });

    // 3) Phone alert
    await pushToPhone(`New order: ${o.name}, ${money(o.total_cents)}`, `#${o.order_number} · ${o.payment_method || 'payment not chosen'} · ${where}`, admin);
  } catch (e) {
    console.error('notifyNewOrder failed', e);
  }
}

/** "Your order is ready" (pickup) or "out for delivery" email. */
export async function sendReadyEmail(orderId: string) {
  const data = await getOrder(orderId);
  if (!data) return { ok: false, error: 'Order not found.' };
  const { order: o, drop } = data;
  const s = await getSettings();
  const first = o.name.split(' ')[0];
  const delivery = o.fulfillment === 'delivery';
  const html = emailLayout({
    preheader: delivery ? 'Your treats are on their way.' : 'Your treats are ready for pickup.',
    heading: delivery ? `On the way, ${esc(first)}!` : `Your order is ready, ${esc(first)}!`,
    body: delivery
      ? `<p style="margin:0 0 14px;">Your order #${o.order_number} is out for delivery and headed your way.</p>
         ${box(`<strong>Delivering to</strong><br>${esc(o.address)}`)}
         <p style="margin:14px 0 0;">See you soon!<br>Tasteful Delights Bites</p>`
      : `<p style="margin:0 0 14px;">Your order #${o.order_number} is boxed up and ready for you.</p>
         ${box(`<strong>Pickup</strong><br>${esc(pickupWhen(drop))}<br>${esc(s.pickup_place)}, ${esc(s.pickup_address)}`)}
         <p style="margin:14px 0 0;">${s.contact_phone ? `Text ${esc(s.contact_phone)} when you arrive. ` : ''}See you soon!<br>Tasteful Delights Bites</p>`,
  });
  return sendEmail({ to: o.email, subject: delivery ? `Your order #${o.order_number} is out for delivery` : `Your order #${o.order_number} is ready for pickup`, html, text: toText(html), replyTo: s.notify_email });
}

/** Thank-you email with care and storage instructions, after pickup. */
export async function sendThankYouEmail(orderId: string) {
  const data = await getOrder(orderId);
  if (!data) return { ok: false, error: 'Order not found.' };
  const { order: o } = data;
  const s = await getSettings();
  const html = emailLayout({
    preheader: 'Thank you, and how to keep your treats fresh.',
    heading: `Thank you, ${esc(o.name.split(' ')[0])}!`,
    body: `<p style="margin:0 0 14px;">Thank you for choosing Tasteful Delights Bites. I hope every bite brings a smile.</p>
      <p style="margin:18px 0 8px;font-family:Georgia,serif;font-size:20px;">Keeping your treats fresh</p>
      ${paragraphs(s.care_instructions)}
      <p style="margin:14px 0 0;">I'd love to see your treats. Tag us${s.instagram ? ` @${esc(s.instagram.replace(/^@/, ''))}` : ''} or reply and tell me your favorite.</p>
      ${button(siteUrl(), 'See this week’s menu')}
      <p style="margin:14px 0 0;">With love,<br>Tasteful Delights Bites</p>`,
  });
  return sendEmail({ to: o.email, subject: 'Thank you from Tasteful Delights Bites', html, text: toText(html), replyTo: s.notify_email });
}

/** Phone alert for a new custom order request. */
export async function notifyCustomRequest(name: string, details: string) {
  await pushToPhone(`New custom request: ${name}`, details.slice(0, 180), `${siteUrl()}/admin/requests`);
}

/** Marketing email to one subscriber, with an unsubscribe link (required). */
export function marketingEmail(subject: string, message: string, token: string) {
  const unsub = `${siteUrl()}/unsubscribe/${token}`;
  const oneClick = `${siteUrl()}/api/unsubscribe/${token}`;
  const html = emailLayout({
    preheader: message.slice(0, 90),
    heading: esc(subject),
    body: `${paragraphs(message)}${button(siteUrl(), 'Order now')}`,
    footerExtra: `You're getting this because you joined our email list. <a href="${unsub}" style="color:#2A2A2A;">Unsubscribe</a>`,
  });
  return { html, text: toText(html), headers: { 'List-Unsubscribe': `<${oneClick}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } };
}
