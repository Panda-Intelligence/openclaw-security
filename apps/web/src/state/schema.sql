-- D1 Schema for OpenClaw Security

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

CREATE INDEX IF NOT EXISTS idx_scans_host ON scans(target_host);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_findings_scan ON findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_community_host ON community_reports(target_host);
