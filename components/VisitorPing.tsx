'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Counts visitors anonymously (no names, no tracking cookies) for the admin dashboard.
export function VisitorPing() {
  const path = usePathname();
  useEffect(() => {
    if (path.startsWith('/admin')) return;
    let id = '';
    try {
      id = localStorage.getItem('tdb_vid') || '';
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('tdb_vid', id);
      }
    } catch {
      id = 'anon-' + Math.random().toString(36).slice(2);
    }
    const ping = () => {
      if (document.visibilityState !== 'visible') return;
      fetch('/api/ping', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }), keepalive: true }).catch(() => {});
    };
    ping();
    const t = window.setInterval(ping, 60_000);
    document.addEventListener('visibilitychange', ping);
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', ping); };
  }, [path]);
  return null;
}
