'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function Countdown({ to, label }: { to: string; label: string }) {
  const router = useRouter();
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= target) { window.clearInterval(t); router.refresh(); }
    }, 1000);
    return () => window.clearInterval(t);
  }, [target, router]);

  const p = parts(now === null ? 0 : target - now);
  const pad = (n: number) => String(n).padStart(2, '0');
  const units: [string, string][] = [[String(p.d), p.d === 1 ? 'Day' : 'Days'], [String(p.h), p.h === 1 ? 'Hour' : 'Hours'], [pad(p.m), 'Minutes']];
  return (
    <div role="timer" aria-label={`${label}: ${p.d} days ${p.h} hours ${p.m} minutes`}>
      <p className="countdown-label">{label}</p>
      <div className="countdown">
        {units.map(([v, l]) => (
          <div className="unit" key={l}><b suppressHydrationWarning>{now === null ? '--' : v}</b><small>{l}</small></div>
        ))}
      </div>
    </div>
  );
}
