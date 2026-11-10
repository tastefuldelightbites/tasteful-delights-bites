'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { setupInfoAction, setupStepAction } from './actions';

type Result = { ok: boolean; total: number; error?: string; where?: string };

/** Calls a server action but gives up after `ms` instead of waiting forever. */
function withLimit(p: Promise<Result>, ms: number): Promise<Result> {
  return Promise.race([
    p,
    new Promise<Result>((resolve) => setTimeout(() => resolve({ ok: false, total: 0, error: `No answer from the website after ${ms / 1000} seconds.` }), ms)),
  ]);
}

/**
 * One-time database setup, done in many small steps so no single request is slow.
 * Each step is safe to repeat, so tapping again simply finishes the job.
 */
export function SetupButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ step: number; total: number } | null>(null);
  const [error, setError] = useState<{ msg: string; where?: string } | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const { total } = await setupInfoAction();
      for (let i = 0; i < total; i++) {
        setProgress({ step: i + 1, total });
        let r: Result = { ok: false, total };
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            r = await withLimit(setupStepAction(i), 30000);
          } catch (e) {
            r = { ok: false, total, error: e instanceof Error ? e.message : 'The website did not answer.' };
          }
          if (r.ok) break;
          await new Promise((res) => setTimeout(res, 1500));
        }
        if (!r.ok) {
          setError({ msg: `Step ${i + 1} of ${total}: ${r.error ?? 'did not finish.'}`, where: r.where });
          return;
        }
      }
      router.refresh();
    } catch (e) {
      setError({ msg: e instanceof Error ? e.message : 'The website could not start the setup.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <button className="btn" disabled={busy} onClick={run}>
        {busy ? (progress ? `Setting up… step ${progress.step} of ${progress.total}` : 'Starting…') : error ? 'Try Again' : 'Set Up My Database'}
      </button>
      {error && (
        <div className="alert">
          Setup didn&apos;t finish. {error.msg}
          {error.where && <><br /><span style={{ fontWeight: 500 }}>Database: {error.where}</span></>}
          <br /><span style={{ fontWeight: 500 }}>Tap Try Again. If it stops at the same step, send me a screenshot of this message.</span>
        </div>
      )}
    </div>
  );
}
