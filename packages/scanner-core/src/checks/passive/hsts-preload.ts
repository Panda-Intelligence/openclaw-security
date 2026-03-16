import type { CheckDefinition, CheckResult, Finding } from '../../types.js';

const check: CheckDefinition = {
  id: 'hsts-preload',
  name: 'HSTS Preload Check',
  description: 'Verifies HSTS header meets preload requirements',
  mode: 'passive',
  category: 'headers',
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    const resp = await ctx.httpClient.get(ctx.config.targetUrl);

    const hsts = resp.headers['strict-transport-security'];

    if (!hsts) {
      findings.push({
        checkId: 'hsts-preload',
        title: 'HSTS header not set',
        description: 'Strict-Transport-Security header is missing',
        severity: 'medium',
        evidence: 'No Strict-Transport-Security header in response',
        recommendation: 'Set Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
        cweId: 'CWE-319',
      });
      return { checkId: 'hsts-preload', status: 'fail', findings, durationMs: 0 };
    }

    const maxAgeMatch = hsts.match(/max-age=(\d+)/);
    const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) : 0;

    if (maxAge < 31536000) {
      findings.push({
        checkId: 'hsts-preload',
        title: 'HSTS max-age too short for preload',
        description: `max-age is ${maxAge} seconds. Preload requires at least 31536000 (1 year)`,
        severity: 'medium',
        evidence: `Strict-Transport-Security: ${hsts}`,
        recommendation: 'Set max-age to at least 31536000',
      });
    }

    if (!hsts.toLowerCase().includes('includesubdomains')) {
      findings.push({
        checkId: 'hsts-preload',
        title: 'HSTS missing includeSubDomains',
        description: 'HSTS preload requires the includeSubDomains directive',
        severity: 'low',
        evidence: `Strict-Transport-Security: ${hsts}`,
        recommendation: 'Add includeSubDomains to the HSTS header',
      });
    }

    if (!hsts.toLowerCase().includes('preload')) {
      findings.push({
        checkId: 'hsts-preload',
        title: 'HSTS missing preload directive',
        description: 'The preload directive is not set, meaning the site cannot be submitted to browser preload lists',
        severity: 'low',
        evidence: `Strict-Transport-Security: ${hsts}`,
        recommendation: 'Add preload to the HSTS header and submit to hstspreload.org',
      });
    }

    return {
      checkId: 'hsts-preload',
      status: findings.length > 0 ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
