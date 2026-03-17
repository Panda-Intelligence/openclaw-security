import { describe, expect, test } from 'bun:test';
import { consumeAuthTokenFromUrl, getRouteFromPath } from '../pages/lib/auth-bootstrap';

describe('auth bootstrap helpers', () => {
  test('maps dashboard path correctly', () => {
    expect(getRouteFromPath('/app/dashboard')).toBe('dashboard');
  });

  test('consumes token from callback url before route is used', () => {
    let savedToken: string | null = null;
    const result = consumeAuthTokenFromUrl('/app/dashboard', '?token=test.jwt.value', (token) => {
      savedToken = token;
    });

    expect(savedToken).toBe('test.jwt.value');
    expect(result.consumedToken).toBe(true);
    expect(result.route).toBe('dashboard');
  });

  test('falls back to plain route when no token exists', () => {
    const result = consumeAuthTokenFromUrl('/community', '', () => {
      throw new Error('should not be called');
    });

    expect(result.consumedToken).toBe(false);
    expect(result.route).toBe('community');
  });
});
