import Link from 'next/link';
import { Countdown } from '@/components/Countdown';
import { Menu } from '@/components/Menu';
import { StickyBag } from '@/components/BagButton';
import { dropName, imageUrl } from '@/lib/menu';
import { scheduleText } from '@/lib/schedule';
import { getShopData, getShopMenu } from '@/lib/shop';
import { fmtOpening, fmtPickupDate } from '@/lib/time';
import { money } from '@/lib/money';
import { databaseConfigured } from '@/lib/db';

export const dynamic = 'force-dynamic';


type Props = { searchParams: Promise<{ drop?: string }> };

export default async function Home({ searchParams }: Props) {
  if (!databaseConfigured()) return <NotReady />;
  const wanted = (await searchParams).drop;

  // "Almost ready" only when the site has truly never been set up.
  // A busy moment shows the last good menu, or a short "one moment" page that reloads itself.
  const shop = await getShopData();
  if (shop.state === 'missing') return <NotReady />;
  if (shop.state === 'error') return <BusyMoment />;
  const { settings, openDrops, next, products: allProducts } = shop;
  const open = openDrops.find((d) => d.id === wanted) ?? openDrops[0] ?? null;
  const menu = await getShopMenu(open?.id ?? null);
  if (!menu) return <BusyMoment />;
  const t = scheduleText(settings.weekly);
  const tiers = [...settings.delivery_tiers].sort((a, b) => a.max_miles - b.max_miles);
  const place = `${settings.pickup_place}, ${settings.pickup_address}`;

  // Arch photo: the chosen item (default: Red Velvet Honey Bun Cake), with its own name and price.
  const heroItem =
    allProducts.find((p) => p.id === settings.hero_product_id && p.image_id) ??
    allProducts.find((p) => /red velvet honey bun/i.test(p.name) && p.image_id) ??
    allProducts.find((p) => p.kind === 'item' && p.image_id) ??
    allProducts.find((p) => /red velvet honey bun/i.test(p.name)) ?? null;
  const heroFrom = heroItem?.options.length ? Math.min(...heroItem.options.map((o) => o.cents)) : null;

  const deliveryText = settings.delivery_enabled
    ? tiers.map((x, i) => `${money(x.cents)} ${i === 0 ? `within ${x.max_miles}` : `for ${tiers[i - 1].max_miles} to ${x.max_miles}`} miles`).join(', ')
    : '';
  const cartDrop = open ? { id: open.id, name: dropName(open), pickup: `pickup ${fmtPickupDate(open.pickup_date, true)}` } : null;

  return (
    <div className="has-sticky">
      <div className="wrap">
        <section className="hero">
          <div>
            <span className="label">{open ? `${dropName(open)} · Open now` : next ? `${dropName(next)} · Opens soon` : 'Ordering is closed'}</span>
            <h1>Small batch,<br /><em>honey sweet.</em></h1>
            <p className="lead">{settings.tagline}</p>

            {open ? (
              <p className="pickup-callout">Orders placed now are for pickup <strong>{fmtPickupDate(open.pickup_date, true)}</strong>, {open.pickup_hours}, at {settings.pickup_place}.</p>
            ) : next ? (
              <p className="pickup-callout">Ordering opens <strong>{fmtOpening(next.opens_at)}</strong> for pickup {fmtPickupDate(next.pickup_date, true)}.</p>
            ) : null}

            <div className="countdown-block">
              {open ? (
                <Countdown to={new Date(open.closes_at).toISOString()} label={`Ordering closes ${fmtOpening(open.closes_at)}. Time left:`} />
              ) : next ? (
                <Countdown to={new Date(next.opens_at).toISOString()} label="Ordering opens in:" />
              ) : (
                <p className="countdown-label">Ordering is closed right now. Please check back soon.</p>
              )}
            </div>

            <div className="btns">
              <a href="#menu" className="btn">{open ? 'Start My Order' : 'See the Menu'}</a>
              <a href="#how" className="btn btn-outline">How It Works</a>
            </div>
          </div>

          <div>
            <div className="arch-wrap">
              <div className="arch">
                {heroItem?.image_id ? <img src={imageUrl(heroItem.image_id)!} alt={heroItem.name} /> : <div className="no-photo"><span>Your photo here</span></div>}
              </div>
            </div>
            {heroItem && <div className="arch-caption"><span>{heroItem.name}</span>{heroFrom !== null && <span>From {money(heroFrom)}</span>}</div>}
          </div>
        </section>

        <div className="steps" id="how">
          <div className="step"><div className="n">1</div><div><h3>Pick your treats</h3><p>{settings.weekly.enabled ? `Weekly orders are open ${t.order}.` : 'Choose a cookie box and your flavors, or a honey bun cake.'}</p></div></div>
          <div className="step"><div className="n">2</div><div><h3>Pickup or delivery</h3><p>{open
            ? <>Orders placed now are for pickup <strong>{fmtPickupDate(open.pickup_date, true)}</strong>, {open.pickup_hours}, at {place}{settings.delivery_enabled ? ', or delivered that day' : ''}.</>
            : settings.weekly.enabled ? <>Pickup is the {t.pickupDay} after ordering closes, {t.pickupHours}, at {place}.</> : <>Pickup at {place}.</>}</p></div></div>
          <div className="step"><div className="n">3</div><div><h3>Place your order</h3><p>Then pay with Cash App, Zelle or Apple Pay. No card needed on the website.</p></div></div>
        </div>
      </div>

      <div id="menu">
        {openDrops.length > 1 && (
          <div className="wrap" style={{ paddingTop: 60 }}>
            <p className="flabel">Which order would you like to place?</p>
            <div className="drop-choices">
              {openDrops.map((d) => (
                <a key={d.id} href={`/?drop=${d.id}#menu`} className="drop-choice" aria-current={d.id === open?.id ? 'true' : undefined}>
                  <strong>{dropName(d)}</strong>
                  <span>Pickup {fmtPickupDate(d.pickup_date, true)}</span>
                </a>
              ))}
            </div>
          </div>
        )}
        {open && (
          <div className="wrap" style={{ paddingTop: openDrops.length > 1 ? 18 : 60 }}>
            <div className="note ordering-from">
              You&apos;re ordering from <strong>{dropName(open)}</strong>: pickup <strong>{fmtPickupDate(open.pickup_date, true)}</strong>, {open.pickup_hours}, at {place}.
            </div>
          </div>
        )}
        <Menu products={menu} boxes={settings.cookie_boxes} open={Boolean(open)} drop={cartDrop} />
      </div>

      {deliveryText && (
        <section className="section">
          <div className="wrap narrow center stack">
            <span className="label">Delivery</span>
            <h2>We can bring it <em>to you</em></h2>
            <p className="muted" style={{ fontSize: '1.15rem' }}>Delivery is {deliveryText} from our pickup spot, on your order&apos;s pickup day. We don&apos;t deliver farther than {tiers.at(-1)?.max_miles} miles. You&apos;ll see your delivery price before you order.</p>
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

function BusyMoment() {
  return (
    <div className="wrap narrow center" style={{ padding: '100px 22px' }}>
      <meta httpEquiv="refresh" content="4" />
      <span className="label">One moment</span>
      <h1 style={{ marginTop: 20 }}>Lots of <em>love</em> right now.</h1>
      <p className="muted" style={{ marginTop: 20 }}>The menu is loading. This page will refresh by itself in a few seconds.</p>
      <p style={{ marginTop: 30 }}><a className="btn" href="/">Refresh Now</a></p>
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
