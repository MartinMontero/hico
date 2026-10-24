-- 0002 staff authentication (D-26), optimistic concurrency, rate limits.
-- One column per line: tests/node/migrations.test.ts parses this file.
-- Tokens (session cookies, invite and recovery links) are random 256-bit values; only their SHA-256 is stored.

CREATE TABLE staff_credentials (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(id) <= 1400),
  staff_user_id TEXT NOT NULL CHECK (length(staff_user_id) <= 32) REFERENCES staff_users (id),
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL CHECK (counter >= 0),
  transports TEXT NOT NULL DEFAULT '' CHECK (length(transports) <= 120),
  label TEXT NOT NULL DEFAULT '' CHECK (length(label) <= 80),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  last_used_at INTEGER CHECK (last_used_at IS NULL OR last_used_at >= 0),
  revoked_at INTEGER CHECK (revoked_at IS NULL OR revoked_at >= 0)
);
CREATE INDEX staff_credentials_by_user ON staff_credentials (staff_user_id);

CREATE TABLE staff_sessions (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(id) = 64),
  staff_user_id TEXT NOT NULL CHECK (length(staff_user_id) <= 32) REFERENCES staff_users (id),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at >= 0),
  revoked_at INTEGER CHECK (revoked_at IS NULL OR revoked_at >= 0)
);
CREATE INDEX staff_sessions_by_user ON staff_sessions (staff_user_id);

-- Invite: email, display name, property and role. Recovery: the person it replaces access for.
CREATE TABLE staff_tokens (
  token_hash TEXT NOT NULL PRIMARY KEY CHECK (length(token_hash) = 64),
  purpose TEXT NOT NULL CHECK (purpose IN ('invite', 'recovery')),
  email TEXT NOT NULL CHECK (length(email) <= 120),
  display_name TEXT NOT NULL DEFAULT '' CHECK (length(display_name) <= 80),
  property_id TEXT CHECK (property_id IS NULL OR length(property_id) <= 32) REFERENCES properties (id),
  role TEXT CHECK (role IS NULL OR role IN ('editor', 'admin')),
  staff_user_id TEXT CHECK (staff_user_id IS NULL OR length(staff_user_id) <= 32) REFERENCES staff_users (id),
  created_by TEXT CHECK (created_by IS NULL OR length(created_by) <= 32) REFERENCES staff_users (id),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at >= 0),
  used_at INTEGER CHECK (used_at IS NULL OR used_at >= 0),
  CHECK ((purpose = 'invite' AND property_id IS NOT NULL AND role IS NOT NULL) OR (purpose = 'recovery' AND staff_user_id IS NOT NULL))
);

CREATE TABLE webauthn_challenges (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  challenge TEXT NOT NULL CHECK (length(challenge) <= 200),
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'login')),
  staff_user_id TEXT CHECK (staff_user_id IS NULL OR length(staff_user_id) <= 32),
  token_hash TEXT CHECK (token_hash IS NULL OR length(token_hash) = 64),
  expires_at INTEGER NOT NULL CHECK (expires_at >= 0),
  used_at INTEGER CHECK (used_at IS NULL OR used_at >= 0)
);

-- Abuse control. key is a keyed hash of (network address, endpoint) whose key changes every UTC day, so
-- counters cannot be linked across days. Rows older than 24 hours are removed on write.
CREATE TABLE rate_limits (
  key TEXT NOT NULL CHECK (length(key) = 64),
  window_start INTEGER NOT NULL CHECK (window_start >= 0),
  count INTEGER NOT NULL CHECK (count >= 0),
  PRIMARY KEY (key, window_start)
);

-- Optimistic concurrency: an update names the version it was based on.
ALTER TABLE activities ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1);
ALTER TABLE places ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1);
ALTER TABLE offers ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1);
ALTER TABLE zones ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1);
