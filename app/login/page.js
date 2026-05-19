'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
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
    <main className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">DAY<b>//</b>TO<b>//</b>DAY</div>
        <div className="login-tag">OPERATOR CONSOLE — RESTRICTED ACCESS</div>
        <input
          type="password"
          className="login-input"
          placeholder="ENTER PASSWORD"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
        />
        <button className="login-btn" type="submit" disabled={busy}>
          {busy ? 'VERIFYING…' : 'UNLOCK CONSOLE'}
        </button>
        {error && <div className="login-error">{error}</div>}
      </form>
    </main>
  );
}
