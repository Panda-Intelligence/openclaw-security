import type { CheckDefinition, CheckResult, Finding } from '../../types';

function parseCspDirectives(policy: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();

  for (const segment of policy.split(';')) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const [name, ...values] = trimmed.split(/\s+/);
    if (!name) continue;
    directives.set(name.toLowerCase(), values);
  }

  return directives;
}

function hasUnsafeValue(values: string[], token: string): boolean {
  return values.some((value) => value === token);
}

function hasBroadSource(values: string[]): boolean {
  return values.some((value) => value === '*' || value === 'http:' || value === 'https:' || value === 'data:');
}

const check: CheckDefinition = {
  id: 'csp-deep-audit',
  name: 'CSP Deep Audit',
  description: 'Audits Content-Security-Policy directives for unsafe script execution and weak browser isolation',
  mode: 'passive',
  category: 'headers',
  run: async (ctx): Promise<CheckResult> => {
    const resp = await ctx.httpClient.get(ctx.config.targetUrl);
    const rawPolicy = resp.headers['content-security-policy'];

    if (!rawPolicy) {
      return {
        checkId: 'csp-deep-audit',
        status: 'skipped',
        findings: [],
        durationMs: 0,
      };
    }

    const findings: Finding[] = [];
    const directives = parseCspDirectives(rawPolicy);
    const scriptSrc = directives.get('script-src') ?? directives.get('default-src') ?? [];
    const objectSrc = directives.get('object-src') ?? [];
    const baseUri = directives.get('base-uri') ?? [];
    const frameAncestors = directives.get('frame-ancestors') ?? [];

    if (hasUnsafeValue(scriptSrc, "'unsafe-inline'")) {
      findings.push({
        checkId: 'csp-deep-audit',
        title: "CSP allows inline script execution",
        description: "The script policy includes 'unsafe-inline', which weakens XSS protections.",
        severity: 'high',
        evidence: `Content-Security-Policy: ${rawPolicy}`,
        recommendation: "Remove 'unsafe-inline' and use nonces or hashes for allowed inline scripts.",
        cweId: 'CWE-79',
      });
    }

    if (hasUnsafeValue(scriptSrc, "'unsafe-eval'")) {
      findings.push({
        checkId: 'csp-deep-audit',
        title: "CSP allows eval-style script execution",
        description: "The script policy includes 'unsafe-eval', which permits dangerous runtime code evaluation.",
        severity: 'high',
        evidence: `Content-Security-Policy: ${rawPolicy}`,
        recommendation: "Remove 'unsafe-eval' and refactor code that depends on eval-like execution paths.",
        cweId: 'CWE-95',
      });
    }

    if (hasBroadSource(scriptSrc)) {
      findings.push({
        checkId: 'csp-deep-audit',
        title: 'CSP script sources are overly broad',
        description: 'The script policy allows wildcard or scheme-wide sources, which expands script injection blast radius.',
        severity: 'medium',
        evidence: `script-src/default-src: ${scriptSrc.join(' ') || '(missing)'}`,
        recommendation: "Restrict script-src to explicit trusted origins plus 'self'.",
        cweId: 'CWE-693',
      });
    }

    if (objectSrc.length === 0 || !objectSrc.includes("'none'")) {
      findings.push({
        checkId: 'csp-deep-audit',
        title: 'CSP does not disable plugin/object execution',
        description: "object-src is missing or not locked to 'none', leaving legacy plugin surfaces less constrained.",
        severity: 'medium',
        evidence: `object-src: ${objectSrc.join(' ') || '(missing)'}`,
        recommendation: "Set object-src 'none' to disable legacy plugin/object execution.",
        cweId: 'CWE-16',
      });
    }

    if (baseUri.length === 0) {
      findings.push({
        checkId: 'csp-deep-audit',
        title: 'CSP missing base-uri restriction',
        description: 'base-uri is not defined, so attackers may have more room to abuse base tag injection.',
        severity: 'low',
        evidence: `Content-Security-Policy: ${rawPolicy}`,
        recommendation: "Set base-uri 'self' or 'none' to constrain base tag behavior.",
        cweId: 'CWE-1021',
      });
    }

    if (frameAncestors.length === 0 || hasBroadSource(frameAncestors)) {
      findings.push({
        checkId: 'csp-deep-audit',
        title: 'CSP framing policy is weak or missing',
        description: 'frame-ancestors is missing or overly broad, which weakens clickjacking defenses.',
        severity: 'medium',
        evidence: `frame-ancestors: ${frameAncestors.join(' ') || '(missing)'}`,
        recommendation: "Set frame-ancestors 'none' or a strict allowlist of trusted origins.",
        cweId: 'CWE-1021',
      });
    }

    return {
      checkId: 'csp-deep-audit',
      status: findings.length > 0 ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
