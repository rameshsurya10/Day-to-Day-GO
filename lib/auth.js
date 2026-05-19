/* =================================================================
   auth.js — single-password session handling.
   Edge-safe: uses only the Web Crypto API, no Node built-ins, so it
   can run inside Next.js middleware.
   ================================================================= */

export const SESSION_COOKIE = 'd2d_session';

/* Derives an opaque session token from APP_PASSWORD + AUTH_SECRET.
   The cookie value equals this token. It cannot be forged without
   knowing the password, and the password itself is never sent to or
   stored in the browser. */
export async function sessionToken() {
  const pw = process.env.APP_PASSWORD || '';
  const secret = process.env.AUTH_SECRET || 'd2d-fallback-secret';
  const data = new TextEncoder().encode(pw + '::' + secret);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/* Constant-time-ish comparison to avoid leaking via timing. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
