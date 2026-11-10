import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { fullSetupSql } from '@/lib/setup';
import { CopyBox } from './CopyBox';

export default async function SetupCode() {
  await requireAdmin();
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <p><Link href="/admin" style={{ fontWeight: 700 }}>← Back</Link></p>
      <h1>Backup setup</h1>
      <p style={{ fontSize: '1.15rem' }}>Use this only if the Set Up My Database button keeps failing. It does the same setup directly inside Supabase.</p>
      <ol style={{ fontSize: '1.1rem', paddingLeft: 24, lineHeight: 1.8 }}>
        <li>Tap <strong>Copy Setup Code</strong> below.</li>
        <li>Open your project at supabase.com and tap <strong>SQL Editor</strong> in the left menu.</li>
        <li>Tap in the big empty box, then paste.</li>
        <li>Tap <strong>Run</strong>. Wait for &quot;Success&quot;.</li>
        <li>Come back here and open your <Link href="/admin">admin home</Link>.</li>
      </ol>
      <CopyBox text={fullSetupSql()} />
    </div>
  );
}
