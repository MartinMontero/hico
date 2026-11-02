import type { TenantContext } from '../tenant.ts';
import { newId } from '../ids.ts';
import type { ActivityWrite } from './activities.ts';
import type { OfferWrite } from './offers.ts';
import type { PlaceWrite } from './places.ts';
import type { ZoneWrite } from './zones.ts';

export type ImportWrite =
  | { kind: 'zone'; clientKey: string; value: ZoneWrite }
  | { kind: 'place'; clientKey: string; value: PlaceWrite }
  | { kind: 'offer'; clientKey: string; value: OfferWrite }
  | { kind: 'activity'; clientKey: string; value: ActivityWrite };

const auditStatement = (ctx: TenantContext, actorStaffId: string, action: string, targetType: string, targetId: string | null, now: number) =>
  ctx.db.prepare(`INSERT INTO audit_log (id, property_id, actor_kind, actor_staff_id, action, target_type, target_id, created_at)
    VALUES (?1, ?2, 'staff', ?3, ?4, ?5, ?6, ?7)`).bind(newId(), ctx.propertyId, actorStaffId, action, targetType, targetId, now);

/** Apply one validated plan atomically. Every inserted content row has its own audit row. */
export async function apply(ctx: TenantContext, writes: ImportWrite[], actorStaffId: string, verifiedBy: string, now: number): Promise<string[]> {
  const statements: D1PreparedStatement[] = [];
  const ids: string[] = [];
  for (const write of writes) {
    const id = newId();
    ids.push(id);
    if (write.kind === 'zone') {
      const f = write.value;
      statements.push(ctx.db.prepare('INSERT INTO zones (id, property_id, label_en, label_fr, ring) VALUES (?1, ?2, ?3, ?4, ?5)').bind(id, ctx.propertyId, f.labelEn, f.labelFr, f.ring));
    } else if (write.kind === 'place') {
      const f = write.value;
      statements.push(ctx.db.prepare(`INSERT INTO places (id, property_id, category, name, staff_pick, note_en, note_fr, walk_time_en, walk_time_fr, hours_en, hours_fr,
        phone, maps_address, verified_on, verified_by, is_placeholder, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, NULL, ?14, 0, ?15, ?15)`)
        .bind(id, ctx.propertyId, f.category, f.name, f.staffPick ? 1 : 0, f.noteEn, f.noteFr, f.walkTimeEn, f.walkTimeFr, f.hoursEn, f.hoursFr, f.phone, f.mapsAddress, verifiedBy, now));
    } else if (write.kind === 'offer') {
      const f = write.value;
      statements.push(ctx.db.prepare(`INSERT INTO offers (id, property_id, partner_name, terms_en, terms_fr, valid_from, valid_to, requires_membership, how_we_know_en, how_we_know_fr,
        verified_on, verified_by, is_placeholder, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, NULL, ?11, 0, ?12)`)
        .bind(id, ctx.propertyId, f.partnerName, f.termsEn, f.termsFr, f.validFrom, f.validTo, f.requiresMembership ? 1 : 0, f.howWeKnowEn, f.howWeKnowFr, verifiedBy, now));
    } else {
      const f = write.value;
      statements.push(ctx.db.prepare(`INSERT INTO activities (id, property_id, title_en, title_fr, description_en, description_fr, category, zone_id, host_label, timezone,
        weekday, start_local, end_local, starts_at, ends_at, capacity, status, verified_on, verified_by, is_placeholder, created_at, updated_at, change_note_en, change_note_fr)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, 'active', NULL, ?17, 0, ?18, ?18, ?19, ?20)`)
        .bind(id, ctx.propertyId, f.titleEn, f.titleFr, f.descriptionEn, f.descriptionFr, f.category, f.zoneId, f.hostLabel, ctx.timezone, f.weekday, f.startLocal, f.endLocal, f.startsAt, f.endsAt, f.capacity, verifiedBy, now, f.changeNoteEn, f.changeNoteFr));
      statements.push(ctx.db.prepare('INSERT INTO activity_offered_at (activity_id, owner_property_id, property_id) VALUES (?1, ?2, ?2)').bind(id, ctx.propertyId));
    }
    statements.push(auditStatement(ctx, actorStaffId, `staff.import.${write.kind}_created`, write.kind, id, now));
  }
  statements.push(auditStatement(ctx, actorStaffId, 'staff.import.applied', 'property', null, now));
  await ctx.db.batch(statements);
  return ids;
}
