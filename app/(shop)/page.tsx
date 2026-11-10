import Link from 'next/link';
import { Countdown } from '@/components/Countdown';
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
  const heroImg = imageUrl(settings.hero_image_id ?? menu.find((p) => p.image_id)?.image_id);
  const cake = menu.find((p) => p.kind === 'item');
  const cakeFrom = cake?.options.length ? Math.min(...cake.options.map((o) => o.cents)) : null;
  const deliveryText = settings.delivery_enabled
    ? tiers.map((t, i) => `${money(t.cents)} ${i === 0 ? `within ${t.max_miles}` : `for ${tiers[i - 1].max_miles} to ${t.max_miles}`} miles`).join(', ')
    : '';

  return (
    <div className="has-sticky">
      <div className="wrap">
        <section className="hero">
          <div>
            <span className="label">{open ? `${dropNo(open)} · Open now` : next ? `${dropNo(next)} · Opens soon` : 'Ordering is closed'}</span>
            <h1>Small batch,<br /><em>honey sweet.</em></h1>
            <p className="lead">{settings.tagline} Order by Monday night for Saturday pickup or delivery.</p>

            <div className="countdown-block">
              {open ? (
                <Countdown to={new Date(open.closes_at).toISOString()} label="Ordering closes in:" />
              ) : next ? (
                <Countdown to={new Date(next.opens_at).toISOString()} label={`${dropNo(next)} opens in:`} />
              ) : (
                <p className="countdown-label">A new Drop opens every Wednesday. Please check back soon.</p>
              )}
            </div>

            <div className="btns">
              <a href="#menu" className="btn">{open ? 'Start My Order' : 'See the Menu'}</a>
              <a href="#how" className="btn btn-outline">How It Works</a>
            </div>
            {shown && (
              <p className="pickup">
                Pickup: {fmtPickupDate(shown.pickup_date, true)}, {shown.pickup_hours}<br />
                {settings.pickup_place}, {settings.pickup_address}
              </p>
            )}
          </div>

          <div>
            <div className="arch-wrap">
              <div className="arch">
                {heroImg ? <img src={heroImg} alt="Fresh treats from Tasteful Delights Bites" /> : <div className="no-photo"><span>Your photo here</span></div>}
              </div>
            </div>
            <div className="arch-caption"><span>Honey Bun Cake</span>{cakeFrom !== null && <span>From {money(cakeFrom)}</span>}</div>
          </div>
        </section>

        <div className="steps" id="how">
          <div className="step"><div className="n">1</div><div><h3>Pick your treats</h3><p>Choose a cookie box and your flavors, or a honey bun cake.</p></div></div>
          <div className="step"><div className="n">2</div><div><h3>Pickup or delivery</h3><p>Pick up Saturday at {settings.pickup_place} on W Butler Rd{settings.delivery_enabled ? ', or have it delivered' : ''}.</p></div></div>
          <div className="step"><div className="n">3</div><div><h3>Place your order</h3><p>Then pay with Cash App, Zelle or Apple Pay. No card needed on the website.</p></div></div>
        </div>
      </div>

      <div id="menu">
        <Menu products={menu} boxes={settings.cookie_boxes} open={Boolean(open)} />
      </div>

      {deliveryText && (
        <section className="section">
          <div className="wrap narrow center stack">
            <span className="label">Delivery</span>
            <h2>We can bring it <em>to you</em></h2>
            <p className="muted" style={{ fontSize: '1.15rem' }}>Delivery is {deliveryText} from our pickup spot. We don&apos;t deliver farther than {tiers.at(-1)?.max_miles} miles. You&apos;ll see your delivery price before you order.</p>
          </div>
        </section>
      )}

      <section className="section">
        <div className="wrap custom-cta">
          <span className="label">Celebrations</span>
          <h2 style={{ marginTop: 16 }}>Need a big or <em>custom</em> order?</h2>
          <p>Birthdays, showers, office treats and party trays. Tell me what you need and I&apos;ll get back to you.</p>
          <Link href="/custom-order" className="btn btn-outline">Request a Custom Order</Link>
        </div>
      </section>
      <StickyBag />
    </div>
  );
}

function NotReady() {
  return (
    <div className="wrap narrow center" style={{ padding: '100px 22px' }}>
      <span className="label">Coming soon</span>
      <h1 style={{ marginTop: 20 }}>Almost <em>ready.</em></h1>
      <p className="muted" style={{ marginTop: 20 }}>Our first Drop is getting ready. Please check back soon!</p>
      <p className="faint small" style={{ marginTop: 30 }}>Owner: log in at <Link href="/admin">/admin</Link> to finish setup.</p>
    </div>
  );
}
