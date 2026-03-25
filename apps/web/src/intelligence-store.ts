import {
  buildOpenClawUpstreamSnapshot,
  buildVersionDatabaseFromSnapshot,
  fetchOpenClawAdvisoryFeed,
  mergeVersionDatabaseWithAdvisories,
  type OpenClawUpstreamSnapshot,
  type OpenClawVersionAdvisoryRecord,
} from '@panda-ai/ocs-core';
import {
  buildIntelligenceOverview,
  type IntelligenceBoardItem,
  type IntelligenceOverview,
} from './intelligence';

type FetchLike = typeof fetch;

export const INTELLIGENCE_META_KEYS = {
  upstreamSnapshot: 'intelligence_upstream_snapshot',
  advisoryFeed: 'intelligence_advisory_feed',
  refreshedAt: 'intelligence_refreshed_at',
  refreshError: 'intelligence_refresh_error',
} as const;

async function getMetaValue(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare(`SELECT value FROM app_meta WHERE key = ?`).bind(key).first();
  return (row?.['value'] as string | undefined) ?? null;
}

async function setMetaValue(db: D1Database, key: string, value: string): Promise<void> {
  await db.prepare(
    `INSERT INTO app_meta (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  )
    .bind(key, value)
    .run();
}

function parseJsonValue<T>(value: string | null): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function buildOverviewFromCache(
  snapshot: OpenClawUpstreamSnapshot,
  advisoryFeed: OpenClawVersionAdvisoryRecord[],
  capturedAt: string | undefined,
  versionImpactCounts: Record<string, number>,
  communitySignals: IntelligenceBoardItem[],
): IntelligenceOverview {
  const baseDatabase = buildVersionDatabaseFromSnapshot(snapshot);
  const mergedDatabase = mergeVersionDatabaseWithAdvisories(baseDatabase, advisoryFeed);

  return buildIntelligenceOverview({
    upstreamSnapshot: snapshot,
    versionDatabase: mergedDatabase,
    versionImpactCounts,
    communitySignals,
    capturedAt,
  });
}

function parseSeverityCounts(value: unknown): Record<string, number> {
  if (typeof value !== 'string') return {};

  try {
    return JSON.parse(value) as Record<string, number>;
  } catch {
    return {};
  }
}

function normalizeRiskFromSeverity(severity: string | undefined): IntelligenceBoardItem['risk'] {
  if (severity === 'critical' || severity === 'high' || severity === 'medium' || severity === 'low') {
    return severity;
  }
  return 'medium';
}

export async function getCommunityVersionImpactCounts(db: D1Database): Promise<Record<string, number>> {
  const result = await db
    .prepare(
      `SELECT platform_version AS version, COUNT(*) AS count
       FROM community_reports
       WHERE platform_version IS NOT NULL AND TRIM(platform_version) != ''
       GROUP BY platform_version`,
    )
    .all();

  return result.results.reduce<Record<string, number>>((counts, row) => {
    const version = row['version'];
    if (typeof version === 'string' && version.length > 0) {
      counts[version] = Number(row['count'] ?? 0);
    }
    return counts;
  }, {});
}

export async function getCommunityThreatSignals(db: D1Database): Promise<IntelligenceBoardItem[]> {
  const [reportsResult, topIssue, recentLowScore] = await Promise.all([
    db.prepare(`SELECT score, severity_counts, finding_count FROM community_reports`).all(),
    db
      .prepare(
        `SELECT check_id, title, severity, COUNT(*) as count
         FROM findings
         GROUP BY check_id, title, severity
         ORDER BY count DESC, title ASC
         LIMIT 1`,
      )
      .first(),
    db
      .prepare(
        `SELECT COUNT(*) as count
         FROM community_reports
         WHERE uploaded_at >= date('now', '-30 days') AND score < 60`,
      )
      .first(),
  ]);

  const reports = reportsResult.results;
  if (reports.length === 0 && !topIssue) {
    return [];
  }

  let criticalCount = 0;
  let highCount = 0;
  let affectedReports = 0;
  let totalFindings = 0;

  for (const row of reports) {
    const severityCounts = parseSeverityCounts(row['severity_counts']);
    const rowCritical = Number(severityCounts['critical'] ?? 0);
    const rowHigh = Number(severityCounts['high'] ?? 0);

    criticalCount += rowCritical;
    highCount += rowHigh;
    totalFindings += Number(row['finding_count'] ?? 0);

    if (rowCritical > 0 || rowHigh > 0) {
      affectedReports += 1;
    }
  }

  const signals: IntelligenceBoardItem[] = [];

  if (reports.length > 0) {
    signals.push({
      name: 'Anonymous deployment severity concentration',
      risk: criticalCount > 0 ? 'critical' : highCount > 0 ? 'high' : 'medium',
      summary: `Anonymous community submissions currently include ${criticalCount} critical and ${highCount} high findings across ${reports.length} deployment${reports.length === 1 ? '' : 's'}.`,
      signal: `Affected reports: ${affectedReports}/${reports.length} · Total findings logged: ${totalFindings}`,
    });
  }

  if (topIssue) {
    const issueSeverity = normalizeRiskFromSeverity(topIssue['severity'] as string | undefined);
    signals.push({
      name: `Most repeated issue: ${String(topIssue['check_id'] ?? 'unknown-check')}`,
      risk: issueSeverity,
      summary: `${String(topIssue['title'] ?? 'Unnamed issue')} is currently the most repeated anonymous finding pattern in the shared community dataset.`,
      signal: `Seen ${Number(topIssue['count'] ?? 0)} times · Severity ${issueSeverity}`,
    });
  }

  if (reports.length > 0) {
    const lowScoreCount = Number(recentLowScore?.['count'] ?? 0);
    signals.push({
      name: 'Recent low-score deployment pressure',
      risk: lowScoreCount >= 3 ? 'high' : lowScoreCount > 0 ? 'medium' : 'low',
      summary:
        lowScoreCount > 0
          ? `${lowScoreCount} anonymous community report${lowScoreCount === 1 ? '' : 's'} in the last 30 days scored below 60, indicating recurring hardening gaps.`
          : 'No anonymous community reports in the last 30 days scored below 60, which suggests recent submissions are not clustering in the lowest posture band.',
      signal: `Last 30 days below 60: ${lowScoreCount} · Total community reports: ${reports.length}`,
    });
  }

  return signals;
}

export async function getStoredIntelligenceOverview(db: D1Database): Promise<IntelligenceOverview> {
  const [versionImpactCounts, communitySignals] = await Promise.all([
    getCommunityVersionImpactCounts(db),
    getCommunityThreatSignals(db),
  ]);
  const [snapshotValue, advisoryFeedValue, refreshedAtValue] = await Promise.all([
    getMetaValue(db, INTELLIGENCE_META_KEYS.upstreamSnapshot),
    getMetaValue(db, INTELLIGENCE_META_KEYS.advisoryFeed),
    getMetaValue(db, INTELLIGENCE_META_KEYS.refreshedAt),
  ]);

  const snapshot = parseJsonValue<OpenClawUpstreamSnapshot>(snapshotValue);
  const advisoryFeed = parseJsonValue<OpenClawVersionAdvisoryRecord[]>(advisoryFeedValue);

  if (!snapshot || !advisoryFeed) {
    return buildIntelligenceOverview({ versionImpactCounts, communitySignals });
  }

  return buildOverviewFromCache(
    snapshot,
    advisoryFeed,
    refreshedAtValue ?? undefined,
    versionImpactCounts,
    communitySignals,
  );
}

export async function refreshIntelligenceCache(
  db: D1Database,
  fetchImpl: FetchLike = fetch,
): Promise<IntelligenceOverview> {
  const refreshedAt = new Date().toISOString();

  try {
    const snapshot = await buildOpenClawUpstreamSnapshot(fetchImpl);
    const advisoryFeed = await fetchOpenClawAdvisoryFeed(snapshot, fetchImpl);

    await Promise.all([
      setMetaValue(db, INTELLIGENCE_META_KEYS.upstreamSnapshot, JSON.stringify(snapshot)),
      setMetaValue(db, INTELLIGENCE_META_KEYS.advisoryFeed, JSON.stringify(advisoryFeed)),
      setMetaValue(db, INTELLIGENCE_META_KEYS.refreshedAt, refreshedAt),
      setMetaValue(db, INTELLIGENCE_META_KEYS.refreshError, ''),
    ]);

    const [versionImpactCounts, communitySignals] = await Promise.all([
      getCommunityVersionImpactCounts(db),
      getCommunityThreatSignals(db),
    ]);
    return buildOverviewFromCache(snapshot, advisoryFeed, refreshedAt, versionImpactCounts, communitySignals);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setMetaValue(db, INTELLIGENCE_META_KEYS.refreshError, message);
    throw error;
  }
}
