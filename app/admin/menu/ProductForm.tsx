'use client';
import { useActionState, useTransition } from 'react';
import { ImagePicker } from '@/components/ImagePicker';
import { deleteProductAction, saveProductAction } from '../actions';

type P = { id?: string; kind: 'cookie' | 'item'; name: string; description: string; section: string; options: { label: string; cents: number }[]; tags: string[]; hidden: boolean; image_id: string | null };

export function ProductForm({ p }: { p: P }) {
  const [state, action, pending] = useActionState(saveProductAction, null);
  const [delPending, startDel] = useTransition();
  const opts = [...p.options, { label: '', cents: 0 }, { label: '', cents: 0 }, { label: '', cents: 0 }, { label: '', cents: 0 }].slice(0, 4);
  return (
    <form action={action} className="stack">
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <input type="hidden" name="kind" value={p.kind} />
      <div className="panel form-grid">
        <ImagePicker name="image_id" initialId={p.image_id} label="Photo" />
        <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" className="input" defaultValue={p.name} required /></div>
        <div className="field"><label htmlFor="description">Short description</label><textarea id="description" name="description" className="textarea" defaultValue={p.description} /></div>
        <div className="field">
          <label htmlFor="section">Category</label>
          <span className="hint">{p.kind === 'cookie'
            ? 'For example "Cookies" or "Fall Flavors". Shown above the cookie name.'
            : 'Items with the same category are shown together on your menu, for example "Honey Bun Cakes".'}</span>
          <input id="section" name="section" className="input" defaultValue={p.section || (p.kind === 'cookie' ? 'Cookies' : 'Honey Bun Cakes')} />
        </div>
        {p.kind === 'item' && (
          <>
            <div className="field">
              <span className="flabel">Sizes and prices</span>
              <span className="hint">Fill in one line per size. Leave extra lines empty.</span>
              {opts.map((o, i) => (
                <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
                  <input name={`opt_label_${i}`} className="input" placeholder={i === 0 ? 'Small' : i === 1 ? 'Large' : 'Size name'} defaultValue={o.label} aria-label={`Size ${i + 1} name`} />
                  <input name={`opt_price_${i}`} className="input" style={{ maxWidth: 150 }} inputMode="decimal" placeholder="Price $" defaultValue={o.cents ? (o.cents / 100).toString() : ''} aria-label={`Size ${i + 1} price in dollars`} />
                </div>
              ))}
            </div>
          </>
        )}
        {p.kind === 'cookie' && <p className="muted">Cookie prices come from the box sizes (Single $5, Box of 4 $18, Dozen $42).</p>}
        <div className="field">
          <span className="flabel">Labels</span>
          <label className="check"><input type="checkbox" name="tag_new" defaultChecked={p.tags.includes('new')} /> Show &quot;New&quot;</label>
          <label className="check"><input type="checkbox" name="tag_fan-fave" defaultChecked={p.tags.includes('fan-fave')} /> Show &quot;Customer favorite&quot;</label>
          <label className="check"><input type="checkbox" name="hidden" defaultChecked={p.hidden} /> Hide from the website</label>
        </div>
      </div>
      {state?.ok && <div className="success">Saved! Your website is updated.</div>}
      {state?.error && <div className="alert">{state.error}</div>}
      <button className="btn btn-block" disabled={pending}>{pending ? 'Saving…' : p.id ? 'Save Changes' : 'Add to My Menu'}</button>
      {p.id && (
        <div style={{ marginTop: 26 }}>
          <button type="button" className="btn-link" disabled={delPending} onClick={() => {
            if (!confirm(`Remove ${p.name} from your menu for good? Old orders keep their details. (Tip: use Hide if you might bring it back.)`)) return;
            startDel(() => deleteProductAction(p.id!));
          }}>Remove this item for good</button>
        </div>
      )}
    </form>
  );
}
