'use client';
import { useEffect, useState } from 'react';

/**
 * If anything on a customer page fails, customers see this friendly page
 * (never "Application error"). It tries again by itself a few times.
 */
export default function ShopError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [tries, setTries] = useState(0);
  useEffect(() => {
    console.error('Page error', error?.digest ?? '', error);
    if (tries >= 3) return;
    const t = window.setTimeout(() => { setTries((n) => n + 1); reset(); }, 3000);
    return () => window.clearTimeout(t);
  }, [tries, reset, error]);
  return (
    <div className="wrap narrow center" style={{ padding: '100px 22px' }}>
      <span className="label">One moment</span>
      <h1 style={{ marginTop: 20 }}>Lots of <em>love</em> right now.</h1>
      <p className="muted" style={{ marginTop: 20, fontSize: '1.15rem' }}>This page is loading. It will try again by itself in a few seconds.</p>
      <p style={{ marginTop: 30 }}><button className="btn" onClick={() => window.location.reload()}>Try Again</button></p>
    </div>
  );
}
