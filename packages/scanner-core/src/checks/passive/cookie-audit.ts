import type { CheckDefinition, CheckResult, Finding } from '../../types.js';

const check: CheckDefinition = {
  id: 'cookie-audit',
  name: 'Cookie Security Audit',
  description: 'Checks cookies for Secure, HttpOnly, and SameSite attributes',
  mode: 'passive',
  category: 'auth',
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    const resp = await ctx.httpClient.get(ctx.config.targetUrl);

    const setCookieHeaders = resp.headers['set-cookie'];
    if (!setCookieHeaders) {
      return { checkId: 'cookie-audit', status: 'pass', findings: [], durationMs: 0 };
    }

    // set-cookie can be multiple values separated by newlines in our collapsed header
    const cookies = setCookieHeaders.split(/,(?=[^ ])/);

    for (const cookie of cookies) {
      const name = cookie.split('=')[0]?.trim() ?? 'unknown';
      const lower = cookie.toLowerCase();

      if (!lower.includes('secure')) {
        findings.push({
          checkId: 'cookie-audit',
          title: `Cookie "${name}" missing Secure flag`,
          description: 'Cookie can be transmitted over insecure HTTP connections',
          severity: 'medium',
          evidence: cookie.substring(0, 200),
          recommendation: 'Add the Secure attribute to all cookies',
          cweId: 'CWE-614',
        });
      }

      if (!lower.includes('httponly')) {
        findings.push({
          checkId: 'cookie-audit',
          title: `Cookie "${name}" missing HttpOnly flag`,
          description: 'Cookie is accessible via JavaScript, making it vulnerable to XSS theft',
          severity: 'medium',
          evidence: cookie.substring(0, 200),
          recommendation: 'Add the HttpOnly attribute to prevent JavaScript access',
          cweId: 'CWE-1004',
        });
      }

      if (!lower.includes('samesite')) {
        findings.push({
          checkId: 'cookie-audit',
          title: `Cookie "${name}" missing SameSite attribute`,
          description: 'Cookie may be sent in cross-site requests, enabling CSRF attacks',
          severity: 'medium',
          evidence: cookie.substring(0, 200),
          recommendation: 'Set SameSite=Strict or SameSite=Lax',
          cweId: 'CWE-1275',
        });
      }

      if (lower.includes('samesite=none') && !lower.includes('secure')) {
        findings.push({
          checkId: 'cookie-audit',
          title: `Cookie "${name}" has SameSite=None without Secure`,
          description: 'SameSite=None requires the Secure attribute',
          severity: 'high',
          evidence: cookie.substring(0, 200),
          recommendation: 'Add Secure when using SameSite=None',
          cweId: 'CWE-614',
        });
      }
    }

    return {
      checkId: 'cookie-audit',
      status: findings.length > 0 ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
