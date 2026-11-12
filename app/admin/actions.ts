'use server';
import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { SHOP_TAG } from '@/lib/shop';

import { checkPassword, endSession, requireAdmin, startSession } from '@/lib/auth';
import { runSetupStep, SETUP_STEP_COUNT } from '@/lib/setup';
import { getSettings, saveSettings, type Settings } from '@/lib/settings';
import { db, describeDatabase, transaction } from '@/lib/db';
import { after } from 'next/server';
import { cleanTopic, pushToPhone, sendReadyEmail, sendThankYouEmail, marketingEmail, type PushResult } from '@/lib/notifications';
import { sendEmail } from '@/lib/email';
import { addDays, easternToDate, easternToday, parseEasternLocal } from '@/lib/time';
import { ensureWeeklyDrops } from '@/lib/schedule';

/** Shows changes on the customer site right away (clears the menu snapshot). */
function refreshSite() {
  revalidateTag(SHOP_TAG);
  revalidatePath('/', 'layout');
}


export async function loginAction(_prev: unknown, form: FormData): Promise<{ error?: string }> {
  const pw = String(form.get('password') ?? '');
  if (!checkPassword(pw)) {
    await new Promise((r) => setTimeout(r, 1500)); // slow down guessing
    return { error: 'That password is not right. Please try again.' };
  }
  await startSession();
  redirect('/admin');
}

export async function logoutAction() {
  await endSession();
  redirect('/admin/login');
}

/** Runs one small setup step. The Set Up button calls this once per step. */
export async function setupStepAction(step: number): Promise<{ ok: boolean; total: number; error?: string; where?: string }> {
  await requireAdmin();
  const total = SETUP_STEP_COUNT;
  try {
    if (!Number.isInteger(step) || step < 0 || step >= total) return { ok: false, total, error: 'Unknown setup step.' };
    await runSetupStep(step);
    if (step === total - 1) refreshSite();
    return { ok: true, total };
  } catch (e) {
    console.error(`Setup step ${step + 1} failed:`, e);
    return { ok: false, total, error: e instanceof Error ? e.message : String(e), where: describeDatabase() };
  }
}

export async function setupInfoAction(): Promise<{ total: number }> {
  await requireAdmin();
  return { total: SETUP_STEP_COUNT };
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/** Saves an uploaded photo and returns its id. */
export async function uploadImageAction(form: FormData): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireAdmin();
  const file = form.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'No photo received.' };
  if (!ALLOWED.includes(file.type)) return { ok: false, error: 'Please use a JPG or PNG photo.' };
  if (file.size > 3.5 * 1024 * 1024) return { ok: false, error: 'That photo is too large.' };
  const buf = Buffer.from(await file.arrayBuffer());
  const [row] = await db()`insert into images (mime, data) values (${file.type}, ${buf}) returning id`;
  return { ok: true, id: row.id as string };
}

export async function saveSettingsAction(_prev: unknown, form: FormData): Promise<{ ok?: boolean; error?: string }> {
  await requireAdmin();
  const t = (k: string, max = 300) => String(form.get(k) ?? '').trim().slice(0, max);
  const patch: Partial<Settings> = {
    business_name: t('business_name', 80) || 'Tasteful Delights Bites',
    tagline: t('tagline', 240),
    cashapp: t('cashapp', 60).replace(/^\$/, ''),
    zelle: t('zelle', 120),
    applepay: t('applepay', 120),
    payment_note: t('payment_note', 400),
    contact_phone: t('contact_phone', 40),
    contact_email: t('contact_email', 120),
    instagram: t('instagram', 60).replace(/^@/, ''),
    pickup_place: t('pickup_place', 80),
    pickup_address: t('pickup_address', 200),
    delivery_enabled: form.get('delivery_enabled') === 'on',
    notify_email: t('notify_email', 160) || 'orders@tastefuldelightsbites.com',
    care_instructions: String(form.get('care_instructions') ?? '').trim().slice(0, 3000),
    ntfy_topic: cleanTopic(t('ntfy_topic', 200)),
  };
  const heroItem = t('hero_product_id', 40);
  patch.hero_product_id = /^[0-9a-f-]{36}$/i.test(heroItem) ? heroItem : null;
  const logo = t('logo_image_id', 40);
  if (logo === 'none') patch.logo_image_id = null;
  else if (/^[0-9a-f-]{36}$/i.test(logo)) patch.logo_image_id = logo;
  try {
    await saveSettings(patch);
    refreshSite();
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { error: 'Could not save. Is the database set up?' };
  }
}

/* ---------------- Orders ---------------- */

export async function setOrderFlagAction(orderId: string, flag: 'paid' | 'picked_up' | 'canceled', on: boolean) {
  await requireAdmin();
  const sql = db();
  const col = flag === 'paid' ? 'paid_at' : flag === 'picked_up' ? 'picked_up_at' : 'canceled_at';
  await sql`update orders set ${sql(col)} = ${on ? new Date() : null} where id = ${orderId}`;
  // First time an order is marked picked up / delivered: send the thank-you email with care instructions.
  if (flag === 'picked_up' && on) {
    const [o] = await sql`update orders set thanked_at = now() where id = ${orderId} and thanked_at is null and canceled_at is null returning id`;
    if (o) after(async () => { await sendThankYouEmail(orderId); });
  }
  revalidatePath('/admin', 'layout');
  refreshSite();
}

/** Ready button: marks the order ready and emails the customer (ready for pickup / out for delivery). */
export async function markReadyAction(orderId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  await db()`update orders set ready_at = now() where id = ${orderId}`;
  const r = await sendReadyEmail(orderId);
  revalidatePath('/admin', 'layout');
  return r.ok ? { ok: true } : { ok: false, error: `Marked ready, but the email didn't send: ${r.error}` };
}

/* ---------------- Drops ---------------- */


/** One tap: creates a holiday or special Drop with starter dates you can change. */
export async function createHolidayDropAction() {
  await requireAdmin();
  const now = new Date();
  const today = easternToday(now);
  const closeYmd = addDays(today, 7);
  const [cy, cm, cd] = closeYmd.split('-').map(Number);
  const closes = easternToDate(cy, cm, cd, 23, 59, 59);
  const pickup = addDays(closeYmd, 2);
  const [d] = await db()`insert into drops (kind, title, opens_at, closes_at, pickup_date)
    values ('holiday', 'Holiday Menu', ${now}, ${closes}, ${pickup}) returning id`;
  refreshSite();
  redirect(`/admin/order-dates/${d.id}?created=1`);
}

/** Saves the weekly order schedule. */
export async function saveWeeklyAction(_prev: unknown, form: FormData): Promise<{ ok?: boolean; error?: string }> {
  await requireAdmin();
  const day = (k: string) => Math.min(6, Math.max(0, Math.floor(Number(form.get(k)))));
  const time = (k: string) => (/^\d{2}:\d{2}$/.test(String(form.get(k))) ? String(form.get(k)) : '00:00');
  const weekly = {
    enabled: form.get('enabled') === 'on',
    title: String(form.get('title') ?? '').trim().slice(0, 60) || 'Weekly Orders',
    open_day: day('open_day'), open_time: time('open_time'),
    close_day: day('close_day'), close_time: time('close_time'),
    pickup_day: day('pickup_day'),
    pickup_hours: String(form.get('pickup_hours') ?? '').trim().slice(0, 60) || '10am – 4pm',
  };
  try {
    await saveSettings({ weekly });
    await ensureWeeklyDrops(true);
  } catch (e) {
    console.error(e);
    return { error: 'Could not save. Please try again.' };
  }
  refreshSite();
  return { ok: true };
}

/** Pause or resume one week of weekly orders. */
export async function setWeekPausedAction(dropId: string, paused: boolean) {
  await requireAdmin();
  await db()`update drops set paused = ${paused} where id = ${dropId} and kind = 'weekly'`;
  refreshSite();
}

export async function saveDropAction(_prev: unknown, form: FormData): Promise<{ ok?: boolean; error?: string }> {
  await requireAdmin();
  const id = String(form.get('id') ?? '');
  const sql = db();
  const [drop] = await sql`select kind from drops where id = ${id}`;
  if (!drop) return { error: 'This order date no longer exists.' };
  const holiday = drop.kind !== 'weekly';
  let o: Date | null = null, c: Date | null = null, pickup = '', hours = '', title = '';
  if (holiday) {
    const opens = String(form.get('opens_at') ?? '');
    const closes = String(form.get('closes_at') ?? '');
    pickup = String(form.get('pickup_date') ?? '');
    hours = String(form.get('pickup_hours') ?? '').trim().slice(0, 60) || '10am – 4pm';
    title = String(form.get('title') ?? '').trim().slice(0, 60) || 'Holiday Menu';
    if (!opens || !closes || !/^\d{4}-\d{2}-\d{2}$/.test(pickup)) return { error: 'Please fill in all the dates.' };
    o = parseEasternLocal(opens); c = parseEasternLocal(closes);
    if (c <= o) return { error: 'The closing time must be after the opening time.' };
  }
  try {
    await transaction(async (tx) => {
      if (holiday) await tx`update drops set title = ${title}, opens_at = ${o}, closes_at = ${c}, pickup_date = ${pickup}, pickup_hours = ${hours} where id = ${id}`;
      const products = await tx<{ id: string }[]>`select id from products`;
      for (const p of products) {
        const enabled = form.get(`limit_on_${p.id}`) === 'on';
        const qty = Math.max(0, Math.floor(Number(form.get(`limit_qty_${p.id}`) ?? 0)) || 0);
        const hidden = form.get(`offer_${p.id}`) !== 'on';
        await tx`insert into drop_limits (drop_id, product_id, enabled, qty, hidden) values (${id}, ${p.id}, ${enabled}, ${qty}, ${hidden})
          on conflict (drop_id, product_id) do update set enabled = excluded.enabled, qty = excluded.qty, hidden = excluded.hidden`;
      }
    }, 'Saving', { retries: 1 });
  } catch (e) {
    console.error(e);
    return { error: 'Could not save. Please try again.' };
  }
  refreshSite();
  return { ok: true };
}

export async function deleteDropAction(id: string) {
  await requireAdmin();
  const sql = db();
  const [{ n }] = await sql`select count(*)::int as n from orders where drop_id = ${id}`;
  if (n > 0) return { error: 'This holiday menu has orders, so it cannot be deleted. You can change its dates instead.' };
  await sql`delete from drops where id = ${id}`;
  refreshSite();
  redirect('/admin/order-dates');
}

/* ---------------- Menu ---------------- */

export async function saveProductAction(_prev: unknown, form: FormData): Promise<{ ok?: boolean; error?: string }> {
  await requireAdmin();
  const t = (k: string, max = 300) => String(form.get(k) ?? '').trim().slice(0, max);
  const id = t('id', 40);
  const kind = t('kind') === 'cookie' ? 'cookie' : 'item';
  const name = t('name', 80);
  if (!name) return { error: 'Please give this item a name.' };
  const description = t('description', 400);
  const section = t('section', 60) || (kind === 'cookie' ? 'Cookies' : 'More Treats');
  const options: { label: string; cents: number }[] = [];
  if (kind === 'item') {
    for (let i = 0; i < 4; i++) {
      const label = t(`opt_label_${i}`, 40);
      const price = Number(t(`opt_price_${i}`, 12).replace(/[$,]/g, ''));
      if (label && price > 0) options.push({ label, cents: Math.round(price * 100) });
    }
    if (options.length === 0) return { error: 'Please add at least one size with a price (for example: Small, 15).' };
  }
  const tags = ['new', 'fan-fave'].filter((tg) => form.get(`tag_${tg}`) === 'on');
  const hidden = form.get('hidden') === 'on';
  const img = t('image_id', 40);
  const imageId = /^[0-9a-f-]{36}$/i.test(img) ? img : null;
  const sql = db();
  try {
    if (id) {
      await sql`update products set kind = ${kind}, name = ${name}, description = ${description}, section = ${section},
        options = ${sql.json(options)}, tags = ${tags}, hidden = ${hidden}, image_id = ${imageId} where id = ${id}`;
    } else {
      const [{ m }] = await sql`select coalesce(max(sort_order), 0) + 1 as m from products`;
      await sql`insert into products (kind, name, description, section, options, tags, hidden, image_id, sort_order)
        values (${kind}, ${name}, ${description}, ${section}, ${sql.json(options)}, ${tags}, ${hidden}, ${imageId}, ${m})`;
    }
  } catch (e) {
    console.error(e);
    return { error: 'Could not save. Please try again.' };
  }
  refreshSite();
  if (!id) redirect('/admin/menu?added=1');
  return { ok: true };
}

export async function toggleHiddenAction(id: string, hidden: boolean) {
  await requireAdmin();
  await db()`update products set hidden = ${hidden} where id = ${id}`;
  refreshSite();
}

/** One tap: add or remove the "New Item" badge. */
export async function toggleNewAction(id: string, on: boolean) {
  await requireAdmin();
  await db()`update products set tags = case when ${on} then array(select distinct unnest(tags || '{new}'::text[])) else array_remove(tags, 'new') end where id = ${id}`;
  refreshSite();
}

export async function moveProductAction(id: string, dir: -1 | 1) {
  await requireAdmin();
  const sql = db();
  const list = await sql<{ id: string }[]>`select id from products order by sort_order, created_at`;
  const i = list.findIndex((p) => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  for (let k = 0; k < list.length; k++) await sql`update products set sort_order = ${k} where id = ${list[k].id}`;
  refreshSite();
}

export async function deleteProductAction(id: string) {
  await requireAdmin();
  await db()`delete from products where id = ${id}`;
  refreshSite();
  redirect('/admin/menu?removed=1');
}

/* ---------------- Custom requests ---------------- */

export async function setRequestStatusAction(id: string, status: 'new' | 'done') {
  await requireAdmin();
  await db()`update custom_requests set status = ${status} where id = ${id}`;
  revalidatePath('/admin', 'layout');
}

/* ---------------- Tests from Settings ---------------- */

export async function sendTestPushAction(): Promise<PushResult> {
  await requireAdmin();
  return pushToPhone('Test from your bakery website', 'Phone alerts are working! New orders will show up like this.');
}

export async function sendTestEmailAction(): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const s = await getSettings();
  const { emailLayout, toText } = await import('@/lib/email');
  const html = emailLayout({ preheader: 'Email is working.', heading: 'Email is working!', body: '<p style="margin:0;">Your website can send emails. Order alerts will arrive at this address, and customers will get their confirmations.</p>' });
  return sendEmail({ to: s.notify_email, subject: 'Test email from your bakery website', html, text: toText(html) });
}

/* ---------------- Email list ---------------- */

export async function sendToSubscribersAction(_prev: unknown, form: FormData): Promise<{ ok?: boolean; error?: string; sent?: number }> {
  await requireAdmin();
  const subject = String(form.get('subject') ?? '').trim().slice(0, 120);
  const message = String(form.get('message') ?? '').trim().slice(0, 5000);
  if (!subject || !message) return { error: 'Please write a subject and a message.' };
  const subs = await db()<{ email: string; token: string }[]>`select email, token from subscribers where unsubscribed_at is null order by created_at`;
  if (subs.length === 0) return { error: 'You have no subscribers yet.' };
  if (subs.length > 400) return { error: 'Your list is larger than 400 people. Please ask for help to send in smaller batches.' };
  let sent = 0;
  let lastError = '';
  for (const sub of subs) {
    const m = marketingEmail(subject, message, sub.token);
    const r = await sendEmail({ to: sub.email, subject, html: m.html, text: m.text, headers: m.headers });
    if (r.ok) sent++; else lastError = r.error ?? '';
  }
  if (sent === 0) return { error: `No emails were sent. ${lastError}` };
  return { ok: true, sent };
}
