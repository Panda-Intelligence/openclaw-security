import type { CheckDefinition, CheckResult, Finding } from '../../types';

const check: CheckDefinition = {
  id: 'websocket-exposure',
  name: 'WebSocket Exposure Check',
  description: 'Tests if WebSocket endpoints are accessible without authentication',
  mode: 'passive',
  category: 'exposure',
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    const base = ctx.config.targetUrl;

    // Common WS upgrade paths
    const wsPaths = ['/ws', '/api/ws', '/api/chats/ws', '/api/runtime/ws'];

    for (const path of wsPaths) {
      try {
        const resp = await ctx.httpClient.get(`${base}${path}`, {
          headers: {
            Upgrade: 'websocket',
            Connection: 'Upgrade',
            'Sec-WebSocket-Version': '13',
            'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
          },
          timeout: 5000,
        });

        if (resp.status === 101) {
          findings.push({
            checkId: 'websocket-exposure',
            title: `WebSocket endpoint accessible: ${path}`,
            description: 'WebSocket upgrade succeeded without authentication',
            severity: 'medium',
            evidence: `GET ${path} with Upgrade: websocket → 101`,
            recommendation: 'Require authentication before accepting WebSocket upgrades',
            cweId: 'CWE-306',
          });
        } else if (resp.status === 426) {
          // Upgrade Required — endpoint exists but rejected
          findings.push({
            checkId: 'websocket-exposure',
            title: `WebSocket endpoint found: ${path}`,
            description: 'WebSocket endpoint exists (returned 426 Upgrade Required)',
            severity: 'info',
            evidence: `GET ${path} → ${resp.status}`,
            recommendation: 'Ensure WebSocket authentication is enforced.',
          });
        }
      } catch {
        /* timeout or error — endpoint doesn't exist */
      }
    }

    return {
      checkId: 'websocket-exposure',
      status: findings.some((f) => f.severity !== 'info') ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
