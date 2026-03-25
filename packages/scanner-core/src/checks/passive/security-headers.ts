import type { CheckDefinition, CheckResult, Finding } from '../../types';

interface HeaderCheck {
  header: string;
  required: boolean;
  validate?: (value: string) => string | null; // returns issue or null
  recommendation: string;
  cweId?: string;
}

const HEADER_CHECKS: HeaderCheck[] = [
  {
    header: 'strict-transport-security',
    required: true,
    validate: (v) => {
      const maxAge = parseInt(v.match(/max-age=(\d+)/)?.[1] ?? '0');
      if (maxAge < 31536000) return `max-age is ${maxAge}, should be at least 31536000 (1 year)`;
      return null;
    },
    recommendation: 'Set Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
    cweId: 'CWE-319',
  },
  {
    header: 'content-security-policy',
    required: true,
    recommendation: 'Set a restrictive Content-Security-Policy header',
    cweId: 'CWE-693',
  },
  {
    header: 'x-content-type-options',
    required: true,
    validate: (v) => (v !== 'nosniff' ? `Expected "nosniff", got "${v}"` : null),
    recommendation: 'Set X-Content-Type-Options: nosniff',
    cweId: 'CWE-16',
  },
  {
    header: 'x-frame-options',
    required: true,
    validate: (v) => {
      const val = v.toUpperCase();
      if (val !== 'DENY' && val !== 'SAMEORIGIN') return `Unexpected value: ${v}`;
      return null;
    },
    recommendation: 'Set X-Frame-Options: DENY or SAMEORIGIN',
    cweId: 'CWE-1021',
  },
  {
    header: 'referrer-policy',
    required: true,
    validate: (v) => {
      const safe = ['no-referrer', 'same-origin', 'strict-origin', 'strict-origin-when-cross-origin'];
      if (!safe.includes(v)) return `Policy "${v}" may leak referrer data`;
      return null;
    },
    recommendation: 'Set Referrer-Policy: strict-origin-when-cross-origin',
    cweId: 'CWE-200',
  },
  {
    header: 'permissions-policy',
    required: false,
    recommendation: 'Set Permissions-Policy to restrict browser features (camera, microphone, geolocation)',
  },
  {
    header: 'x-xss-protection',
    required: false,
    validate: (v) => {
      if (v === '0') return null; // explicitly disabled is fine for modern browsers with CSP
      if (v !== '1; mode=block') return `Unexpected value: ${v}`;
      return null;
    },
    recommendation: 'Set X-XSS-Protection: 0 (rely on CSP instead) or 1; mode=block',
  },
];

const check: CheckDefinition = {
  id: 'security-headers',
  name: 'Security Headers Audit',
  description: 'Checks for presence and correct configuration of security-related HTTP headers',
  mode: 'passive',
  category: 'headers',
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    const resp = await ctx.httpClient.get(ctx.config.targetUrl);

    for (const hc of HEADER_CHECKS) {
      const value = resp.headers[hc.header];

      if (!value) {
        if (hc.required) {
          findings.push({
            checkId: 'security-headers',
            title: `Missing header: ${hc.header}`,
            description: `The ${hc.header} header is not set`,
            severity: 'high',
            evidence: `Response headers do not include ${hc.header}`,
            recommendation: hc.recommendation,
            cweId: hc.cweId,
          });
        }
        continue;
      }

      if (hc.validate) {
        const issue = hc.validate(value);
        if (issue) {
          findings.push({
            checkId: 'security-headers',
            title: `Misconfigured header: ${hc.header}`,
            description: issue,
            severity: 'medium',
            evidence: `${hc.header}: ${value}`,
            recommendation: hc.recommendation,
            cweId: hc.cweId,
          });
        }
      }
    }

    // Check for information-disclosure headers
    const leakyHeaders = ['x-powered-by', 'server'];
    for (const h of leakyHeaders) {
      if (resp.headers[h]) {
        findings.push({
          checkId: 'security-headers',
          title: `Information disclosure: ${h}`,
          description: `The ${h} header reveals server technology`,
          severity: 'low',
          evidence: `${h}: ${resp.headers[h]}`,
          recommendation: `Remove or obfuscate the ${h} header`,
          cweId: 'CWE-200',
        });
      }
    }

    return {
      checkId: 'security-headers',
      status: findings.length > 0 ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
