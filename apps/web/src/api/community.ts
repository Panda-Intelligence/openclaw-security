import { Hono } from 'hono';
import type { Env } from '../worker.js';

export const communityRoutes = new Hono<{ Bindings: Env }>();

// POST /api/community — submit anonymous report
communityRoutes.post('/', async (c) => {
  const body = await c.req.json<{
    targetHost: string;
    score: number;
    severityCounts: Record<string, number>;
    findingCount: number;
    platformVersion?: string;
  }>();

  if (!body.targetHost || body.score === undefined) {
    return c.json({ success: false, error: 'targetHost and score are required' }, 400);
  }

  const id = crypto.randomUUID();
  const scanId = crypto.randomUUID(); // anonymous reference

  await c.env.DB.prepare(
    `INSERT INTO community_reports (id, scan_id, target_host, score, severity_counts, finding_count, platform_version)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      scanId,
      body.targetHost,
      body.score,
      JSON.stringify(body.severityCounts),
      body.findingCount,
      body.platformVersion ?? null,
    )
    .run();

  return c.json({ success: true, data: { id } }, 201);
});

// GET /api/community — list community reports
communityRoutes.get('/', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50'), 200);
  const result = await c.env.DB.prepare(
    `SELECT id, target_host, score, severity_counts, finding_count, platform_version, uploaded_at
     FROM community_reports ORDER BY uploaded_at DESC LIMIT ?`,
  )
    .bind(limit)
    .all();

  const data = result.results.map((r) => ({
    ...r,
    severity_counts: JSON.parse((r.severity_counts as string) ?? '{}'),
  }));

  return c.json({ success: true, data });
});

// GET /api/community/stats — aggregate stats
communityRoutes.get('/stats', async (c) => {
  const total = await c.env.DB.prepare(
    `SELECT COUNT(*) as count, AVG(score) as avg_score FROM community_reports`,
  ).first();

  return c.json({
    success: true,
    data: {
      totalReports: total?.count ?? 0,
      averageScore: Math.round((total?.avg_score as number) ?? 0),
    },
  });
});
