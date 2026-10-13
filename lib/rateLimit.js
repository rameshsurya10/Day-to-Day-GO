/* =================================================================
   rateLimit.js — small fixed-window limiter, in memory per server
   instance. Good enough to stop password guessing and API abuse for a
   single-user app; for multi-region scale use a shared store
   (e.g. Upstash Redis via the Vercel Marketplace).
   ================================================================= */

const MAX_KEYS = 5000;
const buckets = new Map();

/* Client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req) {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

/* Returns { ok, retryAfter } and counts this hit. */
export function hit(key, limit, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now >= b.reset) {
    if (buckets.size >= MAX_KEYS) buckets.clear();   // bounded memory
    b = { count: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return { ok: b.count <= limit, retryAfter: Math.ceil((b.reset - now) / 1000) };
}

export function reset(key) {
  buckets.delete(key);
}
