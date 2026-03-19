import { afterEach, describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { pairingRoutes } from '../src/api/pairings';
import { scanRoutes } from '../src/api/scans';
import { encrypt } from '../src/utils/crypto';
import type { Env } from '../src/worker';

type Row = Record<string, unknown>;

type DbHandlers = {
  first?: (sql: string, binds: unknown[]) => Row | null | Promise<Row | null>;
  all?: (sql: string, binds: unknown[]) => Row[] | Promise<Row[]>;
  run?: (sql: string, binds: unknown[]) => void | Promise<void>;
};

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const PAIRING_ID = '22222222-2222-4222-8222-222222222222';
const originalFetch = globalThis.fetch;

function createDb(handlers: DbHandlers = {}) {
  const statements: Array<{ sql: string; binds: unknown[] }> = [];

  return {
    prepare(sql: string) {
      const stmt = {
        binds: [] as unknown[],
        bind(...args: unknown[]) {
          stmt.binds = args;
          statements.push({ sql, binds: args });
          return stmt;
        },
        async first() {
          return (await handlers.first?.(sql, stmt.binds)) ?? null;
        },
        async all() {
          return { results: (await handlers.all?.(sql, stmt.binds)) ?? [] };
        },
        async run() {
          await handlers.run?.(sql, stmt.binds);
          return { success: true };
        },
      };

      return stmt;
    },
    statements,
  };
}

function makeEnv(db: ReturnType<typeof createDb>, overrides: Partial<Env> = {}): Env {
  return {
    DB: db as unknown as D1Database,
    SCAN_QUEUE: {
      send: async () => undefined,
    } as unknown as Queue,
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
    ...overrides,
  };
}

function createProtectedApp(
  route: typeof pairingRoutes | typeof scanRoutes,
  db: ReturnType<typeof createDb>,
  overrides: Partial<Env> = {},
) {
  const app = new Hono<{ Bindings: Env; Variables: { userId: string; validatedBody: unknown } }>();
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1');
    return next();
  });
  app.route('/', route);
  return { app, env: makeEnv(db, overrides) };
}

function appRequest(app: Hono, env: Env, path: string, init?: RequestInit) {
  return app.request(path, init, env);
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createJwt(expiresAt = Math.floor(Date.now() / 1000) + 3600) {
  const encode = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp: expiresAt })}.signature`;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('pairingRoutes', () => {
  test('POST / creates a pairing and returns normalized record', async () => {
    const token = createJwt();
    const db = createDb({
      first(sql) {
        if (sql.includes('SELECT id, target_url FROM projects')) {
          return { id: PROJECT_ID, target_url: 'https://target.example' };
        }
        if (sql.includes(`SELECT id FROM pairings WHERE project_id = ? AND status = 'active'`)) {
          return null;
        }
        return null;
      },
    });

    globalThis.fetch = async () => jsonResponse({ data: { email: 'owner@example.com', tenantId: 'tenant-1' } });

    const { app, env } = createProtectedApp(pairingRoutes, db);
    const res = await appRequest(app, env, '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: PROJECT_ID, token }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.project_id).toBe(PROJECT_ID);
    expect(data.data.target_email).toBe('owner@example.com');
    expect(data.data.target_tenant_id).toBe('tenant-1');
    expect(data.data.expires_at).toBeString();

    const insert = db.statements.find((stmt) => stmt.sql.includes('INSERT INTO pairings'));
    expect(insert).toBeDefined();
    expect(insert?.binds[3]).not.toBe(token);
  });

  test('GET / returns all pairings for the current user when projectId is omitted', async () => {
    const db = createDb({
      all(sql, binds) {
        expect(sql).toContain('FROM pairings WHERE user_id = ?');
        expect(binds).toEqual(['user-1']);
        return [
          {
            id: PAIRING_ID,
            project_id: PROJECT_ID,
            label: '',
            status: 'active',
            target_email: 'owner@example.com',
            target_tenant_id: 'tenant-1',
            verified_at: '2026-03-19T00:00:00.000Z',
            last_used_at: null,
            expires_at: '2026-03-20T00:00:00.000Z',
            error_message: null,
            created_at: '2026-03-19T00:00:00.000Z',
            updated_at: '2026-03-19T00:00:00.000Z',
          },
        ];
      },
    });

    const { app, env } = createProtectedApp(pairingRoutes, db);
    const res = await appRequest(app, env, '/');

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].project_id).toBe(PROJECT_ID);
  });

  test('POST /:id/verify re-verifies the stored pairing', async () => {
    const token = createJwt();
    const { ciphertext, iv } = await encrypt(token, 'a'.repeat(64));
    const db = createDb({
      first(sql) {
        if (sql.includes(`SELECT id, project_id, encrypted_token, iv, status FROM pairings`)) {
          return { id: PAIRING_ID, project_id: PROJECT_ID, encrypted_token: ciphertext, iv, status: 'active' };
        }
        if (sql.includes('SELECT target_url FROM projects WHERE id = ?')) {
          return { target_url: 'https://target.example' };
        }
        return null;
      },
    });

    globalThis.fetch = async () => jsonResponse({ data: { email: 'owner@example.com', tenantId: 'tenant-1' } });

    const { app, env } = createProtectedApp(pairingRoutes, db);
    const res = await appRequest(app, env, `/${PAIRING_ID}/verify`, { method: 'POST' });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.status).toBe('active');
    expect(data.data.expiresAt).toBeString();
    expect(db.statements.some((stmt) => stmt.sql.includes(`UPDATE pairings SET status = 'active'`))).toBe(true);
  });

  test('POST /:id/refresh replaces the stored token and returns normalized record', async () => {
    const token = createJwt();
    const db = createDb({
      first(sql) {
        if (sql.includes(`SELECT id, project_id, label, created_at, last_used_at FROM pairings`)) {
          return {
            id: PAIRING_ID,
            project_id: PROJECT_ID,
            label: '',
            created_at: '2026-03-18T00:00:00.000Z',
            last_used_at: '2026-03-19T00:00:00.000Z',
          };
        }
        if (sql.includes('SELECT target_url FROM projects WHERE id = ?')) {
          return { target_url: 'https://target.example' };
        }
        return null;
      },
    });

    globalThis.fetch = async () => jsonResponse({ data: { email: 'owner@example.com', tenantId: 'tenant-1' } });

    const { app, env } = createProtectedApp(pairingRoutes, db);
    const res = await appRequest(app, env, `/${PAIRING_ID}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.project_id).toBe(PROJECT_ID);
    expect(data.data.target_email).toBe('owner@example.com');
    expect(data.data.last_used_at).toBe('2026-03-19T00:00:00.000Z');

    const update = db.statements.find((stmt) => stmt.sql.includes('UPDATE pairings SET encrypted_token = ?'));
    expect(update).toBeDefined();
    expect(update?.binds[0]).not.toBe(token);
  });

  test('DELETE /:id revokes the pairing', async () => {
    const db = createDb({
      first(sql) {
        if (sql.includes('SELECT id FROM pairings WHERE id = ? AND user_id = ?')) {
          return { id: PAIRING_ID };
        }
        return null;
      },
    });

    const { app, env } = createProtectedApp(pairingRoutes, db);
    const res = await appRequest(app, env, `/${PAIRING_ID}`, { method: 'DELETE' });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(db.statements.some((stmt) => stmt.sql.includes(`UPDATE pairings SET status = 'revoked'`))).toBe(true);
  });
});

describe('scanRoutes pairing resolution', () => {
  test('POST / uses a stored pairing token for active scans', async () => {
    const token = createJwt();
    const { ciphertext, iv } = await encrypt(token, 'a'.repeat(64));
    const sent: Array<{ scanId: string; jwt?: string }> = [];
    const db = createDb({
      first(sql) {
        if (sql.includes('SELECT plan FROM subscriptions')) return { plan: 'free' };
        if (sql.includes('SELECT id FROM projects WHERE id = ? AND user_id = ?')) return { id: PROJECT_ID };
        if (sql.includes(`SELECT COUNT(*) as count FROM scans WHERE project_id = ?`)) return { count: 0 };
        if (sql.includes('SELECT id, encrypted_token, iv, expires_at FROM pairings')) {
          return {
            id: PAIRING_ID,
            encrypted_token: ciphertext,
            iv,
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
          };
        }
        return null;
      },
    });

    const { app, env } = createProtectedApp(scanRoutes, db, {
      SCAN_QUEUE: {
        send: async (payload: { scanId: string; jwt?: string }) => {
          sent.push(payload);
        },
      } as unknown as Queue,
    });

    const res = await appRequest(app, env, '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUrl: 'https://target.example', mode: 'active', projectId: PROJECT_ID }),
    });

    expect(res.status).toBe(201);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.jwt).toBe(token);
    expect(db.statements.some((stmt) => stmt.sql.includes('UPDATE pairings SET last_used_at'))).toBe(true);
  });

  test('POST / returns 422 when the stored pairing token is expired', async () => {
    const token = createJwt(Math.floor(Date.now() / 1000) - 3600);
    const { ciphertext, iv } = await encrypt(token, 'a'.repeat(64));
    const db = createDb({
      first(sql) {
        if (sql.includes('SELECT plan FROM subscriptions')) return { plan: 'free' };
        if (sql.includes('SELECT id FROM projects WHERE id = ? AND user_id = ?')) return { id: PROJECT_ID };
        if (sql.includes(`SELECT COUNT(*) as count FROM scans WHERE project_id = ?`)) return { count: 0 };
        if (sql.includes('SELECT id, encrypted_token, iv, expires_at FROM pairings')) {
          return {
            id: PAIRING_ID,
            encrypted_token: ciphertext,
            iv,
            expires_at: new Date(Date.now() - 60_000).toISOString(),
          };
        }
        return null;
      },
    });

    const { app, env } = createProtectedApp(scanRoutes, db);
    const res = await appRequest(app, env, '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUrl: 'https://target.example', mode: 'active', projectId: PROJECT_ID }),
    });

    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error).toContain('expired');
    expect(db.statements.some((stmt) => stmt.sql.includes(`UPDATE pairings SET status = 'expired'`))).toBe(true);
  });

  test('POST / returns 500 when the stored pairing token cannot be decrypted', async () => {
    const db = createDb({
      first(sql) {
        if (sql.includes('SELECT plan FROM subscriptions')) return { plan: 'free' };
        if (sql.includes('SELECT id FROM projects WHERE id = ? AND user_id = ?')) return { id: PROJECT_ID };
        if (sql.includes(`SELECT COUNT(*) as count FROM scans WHERE project_id = ?`)) return { count: 0 };
        if (sql.includes('SELECT id, encrypted_token, iv, expires_at FROM pairings')) {
          return {
            id: PAIRING_ID,
            encrypted_token: 'broken',
            iv: 'broken',
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
          };
        }
        return null;
      },
    });

    const { app, env } = createProtectedApp(scanRoutes, db);
    const res = await appRequest(app, env, '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUrl: 'https://target.example', mode: 'active', projectId: PROJECT_ID }),
    });

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('decrypt');
  });
});
