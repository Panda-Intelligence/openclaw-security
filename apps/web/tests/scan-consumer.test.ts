import { describe, test, expect } from 'bun:test';
import { handleScanQueue } from '../src/queue/scan-consumer.js';

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

    // This will try to fetch the real URL and fail, but should handle gracefully
    await handleScanQueue({ scanId: 'test-scan' }, env);

    // Check that status was updated (at least 'running' was set)
    const sqls = db._statements.map((s) => s.sql);
    expect(sqls.some((s) => s.includes("status = 'running'"))).toBe(true);
    // Should have either completed or failed
    expect(
      sqls.some((s) => s.includes("status = 'completed'") || s.includes("status = 'failed'"))
    ).toBe(true);
  });
});
