import { scan } from '@openclaw-security/scanner-core';
import type { ScanConfig, ScanResult } from '@openclaw-security/scanner-core';
import type { Env } from '../worker.js';

export async function handleScanQueue(
  message: { scanId: string; jwt?: string },
  env: Env,
): Promise<void> {
  const { scanId, jwt } = message;

  // Get scan record
  const scanRecord = await env.DB.prepare(
    `SELECT * FROM scans WHERE id = ?`,
  )
    .bind(scanId)
    .first();

  if (!scanRecord) return;

  // Update status to running
  await env.DB.prepare(
    `UPDATE scans SET status = 'running', started_at = datetime('now') WHERE id = ?`,
  )
    .bind(scanId)
    .run();

  try {
    const config: ScanConfig = {
      targetUrl: scanRecord.target_url as string,
      mode: (scanRecord.mode as string) === 'active' ? 'active' : 'passive',
      jwt,
      timeout: 15000,
      concurrency: 5,
    };

    const result: ScanResult = await scan(config);

    // Store findings
    for (const finding of result.findings) {
      await env.DB.prepare(
        `INSERT INTO findings (id, scan_id, check_id, title, severity, description, evidence, recommendation, cwe_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          crypto.randomUUID(),
          scanId,
          finding.checkId,
          finding.title,
          finding.severity,
          finding.description,
          finding.evidence,
          finding.recommendation,
          finding.cweId ?? null,
        )
        .run();
    }

    // Update scan record
    await env.DB.prepare(
      `UPDATE scans SET
        status = 'completed',
        score = ?,
        severity_counts = ?,
        platform_info = ?,
        finding_count = ?,
        completed_at = datetime('now')
       WHERE id = ?`,
    )
      .bind(
        result.score,
        JSON.stringify(result.severityCounts),
        JSON.stringify(result.platformInfo),
        result.findings.length,
        scanId,
      )
      .run();
  } catch (err) {
    await env.DB.prepare(
      `UPDATE scans SET status = 'failed', error_message = ?, completed_at = datetime('now') WHERE id = ?`,
    )
      .bind(err instanceof Error ? err.message : 'Unknown error', scanId)
      .run();
  }
}
