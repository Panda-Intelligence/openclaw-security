import type { Context, Next } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

function cleanup(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

function getClientIp(c: Context): string {
  return (
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

/**
 * Fixed-window rate limiter for Cloudflare Workers.
 *
 * Uses module-level Map — state persists within each isolate's lifetime
 * (typically minutes). For stricter production enforcement, pair with
 * Cloudflare's built-in Rate Limiting rules.
 */
export function rateLimit(opts: { limit: number; windowMs: number; keyPrefix?: string }) {
  return async (c: Context, next: Next) => {
    // Periodically purge expired entries to bound memory
    if (store.size > 5000) cleanup();

    const ip = getClientIp(c);
    const prefix = opts.keyPrefix ?? new URL(c.req.url).pathname;
    const key = `${prefix}:${ip}`;
    const now = Date.now();

    const entry = store.get(key);
    if (!entry || entry.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > opts.limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json({ success: false, error: 'Too many requests' }, 429);
    }

    return next();
  };
}

/** Visible for testing */
export function _resetStore(): void {
  store.clear();
}
export function _storeSize(): number {
  return store.size;
}
