import { randomBytes } from 'crypto';
import { requireAdmin } from '@/lib/auth';
import { getSettings, saveSettings } from '@/lib/settings';
import { getProducts } from '@/lib/menu';
import { emailConfigured } from '@/lib/email';
import { SettingsForm } from './SettingsForm';

export const maxDuration = 60;

export default async function SettingsPage() {
  await requireAdmin();
  const s = await getSettings();
  // A private, hard-to-guess alert channel name for the ntfy phone app.
  if (!s.ntfy_topic) {
    s.ntfy_topic = `tdb-orders-${randomBytes(5).toString('hex')}`;
    await saveSettings({ ntfy_topic: s.ntfy_topic });
  }
  const products = (await getProducts(true)).map((p) => ({ id: p.id, name: p.name, hasPhoto: Boolean(p.image_id) }));
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <h1>Settings &amp; Payment</h1>
      <SettingsForm s={s} products={products} emailReady={emailConfigured()} />
    </div>
  );
}
