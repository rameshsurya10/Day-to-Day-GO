/* =================================================================
   auth.js — single-password session handling.
   Edge-safe (Web Crypto only), so middleware can use it.

   No fallbacks: APP_PASSWORD and AUTH_SECRET must be set. The session
   cookie is HMAC-SHA256(AUTH_SECRET, password) — it can't be forged
   without the secret, and changing either value logs everyone out.
   ================================================================= */

export const SESSION_COOKIE = 'd2d_session';
const MIN_SECRET_LENGTH = 32;
const DEFAULT_SESSION_DAYS = 30;
const MAX_SESSION_DAYS = 365;

/* null when configured, otherwise a message for the operator. */
export function authConfigError() {
  if (!process.env.APP_PASSWORD) return 'APP_PASSWORD is not set.';
  if ((process.env.AUTH_SECRET || '').length < MIN_SECRET_LENGTH) {
    return `AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters (openssl rand -hex 32).`;
  }
  return null;
}

/* Cookie options from the environment. Secure everywhere except local
   `next dev` over http://localhost. */
export function sessionCookieOptions() {
  const days = Number(process.env.SESSION_DAYS);
  const maxDays = Number.isFinite(days) && days > 0 && days <= MAX_SESSION_DAYS ? days : DEFAULT_SESSION_DAYS;
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.round(maxDays * 24 * 60 * 60),
  };
}

export async function sessionToken() {
  if (authConfigError()) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(process.env.AUTH_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('d2d-session:' + process.env.APP_PASSWORD));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* Constant-time comparison (length is not secret here). */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
