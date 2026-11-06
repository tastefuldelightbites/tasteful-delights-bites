/** A simple drawn cookie, shown until a real photo is uploaded. */
export function CookieArt() {
  const chips = [[70, 62], [118, 54], [150, 92], [92, 104], [132, 136], [64, 128], [104, 150], [160, 140], [52, 94], [110, 82]];
  return (
    <svg viewBox="0 0 220 220" role="img" aria-label="Cookie" style={{ width: '100%', height: '100%' }}>
      <defs>
        <radialGradient id="dough" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#f3d9a4" />
          <stop offset="55%" stopColor="#d9a55a" />
          <stop offset="100%" stopColor="#a8702f" />
        </radialGradient>
      </defs>
      <path d="M110 12c22 2 30 10 46 16s30 18 36 36 10 30 6 48-6 34-20 48-26 22-44 28-34 6-50 0-34-14-46-30-20-30-22-50 2-36 12-52S62 22 78 16s20-5 32-4z" fill="url(#dough)" stroke="#2B1E16" strokeWidth="4" />
      {chips.map(([x, y], i) => (
        <path key={i} d={`M${x} ${y}l9-3 7 6-3 9-9 2-6-6z`} fill="#3a2418" />
      ))}
      <ellipse cx="78" cy="52" rx="20" ry="9" fill="#fff" opacity=".35" transform="rotate(-30 78 52)" />
    </svg>
  );
}
