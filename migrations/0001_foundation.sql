-- 0001 foundation. One column per line: tests/node/limits.test.ts parses this file.
-- Ids are random 128-bit values written as 32 lowercase hex characters.
-- Instants are UTC epoch seconds. Local wall-clock times are 'HH:MM' with an IANA zone.
-- Tenant rule (05 section 4): every child references (parent id, property_id).

CREATE TABLE platform_flags (
  key TEXT NOT NULL PRIMARY KEY CHECK (length(key) <= 40),
  value TEXT NOT NULL CHECK (length(value) <= 40)
);

CREATE TABLE properties (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  slug TEXT NOT NULL UNIQUE CHECK (length(slug) <= 40 AND slug NOT GLOB '*[^a-z0-9-]*'),
  name_en TEXT NOT NULL CHECK (length(name_en) <= 80),
  name_fr TEXT NOT NULL CHECK (length(name_fr) <= 80),
  timezone TEXT NOT NULL CHECK (length(timezone) <= 64),
  address TEXT NOT NULL CHECK (length(address) <= 200),
  languages TEXT NOT NULL CHECK (languages IN ('en', 'fr', 'en,fr')),
  privacy_contact_title TEXT NOT NULL DEFAULT '' CHECK (length(privacy_contact_title) <= 80),
  privacy_contact_address TEXT NOT NULL DEFAULT '' CHECK (length(privacy_contact_address) <= 120),
  suspended_at INTEGER CHECK (suspended_at IS NULL OR suspended_at >= 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0)
);

-- Hostname to properties. A host may list several properties (D-24). The slug in a
-- public path counts only if it is in that host's own rows.
CREATE TABLE property_hosts (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  host TEXT NOT NULL CHECK (length(host) <= 120),
  property_id TEXT NOT NULL CHECK (length(property_id) <= 32) REFERENCES properties (id),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  UNIQUE (host, property_id)
);
CREATE UNIQUE INDEX property_hosts_one_default ON property_hosts (host) WHERE is_default = 1;

CREATE TABLE staff_users (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  email TEXT NOT NULL UNIQUE CHECK (length(email) <= 120),
  display_name TEXT CHECK (display_name IS NULL OR length(display_name) <= 80),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  disabled_at INTEGER CHECK (disabled_at IS NULL OR disabled_at >= 0)
);

CREATE TABLE property_features (
  property_id TEXT NOT NULL CHECK (length(property_id) <= 32) REFERENCES properties (id),
  feature TEXT NOT NULL CHECK (feature IN ('common_room', 'connect')),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  changed_by TEXT CHECK (changed_by IS NULL OR length(changed_by) <= 32) REFERENCES staff_users (id),
  changed_at INTEGER CHECK (changed_at IS NULL OR changed_at >= 0),
  PRIMARY KEY (property_id, feature)
);

CREATE TABLE zones (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  property_id TEXT NOT NULL CHECK (length(property_id) <= 32) REFERENCES properties (id),
  label_en TEXT NOT NULL CHECK (length(label_en) <= 80),
  label_fr TEXT NOT NULL CHECK (length(label_fr) <= 80),
  ring TEXT NOT NULL CHECK (ring IN ('in_hostel', 'short_walk', 'further')),
  UNIQUE (id, property_id)
);

CREATE TABLE staff_memberships (
  staff_user_id TEXT NOT NULL CHECK (length(staff_user_id) <= 32) REFERENCES staff_users (id),
  property_id TEXT NOT NULL CHECK (length(property_id) <= 32) REFERENCES properties (id),
  role TEXT NOT NULL CHECK (role IN ('editor', 'admin')),
  PRIMARY KEY (staff_user_id, property_id)
);

-- token_hash stays empty until Stage 2 (sessions).
CREATE TABLE entry_codes (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  property_id TEXT NOT NULL CHECK (length(property_id) <= 32) REFERENCES properties (id),
  label TEXT NOT NULL CHECK (length(label) <= 80),
  token_hash TEXT NOT NULL DEFAULT '' CHECK (length(token_hash) <= 64),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  revoked_at INTEGER CHECK (revoked_at IS NULL OR revoked_at >= 0),
  UNIQUE (id, property_id),
  UNIQUE (property_id, label)
);

-- property_id is the OWNER (D-23). Visibility is decided by activity_offered_at.
CREATE TABLE activities (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  property_id TEXT NOT NULL CHECK (length(property_id) <= 32) REFERENCES properties (id),
  title_en TEXT NOT NULL CHECK (length(title_en) <= 120),
  title_fr TEXT NOT NULL CHECK (length(title_fr) <= 120),
  description_en TEXT NOT NULL DEFAULT '' CHECK (length(description_en) <= 600),
  description_fr TEXT NOT NULL DEFAULT '' CHECK (length(description_fr) <= 600),
  category TEXT NOT NULL CHECK (category IN ('adventure', 'social', 'wellness', 'culture', 'outdoor')),
  zone_id TEXT CHECK (zone_id IS NULL OR length(zone_id) <= 32),
  host_label TEXT NOT NULL DEFAULT '' CHECK (length(host_label) <= 80),
  timezone TEXT NOT NULL CHECK (length(timezone) <= 64),
  weekday INTEGER CHECK (weekday IS NULL OR weekday BETWEEN 0 AND 6),
  start_local TEXT CHECK (start_local IS NULL OR length(start_local) <= 5),
  end_local TEXT CHECK (end_local IS NULL OR length(end_local) <= 5),
  starts_at INTEGER CHECK (starts_at IS NULL OR starts_at >= 0),
  ends_at INTEGER CHECK (ends_at IS NULL OR ends_at >= 0),
  capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  verified_on INTEGER CHECK (verified_on IS NULL OR verified_on >= 0),
  verified_by TEXT CHECK (verified_by IS NULL OR length(verified_by) <= 80),
  is_placeholder INTEGER NOT NULL DEFAULT 0 CHECK (is_placeholder IN (0, 1)),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
  UNIQUE (id, property_id),
  FOREIGN KEY (zone_id, property_id) REFERENCES zones (id, property_id),
  CHECK (
    (weekday IS NOT NULL AND start_local IS NOT NULL AND starts_at IS NULL AND ends_at IS NULL)
    OR (weekday IS NULL AND start_local IS NULL AND end_local IS NULL AND starts_at IS NOT NULL)
  )
);

-- Which properties show an activity. owner_property_id must be the activity's real owner
-- (composite key), property_id is the property that may read it.
CREATE TABLE activity_offered_at (
  activity_id TEXT NOT NULL CHECK (length(activity_id) <= 32),
  owner_property_id TEXT NOT NULL CHECK (length(owner_property_id) <= 32),
  property_id TEXT NOT NULL CHECK (length(property_id) <= 32) REFERENCES properties (id),
  PRIMARY KEY (activity_id, property_id),
  FOREIGN KEY (activity_id, owner_property_id) REFERENCES activities (id, property_id)
);

CREATE TABLE activity_exceptions (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  activity_id TEXT NOT NULL CHECK (length(activity_id) <= 32),
  property_id TEXT NOT NULL CHECK (length(property_id) <= 32),
  on_date TEXT NOT NULL CHECK (length(on_date) <= 10),
  kind TEXT NOT NULL DEFAULT 'cancelled' CHECK (kind IN ('cancelled')),
  UNIQUE (id, property_id),
  UNIQUE (activity_id, on_date),
  FOREIGN KEY (activity_id, property_id) REFERENCES activities (id, property_id)
);

CREATE TABLE places (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  property_id TEXT NOT NULL CHECK (length(property_id) <= 32) REFERENCES properties (id),
  category TEXT NOT NULL CHECK (category IN ('trails', 'food', 'drinks', 'culture', 'adventure')),
  name TEXT NOT NULL CHECK (length(name) <= 80),
  staff_pick INTEGER NOT NULL DEFAULT 0 CHECK (staff_pick IN (0, 1)),
  note_en TEXT NOT NULL DEFAULT '' CHECK (length(note_en) <= 300),
  note_fr TEXT NOT NULL DEFAULT '' CHECK (length(note_fr) <= 300),
  walk_time_en TEXT NOT NULL DEFAULT '' CHECK (length(walk_time_en) <= 120),
  walk_time_fr TEXT NOT NULL DEFAULT '' CHECK (length(walk_time_fr) <= 120),
  hours_en TEXT NOT NULL DEFAULT '' CHECK (length(hours_en) <= 200),
  hours_fr TEXT NOT NULL DEFAULT '' CHECK (length(hours_fr) <= 200),
  phone TEXT CHECK (phone IS NULL OR length(phone) <= 30),
  maps_address TEXT NOT NULL DEFAULT '' CHECK (length(maps_address) <= 200),
  verified_on INTEGER CHECK (verified_on IS NULL OR verified_on >= 0),
  verified_by TEXT CHECK (verified_by IS NULL OR length(verified_by) <= 80),
  is_placeholder INTEGER NOT NULL DEFAULT 0 CHECK (is_placeholder IN (0, 1)),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
  UNIQUE (id, property_id)
);

CREATE TABLE offers (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  property_id TEXT NOT NULL CHECK (length(property_id) <= 32) REFERENCES properties (id),
  partner_name TEXT NOT NULL CHECK (length(partner_name) <= 80),
  terms_en TEXT NOT NULL CHECK (length(terms_en) <= 400),
  terms_fr TEXT NOT NULL CHECK (length(terms_fr) <= 400),
  valid_from INTEGER CHECK (valid_from IS NULL OR valid_from >= 0),
  valid_to INTEGER CHECK (valid_to IS NULL OR valid_to >= 0),
  requires_membership INTEGER NOT NULL DEFAULT 0 CHECK (requires_membership IN (0, 1)),
  how_we_know_en TEXT NOT NULL DEFAULT '' CHECK (length(how_we_know_en) <= 300),
  how_we_know_fr TEXT NOT NULL DEFAULT '' CHECK (length(how_we_know_fr) <= 300),
  verified_on INTEGER CHECK (verified_on IS NULL OR verified_on >= 0),
  verified_by TEXT CHECK (verified_by IS NULL OR length(verified_by) <= 80),
  is_placeholder INTEGER NOT NULL DEFAULT 0 CHECK (is_placeholder IN (0, 1)),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  UNIQUE (id, property_id)
);

CREATE TABLE audit_log (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  property_id TEXT NOT NULL CHECK (length(property_id) <= 32) REFERENCES properties (id),
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('staff', 'system')),
  actor_staff_id TEXT CHECK (actor_staff_id IS NULL OR length(actor_staff_id) <= 32) REFERENCES staff_users (id),
  action TEXT NOT NULL CHECK (length(action) <= 60),
  target_type TEXT NOT NULL CHECK (length(target_type) <= 40),
  target_id TEXT CHECK (target_id IS NULL OR length(target_id) <= 32),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  UNIQUE (id, property_id)
);

-- Aggregate counters. No session id, ever.
CREATE TABLE event_counts (
  property_id TEXT NOT NULL CHECK (length(property_id) <= 32) REFERENCES properties (id),
  day TEXT NOT NULL CHECK (length(day) <= 10),
  event TEXT NOT NULL CHECK (length(event) <= 60),
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (property_id, day, event)
);

INSERT INTO platform_flags (key, value) VALUES ('read_only', 'off');
