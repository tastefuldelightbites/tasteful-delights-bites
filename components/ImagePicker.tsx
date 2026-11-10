'use client';
import { useRef, useState } from 'react';
import { uploadImageAction } from '@/app/admin/actions';
import { resizeImage } from '@/lib/resize';

/** A photo chooser that uploads right away and puts the photo id in a hidden form field. */
export function ImagePicker({ name, initialId, label = 'Photo', logo = false }: { name: string; initialId: string | null; label?: string; logo?: boolean }) {
  const [id, setId] = useState<string | null>(initialId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setError('');
    try {
      const small = await resizeImage(f, logo ? 900 : 1600, logo);
      const fd = new FormData();
      fd.append('file', small);
      const r = await uploadImageAction(fd);
      if (r.ok) setId(r.id);
      else setError(r.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="field">
      <span className="label">{label}</span>
      <input type="hidden" name={name} value={id ?? 'none'} />
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ width: logo ? 160 : 120, aspectRatio: logo ? '16 / 9' : '4 / 5', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)', background: '#1b1917', display: 'grid', placeItems: 'center' }}>
          {id ? <img src={`/api/img/${id}`} alt="" style={{ width: '100%', height: '100%', objectFit: logo ? 'contain' : 'cover' }} /> : <span className="small faint">No photo</span>}
        </div>
        <div className="stack">
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? 'Uploading…' : id ? 'Change photo' : 'Choose photo'}
          </button>
          {id && <button type="button" className="btn btn-sm btn-outline" onClick={() => setId(null)}>Remove photo</button>}
        </div>
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={onPick} />
      {error && <div className="alert">{error}</div>}
    </div>
  );
}
