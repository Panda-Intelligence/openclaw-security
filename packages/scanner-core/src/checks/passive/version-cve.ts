import type { CheckDefinition, CheckResult, Finding } from '../../types.js';
import { getCvesForVersion, isEol, isOutdated, getLatestVersion } from '../../version-db.js';

const check: CheckDefinition = {
  id: 'version-cve',
  name: 'Version CVE Check',
  description: 'Matches detected version against known CVE database',
  mode: 'passive',
  category: 'infrastructure',
  dependsOn: ['health-fingerprint'],
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    const version = ctx.platformInfo.version;

    if (!version) {
      return { checkId: 'version-cve', status: 'skipped', findings: [], durationMs: 0 };
    }

    const cves = getCvesForVersion(version);
    for (const cve of cves) {
      findings.push({
        checkId: 'version-cve',
        title: `Known vulnerability: ${cve.id}`,
        description: cve.description,
        severity: cve.severity,
        evidence: `Version ${version} is affected by ${cve.id}`,
        recommendation: cve.fixedIn
          ? `Upgrade to version ${cve.fixedIn} or later`
          : 'Apply vendor patches',
        cweId: 'CWE-1035',
      });
    }

    if (isEol(version)) {
      findings.push({
        checkId: 'version-cve',
        title: 'End-of-life version',
        description: `Version ${version} has reached end-of-life and no longer receives security updates`,
        severity: 'high',
        evidence: `Running: ${version}, Latest: ${getLatestVersion()}`,
        recommendation: `Upgrade to the latest version (${getLatestVersion()})`,
      });
    } else if (isOutdated(version)) {
      findings.push({
        checkId: 'version-cve',
        title: 'Outdated version',
        description: `Version ${version} is not the latest release`,
        severity: 'low',
        evidence: `Running: ${version}, Latest: ${getLatestVersion()}`,
        recommendation: `Consider upgrading to ${getLatestVersion()}`,
      });
    }

    return {
      checkId: 'version-cve',
      status: findings.some((f) => f.severity === 'critical' || f.severity === 'high') ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
