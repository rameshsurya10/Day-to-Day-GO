/* POST /api/login — exchange the password for a session cookie. */

import { NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionToken, safeEqual } from '@/lib/auth';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { body = {}; }

  const password = typeof body.password === 'string' ? body.password : '';
  const expected = process.env.APP_PASSWORD || '';

  if (!expected) {
    return NextResponse.json(
      { success: false, error: 'APP_PASSWORD is not configured on the server.' },
      { status: 500 }
    );
  }
  if (!safeEqual(password, expected)) {
    return NextResponse.json(
      { success: false, error: 'Incorrect password.' },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 180, // 180 days
  });
  return res;
}
