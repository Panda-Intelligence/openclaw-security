import type { CheckDefinition, CheckResult, Finding } from '../../types.js';

const check: CheckDefinition = {
  id: 'oauth-enumeration',
  name: 'OAuth Provider Enumeration',
  description: 'Detects configured OAuth providers (Google, GitHub) via redirect behavior',
  mode: 'passive',
  category: 'auth',
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    const base = ctx.config.targetUrl;
    const providers = ['google', 'github'];

    for (const provider of providers) {
      try {
        const resp = await ctx.httpClient.get(`${base}/api/auth/${provider}`, {
          followRedirects: false,
          timeout: 5000,
        });

        if (resp.status === 302 || resp.status === 301) {
          const location = resp.headers['location'] ?? '';
          findings.push({
            checkId: 'oauth-enumeration',
            title: `OAuth provider detected: ${provider}`,
            description: `${provider} OAuth login is configured and redirects to authorization endpoint`,
            severity: 'info',
            evidence: `GET /api/auth/${provider} → ${resp.status}, Location: ${location.substring(0, 100)}`,
            recommendation: 'Ensure OAuth state parameter is used to prevent CSRF attacks.',
          });

          // Check for missing state parameter
          if (!location.includes('state=')) {
            findings.push({
              checkId: 'oauth-enumeration',
              title: `OAuth ${provider}: missing state parameter`,
              description: 'The OAuth redirect URL does not include a state parameter for CSRF protection',
              severity: 'high',
              evidence: `Location header does not contain state= parameter`,
              recommendation: 'Add a cryptographic state parameter to OAuth authorization requests',
              cweId: 'CWE-352',
            });
          }
        }
      } catch { /* timeout or error */ }
    }

    return {
      checkId: 'oauth-enumeration',
      status: findings.some((f) => f.severity !== 'info') ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
