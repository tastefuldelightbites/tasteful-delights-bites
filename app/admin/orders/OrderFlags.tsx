'use client';
import { useTransition } from 'react';
import { setOrderFlagAction } from '../actions';

export function OrderFlags({ id, paid, pickedUp, canceled, delivery }: { id: string; paid: boolean; pickedUp: boolean; canceled: boolean; delivery: boolean }) {
  const [pending, start] = useTransition();
  const flip = (flag: 'paid' | 'picked_up' | 'canceled', on: boolean) => {
    if (flag === 'canceled' && on && !confirm('Cancel this order? Its treats will be added back to the amounts left.')) return;
    start(() => setOrderFlagAction(id, flag, on));
  };
  return (
    <div className="status-row" aria-busy={pending}>
      <button className="toggle" aria-pressed={paid} disabled={pending} onClick={() => flip('paid', !paid)}>Paid</button>
      <button className="toggle" aria-pressed={pickedUp} disabled={pending} onClick={() => flip('picked_up', !pickedUp)}>{delivery ? 'Delivered' : 'Picked up'}</button>
      <button className="toggle" aria-pressed={canceled} disabled={pending} onClick={() => flip('canceled', !canceled)}>Canceled</button>
    </div>
  );
}
