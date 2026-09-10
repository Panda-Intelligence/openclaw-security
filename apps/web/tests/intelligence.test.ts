import { describe, expect, test } from 'bun:test';
import {
  getLatestVersion,
  getVersionDatabase,
  type OpenClawUpstreamSnapshot,
  type VersionEntry,
} from '@panda-ai/ocs-core';
import { buildIntelligenceOverview, getIntelligenceOverview } from '../src/intelligence';

describe('intelligence overview', () => {
  test('tracks the latest stable OpenClaw release from the shared upstream snapshot', () => {
    const overview = getIntelligenceOverview();
    expect(overview.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(overview.releases[0]?.version).toBe(getLatestVersion());
    expect(overview.sources[0]?.note).toContain(getLatestVersion());
  });

  test('includes recent main branch activity in release watch', () => {
    const overview = getIntelligenceOverview();
    expect(overview.releases.some((item) => item.posture === 'Recent main branch activity')).toBe(true);
  });

  test('includes version advisory intelligence derived from the shared version database', () => {
    const overview = getIntelligenceOverview();
    const versionDatabase = getVersionDatabase();

    expect(overview.versionAdvisories.length).toBeGreaterThan(0);
    expect(overview.versionAdvisories.some((item) => item.name.includes('Version 0.1.0'))).toBe(true);
    expect(overview.versionAdvisories.some((item) => item.name.includes(getLatestVersion()))).toBe(true);
    expect(versionDatabase.some((entry) => entry.cves.length > 0 || entry.eol)).toBe(true);
  });

  test('supports injected upstream data and community version impact counts', () => {
    const upstreamSnapshot: OpenClawUpstreamSnapshot = {
      capturedAt: '2026-03-25T10:00:00Z',
      repository: 'openclaw/openclaw',
      latestStableVersion: '2026.3.24',
      latestStableTag: 'v2026.3.24',
      releases: [
        {
          version: '2026.3.24',
          tag: 'v2026.3.24',
          publishedAt: '2026-03-24T10:00:00Z',
          url: 'https://github.com/openclaw/openclaw/releases/tag/v2026.3.24',
          prerelease: false,
          summary: 'Stable release',
        },
      ],
      recentCommits: [
        {
          sha: 'abcdef1',
          date: '2026-03-25T09:00:00Z',
          message: 'fix: harden registry validation',
          url: 'https://github.com/openclaw/openclaw/commit/abcdef1',
        },
      ],
    };
    const versionDatabase: VersionEntry[] = [
      {
        version: '2026.3.24',
        releaseDate: '2026-03-24',
        cves: [
          {
            id: 'CVE-2026-3000',
            severity: 'high',
            description: 'Runtime token exposure',
            fixedIn: '2026.3.25',
          },
        ],
      },
    ];

    const overview = buildIntelligenceOverview({
      upstreamSnapshot,
      versionDatabase,
      versionImpactCounts: { '2026.3.24': 3 },
      communitySignals: [
        {
          name: 'Most repeated issue: cors-misconfig',
          risk: 'high',
          summary: 'Wildcard CORS remains the top repeated anonymous issue.',
          signal: 'Seen 3 times · Severity high',
        },
      ],
      capturedAt: '2026-03-25T11:00:00Z',
    });

    expect(overview.capturedAt).toBe('2026-03-25');
    expect(overview.releases[0]?.version).toBe('2026.3.24');
    expect(overview.sources[0]?.note).toContain('2026.3.24');
    expect(overview.communitySignals).toHaveLength(1);
    expect(overview.versionAdvisories.find((item) => item.name === 'Version 2026.3.24')?.signal).toContain(
      'Community reports: 3 deployments',
    );
  });
});
