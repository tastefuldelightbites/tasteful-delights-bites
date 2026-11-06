export function Sparkle({ size = 12, animate = false, className = '' }: { size?: number; animate?: boolean; className?: string }) {
  return (
    <svg
      className={`sparkle ${animate ? 'sparkle-anim' : ''} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path fill="currentColor" d="M12 0c.6 5.9 2.8 9.6 12 12-9.2 2.4-11.4 6.1-12 12-.6-5.9-2.8-9.6-12-12C9.2 9.6 11.4 5.9 12 0z" />
    </svg>
  );
}
