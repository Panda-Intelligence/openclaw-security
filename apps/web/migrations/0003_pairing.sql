-- Pairing: persistent credential storage for internal auditing
CREATE TABLE IF NOT EXISTS pairings (
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
);

CREATE INDEX IF NOT EXISTS idx_pairings_project ON pairings(project_id);
CREATE INDEX IF NOT EXISTS idx_pairings_user ON pairings(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pairings_project_active ON pairings(project_id) WHERE status = 'active';
