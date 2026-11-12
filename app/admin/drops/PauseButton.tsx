'use client';
import { useTransition } from 'react';
import { setWeekPausedAction } from '../actions';

export function PauseButton({ id, paused }: { id: string; paused: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button className={`btn btn-sm ${paused ? '' : 'btn-outline'}`} disabled={pending}
      onClick={() => {
        if (!paused && !confirm('Pause this week? Customers will not be able to order for this pickup day.')) return;
        start(() => setWeekPausedAction(id, !paused));
      }}>
      {paused ? 'Resume This Week' : 'Pause This Week'}
    </button>
  );
}
