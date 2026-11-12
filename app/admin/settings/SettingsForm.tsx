'use client';
import { useActionState, useState, useTransition } from 'react';
import type { Settings } from '@/lib/settings';
import type { emailCheck } from '@/lib/email';

type Check = ReturnType<typeof emailCheck>;

/** Shows exactly what email login the website is using, without revealing the password. */
function EmailCheck({ c }: { c: Check }) {
  const Line = ({ good, children }: { good: boolean; children: React.ReactNode }) => (
    <li style={{ listStyle: 'none', marginBottom: 10 }}><strong>{good ? '✓' : '!'}</strong> {children}</li>
  );
  return (
    <div className="note" style={{ borderWidth: 2 }}>
      <strong style={{ fontSize: '1.15rem' }}>Email check</strong>
      <ul style={{ padding: 0, margin: '12px 0 0' }}>
        {c.userSet ? (
          <Line good={c.userLooksRight}>GMAIL_USER is <strong style={{ wordBreak: 'break-all' }}>{c.user || '(empty)'}</strong>{c.userWasCleaned && ' (extra spaces or quotes were removed)'}.{!c.userLooksRight && ' This does not look like an email address.'} It must be the exact Google account where you made the app password.</Line>
        ) : (
          <Line good={false}>GMAIL_USER is <strong>missing</strong> in Vercel.</Line>
        )}
        {c.passSet ? (
          <Line good={c.passLength === 16 && c.passOnlyLetters}>
            GMAIL_APP_PASSWORD has <strong>{c.passLength} characters</strong> after removing spaces{c.passLength === 16 ? ' (correct: app passwords have exactly 16).' : '. An app password has exactly 16 letters, so this one is not right.'}
            {!c.passOnlyLetters && ' It contains numbers or symbols. App passwords are only letters, so this may be your regular Gmail password instead of an app password.'}
          </Line>
        ) : (
          <Line good={false}>GMAIL_APP_PASSWORD is <strong>missing</strong> in Vercel.</Line>
        )}
        <Line good={c.environment === 'production' || c.environment === 'local'}>This check is running on your <strong>{c.environment}</strong> website.</Line>
      </ul>
    </div>
  );
}
import { ImagePicker } from '@/components/ImagePicker';
import { saveSettingsAction, sendTestEmailAction, sendTestPushAction } from '../actions';

function F({ name, label, value, placeholder, type = 'text' }: { name: string; label: string; value: string; placeholder?: string; type?: string }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} className="input" defaultValue={value} placeholder={placeholder} />
    </div>
  )
}

function TestButton({ label, run }: { label: string; run: () => Promise<{ ok: boolean; error?: string }> }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="stack">
      <button type="button" className="btn btn-sm btn-outline" disabled={pending}
        onClick={() => start(async () => { const r = await run(); setMsg({ ok: r.ok, text: r.ok ? 'Sent! Check your phone or inbox.' : r.error ?? 'Did not send.' }); })}>
        {pending ? 'Sending…' : label}
      </button>
      {msg && <div className={msg.ok ? 'success' : 'alert'}>{msg.text}</div>}
    </div>
  );
}

export function SettingsForm({ s, products, emailReady, check }: { s: Settings; products: { id: string; name: string; hasPhoto: boolean }[]; emailReady: boolean; check: Check }) {
  const [state, action, pending] = useActionState(saveSettingsAction, null);
  return (
    <form action={action} className="form-grid">
      <div className="panel form-grid">
        <h3>1. How customers pay you</h3>
        <p className="muted">Customers see these right after they order. Leave a box empty to hide that option.</p>
        <F name="cashapp" label="Cash App $Cashtag" value={s.cashapp} placeholder="$YourCashtag" />
        <F name="zelle" label="Zelle (phone or email)" value={s.zelle} placeholder="864-555-1234" />
        <F name="applepay" label="Apple Pay / Apple Cash (phone or email)" value={s.applepay} placeholder="864-555-1234" />
        <div className="field"><label htmlFor="payment_note">Payment instructions</label><textarea id="payment_note" name="payment_note" className="textarea" defaultValue={s.payment_note} /></div>
      </div>

      <div className="panel form-grid">
        <h3>2. Logo &amp; photos</h3>
        <ImagePicker name="logo_image_id" initialId={s.logo_image_id} label="Logo" logo />
        <div className="field">
          <label htmlFor="hero_product_id">Big homepage photo (inside the arch)</label>
          <span className="hint">Choose an item. Its photo, name and price show at the top of your homepage. Upload the photo in Menu &amp; Photos.</span>
          <select id="hero_product_id" name="hero_product_id" className="select" defaultValue={s.hero_product_id ?? ''}>
            <option value="">Red Velvet Honey Bun Cake (default)</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.hasPhoto ? '' : ' (no photo yet)'}</option>)}
          </select>
        </div>
        <F name="business_name" label="Business name" value={s.business_name} />
        <div className="field"><label htmlFor="tagline">Tagline (under the big heading)</label><textarea id="tagline" name="tagline" className="textarea" defaultValue={s.tagline} /></div>
      </div>

      <div className="panel form-grid">
        <h3>3. Contact</h3>
        <F name="contact_phone" label="Phone for texts" value={s.contact_phone} type="tel" />
        <F name="contact_email" label="Email" value={s.contact_email} type="email" />
        <F name="instagram" label="Instagram" value={s.instagram} placeholder="@yourbakery" />
      </div>

      <div className="panel form-grid">
        <h3>4. Pickup &amp; delivery</h3>
        <F name="pickup_place" label="Pickup place" value={s.pickup_place} />
        <F name="pickup_address" label="Pickup address" value={s.pickup_address} />
        <label className="check"><input type="checkbox" name="delivery_enabled" defaultChecked={s.delivery_enabled} /> Offer delivery ($5 within 10 miles, $10 for 10–20 miles)</label>
      </div>

      <div className="panel form-grid">
        <h3>5. Emails</h3>
        {!emailReady && <div className="alert">Email isn&apos;t turned on yet. Follow the email setup steps (Gmail app password) to turn it on.</div>}
        <F name="notify_email" label="Send new order alerts to" value={s.notify_email} type="email" />
        <div className="field">
          <label htmlFor="care_instructions">Care &amp; storage instructions</label>
          <span className="hint">Sent in the thank-you email when you mark an order Picked up. Leave a blank line between paragraphs.</span>
          <textarea id="care_instructions" name="care_instructions" className="textarea" style={{ minHeight: 220 }} defaultValue={s.care_instructions} />
        </div>
        <EmailCheck c={check} />
        <TestButton label="Send Me a Test Email" run={sendTestEmailAction} />
      </div>

      <div className="panel form-grid">
        <h3>6. Phone alerts</h3>
        <p className="muted">In the free <strong>ntfy</strong> app on your iPhone, subscribe to this name. New orders and custom requests will buzz your phone.</p>
        <div className="field">
          <label htmlFor="ntfy_topic">Your private alert name</label>
          <input id="ntfy_topic" name="ntfy_topic" className="input" defaultValue={s.ntfy_topic} style={{ fontFamily: 'ui-monospace, monospace' }} />
          <span className="hint">Keep this private. Anyone with this name could see your alerts.</span>
        </div>
        <TestButton label="Send a Test Alert to My Phone" run={sendTestPushAction} />
      </div>

      {state?.ok && <div className="success">Saved! Your website is updated.</div>}
      {state?.error && <div className="alert">{state.error}</div>}
      <button className="btn btn-block" disabled={pending}>{pending ? 'Saving…' : 'Save Settings'}</button>
    </form>
  );
}
