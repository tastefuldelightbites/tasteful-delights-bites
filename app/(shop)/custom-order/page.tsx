import { CustomOrderForm } from '@/components/CustomOrderForm';

export const metadata = { title: 'Custom orders · Tasteful Delights Bites' };

export default function CustomOrderPage() {
  return (
    <section className="section">
      <div className="wrap narrow">
        <div className="section-head">
          <span className="label">Large &amp; custom orders</span>
          <h2>Let&apos;s make it <em>special</em></h2>
          <p>Parties, showers, corporate gifts, or a big batch of your favorites. Share the details and I&apos;ll get back to you with a quote.</p>
        </div>
        <CustomOrderForm />
      </div>
    </section>
  );
}
