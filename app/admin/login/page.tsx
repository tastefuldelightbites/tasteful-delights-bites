import { redirect } from 'next/navigation';
import { adminPasswordSet, isAdmin } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  if (await isAdmin()) redirect('/admin');
  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }} className="stack">
      <h1 style={{ fontSize: '2.4rem' }} className="center">Welcome <span className="gold-text">back</span></h1>
      {adminPasswordSet() ? (
        <LoginForm />
      ) : (
        <div className="alert">The admin password has not been set yet. In Vercel, add a setting named ADMIN_PASSWORD, then redeploy.</div>
      )}
    </div>
  );
}
