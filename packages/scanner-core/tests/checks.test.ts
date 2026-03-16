import { describe, test, expect } from 'bun:test';
import type { CheckContext, HttpResponse } from '../src/types.js';

// Import checks directly
import securityHeaders from '../src/checks/passive/security-headers.js';
import corsAudit from '../src/checks/passive/cors-audit.js';
import hstsPreload from '../src/checks/passive/hsts-preload.js';
import cookieAudit from '../src/checks/passive/cookie-audit.js';
import errorDisclosure from '../src/checks/passive/error-disclosure.js';

function makeResponse(overrides?: Partial<HttpResponse>): HttpResponse {
  return {
    status: 200,
    headers: {},
    body: '',
    url: 'https://example.com',
    redirects: [],
    durationMs: 10,
    ...overrides,
  };
}

function makeCtx(getResponse?: HttpResponse, optionsResponse?: HttpResponse): CheckContext {
  const defaultResp = makeResponse();
  return {
    config: { targetUrl: 'https://example.com', mode: 'passive' },
    httpClient: {
      get: async () => getResponse ?? defaultResp,
      post: async () => defaultResp,
      options: async () => optionsResponse ?? defaultResp,
    },
    platformInfo: { version: '0.3.0', service: 'web', isOpenClaw: true, detectedProviders: [], planTier: null },
  };
}

describe('security-headers check', () => {
  test('reports missing required headers', async () => {
    const ctx = makeCtx(makeResponse({ headers: {} }));
    const result = await securityHeaders.run(ctx);
    expect(result.status).toBe('fail');
    expect(result.findings.length).toBeGreaterThan(0);

    const titles = result.findings.map((f) => f.title);
    expect(titles.some((t) => t.includes('strict-transport-security'))).toBe(true);
    expect(titles.some((t) => t.includes('content-security-policy'))).toBe(true);
    expect(titles.some((t) => t.includes('x-content-type-options'))).toBe(true);
  });

  test('passes with all headers present', async () => {
    const ctx = makeCtx(makeResponse({
      headers: {
        'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
        'content-security-policy': "default-src 'self'",
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'referrer-policy': 'strict-origin-when-cross-origin',
      },
    }));
    const result = await securityHeaders.run(ctx);
    expect(result.findings.filter((f) => f.severity === 'high')).toHaveLength(0);
  });

  test('detects x-powered-by leakage', async () => {
    const ctx = makeCtx(makeResponse({
      headers: {
        'strict-transport-security': 'max-age=31536000',
        'content-security-policy': "default-src 'self'",
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'x-powered-by': 'Express',
      },
    }));
    const result = await securityHeaders.run(ctx);
    expect(result.findings.some((f) => f.title.includes('x-powered-by'))).toBe(true);
  });
});

describe('hsts-preload check', () => {
  test('reports missing HSTS', async () => {
    const ctx = makeCtx(makeResponse({ headers: {} }));
    const result = await hstsPreload.run(ctx);
    expect(result.status).toBe('fail');
    expect(result.findings.some((f) => f.title.includes('not set'))).toBe(true);
  });

  test('reports short max-age', async () => {
    const ctx = makeCtx(makeResponse({
      headers: { 'strict-transport-security': 'max-age=86400' },
    }));
    const result = await hstsPreload.run(ctx);
    expect(result.findings.some((f) => f.title.includes('max-age'))).toBe(true);
  });

  test('reports missing includeSubDomains', async () => {
    const ctx = makeCtx(makeResponse({
      headers: { 'strict-transport-security': 'max-age=31536000; preload' },
    }));
    const result = await hstsPreload.run(ctx);
    expect(result.findings.some((f) => f.title.includes('includeSubDomains'))).toBe(true);
  });

  test('passes with complete HSTS', async () => {
    const ctx = makeCtx(makeResponse({
      headers: { 'strict-transport-security': 'max-age=31536000; includeSubDomains; preload' },
    }));
    const result = await hstsPreload.run(ctx);
    expect(result.status).toBe('pass');
  });
});

describe('cookie-audit check', () => {
  test('passes when no cookies', async () => {
    const ctx = makeCtx(makeResponse({ headers: {} }));
    const result = await cookieAudit.run(ctx);
    expect(result.status).toBe('pass');
    expect(result.findings).toHaveLength(0);
  });

  test('reports insecure cookies', async () => {
    const ctx = makeCtx(makeResponse({
      headers: { 'set-cookie': 'session=abc123; Path=/' },
    }));
    const result = await cookieAudit.run(ctx);
    expect(result.status).toBe('fail');
    expect(result.findings.some((f) => f.title.includes('Secure'))).toBe(true);
    expect(result.findings.some((f) => f.title.includes('HttpOnly'))).toBe(true);
    expect(result.findings.some((f) => f.title.includes('SameSite'))).toBe(true);
  });

  test('passes with secure cookies', async () => {
    const ctx = makeCtx(makeResponse({
      headers: { 'set-cookie': 'session=abc123; Secure; HttpOnly; SameSite=Strict; Path=/' },
    }));
    const result = await cookieAudit.run(ctx);
    expect(result.status).toBe('pass');
  });
});

describe('error-disclosure check', () => {
  test('detects stack traces in error response', async () => {
    const ctx = makeCtx(makeResponse({
      status: 500,
      body: 'Error: Something went wrong\n  at Function (/app/src/handler.ts:42:10)\n  at Layer.handle',
    }));
    const result = await errorDisclosure.run(ctx);
    expect(result.findings.some((f) => f.title.includes('Stack trace'))).toBe(true);
  });

  test('passes with clean error responses', async () => {
    const ctx = makeCtx(makeResponse({
      status: 404,
      body: '{"error":"Not found"}',
    }));
    const result = await errorDisclosure.run(ctx);
    expect(result.status).toBe('pass');
  });
});
