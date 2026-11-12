'use server';
import type { CheckoutInput } from '@/lib/cart-types';
import { placeOrder } from '@/lib/orders';
import { quoteDelivery } from '@/lib/distance';
import { getSettings } from '@/lib/settings';
import { db } from '@/lib/db';
import { after } from 'next/server';
import { notifyCustomRequest, notifyNewOrder } from '@/lib/notifications';

export async function placeOrderAction(input: CheckoutInput) {
  const r = await placeOrder(input);
  // Emails and the phone alert go out right after the customer sees their confirmation.
  if (r.ok) after(() => notifyNewOrder(r.id));
  return r;
}

export async function deliveryQuoteAction(address: string) {
  return quoteDelivery(String(address ?? '').slice(0, 300), await getSettings());
}

export async function customRequestAction(_prev: unknown, form: FormData): Promise<{ ok: boolean; error?: string }> {
  const get = (k: string, max = 300) => String(form.get(k) ?? '').trim().slice(0, max);
  const name = get('name', 120), phone = get('phone', 40), email = get('email', 160);
  const event_date = get('event_date', 60), details = get('details', 3000);
  if (get('website')) return { ok: true }; // spam bots fill the hidden field
  if (!name || !details) return { ok: false, error: 'Please share your name and what you would like.' };
  if (phone.replace(/\D/g, '').length < 10) return { ok: false, error: 'Please enter a valid phone number.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Please enter a valid email address.' };
  try {
    await db()`insert into custom_requests (name, phone, email, event_date, details) values (${name}, ${phone}, ${email}, ${event_date}, ${details})`;
    after(() => notifyCustomRequest(name, `${event_date ? `Needed ${event_date}. ` : ''}${details}`));
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}
