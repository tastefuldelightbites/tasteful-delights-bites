import { promises as fs } from 'fs';
import path from 'path';

/**
 * Email is sent through Resend (resend.com) from the bakery's own address,
 * orders@tastefuldelightsbites.com. Vercel setting needed: RESEND_API_KEY.
 * The domain must be verified in Resend (DNS records on "send" and
 * "resend._domainkey"; the iCloud email records are not touched).
 */
export const FROM_ADDRESS = 'orders@tastefuldelightsbites.com';
export const FROM_NAME = 'Tasteful Delights Bites';
export const OWNER_EMAIL = 'orders@tastefuldelightsbites.com';

const RESEND_URL = (process.env.RESEND_API_URL || 'https://api.resend.com').replace(/\/$/, '');

/** The Resend key, cleaned up (spaces, line breaks and quotes removed). */
function resendKey(): string {
  return (process.env.RESEND_API_KEY ?? '').replace(/[\s"'`“”‘’]+/g, '');
}

/** Facts about the email setup that are safe to show (never the key itself). */
export function emailCheck() {
  const key = resendKey();
  return {
    keySet: key.length > 0,
    keyLooksRight: /^re_[A-Za-z0-9_]{10,}$/.test(key),
    keyLength: key.length,
    from: FROM_ADDRESS,
    environment: process.env.VERCEL_ENV ?? 'local',
  };
}

export function emailConfigured() {
  return Boolean(resendKey()) || Boolean(process.env.EMAIL_PREVIEW_DIR);
}

/** The website's public address, for links and the logo in emails. */
export function siteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export type Mail = { to: string; subject: string; html: string; text: string; replyTo?: string; headers?: Record<string, string> };

/** Sends one email through Resend. Never throws; always says what happened. */
export async function sendEmail(m: Mail): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    // For testing: save emails as files instead of sending.
    if (process.env.EMAIL_PREVIEW_DIR) {
      const name = `${Date.now()}-${m.to.replace(/[^a-z0-9]/gi, '_')}-${m.subject.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.html`;
      await fs.mkdir(process.env.EMAIL_PREVIEW_DIR, { recursive: true });
      await fs.writeFile(path.join(process.env.EMAIL_PREVIEW_DIR, name), `<!-- From: ${FROM_ADDRESS} | To: ${m.to} | Subject: ${m.subject} -->\n${m.html}`);
      return { ok: true };
    }
    const key = resendKey();
    if (!key) return { ok: false, error: 'Email is not set up yet: add RESEND_API_KEY in Vercel.' };
    const res = await fetch(`${RESEND_URL}/emails`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_ADDRESS}>`,
        to: [m.to],
        subject: m.subject,
        html: m.html,
        text: m.text,
        reply_to: m.replyTo,
        headers: m.headers,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.text();
    if (!res.ok) {
      let msg = body.slice(0, 300);
      try { msg = JSON.parse(body).message ?? msg; } catch { /* not JSON */ }
      if (res.status === 401 || res.status === 403) {
        if (/domain/i.test(msg)) return { ok: false, error: `Resend says the domain is not verified yet: ${msg}. Finish the DNS steps, then tap Verify in Resend.` };
        return { ok: false, error: `Resend did not accept the API key: ${msg}` };
      }
      return { ok: false, error: `Resend answered ${res.status}: ${msg}` };
    }
    let id: string | undefined;
    try { id = JSON.parse(body).id; } catch { /* not JSON */ }
    return { ok: true, id };
  } catch (e) {
    console.error('Email failed', e);
    const err = e as Error;
    return { ok: false, error: err.name === 'TimeoutError' ? 'Resend did not answer within 15 seconds.' : `Could not reach Resend: ${err.message}` };
  }
}

/* ------------------------------------------------------------------ */
/* Branded layout: cream background, soft black text, logo on top.    */
/* ------------------------------------------------------------------ */

export const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export function emailLayout(opts: { preheader: string; heading: string; body: string; footerExtra?: string }) {
  const site = siteUrl();
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#FAF5EC;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF5EC;">
<tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFDF8;border:1px solid #E4DDD1;border-radius:18px;">
<tr><td align="center" style="padding:30px 28px 6px;">
  <a href="${site}"><img src="${site}/logo.png" width="96" height="96" alt="Tasteful Delights Bites" style="display:block;border:0;width:96px;height:96px;"></a>
</td></tr>
<tr><td style="padding:10px 32px 4px;font-family:${SERIF};font-size:30px;line-height:1.2;color:#2A2A2A;text-align:center;">${opts.heading}</td></tr>
<tr><td style="padding:8px 32px 30px;font-family:${SANS};font-size:16px;line-height:1.6;color:#2A2A2A;">${opts.body}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:18px 20px;font-family:${SANS};font-size:13px;line-height:1.6;color:#6B6B6B;text-align:center;">
  Tasteful Delights Bites · Small-batch cookies &amp; honey bun cakes · Mauldin, SC<br>
  <a href="${site}" style="color:#2A2A2A;">${esc(site.replace(/^https?:\/\//, ''))}</a>${opts.footerExtra ? `<br>${opts.footerExtra}` : ''}
</td></tr></table>
</td></tr></table>
</body></html>`;
}

/** A simple two-column table of label / value rows. */
export function rowsTable(rows: [string, string][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0;border-top:1px solid #E4DDD1;">${rows
    .map(([a, b]) => `<tr><td style="padding:10px 0;border-bottom:1px solid #E4DDD1;font-family:${SANS};font-size:15px;color:#2A2A2A;vertical-align:top;">${a}</td><td style="padding:10px 0;border-bottom:1px solid #E4DDD1;font-family:${SANS};font-size:15px;color:#2A2A2A;text-align:right;vertical-align:top;white-space:nowrap;">${b}</td></tr>`)
    .join('')}</table>`;
}

export function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px auto 6px;"><tr><td style="background:#2A2A2A;border-radius:999px;">
  <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:16px;font-weight:bold;color:#FAF5EC;text-decoration:none;">${esc(label)}</a></td></tr></table>`;
}

export function box(html: string) {
  return `<div style="margin:16px 0;padding:16px 18px;border:1px solid #2A2A2A;border-radius:14px;font-family:${SANS};font-size:15px;line-height:1.6;color:#2A2A2A;">${html}</div>`;
}

/** Turns plain text with blank lines into paragraphs. */
export function paragraphs(text: string) {
  return text.split(/\n\s*\n/).map((p) => `<p style="margin:0 0 14px;">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
}

/** Very small text version of an email from its HTML. */
export function toText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<div style="display:none[\s\S]*?<\/div>/i, '')
    .replace(/<(br|\/p|\/tr|\/h\d|\/div)>/gi, '\n')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
}
