import type {
  ScanConfig,
  ScanResult,
  PlatformInfo,
  ActiveScanData,
  CheckContext,
  CheckDefinition,
  Finding,
} from './types.js';
import { createHttpClient } from './http-client.js';
import { getAllChecks, getChecksByMode } from './check-registry.js';
import { runChecks } from './check-runner.js';
import { computeScore, countSeverities } from './scoring.js';

export async function scan(config: ScanConfig): Promise<ScanResult> {
  const id = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const httpClient = createHttpClient({ timeout: config.timeout, jwt: config.jwt });

  // Step 1: Validate URL
  const url = normalizeUrl(config.targetUrl);

  // Step 2: Health fingerprint
  const platformInfo = await fingerprint(httpClient, url);

  if (!platformInfo.isOpenClaw) {
    return {
      id,
      targetUrl: url,
      mode: config.mode,
      status: 'completed',
      startedAt,
      completedAt: new Date().toISOString(),
      score: 100,
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 1 },
      findings: [
        {
          checkId: 'health-fingerprint',
          title: 'Not an OpenClaw deployment',
          description: 'The target does not appear to be an OpenClaw deployment.',
          severity: 'info',
          evidence: `GET ${url}/health did not return expected OpenClaw signature`,
          recommendation: 'Verify the URL is correct.',
        },
      ],
      checkResults: [],
      platformInfo,
    };
  }

  // Step 3: Collect applicable checks
  let checks = getApplicableChecks(config);

  // Build context
  const ctx: CheckContext = { config: { ...config, targetUrl: url }, httpClient, platformInfo };

  // Step 4: Active scan data
  if (config.mode === 'active' && config.jwt) {
    const activeData = await fetchActiveData(httpClient, url);
    if (activeData) ctx.activeData = activeData;
  }

  // Step 5: Run checks
  const checkResults = await runChecks(checks, ctx, config.concurrency ?? 5);

  // Step 6: Aggregate
  const allFindings: Finding[] = checkResults.flatMap((r) => r.findings);
  const score = computeScore(allFindings);
  const severityCounts = countSeverities(allFindings);

  return {
    id,
    targetUrl: url,
    mode: config.mode,
    status: 'completed',
    startedAt,
    completedAt: new Date().toISOString(),
    score,
    severityCounts,
    findings: allFindings,
    checkResults,
    platformInfo,
  };
}

function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url.replace(/\/+$/, '');
}

function getApplicableChecks(config: ScanConfig): CheckDefinition[] {
  let checks: CheckDefinition[];

  if (config.mode === 'active') {
    checks = getAllChecks();
  } else {
    checks = getChecksByMode('passive');
  }

  // Filter by explicit include/exclude
  if (config.checks?.length) {
    const include = new Set(config.checks);
    checks = checks.filter((c) => include.has(c.id));
  }
  if (config.skipChecks?.length) {
    const skip = new Set(config.skipChecks);
    checks = checks.filter((c) => !skip.has(c.id));
  }

  // health-fingerprint is handled separately
  checks = checks.filter((c) => c.id !== 'health-fingerprint');

  return checks;
}

async function fingerprint(
  httpClient: ReturnType<typeof createHttpClient>,
  baseUrl: string,
): Promise<PlatformInfo> {
  const info: PlatformInfo = {
    version: null,
    service: null,
    isOpenClaw: false,
    detectedProviders: [],
    planTier: null,
  };

  try {
    const resp = await httpClient.get(`${baseUrl}/health`, { timeout: 5000 });
    if (resp.status === 200) {
      try {
        const data = JSON.parse(resp.body);
        if (data.status === 'ok') {
          info.isOpenClaw = true;
          info.version = data.version ?? null;
          info.service = data.service ?? null;
        }
      } catch { /* not JSON */ }
    }

    // Check server header for Cloudflare
    if (resp.headers['server']?.includes('cloudflare')) {
      info.detectedProviders.push('cloudflare');
    }
    if (resp.headers['cf-ray']) {
      info.detectedProviders.push('cloudflare-cdn');
    }
  } catch { /* unreachable or timeout */ }

  return info;
}

async function fetchActiveData(
  httpClient: ReturnType<typeof createHttpClient>,
  baseUrl: string,
): Promise<ActiveScanData | null> {
  try {
    const [meResp, agentsResp, memoriesResp, skillsResp, schedulesResp, channelsResp] =
      await Promise.all([
        httpClient.get(`${baseUrl}/api/auth/me`),
        httpClient.get(`${baseUrl}/api/agents`),
        httpClient.get(`${baseUrl}/api/memories`),
        httpClient.get(`${baseUrl}/api/skills`),
        httpClient.get(`${baseUrl}/api/schedules`),
        httpClient.get(`${baseUrl}/api/channels`),
      ]);

    if (meResp.status !== 200) return null;

    const me = JSON.parse(meResp.body);
    const parse = (r: typeof meResp) => {
      try {
        const d = JSON.parse(r.body);
        return d.data ?? [];
      } catch {
        return [];
      }
    };

    return {
      tenantId: me.data?.tenantId ?? '',
      email: me.data?.email ?? '',
      agents: parse(agentsResp),
      memories: parse(memoriesResp),
      skills: parse(skillsResp),
      schedules: parse(schedulesResp),
      channels: parse(channelsResp),
    };
  } catch {
    return null;
  }
}
