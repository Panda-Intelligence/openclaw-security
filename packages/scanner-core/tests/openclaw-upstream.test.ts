import { describe, expect, test } from 'bun:test';
import {
  getLatestPrerelease,
  getLatestStableRelease,
  getOpenClawUpstreamSnapshot,
} from '../src/openclaw-upstream';

describe('openclaw upstream snapshot', () => {
  test('includes a latest stable release and recent commits', () => {
    const snapshot = getOpenClawUpstreamSnapshot();
    expect(snapshot.repository).toBe('openclaw/openclaw');
    expect(snapshot.latestStableVersion).toBeTruthy();
    expect(snapshot.releases.length).toBeGreaterThan(0);
    expect(snapshot.recentCommits.length).toBeGreaterThan(0);
  });

  test('exposes helper accessors', () => {
    const stable = getLatestStableRelease();
    const prerelease = getLatestPrerelease();

    expect(stable?.prerelease).toBe(false);
    expect(stable?.version).toBe(getOpenClawUpstreamSnapshot().latestStableVersion);
    expect(prerelease?.prerelease ?? true).toBe(true);
  });
});
