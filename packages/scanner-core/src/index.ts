export { getAllChecks, getCheck, getChecksByMode, registerCheck, topoSort } from './check-registry';
export { runChecks } from './check-runner';
export { createHttpClient } from './http-client';
export {
  auditAlgorithm,
  auditClaims,
  decodeJwt,
  getAlgorithm,
  isExpired,
  type JwtHeader,
  type JwtParts,
  type JwtPayload,
} from './jwt-analyzer';
export { formatReport } from './report-formatter';
export { scan } from './scanner';
export { computeScore, countSeverities, setCheckCategory } from './scoring';
export * from './types';
export { getCvesForVersion, getLatestVersion, isEol, isOutdated, lookupVersion } from './version-db';

// Side-effect: registers all checks
import './checks/index';
