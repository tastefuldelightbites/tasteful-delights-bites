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
        <Line good>Emails are sent from <strong>{c.from}</strong> through Resend.</Line>
        {c.keySet ? (
          <Line good={c.keyLooksRight}>RESEND_API_KEY is set ({c.keyLength} characters){c.keyLooksRight ? '.' : '. It should start with re_ — please copy the key again from Resend.'}</Line>
        ) : (
          <Line good={false}>RESEND_API_KEY is <strong>missing</strong> in Vercel.</Line>
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

type TestResult = { ok: boolean; error?: string; url?: string; id?: string };

function TestButton({ label, run }: { label: string; run: () => Promise<TestResult> }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const describe = (r: TestResult) => {
    if (r.ok) return r.url ? `Sent! ntfy.sh confirmed it (message ${r.id}) for ${r.url}. If your phone doesn't buzz, check that the ntfy app is subscribed to exactly that name.` : 'Sent! Check your inbox.';
    return `${r.error ?? 'Did not send.'}${r.url ? ` (posted to ${r.url})` : ''}`;
  };
  return (
    <div className="stack">
      <button type="button" className="btn btn-sm btn-outline" disabled={pending}
        onClick={() => start(async () => {
          try { const r = await run(); setMsg({ ok: r.ok, text: describe(r) }); }
          catch (e) { setMsg({ ok: false, text: `The website could not run the test: ${e instanceof Error ? e.message : String(e)}` }); }
        })}>
        {pending ? 'Sending…' : label}
      </button>
      {msg && <div className={msg.ok ? 'success' : 'alert'}>{msg.text}</div>}
    </div>
  );
}

export function SettingsForm({ s, emailReady, check }: { s: Settings; emailReady: boolean; check: Check }) {
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
        <h3>2. Logo &amp; name</h3>
        <ImagePicker name="logo_image_id" initialId={s.logo_image_id} label="Logo" logo />
        <p className="muted">To change the big homepage photo and its caption, go to <a href="/admin/menu#homepage-photo" style={{ fontWeight: 700 }}>Menu &amp; Photos → Homepage Photo</a>.</p>
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
        {!emailReady && <div className="alert">Email isn&apos;t turned on yet. Follow the Resend setup steps to turn it on.</div>}
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
          <span className="hint">Alerts are posted to <strong style={{ wordBreak: 'break-all' }}>https://ntfy.sh/{s.ntfy_topic}</strong>. In the ntfy app, subscribe to <strong>{s.ntfy_topic}</strong> exactly. Keep this name private.</span>
        </div>
        <TestButton label="Send a Test Alert to My Phone" run={sendTestPushAction} />
      </div>

      {state?.ok && <div className="success">Saved! Your website is updated.</div>}
      {state?.error && <div className="alert">{state.error}</div>}
      <button className="btn btn-block" disabled={pending}>{pending ? 'Saving…' : 'Save Settings'}</button>
    </form>
  );
}
