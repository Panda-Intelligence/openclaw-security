export * from './types.js';
export { scan } from './scanner.js';
export { registerCheck, getCheck, getAllChecks, getChecksByMode, topoSort } from './check-registry.js';
export { runChecks } from './check-runner.js';
export { computeScore, countSeverities, setCheckCategory } from './scoring.js';
export { createHttpClient } from './http-client.js';
export { decodeJwt, isExpired, getAlgorithm, auditAlgorithm, auditClaims } from './jwt-analyzer.js';
export { lookupVersion, getCvesForVersion, isEol, isOutdated, getLatestVersion } from './version-db.js';
export { formatReport } from './report-formatter.js';

// Side-effect: registers all checks
import './checks/index.js';
