'use client';
import { useTransition } from 'react';
import { moveProductAction, toggleHiddenAction } from '../actions';

export function MenuRowButtons({ id, hidden, first, last }: { id: string; hidden: boolean; first: boolean; last: boolean }) {
  const [pending, start] = useTransition();
  return (
    <>
      <button className="btn btn-sm btn-outline" disabled={pending} onClick={() => start(() => toggleHiddenAction(id, !hidden))}>{hidden ? 'Show' : 'Hide'}</button>
      <button className="btn btn-sm btn-outline" disabled={pending || first} aria-label="Move up" onClick={() => start(() => moveProductAction(id, -1))}>↑</button>
      <button className="btn btn-sm btn-outline" disabled={pending || last} aria-label="Move down" onClick={() => start(() => moveProductAction(id, 1))}>↓</button>
    </>
  );
}
