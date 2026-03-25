import { describe, expect, test } from 'bun:test';
import type { ScanResult } from '@panda-ai/ocs-core';
import { handleScanQueue } from '../src/queue/scan-consumer';

// Mock D1 database
function mockDb(scanRecord: Record<string, unknown> | null = null) {
  const statements: Array<{ sql: string; binds: unknown[] }> = [];

  return {
    prepare: (sql: string) => {
      const stmt = {
        binds: [] as unknown[],
        bind: (...args: unknown[]) => {
          stmt.binds = args;
          statements.push({ sql, binds: args });
          return stmt;
        },
        run: async () => ({ success: true }),
        first: async () => scanRecord,
        all: async () => ({ results: [] }),
      };
      return stmt;
    },
    _statements: statements,
  };
}

describe('scan-consumer', () => {
  test('handles missing scan record gracefully', async () => {
    const db = mockDb(null);
    const env = { DB: db as any, SCAN_QUEUE: {} as any, ASSETS: {} as any };

    // Should not throw
    await handleScanQueue({ scanId: 'nonexistent' }, env);
  });

  test('updates scan status to running then completed/failed', async () => {
    const scanRecord = {
      id: 'test-scan',
      target_url: 'https://example.com',
      mode: 'passive',
      status: 'pending',
    };
    const db = mockDb(scanRecord);
    const env = { DB: db as any, SCAN_QUEUE: {} as any, ASSETS: {} as any };
    const result: ScanResult = {
      targetUrl: 'https://example.com',
      scannedAt: '2026-03-25T00:00:00.000Z',
      durationMs: 42,
      score: 92,
      findings: [
        {
          id: 'finding-1',
          checkId: 'security-headers',
          title: 'Missing CSP',
          severity: 'medium',
          description: 'CSP header is missing.',
          evidence: 'content-security-policy: missing',
          recommendation: 'Add a strict CSP policy.',
          cweId: 'CWE-693',
        },
      ],
      severityCounts: {
        critical: 0,
        high: 0,
        medium: 1,
        low: 0,
        info: 0,
      },
      platformInfo: {
        platform: 'OpenClaw',
        version: '2026.3.23',
      },
      checkResults: [],
    };
    const runScan = async () => result;

    await handleScanQueue({ scanId: 'test-scan' }, env, runScan);

    const sqls = db._statements.map((s) => s.sql);
    expect(sqls.some((s) => s.includes("status = 'running'"))).toBe(true);
    expect(sqls.some((s) => s.includes("status = 'completed'"))).toBe(true);
    expect(sqls.some((s) => s.includes('INSERT INTO findings'))).toBe(true);
  });

  test('marks the scan as failed when the injected scan executor throws', async () => {
    const scanRecord = {
      id: 'failed-scan',
      target_url: 'https://example.com',
      mode: 'active',
      status: 'pending',
    };
    const db = mockDb(scanRecord);
    const env = { DB: db as any, SCAN_QUEUE: {} as any, ASSETS: {} as any };
    const runScan = async () => {
      throw new Error('stubbed scan failure');
    };

    await handleScanQueue({ scanId: 'failed-scan', jwt: 'token' }, env, runScan);

    const statements = db._statements;
    const sqls = statements.map((statement) => statement.sql);
    expect(sqls.some((sql) => sql.includes("status = 'running'"))).toBe(true);
    expect(sqls.some((sql) => sql.includes("status = 'failed'"))).toBe(true);
    expect(sqls.some((sql) => sql.includes('INSERT INTO findings'))).toBe(false);
    expect(
      statements.some(
        (statement) =>
          statement.sql.includes("status = 'failed'") && statement.binds.includes('stubbed scan failure'),
      ),
    ).toBe(true);
  });
});
