import type { CheckDefinition, CheckResult, Finding } from '../../types';

const check: CheckDefinition = {
  id: 'health-fingerprint',
  name: 'Health Endpoint Fingerprint',
  description: 'Detects OpenClaw deployment via /health endpoint and extracts version info',
  mode: 'passive',
  category: 'infrastructure',
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];

    try {
      const resp = await ctx.httpClient.get(`${ctx.config.targetUrl}/health`, { timeout: 5000 });

      if (resp.status === 200) {
        try {
          const data = JSON.parse(resp.body);
          if (data.status === 'ok') {
            findings.push({
              checkId: 'health-fingerprint',
              title: 'OpenClaw deployment detected',
              description: `Target is running OpenClaw${data.version ? ` v${data.version}` : ''}`,
              severity: 'info',
              evidence: resp.body,
              recommendation: 'Consider restricting /health endpoint information disclosure in production.',
            });

            if (data.version) {
              findings.push({
                checkId: 'health-fingerprint',
                title: 'Version information disclosed',
                description: `The /health endpoint exposes the exact version (${data.version})`,
                severity: 'low',
                evidence: `version: ${data.version}`,
                recommendation: 'Remove version information from the health endpoint response.',
                cweId: 'CWE-200',
              });
            }
          }
        } catch {
          /* not JSON, not OpenClaw */
        }
      }
    } catch {
      /* unreachable */
    }

    return {
      checkId: 'health-fingerprint',
      status: findings.length > 0 ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
