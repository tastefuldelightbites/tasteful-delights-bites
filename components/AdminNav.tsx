'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Home' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/order-dates', label: 'Order Dates' },
  { href: '/admin/menu', label: 'Menu & Photos' },
  { href: '/admin/requests', label: 'Custom Requests' },
  { href: '/admin/subscribers', label: 'Subscribers' },
  { href: '/admin/settings', label: 'Settings & Payment' },
];

export function AdminNav() {
  const path = usePathname();
  if (path === '/admin/login') return null;
  return (
    <nav className="admin-nav" aria-label="Admin">
      {LINKS.map((l) => {
        const on = l.href === '/admin' ? path === '/admin' : path.startsWith(l.href);
        return <Link key={l.href} href={l.href} aria-current={on ? 'page' : undefined}>{l.label}</Link>;
      })}
    </nav>
  );
}
