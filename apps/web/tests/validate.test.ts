import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { validateBody, createScanSchema, createProjectSchema, checkoutSchema, communityReportSchema } from '../src/middleware/validate';

function createApp(schema: Parameters<typeof validateBody>[0]) {
  const app = new Hono<{ Variables: { validatedBody: unknown } }>();
  app.post('/', validateBody(schema), (c) => {
    return c.json({ success: true, data: c.get('validatedBody') });
  });
  return app;
}

function post(app: ReturnType<typeof createApp>, body: unknown) {
  return app.request('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('validateBody middleware', () => {
  test('rejects non-JSON body', async () => {
    const app = createApp(createScanSchema);
    const res = await app.request('/', { method: 'POST', body: 'not json' });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Invalid JSON');
  });
});

describe('createScanSchema', () => {
  const app = createApp(createScanSchema);

  test('accepts valid scan request', async () => {
    const res = await post(app, { targetUrl: 'https://example.com', mode: 'passive' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.targetUrl).toBe('https://example.com');
    expect(data.data.mode).toBe('passive');
  });

  test('defaults mode to passive', async () => {
    const res = await post(app, { targetUrl: 'https://example.com' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.mode).toBe('passive');
  });

  test('rejects missing targetUrl', async () => {
    const res = await post(app, { mode: 'passive' });
    expect(res.status).toBe(400);
  });

  test('rejects empty targetUrl', async () => {
    const res = await post(app, { targetUrl: '' });
    expect(res.status).toBe(400);
  });

  test('rejects invalid mode', async () => {
    const res = await post(app, { targetUrl: 'https://example.com', mode: 'aggressive' });
    expect(res.status).toBe(400);
  });
});

describe('createProjectSchema', () => {
  const app = createApp(createProjectSchema);

  test('accepts valid project', async () => {
    const res = await post(app, { name: 'My Project', targetUrl: 'https://example.com' });
    expect(res.status).toBe(200);
  });

  test('rejects missing name', async () => {
    const res = await post(app, { targetUrl: 'https://example.com' });
    expect(res.status).toBe(400);
  });

  test('rejects invalid URL', async () => {
    const res = await post(app, { name: 'Proj', targetUrl: 'not-a-url' });
    expect(res.status).toBe(400);
  });
});

describe('checkoutSchema', () => {
  const app = createApp(checkoutSchema);

  test('accepts starter plan', async () => {
    const res = await post(app, { plan: 'starter' });
    expect(res.status).toBe(200);
  });

  test('rejects unknown plan', async () => {
    const res = await post(app, { plan: 'enterprise' });
    expect(res.status).toBe(400);
  });

  test('rejects missing plan', async () => {
    const res = await post(app, {});
    expect(res.status).toBe(400);
  });
});

describe('communityReportSchema', () => {
  const app = createApp(communityReportSchema);
  const valid = { targetHost: 'example.com', score: 75, severityCounts: { high: 1 }, findingCount: 3 };

  test('accepts valid community report', async () => {
    const res = await post(app, valid);
    expect(res.status).toBe(200);
  });

  test('rejects negative score', async () => {
    const res = await post(app, { ...valid, score: -1 });
    expect(res.status).toBe(400);
  });

  test('rejects score over 100', async () => {
    const res = await post(app, { ...valid, score: 101 });
    expect(res.status).toBe(400);
  });

  test('rejects missing targetHost', async () => {
    const res = await post(app, { score: 50, severityCounts: {}, findingCount: 0 });
    expect(res.status).toBe(400);
  });
});
