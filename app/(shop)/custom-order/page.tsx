import { CustomOrderForm } from '@/components/CustomOrderForm';
import { Sparkle } from '@/components/Sparkle';

export const metadata = { title: 'Custom orders · Tasteful Delights Bites' };

export default function CustomOrderPage() {
  return (
    <section className="section">
      <div className="wrap narrow">
        <div className="section-head">
          <p className="eyebrow"><Sparkle size={9} /> Large &amp; custom orders</p>
          <h2>Let&apos;s make it <span className="gold-text">special</span></h2>
          <p>Parties, showers, corporate gifts, or a big batch of your favorites. Share the details and I&apos;ll get back to you with a quote.</p>
        </div>
        <CustomOrderForm />
      </div>
    </section>
  );
}
