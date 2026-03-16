import { auditAlgorithm, auditClaims, decodeJwt, getAlgorithm, isExpired } from '../../jwt-analyzer';
import type { CheckDefinition, CheckResult, Finding } from '../../types';

const check: CheckDefinition = {
  id: 'jwt-security',
  name: 'JWT Security Audit',
  description: 'Analyzes JWT algorithm, expiration policy, and claims structure',
  mode: 'active',
  category: 'auth',
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    const jwt = ctx.config.jwt;

    if (!jwt) {
      return { checkId: 'jwt-security', status: 'skipped', findings: [], durationMs: 0 };
    }

    const decoded = decodeJwt(jwt);
    if (!decoded) {
      findings.push({
        checkId: 'jwt-security',
        title: 'Invalid JWT format',
        description: 'The provided token is not a valid JWT',
        severity: 'high',
        evidence: 'Token could not be decoded as a three-part JWT',
        recommendation: 'Ensure the token is a properly formatted JWT',
      });
      return { checkId: 'jwt-security', status: 'fail', findings, durationMs: 0 };
    }

    // Algorithm audit
    const alg = getAlgorithm(decoded.header);
    const algResult = auditAlgorithm(alg);
    if (!algResult.secure) {
      findings.push({
        checkId: 'jwt-security',
        title: `Weak JWT algorithm: ${alg}`,
        description: algResult.reason,
        severity: alg === 'none' ? 'critical' : 'high',
        evidence: `Algorithm: ${alg}`,
        recommendation: 'Use HS384, HS512, RS384, RS512, or ES256+',
        cweId: 'CWE-327',
      });
    }

    // Expiration check
    if (isExpired(decoded.payload)) {
      findings.push({
        checkId: 'jwt-security',
        title: 'JWT has expired',
        description: 'The provided token has passed its expiration time',
        severity: 'info',
        evidence: `exp: ${decoded.payload.exp}`,
        recommendation: 'Use a fresh token for accurate security analysis',
      });
    }

    // Claims audit
    const claimIssues = auditClaims(decoded.payload);
    for (const issue of claimIssues) {
      findings.push({
        checkId: 'jwt-security',
        title: `JWT claim issue: ${issue}`,
        description: issue,
        severity: issue.includes('Missing') ? 'medium' : 'low',
        evidence: `Claims: ${JSON.stringify(Object.keys(decoded.payload))}`,
        recommendation: 'Include standard claims (sub, exp, iat) in JWT tokens',
        cweId: 'CWE-287',
      });
    }

    // Check for sensitive data in payload
    const sensitiveKeys = ['password', 'secret', 'apiKey', 'api_key', 'credit_card'];
    for (const key of sensitiveKeys) {
      if (key in decoded.payload) {
        findings.push({
          checkId: 'jwt-security',
          title: `Sensitive data in JWT payload: ${key}`,
          description: 'JWT tokens are base64-encoded (not encrypted) and should not contain secrets',
          severity: 'critical',
          evidence: `JWT payload contains key: ${key}`,
          recommendation: 'Remove sensitive data from JWT payloads',
          cweId: 'CWE-312',
        });
      }
    }

    return {
      checkId: 'jwt-security',
      status: findings.length > 0 ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
