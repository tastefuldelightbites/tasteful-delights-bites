'use client';
import Link from 'next/link';
import { useCart } from './CartProvider';
import { money } from '@/lib/money';

export function BagButton() {
  const { count } = useCart();
  return (
    <Link href="/checkout" className="btn bag-btn" aria-label={`My order, ${count} items`}>
      My Order ({count})
    </Link>
  );
}

/** Big "View my order" bar at the bottom of the screen on phones once something is added. */
export function StickyBag() {
  const { count, subtotal } = useCart();
  if (count === 0) return null;
  return (
    <div className="sticky-bag">
      <Link href="/checkout" className="btn btn-block">
        View My Order · {count} {count === 1 ? 'item' : 'items'} · {money(subtotal)}
      </Link>
    </div>
  );
}
