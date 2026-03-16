import type { JwtPayload } from '../types';

const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' } as const;
const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function getKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey('raw', encoder.encode(secret), ALGORITHM, false, ['sign', 'verify']);
}

export async function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = { ...payload, iat: now, exp: now + JWT_EXPIRY_SECONDS };

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(fullPayload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await getKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const signingInput = `${parts[0]}.${parts[1]}`;
  const signature = base64UrlDecode(parts[2]!);

  const encoder = new TextEncoder();
  const key = await getKey(secret);
  const valid = await crypto.subtle.verify('HMAC', key, signature.buffer as ArrayBuffer, encoder.encode(signingInput));

  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1]!))) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
