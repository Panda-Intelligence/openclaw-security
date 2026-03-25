import { describe, expect, test } from 'bun:test';
import {
  INTELLIGENCE_META_KEYS,
  getStoredIntelligenceOverview,
  refreshIntelligenceCache,
} from '../src/intelligence-store';

type Row = Record<string, unknown>;

function createIntelligenceDb(options: {
  meta?: Record<string, string>;
  versionImpactCounts?: Record<string, number>;
  communityReports?: Row[];
  topIssue?: Row | null;
  recentLowScoreCount?: number;
} = {}) {
  const meta = new Map(Object.entries(options.meta ?? {}));
  const statements: Array<{ sql: string; binds: unknown[] }> = [];

  return {
    meta,
    statements,
    prepare(sql: string) {
      let binds: unknown[] = [];
      const statement = {
        bind: (...args: unknown[]) => {
          binds = args;
          statements.push({ sql, binds: [...args] });
          return statement;
        },
        first: async () => {
          if (sql.includes('FROM app_meta WHERE key = ?')) {
            const key = String(binds[0] ?? '');
            return meta.has(key) ? ({ value: meta.get(key) } satisfies Row) : null;
          }
          if (sql.includes('FROM findings')) {
            return options.topIssue ?? null;
          }
          if (sql.includes("WHERE uploaded_at >= date('now', '-30 days') AND score < 60")) {
            return { count: options.recentLowScoreCount ?? 0 } satisfies Row;
          }
          return null;
        },
        all: async () => {
          if (sql.includes('GROUP BY platform_version')) {
            return {
              results: Object.entries(options.versionImpactCounts ?? {}).map(
                ([version, count]) => ({ version, count }) satisfies Row,
              ),
            };
          }
          if (sql.includes('SELECT score, severity_counts, finding_count FROM community_reports')) {
            return { results: options.communityReports ?? [] };
          }
          return { results: [] as Row[] };
        },
        run: async () => {
          if (sql.includes('INSERT INTO app_meta')) {
            meta.set(String(binds[0] ?? ''), String(binds[1] ?? ''));
          }
          return { success: true };
        },
      };
      return statement;
    },
  };
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

describe('intelligence store', () => {
  test('falls back to the static overview when no cached intelligence snapshot exists', async () => {
    const db = createIntelligenceDb({ versionImpactCounts: { '0.1.0': 2 } });

    const overview = await getStoredIntelligenceOverview(db as unknown as D1Database);

    expect(overview.sources.length).toBeGreaterThan(0);
    expect(overview.versionAdvisories.find((item) => item.name === 'Version 0.1.0')?.signal).toContain(
      'Community reports: 2 deployments',
    );
    expect(overview.communitySignals).toEqual([]);
  });

  test('aggregates anonymous community reports into threat signals', async () => {
    const db = createIntelligenceDb({
      communityReports: [
        {
          score: 42,
          severity_counts: JSON.stringify({ critical: 1, high: 2, medium: 1 }),
          finding_count: 4,
        },
        {
          score: 81,
          severity_counts: JSON.stringify({ high: 1, low: 3 }),
          finding_count: 4,
        },
      ],
      topIssue: {
        check_id: 'cors-misconfig',
        title: 'CORS allows wildcard origin with credentials',
        severity: 'high',
        count: 3,
      },
      recentLowScoreCount: 1,
    });

    const overview = await getStoredIntelligenceOverview(db as unknown as D1Database);

    expect(overview.communitySignals).toHaveLength(3);
    expect(overview.communitySignals[0]).toEqual({
      name: 'Anonymous deployment severity concentration',
      risk: 'critical',
      summary:
        'Anonymous community submissions currently include 1 critical and 3 high findings across 2 deployments.',
      signal: 'Affected reports: 2/2 · Total findings logged: 8',
    });
    expect(overview.communitySignals[1]?.name).toContain('cors-misconfig');
    expect(overview.communitySignals[2]?.signal).toContain('Last 30 days below 60: 1');
  });

  test('refreshIntelligenceCache stores snapshot/feed metadata and returns merged overview', async () => {
    const db = createIntelligenceDb({ versionImpactCounts: { '2026.3.24': 4 } });

    const fetchMock: typeof fetch = async (input, init) => {
      const url = String(input);

      if (url.includes('/releases')) {
        return jsonResponse([
          {
            name: 'OpenClaw 2026.3.24',
            tag_name: 'v2026.3.24',
            prerelease: false,
            published_at: '2026-03-24T10:00:00Z',
            html_url: 'https://github.com/openclaw/openclaw/releases/tag/v2026.3.24',
            body: 'Stable release',
          },
        ]);
      }

      if (url.includes('/commits')) {
        return jsonResponse([
          {
            sha: 'abcdef1234567890',
            html_url: 'https://github.com/openclaw/openclaw/commit/abcdef1234567890',
            commit: {
              author: { date: '2026-03-24T11:00:00Z' },
              message: 'fix: close advisory gap',
            },
          },
        ]);
      }

      if (url.includes('api.osv.dev')) {
        const payload = JSON.parse(String(init?.body)) as { version: string };
        expect(payload.version).toBe('v2026.3.24');

        return jsonResponse({
          vulns: [
            {
              id: 'OSV-2026-4000',
              aliases: ['CVE-2026-4000'],
              summary: 'Privilege escalation in plugin bridge',
              affected: [
                {
                  database_specific: { severity: 'high' },
                  ranges: [{ events: [{ fixed: '2026.3.25' }] }],
                },
              ],
              references: [{ type: 'ADVISORY', url: 'https://osv.dev/OSV-2026-4000' }],
            },
          ],
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const overview = await refreshIntelligenceCache(db as unknown as D1Database, fetchMock);
    const storedOverview = await getStoredIntelligenceOverview(db as unknown as D1Database);

    expect(db.meta.get(INTELLIGENCE_META_KEYS.upstreamSnapshot)).toBeTruthy();
    expect(db.meta.get(INTELLIGENCE_META_KEYS.advisoryFeed)).toBeTruthy();
    expect(db.meta.get(INTELLIGENCE_META_KEYS.refreshedAt)).toBeTruthy();
    expect(db.meta.get(INTELLIGENCE_META_KEYS.refreshError)).toBe('');
    expect(overview.releases[0]?.version).toBe('2026.3.24');
    expect(overview.versionAdvisories.find((item) => item.name === 'Version 2026.3.24')?.signal).toContain(
      'Community reports: 4 deployments',
    );
    expect(
      storedOverview.versionAdvisories.find((item) => item.name === 'Version 2026.3.24')?.signal,
    ).toContain('CVE-2026-4000');
  });
});
