import { describe, test, expect, beforeEach } from 'bun:test';
import { _resetStore, _storeSize } from '../src/middleware/rate-limit';

// We test the rate limiter through a minimal Hono app
import { Hono } from 'hono';
import { rateLimit } from '../src/middleware/rate-limit';

function createApp(limit: number, windowMs: number) {
  const app = new Hono();
  app.use('/*', rateLimit({ limit, windowMs, keyPrefix: 'test' }));
  app.get('/', (c) => c.json({ ok: true }));
  return app;
}

describe('rateLimit middleware', () => {
  beforeEach(() => {
    _resetStore();
  });

  test('allows requests under the limit', async () => {
    const app = createApp(3, 60_000);
    for (let i = 0; i < 3; i++) {
      const res = await app.request('/', { headers: { 'cf-connecting-ip': '1.2.3.4' } });
      expect(res.status).toBe(200);
    }
  });

  test('returns 429 when limit is exceeded', async () => {
    const app = createApp(2, 60_000);
    await app.request('/', { headers: { 'cf-connecting-ip': '1.2.3.4' } });
    await app.request('/', { headers: { 'cf-connecting-ip': '1.2.3.4' } });
    const res = await app.request('/', { headers: { 'cf-connecting-ip': '1.2.3.4' } });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('Too many requests');
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  test('tracks different IPs separately', async () => {
    const app = createApp(1, 60_000);
    const res1 = await app.request('/', { headers: { 'cf-connecting-ip': '1.1.1.1' } });
    const res2 = await app.request('/', { headers: { 'cf-connecting-ip': '2.2.2.2' } });
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    // Now both are at limit
    const res3 = await app.request('/', { headers: { 'cf-connecting-ip': '1.1.1.1' } });
    expect(res3.status).toBe(429);
  });

  test('resets after window expires', async () => {
    const app = createApp(1, 50); // 50ms window
    await app.request('/', { headers: { 'cf-connecting-ip': '5.5.5.5' } });
    const blocked = await app.request('/', { headers: { 'cf-connecting-ip': '5.5.5.5' } });
    expect(blocked.status).toBe(429);

    await new Promise((r) => setTimeout(r, 60));
    const afterReset = await app.request('/', { headers: { 'cf-connecting-ip': '5.5.5.5' } });
    expect(afterReset.status).toBe(200);
  });

  test('_resetStore clears all entries', () => {
    expect(_storeSize()).toBe(0);
  });
});
