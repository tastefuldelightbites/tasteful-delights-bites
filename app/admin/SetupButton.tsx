'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setupAction } from './actions';

export function SetupButton() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="stack">
      <button className="btn btn-gold" disabled={pending} onClick={() => start(async () => {
        const r = await setupAction();
        if (r.ok) router.refresh(); else setError(r.error ?? 'Setup failed');
      })}>{pending ? 'Setting up…' : 'Set up my database'}</button>
      {error && <div className="alert">Setup didn&apos;t finish: {error}</div>}
    </div>
  );
}
