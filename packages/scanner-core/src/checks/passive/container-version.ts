import type { CheckDefinition, CheckResult, Finding } from '../../types.js';

const check: CheckDefinition = {
  id: 'container-version',
  name: 'Container Version Consistency',
  description: 'Checks if web worker and runtime worker versions match',
  mode: 'passive',
  category: 'infrastructure',
  dependsOn: ['health-fingerprint'],
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    const base = ctx.config.targetUrl;

    // The web worker and runtime worker may expose different versions
    // Try to detect version from both /health (web) and /api/runtime (runtime-proxied)
    try {
      const runtimeResp = await ctx.httpClient.get(`${base}/api/runtime`, { timeout: 5000 });

      if (runtimeResp.status === 200) {
        try {
          const data = JSON.parse(runtimeResp.body);
          const runtimeVersion = data.data?.version ?? data.version;

          if (runtimeVersion && ctx.platformInfo.version && runtimeVersion !== ctx.platformInfo.version) {
            findings.push({
              checkId: 'container-version',
              title: 'Version mismatch between web and runtime workers',
              description: `Web worker reports v${ctx.platformInfo.version}, runtime reports v${runtimeVersion}`,
              severity: 'low',
              evidence: `Web: ${ctx.platformInfo.version}, Runtime: ${runtimeVersion}`,
              recommendation: 'Deploy both workers together to ensure version consistency',
            });
          }
        } catch { /* not JSON */ }
      }
    } catch { /* runtime endpoint not accessible */ }

    return {
      checkId: 'container-version',
      status: findings.length > 0 ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
