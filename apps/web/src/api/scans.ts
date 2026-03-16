import { Hono } from 'hono';
import type { Env } from '../worker';
import { handleScanQueue } from '../queue/scan-consumer';
import { validateBody, createScanSchema } from '../middleware/validate';
import { PLAN_LIMITS } from '../types';
import type { PlanTier } from '../types';

export const scanRoutes = new Hono<{ Bindings: Env; Variables: { userId: string; validatedBody: unknown } }>();

// POST /api/scans — create a new scan
scanRoutes.post('/', validateBody(createScanSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.get('validatedBody') as { targetUrl: string; mode: string; jwt?: string; projectId?: string };

  let url: URL;
  try {
    const raw = body.targetUrl.startsWith('http') ? body.targetUrl : `https://${body.targetUrl}`;
    url = new URL(raw);
  } catch {
    return c.json({ success: false, error: 'Invalid URL' }, 400);
  }

  // Quota check
  const sub = await c.env.DB.prepare(
    `SELECT plan FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(userId)
    .first();

  const plan = (sub?.['plan'] as PlanTier) ?? 'free';
  const limits = PLAN_LIMITS[plan];

  if (body.projectId) {
    // Verify project ownership
    const project = await c.env.DB.prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ?`)
      .bind(body.projectId, userId)
      .first();
    if (!project) return c.json({ success: false, error: 'Project not found' }, 404);

    // Check daily scan count for this project
    const todayCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM scans WHERE project_id = ? AND created_at >= date('now')`,
    )
      .bind(body.projectId)
      .first();

    const used = (todayCount?.['count'] as number) ?? 0;
    if (used >= limits.maxScansPerDayPerProject) {
      return c.json(
        {
          success: false,
          error: `Daily scan limit reached (${limits.maxScansPerDayPerProject}/day for ${plan} plan)`,
        },
        429,
      );
    }
  }

  const id = crypto.randomUUID();
  const mode = body.mode === 'active' ? 'active' : 'passive';

  await c.env.DB.prepare(
    `INSERT INTO scans (id, target_url, target_host, mode, status, user_id, project_id, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, datetime('now'))`,
  )
    .bind(id, url.toString(), url.host, mode, userId, body.projectId ?? null)
    .run();

  // Enqueue scan job, or run inline if Queue is unavailable (local dev)
  try {
    await c.env.SCAN_QUEUE.send({ scanId: id, jwt: body.jwt });
  } catch {
    handleScanQueue({ scanId: id, jwt: body.jwt }, c.env).catch(() => {});
  }

  return c.json({ success: true, data: { id, status: 'pending', targetUrl: url.toString(), mode } }, 201);
});

// GET /api/scans — list user's scans
scanRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.query('projectId');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);

  let query = `SELECT id, target_url, target_host, mode, status, score, severity_counts,
                      finding_count, project_id, created_at, completed_at
               FROM scans WHERE user_id = ?`;
  const binds: unknown[] = [userId];

  if (projectId) {
    query += ' AND project_id = ?';
    binds.push(projectId);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  binds.push(limit);

  const stmt = c.env.DB.prepare(query);
  const result = await stmt.bind(...binds).all();

  return c.json({ success: true, data: result.results });
});

// GET /api/scans/:id — get scan status
scanRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const result = await c.env.DB.prepare(`SELECT * FROM scans WHERE id = ?`).bind(id).first();

  if (!result) {
    return c.json({ success: false, error: 'Scan not found' }, 404);
  }

  // Authorization: if scan belongs to a user, only that user may access it
  const scanUserId = result['user_id'] as string | null;
  if (scanUserId && scanUserId !== userId) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }

  return c.json({ success: true, data: result });
});
