import Link from 'next/link';
import { BagButton } from '@/components/BagButton';
import { getSettings } from '@/lib/settings';
import { dropName, getOpenDrop, imageUrl } from '@/lib/menu';
import { withTimeout } from '@/lib/db';
import { fmtPickupDate } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [s, open] = await Promise.all([getSettings(), withTimeout(getOpenDrop(), 8000, 'Loading the Drop').catch(() => null)]);
  const logo = imageUrl(s.logo_image_id) ?? '/logo.png';
  return (
    <>
      <div className="ticker" role="note">
        {open ? (
          <>
            <span>{dropName(open)} is open</span>
            <span className="hide-sm">Order by Monday night</span>
            <span className="hide-sm">Pickup {fmtPickupDate(open.pickup_date)}</span>
          </>
        ) : (
          <>
            <span>Ordering is closed right now</span>
            <span>A new Drop opens every Wednesday</span>
          </>
        )}
      </div>
      <header className="site-header">
        <div className="wrap">
          <Link href="/" className="brand" aria-label={`${s.business_name} home`}>
            <img className="brand-logo" src={logo} alt={s.business_name} width={64} height={64} />
          </Link>
          <nav className="nav" aria-label="Main">
            <Link className="link" href="/#menu">Menu</Link>
            <Link className="link" href="/custom-order">Custom Orders</Link>
            <BagButton />
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <div className="wrap">
          <span className="brand-name">{s.business_name}</span>
          <p>Baked fresh in Mauldin, South Carolina.<br />A new Drop every Wednesday.</p>
          <div className="links">
            <Link href="/#menu">Menu</Link>
            <Link href="/custom-order">Custom Orders</Link>
            {s.contact_phone && <a href={`tel:${s.contact_phone}`}>Call or text {s.contact_phone}</a>}
            {s.contact_email && <a href={`mailto:${s.contact_email}`}>{s.contact_email}</a>}
            {s.instagram && <a href={`https://instagram.com/${s.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer">Instagram</a>}
          </div>
        </div>
      </footer>
    </>
  );
}
