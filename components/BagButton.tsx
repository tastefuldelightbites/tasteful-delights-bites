'use client';
import Link from 'next/link';
import { useCart } from './CartProvider';

export function BagButton() {
  const { count } = useCart();
  return (
    <Link href="/checkout" className="btn btn-sm bag-btn" aria-label={`Your bag, ${count} items`}>
      Bag {count > 0 && <span className="bag-count">{count}</span>}
    </Link>
  );
}

export function StickyBag() {
  const { count, subtotal } = useCart();
  if (count === 0) return null;
  return (
    <div className="sticky-bag">
      <Link href="/checkout" className="btn btn-gold btn-block">
        View bag · {count} {count === 1 ? 'item' : 'items'} · ${(subtotal / 100).toFixed(subtotal % 100 ? 2 : 0)}
      </Link>
    </div>
  );
}
