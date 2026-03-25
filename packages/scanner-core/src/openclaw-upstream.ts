import { OPENCLAW_UPSTREAM_SNAPSHOT } from './generated/openclaw-upstream-snapshot';

export interface OpenClawReleaseRecord {
  version: string;
  tag: string;
  publishedAt: string;
  url: string;
  prerelease: boolean;
  summary: string;
}

export interface OpenClawCommitRecord {
  sha: string;
  date: string;
  message: string;
  url: string;
}

export interface OpenClawUpstreamSnapshot {
  capturedAt: string;
  repository: string;
  latestStableVersion: string;
  latestStableTag: string;
  releases: readonly OpenClawReleaseRecord[];
  recentCommits: readonly OpenClawCommitRecord[];
}

export function getOpenClawUpstreamSnapshot(): OpenClawUpstreamSnapshot {
  return OPENCLAW_UPSTREAM_SNAPSHOT;
}

export function getLatestStableRelease(): OpenClawReleaseRecord | undefined {
  const snapshot = getOpenClawUpstreamSnapshot();
  return snapshot.releases.find((release) => !release.prerelease && release.version === snapshot.latestStableVersion);
}

export function getLatestPrerelease(): OpenClawReleaseRecord | undefined {
  return getOpenClawUpstreamSnapshot().releases.find((release) => release.prerelease);
}
