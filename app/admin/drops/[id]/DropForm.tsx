'use client';
import { useActionState, useState, useTransition } from 'react';
import { deleteDropAction, saveDropAction } from '../../actions';

type P = { id: string; name: string; kind: string; hidden: boolean; sold: number; limit: { enabled: boolean; qty: number } };

export function DropForm({ drop, products }: { drop: { id: string; opens: string; closes: string; pickup: string; hours: string }; products: P[] }) {
  const [state, action, pending] = useActionState(saveDropAction, null);
  const [on, setOn] = useState<Record<string, boolean>>(Object.fromEntries(products.map((p) => [p.id, p.limit.enabled])));
  const [delPending, startDel] = useTransition();
  const [delError, setDelError] = useState('');

  return (
    <form action={action} className="stack">
      <input type="hidden" name="id" value={drop.id} />
      <div className="panel form-grid">
        <h3>Dates</h3>
        <p className="muted">All times are South Carolina time.</p>
        <div className="form-grid two">
          <div className="field"><label htmlFor="opens_at">Ordering opens</label><input id="opens_at" name="opens_at" type="datetime-local" className="input" defaultValue={drop.opens} required /></div>
          <div className="field"><label htmlFor="closes_at">Ordering closes</label><input id="closes_at" name="closes_at" type="datetime-local" className="input" defaultValue={drop.closes} required /></div>
          <div className="field"><label htmlFor="pickup_date">Pickup day</label><input id="pickup_date" name="pickup_date" type="date" className="input" defaultValue={drop.pickup} required /></div>
          <div className="field"><label htmlFor="pickup_hours">Pickup hours</label><input id="pickup_hours" name="pickup_hours" className="input" defaultValue={drop.hours} /></div>
        </div>
      </div>

      <div className="panel">
        <h3>How many can people order?</h3>
        <p className="muted" style={{ marginTop: 6 }}>Turn on a limit to cap an item for this Drop. Customers will see &quot;Only __ left&quot; and it shows Sold Out when it runs out. Leave it off for no limit. Cookie limits count single cookies.</p>
        <div style={{ marginTop: 10 }}>
          {products.map((p) => (
            <div key={p.id} className="list-row" style={{ flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <strong>{p.name}</strong>{p.hidden && <span className="muted"> (hidden)</span>}
                <div className="muted small">{p.sold} ordered so far</div>
              </div>
              <label className="check"><input type="checkbox" name={`limit_on_${p.id}`} checked={on[p.id]} onChange={(e) => setOn({ ...on, [p.id]: e.target.checked })} /> Limit</label>
              <input type="number" name={`limit_qty_${p.id}`} min={0} inputMode="numeric" className="input" style={{ width: 120 }} defaultValue={p.limit.qty || ''} placeholder="How many" disabled={!on[p.id]} aria-label={`Limit for ${p.name}`} />
              {!on[p.id] && <input type="hidden" name={`limit_qty_${p.id}`} value={p.limit.qty} />}
            </div>
          ))}
        </div>
      </div>

      {state?.ok && <div className="success">Saved! Your website is updated.</div>}
      {state?.error && <div className="alert">{state.error}</div>}
      <button className="btn btn-block" disabled={pending}>{pending ? 'Saving…' : 'Save This Drop'}</button>

      <div style={{ marginTop: 30 }}>
        <button type="button" className="btn-link" disabled={delPending} onClick={() => {
          if (!confirm('Delete this Drop? This cannot be undone.')) return;
          startDel(async () => { const r = await deleteDropAction(drop.id); if (r?.error) setDelError(r.error); });
        }}>Delete this Drop</button>
        {delError && <div className="alert" style={{ marginTop: 10 }}>{delError}</div>}
      </div>
    </form>
  );
}
