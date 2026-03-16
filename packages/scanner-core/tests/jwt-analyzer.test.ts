import { beforeEach, describe, expect, test } from 'bun:test';
import { auditAlgorithm, auditClaims, decodeJwt, getAlgorithm, isExpired } from '../src/jwt-analyzer';

// Helper: create a base64url-encoded JWT
function makeJwt(header: object, payload: object): string {
  const b64url = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url(header)}.${b64url(payload)}.fake-signature`;
}

describe('decodeJwt', () => {
  test('decodes a valid JWT', () => {
    const jwt = makeJwt({ alg: 'HS256', typ: 'JWT' }, { sub: '123', exp: 9999999999 });
    const result = decodeJwt(jwt);
    expect(result).not.toBeNull();
    expect(result!.header.alg).toBe('HS256');
    expect(result!.payload.sub).toBe('123');
    expect(result!.signature).toBe('fake-signature');
  });

  test('returns null for invalid token', () => {
    expect(decodeJwt('not-a-jwt')).toBeNull();
    expect(decodeJwt('')).toBeNull();
    expect(decodeJwt('a.b')).toBeNull(); // only 2 parts
  });

  test('returns null for malformed base64', () => {
    expect(decodeJwt('!!!.!!!.!!!')).toBeNull();
  });
});

describe('isExpired', () => {
  test('returns false for future exp', () => {
    expect(isExpired({ exp: Math.floor(Date.now() / 1000) + 3600 })).toBe(false);
  });

  test('returns true for past exp', () => {
    expect(isExpired({ exp: Math.floor(Date.now() / 1000) - 3600 })).toBe(true);
  });

  test('returns false if no exp claim', () => {
    expect(isExpired({})).toBe(false);
  });
});

describe('getAlgorithm', () => {
  test('extracts algorithm', () => {
    expect(getAlgorithm({ alg: 'HS256' })).toBe('HS256');
    expect(getAlgorithm({ alg: 'RS512' })).toBe('RS512');
  });

  test('returns unknown for missing alg', () => {
    expect(getAlgorithm({})).toBe('unknown');
  });
});

describe('auditAlgorithm', () => {
  test('"none" is insecure', () => {
    const result = auditAlgorithm('none');
    expect(result.secure).toBe(false);
    expect(result.reason).toContain('unsigned');
  });

  test('HS256 is weak', () => {
    const result = auditAlgorithm('HS256');
    expect(result.secure).toBe(false);
    expect(result.reason).toContain('weak');
  });

  test('HS512 is acceptable', () => {
    const result = auditAlgorithm('HS512');
    expect(result.secure).toBe(true);
  });

  test('ES256 is acceptable', () => {
    const result = auditAlgorithm('ES256');
    expect(result.secure).toBe(true);
  });
});

describe('auditClaims', () => {
  test('no issues for complete claims', () => {
    const issues = auditClaims({
      sub: 'user-1',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    expect(issues).toHaveLength(0);
  });

  test('reports missing exp', () => {
    const issues = auditClaims({ sub: 'user-1', iat: 123 });
    expect(issues.some((i) => i.includes('exp'))).toBe(true);
  });

  test('reports missing sub', () => {
    const issues = auditClaims({ exp: 999, iat: 123 });
    expect(issues.some((i) => i.includes('sub'))).toBe(true);
  });

  test('reports missing iat', () => {
    const issues = auditClaims({ sub: 'x', exp: 999 });
    expect(issues.some((i) => i.includes('iat'))).toBe(true);
  });

  test('warns about very long token lifetime', () => {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 60 * 60 * 24 * 365; // 1 year
    const issues = auditClaims({ sub: 'x', iat, exp });
    expect(issues.some((i) => i.includes('lifetime'))).toBe(true);
  });

  test('no warning for reasonable lifetime', () => {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600; // 1 hour
    const issues = auditClaims({ sub: 'x', iat, exp });
    expect(issues).toHaveLength(0);
  });
});
