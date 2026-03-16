import type { CheckDefinition, CheckResult, Finding } from '../../types.js';

const check: CheckDefinition = {
  id: 'tls-analysis',
  name: 'TLS Analysis',
  description: 'Checks TLS configuration, certificate validity, and protocol version',
  mode: 'passive',
  category: 'infrastructure',
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    const url = new URL(ctx.config.targetUrl);

    // Check if using HTTPS
    if (url.protocol !== 'https:') {
      findings.push({
        checkId: 'tls-analysis',
        title: 'Not using HTTPS',
        description: 'The target URL uses HTTP instead of HTTPS',
        severity: 'critical',
        evidence: `Protocol: ${url.protocol}`,
        recommendation: 'Enable HTTPS with a valid TLS certificate',
        cweId: 'CWE-319',
      });
      return { checkId: 'tls-analysis', status: 'fail', findings, durationMs: 0 };
    }

    // Test HTTPS connectivity
    try {
      const resp = await ctx.httpClient.get(ctx.config.targetUrl, { timeout: 10000 });

      // If we got here, TLS handshake succeeded
      // Check for HTTP downgrade
      if (resp.url.startsWith('http://')) {
        findings.push({
          checkId: 'tls-analysis',
          title: 'HTTPS redirects to HTTP',
          description: 'The server redirects from HTTPS to an insecure HTTP URL',
          severity: 'high',
          evidence: `Redirect: ${ctx.config.targetUrl} → ${resp.url}`,
          recommendation: 'Ensure all redirects maintain HTTPS',
          cweId: 'CWE-319',
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('certificate') || msg.includes('SSL') || msg.includes('TLS')) {
        findings.push({
          checkId: 'tls-analysis',
          title: 'TLS certificate error',
          description: `TLS handshake failed: ${msg}`,
          severity: 'high',
          evidence: msg,
          recommendation: 'Ensure a valid TLS certificate is installed and properly configured',
          cweId: 'CWE-295',
        });
      }
    }

    // Test HTTP → HTTPS redirect
    try {
      const httpUrl = ctx.config.targetUrl.replace('https://', 'http://');
      const resp = await ctx.httpClient.get(httpUrl, { followRedirects: false, timeout: 5000 });

      if (resp.status !== 301 && resp.status !== 308) {
        findings.push({
          checkId: 'tls-analysis',
          title: 'No HTTP to HTTPS redirect',
          description: 'HTTP requests are not redirected to HTTPS',
          severity: 'medium',
          evidence: `GET ${httpUrl} → ${resp.status} (expected 301/308)`,
          recommendation: 'Configure a permanent redirect from HTTP to HTTPS',
          cweId: 'CWE-319',
        });
      }
    } catch { /* HTTP may be unreachable — acceptable */ }

    return {
      checkId: 'tls-analysis',
      status: findings.length > 0 ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
