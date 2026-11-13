import { Checkout } from '@/components/Checkout';
import { belongsTo, dropName, menuKey } from '@/lib/menu';
import { fmtYmdShort, holidayInfo } from '@/lib/holiday';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { getShopData } from '@/lib/shop';
import { fmtOpening, hoursInWords } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Order · Tasteful Delights Bites' };

export default async function CheckoutPage() {
  const shop = await getShopData();
  const s = shop.state === 'ready' ? shop.settings : DEFAULT_SETTINGS;
  const drops = shop.state === 'ready' ? shop.openDrops : [];
  const products = shop.state === 'ready' ? shop.products : [];
  const titles = shop.state === 'ready' ? shop.holidayTitles : [];
  const pay = [s.cashapp && 'Cash App', s.zelle && 'Zelle', s.applepay && 'Apple Pay'].filter(Boolean) as string[];
  return (
    <section className="section">
      <div className="wrap">
        <div className="section-head center" style={{ maxWidth: 760, margin: '0 auto 34px' }}>
          <span className="label">Almost done</span>
          <h2>My <em>order</em></h2>
          <p style={{ margin: '14px auto 0' }}>Three quick steps and you&apos;re all set.</p>
        </div>
        <Checkout
          drops={drops.map((d) => {
            const info = holidayInfo(d, s);
            return {
              id: d.id,
              kind: d.kind,
              name: dropName(d),
              pickupText: `${fmtYmdShort(d.pickup_date)} from ${hoursInWords(d.pickup_hours)}`,
              dayText: fmtYmdShort(d.pickup_date),
              closesText: fmtOpening(d.closes_at),
              itemIds: d.kind === 'holiday' ? products.filter((p) => belongsTo(d, p, titles) && p.kind === 'item').map((p) => p.id) : [],
              notesHint: d.kind === 'holiday' ? info.notes : '',
            };
          })}
          holidayItemIds={products.filter((p) => p.kind === 'item' && menuKey(p.section) !== '' && titles.some((t) => menuKey(t) === menuKey(p.section))).map((p) => p.id)}
          pickupPlace={`${s.pickup_place}, ${s.pickup_address}`}
          deliveryEnabled={s.delivery_enabled}
          tiers={s.delivery_tiers}
          payMethods={pay.length ? pay : ['Cash App', 'Zelle', 'Apple Pay']}
        />
      </div>
    </section>
  );
}
