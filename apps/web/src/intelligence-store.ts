import {
  buildOpenClawUpstreamSnapshot,
  buildVersionDatabaseFromSnapshot,
  fetchOpenClawAdvisoryFeed,
  mergeVersionDatabaseWithAdvisories,
  type OpenClawUpstreamSnapshot,
  type OpenClawVersionAdvisoryRecord,
} from '@panda-ai/ocs-core';
import { buildIntelligenceOverview, type IntelligenceOverview } from './intelligence';

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
): IntelligenceOverview {
  const baseDatabase = buildVersionDatabaseFromSnapshot(snapshot);
  const mergedDatabase = mergeVersionDatabaseWithAdvisories(baseDatabase, advisoryFeed);

  return buildIntelligenceOverview({
    upstreamSnapshot: snapshot,
    versionDatabase: mergedDatabase,
    versionImpactCounts,
    capturedAt,
  });
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

export async function getStoredIntelligenceOverview(db: D1Database): Promise<IntelligenceOverview> {
  const versionImpactCounts = await getCommunityVersionImpactCounts(db);
  const [snapshotValue, advisoryFeedValue, refreshedAtValue] = await Promise.all([
    getMetaValue(db, INTELLIGENCE_META_KEYS.upstreamSnapshot),
    getMetaValue(db, INTELLIGENCE_META_KEYS.advisoryFeed),
    getMetaValue(db, INTELLIGENCE_META_KEYS.refreshedAt),
  ]);

  const snapshot = parseJsonValue<OpenClawUpstreamSnapshot>(snapshotValue);
  const advisoryFeed = parseJsonValue<OpenClawVersionAdvisoryRecord[]>(advisoryFeedValue);

  if (!snapshot || !advisoryFeed) {
    return buildIntelligenceOverview({ versionImpactCounts });
  }

  return buildOverviewFromCache(snapshot, advisoryFeed, refreshedAtValue ?? undefined, versionImpactCounts);
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

    const versionImpactCounts = await getCommunityVersionImpactCounts(db);
    return buildOverviewFromCache(snapshot, advisoryFeed, refreshedAt, versionImpactCounts);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setMetaValue(db, INTELLIGENCE_META_KEYS.refreshError, message);
    throw error;
  }
}
