import { Checkout } from '@/components/Checkout';
import { getOpenDrop } from '@/lib/menu';
import { getSettings } from '@/lib/settings';
import { fmtDateTime, fmtPickupDate } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Order · Tasteful Delights Bites' };

export default async function CheckoutPage() {
  const [s, drop] = await Promise.all([getSettings(), getOpenDrop().catch(() => null)]);
  return (
    <section className="section">
      <div className="wrap">
        <div className="section-head center" style={{ maxWidth: 760, margin: '0 auto 34px' }}>
          <span className="label">Almost done</span>
          <h2>My <em>order</em></h2>
          <p style={{ margin: '14px auto 0' }}>Three quick steps and you&apos;re all set.</p>
        </div>
        <Checkout
          open={Boolean(drop)}
          pickupText={drop ? `${fmtPickupDate(drop.pickup_date, true)}, ${drop.pickup_hours}` : ''}
          closesText={drop ? fmtDateTime(drop.closes_at) : ''}
          pickupPlace={`${s.pickup_place}, ${s.pickup_address}`}
          deliveryEnabled={s.delivery_enabled}
          tiers={s.delivery_tiers}
        />
      </div>
    </section>
  );
}
