import type { CveEntry, VersionEntry } from './version-db';
import type { OpenClawReleaseRecord, OpenClawUpstreamSnapshot } from './openclaw-upstream';

interface GitHubRelease {
  name: string | null;
  tag_name: string;
  prerelease: boolean;
  published_at: string | null;
  html_url: string;
  body: string | null;
}

interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: {
    author: {
      date: string;
    };
    message: string;
  };
}

interface OsvReference {
  type?: string;
  url?: string;
}

interface OsvSeverity {
  type?: string;
  score?: string;
}

interface OsvRangeEvent {
  fixed?: string;
}

interface OsvAffectedRange {
  events?: OsvRangeEvent[];
}

interface OsvAffectedPackage {
  database_specific?: {
    severity?: string;
  };
  ranges?: OsvAffectedRange[];
}

interface OsvVulnerability {
  id: string;
  aliases?: string[];
  summary?: string;
  details?: string;
  published?: string;
  modified?: string;
  references?: OsvReference[];
  severity?: OsvSeverity[];
  database_specific?: {
    severity?: string;
  };
  affected?: OsvAffectedPackage[];
}

interface OsvQueryResponse {
  vulns?: OsvVulnerability[];
  next_page_token?: string;
}

type FetchLike = typeof fetch;

export interface OpenClawAdvisoryReference {
  type: string;
  url: string;
}

export interface OpenClawAdvisoryRecord {
  id: string;
  aliases: string[];
  summary: string;
  details: string;
  severity: CveEntry['severity'];
  fixedVersions: string[];
  references: OpenClawAdvisoryReference[];
  publishedAt: string | null;
  modifiedAt: string | null;
  source: string;
}

export interface OpenClawVersionAdvisoryRecord {
  version: string;
  tag: string;
  prerelease: boolean;
  advisories: OpenClawAdvisoryRecord[];
}

export const OPENCLAW_REPOSITORY = 'openclaw/openclaw';
export const OPENCLAW_GIT_URL = 'https://github.com/openclaw/openclaw.git';
const GITHUB_RELEASES_API = `https://api.github.com/repos/${OPENCLAW_REPOSITORY}/releases?per_page=8`;
const GITHUB_COMMITS_API = `https://api.github.com/repos/${OPENCLAW_REPOSITORY}/commits?sha=main&per_page=8`;
const OSV_QUERY_API = 'https://api.osv.dev/v1/query';

function normalizeReleaseVersion(release: GitHubRelease): string {
  const byName = release.name?.match(/openclaw\s+(.+)$/i)?.[1]?.trim();
  if (byName) return byName;

  const rawTag = release.tag_name.replace(/^v/, '');
  if (!release.prerelease && /-\d+$/.test(rawTag)) {
    return rawTag.replace(/-\d+$/, '');
  }
  return rawTag;
}

function summarizeRelease(body: string | null, version: string, prerelease: boolean): string {
  const summary = body
    ?.split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('##') && !line.startsWith('* ') && !line.startsWith('- '));

  if (summary) {
    return summary.replace(/\s+/g, ' ');
  }

  return prerelease ? `Pre-release for the ${version} train.` : `Stable release in the ${version} train.`;
}

async function fetchJson<T>(url: string, fetchImpl: FetchLike, init?: RequestInit): Promise<T> {
  const response = await fetchImpl(url, init);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function buildOpenClawUpstreamSnapshot(fetchImpl: FetchLike = fetch): Promise<OpenClawUpstreamSnapshot> {
  const [releases, commits] = await Promise.all([
    fetchJson<GitHubRelease[]>(GITHUB_RELEASES_API, fetchImpl, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'openclaw-security',
      },
    }),
    fetchJson<GitHubCommit[]>(GITHUB_COMMITS_API, fetchImpl, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'openclaw-security',
      },
    }),
  ]);

  const mappedReleases: OpenClawReleaseRecord[] = releases
    .filter((release) => release.published_at)
    .map((release) => {
      const version = normalizeReleaseVersion(release);
      return {
        version,
        tag: release.tag_name,
        publishedAt: release.published_at ?? new Date().toISOString(),
        url: release.html_url,
        prerelease: release.prerelease,
        summary: summarizeRelease(release.body, version, release.prerelease),
      };
    });

  const latestStable = mappedReleases.find((release) => !release.prerelease);
  if (!latestStable) {
    throw new Error('No stable OpenClaw release found in GitHub API response.');
  }

  return {
    capturedAt: new Date().toISOString(),
    repository: OPENCLAW_REPOSITORY,
    latestStableVersion: latestStable.version,
    latestStableTag: latestStable.tag,
    releases: mappedReleases,
    recentCommits: commits.map((commit) => ({
      sha: commit.sha.slice(0, 7),
      date: commit.commit.author.date,
      message: commit.commit.message.split('\n')[0] ?? '',
      url: commit.html_url,
    })),
  };
}

function normalizeAdvisorySeverity(vulnerability: OsvVulnerability): CveEntry['severity'] {
  const candidates = [
    vulnerability.database_specific?.severity,
    ...(vulnerability.affected?.map((affected) => affected.database_specific?.severity) ?? []),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = candidate.toLowerCase();
    if (normalized === 'critical' || normalized === 'high' || normalized === 'medium' || normalized === 'low') {
      return normalized;
    }
  }

  if (vulnerability.aliases?.some((alias) => alias.startsWith('CVE-'))) {
    return 'high';
  }

  return 'medium';
}

function extractFixedVersions(vulnerability: OsvVulnerability): string[] {
  return [
    ...new Set(
      (vulnerability.affected ?? [])
        .flatMap((affected) => affected.ranges ?? [])
        .flatMap((range) => range.events ?? [])
        .flatMap((event) => (event.fixed ? [event.fixed] : [])),
    ),
  ];
}

function normalizeAdvisory(vulnerability: OsvVulnerability): OpenClawAdvisoryRecord {
  const details = vulnerability.details?.trim() ?? '';
  const summary = vulnerability.summary?.trim() || details.split('\n')[0]?.trim() || vulnerability.id;

  return {
    id: vulnerability.id,
    aliases: vulnerability.aliases ?? [],
    summary,
    details: details || summary,
    severity: normalizeAdvisorySeverity(vulnerability),
    fixedVersions: extractFixedVersions(vulnerability),
    references: (vulnerability.references ?? [])
      .filter((reference): reference is Required<OsvReference> => Boolean(reference.url))
      .map((reference) => ({
        type: reference.type ?? 'WEB',
        url: reference.url,
      })),
    publishedAt: vulnerability.published ?? null,
    modifiedAt: vulnerability.modified ?? null,
    source: `https://osv.dev/vulnerability/${vulnerability.id}`,
  };
}

async function queryOsvByTag(tag: string, fetchImpl: FetchLike): Promise<OpenClawAdvisoryRecord[]> {
  const advisories: OpenClawAdvisoryRecord[] = [];
  let pageToken: string | undefined;

  do {
    const response = await fetchJson<OsvQueryResponse>(OSV_QUERY_API, fetchImpl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        package: {
          ecosystem: 'GIT',
          name: OPENCLAW_GIT_URL,
        },
        version: tag,
        ...(pageToken ? { page_token: pageToken } : {}),
      }),
    });

    advisories.push(...(response.vulns ?? []).map(normalizeAdvisory));
    pageToken = response.next_page_token;
  } while (pageToken);

  return advisories;
}

export async function fetchOpenClawAdvisoryFeed(
  snapshot: OpenClawUpstreamSnapshot,
  fetchImpl: FetchLike = fetch,
): Promise<OpenClawVersionAdvisoryRecord[]> {
  return Promise.all(
    snapshot.releases.map(async (release) => ({
      version: release.version,
      tag: release.tag,
      prerelease: release.prerelease,
      advisories: await queryOsvByTag(release.tag, fetchImpl),
    })),
  );
}

export function mergeVersionDatabaseWithAdvisories(
  baseDatabase: VersionEntry[],
  advisoryFeed: OpenClawVersionAdvisoryRecord[],
): VersionEntry[] {
  const merged = new Map(
    baseDatabase.map((entry) => [
      entry.version,
      {
        ...entry,
        cves: entry.cves.map((cve) => ({ ...cve })),
      },
    ]),
  );

  for (const advisoryEntry of advisoryFeed) {
    if (advisoryEntry.prerelease) continue;

    const existing = merged.get(advisoryEntry.version);
    const advisoryCves: CveEntry[] = advisoryEntry.advisories.map((advisory) => ({
      id: advisory.aliases.find((alias) => alias.startsWith('CVE-')) ?? advisory.id,
      severity: advisory.severity,
      description: advisory.summary,
      fixedIn: advisory.fixedVersions[0],
    }));

    const existingCves = new Map((existing?.cves ?? []).map((cve) => [cve.id, cve]));
    for (const cve of advisoryCves) {
      existingCves.set(cve.id, cve);
    }

    merged.set(advisoryEntry.version, {
      version: advisoryEntry.version,
      releaseDate: existing?.releaseDate ?? '',
      eol: existing?.eol,
      cves: [...existingCves.values()],
    });
  }

  return [...merged.values()].sort((left, right) => left.releaseDate.localeCompare(right.releaseDate));
}
