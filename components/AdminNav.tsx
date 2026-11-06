'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Home' },
  { href: '/admin/settings', label: 'Settings' },
];

export function AdminNav() {
  const path = usePathname();
  if (path === '/admin/login') return null;
  return (
    <nav className="admin-nav" aria-label="Admin">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={path === l.href ? 'page' : undefined}>{l.label}</Link>
      ))}
    </nav>
  );
}
