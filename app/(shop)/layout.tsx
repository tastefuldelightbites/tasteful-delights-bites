import Link from 'next/link';
import { BagButton } from '@/components/BagButton';
import { Sparkle } from '@/components/Sparkle';
import { Ticker } from '@/components/Ticker';
import { getSettings } from '@/lib/settings';
import { getOpenDrop, imageUrl } from '@/lib/menu';

export const dynamic = 'force-dynamic';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [s, open] = await Promise.all([getSettings(), getOpenDrop().catch(() => null)]);
  const logo = imageUrl(s.logo_image_id);
  const ticker = open
    ? ["This week's Drop is live", 'Order by Monday night', 'Saturday pickup in Mauldin', 'Cookies by the box', 'Honey bun cakes', 'Local delivery up to 20 miles']
    : ['New Drop every Wednesday', 'Order by Monday night', 'Saturday pickup in Mauldin', 'Cookies by the box', 'Honey bun cakes'];
  return (
    <>
      <Ticker items={ticker} />
      <header className="site-header">
        <div className="wrap">
          <Link href="/" className="brand" aria-label={s.business_name}>
            {logo ? <img src={logo} alt={s.business_name} /> : <><Sparkle size={16} /><span className="brand-name">{s.business_name}</span></>}
          </Link>
          <nav className="nav">
            <Link className="link hide-sm" href="/#menu">Menu</Link>
            <Link className="link" href="/custom-order">Custom</Link>
            <BagButton />
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <div className="wrap stack">
          <div className="divider"><Sparkle size={12} /></div>
          <p className="serif">{s.business_name}</p>
          <p>Baked fresh in Mauldin, South Carolina · A new Drop every week</p>
          <p className="row" style={{ justifyContent: 'center', gap: 18 }}>
            {s.contact_phone && <a href={`tel:${s.contact_phone}`}>{s.contact_phone}</a>}
            {s.contact_email && <a href={`mailto:${s.contact_email}`}>{s.contact_email}</a>}
            {s.instagram && <a href={`https://instagram.com/${s.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer">@{s.instagram.replace(/^@/, '')}</a>}
          </p>
        </div>
      </footer>
    </>
  );
}
