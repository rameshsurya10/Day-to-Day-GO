/* =================================================================
   middleware.js — the password gate.
   Runs before every request. Unauthenticated page requests are sent
   to /login; unauthenticated API requests get a 401.
   ================================================================= */

import { NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionToken, safeEqual } from '@/lib/auth';

// Paths reachable without a session.
const PUBLIC = ['/login', '/api/login', '/day-to-day.ics', '/favicon.ico'];

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const expected = await sessionToken();

  if (cookie && safeEqual(cookie, expected)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

// Skip Next.js internals and static assets.
export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
