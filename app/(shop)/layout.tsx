import Link from 'next/link';
import { BagButton } from '@/components/BagButton';
import { Sparkle } from '@/components/Sparkle';
import { getSettings } from '@/lib/settings';
import { imageUrl } from '@/lib/menu';

export const dynamic = 'force-dynamic';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  const logo = imageUrl(s.logo_image_id);
  return (
    <>
      <header className="site-header">
        <div className="wrap">
          <Link href="/" className="brand" aria-label={s.business_name}>
            {logo ? <img src={logo} alt={s.business_name} /> : <Sparkle size={16} />}
            {!logo && <span className="brand-name">{s.business_name}</span>}
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
          <div className="divider"><Sparkle size={10} /></div>
          <p className="serif">{s.business_name}</p>
          <p>Home-baked in Mauldin, South Carolina</p>
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
