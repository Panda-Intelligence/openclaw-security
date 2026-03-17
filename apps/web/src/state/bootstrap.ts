export const APP_SCHEMA_VERSION = '2026.03.17.2';

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    target_url TEXT NOT NULL,
    target_host TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'passive',
    status TEXT NOT NULL DEFAULT 'pending',
    score INTEGER,
    severity_counts TEXT DEFAULT '{}',
    platform_info TEXT DEFAULT '{}',
    finding_count INTEGER DEFAULT 0,
    client_ip TEXT,
    user_id TEXT,
    project_id TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    error_message TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS findings (
    id TEXT PRIMARY KEY,
    scan_id TEXT NOT NULL REFERENCES scans(id),
    check_id TEXT NOT NULL,
    title TEXT NOT NULL,
    severity TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence TEXT DEFAULT '',
    recommendation TEXT DEFAULT '',
    cwe_id TEXT,
    metadata TEXT DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS community_reports (
    id TEXT PRIMARY KEY,
    scan_id TEXT NOT NULL,
    target_host TEXT NOT NULL,
    score INTEGER NOT NULL,
    severity_counts TEXT NOT NULL,
    finding_count INTEGER NOT NULL,
    platform_version TEXT,
    uploaded_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT,
    picture TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT UNIQUE,
    plan TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active',
    current_period_start TEXT,
    current_period_end TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    target_url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS billing_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    user_id TEXT,
    payload TEXT NOT NULL,
    processed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_scans_host ON scans(target_host)`,
  `CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status)`,
  `CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_scans_project ON scans(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_findings_scan ON findings(scan_id)`,
  `CREATE INDEX IF NOT EXISTS idx_community_host ON community_reports(target_host)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_user_name ON projects(user_id, name)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id)`,
  `CREATE TABLE IF NOT EXISTS pairings (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    label TEXT NOT NULL DEFAULT '',
    encrypted_token TEXT NOT NULL,
    iv TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    target_email TEXT,
    target_tenant_id TEXT,
    verified_at TEXT,
    last_used_at TEXT,
    expires_at TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pairings_project ON pairings(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pairings_user ON pairings(user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_pairings_project_active ON pairings(project_id) WHERE status = 'active'`,
] as const;

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

export class SchemaMigrationRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaMigrationRequiredError';
  }
}

async function hasUsersTable(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'`)
    .first();
  return row !== null;
}

async function ensureMetaTable(db: D1Database): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  ).run();
}

async function getStoredSchemaVersion(db: D1Database): Promise<string | null> {
  const row = await db.prepare(`SELECT value FROM app_meta WHERE key = 'schema_version'`).first();
  return (row?.['value'] as string | undefined) ?? null;
}

async function setStoredSchemaVersion(db: D1Database, version: string): Promise<void> {
  await db.prepare(
    `INSERT INTO app_meta (key, value, updated_at)
     VALUES ('schema_version', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
  ).bind(version, version).run();
}

async function applySchema(db: D1Database): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    await db.prepare(statement).run();
  }
}

export async function ensureAppSchema(
  db: D1Database,
  options: { allowBootstrap?: boolean } = {},
): Promise<void> {
  const { allowBootstrap = false } = options;
  if (schemaReady) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const usersTableExists = await hasUsersTable(db);
      if (!usersTableExists) {
        if (!allowBootstrap) {
          throw new SchemaMigrationRequiredError(
            `Database schema is missing. Run the D1 migrations before serving requests. Expected schema version ${APP_SCHEMA_VERSION}.`,
          );
        }
        await applySchema(db);
      }

      await ensureMetaTable(db);
      const storedVersion = await getStoredSchemaVersion(db);
      if (!storedVersion) {
        await setStoredSchemaVersion(db, APP_SCHEMA_VERSION);
      } else if (storedVersion !== APP_SCHEMA_VERSION) {
        throw new SchemaMigrationRequiredError(
          `Database schema version ${storedVersion} does not match application schema version ${APP_SCHEMA_VERSION}. Run the D1 migrations.`,
        );
      }

      schemaReady = true;
    })().finally(() => {
      schemaPromise = null;
    });
  }
  await schemaPromise;
}

export function resetSchemaBootstrapForTests(): void {
  schemaReady = false;
  schemaPromise = null;
}
