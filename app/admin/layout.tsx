import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { Sparkle } from '@/components/Sparkle';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin · Tasteful Delights Bites', robots: { index: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="site-header">
        <div className="wrap">
          <Link href="/admin" className="brand"><Sparkle size={14} /><span className="brand-name">Bakery Admin</span></Link>
          <nav className="nav"><Link className="btn btn-sm btn-ghost" href="/" target="_blank">View site</Link></nav>
        </div>
      </header>
      <div className="wrap"><AdminNav /></div>
      <main className="wrap admin-main">{children}</main>
    </>
  );
}
