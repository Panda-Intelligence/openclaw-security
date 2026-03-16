import { Hono } from 'hono';
import type { Env } from '../worker';

export const reportRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// GET /api/reports/:scanId — get full report with findings
reportRoutes.get('/:scanId', async (c) => {
  const scanId = c.req.param('scanId');
  const userId = c.get('userId');

  const scan = await c.env.DB.prepare(`SELECT * FROM scans WHERE id = ?`).bind(scanId).first();

  if (!scan) {
    return c.json({ success: false, error: 'Scan not found' }, 404);
  }

  // Authorization: if scan belongs to a user, only that user may access it
  const scanUserId = scan['user_id'] as string | null;
  if (scanUserId && scanUserId !== userId) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }

  const findings = await c.env.DB.prepare(
    `SELECT * FROM findings WHERE scan_id = ? ORDER BY
      CASE severity
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
        WHEN 'info' THEN 4
      END`,
  )
    .bind(scanId)
    .all();

  return c.json({
    success: true,
    data: {
      ...scan,
      severity_counts: JSON.parse((scan['severity_counts'] as string) ?? '{}'),
      platform_info: JSON.parse((scan['platform_info'] as string) ?? '{}'),
      findings: findings.results,
    },
  });
});
