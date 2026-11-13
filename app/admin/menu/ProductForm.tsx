'use client';
import { useActionState, useState, useTransition } from 'react';
import type { BoxPicks } from '@/lib/picks';
import { ImagePicker } from '@/components/ImagePicker';
import { deleteProductAction, saveProductAction } from '../actions';

type P = { id?: string; kind: 'cookie' | 'item'; name: string; description: string; section: string; options: { label: string; cents: number }[]; tags: string[]; hidden: boolean; image_id: string | null; picks: BoxPicks | null };
type Flavor = { id: string; name: string };

/** Checkboxes for which flavors customers can pick. All ticked = every flavor, including ones you add later. */
function FlavorChecks({ prefix, list, chosen, label }: { prefix: string; list: Flavor[]; chosen: string[]; label: string }) {
  const all = chosen.length === 0;
  return (
    <div className="field">
      <span className="flabel">{label}</span>
      <span className="hint">Untick any flavor you don&apos;t want in this box. If every flavor is ticked, new flavors you add later are included too.</span>
      {list.length === 0 && <span className="muted">No flavors on your menu yet.</span>}
      {list.map((f) => (
        <label key={f.id} className="check"><input type="checkbox" name={`${prefix}_${f.id}`} defaultChecked={all || chosen.includes(f.id)} /> {f.name}</label>
      ))}
    </div>
  );
}

export function ProductForm({ p, cookieFlavors = [], cakeFlavors = [] }: { p: P; cookieFlavors?: Flavor[]; cakeFlavors?: Flavor[] }) {
  const [isBox, setIsBox] = useState(Boolean(p.picks));
  const picks = p.picks ?? { cookies: 12, cookie_ids: [], cakes: 0, cake_ids: [], cake_size: '' };
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
            : 'Cookies and Honey Bun Cakes are the weekly menu. Thanksgiving or Christmas Boxes puts the item in that holiday section, with its own order deadline and pickup date.'}</span>
          <input id="section" name="section" className="input" list="category-list" defaultValue={p.section || (p.kind === 'cookie' ? 'Cookies' : 'Honey Bun Cakes')} />
          <datalist id="category-list">
            <option value="Cookies" /><option value="Honey Bun Cakes" /><option value="Thanksgiving" /><option value="Christmas Boxes" />
          </datalist>
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
        {p.kind === 'item' && (
          <div className="field pick-admin">
            <span className="flabel">Pick your flavors</span>
            <label className="check"><input type="checkbox" name="is_box" checked={isBox} onChange={(e) => setIsBox(e.target.checked)} /> This is a box where customers pick cookie or cake flavors</label>
            {isBox && (
              <div className="stack" style={{ marginTop: 10 }}>
                <div className="field">
                  <label htmlFor="picks_cookies">How many cookies are in this box?</label>
                  <span className="hint">For example 12 for one dozen. Put 0 if this box has no cookies.</span>
                  <input id="picks_cookies" name="picks_cookies" className="input" style={{ maxWidth: 160 }} inputMode="numeric" defaultValue={String(picks.cookies)} />
                </div>
                <FlavorChecks prefix="pick_cookie" list={cookieFlavors} chosen={picks.cookie_ids} label="Cookie flavors they can pick" />
                <div className="field">
                  <label htmlFor="picks_cakes">How many honey bun cakes are in this box?</label>
                  <span className="hint">Put 0 if this box has no cake.</span>
                  <input id="picks_cakes" name="picks_cakes" className="input" style={{ maxWidth: 160 }} inputMode="numeric" defaultValue={String(picks.cakes)} />
                </div>
                <div className="field">
                  <label htmlFor="picks_cake_size">Cake size</label>
                  <span className="hint">For example Small or Large. Shown on the order and the Bake List.</span>
                  <input id="picks_cake_size" name="picks_cake_size" className="input" style={{ maxWidth: 220 }} defaultValue={picks.cake_size} />
                </div>
                <FlavorChecks prefix="pick_cake" list={cakeFlavors} chosen={picks.cake_ids} label="Cake flavors they can pick" />
              </div>
            )}
          </div>
        )}
        {p.kind === 'cookie' && <p className="muted">Cookie prices come from the cookie box sizes on the Menu &amp; Photos page.</p>}
        <div className="field">
          <span className="flabel">Labels</span>
          <label className="check"><input type="checkbox" name="weekly_on" defaultChecked={!p.tags.includes('not-weekly')} /> Show on the weekly menu (Cookies, Honey Bun Cakes, Fresh This Week). Holiday menus are not affected.</label>
          <label className="check"><input type="checkbox" name="tag_new" defaultChecked={p.tags.includes('new')} /> Show a &quot;New Item&quot; badge</label>
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
