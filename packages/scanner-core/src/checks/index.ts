import { registerCheck } from '../check-registry.js';
import { setCheckCategory } from '../scoring.js';

// Passive checks
import healthFingerprint from './passive/health-fingerprint.js';
import versionCve from './passive/version-cve.js';
import securityHeaders from './passive/security-headers.js';
import corsAudit from './passive/cors-audit.js';
import rateLimitProbe from './passive/rate-limit-probe.js';
import oauthEnumeration from './passive/oauth-enumeration.js';
import publicEndpointScan from './passive/public-endpoint-scan.js';
import tlsAnalysis from './passive/tls-analysis.js';
import cookieAudit from './passive/cookie-audit.js';
import websocketExposure from './passive/websocket-exposure.js';
import adminEndpointProbe from './passive/admin-endpoint-probe.js';
import errorDisclosure from './passive/error-disclosure.js';
import hstsPreload from './passive/hsts-preload.js';
import containerVersion from './passive/container-version.js';

// Active checks
import jwtSecurity from './active/jwt-security.js';
import agentConfigReview from './active/agent-config-review.js';
import memoryInjectionScan from './active/memory-injection-scan.js';
import skillAudit from './active/skill-audit.js';
import scheduleReview from './active/schedule-review.js';
import channelCredentialStatus from './active/channel-credential-status.js';

const allChecks = [
  // Passive
  healthFingerprint,
  versionCve,
  securityHeaders,
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
