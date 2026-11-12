'use client';
import { useRef, useState, useTransition } from 'react';
import { saveHeroAction, uploadImageAction } from '../actions';
import { resizeImage } from '@/lib/resize';

/**
 * Homepage Photo: the big arch photo at the top of the homepage and the words under it.
 * Choosing a photo shows it here right away; tap Save to put it on the website.
 */
export function HeroForm({ imageId, caption, defaultSrc }: { imageId: string | null; caption: string; defaultSrc: string }) {
  const [id, setId] = useState<string | null>(imageId);
  const [text, setText] = useState(caption);
  const [uploading, setUploading] = useState(false);
  const [saving, startSave] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    setMsg(null);
    try {
      const small = await resizeImage(f, 1600, false);
      const fd = new FormData();
      fd.append('file', small);
      const r = await uploadImageAction(fd);
      if (r.ok) { setId(r.id); setMsg({ ok: true, text: 'Photo ready. Tap Save Homepage Photo to put it on your website.' }); }
      else setMsg({ ok: false, text: r.error });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Upload failed. Please try again.' });
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  };

  const save = () => startSave(async () => {
    const r = await saveHeroAction(id, text);
    setMsg(r.ok ? { ok: true, text: 'Saved! Your homepage photo is updated.' } : { ok: false, text: r.error ?? 'Could not save. Please try again.' });
  });

  return (
    <div className="panel stack" id="homepage-photo">
      <h2 style={{ fontSize: '1.8rem' }}>Homepage Photo</h2>
      <p className="muted">The big photo at the top of your homepage and the words under it. Change it anytime, for example to announce a new item.</p>
      <div className="hero-edit">
        <div>
          <div className="arch hero-edit-arch">
            <img src={id ? `/api/img/${id}` : defaultSrc} alt="" />
          </div>
          {text.trim() && <div className="arch-caption center-caption" style={{ marginTop: 14 }}><span>{text}</span></div>}
        </div>
        <div className="stack">
          <button type="button" className="btn" disabled={uploading || saving} onClick={() => input.current?.click()}>
            {uploading ? 'Uploading…' : 'Choose Photo'}
          </button>
          {id && (
            <button type="button" className="btn btn-outline" disabled={uploading || saving} onClick={() => { setId(null); setMsg(null); }}>
              Use the Gourmet Cookies Photo
            </button>
          )}
          <div className="field">
            <label htmlFor="hero_caption">Caption under the photo</label>
            <span className="hint">For example: Gourmet Cookies, or New: Sweet Potato Pie Cookie. Leave empty for no caption.</span>
            <input id="hero_caption" className="input" maxLength={60} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <button type="button" className="btn btn-block" disabled={uploading || saving} onClick={save}>{saving ? 'Saving…' : 'Save Homepage Photo'}</button>
          {msg && <div className={msg.ok ? 'success' : 'alert'}>{msg.text}</div>}
        </div>
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={onPick} />
    </div>
  );
}
