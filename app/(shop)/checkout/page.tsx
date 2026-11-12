import { Checkout } from '@/components/Checkout';
import { dropName, getOpenDrops } from '@/lib/menu';
import { getSettings } from '@/lib/settings';
import { fmtOpening, fmtPickupDate } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Order · Tasteful Delights Bites' };

export default async function CheckoutPage() {
  const [s, drops] = await Promise.all([getSettings(), getOpenDrops().catch(() => [])]);
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
          drops={drops.map((d) => ({
            id: d.id,
            name: dropName(d),
            pickupText: `${fmtPickupDate(d.pickup_date, true)}, ${d.pickup_hours}`,
            closesText: fmtOpening(d.closes_at),
          }))}
          pickupPlace={`${s.pickup_place}, ${s.pickup_address}`}
          deliveryEnabled={s.delivery_enabled}
          tiers={s.delivery_tiers}
          payMethods={pay.length ? pay : ['Cash App', 'Zelle', 'Apple Pay']}
        />
      </div>
    </section>
  );
}
