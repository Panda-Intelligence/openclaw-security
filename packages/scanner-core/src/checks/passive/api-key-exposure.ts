import type { CheckDefinition, CheckResult, Finding, HttpResponse, Severity } from '../../types';

interface ExposurePattern {
  provider: string;
  regex: RegExp;
  severity: Severity;
  recommendation: string;
}

const PUBLIC_SCAN_PATHS = ['/', '/health', '/api/billing/plans', '/api/community/intelligence'] as const;

const EXPOSURE_PATTERNS: ExposurePattern[] = [
  {
    provider: 'OpenAI API key',
    regex: /\bsk-[A-Za-z0-9-]{20,}\b/g,
    severity: 'high',
    recommendation: 'Remove leaked OpenAI keys from public responses and rotate the compromised credential immediately.',
  },
  {
    provider: 'GitHub token',
    regex: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
    severity: 'high',
    recommendation: 'Remove leaked GitHub tokens from public responses and revoke the exposed token.',
  },
  {
    provider: 'AWS access key',
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    severity: 'high',
    recommendation: 'Remove leaked AWS access keys from responses and rotate the affected IAM credential.',
  },
  {
    provider: 'Stripe secret key',
    regex: /\bsk_(?:live|test)_[0-9A-Za-z]{16,}\b/g,
    severity: 'critical',
    recommendation: 'Remove leaked Stripe secret keys from public responses and rotate the key in the Stripe dashboard.',
  },
  {
    provider: 'Slack token',
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
    severity: 'high',
    recommendation: 'Remove leaked Slack tokens from public responses and revoke the exposed token from the Slack app settings.',
  },
];

function maskSecret(secret: string): string {
  if (secret.length <= 12) return `${secret.slice(0, 4)}…${secret.slice(-2)}`;
  return `${secret.slice(0, 6)}…${secret.slice(-4)}`;
}

function buildCandidateText(
  path: string,
  body: string,
  headers: Record<string, string>,
): Array<{ location: string; text: string }> {
  return [
    {
      location: `${path} body`,
      text: body.slice(0, 4000),
    },
    {
      location: `${path} headers`,
      text: Object.entries(headers)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n')
        .slice(0, 4000),
    },
  ];
}

const check: CheckDefinition = {
  id: 'api-key-exposure',
  name: 'API Key Exposure Scan',
  description: 'Scans public responses for leaked API keys and high-signal tokens',
  mode: 'passive',
  category: 'data',
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    const seen = new Set<string>();

    for (const path of PUBLIC_SCAN_PATHS) {
      const target = path === '/' ? ctx.config.targetUrl : `${ctx.config.targetUrl}${path}`;

      let response: HttpResponse;
      try {
        response = await ctx.httpClient.get(target, { timeout: 5000 });
      } catch {
        continue;
      }

      for (const candidate of buildCandidateText(path, response.body, response.headers)) {
        for (const pattern of EXPOSURE_PATTERNS) {
          const matches = candidate.text.match(pattern.regex) ?? [];

          for (const match of matches) {
            const key = `${pattern.provider}:${match}`;
            if (seen.has(key)) continue;
            seen.add(key);

            findings.push({
              checkId: 'api-key-exposure',
              title: `Possible ${pattern.provider} exposure`,
              description: `A public response appears to contain a ${pattern.provider.toLowerCase()} pattern.`,
              severity: pattern.severity,
              evidence: `${candidate.location}: ${maskSecret(match)}`,
              recommendation: pattern.recommendation,
              cweId: 'CWE-200',
            });
          }
        }
      }
    }

    return {
      checkId: 'api-key-exposure',
      status: findings.length > 0 ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
