import type { AuthUser } from '../types';
import { verifyJwt } from './jwt';

export interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}

const DEV_SECRET = 'openclaw-security-dev-secret-do-not-use-in-prod';

export async function getAuthUser(request: Request, env: Env): Promise<AuthUser | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const secret = env.JWT_SECRET ?? DEV_SECRET;

  if (!env.JWT_SECRET) {
    console.warn('JWT_SECRET not set — using dev fallback. Do not use in production.');
  }

  const payload = await verifyJwt(token, secret);
  if (!payload) return null;

  return {
    userId: payload.sub,
    email: payload.email,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
  };
}

export async function ensureUser(
  id: string,
  email: string,
  name: string | null,
  picture: string | null,
  db: D1Database,
): Promise<void> {
  // Upsert user
  await db
    .prepare(
      `INSERT INTO users (id, email, name, picture)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET email = ?, name = ?, picture = ?, updated_at = datetime('now')`,
    )
    .bind(id, email, name, picture, email, name, picture)
    .run();

  // Ensure free subscription exists
  const sub = await db.prepare(`SELECT id FROM subscriptions WHERE user_id = ?`).bind(id).first();
  if (!sub) {
    await db
      .prepare(
        `INSERT INTO subscriptions (id, user_id, plan, status)
         VALUES (?, ?, 'free', 'active')`,
      )
      .bind(crypto.randomUUID(), id)
      .run();
  }
}
