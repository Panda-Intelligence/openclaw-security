import type { CheckDefinition, CheckResult, Finding } from '../../types.js';

const PUBLIC_ENDPOINTS = [
  { path: '/api/billing/plans', expectPublic: true, description: 'Billing plans (expected public)' },
  { path: '/api/billing/admin/credits/grant', expectPublic: false, description: 'Admin credit grant' },
  { path: '/api/agents', expectPublic: false, description: 'Agent listing' },
  { path: '/api/skills', expectPublic: false, description: 'Skill listing' },
  { path: '/api/chats', expectPublic: false, description: 'Chat listing' },
  { path: '/api/memories', expectPublic: false, description: 'Memory listing' },
  { path: '/api/schedules', expectPublic: false, description: 'Schedule listing' },
  { path: '/api/channels', expectPublic: false, description: 'Channel listing' },
  { path: '/api/runtime', expectPublic: false, description: 'Runtime status' },
  { path: '/api/auth/me', expectPublic: false, description: 'Auth me endpoint' },
];

const check: CheckDefinition = {
  id: 'public-endpoint-scan',
  name: 'Public Endpoint Scan',
  description: 'Tests if protected API endpoints are accessible without authentication',
  mode: 'passive',
  category: 'exposure',
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    const base = ctx.config.targetUrl;

    const results = await Promise.all(
      PUBLIC_ENDPOINTS.map(async (ep) => {
        try {
          const resp = await ctx.httpClient.get(`${base}${ep.path}`, { timeout: 5000 });
          return { ...ep, status: resp.status, body: resp.body.substring(0, 200) };
        } catch {
          return { ...ep, status: -1, body: '' };
        }
      }),
    );

    for (const r of results) {
      if (r.status === -1) continue;

      if (!r.expectPublic && r.status === 200) {
        findings.push({
          checkId: 'public-endpoint-scan',
          title: `Unprotected endpoint: ${r.path}`,
          description: `${r.description} (${r.path}) returns 200 without authentication`,
          severity: r.path.includes('admin') ? 'critical' : 'medium',
          evidence: `GET ${r.path} → ${r.status}`,
          recommendation: 'Ensure this endpoint requires authentication',
          cweId: 'CWE-306',
        });
      }
    }

    return {
      checkId: 'public-endpoint-scan',
      status: findings.length > 0 ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
