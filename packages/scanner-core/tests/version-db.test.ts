import { describe, expect, test } from 'bun:test';
import {
  buildVersionDatabaseFromSnapshot,
  getCvesForVersion,
  getLatestVersion,
  getVersionDatabase,
  isEol,
  isOutdated,
  lookupVersion,
} from '../src/version-db';
import { getOpenClawUpstreamSnapshot } from '../src/openclaw-upstream';

describe('version-db', () => {
  test('getLatestVersion returns a version string', () => {
    const latest = getLatestVersion();
    expect(latest).toBeTruthy();
    expect(latest).toMatch(/^\d+\.\d+\.\d+$/);
    expect(latest).toBe(getOpenClawUpstreamSnapshot().latestStableVersion);
  });

  test('lookupVersion finds known version', () => {
    const entry = lookupVersion('0.1.0');
    expect(entry).toBeTruthy();
    expect(entry!.version).toBe('0.1.0');
    expect(entry!.releaseDate).toBeTruthy();
  });

  test('lookupVersion returns undefined for unknown', () => {
    expect(lookupVersion('99.99.99')).toBeUndefined();
  });

  test('getCvesForVersion returns CVEs for vulnerable version', () => {
    const cves = getCvesForVersion('0.1.0');
    expect(cves.length).toBeGreaterThan(0);
    expect(cves[0].id).toMatch(/^OCLAW-/);
    expect(cves[0].severity).toBeTruthy();
  });

  test('getCvesForVersion returns empty for clean version', () => {
    const cves = getCvesForVersion('0.3.0');
    expect(cves).toHaveLength(0);
  });

  test('getCvesForVersion returns empty for unknown version', () => {
    expect(getCvesForVersion('99.99.99')).toHaveLength(0);
  });

  test('isEol for deprecated version', () => {
    expect(isEol('0.1.0')).toBe(true);
  });

  test('isEol for current version', () => {
    expect(isEol('0.3.0')).toBe(false);
  });

  test('isEol for unknown version', () => {
    expect(isEol('99.0.0')).toBe(false);
  });

  test('isOutdated for old version', () => {
    expect(isOutdated('0.1.0')).toBe(true);
  });

  test('isOutdated for latest version', () => {
    const latest = getLatestVersion();
    expect(isOutdated(latest)).toBe(false);
  });

  test('lookupVersion finds the latest stable upstream version', () => {
    const latest = getLatestVersion();
    const entry = lookupVersion(latest);
    expect(entry).toBeTruthy();
    expect(entry?.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('getVersionDatabase returns a defensive copy that still includes upstream versions', () => {
    const database = getVersionDatabase();
    const latest = getLatestVersion();

    expect(database.some((entry) => entry.version === latest)).toBe(true);

    database[0]?.cves.push({
      id: 'LOCAL-ONLY',
      severity: 'low',
      description: 'local mutation should not leak back',
    });

    expect(getCvesForVersion(database[0]?.version ?? '')).not.toContainEqual(
      expect.objectContaining({ id: 'LOCAL-ONLY' }),
    );
  });

  test('buildVersionDatabaseFromSnapshot can materialize newer upstream releases without mutating manual data', () => {
    const database = buildVersionDatabaseFromSnapshot({
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
      recentCommits: [],
    });

    expect(database.some((entry) => entry.version === '2026.3.24')).toBe(true);

    const legacy = database.find((entry) => entry.version === '0.1.0');
    legacy?.cves.push({
      id: 'MUTATED',
      severity: 'low',
      description: 'mutation should stay local',
    });

    expect(getCvesForVersion('0.1.0')).not.toContainEqual(expect.objectContaining({ id: 'MUTATED' }));
  });
});
