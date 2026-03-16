import type { CheckDefinition, CheckResult, Finding } from '../../types';

const check: CheckDefinition = {
  id: 'rate-limit-probe',
  name: 'Rate Limiting Probe',
  description: 'Tests if rate limiting is properly configured by reading rate limit headers',
  mode: 'passive',
  category: 'infrastructure',
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    const base = ctx.config.targetUrl;

    // Send a few requests to trigger rate limit headers
    const resp = await ctx.httpClient.get(`${base}/health`);

    const rateLimitHeaders = [
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
      'ratelimit-limit',
      'ratelimit-remaining',
      'ratelimit-reset',
      'retry-after',
    ];

    const foundHeaders = rateLimitHeaders.filter((h) => resp.headers[h]);

    if (foundHeaders.length === 0) {
      findings.push({
        checkId: 'rate-limit-probe',
        title: 'No rate limiting headers detected',
        description: 'The server does not expose rate limiting headers, suggesting rate limiting may not be configured',
        severity: 'medium',
        evidence: 'No X-RateLimit-* or RateLimit-* headers in response',
        recommendation: 'Implement rate limiting on all API endpoints and expose rate limit headers',
        cweId: 'CWE-770',
      });
    } else {
      const limit = resp.headers['x-ratelimit-limit'] ?? resp.headers['ratelimit-limit'];
      if (limit && parseInt(limit) > 1000) {
        findings.push({
          checkId: 'rate-limit-probe',
          title: 'Rate limit may be too high',
          description: `Rate limit is set to ${limit} requests, which may be insufficient protection`,
          severity: 'low',
          evidence: `Rate limit: ${limit}`,
          recommendation: 'Review if the rate limit is appropriate for your API endpoints',
        });
      }
    }

    return {
      checkId: 'rate-limit-probe',
      status: findings.length > 0 ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
