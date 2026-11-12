import Link from 'next/link';
import { BagButton } from '@/components/BagButton';
import { getSettings } from '@/lib/settings';
import { scheduleText } from '@/lib/schedule';
import { dropName, getNextDrop, getOpenDrops, imageUrl } from '@/lib/menu';
import { withTimeout } from '@/lib/db';
import { fmtOpening, fmtPickupDate } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [s, openDrops, next] = await Promise.all([
    getSettings(),
    withTimeout(getOpenDrops(), 8000, 'Loading the Drop').catch(() => []),
    withTimeout(getNextDrop(), 8000, 'Loading the next Drop').catch(() => null),
  ]);
  const logo = imageUrl(s.logo_image_id) ?? '/logo.png';
  return (
    <>
      <div className="ticker" role="note">
        {openDrops.length > 0 ? (
          openDrops.map((d, i) => (
            <span key={d.id} className={i > 0 ? 'hide-sm' : undefined}>
              {d.kind === 'weekly' ? 'Orders placed now are for pickup' : `${dropName(d)}: pickup`} {fmtPickupDate(d.pickup_date, true)}
            </span>
          ))
        ) : next ? (
          <span>Ordering opens {fmtOpening(next.opens_at)}</span>
        ) : (
          <span>Ordering is closed right now</span>
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
          <p>Baked fresh in Mauldin, South Carolina.<br />{s.weekly.enabled ? `New weekly orders open every ${scheduleText(s.weekly).openDay}.` : 'Follow along for our next Drop.'}</p>
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
