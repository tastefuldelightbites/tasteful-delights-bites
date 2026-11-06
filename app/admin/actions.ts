'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { checkPassword, endSession, requireAdmin, startSession } from '@/lib/auth';
import { runSetup } from '@/lib/setup';
import { saveSettings, type Settings } from '@/lib/settings';
import { db } from '@/lib/db';

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

export async function setupAction(): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  try {
    await runSetup();
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: e instanceof Error ? e.message : 'Setup failed' };
  }
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
