import type { CheckDefinition, CheckResult, Finding } from '../../types.js';

const check: CheckDefinition = {
  id: 'cors-audit',
  name: 'CORS Configuration Audit',
  description: 'Tests for overly permissive CORS configurations and credential reflection',
  mode: 'passive',
  category: 'auth',
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    const base = ctx.config.targetUrl;

    // Test 1: Wildcard origin
    const resp1 = await ctx.httpClient.get(`${base}/api/billing/plans`, {
      headers: { 'Origin': 'https://evil.example.com' },
    });

    const acao = resp1.headers['access-control-allow-origin'];
    const acac = resp1.headers['access-control-allow-credentials'];

    if (acao === '*') {
      findings.push({
        checkId: 'cors-audit',
        title: 'CORS allows all origins',
        description: 'Access-Control-Allow-Origin is set to wildcard (*)',
        severity: acac === 'true' ? 'critical' : 'medium',
        evidence: `Access-Control-Allow-Origin: ${acao}`,
        recommendation: 'Restrict CORS to specific trusted origins',
        cweId: 'CWE-942',
      });
    }

    // Test 2: Origin reflection
    if (acao === 'https://evil.example.com') {
      findings.push({
        checkId: 'cors-audit',
        title: 'CORS reflects arbitrary origins',
        description: 'The server reflects the Origin header value in Access-Control-Allow-Origin',
        severity: 'critical',
        evidence: `Origin: https://evil.example.com → ACAO: ${acao}`,
        recommendation: 'Validate origins against an allowlist instead of reflecting',
        cweId: 'CWE-942',
      });
    }

    // Test 3: Credentials with permissive origin
    if (acac === 'true' && (acao === '*' || acao === 'https://evil.example.com')) {
      findings.push({
        checkId: 'cors-audit',
        title: 'Credentials allowed with permissive CORS',
        description: 'Access-Control-Allow-Credentials is true with a permissive origin policy',
        severity: 'critical',
        evidence: `ACAO: ${acao}, ACAC: ${acac}`,
        recommendation: 'Never combine Allow-Credentials: true with wildcard or reflected origins',
        cweId: 'CWE-942',
      });
    }

    // Test 4: Preflight check
    try {
      const preflight = await ctx.httpClient.options(`${base}/api/agents`, {
        headers: {
          'Origin': 'https://evil.example.com',
          'Access-Control-Request-Method': 'DELETE',
          'Access-Control-Request-Headers': 'Authorization',
        },
      });

      const allowMethods = preflight.headers['access-control-allow-methods'];
      if (allowMethods?.includes('DELETE') || allowMethods?.includes('*')) {
        findings.push({
          checkId: 'cors-audit',
          title: 'CORS preflight allows destructive methods from untrusted origins',
          description: 'DELETE method is allowed in CORS preflight for arbitrary origins',
          severity: 'high',
          evidence: `Access-Control-Allow-Methods: ${allowMethods}`,
          recommendation: 'Restrict allowed methods per origin',
          cweId: 'CWE-942',
        });
      }
    } catch { /* preflight failed — acceptable */ }

    return {
      checkId: 'cors-audit',
      status: findings.length > 0 ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
