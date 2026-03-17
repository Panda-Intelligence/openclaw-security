import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import type { Env } from '../src/worker';

// ── D1 mock ──

type Row = Record<string, unknown>;

function mockDb(opts: { firstResult?: Row | null; allResults?: Row[] } = {}) {
  const stmts: Array<{ sql: string; binds: unknown[] }> = [];
  return {
    prepare: (sql: string) => {
      const s = {
        _binds: [] as unknown[],
        bind: (...args: unknown[]) => {
          s._binds = args;
          stmts.push({ sql, binds: args });
          return s;
        },
        first: async () => opts.firstResult ?? null,
        all: async () => ({ results: opts.allResults ?? [] }),
        run: async () => ({ success: true }),
      };
      return s;
    },
    _stmts: stmts,
  };
}

function fakeEnv(db: ReturnType<typeof mockDb>): Env {
  return {
    DB: db as unknown as D1Database,
    SCAN_QUEUE: {} as unknown as Queue,
    ASSETS: {} as unknown as Fetcher,
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_x',
    STRIPE_PRICE_STARTER: 'price_test_x',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    GOOGLE_REDIRECT_URI: '',
    GITHUB_CLIENT_ID: '',
    GITHUB_CLIENT_SECRET: '',
    GITHUB_REDIRECT_URI: '',
  };
}

// ── Projects tests ──

import { projectRoutes } from '../src/api/projects';

function projectApp(db: ReturnType<typeof mockDb>) {
  const app = new Hono<{ Bindings: Env; Variables: { userId: string; validatedBody: unknown } }>();
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1');
    return next();
  });
  app.route('/', projectRoutes);
  return { app, env: fakeEnv(db) };
}

function appRequest(app: Hono, env: Env, path: string, init?: RequestInit) {
  return app.request(path, init, env);
}

describe('projectRoutes', () => {
  test('POST / validates missing fields', async () => {
    const db = mockDb();
    const { app, env } = projectApp(db);
    const res = await appRequest(app, env, '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  test('POST / creates project when under quota', async () => {
    const db = mockDb({
      firstResult: { plan: 'free', count: 0 },
    });
    const { app, env } = projectApp(db);
    const res = await appRequest(app, env, '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', targetUrl: 'https://example.com' }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('Test');
  });

  test('GET / returns project list', async () => {
    const db = mockDb({
      allResults: [{ id: 'p1', name: 'Proj', target_url: 'https://example.com', created_at: '2026-01-01' }],
    });
    const { app, env } = projectApp(db);
    const res = await appRequest(app, env, '/');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(1);
  });

  test('DELETE /:id returns 404 for non-owned project', async () => {
    const db = mockDb({ firstResult: null });
    const { app, env } = projectApp(db);
    const res = await appRequest(app, env, '/p1', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  test('DELETE /:id succeeds for owned project', async () => {
    const db = mockDb({ firstResult: { id: 'p1' } });
    const { app, env } = projectApp(db);
    const res = await appRequest(app, env, '/p1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});

// ── Community tests ──

import { communityRoutes } from '../src/api/community';
import { authRoutes } from '../src/api/auth';

function communityApp(db: ReturnType<typeof mockDb>) {
  const app = new Hono<{ Bindings: Env; Variables: { validatedBody: unknown } }>();
  app.route('/', communityRoutes);
  return { app, env: fakeEnv(db) };
}

describe('communityRoutes', () => {
  test('POST / validates input', async () => {
    const db = mockDb();
    const { app, env } = communityApp(db);
    const res = await appRequest(app, env, '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: -5 }),
    });
    expect(res.status).toBe(400);
  });

  test('POST / accepts valid community report', async () => {
    const db = mockDb();
    const { app, env } = communityApp(db);
    const res = await appRequest(app, env, '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetHost: 'example.com',
        score: 75,
        severityCounts: { high: 1, medium: 2 },
        findingCount: 3,
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.id).toBeTruthy();
  });

  test('GET / returns community reports', async () => {
    const db = mockDb({
      allResults: [
        { id: 'r1', target_host: 'example.com', score: 80, severity_counts: '{"high":1}', finding_count: 1 },
      ],
    });
    const { app, env } = communityApp(db);
    const res = await appRequest(app, env, '/');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data[0].severity_counts).toEqual({ high: 1 });
  });

  test('GET /leaderboard returns ranked hosts', async () => {
    const db = mockDb({
      allResults: [{ target_host: 'example.com', best_score: 90, scan_count: 5, last_scan: '2026-01-01' }],
    });
    const { app, env } = communityApp(db);
    const res = await appRequest(app, env, '/leaderboard');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test('GET /intelligence returns public intelligence overview', async () => {
    const db = mockDb();
    const { app, env } = communityApp(db);
    const res = await appRequest(app, env, '/intelligence');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.marketplaceSkills.length).toBeGreaterThan(0);
    expect(data.data.sources.length).toBeGreaterThan(0);
  });

  test('GET /intelligence/gateway returns gateway hardening items', async () => {
    const db = mockDb();
    const { app, env } = communityApp(db);
    const res = await appRequest(app, env, '/intelligence/gateway');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
  });
});

function authApp(db: ReturnType<typeof mockDb>) {
  const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
  app.route('/', authRoutes);
  return { app, env: fakeEnv(db) };
}

describe('authRoutes', () => {
  test('GET /me returns 401 without authentication', async () => {
    const db = mockDb();
    const { app, env } = authApp(db);
    const res = await appRequest(app, env, '/me');
    expect(res.status).toBe(401);
  });

  test('GET /me succeeds with valid bearer token even without outer middleware', async () => {
    const { signJwt } = await import('../src/utils/jwt');
    const token = await signJwt({ sub: 'user-1', email: 'test@example.com', name: 'Tester' }, 'dev-secret');
    const db = mockDb({
      firstResult: { id: 'user-1', email: 'test@example.com', name: 'Tester', picture: null },
    });
    let queryCount = 0;
    const originalPrepare = db.prepare;
    db.prepare = ((sql: string) => {
      const stmt = originalPrepare(sql);
      return {
        ...stmt,
        bind: (...args: unknown[]) => {
          queryCount += 1;
          return stmt.bind(...args);
        },
      };
    }) as typeof db.prepare;
    const { app, env } = authApp(db);
    env.JWT_SECRET = 'dev-secret';
    const res = await appRequest(app, env, '/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(queryCount).toBeGreaterThan(0);
  });
});

// ── Reports tests ──

import { reportRoutes } from '../src/api/reports';

function reportApp(db: ReturnType<typeof mockDb>, userId = 'user-1') {
  const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
  app.use('*', async (c, next) => {
    c.set('userId', userId);
    return next();
  });
  app.route('/', reportRoutes);
  return { app, env: fakeEnv(db) };
}

describe('reportRoutes', () => {
  test('GET /:scanId returns 404 for missing scan', async () => {
    const db = mockDb({ firstResult: null });
    const { app, env } = reportApp(db);
    const res = await appRequest(app, env, '/scan-123');
    expect(res.status).toBe(404);
  });

  test('GET /:scanId returns 403 for other user scan', async () => {
    const db = mockDb({ firstResult: { id: 'scan-1', user_id: 'user-2', severity_counts: '{}', platform_info: '{}' } });
    const { app, env } = reportApp(db, 'user-1');
    const res = await appRequest(app, env, '/scan-1');
    expect(res.status).toBe(403);
  });

  test('GET /:scanId returns report for own scan', async () => {
    const db = mockDb({
      firstResult: { id: 'scan-1', user_id: 'user-1', severity_counts: '{"high":2}', platform_info: '{}' },
      allResults: [{ id: 'f1', scan_id: 'scan-1', check_id: 'sec-headers', title: 'Missing headers', severity: 'high', description: 'desc', evidence: '', recommendation: 'add them' }],
    });
    const { app, env } = reportApp(db, 'user-1');
    const res = await appRequest(app, env, '/scan-1');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.severity_counts).toEqual({ high: 2 });
    expect(data.data.findings).toHaveLength(1);
  });

  test('GET /:scanId allows anonymous scans (null user_id)', async () => {
    const db = mockDb({
      firstResult: { id: 'scan-anon', user_id: null, severity_counts: '{}', platform_info: '{}' },
      allResults: [],
    });
    const { app, env } = reportApp(db, 'user-1');
    const res = await appRequest(app, env, '/scan-anon');
    expect(res.status).toBe(200);
  });
});
