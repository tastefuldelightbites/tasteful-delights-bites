'use client';
import { useActionState } from 'react';
import { loginAction } from '../actions';

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="panel form-grid">
      <div className="field">
        <label htmlFor="pw">Password</label>
        <input id="pw" name="password" type="password" className="input" required autoComplete="current-password" autoFocus />
      </div>
      {state?.error && <div className="alert">{state.error}</div>}
      <button className="btn btn-gold btn-block" disabled={pending}>{pending ? 'Checking…' : 'Log in'}</button>
    </form>
  );
}
