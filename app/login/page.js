'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (json.success) {
        router.replace('/');
        router.refresh();
      } else {
        setError(json.error || 'Login failed.');
        setBusy(false);
      }
    } catch {
      setError('Network error — please try again.');
      setBusy(false);
    }
  }

  return (
    <main className="app login-wrap">
      <div className="bg-blobs" aria-hidden="true"><i /><i /><i /></div>
      <form className="glass login-card" onSubmit={submit}>
        <p className="eyebrow">Day to Day</p>
        <h1>Welcome back</h1>
        <p className="muted">Sleep, study, gym, food — one day at a time.</p>
        <div className="field">
          <label className="field-label" htmlFor="password">Password</label>
          <span className="pw-wrap">
            <input
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? 'login-error' : undefined}
              autoFocus
              required
            />
            <button
              type="button"
              className="pw-toggle"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? 'Hide' : 'Show'}
            </button>
          </span>
        </div>
        {error && <p className="form-error" id="login-error" role="alert">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </main>
  );
}
