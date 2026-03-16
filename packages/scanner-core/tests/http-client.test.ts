import { afterAll, describe, expect, test } from 'bun:test';
import { createHttpClient } from '../src/http-client';

const originalFetch = globalThis.fetch;

describe('createHttpClient', () => {
  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  test('GET request returns structured response', async () => {
    globalThis.fetch = async () =>
      new Response('hello', {
        status: 200,
        headers: { 'X-Custom': 'test' },
      });

    const client = createHttpClient();
    const resp = await client.get('https://example.com');

    expect(resp.status).toBe(200);
    expect(resp.body).toBe('hello');
    expect(resp.headers['x-custom']).toBe('test');
    expect(resp.durationMs).toBeGreaterThanOrEqual(0);
  });

  test('POST sends JSON body', async () => {
    let capturedBody: string | undefined;
    let capturedContentType: string | undefined;

    globalThis.fetch = async (_url: any, init: any) => {
      capturedBody = init?.body;
      capturedContentType = init?.headers?.['Content-Type'];
      return new Response('ok', { status: 201 });
    };

    const client = createHttpClient();
    await client.post('https://example.com/data', { key: 'value' });

    expect(capturedBody).toBe('{"key":"value"}');
    expect(capturedContentType).toBe('application/json');
  });

  test('attaches JWT when configured', async () => {
    let capturedAuth: string | undefined;

    globalThis.fetch = async (_url: any, init: any) => {
      capturedAuth = init?.headers?.Authorization;
      return new Response('', { status: 200 });
    };

    const client = createHttpClient({ jwt: 'my-token-123' });
    await client.get('https://example.com');

    expect(capturedAuth).toBe('Bearer my-token-123');
  });

  test('does not attach JWT when not configured', async () => {
    let capturedAuth: string | undefined;

    globalThis.fetch = async (_url: any, init: any) => {
      capturedAuth = init?.headers?.Authorization;
      return new Response('', { status: 200 });
    };

    const client = createHttpClient();
    await client.get('https://example.com');

    expect(capturedAuth).toBeUndefined();
  });

  test('custom headers are passed through', async () => {
    let capturedHeaders: Record<string, string> = {};

    globalThis.fetch = async (_url: any, init: any) => {
      capturedHeaders = init?.headers ?? {};
      return new Response('', { status: 200 });
    };

    const client = createHttpClient();
    await client.get('https://example.com', {
      headers: { 'X-Test': 'hello', Origin: 'https://foo.com' },
    });

    expect(capturedHeaders['X-Test']).toBe('hello');
    expect(capturedHeaders['Origin']).toBe('https://foo.com');
  });

  test('lowercases response headers', async () => {
    globalThis.fetch = async () =>
      new Response('', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', 'X-RateLimit-Limit': '100' },
      });

    const client = createHttpClient();
    const resp = await client.get('https://example.com');

    expect(resp.headers['content-type']).toBe('text/plain');
    expect(resp.headers['x-ratelimit-limit']).toBe('100');
  });

  test('OPTIONS method works', async () => {
    let capturedMethod: string | undefined;

    globalThis.fetch = async (_url: any, init: any) => {
      capturedMethod = init?.method;
      return new Response('', {
        status: 204,
        headers: { 'Access-Control-Allow-Methods': 'GET, POST' },
      });
    };

    const client = createHttpClient();
    const resp = await client.options('https://example.com');

    expect(capturedMethod).toBe('OPTIONS');
    expect(resp.status).toBe(204);
    expect(resp.headers['access-control-allow-methods']).toBe('GET, POST');
  });

  test('uses manual redirect when followRedirects=false', async () => {
    let capturedRedirect: string | undefined;

    globalThis.fetch = async (_url: any, init: any) => {
      capturedRedirect = init?.redirect;
      return new Response('', { status: 302, headers: { Location: '/new' } });
    };

    const client = createHttpClient();
    const resp = await client.get('https://example.com', { followRedirects: false });

    expect(capturedRedirect).toBe('manual');
    expect(resp.status).toBe(302);
  });

  test('uses default timeout', async () => {
    let usedSignal = false;

    globalThis.fetch = async (_url: any, init: any) => {
      usedSignal = !!init?.signal;
      return new Response('', { status: 200 });
    };

    const client = createHttpClient({ timeout: 5000 });
    await client.get('https://example.com');

    expect(usedSignal).toBe(true);
  });

  test('per-request timeout overrides default', async () => {
    let abortSignal: AbortSignal | undefined;

    globalThis.fetch = async (_url: any, init: any) => {
      abortSignal = init?.signal;
      return new Response('', { status: 200 });
    };

    const client = createHttpClient({ timeout: 30000 });
    await client.get('https://example.com', { timeout: 1000 });

    // The signal should exist (meaning a timeout was set)
    expect(abortSignal).toBeTruthy();
  });

  test('handles fetch errors', async () => {
    globalThis.fetch = async () => {
      throw new Error('Network error');
    };

    const client = createHttpClient();
    await expect(client.get('https://example.com')).rejects.toThrow('Network error');
  });
});
