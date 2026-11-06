'use client';
import { useActionState } from 'react';
import { customRequestAction } from '@/app/actions';
import { Sparkle } from './Sparkle';

export function CustomOrderForm() {
  const [state, action, pending] = useActionState(customRequestAction, null);
  if (state?.ok) {
    return (
      <div className="panel center stack" style={{ padding: 48 }}>
        <Sparkle size={20} animate />
        <h3>Request received!</h3>
        <p className="muted">Thank you — I&apos;ll reach out soon by text or email.</p>
      </div>
    );
  }
  return (
    <form action={action} className="panel form-grid" style={{ position: 'relative' }}>
      <div className="field"><label htmlFor="c-name">Full name</label><input id="c-name" name="name" className="input" required autoComplete="name" /></div>
      <div className="form-grid two">
        <div className="field"><label htmlFor="c-phone">Phone</label><input id="c-phone" name="phone" type="tel" className="input" required autoComplete="tel" /></div>
        <div className="field"><label htmlFor="c-email">Email</label><input id="c-email" name="email" type="email" className="input" required autoComplete="email" /></div>
      </div>
      <div className="field"><label htmlFor="c-date">Date needed</label><input id="c-date" name="event_date" type="date" className="input" /></div>
      <div className="field">
        <label htmlFor="c-details">What would you like?</label>
        <textarea id="c-details" name="details" className="textarea" required placeholder="Items, flavors, how many, theme or colors, pickup or delivery…" style={{ minHeight: 150 }} />
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} aria-hidden="true" />
      {state?.error && <div className="alert" role="alert">{state.error}</div>}
      <button className="btn btn-gold btn-block" disabled={pending}>{pending ? 'Sending…' : 'Send my request'}</button>
    </form>
  );
}
