'use client';
import { useActionState } from 'react';
import { sendToSubscribersAction } from '../actions';

export function SendForm({ count }: { count: number }) {
  const [state, action, pending] = useActionState(sendToSubscribersAction, null);
  return (
    <form action={action} className="form-grid" onSubmit={(e) => { if (!confirm(`Send this email to ${count} subscriber${count === 1 ? '' : 's'}?`)) e.preventDefault(); }}>
      <div className="field"><label htmlFor="subject">Subject</label><input id="subject" name="subject" className="input" placeholder="The Christmas Drop is open!" required /></div>
      <div className="field"><label htmlFor="message">Message</label><textarea id="message" name="message" className="textarea" style={{ minHeight: 180 }} placeholder="Write your message. Leave a blank line between paragraphs." required /></div>
      {state?.ok && <div className="success">Sent to {state.sent} subscriber{state.sent === 1 ? '' : 's'}.</div>}
      {state?.error && <div className="alert">{state.error}</div>}
      <button className="btn" disabled={pending || count === 0}>{pending ? 'Sending… please keep this page open' : `Send to ${count} Subscriber${count === 1 ? '' : 's'}`}</button>
    </form>
  );
}
