'use client';
import { useActionState } from 'react';
import type { CookieBox } from '@/lib/settings';
import { saveCookieBoxesAction } from '../actions';

/**
 * Cookie box sizes: name, how many cookies each box holds, price, and which
 * flavors customers can pick for it. An empty row adds a new size; clearing a
 * name removes that size.
 */
export function CookieBoxesForm({ boxes, cookies }: { boxes: CookieBox[]; cookies: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(saveCookieBoxesAction, null);
  const rows = [...boxes, { label: '', count: 0, cents: 0, flavor_ids: [] as string[] }];
  return (
    <form action={action} className="panel stack" id="cookie-boxes">
      <h2 style={{ fontSize: '1.8rem' }}>Cookie Box Sizes</h2>
      <p className="muted">Customers choose a size, then pick their flavors with + and − buttons until the box is full. To remove a size, clear its name. Use the empty box at the bottom to add a new size.</p>
      {rows.map((b, i) => {
        const all = !b.flavor_ids || b.flavor_ids.length === 0;
        return (
          <fieldset key={i} className="box-admin">
            <legend>{b.label ? b.label : 'Add a new size'}</legend>
            <div className="box-admin-grid">
              <div className="field"><label htmlFor={`box_label_${i}`}>Name</label><input id={`box_label_${i}`} name={`box_label_${i}`} className="input" defaultValue={b.label} placeholder="Dozen" /></div>
              <div className="field"><label htmlFor={`box_count_${i}`}>Cookies in the box</label><input id={`box_count_${i}`} name={`box_count_${i}`} className="input" inputMode="numeric" defaultValue={b.count ? String(b.count) : ''} placeholder="12" /></div>
              <div className="field"><label htmlFor={`box_price_${i}`}>Price $</label><input id={`box_price_${i}`} name={`box_price_${i}`} className="input" inputMode="decimal" defaultValue={b.cents ? (b.cents / 100).toString() : ''} placeholder="42" /></div>
            </div>
            <details style={{ marginTop: 10 }}>
              <summary className="btn-link" style={{ cursor: 'pointer', fontSize: '1.05rem' }}>Flavors for this size {all ? '(all flavors)' : `(${b.flavor_ids!.length} chosen)`}</summary>
              <div className="stack" style={{ marginTop: 10 }}>
                <span className="hint">Untick a flavor to leave it out of this size. If every flavor is ticked, new flavors you add later are included too.</span>
                {cookies.map((c) => (
                  <label key={c.id} className="check"><input type="checkbox" name={`box_flavor_${i}_${c.id}`} defaultChecked={all || b.flavor_ids!.includes(c.id)} /> {c.name}</label>
                ))}
              </div>
            </details>
          </fieldset>
        );
      })}
      <input type="hidden" name="rows" value={rows.length} />
      {state?.ok && <div className="success">Saved! Your box sizes are updated on the website.</div>}
      {state?.error && <div className="alert">{state.error}</div>}
      <button className="btn btn-block" disabled={pending}>{pending ? 'Saving…' : 'Save Box Sizes'}</button>
    </form>
  );
}
