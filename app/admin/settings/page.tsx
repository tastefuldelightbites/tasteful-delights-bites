import { requireAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { SettingsForm } from './SettingsForm';

export default async function SettingsPage() {
  await requireAdmin();
  const s = await getSettings();
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <h1>Settings &amp; Payment</h1>
      <SettingsForm s={s} />
    </div>
  );
}
