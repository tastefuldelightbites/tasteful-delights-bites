import Link from 'next/link';
import { Countdown } from '@/components/Countdown';
import { Menu } from '@/components/Menu';
import { HowItWorks } from '@/components/HowItWorks';
import { holidayInfo, isThanksgiving, type HolidayInfo } from '@/lib/holiday';
import { StickyBag } from '@/components/BagButton';
import { dropName, imageUrl } from '@/lib/menu';
import { getShopData, getShopMenu } from '@/lib/shop';
import { belongsTo } from '@/lib/menu';
import { fmtOpening, fmtPickupDate } from '@/lib/time';
import { money } from '@/lib/money';
import { databaseConfigured } from '@/lib/db';
import { DEFAULT_HERO_PHOTO } from '@/lib/settings';

export const dynamic = 'force-dynamic';


export default async function Home() {
  if (!databaseConfigured()) return <NotReady />;

  // "Almost ready" only when the site has truly never been set up.
  // A busy moment shows the last good menu, or a short "one moment" page that reloads itself.
  const shop = await getShopData();
  if (shop.state === 'missing') return <NotReady />;
  if (shop.state === 'error') return <BusyMoment />;
  const { settings, openDrops, holidays, holidayTitles } = shop;
  // Weekly menu (Cookies, Honey Bun Cakes): the open weekly order window, or the next one.
  const open = openDrops.find((d) => d.kind === 'weekly') ?? null;
  // Next weekly order window (paused weeks are skipped).
  const nextWeekly = shop.nextWeekly ?? null;
  const next = open ? null : nextWeekly ?? shop.next;
  const weeklyMenu = (await getShopMenu(open?.id ?? null))?.filter((p) => belongsTo(open ?? { kind: 'weekly', title: '' }, p, holidayTitles));
  if (!weeklyMenu) return <BusyMoment />;
  const menu = weeklyMenu;
  // Holiday menus (Thanksgiving, Christmas Boxes…) with their own deadline and pickup date.
  const holidayMenus = (await Promise.all(holidays.map(async (h) => {
    const full = (await getShopMenu(h.id)) ?? [];
    return {
      h,
      items: full.filter((p) => belongsTo(h, p, holidayTitles)),
      // Cookie and cake flavors customers can pick inside a holiday box (with this holiday's amounts left).
      flavors: full,
      isOpen: new Date(h.opens_at).getTime() <= Date.now(),
    };
  }))).filter((x) => x.items.length > 0);
  // Thanksgiving box at the top of How It Works: only while the Thanksgiving menu is open for orders.
  const thanksgivingOpen = holidayMenus.find((x) => x.isOpen && isThanksgiving(x.h.title) && new Date(x.h.closes_at).getTime() > Date.now());
  const thanksgivingInfo = thanksgivingOpen ? holidayInfo(thanksgivingOpen.h, settings) : null;
  const tiers = [...settings.delivery_tiers].sort((a, b) => a.max_miles - b.max_miles);

  // Arch photo and caption: chosen by the owner in Admin > Menu & Photos > Homepage Photo.
  const heroSrc = settings.hero_image_id ? imageUrl(settings.hero_image_id)! : DEFAULT_HERO_PHOTO;
  const heroCaption = (settings.hero_caption ?? '').trim();

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

            {holidayMenus.map(({ h, isOpen }) => (
              <div key={h.id} className="holiday-callout">
                <strong>{dropName(h)}{isOpen ? ' is open' : ''}:</strong>{' '}
                {isOpen ? <>order by {fmtOpening(h.closes_at)}. </> : <>ordering opens {fmtOpening(h.opens_at)}. Order by {fmtOpening(h.closes_at)}. </>}
                Pickup{settings.delivery_enabled ? ' or delivery' : ''} <strong>{fmtPickupDate(h.pickup_date, true)}, {h.pickup_hours}</strong>.{' '}
                <a href={`#${holidayAnchor(h)}`}>See the {dropName(h)} menu</a>
              </div>
            ))}

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
                <img src={heroSrc} alt={heroCaption || 'Fresh from our kitchen'} fetchPriority="high" />
              </div>
            </div>
            {heroCaption && <div className="arch-caption center-caption"><span>{heroCaption}</span></div>}
          </div>
        </section>

        <HowItWorks s={settings} open={open} next={nextWeekly} holidays={holidays} thanksgiving={thanksgivingInfo} />
      </div>

      <div id="menu">
        <Menu
          products={menu}
          boxes={settings.cookie_boxes}
          open={Boolean(open)}
          drop={cartDrop}
          note={open
            ? <>Order by {fmtOpening(open.closes_at)} for pickup {fmtPickupDate(open.pickup_date, true)}, {open.pickup_hours}.</>
            : nextWeekly ? <>Ordering opens {fmtOpening(nextWeekly.opens_at)} for pickup {fmtPickupDate(nextWeekly.pickup_date, true)}.</> : undefined}
          closedNote={open ? undefined : 'Weekly ordering is closed right now. See the countdown above for when it opens next.'}
        />
        {holidayMenus.map(({ h, items, flavors, isOpen }) => (
          <Menu
            key={h.id}
            holiday
            anchorId={holidayAnchor(h)}
            cardNote={cardLines(holidayInfo(h, settings))}
            products={items}
            flavors={flavors}
            boxes={settings.cookie_boxes}
            open={isOpen}
            drop={{ id: h.id, name: dropName(h), pickup: `pickup ${fmtPickupDate(h.pickup_date, true)}` }}
            note={isOpen
              ? <>Order by {fmtOpening(h.closes_at)}. Pickup{settings.delivery_enabled ? ' or delivery' : ''} {fmtPickupDate(h.pickup_date, true)}, {h.pickup_hours}. This is a separate order from the weekly menu.</>
              : <>Ordering opens {fmtOpening(h.opens_at)}. Order by {fmtOpening(h.closes_at)} for pickup{settings.delivery_enabled ? ' or delivery' : ''} {fmtPickupDate(h.pickup_date, true)}, {h.pickup_hours}.</>}
          />
        ))}
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

/** The pickup details shown on every holiday item card. */
function cardLines(i: HolidayInfo) {
  return [`${i.orderBy}.`, `${i.pickup}.`, i.notes && `${i.notes}.`, i.delivery && `${i.delivery}.`].filter(Boolean) as string[];
}

/** Link target for a holiday menu section, e.g. "holiday-thanksgiving". */
function holidayAnchor(h: { title: string; kind: string }) {
  return `holiday-${dropName(h).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
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
      <p className="muted" style={{ marginTop: 20 }}>Our first menu is getting ready. Please check back soon!</p>
      <p className="faint small" style={{ marginTop: 30 }}>Owner: log in at <Link href="/admin">/admin</Link> to finish setup.</p>
    </div>
  );
}
