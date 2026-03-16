import { describe, test, expect } from 'bun:test';
import { signJwt, verifyJwt } from '../src/utils/jwt';

const TEST_SECRET = 'test-secret-key-for-unit-tests';

describe('JWT', () => {
  test('signJwt produces a valid 3-part token', async () => {
    const token = await signJwt({ sub: 'user-1', email: 'test@example.com' }, TEST_SECRET);
    expect(token.split('.')).toHaveLength(3);
  });

  test('verifyJwt validates a token signed with same secret', async () => {
    const token = await signJwt({ sub: 'user-1', email: 'test@example.com', name: 'Test' }, TEST_SECRET);
    const payload = await verifyJwt(token, TEST_SECRET);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe('user-1');
    expect(payload!.email).toBe('test@example.com');
    expect(payload!.name).toBe('Test');
    expect(payload!.iat).toBeGreaterThan(0);
    expect(payload!.exp).toBeGreaterThan(payload!.iat);
  });

  test('verifyJwt rejects token signed with different secret', async () => {
    const token = await signJwt({ sub: 'user-1', email: 'test@example.com' }, TEST_SECRET);
    const payload = await verifyJwt(token, 'wrong-secret');
    expect(payload).toBeNull();
  });

  test('verifyJwt rejects tampered token', async () => {
    const token = await signJwt({ sub: 'user-1', email: 'test@example.com' }, TEST_SECRET);
    const parts = token.split('.');
    // Tamper payload
    const tampered = `${parts[0]}.${btoa('{"sub":"admin","email":"hack@evil.com","iat":1,"exp":9999999999}').replace(/=/g, '')}.${parts[2]}`;
    const payload = await verifyJwt(tampered, TEST_SECRET);
    expect(payload).toBeNull();
  });

  test('verifyJwt rejects malformed tokens', async () => {
    expect(await verifyJwt('not-a-jwt', TEST_SECRET)).toBeNull();
    expect(await verifyJwt('a.b', TEST_SECRET)).toBeNull();
    expect(await verifyJwt('', TEST_SECRET)).toBeNull();
  });
});
