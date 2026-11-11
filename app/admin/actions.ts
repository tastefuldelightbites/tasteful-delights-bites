'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { checkPassword, endSession, requireAdmin, startSession } from '@/lib/auth';
import { runSetupStep, SETUP_STEP_COUNT } from '@/lib/setup';
import { saveSettings, type Settings } from '@/lib/settings';
import { db, describeDatabase } from '@/lib/db';
import { parseEasternLocal, standardDropFor } from '@/lib/time';

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
    if (step === total - 1) revalidatePath('/', 'layout');
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
  };
  const hero = t('hero_image_id', 40);
  if (hero === 'none') patch.hero_image_id = null;
  else if (/^[0-9a-f-]{36}$/i.test(hero)) patch.hero_image_id = hero;
  const logo = t('logo_image_id', 40);
  if (logo === 'none') patch.logo_image_id = null;
  else if (/^[0-9a-f-]{36}$/i.test(logo)) patch.logo_image_id = logo;
  try {
    await saveSettings(patch);
    revalidatePath('/', 'layout');
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
  revalidatePath('/admin', 'layout');
  revalidatePath('/', 'layout');
}

/* ---------------- Drops ---------------- */


/** One tap: creates the next normal weekly Drop (opens Wednesday, closes Monday 11:59pm, pickup Saturday). */
export async function createNextDropAction() {
  await requireAdmin();
  const sql = db();
  let weeks = 0;
  let w = standardDropFor(new Date(), weeks);
  // skip weeks that already have a Drop
  for (;;) {
    const clash = await sql`select 1 from drops where opens_at < ${w.closes_at} and closes_at > ${w.opens_at} limit 1`;
    if (clash.length === 0) break;
    w = standardDropFor(new Date(), ++weeks);
    if (weeks > 52) break;
  }
  const [d] = await sql`insert into drops (title, opens_at, closes_at, pickup_date) values ('Weekly Drop', ${w.opens_at}, ${w.closes_at}, ${w.pickup_date}) returning id`;
  revalidatePath('/', 'layout');
  redirect(`/admin/drops/${d.id}?created=1`);
}

export async function saveDropAction(_prev: unknown, form: FormData): Promise<{ ok?: boolean; error?: string }> {
  await requireAdmin();
  const id = String(form.get('id') ?? '');
  const opens = String(form.get('opens_at') ?? '');
  const closes = String(form.get('closes_at') ?? '');
  const pickup = String(form.get('pickup_date') ?? '');
  const hours = String(form.get('pickup_hours') ?? '').trim().slice(0, 60) || '10am – 4pm';
  const title = String(form.get('title') ?? '').trim().slice(0, 60) || 'Weekly Drop';
  if (!opens || !closes || !/^\d{4}-\d{2}-\d{2}$/.test(pickup)) return { error: 'Please fill in all the dates.' };
  const o = parseEasternLocal(opens), c = parseEasternLocal(closes);
  if (c <= o) return { error: 'The closing time must be after the opening time.' };
  const sql = db();
  try {
    await sql.begin(async (tx) => {
      await tx`update drops set title = ${title}, opens_at = ${o}, closes_at = ${c}, pickup_date = ${pickup}, pickup_hours = ${hours} where id = ${id}`;
      const products = await tx<{ id: string }[]>`select id from products`;
      for (const p of products) {
        const enabled = form.get(`limit_on_${p.id}`) === 'on';
        const qty = Math.max(0, Math.floor(Number(form.get(`limit_qty_${p.id}`) ?? 0)) || 0);
        await tx`insert into drop_limits (drop_id, product_id, enabled, qty) values (${id}, ${p.id}, ${enabled}, ${qty})
          on conflict (drop_id, product_id) do update set enabled = excluded.enabled, qty = excluded.qty`;
      }
    });
  } catch (e) {
    console.error(e);
    return { error: 'Could not save. Please try again.' };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function deleteDropAction(id: string) {
  await requireAdmin();
  const sql = db();
  const [{ n }] = await sql`select count(*)::int as n from orders where drop_id = ${id}`;
  if (n > 0) return { error: 'This Drop has orders, so it cannot be deleted. You can change its dates instead.' };
  await sql`delete from drops where id = ${id}`;
  revalidatePath('/', 'layout');
  redirect('/admin/drops');
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
  const section = kind === 'cookie' ? 'Cookies' : t('section', 60) || 'More Treats';
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
  revalidatePath('/', 'layout');
  if (!id) redirect('/admin/menu?added=1');
  return { ok: true };
}

export async function toggleHiddenAction(id: string, hidden: boolean) {
  await requireAdmin();
  await db()`update products set hidden = ${hidden} where id = ${id}`;
  revalidatePath('/', 'layout');
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
  revalidatePath('/', 'layout');
}

export async function deleteProductAction(id: string) {
  await requireAdmin();
  await db()`delete from products where id = ${id}`;
  revalidatePath('/', 'layout');
  redirect('/admin/menu?removed=1');
}

/* ---------------- Custom requests ---------------- */

export async function setRequestStatusAction(id: string, status: 'new' | 'done') {
  await requireAdmin();
  await db()`update custom_requests set status = ${status} where id = ${id}`;
  revalidatePath('/admin', 'layout');
}
