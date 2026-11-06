'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Gently fades sections in as you scroll. Content is always visible without it. */
export function Reveal() {
  const path = usePathname();
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    document.documentElement.classList.add('js-reveal');
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal:not(.in)'));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [path]);
  return null;
}
