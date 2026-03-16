import type { CheckDefinition, CheckResult, Finding } from '../../types';

const check: CheckDefinition = {
  id: 'skill-audit',
  name: 'Skill Audit',
  description: 'Reviews installed skills for non-bundled sources, dependency issues, and inactive skills',
  mode: 'active',
  category: 'config',
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    const skills = ctx.activeData?.skills ?? [];

    if (skills.length === 0) {
      return { checkId: 'skill-audit', status: 'skipped', findings: [], durationMs: 0 };
    }

    const nonBundled = skills.filter((s) => !s.isBundled);
    if (nonBundled.length > 0) {
      findings.push({
        checkId: 'skill-audit',
        title: `${nonBundled.length} non-bundled skill(s) installed`,
        description: 'Custom skills may not have undergone the same security review as bundled skills',
        severity: 'medium',
        evidence: nonBundled.map((s) => `${s.name} (source: ${s.source})`).join(', '),
        recommendation: 'Review the source code and permissions of all custom skills',
      });

      // Check each non-bundled skill source
      for (const skill of nonBundled) {
        if (skill.source.includes('http://')) {
          findings.push({
            checkId: 'skill-audit',
            title: `Skill loaded over HTTP: ${skill.name}`,
            description: 'Skill source uses insecure HTTP, vulnerable to man-in-the-middle attacks',
            severity: 'high',
            evidence: `Source: ${skill.source}`,
            recommendation: 'Use HTTPS for all skill sources',
            cweId: 'CWE-319',
          });
        }
      }
    }

    // Check for skills in error state
    const failedSkills = skills.filter((s) => s.status === 'failed' || s.status === 'error');
    if (failedSkills.length > 0) {
      findings.push({
        checkId: 'skill-audit',
        title: `${failedSkills.length} skill(s) in error state`,
        description: 'Failed skills may indicate dependency or compatibility issues',
        severity: 'low',
        evidence: failedSkills.map((s) => `${s.name}: ${s.status}`).join(', '),
        recommendation: 'Remove or fix failed skills',
      });
    }

    return {
      checkId: 'skill-audit',
      status: findings.length > 0 ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
