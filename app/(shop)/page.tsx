import Link from 'next/link';
import { Sparkle } from '@/components/Sparkle';
import { Menu } from '@/components/Menu';
import { StickyBag } from '@/components/BagButton';
import { getMenu, getNextDrop, getOpenDrop, imageUrl, type Drop } from '@/lib/menu';
import { getSettings } from '@/lib/settings';
import { fmtDateTime, fmtPickupDate } from '@/lib/time';
import { money } from '@/lib/money';
import { isDatabaseReady } from '@/lib/setup';
import { databaseConfigured } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (!databaseConfigured() || !(await isDatabaseReady())) return <NotReady />;

  const [settings, open, next] = await Promise.all([getSettings(), getOpenDrop(), getNextDrop()]);
  const menu = await getMenu(open);
  const logo = imageUrl(settings.logo_image_id);
  const shown: Drop | null = open ?? next;
  const tiers = [...settings.delivery_tiers].sort((a, b) => a.max_miles - b.max_miles);

  return (
    <div className="has-sticky">
      <section className="hero">
        <div className="wrap">
          {logo && <img className="logo-big" src={logo} alt={settings.business_name} />}
          <p className="eyebrow" style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
            <Sparkle size={10} /> Mauldin, South Carolina <Sparkle size={10} />
          </p>
          <h1>
            {logo ? <>Baked fresh, <span className="gold-text">just for you.</span></> : <>Tasteful Delights <span className="gold-text">Bites</span></>}
          </h1>
          <p className="lead">{settings.tagline}</p>
          <div className="status-line">
            {open ? (
              <>
                <span className="pill pill-dot">Orders open · close {fmtDateTime(open.closes_at)}</span>
                <span className="small muted">Pickup {fmtPickupDate(open.pickup_date, true)}, {open.pickup_hours}</span>
              </>
            ) : (
              <>
                <span className="pill pill-dot closed">Orders are closed</span>
                <span className="small muted">
                  {next ? <>Next drop opens {fmtDateTime(next.opens_at)}</> : <>New drops open every Wednesday</>}
                </span>
              </>
            )}
          </div>
          <div className="row">
            <a href="#menu" className="btn btn-gold">{open ? 'Order now' : 'See the menu'}</a>
            <Link href="/custom-order" className="btn">Custom orders</Link>
          </div>
        </div>
      </section>

      <div id="menu">
        <Menu products={menu} boxes={settings.cookie_boxes} open={Boolean(open)} />
      </div>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow"><Sparkle size={9} /> How it works</p>
            <h2>Pickup &amp; delivery</h2>
          </div>
          <div className="info-grid">
            <div className="info-card">
              <p className="eyebrow">01</p>
              <h3 style={{ marginTop: 10 }}>Preorder</h3>
              <p className="muted">Orders open Wednesday and close Monday at 11:59pm. Everything is baked fresh for that week.</p>
            </div>
            <div className="info-card">
              <p className="eyebrow">02</p>
              <h3 style={{ marginTop: 10 }}>Pickup Saturday</h3>
              <p className="muted">
                {shown ? <>{fmtPickupDate(shown.pickup_date, true)}, {shown.pickup_hours}</> : <>Saturdays, 10am – 4pm</>}
                {' '}at {settings.pickup_place}, {settings.pickup_address}.
              </p>
            </div>
            <div className="info-card">
              <p className="eyebrow">03</p>
              <h3 style={{ marginTop: 10 }}>Or get it delivered</h3>
              <p className="muted">
                {settings.delivery_enabled
                  ? tiers.map((t, i) => `${money(t.cents)} ${i === 0 ? `within ${t.max_miles}` : `${tiers[i - 1].max_miles}–${t.max_miles}`} miles`).join(' · ')
                  : 'Delivery is paused for now — pickup only.'}
              </p>
            </div>
            <div className="info-card">
              <p className="eyebrow">04</p>
              <h3 style={{ marginTop: 10 }}>Pay your way</h3>
              <p className="muted">No card needed online. After you order, pay with Cash App, Zelle or Venmo.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section center">
        <div className="wrap narrow stack">
          <p className="eyebrow">Celebrations &amp; events</p>
          <h2>Planning something <span className="gold-text">special?</span></h2>
          <p className="muted">Birthdays, showers, office treats and party trays. Tell me what you have in mind.</p>
          <div style={{ marginTop: 26 }}><Link href="/custom-order" className="btn btn-gold">Request a custom order</Link></div>
        </div>
      </section>
      <StickyBag />
    </div>
  );
}

function NotReady() {
  return (
    <section className="hero">
      <div className="wrap narrow stack">
        <p className="eyebrow">Almost there</p>
        <h1>Tasteful Delights <span className="gold-text">Bites</span></h1>
        <p className="lead">Our preorder menu is getting ready. Please check back soon!</p>
        <p className="small faint" style={{ marginTop: 30 }}>Owner: log in at <Link href="/admin">/admin</Link> to finish setup.</p>
      </div>
    </section>
  );
}
