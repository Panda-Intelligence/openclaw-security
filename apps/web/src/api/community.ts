import { Hono } from 'hono';
import type { Env } from '../worker';

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
  const scanId = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO community_reports (id, scan_id, target_host, score, severity_counts, finding_count, platform_version)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, scanId, body.targetHost, body.score, JSON.stringify(body.severityCounts), body.findingCount, body.platformVersion ?? null)
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
    severity_counts: JSON.parse((r['severity_counts'] as string) ?? '{}'),
  }));

  return c.json({ success: true, data });
});

// GET /api/community/stats — enhanced aggregate stats
communityRoutes.get('/stats', async (c) => {
  const db = c.env.DB;

  // Basic totals
  const total = await db.prepare(`SELECT COUNT(*) as count, AVG(score) as avg_score FROM community_reports`).first();

  // Score distribution (5 buckets)
  const distResult = await db
    .prepare(
      `SELECT
        CASE
          WHEN score < 20 THEN '0-19'
          WHEN score < 40 THEN '20-39'
          WHEN score < 60 THEN '40-59'
          WHEN score < 80 THEN '60-79'
          ELSE '80-100'
        END as range,
        COUNT(*) as count
       FROM community_reports GROUP BY range ORDER BY range`,
    )
    .all();

  // Severity breakdown (aggregate across all reports)
  const allReports = await db.prepare(`SELECT severity_counts FROM community_reports`).all();
  const severityBreakdown: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const row of allReports.results) {
    try {
      const counts = JSON.parse((row['severity_counts'] as string) ?? '{}') as Record<string, number>;
      for (const [sev, n] of Object.entries(counts)) {
        severityBreakdown[sev] = (severityBreakdown[sev] ?? 0) + n;
      }
    } catch { /* skip malformed */ }
  }

  // Top issues (from findings table — most common check_id)
  const topIssues = await db
    .prepare(
      `SELECT check_id, COUNT(*) as count FROM findings GROUP BY check_id ORDER BY count DESC LIMIT 10`,
    )
    .all();

  // 30-day trend
  const trend = await db
    .prepare(
      `SELECT date(uploaded_at) as date, ROUND(AVG(score)) as avg_score, COUNT(*) as count
       FROM community_reports
       WHERE uploaded_at >= date('now', '-30 days')
       GROUP BY date(uploaded_at)
       ORDER BY date`,
    )
    .all();

  return c.json({
    success: true,
    data: {
      totalReports: total?.['count'] ?? 0,
      averageScore: Math.round((total?.['avg_score'] as number) ?? 0),
      scoreDistribution: distResult.results.map((r) => ({ range: r['range'] as string, count: r['count'] as number })),
      severityBreakdown,
      topIssues: topIssues.results.map((r) => ({ checkId: r['check_id'] as string, count: r['count'] as number })),
      trend: trend.results.map((r) => ({ date: r['date'] as string, avgScore: r['avg_score'] as number, count: r['count'] as number })),
    },
  });
});

// GET /api/community/leaderboard — top scoring deployments
communityRoutes.get('/leaderboard', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT target_host, MAX(score) as best_score, COUNT(*) as scan_count, MAX(uploaded_at) as last_scan
     FROM community_reports
     GROUP BY target_host
     ORDER BY best_score DESC
     LIMIT 20`,
  ).all();

  return c.json({ success: true, data: result.results });
});
