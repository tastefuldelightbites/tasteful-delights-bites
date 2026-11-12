'use client';
import { usePathname } from 'next/navigation';

/**
 * Hides its contents on checkout and the order confirmation page. The top bar
 * lists the weekly pickup day, and those pages show the pickup day for what is
 * in the customer's order instead (for example Thanksgiving, never Saturday).
 */
export function HideOnOrderPages({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? '';
  if (path.startsWith('/checkout') || path.startsWith('/order/')) return null;
  return <>{children}</>;
}
