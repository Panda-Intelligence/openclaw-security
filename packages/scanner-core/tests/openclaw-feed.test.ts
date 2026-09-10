import { describe, expect, test } from 'bun:test';
import {
  buildOpenClawUpstreamSnapshot,
  fetchOpenClawAdvisoryFeed,
  mergeVersionDatabaseWithAdvisories,
} from '../src/openclaw-feed';
import type { OpenClawUpstreamSnapshot } from '../src/openclaw-upstream';

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

describe('openclaw feed helpers', () => {
  test('buildOpenClawUpstreamSnapshot normalizes releases and recent commits from GitHub responses', async () => {
    const fetchMock: typeof fetch = async (input) => {
      const url = String(input);

      if (url.includes('/releases')) {
        return jsonResponse([
          {
            name: 'OpenClaw 2026.3.24',
            tag_name: 'v2026.3.24',
            prerelease: false,
            published_at: '2026-03-24T10:00:00Z',
            html_url: 'https://github.com/openclaw/openclaw/releases/tag/v2026.3.24',
            body: 'Latest stable cut\n- checksum refresh',
          },
          {
            name: null,
            tag_name: 'v2026.3.23-1',
            prerelease: false,
            published_at: '2026-03-23T10:00:00Z',
            html_url: 'https://github.com/openclaw/openclaw/releases/tag/v2026.3.23-1',
            body: null,
          },
          {
            name: 'OpenClaw 2026.3.25-beta.1',
            tag_name: 'v2026.3.25-beta.1',
            prerelease: true,
            published_at: '2026-03-25T08:00:00Z',
            html_url: 'https://github.com/openclaw/openclaw/releases/tag/v2026.3.25-beta.1',
            body: '',
          },
        ]);
      }

      if (url.includes('/commits')) {
        return jsonResponse([
          {
            sha: 'abcdef1234567890',
            html_url: 'https://github.com/openclaw/openclaw/commit/abcdef1234567890',
            commit: {
              author: { date: '2026-03-24T09:45:00Z' },
              message: 'fix: patch release notes formatting\n\nextra details',
            },
          },
        ]);
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const snapshot = await buildOpenClawUpstreamSnapshot(fetchMock);

    expect(snapshot.repository).toBe('openclaw/openclaw');
    expect(snapshot.latestStableVersion).toBe('2026.3.24');
    expect(snapshot.latestStableTag).toBe('v2026.3.24');
    expect(snapshot.releases.map((release) => release.version)).toEqual([
      '2026.3.24',
      '2026.3.23',
      '2026.3.25-beta.1',
    ]);
    expect(snapshot.releases[0]?.summary).toBe('Latest stable cut');
    expect(snapshot.recentCommits[0]).toEqual({
      sha: 'abcdef1',
      date: '2026-03-24T09:45:00Z',
      message: 'fix: patch release notes formatting',
      url: 'https://github.com/openclaw/openclaw/commit/abcdef1234567890',
    });
  });

  test('fetchOpenClawAdvisoryFeed queries OSV for each tag and normalizes paginated advisories', async () => {
    const snapshot: OpenClawUpstreamSnapshot = {
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
        {
          version: '2026.3.25-beta.1',
          tag: 'v2026.3.25-beta.1',
          publishedAt: '2026-03-25T08:00:00Z',
          url: 'https://github.com/openclaw/openclaw/releases/tag/v2026.3.25-beta.1',
          prerelease: true,
          summary: 'Beta release',
        },
      ],
      recentCommits: [],
    };

    const fetchMock: typeof fetch = async (_input, init) => {
      const payload = JSON.parse(String(init?.body)) as {
        version: string;
        page_token?: string;
      };

      if (payload.version === 'v2026.3.24' && !payload.page_token) {
        return jsonResponse({
          vulns: [
            {
              id: 'OSV-2026-1000',
              aliases: ['CVE-2026-1000'],
              summary: 'Remote file write',
              published: '2026-03-24T11:00:00Z',
              modified: '2026-03-24T12:00:00Z',
              references: [{ type: 'ADVISORY', url: 'https://osv.dev/OSV-2026-1000' }],
              affected: [
                {
                  database_specific: { severity: 'critical' },
                  ranges: [{ events: [{ fixed: '2026.3.25' }] }],
                },
              ],
            },
          ],
          next_page_token: 'page-2',
        });
      }

      if (payload.version === 'v2026.3.24' && payload.page_token === 'page-2') {
        return jsonResponse({
          vulns: [
            {
              id: 'GHSA-2026-2000',
              details: 'Credential leak in archived logs',
              aliases: [],
              references: [{ url: 'https://github.com/advisories/GHSA-2026-2000' }],
              severity: [{ type: 'CVSS_V3', score: '7.5' }],
              affected: [{ ranges: [{ events: [{ fixed: '2026.3.26' }] }] }],
            },
          ],
        });
      }

      if (payload.version === 'v2026.3.25-beta.1') {
        return jsonResponse({ vulns: [] });
      }

      throw new Error(`Unexpected OSV request: ${JSON.stringify(payload)}`);
    };

    const feed = await fetchOpenClawAdvisoryFeed(snapshot, fetchMock);

    expect(feed).toHaveLength(2);
    expect(feed[0]).toEqual({
      version: '2026.3.24',
      tag: 'v2026.3.24',
      prerelease: false,
      advisories: [
        {
          id: 'OSV-2026-1000',
          aliases: ['CVE-2026-1000'],
          summary: 'Remote file write',
          details: 'Remote file write',
          severity: 'critical',
          fixedVersions: ['2026.3.25'],
          references: [{ type: 'ADVISORY', url: 'https://osv.dev/OSV-2026-1000' }],
          publishedAt: '2026-03-24T11:00:00Z',
          modifiedAt: '2026-03-24T12:00:00Z',
          source: 'https://osv.dev/vulnerability/OSV-2026-1000',
        },
        {
          id: 'GHSA-2026-2000',
          aliases: [],
          summary: 'Credential leak in archived logs',
          details: 'Credential leak in archived logs',
          severity: 'medium',
          fixedVersions: ['2026.3.26'],
          references: [{ type: 'WEB', url: 'https://github.com/advisories/GHSA-2026-2000' }],
          publishedAt: null,
          modifiedAt: null,
          source: 'https://osv.dev/vulnerability/GHSA-2026-2000',
        },
      ],
    });
    expect(feed[1]).toEqual({
      version: '2026.3.25-beta.1',
      tag: 'v2026.3.25-beta.1',
      prerelease: true,
      advisories: [],
    });
  });

  test('mergeVersionDatabaseWithAdvisories replaces duplicate CVEs and skips prerelease-only records', () => {
    const merged = mergeVersionDatabaseWithAdvisories(
      [
        {
          version: '2026.3.24',
          releaseDate: '2026-03-24',
          cves: [
            {
              id: 'CVE-2026-1000',
              severity: 'low',
              description: 'Old description',
            },
          ],
        },
      ],
      [
        {
          version: '2026.3.24',
          tag: 'v2026.3.24',
          prerelease: false,
          advisories: [
            {
              id: 'OSV-2026-1000',
              aliases: ['CVE-2026-1000'],
              summary: 'Updated advisory text',
              details: 'Updated advisory text',
              severity: 'critical',
              fixedVersions: ['2026.3.25'],
              references: [],
              publishedAt: null,
              modifiedAt: null,
              source: 'https://osv.dev/vulnerability/OSV-2026-1000',
            },
            {
              id: 'GHSA-2026-2000',
              aliases: [],
              summary: 'Second advisory',
              details: 'Second advisory',
              severity: 'medium',
              fixedVersions: ['2026.3.26'],
              references: [],
              publishedAt: null,
              modifiedAt: null,
              source: 'https://osv.dev/vulnerability/GHSA-2026-2000',
            },
          ],
        },
        {
          version: '2026.3.25-beta.1',
          tag: 'v2026.3.25-beta.1',
          prerelease: true,
          advisories: [
            {
              id: 'BETA-ONLY',
              aliases: [],
              summary: 'Beta advisory',
              details: 'Beta advisory',
              severity: 'low',
              fixedVersions: [],
              references: [],
              publishedAt: null,
              modifiedAt: null,
              source: 'https://osv.dev/vulnerability/BETA-ONLY',
            },
          ],
        },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.cves).toEqual([
      {
        id: 'CVE-2026-1000',
        severity: 'critical',
        description: 'Updated advisory text',
        fixedIn: '2026.3.25',
      },
      {
        id: 'GHSA-2026-2000',
        severity: 'medium',
        description: 'Second advisory',
        fixedIn: '2026.3.26',
      },
    ]);
  });
});
