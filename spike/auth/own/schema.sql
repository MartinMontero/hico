-- Spike only (Phase 1b-1, Route 3). Applied after the root migrations; never run anywhere but local D1.
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

-- id is an HMAC of the cookie token (keyed with SESSION_PEPPER); the token itself is never stored.
CREATE TABLE staff_sessions (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(id) = 64),
  staff_user_id TEXT NOT NULL CHECK (length(staff_user_id) <= 32) REFERENCES staff_users (id),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at >= 0),
  revoked_at INTEGER CHECK (revoked_at IS NULL OR revoked_at >= 0)
);

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

CREATE TABLE webauthn_challenges (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(id) = 32),
  challenge TEXT NOT NULL CHECK (length(challenge) <= 200),
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'login')),
  staff_user_id TEXT CHECK (staff_user_id IS NULL OR length(staff_user_id) <= 32),
  token_hash TEXT CHECK (token_hash IS NULL OR length(token_hash) = 64),
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
