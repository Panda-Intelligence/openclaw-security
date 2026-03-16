import type { CheckDefinition, CheckResult, Finding } from '../../types.js';

const MALFORMED_REQUESTS = [
  { path: '/api/agents/../../etc/passwd', description: 'Path traversal attempt' },
  { path: '/api/agents/%00', description: 'Null byte injection' },
  { path: "/api/agents/<script>alert(1)</script>", description: 'XSS in path' },
  { path: '/api/agents/undefined', description: 'Undefined resource ID' },
  { path: '/api/nonexistent', description: 'Non-existent route' },
];

const STACK_TRACE_PATTERNS = [
  /at\s+\w+\s+\(.*:\d+:\d+\)/i,    // "at Function (file.js:10:5)"
  /Error:.*\n\s+at\s/,               // Multi-line stack trace
  /node_modules\//,                    // Node module paths
  /src\/.*\.ts:\d+/,                  // TypeScript source paths
  /\.wrangler\//,                     // Wrangler internals
  /Traceback \(most recent/,          // Python traces
  /panic:.*goroutine/,                // Go panics
];

const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  /database.*url/i,
  /connection.*string/i,
  /internal.*error/i,
];

const check: CheckDefinition = {
  id: 'error-disclosure',
  name: 'Error Information Disclosure',
  description: 'Sends malformed requests and checks for stack traces or sensitive info in error responses',
  mode: 'passive',
  category: 'exposure',
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    const base = ctx.config.targetUrl;

    for (const req of MALFORMED_REQUESTS) {
      try {
        const resp = await ctx.httpClient.get(`${base}${req.path}`, { timeout: 5000 });

        if (resp.status >= 400) {
          // Check for stack traces
          for (const pattern of STACK_TRACE_PATTERNS) {
            if (pattern.test(resp.body)) {
              findings.push({
                checkId: 'error-disclosure',
                title: `Stack trace in error response (${req.description})`,
                description: 'Error response contains stack trace information that reveals internal implementation details',
                severity: 'medium',
                evidence: resp.body.substring(0, 300),
                recommendation: 'Return generic error messages in production. Log details server-side only.',
                cweId: 'CWE-209',
              });
              break;
            }
          }

          // Check for sensitive info
          for (const pattern of SENSITIVE_PATTERNS) {
            if (pattern.test(resp.body)) {
              findings.push({
                checkId: 'error-disclosure',
                title: `Sensitive keyword in error response (${req.description})`,
                description: 'Error response may contain sensitive configuration or credential information',
                severity: 'medium',
                evidence: `Pattern matched: ${pattern.source} in response to ${req.path}`,
                recommendation: 'Sanitize error responses to remove sensitive information',
                cweId: 'CWE-209',
              });
              break;
            }
          }
        }
      } catch { /* timeout */ }
    }

    return {
      checkId: 'error-disclosure',
      status: findings.length > 0 ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
