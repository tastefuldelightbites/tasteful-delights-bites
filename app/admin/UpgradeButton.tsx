'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { upgradeDatabaseAction } from './actions';

/** Shown on the dashboard only when the database still needs this version's update. */
export function UpgradeButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await Promise.race([
        upgradeDatabaseAction(),
        new Promise<{ ok: boolean; message: string }>((res) => setTimeout(() => res({ ok: false, message: 'No answer after 60 seconds. Please tap the button again.' }), 60000)),
      ]);
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'The website did not answer. Please tap the button again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel stack" style={{ marginTop: 24 }}>
      <h3>One quick database update</h3>
      <p className="muted">This adds your holiday menus (Thanksgiving and Christmas Boxes) and finishes the new menu categories. It takes a few seconds and doesn&apos;t change your orders.</p>
      <button className="btn" disabled={busy} onClick={run}>{busy ? 'Updating… please wait' : 'Finish Database Update'}</button>
      {msg && <div className={msg.ok ? 'success' : 'alert'}>{msg.text}</div>}
    </div>
  );
}
