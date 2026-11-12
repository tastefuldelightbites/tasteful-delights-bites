'use client';
import { useState, useTransition } from 'react';
import { markReadyAction, setOrderFlagAction } from '../actions';

export function OrderFlags({ id, paid, ready, pickedUp, canceled, delivery }: { id: string; paid: boolean; ready: boolean; pickedUp: boolean; canceled: boolean; delivery: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const flip = (flag: 'paid' | 'picked_up' | 'canceled', on: boolean) => {
    if (flag === 'canceled' && on && !confirm('Cancel this order? Its treats will be added back to the amounts left.')) return;
    if (flag === 'picked_up' && on && !confirm(`Mark as ${delivery ? 'delivered' : 'picked up'}? The customer will get a thank-you email with care instructions.`)) return;
    setMsg(null);
    start(() => setOrderFlagAction(id, flag, on));
  };
  const markReady = () => {
    if (!confirm(delivery ? 'Email the customer that their order is out for delivery?' : 'Email the customer that their order is ready for pickup?')) return;
    setMsg(null);
    start(async () => {
      const r = await markReadyAction(id);
      setMsg({ ok: r.ok, text: r.ok ? 'Ready email sent to the customer.' : r.error ?? 'The email did not send.' });
    });
  };
  return (
    <>
      <div className="status-row" aria-busy={pending}>
        <button className="toggle" aria-pressed={paid} disabled={pending} onClick={() => flip('paid', !paid)}>Paid</button>
        <button className="toggle" aria-pressed={ready} disabled={pending || canceled} onClick={markReady}>{ready ? 'Ready (email again)' : delivery ? 'Ready · Out for Delivery' : 'Ready'}</button>
        <button className="toggle" aria-pressed={pickedUp} disabled={pending} onClick={() => flip('picked_up', !pickedUp)}>{delivery ? 'Delivered' : 'Picked up'}</button>
        <button className="toggle" aria-pressed={canceled} disabled={pending} onClick={() => flip('canceled', !canceled)}>Canceled</button>
      </div>
      {msg && <div className={msg.ok ? 'success' : 'alert'} style={{ marginTop: 12 }}>{msg.text}</div>}
    </>
  );
}
