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
export {
  buildOpenClawUpstreamSnapshot,
  fetchOpenClawAdvisoryFeed,
  mergeVersionDatabaseWithAdvisories,
  OPENCLAW_GIT_URL,
  OPENCLAW_REPOSITORY,
  type OpenClawAdvisoryRecord,
  type OpenClawAdvisoryReference,
  type OpenClawVersionAdvisoryRecord,
} from './openclaw-feed';
export {
  getLatestPrerelease,
  getLatestStableRelease,
  getOpenClawUpstreamSnapshot,
  type OpenClawCommitRecord,
  type OpenClawReleaseRecord,
  type OpenClawUpstreamSnapshot,
} from './openclaw-upstream';
export { scan } from './scanner';
export { computeScore, countSeverities, setCheckCategory } from './scoring';
export * from './types';
export {
  buildVersionDatabaseFromSnapshot,
  getCvesForVersion,
  getLatestVersion,
  getVersionDatabase,
  isEol,
  isOutdated,
  lookupVersion,
  type CveEntry,
  type VersionEntry,
} from './version-db';

// Side-effect: registers all checks
import './checks/index';
