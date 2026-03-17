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
  installHardening: IntelligenceBoardItem[];
  llmSecurity: IntelligenceBoardItem[];
  gatewayHardening: IntelligenceBoardItem[];
}

const CAPTURED_AT = '2026-03-17';

export const intelligenceSources: IntelligenceSource[] = [
  {
    label: 'OpenClaw releases',
    url: 'https://github.com/openclaw/openclaw/releases',
    note: 'Latest release page shows 2026.3.13 published on March 14, 2026, with signed release/tag metadata and security-related fixes in recent notes.',
    capturedAt: CAPTURED_AT,
  },
  {
    label: 'Skills loading & precedence',
    url: 'https://docs.openclaw.ai/tools/skills',
    note: 'Official skills docs describe precedence: workspace skills override managed/local and bundled skills, and installs honor `skills.install.nodeManager`.',
    capturedAt: CAPTURED_AT,
  },
  {
    label: 'ClawHub public registry',
    url: 'https://docs.openclaw.ai/tools/clawhub',
    note: 'Official registry docs describe public publishing, version history, reporting, auto-hide thresholds, and moderation flows.',
    capturedAt: CAPTURED_AT,
  },
  {
    label: 'Plugin install model',
    url: 'https://docs.openclaw.ai/tools/plugin',
    note: 'Plugin docs state dependencies install with `npm install --ignore-scripts`; plugins run in-process and should be treated as trusted code.',
    capturedAt: CAPTURED_AT,
  },
  {
    label: 'Install guidance',
    url: 'https://docs.openclaw.ai/install',
    note: 'Install docs recommend Node 24, support Node 22.16+, and call out `pnpm approve-builds -g` for build-script approvals.',
    capturedAt: CAPTURED_AT,
  },
  {
    label: 'Threat model contribution guide',
    url: 'https://docs.openclaw.ai/security/CONTRIBUTING-THREAT-MODEL',
    note: 'Threat model docs explicitly call out ClawHub, CLI, gateway, channels, and MCP servers as areas to analyze using AI-focused threat modeling.',
    capturedAt: CAPTURED_AT,
  },
  {
    label: 'Gateway security guide',
    url: 'https://docs.openclaw.ai/gateway/security',
    note: 'Gateway security docs list dangerous flags, reverse-proxy rules, plugin trust notes, open-group exposure checks, and the `openclaw security audit` hardening surface.',
    capturedAt: CAPTURED_AT,
  },
];

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

export const releaseWatch: ReleaseWatchItem[] = [
  {
    version: '2026.3.13',
    date: '2026-03-14',
    posture: 'Latest published release',
    summary: 'The official releases page shows 2026.3.13 as the latest release and explains that the GitHub tag uses `v2026.3.13-1` as a recovery release path while npm remains `2026.3.13`.',
  },
  {
    version: '2026.3.13-beta.1',
    date: '2026-03-14',
    posture: 'Pre-release',
    summary: 'The same releases page lists `2026.3.13-beta.1`, which helps operators distinguish pre-release exposure from stable rollout.',
  },
  {
    version: 'Recent 2026.3.x line',
    date: '2026-03-14',
    posture: 'Security-heavy release train',
    summary: 'Official recent release notes include multiple GHSA-linked fixes around exec approvals, WebSocket scope handling, browser profile controls, and workspace boundary enforcement.',
  },
];

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

export function getIntelligenceOverview(): IntelligenceOverview {
  return {
    capturedAt: CAPTURED_AT,
    sources: intelligenceSources,
    marketplaceSkills: marketplaceSkillsBoard,
    releases: releaseWatch,
    installHardening: installHardeningBoard,
    llmSecurity: llmSecurityBoard,
    gatewayHardening: gatewayHardeningBoard,
  };
}
