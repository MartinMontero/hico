-- Spike only (Phase 1b-1, Route 2). Better Auth's own tables come from its programmatic migration.
-- Invite and recovery tokens: only a hash is stored; single use; short life.
CREATE TABLE staff_tokens (
  token_hash TEXT NOT NULL PRIMARY KEY CHECK (length(token_hash) = 64),
  purpose TEXT NOT NULL CHECK (purpose IN ('invite', 'recovery')),
  email TEXT NOT NULL CHECK (length(email) <= 120),
  property_id TEXT CHECK (property_id IS NULL OR length(property_id) <= 32) REFERENCES properties (id),
  role TEXT CHECK (role IS NULL OR role IN ('editor', 'admin')),
  created_by TEXT CHECK (created_by IS NULL OR length(created_by) <= 32) REFERENCES staff_users (id),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at >= 0),
  used_at INTEGER CHECK (used_at IS NULL OR used_at >= 0)
);

-- Local stand-in for outgoing email: nothing is ever sent.
CREATE TABLE email_capture (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
