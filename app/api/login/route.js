/* POST /api/login — exchange the password for a session cookie.
   Rate-limited per IP to stop password guessing. */

import { NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionToken, safeEqual, authConfigError, sessionCookieOptions } from '@/lib/auth';
import { clientIp, hit, reset } from '@/lib/rateLimit';

const MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS) || 5;
const WINDOW_MS = (Number(process.env.LOGIN_WINDOW_MINUTES) || 15) * 60 * 1000;
const MAX_PASSWORD_LENGTH = 200;

export async function POST(req) {
  const configError = authConfigError();
  if (configError) {
    console.error('[login] not configured:', configError);
    return NextResponse.json({ success: false, error: 'Login is not configured on the server.' }, { status: 503 });
  }

  const key = 'login:' + clientIp(req);
  const limit = hit(key, MAX_ATTEMPTS, WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} min.` },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  let body;
  try { body = await req.json(); } catch { body = {}; }
  const password = typeof body?.password === 'string' ? body.password.slice(0, MAX_PASSWORD_LENGTH) : '';

  if (!safeEqual(password, process.env.APP_PASSWORD)) {
    console.warn('[login] failed attempt from', clientIp(req));
    return NextResponse.json({ success: false, error: 'Incorrect password.' }, { status: 401 });
  }

  reset(key);
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(), sessionCookieOptions());
  return res;
}
