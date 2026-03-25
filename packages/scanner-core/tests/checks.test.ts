import { describe, expect, test } from 'bun:test';
import apiKeyExposure from '../src/checks/passive/api-key-exposure';
import cookieAudit from '../src/checks/passive/cookie-audit';
import cspDeepAudit from '../src/checks/passive/csp-deep-audit';
import errorDisclosure from '../src/checks/passive/error-disclosure';
import hstsPreload from '../src/checks/passive/hsts-preload';
// Import checks directly
import securityHeaders from '../src/checks/passive/security-headers';
import type { CheckContext, HttpResponse } from '../src/types';

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
    const ctx = makeCtx(
      makeResponse({
        headers: {
          'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
          'content-security-policy': "default-src 'self'",
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
          'referrer-policy': 'strict-origin-when-cross-origin',
        },
      }),
    );
    const result = await securityHeaders.run(ctx);
    expect(result.findings.filter((f) => f.severity === 'high')).toHaveLength(0);
  });

  test('detects x-powered-by leakage', async () => {
    const ctx = makeCtx(
      makeResponse({
        headers: {
          'strict-transport-security': 'max-age=31536000',
          'content-security-policy': "default-src 'self'",
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
          'referrer-policy': 'strict-origin-when-cross-origin',
          'x-powered-by': 'Express',
        },
      }),
    );
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
    const ctx = makeCtx(
      makeResponse({
        headers: { 'strict-transport-security': 'max-age=86400' },
      }),
    );
    const result = await hstsPreload.run(ctx);
    expect(result.findings.some((f) => f.title.includes('max-age'))).toBe(true);
  });

  test('reports missing includeSubDomains', async () => {
    const ctx = makeCtx(
      makeResponse({
        headers: { 'strict-transport-security': 'max-age=31536000; preload' },
      }),
    );
    const result = await hstsPreload.run(ctx);
    expect(result.findings.some((f) => f.title.includes('includeSubDomains'))).toBe(true);
  });

  test('passes with complete HSTS', async () => {
    const ctx = makeCtx(
      makeResponse({
        headers: { 'strict-transport-security': 'max-age=31536000; includeSubDomains; preload' },
      }),
    );
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
    const ctx = makeCtx(
      makeResponse({
        headers: { 'set-cookie': 'session=abc123; Path=/' },
      }),
    );
    const result = await cookieAudit.run(ctx);
    expect(result.status).toBe('fail');
    expect(result.findings.some((f) => f.title.includes('Secure'))).toBe(true);
    expect(result.findings.some((f) => f.title.includes('HttpOnly'))).toBe(true);
    expect(result.findings.some((f) => f.title.includes('SameSite'))).toBe(true);
  });

  test('passes with secure cookies', async () => {
    const ctx = makeCtx(
      makeResponse({
        headers: { 'set-cookie': 'session=abc123; Secure; HttpOnly; SameSite=Strict; Path=/' },
      }),
    );
    const result = await cookieAudit.run(ctx);
    expect(result.status).toBe('pass');
  });
});

describe('api-key-exposure check', () => {
  test('detects high-signal API keys in public response bodies', async () => {
    const fakeOpenAiKey = `sk-proj-${'1234567890abcdefghijklmnop'}`;
    const fakeGitHubToken = ['ghp', '1234567890abcdefghijklmnopqrstuv'].join('_');
    const ctx = makeCtx(
      makeResponse({
        body: JSON.stringify({
          leaked: fakeOpenAiKey,
          github: fakeGitHubToken,
        }),
      }),
    );

    const result = await apiKeyExposure.run(ctx);

    expect(result.status).toBe('fail');
    expect(result.findings.some((finding) => finding.title.includes('OpenAI API key'))).toBe(true);
    expect(result.findings.some((finding) => finding.title.includes('GitHub token'))).toBe(true);
    expect(result.findings.every((finding) => !finding.evidence.includes('1234567890abcdefghijklmnop'))).toBe(true);
  });

  test('detects secrets leaked in response headers', async () => {
    const fakeStripeKey = ['sk', 'live', '1234567890abcdefghijklmnop'].join('_');
    const ctx = makeCtx(
      makeResponse({
        headers: {
          'x-stripe-debug': fakeStripeKey,
        },
      }),
    );

    const result = await apiKeyExposure.run(ctx);

    expect(result.status).toBe('fail');
    expect(result.findings.some((finding) => finding.title.includes('Stripe secret key'))).toBe(true);
    expect(result.findings[0]?.severity).toBe('critical');
  });

  test('passes when public responses do not contain key-like secrets', async () => {
    const ctx = makeCtx(
      makeResponse({
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ success: true, message: 'clean response' }),
      }),
    );

    const result = await apiKeyExposure.run(ctx);

    expect(result.status).toBe('pass');
    expect(result.findings).toHaveLength(0);
  });
});

describe('csp-deep-audit check', () => {
  test('skips when no CSP header is present', async () => {
    const ctx = makeCtx(makeResponse({ headers: {} }));
    const result = await cspDeepAudit.run(ctx);
    expect(result.status).toBe('skipped');
    expect(result.findings).toHaveLength(0);
  });

  test('detects unsafe script directives and weak framing policy', async () => {
    const ctx = makeCtx(
      makeResponse({
        headers: {
          'content-security-policy':
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; frame-ancestors *",
        },
      }),
    );
    const result = await cspDeepAudit.run(ctx);

    expect(result.status).toBe('fail');
    expect(result.findings.some((finding) => finding.title.includes('inline script execution'))).toBe(true);
    expect(result.findings.some((finding) => finding.title.includes('eval-style script execution'))).toBe(true);
    expect(result.findings.some((finding) => finding.title.includes('overly broad'))).toBe(true);
    expect(result.findings.some((finding) => finding.title.includes('plugin/object execution'))).toBe(true);
    expect(result.findings.some((finding) => finding.title.includes('framing policy'))).toBe(true);
  });

  test('passes with a strict CSP profile', async () => {
    const ctx = makeCtx(
      makeResponse({
        headers: {
          'content-security-policy':
            "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
        },
      }),
    );
    const result = await cspDeepAudit.run(ctx);

    expect(result.status).toBe('pass');
    expect(result.findings).toHaveLength(0);
  });
});

describe('error-disclosure check', () => {
  test('detects stack traces in error response', async () => {
    const ctx = makeCtx(
      makeResponse({
        status: 500,
        body: 'Error: Something went wrong\n  at Function (/app/src/handler.ts:42:10)\n  at Layer.handle',
      }),
    );
    const result = await errorDisclosure.run(ctx);
    expect(result.findings.some((f) => f.title.includes('Stack trace'))).toBe(true);
  });

  test('passes with clean error responses', async () => {
    const ctx = makeCtx(
      makeResponse({
        status: 404,
        body: '{"error":"Not found"}',
      }),
    );
    const result = await errorDisclosure.run(ctx);
    expect(result.status).toBe('pass');
  });
});
