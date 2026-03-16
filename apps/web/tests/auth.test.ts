import { describe, test, expect } from 'bun:test';
import { signJwt } from '../src/utils/jwt';

const TEST_SECRET = 'test-secret-for-auth-utils';

// We can't easily test getAuthUser / ensureUser since they need D1,
// but we can test the exported OAuth state helpers by importing auth.ts
// indirectly. Instead, we replicate the HMAC signing logic to verify
// the state round-trip.

describe('OAuth state CSRF', () => {
  async function hmacSign(data: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function hmacVerify(data: string, sigHex: string, secret: string): Promise<boolean> {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sigBytes = new Uint8Array(sigHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
    return crypto.subtle.verify('HMAC', key, sigBytes.buffer as ArrayBuffer, new TextEncoder().encode(data));
  }

  test('HMAC round-trip: sign then verify succeeds', async () => {
    const data = JSON.stringify({ returnTo: '/dashboard', ts: Math.floor(Date.now() / 1000) });
    const sig = await hmacSign(data, TEST_SECRET);
    expect(await hmacVerify(data, sig, TEST_SECRET)).toBe(true);
  });

  test('HMAC rejects wrong secret', async () => {
    const data = JSON.stringify({ returnTo: '/dashboard', ts: Math.floor(Date.now() / 1000) });
    const sig = await hmacSign(data, TEST_SECRET);
    expect(await hmacVerify(data, sig, 'wrong-secret')).toBe(false);
  });

  test('HMAC rejects tampered data', async () => {
    const data = JSON.stringify({ returnTo: '/dashboard', ts: Math.floor(Date.now() / 1000) });
    const sig = await hmacSign(data, TEST_SECRET);
    const tampered = data.replace('/dashboard', '/evil');
    expect(await hmacVerify(tampered, sig, TEST_SECRET)).toBe(false);
  });

  test('state format: data.signature', async () => {
    const data = JSON.stringify({ returnTo: '/', ts: 123 });
    const sig = await hmacSign(data, TEST_SECRET);
    const state = `${data}.${sig}`;
    const dotIdx = state.lastIndexOf('.');
    expect(dotIdx).toBeGreaterThan(0);
    expect(state.slice(dotIdx + 1)).toBe(sig);
  });
});

describe('getAuthUser contract', () => {
  test('rejects request without Authorization header', async () => {
    // getAuthUser requires D1, but we can verify it returns null
    // when Authorization is missing by importing directly
    const { getAuthUser } = await import('../src/utils/auth');
    const request = new Request('https://example.com/api/test');
    const result = await getAuthUser(request, { JWT_SECRET: TEST_SECRET } as never);
    expect(result).toBeNull();
  });

  test('rejects request with invalid Bearer token', async () => {
    const { getAuthUser } = await import('../src/utils/auth');
    const request = new Request('https://example.com/api/test', {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    const result = await getAuthUser(request, { JWT_SECRET: TEST_SECRET } as never);
    expect(result).toBeNull();
  });

  test('accepts request with valid JWT', async () => {
    const { getAuthUser } = await import('../src/utils/auth');
    const token = await signJwt({ sub: 'user-1', email: 'test@example.com', name: 'Test' }, TEST_SECRET);
    const request = new Request('https://example.com/api/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await getAuthUser(request, { JWT_SECRET: TEST_SECRET } as never);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe('user-1');
    expect(result!.email).toBe('test@example.com');
  });

  test('rejects JWT signed with different secret', async () => {
    const { getAuthUser } = await import('../src/utils/auth');
    const token = await signJwt({ sub: 'user-1', email: 'test@example.com' }, 'other-secret');
    const request = new Request('https://example.com/api/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await getAuthUser(request, { JWT_SECRET: TEST_SECRET } as never);
    expect(result).toBeNull();
  });
});
