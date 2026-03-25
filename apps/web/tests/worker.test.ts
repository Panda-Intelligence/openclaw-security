import { beforeEach, describe, expect, test } from 'bun:test';
import { INTELLIGENCE_META_KEYS } from '../src/intelligence-store';
import { APP_SCHEMA_VERSION, resetSchemaBootstrapForTests } from '../src/state/bootstrap';
import worker, { type Env } from '../src/worker';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    SCAN_QUEUE: {} as Queue,
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

describe('worker asset fallback', () => {
  beforeEach(() => {
    resetSchemaBootstrapForTests();
  });

  test('serves robots.txt without ASSETS binding', async () => {
    const res = await worker.fetch(
      new Request('http://localhost/robots.txt'),
      makeEnv(),
      {} as ExecutionContext,
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Sitemap: http://localhost/sitemap.xml');
  });

  test('serves sitemap.xml without ASSETS binding', async () => {
    const res = await worker.fetch(
      new Request('http://localhost/sitemap.xml'),
      makeEnv(),
      {} as ExecutionContext,
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<loc>http://localhost/intel</loc>');
  });

  test('sitemap includes blog article routes', async () => {
    const res = await worker.fetch(
      new Request('http://localhost/sitemap.xml'),
      makeEnv(),
      {} as ExecutionContext,
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<loc>http://localhost/blog/marketplace-skills-security</loc>');
  });

  test('returns a clear 500 when ASSETS binding is missing', async () => {
    const res = await worker.fetch(
      new Request('http://localhost/'),
      makeEnv(),
      {} as ExecutionContext,
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      success: false,
      error: {
        code: 'ASSETS_BINDING_MISSING',
        message: 'Static asset binding "ASSETS" is not configured.',
      },
    });
  });

  test('bootstraps schema before public api routes hit auth endpoints', async () => {
    let lookupCount = 0;
    const res = await worker.fetch(
      new Request('http://localhost/api/auth/google'),
      makeEnv({
        DB: {
          prepare(sql: string) {
            return {
              bind: (..._args: unknown[]) => ({
                run: async () => ({ success: true }),
              }),
              first: async () => {
                if (sql.includes(`sqlite_master`)) {
                  lookupCount += 1;
                  return null;
                }
                return null;
              },
              run: async () => ({ success: true }),
            };
          },
        } as unknown as D1Database,
      }),
      {} as ExecutionContext,
    );

    expect(res.status).toBe(302);
    expect(lookupCount).toBeGreaterThan(0);
  });

  test('returns migration required outside local development when schema is missing', async () => {
    const res = await worker.fetch(
      new Request('https://openclawsecurity.io/api/auth/google'),
      makeEnv({
        DB: {
          prepare(_sql: string) {
            return {
              bind: (..._args: unknown[]) => ({
                run: async () => ({ success: true }),
              }),
              first: async () => null,
              run: async () => ({ success: true }),
            };
          },
        } as unknown as D1Database,
      }),
      {} as ExecutionContext,
    );

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      success: false,
      error: {
        code: 'MIGRATION_REQUIRED',
        message: 'Database schema is missing. Run the D1 migrations before serving requests. Expected schema version 2026.03.17.2.',
      },
    });
  });

  test('delegates to the ASSETS binding when available', async () => {
    const res = await worker.fetch(
      new Request('http://localhost/assets/index.js'),
      makeEnv({
        ASSETS: {
          fetch: async () => new Response('asset-body', { status: 200 }),
        } as Fetcher,
      }),
      {} as ExecutionContext,
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('asset-body');
  });

  test('scheduled refresh populates cached intelligence metadata', async () => {
    const meta = new Map<string, string>([['schema_version', APP_SCHEMA_VERSION]]);
    const db = {
      prepare(sql: string) {
        let binds: unknown[] = [];
        const statement = {
          bind: (...args: unknown[]) => {
            binds = args;
            return statement;
          },
          first: async () => {
            if (sql.includes(`sqlite_master`)) {
              return { name: 'users' };
            }
            if (sql.includes(`FROM app_meta WHERE key = 'schema_version'`)) {
              return { value: APP_SCHEMA_VERSION };
            }
            if (sql.includes('FROM app_meta WHERE key = ?')) {
              const key = String(binds[0] ?? '');
              return meta.has(key) ? { value: meta.get(key) } : null;
            }
            return null;
          },
          all: async () => ({ results: [] }),
          run: async () => {
            if (sql.includes('INSERT INTO app_meta')) {
              meta.set(String(binds[0] ?? ''), String(binds[1] ?? ''));
            }
            return { success: true };
          },
        };
        return statement;
      },
    } as unknown as D1Database;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
      const url = String(input);

      if (url.includes('/releases')) {
        return new Response(
          JSON.stringify([
            {
              name: 'OpenClaw 2026.3.24',
              tag_name: 'v2026.3.24',
              prerelease: false,
              published_at: '2026-03-24T10:00:00Z',
              html_url: 'https://github.com/openclaw/openclaw/releases/tag/v2026.3.24',
              body: 'Stable release',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.includes('/commits')) {
        return new Response(
          JSON.stringify([
            {
              sha: 'abcdef1234567890',
              html_url: 'https://github.com/openclaw/openclaw/commit/abcdef1234567890',
              commit: {
                author: { date: '2026-03-24T10:30:00Z' },
                message: 'fix: refresh intelligence cache',
              },
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.includes('api.osv.dev')) {
        expect(JSON.parse(String(init?.body))).toMatchObject({ version: 'v2026.3.24' });
        return new Response(JSON.stringify({ vulns: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    }) as typeof fetch;

    try {
      expect(worker.scheduled).toBeDefined();
      await worker.scheduled?.({} as ScheduledEvent, makeEnv({ DB: db }), {} as ExecutionContext);
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(meta.get(INTELLIGENCE_META_KEYS.upstreamSnapshot)).toBeTruthy();
    expect(meta.get(INTELLIGENCE_META_KEYS.advisoryFeed)).toBeTruthy();
    expect(meta.get(INTELLIGENCE_META_KEYS.refreshedAt)).toBeTruthy();
    expect(meta.get(INTELLIGENCE_META_KEYS.refreshError)).toBe('');
  });
});
