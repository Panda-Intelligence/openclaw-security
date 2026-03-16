interface VersionEntry {
  version: string;
  cves: CveEntry[];
  releaseDate: string;
  eol?: boolean;
}

interface CveEntry {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  fixedIn?: string;
}

/** Known OpenClaw versions and associated CVEs. Updated manually. */
const VERSION_DATABASE: VersionEntry[] = [
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

export function lookupVersion(version: string): VersionEntry | undefined {
  return VERSION_DATABASE.find((v) => v.version === version);
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
  return VERSION_DATABASE[VERSION_DATABASE.length - 1].version;
}

export function isOutdated(version: string): boolean {
  return version !== getLatestVersion();
}
