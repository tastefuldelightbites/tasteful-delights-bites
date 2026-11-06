import { Checkout } from '@/components/Checkout';
import { getOpenDrop } from '@/lib/menu';
import { getSettings } from '@/lib/settings';
import { fmtDateTime, fmtPickupDate } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your bag · Tasteful Delights Bites' };

export default async function CheckoutPage() {
  const [s, drop] = await Promise.all([getSettings(), getOpenDrop().catch(() => null)]);
  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 980 }}>
        <div className="section-head">
          <p className="eyebrow">Almost yours</p>
          <h2>Your bag</h2>
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
