import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const COOKIE = 'tdb_admin';
const MAX_AGE = 60 * 60 * 24 * 30; // stay logged in for 30 days

export function adminPasswordSet() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function secret() {
  // Changing ADMIN_PASSWORD automatically logs out every device.
  return createHash('sha256')
    .update(`${process.env.ADMIN_PASSWORD ?? ''}|${process.env.POSTGRES_URL ?? ''}|tdb`)
    .digest();
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPassword(input: string) {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  const h = (s: string) => createHash('sha256').update(s).digest('hex');
  return safeEqual(h(input), h(real));
}

export async function startSession() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `admin.${exp}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  if (!adminPasswordSet()) return false;
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const i = v.lastIndexOf('.');
  const payload = v.slice(0, i);
  const sig = v.slice(i + 1);
  if (!safeEqual(sig, sign(payload))) return false;
  const exp = Number(payload.split('.')[1]);
  return exp > Date.now() / 1000;
}

/** Call at the top of every admin page and admin action. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect('/admin/login');
}
