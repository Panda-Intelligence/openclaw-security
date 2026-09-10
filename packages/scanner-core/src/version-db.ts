import { getOpenClawUpstreamSnapshot, type OpenClawUpstreamSnapshot } from './openclaw-upstream';

export interface VersionEntry {
  version: string;
  cves: CveEntry[];
  releaseDate: string;
  eol?: boolean;
}

export interface CveEntry {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  fixedIn?: string;
}

const MANUAL_VERSION_DATABASE: VersionEntry[] = [
  {
    version: '0.1.0',
    releaseDate: '2025-12-01',
    eol: true,
    cves: [
      {
        id: 'OCLAW-2025-001',
        severity: 'critical',
        description: 'JWT signature bypass in dev mode fallback',
        fixedIn: '0.2.0',
      },
      {
        id: 'OCLAW-2025-002',
        severity: 'high',
        description: 'Admin credits endpoint lacks authentication',
        fixedIn: '0.2.0',
      },
    ],
  },
  {
    version: '0.2.0',
    releaseDate: '2026-01-15',
    cves: [
      {
        id: 'OCLAW-2026-001',
        severity: 'medium',
        description: 'CORS allows credential reflection with wildcard origin',
        fixedIn: '0.3.0',
      },
    ],
  },
  {
    version: '0.3.0',
    releaseDate: '2026-02-20',
    cves: [],
  },
];

export function buildVersionDatabaseFromSnapshot(upstream: OpenClawUpstreamSnapshot): VersionEntry[] {
  const merged = new Map<string, VersionEntry>();

  for (const entry of MANUAL_VERSION_DATABASE) {
    merged.set(entry.version, {
      ...entry,
      cves: entry.cves.map((cve) => ({ ...cve })),
    });
  }

  for (const release of upstream.releases) {
    if (release.prerelease) continue;

    const existing = merged.get(release.version);
    merged.set(release.version, {
      version: release.version,
      releaseDate: release.publishedAt.slice(0, 10),
      cves: existing?.cves ?? [],
      eol: existing?.eol,
    });
  }

  return [...merged.values()].sort((left, right) => left.releaseDate.localeCompare(right.releaseDate));
}

function buildVersionDatabase(): VersionEntry[] {
  return buildVersionDatabaseFromSnapshot(getOpenClawUpstreamSnapshot());
}

const VERSION_DATABASE: VersionEntry[] = buildVersionDatabase();

export function lookupVersion(version: string): VersionEntry | undefined {
  return VERSION_DATABASE.find((v) => v.version === version);
}

export function getVersionDatabase(): VersionEntry[] {
  return VERSION_DATABASE.map((entry) => ({
    ...entry,
    cves: entry.cves.map((cve) => ({ ...cve })),
  }));
}

export function getCvesForVersion(version: string): CveEntry[] {
  const entry = lookupVersion(version);
  return entry?.cves ?? [];
}

export function isEol(version: string): boolean {
  const entry = lookupVersion(version);
  return entry?.eol ?? false;
}

export function getLatestVersion(): string {
  return getOpenClawUpstreamSnapshot().latestStableVersion;
}

export function isOutdated(version: string): boolean {
  return version !== getLatestVersion();
}
