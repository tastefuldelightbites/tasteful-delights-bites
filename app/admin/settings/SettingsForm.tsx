'use client';
import { useActionState } from 'react';
import type { Settings } from '@/lib/settings';
import { ImagePicker } from '@/components/ImagePicker';
import { saveSettingsAction } from '../actions';

function F({ name, label, value, placeholder, type = 'text' }: { name: string; label: string; value: string; placeholder?: string; type?: string }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} className="input" defaultValue={value} placeholder={placeholder} />
    </div>
  )
}

export function SettingsForm({ s }: { s: Settings }) {
  const [state, action, pending] = useActionState(saveSettingsAction, null);
  return (
    <form action={action} className="form-grid">
      <div className="panel form-grid">
        <h3>Your brand</h3>
        <ImagePicker name="logo_image_id" initialId={s.logo_image_id} label="Logo" logo />
        <F name="business_name" label="Business name" value={s.business_name} />
        <div className="field"><label htmlFor="tagline">Tagline (under the big heading)</label><textarea id="tagline" name="tagline" className="textarea" defaultValue={s.tagline} /></div>
      </div>

      <div className="panel form-grid">
        <h3>How customers pay you</h3>
        <p className="small muted">Shown to customers right after they order. Leave any blank to hide it.</p>
        <F name="cashapp" label="Cash App $Cashtag" value={s.cashapp} placeholder="$YourCashtag" />
        <F name="zelle" label="Zelle (phone or email)" value={s.zelle} placeholder="864-555-1234" />
        <F name="venmo" label="Venmo username" value={s.venmo} placeholder="@YourVenmo" />
        <div className="field"><label htmlFor="payment_note">Payment instructions</label><textarea id="payment_note" name="payment_note" className="textarea" defaultValue={s.payment_note} /></div>
      </div>

      <div className="panel form-grid">
        <h3>Contact</h3>
        <F name="contact_phone" label="Phone for texts" value={s.contact_phone} type="tel" />
        <F name="contact_email" label="Email" value={s.contact_email} type="email" />
        <F name="instagram" label="Instagram" value={s.instagram} placeholder="@yourbakery" />
      </div>

      <div className="panel form-grid">
        <h3>Pickup &amp; delivery</h3>
        <F name="pickup_place" label="Pickup place" value={s.pickup_place} />
        <F name="pickup_address" label="Pickup address" value={s.pickup_address} />
        <label className="check"><input type="checkbox" name="delivery_enabled" defaultChecked={s.delivery_enabled} /> Offer delivery ($5 within 10 miles, $10 for 10–20 miles)</label>
      </div>

      {state?.ok && <div className="success">Saved!</div>}
      {state?.error && <div className="alert">{state.error}</div>}
      <button className="btn btn-gold" disabled={pending}>{pending ? 'Saving…' : 'Save settings'}</button>
    </form>
  );
}
