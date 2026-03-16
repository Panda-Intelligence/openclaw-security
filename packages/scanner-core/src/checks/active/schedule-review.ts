import type { CheckDefinition, CheckResult, Finding } from '../../types';

const SENSITIVE_KEYWORDS = [
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  /token/i,
  /credentials?/i,
  /private[_-]?key/i,
  /database/i,
];

const check: CheckDefinition = {
  id: 'schedule-review',
  name: 'Schedule Review',
  description: 'Reviews cron schedules for high-frequency execution and sensitive content in prompts',
  mode: 'active',
  category: 'config',
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    const schedules = ctx.activeData?.schedules ?? [];

    if (schedules.length === 0) {
      return { checkId: 'schedule-review', status: 'skipped', findings: [], durationMs: 0 };
    }

    for (const sched of schedules) {
      if (!sched.enabled) continue;

      // Check for high-frequency crons (more often than every 5 minutes)
      const frequency = estimateCronFrequency(sched.cron);
      if (frequency !== null && frequency < 5) {
        findings.push({
          checkId: 'schedule-review',
          title: `High-frequency schedule: every ~${frequency}min`,
          description: `Schedule for agent ${sched.agentId} runs very frequently (cron: ${sched.cron})`,
          severity: 'medium',
          evidence: `Cron: ${sched.cron} (estimated every ${frequency} minutes)`,
          recommendation: 'Review if this frequency is necessary — it may consume quotas rapidly',
        });
      }

      // Check for sensitive words in prompt
      for (const pattern of SENSITIVE_KEYWORDS) {
        if (pattern.test(sched.prompt)) {
          findings.push({
            checkId: 'schedule-review',
            title: 'Sensitive keyword in scheduled prompt',
            description: `Schedule prompt for agent ${sched.agentId} contains sensitive keywords`,
            severity: 'medium',
            evidence: `Prompt contains: ${pattern.source}`,
            recommendation: 'Remove sensitive information from scheduled prompts',
            cweId: 'CWE-798',
          });
          break;
        }
      }
    }

    return {
      checkId: 'schedule-review',
      status: findings.length > 0 ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

/** Rough estimate of how often a cron runs (in minutes). Returns null if unparseable. */
function estimateCronFrequency(cron: string): number | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return null;

  const minute = parts[0];
  if (!minute) return null;

  // Every minute
  if (minute === '*') return 1;

  // */N pattern
  const stepMatch = minute.match(/^\*\/(\d+)$/);
  if (stepMatch?.[1]) return parseInt(stepMatch[1]);

  // Specific minutes (comma-separated)
  if (minute.includes(',')) {
    const mins = minute
      .split(',')
      .map(Number)
      .filter((n) => !isNaN(n));
    if (mins.length >= 2) return Math.round(60 / mins.length);
  }

  return 60; // Default: once an hour for single-minute specs
}

export default check;
