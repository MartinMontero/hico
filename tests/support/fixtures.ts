// Test fixtures: raw SQL is allowed here (tests/support) and nowhere else outside repositories.
import { newId } from '../../worker/ids.ts';

export interface PropertyFixture {
  id: string;
  slug: string;
  host: string;
}

export async function makeProperty(
  db: D1Database,
  slug: string,
  opts: { host?: string; isDefault?: boolean; timezone?: string } = {},
): Promise<PropertyFixture> {
  const id = newId();
  const host = opts.host ?? `${slug}.test`;
  await db.batch([
    db
      .prepare(
        `INSERT INTO properties (id, slug, name_en, name_fr, timezone, address, languages, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, '1 Test St', 'en,fr', 1)`,
      )
      .bind(id, slug, `Name ${slug}`, `Nom ${slug}`, opts.timezone ?? 'America/Vancouver'),
    db
      .prepare('INSERT INTO property_hosts (id, host, property_id, is_default) VALUES (?1, ?2, ?3, ?4)')
      .bind(newId(), host, id, opts.isDefault ? 1 : 0),
  ]);
  return { id, slug, host };
}

export async function addHost(db: D1Database, propertyId: string, host: string, isDefault = false): Promise<void> {
  await db
    .prepare('INSERT INTO property_hosts (id, host, property_id, is_default) VALUES (?1, ?2, ?3, ?4)')
    .bind(newId(), host, propertyId, isDefault ? 1 : 0)
    .run();
}

export async function makeZone(db: D1Database, propertyId: string, label = 'Lobby'): Promise<string> {
  const id = newId();
  await db
    .prepare("INSERT INTO zones (id, property_id, label_en, label_fr, ring) VALUES (?1, ?2, ?3, ?4, 'in_hostel')")
    .bind(id, propertyId, label, `${label} FR`)
    .run();
  return id;
}

export async function makeActivity(
  db: D1Database,
  ownerId: string,
  offeredAt: string[],
  title = 'Trivia',
  zoneId: string | null = null,
): Promise<string> {
  const id = newId();
  const list = offeredAt.includes(ownerId) ? offeredAt : [ownerId, ...offeredAt];
  await db.batch([
    db
      .prepare(
        `INSERT INTO activities (id, property_id, title_en, title_fr, category, zone_id, timezone,
           weekday, start_local, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'social', ?5, 'America/Vancouver', 1, '19:00', 1, 1)`,
      )
      .bind(id, ownerId, title, `${title} FR`, zoneId),
    ...list.map((pid) =>
      db
        .prepare('INSERT INTO activity_offered_at (activity_id, owner_property_id, property_id) VALUES (?1, ?2, ?3)')
        .bind(id, ownerId, pid),
    ),
  ]);
  return id;
}

export async function makePlace(db: D1Database, propertyId: string, name = 'Cafe'): Promise<string> {
  const id = newId();
  await db
    .prepare(
      `INSERT INTO places (id, property_id, category, name, created_at, updated_at)
       VALUES (?1, ?2, 'food', ?3, 1, 1)`,
    )
    .bind(id, propertyId, name)
    .run();
  return id;
}

export async function makeOffer(db: D1Database, propertyId: string, now: number, name = 'Partner'): Promise<string> {
  const id = newId();
  await db
    .prepare(
      `INSERT INTO offers (id, property_id, partner_name, terms_en, terms_fr, verified_on, created_at)
       VALUES (?1, ?2, ?3, 'Terms', 'Conditions', ?4, 1)`,
    )
    .bind(id, propertyId, name, now)
    .run();
  return id;
}

export async function makeStaff(
  db: D1Database,
  email: string,
  memberships: { propertyId: string; role: 'editor' | 'admin' }[],
): Promise<string> {
  const id = newId();
  await db.prepare('INSERT INTO staff_users (id, email, created_at) VALUES (?1, ?2, 1)').bind(id, email).run();
  for (const m of memberships) {
    await db
      .prepare('INSERT INTO staff_memberships (staff_user_id, property_id, role) VALUES (?1, ?2, ?3)')
      .bind(id, m.propertyId, m.role)
      .run();
  }
  return id;
}

export async function makeException(db: D1Database, activityId: string, ownerId: string, date: string): Promise<void> {
  await db
    .prepare("INSERT INTO activity_exceptions (id, activity_id, property_id, on_date, kind) VALUES (?1, ?2, ?3, ?4, 'cancelled')")
    .bind(newId(), activityId, ownerId, date)
    .run();
}
