import { Hono } from 'hono';
import type { Env } from '../worker';
import { validateBody, createProjectSchema } from '../middleware/validate';
import { PLAN_LIMITS } from '../types';
import type { PlanTier } from '../types';

export const projectRoutes = new Hono<{ Bindings: Env; Variables: { userId: string; validatedBody: unknown } }>();

// POST /api/projects
projectRoutes.post('/', validateBody(createProjectSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.get('validatedBody') as { name: string; targetUrl: string };

  // Check project quota
  const sub = await c.env.DB.prepare(
    `SELECT plan FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(userId)
    .first();

  const plan = (sub?.['plan'] as PlanTier) ?? 'free';
  const limits = PLAN_LIMITS[plan];

  const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM projects WHERE user_id = ?`).bind(userId).first();
  const currentCount = (countResult?.['count'] as number) ?? 0;

  if (currentCount >= limits.maxProjects) {
    return c.json({ success: false, error: `Project limit reached (${limits.maxProjects} for ${plan} plan)` }, 403);
  }

  const id = crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO projects (id, user_id, name, target_url) VALUES (?, ?, ?, ?)`)
    .bind(id, userId, body.name, body.targetUrl)
    .run();

  return c.json({ success: true, data: { id, name: body.name, targetUrl: body.targetUrl } }, 201);
});

// GET /api/projects
projectRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const result = await c.env.DB.prepare(
    `SELECT id, name, target_url, created_at FROM projects WHERE user_id = ? ORDER BY created_at DESC`,
  )
    .bind(userId)
    .all();

  return c.json({ success: true, data: result.results });
});

// DELETE /api/projects/:id
projectRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const project = await c.env.DB.prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ?`).bind(id, userId).first();
  if (!project) return c.json({ success: false, error: 'Project not found' }, 404);

  await c.env.DB.prepare(`DELETE FROM projects WHERE id = ?`).bind(id).run();
  return c.json({ success: true });
});
