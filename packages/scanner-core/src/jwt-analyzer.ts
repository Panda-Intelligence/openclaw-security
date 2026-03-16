export interface JwtHeader {
  alg?: string;
  typ?: string;
  kid?: string;
  [key: string]: unknown;
}

export interface JwtPayload {
  sub?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  iss?: string;
  aud?: string | string[];
  jti?: string;
  email?: string;
  [key: string]: unknown;
}

export interface JwtParts {
  header: JwtHeader;
  payload: JwtPayload;
  signature: string;
}

/** Decode a JWT without verification (for auditing purposes). */
export function decodeJwt(token: string): JwtParts | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const header = JSON.parse(atob(parts[0]!.replace(/-/g, '+').replace(/_/g, '/'))) as JwtHeader;
    const payload = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;

    return { header, payload, signature: parts[2]! };
  } catch {
    return null;
  }
}

export function isExpired(payload: JwtPayload): boolean {
  if (typeof payload.exp !== 'number') return false;
  return Date.now() / 1000 > payload.exp;
}

export function getAlgorithm(header: JwtHeader): string {
  return header.alg ?? 'unknown';
}

const WEAK_ALGORITHMS = new Set(['none', 'HS256']);
const INSECURE_ALGORITHMS = new Set(['none']);

export function auditAlgorithm(alg: string): { secure: boolean; reason: string } {
  if (INSECURE_ALGORITHMS.has(alg)) {
    return { secure: false, reason: `Algorithm "${alg}" allows unsigned tokens` };
  }
  if (WEAK_ALGORITHMS.has(alg)) {
    return { secure: false, reason: `Algorithm "${alg}" is considered weak — prefer HS384+ or RS384+` };
  }
  return { secure: true, reason: 'Algorithm is acceptable' };
}

export function auditClaims(payload: JwtPayload): string[] {
  const issues: string[] = [];

  if (!payload.exp) issues.push('Missing expiration claim (exp)');
  if (!payload.sub) issues.push('Missing subject claim (sub)');
  if (!payload.iat) issues.push('Missing issued-at claim (iat)');

  if (typeof payload.exp === 'number' && typeof payload.iat === 'number') {
    const lifetimeHours = (payload.exp - payload.iat) / 3600;
    if (lifetimeHours > 24 * 30) {
      issues.push(`Token lifetime is ${Math.round(lifetimeHours / 24)} days — consider shorter expiry`);
    }
  }

  return issues;
}
