import { Hono } from 'hono';
import type { Env } from '../worker';

export const scanRoutes = new Hono<{ Bindings: Env }>();

// POST /api/scans — create a new scan
scanRoutes.post('/', async (c) => {
  const body = await c.req.json<{ targetUrl: string; mode?: string; jwt?: string }>();

  if (!body.targetUrl) {
    return c.json({ success: false, error: 'targetUrl is required' }, 400);
  }

  let url: URL;
  try {
    const raw = body.targetUrl.startsWith('http') ? body.targetUrl : `https://${body.targetUrl}`;
    url = new URL(raw);
  } catch {
    return c.json({ success: false, error: 'Invalid URL' }, 400);
  }

  const id = crypto.randomUUID();
  const mode = body.mode === 'active' ? 'active' : 'passive';

  await c.env.DB.prepare(
    `INSERT INTO scans (id, target_url, target_host, mode, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', datetime('now'))`,
  )
    .bind(id, url.toString(), url.host, mode)
    .run();

  // Enqueue scan job
  await c.env.SCAN_QUEUE.send({ scanId: id, jwt: body.jwt });

  return c.json(
    {
      success: true,
      data: { id, status: 'pending', targetUrl: url.toString(), mode },
    },
    201,
  );
});

// GET /api/scans — list recent scans
scanRoutes.get('/', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
  const result = await c.env.DB.prepare(
    `SELECT id, target_url, target_host, mode, status, score, severity_counts,
            finding_count, created_at, completed_at
     FROM scans ORDER BY created_at DESC LIMIT ?`,
  )
    .bind(limit)
    .all();

  return c.json({ success: true, data: result.results });
});

// GET /api/scans/:id — get scan status
scanRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare(`SELECT * FROM scans WHERE id = ?`).bind(id).first();

  if (!result) {
    return c.json({ success: false, error: 'Scan not found' }, 404);
  }

  return c.json({ success: true, data: result });
});
