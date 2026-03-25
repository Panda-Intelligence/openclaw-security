import { registerCheck } from '../check-registry';
import { setCheckCategory } from '../scoring';
import agentConfigReview from './active/agent-config-review';
import channelCredentialStatus from './active/channel-credential-status';
// Active checks
import jwtSecurity from './active/jwt-security';
import memoryInjectionScan from './active/memory-injection-scan';
import scheduleReview from './active/schedule-review';
import skillAudit from './active/skill-audit';
import adminEndpointProbe from './passive/admin-endpoint-probe';
import apiKeyExposure from './passive/api-key-exposure';
import containerVersion from './passive/container-version';
import cookieAudit from './passive/cookie-audit';
import corsAudit from './passive/cors-audit';
import cspDeepAudit from './passive/csp-deep-audit';
import errorDisclosure from './passive/error-disclosure';
// Passive checks
import healthFingerprint from './passive/health-fingerprint';
import hstsPreload from './passive/hsts-preload';
import oauthEnumeration from './passive/oauth-enumeration';
import publicEndpointScan from './passive/public-endpoint-scan';
import rateLimitProbe from './passive/rate-limit-probe';
import securityHeaders from './passive/security-headers';
import tlsAnalysis from './passive/tls-analysis';
import versionCve from './passive/version-cve';
import websocketExposure from './passive/websocket-exposure';

const allChecks = [
  // Passive
  healthFingerprint,
  versionCve,
  securityHeaders,
  apiKeyExposure,
  cspDeepAudit,
  corsAudit,
  rateLimitProbe,
  oauthEnumeration,
  publicEndpointScan,
  tlsAnalysis,
  cookieAudit,
  websocketExposure,
  adminEndpointProbe,
  errorDisclosure,
  hstsPreload,
  containerVersion,
  // Active
  jwtSecurity,
  agentConfigReview,
  memoryInjectionScan,
  skillAudit,
  scheduleReview,
  channelCredentialStatus,
];

export function registerAllChecks(): void {
  for (const check of allChecks) {
    registerCheck(check);
    setCheckCategory(check.id, check.category);
  }
}

// Auto-register on import
registerAllChecks();
