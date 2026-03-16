-- D1 Schema for OpenClaw Security
-- Combined from: 0001_init.sql + 0002_saas.sql

CREATE TABLE IF NOT EXISTS scans (
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
);

CREATE TABLE IF NOT EXISTS findings (
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
);

CREATE TABLE IF NOT EXISTS community_reports (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL,
  target_host TEXT NOT NULL,
  score INTEGER NOT NULL,
  severity_counts TEXT NOT NULL,
  finding_count INTEGER NOT NULL,
  platform_version TEXT,
  uploaded_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  picture TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
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
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  target_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id TEXT,
  payload TEXT NOT NULL,
  processed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scans_host ON scans(target_host);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_project ON scans(project_id);
CREATE INDEX IF NOT EXISTS idx_findings_scan ON findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_community_host ON community_reports(target_host);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_user_name ON projects(user_id, name);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
