import {
  buildVersionDatabaseFromSnapshot,
  getVersionDatabase,
  getOpenClawUpstreamSnapshot,
  type CveEntry,
  type OpenClawReleaseRecord,
  type OpenClawUpstreamSnapshot,
  type VersionEntry,
} from '@panda-ai/ocs-core';

export interface IntelligenceSource {
  label: string;
  url: string;
  note: string;
  capturedAt: string;
}

export interface IntelligenceBoardItem {
  name: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  signal: string;
}

export interface ReleaseWatchItem {
  version: string;
  date: string;
  posture: string;
  summary: string;
}

export interface IntelligenceOverview {
  capturedAt: string;
  sources: IntelligenceSource[];
  marketplaceSkills: IntelligenceBoardItem[];
  releases: ReleaseWatchItem[];
  communitySignals: IntelligenceBoardItem[];
  versionAdvisories: IntelligenceBoardItem[];
  installHardening: IntelligenceBoardItem[];
  llmSecurity: IntelligenceBoardItem[];
  gatewayHardening: IntelligenceBoardItem[];
}

export interface BuildIntelligenceOverviewOptions {
  upstreamSnapshot?: OpenClawUpstreamSnapshot;
  versionDatabase?: VersionEntry[];
  versionImpactCounts?: Record<string, number>;
  communitySignals?: IntelligenceBoardItem[];
  capturedAt?: string;
}

const STATIC_UPSTREAM = getOpenClawUpstreamSnapshot();
const STATIC_VERSION_DATABASE = getVersionDatabase();

function normalizeCapturedAtDate(rawValue: string | undefined, upstreamSnapshot: OpenClawUpstreamSnapshot): string {
  return (rawValue ?? upstreamSnapshot.capturedAt).slice(0, 10);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date));
}

function getLatestStableReleaseRecord(upstreamSnapshot: OpenClawUpstreamSnapshot): OpenClawReleaseRecord | undefined {
  return upstreamSnapshot.releases.find(
    (release) => !release.prerelease && release.version === upstreamSnapshot.latestStableVersion,
  );
}

function getLatestPrereleaseRecord(upstreamSnapshot: OpenClawUpstreamSnapshot): OpenClawReleaseRecord | undefined {
  return upstreamSnapshot.releases.find((release) => release.prerelease);
}

function buildRecentCommitSummary(upstreamSnapshot: OpenClawUpstreamSnapshot): string {
  const recentCommitMessages = upstreamSnapshot.recentCommits.slice(0, 3).map((commit) => commit.message);
  return recentCommitMessages.join('; ');
}

function advisoryRisk(entry: VersionEntry): IntelligenceBoardItem['risk'] {
  const severityOrder: Record<CveEntry['severity'], number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const highestCveSeverity = entry.cves.reduce<CveEntry['severity'] | null>((highest, cve) => {
    if (!highest) return cve.severity;
    return severityOrder[cve.severity] > severityOrder[highest] ? cve.severity : highest;
  }, null);

  if (highestCveSeverity === 'critical') return 'critical';
  if (entry.eol || highestCveSeverity === 'high') return 'high';
  if (highestCveSeverity === 'medium') return 'medium';
  return 'low';
}

function advisorySummary(entry: VersionEntry, impactedDeployments = 0): string {
  const releasePrefix = `Version ${entry.version} was released on ${entry.releaseDate}`;
  const advisoryCount = `${entry.cves.length} tracked advisor${entry.cves.length === 1 ? 'y' : 'ies'}`;
  const impactSuffix =
    impactedDeployments > 0
      ? ` Community submissions currently report ${impactedDeployments} deployment${impactedDeployments === 1 ? '' : 's'} on this version.`
      : '';

  if (entry.eol && entry.cves.length > 0) {
    return `${releasePrefix}, is end-of-life, and still carries ${advisoryCount} in the shared scanner-core version database.${impactSuffix}`;
  }

  if (entry.eol) {
    return `${releasePrefix} and is marked end-of-life in the shared scanner-core version database.${impactSuffix}`;
  }

  return `${releasePrefix} and currently carries ${advisoryCount} in the shared scanner-core version database.${impactSuffix}`;
}

function advisorySignal(entry: VersionEntry, impactedDeployments = 0): string {
  const advisoryIds = entry.cves.map((cve) => cve.id);
  const fixedVersions = [...new Set(entry.cves.flatMap((cve) => (cve.fixedIn ? [cve.fixedIn] : [])))];
  const parts: string[] = [];

  if (advisoryIds.length > 0) {
    parts.push(`Tracked advisories: ${advisoryIds.join(', ')}`);
  }

  if (fixedVersions.length > 0) {
    parts.push(`Fixed in: ${fixedVersions.join(', ')}`);
  }

  if (entry.eol) {
    parts.push('Release line is end-of-life');
  }

  if (impactedDeployments > 0) {
    parts.push(`Community reports: ${impactedDeployments} deployment${impactedDeployments === 1 ? '' : 's'}`);
  }

  return parts.join(' · ');
}

function buildIntelligenceSources(
  upstreamSnapshot: OpenClawUpstreamSnapshot,
  capturedAt: string,
): IntelligenceSource[] {
  const latestStableRelease = getLatestStableReleaseRecord(upstreamSnapshot);

  return [
    {
      label: 'OpenClaw releases',
      url: 'https://github.com/openclaw/openclaw/releases',
      note: latestStableRelease
        ? `Latest stable release is ${latestStableRelease.version}, published on ${formatDate(latestStableRelease.publishedAt)}. Recent main-branch activity includes ${buildRecentCommitSummary(upstreamSnapshot)}.`
        : 'OpenClaw upstream release data is unavailable.',
      capturedAt,
    },
    {
      label: 'Skills loading & precedence',
      url: 'https://docs.openclaw.ai/tools/skills',
      note: 'Official skills docs describe precedence: workspace skills override managed/local and bundled skills, and installs honor `skills.install.nodeManager`.',
      capturedAt,
    },
    {
      label: 'ClawHub public registry',
      url: 'https://docs.openclaw.ai/tools/clawhub',
      note: 'Official registry docs describe public publishing, version history, reporting, auto-hide thresholds, and moderation flows.',
      capturedAt,
    },
    {
      label: 'Plugin install model',
      url: 'https://docs.openclaw.ai/tools/plugin',
      note: 'Plugin docs state dependencies install with `npm install --ignore-scripts`; plugins run in-process and should be treated as trusted code.',
      capturedAt,
    },
    {
      label: 'Install guidance',
      url: 'https://docs.openclaw.ai/install',
      note: 'Install docs recommend Node 24, support Node 22.16+, and call out `pnpm approve-builds -g` for build-script approvals.',
      capturedAt,
    },
    {
      label: 'Threat model contribution guide',
      url: 'https://docs.openclaw.ai/security/CONTRIBUTING-THREAT-MODEL',
      note: 'Threat model docs explicitly call out ClawHub, CLI, gateway, channels, and MCP servers as areas to analyze using AI-focused threat modeling.',
      capturedAt,
    },
    {
      label: 'Gateway security guide',
      url: 'https://docs.openclaw.ai/gateway/security',
      note: 'Gateway security docs list dangerous flags, reverse-proxy rules, plugin trust notes, open-group exposure checks, and the `openclaw security audit` hardening surface.',
      capturedAt,
    },
  ];
}

export const marketplaceSkillsBoard: IntelligenceBoardItem[] = [
  {
    name: 'Public registry trust expansion',
    risk: 'high',
    summary: 'ClawHub is intentionally open and optimized for sharing, so operators need a review process before enabling downloaded skills in production workspaces.',
    signal: 'Official ClawHub docs say all skills are public and visible, and any signed-in user can report a skill.',
  },
  {
    name: 'Workspace override shadowing',
    risk: 'high',
    summary: 'A local workspace skill can silently override managed or bundled behavior, which makes drift and spoofing important audit targets.',
    signal: 'Official skills docs list precedence as `<workspace>/skills` → `~/.openclaw/skills` → bundled skills.',
  },
  {
    name: 'Plugin-shipped skill surface',
    risk: 'medium',
    summary: 'Plugins can ship skills and extend tools, channels, hooks, and routes, so operators must review the whole package instead of only SKILL.md text.',
    signal: 'Official plugin docs describe in-process plugin loading and note that plugins can register tools, routes, hooks, and services.',
  },
];

function buildReleaseWatch(upstreamSnapshot: OpenClawUpstreamSnapshot, capturedAt: string): ReleaseWatchItem[] {
  const latestStableRelease = getLatestStableReleaseRecord(upstreamSnapshot);
  const latestPrerelease = getLatestPrereleaseRecord(upstreamSnapshot);

  return [
    {
      version: latestStableRelease?.version ?? 'unknown',
      date: latestStableRelease?.publishedAt.slice(0, 10) ?? capturedAt,
      posture: 'Latest published release',
      summary:
        latestStableRelease?.summary ??
        'Latest stable OpenClaw release metadata could not be derived from the upstream snapshot.',
    },
    {
      version: latestPrerelease?.version ?? latestStableRelease?.version ?? 'unknown',
      date: latestPrerelease?.publishedAt.slice(0, 10) ?? latestStableRelease?.publishedAt.slice(0, 10) ?? capturedAt,
      posture: 'Pre-release',
      summary:
        latestPrerelease?.summary ??
        'No current prerelease was found in the upstream snapshot, so operators should compare stable releases against main-branch activity.',
    },
    {
      version: upstreamSnapshot.recentCommits[0]?.sha ?? 'main',
      date: upstreamSnapshot.recentCommits[0]?.date.slice(0, 10) ?? capturedAt,
      posture: 'Recent main branch activity',
      summary: buildRecentCommitSummary(upstreamSnapshot) || 'Recent main-branch commit metadata is unavailable.',
    },
  ];
}

function buildVersionAdvisoriesBoard(
  upstreamSnapshot: OpenClawUpstreamSnapshot,
  versionDatabase: VersionEntry[],
  capturedAt: string,
  versionImpactCounts: Record<string, number>,
): IntelligenceBoardItem[] {
  const advisoryEntries = versionDatabase
    .filter((entry) => entry.eol || entry.cves.length > 0)
    .slice()
    .sort((left, right) => right.releaseDate.localeCompare(left.releaseDate));

  const latestTrackedVersion = getLatestStableReleaseRecord(upstreamSnapshot)?.version ?? upstreamSnapshot.latestStableVersion;
  const latestTrackedEntry = versionDatabase.find((entry) => entry.version === latestTrackedVersion);
  const latestTrackedImpacts = versionImpactCounts[latestTrackedVersion] ?? 0;

  return [
    ...advisoryEntries.map((entry) => {
      const impactedDeployments = versionImpactCounts[entry.version] ?? 0;
      return {
        name: `Version ${entry.version}`,
        risk: advisoryRisk(entry),
        summary: advisorySummary(entry, impactedDeployments),
        signal: advisorySignal(entry, impactedDeployments),
      };
    }),
    {
      name: `Latest stable ${latestTrackedVersion}`,
      risk: 'low',
      summary:
        latestTrackedEntry && latestTrackedEntry.cves.length === 0 && !latestTrackedEntry.eol
          ? `The latest stable OpenClaw release currently has no locally tracked CVEs or end-of-life flags in the shared scanner-core advisory database.${latestTrackedImpacts > 0 ? ` Community submissions report ${latestTrackedImpacts} deployment${latestTrackedImpacts === 1 ? '' : 's'} on this version.` : ''}`
          : `The latest stable release remains the primary upgrade target when older release lines carry CVEs or end-of-life flags.`,
      signal: [
        `Published ${getLatestStableReleaseRecord(upstreamSnapshot)?.publishedAt.slice(0, 10) ?? capturedAt}`,
        `Snapshot captured ${capturedAt}`,
        ...(latestTrackedImpacts > 0
          ? [`Community reports: ${latestTrackedImpacts} deployment${latestTrackedImpacts === 1 ? '' : 's'}`]
          : []),
      ].join(' · '),
    },
  ];
}

export const installHardeningBoard: IntelligenceBoardItem[] = [
  {
    name: 'Node baseline consistency',
    risk: 'medium',
    summary: 'Running mixed Node baselines across environments increases drift during dependency resolution and runtime validation.',
    signal: 'Install docs recommend Node 24 and still support Node 22.16+ for compatibility.',
  },
  {
    name: 'Build-script approval review',
    risk: 'high',
    summary: 'Global installs with pnpm require explicit approval for packages with build scripts; this is a supply-chain review checkpoint, not a routine click-through.',
    signal: 'Install docs explicitly call out `pnpm approve-builds -g` for `openclaw`, `node-llama-cpp`, `sharp`, and related packages.',
  },
  {
    name: 'Plugin dependency execution model',
    risk: 'medium',
    summary: 'Skipping lifecycle scripts reduces one install-time class of risk, but the plugin still executes as trusted code at runtime.',
    signal: 'Plugin docs say dependencies install with `npm install --ignore-scripts` and also say plugins should be treated as trusted code.',
  },
];

export const llmSecurityBoard: IntelligenceBoardItem[] = [
  {
    name: 'Prompt and memory leakage',
    risk: 'critical',
    summary: 'Skills, sessions, and long-term memory can expose prompts or secrets unless operators audit stored context and exports as part of runtime review.',
    signal: 'The official threat model guidance uses AI-focused attack analysis and explicitly includes OpenClaw surfaces such as gateway, channels, and ClawHub.',
  },
  {
    name: 'Tool overreach and boundary bypass',
    risk: 'high',
    summary: 'LLM safety is tightly coupled to what tools, channels, and plugin routes are reachable from the runtime.',
    signal: 'Official plugin docs describe tool, hook, HTTP route, command, and service registration in-process with the gateway.',
  },
  {
    name: 'Shared-token and scope confusion',
    risk: 'high',
    summary: 'Recent release notes show that shared-token scope handling and owner-only surfaces remain active security themes in OpenClaw.',
    signal: 'The official releases page includes fixes for shared-token WebSocket scope handling and owner-only command surfaces.',
  },
];

export const gatewayHardeningBoard: IntelligenceBoardItem[] = [
  {
    name: 'Dangerous debug/config flags',
    risk: 'critical',
    summary: 'Operator-selected dangerous flags can disable device checks, weaken origin handling, or broaden browser/network exposure.',
    signal: 'Gateway security docs list dangerous flags such as `dangerouslyDisableDeviceAuth`, host-header origin fallback, and private-network browser SSRF exceptions.',
  },
  {
    name: 'Open groups with elevated tools',
    risk: 'critical',
    summary: 'Open chat surfaces plus command/file/runtime tools create high-impact prompt-injection paths even without a classic exploit.',
    signal: 'The official audit section marks open groups with elevated or runtime/filesystem tools as critical exposure patterns.',
  },
  {
    name: 'Reverse proxy trust mistakes',
    risk: 'high',
    summary: 'Loose forwarding header handling can make remote clients appear local and undermine gateway auth assumptions.',
    signal: 'Gateway docs explicitly require tight `trustedProxies` settings and warn against preserving untrusted forwarding headers.',
  },
];

export function buildIntelligenceOverview(
  options: BuildIntelligenceOverviewOptions = {},
): IntelligenceOverview {
  const upstreamSnapshot = options.upstreamSnapshot ?? STATIC_UPSTREAM;
  const versionDatabase =
    options.versionDatabase ??
    (options.upstreamSnapshot ? buildVersionDatabaseFromSnapshot(upstreamSnapshot) : STATIC_VERSION_DATABASE);
  const versionImpactCounts = options.versionImpactCounts ?? {};
  const capturedAt = normalizeCapturedAtDate(options.capturedAt, upstreamSnapshot);

  return {
    capturedAt,
    sources: buildIntelligenceSources(upstreamSnapshot, capturedAt),
    marketplaceSkills: marketplaceSkillsBoard,
    releases: buildReleaseWatch(upstreamSnapshot, capturedAt),
    communitySignals: options.communitySignals ?? [],
    versionAdvisories: buildVersionAdvisoriesBoard(
      upstreamSnapshot,
      versionDatabase,
      capturedAt,
      versionImpactCounts,
    ),
    installHardening: installHardeningBoard,
    llmSecurity: llmSecurityBoard,
    gatewayHardening: gatewayHardeningBoard,
  };
}

export function getIntelligenceOverview(): IntelligenceOverview {
  return buildIntelligenceOverview();
}
