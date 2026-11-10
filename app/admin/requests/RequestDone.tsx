'use client';
import { useTransition } from 'react';
import { setRequestStatusAction } from '../actions';

export function RequestDone({ id, done }: { id: string; done: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="status-row">
      <button className="toggle" aria-pressed={done} disabled={pending} onClick={() => start(() => setRequestStatusAction(id, done ? 'new' : 'done'))}>Done</button>
    </div>
  );
}
