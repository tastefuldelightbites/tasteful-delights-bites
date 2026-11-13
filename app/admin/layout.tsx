import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin · Tasteful Delights Bites', robots: { index: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="site-header">
        <div className="wrap">
          <Link href="/admin" className="brand admin-brand"><img className="brand-logo" src="/logo.png" alt="Tasteful Delights Bites" width={56} height={56} /><span><span className="brand-name">Bakery Admin</span><span className="brand-sub admin-sub">Tasteful Delights Bites</span></span></Link>
          <nav className="nav"><Link className="btn btn-sm btn-outline" href="/" target="_blank">View Site</Link></nav>
        </div>
      </header>
      <div className="wrap"><AdminNav /></div>
      <main className="wrap admin-main">{children}</main>
    </>
  );
}
