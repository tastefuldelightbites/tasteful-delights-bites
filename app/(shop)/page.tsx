import Link from 'next/link';
import { Sparkle } from '@/components/Sparkle';
import { Sticker } from '@/components/Sticker';
import { Countdown } from '@/components/Countdown';
import { CookieArt } from '@/components/CookieArt';
import { Menu } from '@/components/Menu';
import { StickyBag } from '@/components/BagButton';
import { getMenu, getNextDrop, getOpenDrop, imageUrl, type Drop } from '@/lib/menu';
import { getSettings } from '@/lib/settings';
import { fmtDateTime, fmtPickupDate } from '@/lib/time';
import { money } from '@/lib/money';
import { isDatabaseReady } from '@/lib/setup';
import { databaseConfigured } from '@/lib/db';

export const dynamic = 'force-dynamic';

const dropNo = (d: Drop) => `Drop ${String(d.number).padStart(3, '0')}`;

export default async function Home() {
  if (!databaseConfigured() || !(await isDatabaseReady())) return <NotReady />;

  const [settings, open, next] = await Promise.all([getSettings(), getOpenDrop(), getNextDrop()]);
  const menu = await getMenu(open);
  const shown: Drop | null = open ?? next;
  const tiers = [...settings.delivery_tiers].sort((a, b) => a.max_miles - b.max_miles);
  const heroImg = imageUrl(settings.hero_image_id ?? menu.find((p) => p.kind === 'cookie' && p.image_id)?.image_id);
  const lowestBox = Math.min(...settings.cookie_boxes.map((b) => b.cents));

  return (
    <div className="has-sticky">
      <section className="hero2">
        <div className="wrap hero2-grid">
          <div className="hero2-copy hero2-top">
            <div className="status">
              {open ? (
                <span className="pill pill-dot">{dropNo(open)} is live</span>
              ) : (
                <span className="pill pill-dot closed">{next ? `${dropNo(next)} opens ${fmtDateTime(next.opens_at)}` : 'Between Drops'}</span>
              )}
            </div>
            <h1 className="mega">
              <span className="line">Fresh</span>
              <span className="line chrome">Baked</span>
              <span className="line">Drops<Sparkle size={34} animate className="hero-star" /></span>
            </h1>
            <p className="lead">{settings.tagline}</p>
          </div>

          <div className="hero-photo">
            <div className="disc">
              {heroImg ? <img src={heroImg} alt="Fresh cookies from Tasteful Delights Bites" /> : <div className="art"><CookieArt /></div>}
            </div>
            <Sticker kind="new" style={{ position: 'absolute', top: '6%', left: '-1%', zIndex: 2 }}>Fresh this week</Sticker>
            <Sticker kind="limited" tilt="r" style={{ position: 'absolute', bottom: '14%', right: '-2%', zIndex: 2 }}>
              From {money(lowestBox)}
            </Sticker>
            <Sticker kind="fan-fave" style={{ position: 'absolute', bottom: '0%', left: '10%', zIndex: 2 }}>Small batch</Sticker>
            <Sparkle size={22} animate className="spark-a" />
            <Sparkle size={14} animate className="spark-b" />
          </div>

          <div className="hero2-copy hero2-bottom">
            <div className="countdown-wrap">
              {open ? (
                <Countdown to={new Date(open.closes_at).toISOString()} label={`${dropNo(open)} closes in`} />
              ) : next ? (
                <Countdown to={new Date(next.opens_at).toISOString()} label={`${dropNo(next)} opens in`} />
              ) : (
                <p className="note" style={{ display: 'inline-block' }}>A new Drop opens every Wednesday.</p>
              )}
            </div>

            <div className="cta">
              <a href="#menu" className="btn btn-gold">{open ? 'Shop the Drop' : 'See the menu'}</a>
              <Link href="/custom-order" className="btn">Custom orders</Link>
            </div>
            {shown && (
              <p className="small muted" style={{ marginTop: 16 }}>
                Pickup {fmtPickupDate(shown.pickup_date, true)} · {shown.pickup_hours} · {settings.pickup_place} Mauldin
              </p>
            )}
          </div>

        </div>
      </section>

      <div id="menu">
        <Menu products={menu} boxes={settings.cookie_boxes} open={Boolean(open)} />
      </div>

      <section className="section blush">
        <div className="wrap">
          <div className="section-head reveal">
            <p className="eyebrow"><Sparkle size={10} /> How the Drop works <Sparkle size={10} /></p>
            <h2>Order. Pay. <span className="script gold-text">Enjoy.</span></h2>
          </div>
          <div className="info-grid">
            {[
              ['01', 'Wednesday', 'A new Drop opens. Everything is baked fresh for that week only.'],
              ['02', 'Monday night', 'Orders close at 11:59pm. Once it’s gone, it’s gone.'],
              ['03', 'Saturday', `${shown ? `${fmtPickupDate(shown.pickup_date)}, ` : ''}${shown?.pickup_hours ?? '10am – 4pm'} pickup at ${settings.pickup_place}, ${settings.pickup_address}.`],
              ['04', 'Delivery', settings.delivery_enabled
                ? tiers.map((t, i) => `${money(t.cents)} ${i === 0 ? `within ${t.max_miles}` : `${tiers[i - 1].max_miles}–${t.max_miles}`} miles`).join(' · ')
                : 'Delivery is paused for now. Pickup only.'],
            ].map(([n, title, body], i) => (
              <div className="info-card reveal" key={n} style={{ transitionDelay: `${i * 70}ms` }}>
                <Sticker kind={i % 2 ? 'cream' : 'new'} tilt={i % 2 ? 'r' : 'l'}>{n}</Sticker>
                <h3>{title}</h3>
                <p className="muted">{body}</p>
              </div>
            ))}
          </div>
          <p className="center small muted reveal" style={{ marginTop: 26 }}>No card needed online. Pay with Cash App, Zelle or Apple Pay after you order.</p>
        </div>
      </section>

      <section className="section center">
        <div className="wrap narrow stack reveal">
          <div><Sticker kind="fan-fave">Parties &amp; events</Sticker></div>
          <h2>Planning something <span className="script gold-text">special?</span></h2>
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
    <section className="hero2">
      <div className="wrap narrow center stack">
        <div><Sticker kind="new">Coming soon</Sticker></div>
        <h1 className="mega" style={{ textAlign: 'center' }}><span className="line">Almost</span><span className="line chrome">Ready</span></h1>
        <p className="lead" style={{ margin: '18px auto 0' }}>Our first Drop is getting ready. Please check back soon!</p>
        <p className="small faint" style={{ marginTop: 30 }}>Owner: log in at <Link href="/admin">/admin</Link> to finish setup.</p>
      </div>
    </section>
  );
}
