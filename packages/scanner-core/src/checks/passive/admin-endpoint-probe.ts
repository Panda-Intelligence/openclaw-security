import type { CheckDefinition, CheckResult, Finding } from '../../types';

const ADMIN_ENDPOINTS = [
  { path: '/api/billing/admin/credits/grant', method: 'POST', body: { tenantId: 'test', amount: 1 } },
  { path: '/api/billing/admin/credits/grant', method: 'GET', body: null },
  { path: '/api/admin', method: 'GET', body: null },
  { path: '/api/admin/tenants', method: 'GET', body: null },
  { path: '/api/billing/webhook', method: 'GET', body: null },
];

const check: CheckDefinition = {
  id: 'admin-endpoint-probe',
  name: 'Admin Endpoint Probe',
  description: 'Tests admin-level endpoints for authentication bypass',
  mode: 'passive',
  category: 'auth',
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    const base = ctx.config.targetUrl;

    for (const ep of ADMIN_ENDPOINTS) {
      try {
        let resp;
        if (ep.method === 'POST' && ep.body) {
          resp = await ctx.httpClient.post(`${base}${ep.path}`, ep.body, { timeout: 5000 });
        } else {
          resp = await ctx.httpClient.get(`${base}${ep.path}`, { timeout: 5000 });
        }

        // 200 or 201 without auth = critical
        if (resp.status >= 200 && resp.status < 300) {
          findings.push({
            checkId: 'admin-endpoint-probe',
            title: `Admin endpoint accessible without auth: ${ep.path}`,
            description: `${ep.method} ${ep.path} returns ${resp.status} without authentication token`,
            severity: 'critical',
            evidence: `${ep.method} ${ep.path} → ${resp.status}: ${resp.body.substring(0, 100)}`,
            recommendation: 'Ensure admin endpoints require admin-level authentication',
            cweId: 'CWE-306',
          });
        }

        // 500 = may leak info
        if (resp.status === 500) {
          findings.push({
            checkId: 'admin-endpoint-probe',
            title: `Admin endpoint returns server error: ${ep.path}`,
            description: `${ep.method} ${ep.path} returns 500, suggesting the endpoint exists but crashes`,
            severity: 'medium',
            evidence: `${ep.method} ${ep.path} → 500: ${resp.body.substring(0, 100)}`,
            recommendation: 'Return 401/403 for unauthenticated requests, not 500',
            cweId: 'CWE-209',
          });
        }
      } catch {
        /* timeout — endpoint may not exist */
      }
    }

    return {
      checkId: 'admin-endpoint-probe',
      status: findings.length > 0 ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
