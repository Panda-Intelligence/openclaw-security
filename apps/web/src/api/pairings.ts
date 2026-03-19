import { Hono } from 'hono';
import type { Env } from '../worker';
import { encrypt, decrypt } from '../utils/crypto';
import { validateBody, createPairingSchema, refreshPairingSchema } from '../middleware/validate';

const DEV_ENCRYPTION_KEY = 'a'.repeat(64);

function getEncryptionKey(env: Env): string {
  return env.PAIRING_ENCRYPTION_KEY ?? DEV_ENCRYPTION_KEY;
}

/** Decode JWT payload without verifying signature (we verify by calling the target API). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    if (!payload) return null;
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const pairingRoutes = new Hono<{ Bindings: Env; Variables: { userId: string; validatedBody: unknown } }>();

// POST /api/pairings — create a new pairing
pairingRoutes.post('/', validateBody(createPairingSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.get('validatedBody') as { projectId: string; token: string };

  // Verify project ownership
  const project = await c.env.DB.prepare(`SELECT id, target_url FROM projects WHERE id = ? AND user_id = ?`)
    .bind(body.projectId, userId)
    .first();
  if (!project) return c.json({ success: false, error: 'Project not found' }, 404);

  // Check for existing active pairing
  const existing = await c.env.DB.prepare(
    `SELECT id FROM pairings WHERE project_id = ? AND status = 'active'`,
  )
    .bind(body.projectId)
    .first();
  if (existing) {
    return c.json({ success: false, error: 'An active pairing already exists for this project. Revoke it first.' }, 409);
  }

  // Verify the token against the target instance
  const targetUrl = (project['target_url'] as string).replace(/\/+$/, '');
  let targetEmail: string | null = null;
  let targetTenantId: string | null = null;

  try {
    const resp = await fetch(`${targetUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${body.token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (resp.status !== 200) {
      return c.json({ success: false, error: 'Token verification failed: target returned non-200 status' }, 422);
    }
    const data = (await resp.json()) as { data?: { tenantId?: string; email?: string } };
    targetEmail = data.data?.email ?? null;
    targetTenantId = data.data?.tenantId ?? null;
  } catch {
    return c.json({ success: false, error: 'Token verification failed: could not reach target instance' }, 422);
  }

  // Extract expiry from JWT payload
  const payload = decodeJwtPayload(body.token);
  const exp = payload?.['exp'] as number | undefined;
  const expiresAt = exp ? new Date(exp * 1000).toISOString() : null;

  // Encrypt and store
  const key = getEncryptionKey(c.env);
  const { ciphertext, iv } = await encrypt(body.token, key);

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO pairings (id, project_id, user_id, encrypted_token, iv, status, target_email, target_tenant_id, verified_at, expires_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, datetime('now'), ?)`,
  )
    .bind(id, body.projectId, userId, ciphertext, iv, targetEmail, targetTenantId, expiresAt)
    .run();

  const now = new Date().toISOString();

  return c.json({
    success: true,
    data: {
      id,
      project_id: body.projectId,
      label: '',
      status: 'active',
      target_email: targetEmail,
      target_tenant_id: targetTenantId,
      verified_at: now,
      last_used_at: null,
      expires_at: expiresAt,
      error_message: null,
      created_at: now,
      updated_at: now,
    },
  }, 201);
});

// GET /api/pairings?projectId=X — list pairings for a project
pairingRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.query('projectId');

  if (projectId) {
    const project = await c.env.DB.prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ?`)
      .bind(projectId, userId)
      .first();
    if (!project) return c.json({ success: false, error: 'Project not found' }, 404);
  }

  const result = projectId
    ? await c.env.DB.prepare(
        `SELECT id, project_id, label, status, target_email, target_tenant_id,
                verified_at, last_used_at, expires_at, error_message, created_at, updated_at
         FROM pairings WHERE project_id = ? AND user_id = ?
         ORDER BY created_at DESC`,
      )
        .bind(projectId, userId)
        .all()
    : await c.env.DB.prepare(
        `SELECT id, project_id, label, status, target_email, target_tenant_id,
                verified_at, last_used_at, expires_at, error_message, created_at, updated_at
         FROM pairings WHERE user_id = ?
         ORDER BY created_at DESC`,
      )
        .bind(userId)
        .all();

  return c.json({ success: true, data: result.results });
});

// GET /api/pairings/:id — get single pairing
pairingRoutes.get('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const pairing = await c.env.DB.prepare(
    `SELECT id, project_id, label, status, target_email, target_tenant_id,
            verified_at, last_used_at, expires_at, error_message, created_at, updated_at
     FROM pairings WHERE id = ? AND user_id = ?`,
  )
    .bind(id, userId)
    .first();

  if (!pairing) return c.json({ success: false, error: 'Pairing not found' }, 404);
  return c.json({ success: true, data: pairing });
});

// POST /api/pairings/:id/verify — re-verify a pairing
pairingRoutes.post('/:id/verify', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const pairing = await c.env.DB.prepare(
    `SELECT id, project_id, encrypted_token, iv, status FROM pairings WHERE id = ? AND user_id = ?`,
  )
    .bind(id, userId)
    .first();
  if (!pairing) return c.json({ success: false, error: 'Pairing not found' }, 404);

  // Decrypt the stored token
  const key = getEncryptionKey(c.env);
  let token: string;
  try {
    token = await decrypt(pairing['encrypted_token'] as string, pairing['iv'] as string, key);
  } catch {
    await c.env.DB.prepare(
      `UPDATE pairings SET status = 'error', error_message = 'Decryption failed', updated_at = datetime('now') WHERE id = ?`,
    ).bind(id).run();
    return c.json({ success: true, data: { id, status: 'error', verifiedAt: null, expiresAt: null } });
  }

  // Get the project's target_url
  const project = await c.env.DB.prepare(`SELECT target_url FROM projects WHERE id = ?`)
    .bind(pairing['project_id'] as string)
    .first();
  if (!project) {
    return c.json({ success: false, error: 'Associated project not found' }, 404);
  }

  const targetUrl = (project['target_url'] as string).replace(/\/+$/, '');

  try {
    const resp = await fetch(`${targetUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (resp.status === 200) {
      const data = (await resp.json()) as { data?: { tenantId?: string; email?: string } };
      const payload = decodeJwtPayload(token);
      const exp = payload?.['exp'] as number | undefined;
      const expiresAt = exp ? new Date(exp * 1000).toISOString() : null;

      await c.env.DB.prepare(
        `UPDATE pairings SET status = 'active', target_email = ?, target_tenant_id = ?,
         verified_at = datetime('now'), expires_at = ?, error_message = NULL, updated_at = datetime('now')
         WHERE id = ?`,
      )
        .bind(data.data?.email ?? null, data.data?.tenantId ?? null, expiresAt, id)
        .run();

      return c.json({ success: true, data: { id, status: 'active', verifiedAt: new Date().toISOString(), expiresAt } });
    }

    // Token no longer valid
    await c.env.DB.prepare(
      `UPDATE pairings SET status = 'expired', error_message = 'Token rejected by target', updated_at = datetime('now') WHERE id = ?`,
    ).bind(id).run();
    return c.json({ success: true, data: { id, status: 'expired', verifiedAt: null, expiresAt: null } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await c.env.DB.prepare(
      `UPDATE pairings SET status = 'error', error_message = ?, updated_at = datetime('now') WHERE id = ?`,
    ).bind(msg, id).run();
    return c.json({ success: true, data: { id, status: 'error', verifiedAt: null, expiresAt: null } });
  }
});

// POST /api/pairings/:id/refresh — replace the token
pairingRoutes.post('/:id/refresh', validateBody(refreshPairingSchema), async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = c.get('validatedBody') as { token: string };

  const pairing = await c.env.DB.prepare(
    `SELECT id, project_id, label, created_at, last_used_at FROM pairings WHERE id = ? AND user_id = ?`,
  )
    .bind(id, userId)
    .first();
  if (!pairing) return c.json({ success: false, error: 'Pairing not found' }, 404);

  // Get project target_url
  const project = await c.env.DB.prepare(`SELECT target_url FROM projects WHERE id = ?`)
    .bind(pairing['project_id'] as string)
    .first();
  if (!project) return c.json({ success: false, error: 'Associated project not found' }, 404);

  const targetUrl = (project['target_url'] as string).replace(/\/+$/, '');

  // Verify the new token
  let targetEmail: string | null = null;
  let targetTenantId: string | null = null;

  try {
    const resp = await fetch(`${targetUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${body.token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (resp.status !== 200) {
      return c.json({ success: false, error: 'Token verification failed' }, 422);
    }
    const data = (await resp.json()) as { data?: { tenantId?: string; email?: string } };
    targetEmail = data.data?.email ?? null;
    targetTenantId = data.data?.tenantId ?? null;
  } catch {
    return c.json({ success: false, error: 'Could not reach target instance' }, 422);
  }

  // Extract expiry
  const payload = decodeJwtPayload(body.token);
  const exp = payload?.['exp'] as number | undefined;
  const expiresAt = exp ? new Date(exp * 1000).toISOString() : null;

  // Encrypt and update
  const key = getEncryptionKey(c.env);
  const { ciphertext, iv } = await encrypt(body.token, key);

  await c.env.DB.prepare(
    `UPDATE pairings SET encrypted_token = ?, iv = ?, status = 'active',
     target_email = ?, target_tenant_id = ?, verified_at = datetime('now'),
     expires_at = ?, error_message = NULL, updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(ciphertext, iv, targetEmail, targetTenantId, expiresAt, id)
    .run();

  const now = new Date().toISOString();

  return c.json({
    success: true,
    data: {
      id,
      project_id: pairing['project_id'] as string,
      label: (pairing['label'] as string | null) ?? '',
      status: 'active',
      target_email: targetEmail,
      target_tenant_id: targetTenantId,
      verified_at: now,
      last_used_at: (pairing['last_used_at'] as string | null) ?? null,
      expires_at: expiresAt,
      error_message: null,
      created_at: (pairing['created_at'] as string | null) ?? now,
      updated_at: now,
    },
  });
});

// DELETE /api/pairings/:id — revoke a pairing
pairingRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const pairing = await c.env.DB.prepare(`SELECT id FROM pairings WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .first();
  if (!pairing) return c.json({ success: false, error: 'Pairing not found' }, 404);

  await c.env.DB.prepare(
    `UPDATE pairings SET status = 'revoked', updated_at = datetime('now') WHERE id = ?`,
  ).bind(id).run();

  return c.json({ success: true });
});
