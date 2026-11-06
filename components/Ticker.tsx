import { Sparkle } from './Sparkle';

export function Ticker({ items }: { items: string[] }) {
  // Repeat the list so the loop is seamless on wide screens.
  const row = [...items, ...items, ...items];
  return (
    <div className="marquee" aria-label={items.join('. ')}>
      <div className="marquee-track" aria-hidden="true">
        {[0, 1].map((half) => (
          <span key={half}>
            {row.map((t, i) => (
              <span key={i}>{t}<Sparkle size={11} /></span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
