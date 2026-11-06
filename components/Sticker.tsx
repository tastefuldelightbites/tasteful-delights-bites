'use client';
import { useState } from 'react';

type Kind = 'new' | 'limited' | 'fan-fave' | 'soldout' | 'cream';
const DEFAULT_TEXT: Record<Kind, string> = { new: 'New', limited: 'Limited', 'fan-fave': 'Fan fave', soldout: 'Sold out', cream: '' };
const CLASS: Record<Kind, string> = { new: 'sticker-new', limited: 'sticker-limited', 'fan-fave': 'sticker-fave', soldout: 'sticker-soldout', cream: 'sticker-cream' };

/** Tilted sticker label that does a little pop when tapped. */
export function Sticker({ kind, children, tilt = 'l', style }: { kind: Kind; children?: React.ReactNode; tilt?: 'l' | 'r'; style?: React.CSSProperties }) {
  const [pop, setPop] = useState(0);
  return (
    <span
      key={pop}
      className={`sticker ${CLASS[kind]} ${tilt === 'r' ? 'tilt-r' : ''} ${pop ? 'popping' : ''}`}
      style={style}
      onClick={() => setPop((n) => n + 1)}
      onMouseEnter={() => setPop((n) => n + 1)}
    >
      {kind === 'fan-fave' && <span aria-hidden="true">♥</span>}
      {children ?? DEFAULT_TEXT[kind]}
    </span>
  );
}
