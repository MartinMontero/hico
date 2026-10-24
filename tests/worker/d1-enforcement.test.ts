import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { makeActivity, makeProperty, makeZone } from '../support/fixtures.ts';
import { newId } from '../../worker/ids.ts';

// The design relies on D1 enforcing foreign keys and CHECKs (05 §4 rule 3). Prove it first.

describe('D1 enforces what the schema relies on', () => {
  it('rejects a child that points at another property\'s parent (composite foreign key)', async () => {
    const a = await makeProperty(env.DB, 'enf-a');
    const b = await makeProperty(env.DB, 'enf-b');
    const zoneOfB = await makeZone(env.DB, b.id);
    // Activity of property A that names property B's zone must be refused.
    await expect(
      makeActivity(env.DB, a.id, [a.id], 'Bad zone', zoneOfB),
    ).rejects.toThrow(/FOREIGN KEY|constraint/i);
  });

  it('rejects an offered-at row whose owner is not the activity\'s real owner', async () => {
    const a = await makeProperty(env.DB, 'own-a');
    const b = await makeProperty(env.DB, 'own-b');
    const activityId = await makeActivity(env.DB, a.id, [a.id]);
    await expect(
      env.DB
        .prepare('INSERT INTO activity_offered_at (activity_id, owner_property_id, property_id) VALUES (?1, ?2, ?3)')
        .bind(activityId, b.id, b.id)
        .run(),
    ).rejects.toThrow(/FOREIGN KEY|constraint/i);
  });

  it('rejects an exception row for an activity of another owner', async () => {
    const a = await makeProperty(env.DB, 'exc-a');
    const b = await makeProperty(env.DB, 'exc-b');
    const activityId = await makeActivity(env.DB, a.id, [a.id]);
    await expect(
      env.DB
        .prepare("INSERT INTO activity_exceptions (id, activity_id, property_id, on_date, kind) VALUES (?1, ?2, ?3, '2026-10-26', 'cancelled')")
        .bind(newId(), activityId, b.id)
        .run(),
    ).rejects.toThrow(/FOREIGN KEY|constraint/i);
  });

  it('rejects a text value one character over its CHECK limit', async () => {
    const a = await makeProperty(env.DB, 'len-a');
    await expect(
      env.DB
        .prepare("INSERT INTO zones (id, property_id, label_en, label_fr, ring) VALUES (?1, ?2, ?3, 'x', 'in_hostel')")
        .bind(newId(), a.id, 'x'.repeat(81))
        .run(),
    ).rejects.toThrow(/CHECK|constraint/i);
    // 80 is accepted.
    await env.DB
      .prepare("INSERT INTO zones (id, property_id, label_en, label_fr, ring) VALUES (?1, ?2, ?3, 'x', 'in_hostel')")
      .bind(newId(), a.id, 'x'.repeat(80))
      .run();
  });

  it('rejects an invalid enumeration value and a malformed id', async () => {
    const a = await makeProperty(env.DB, 'enum-a');
    await expect(
      env.DB
        .prepare("INSERT INTO zones (id, property_id, label_en, label_fr, ring) VALUES (?1, ?2, 'a', 'b', 'nowhere')")
        .bind(newId(), a.id)
        .run(),
    ).rejects.toThrow(/CHECK|constraint/i);
    await expect(
      env.DB
        .prepare("INSERT INTO zones (id, property_id, label_en, label_fr, ring) VALUES ('not-a-hex-id', ?1, 'a', 'b', 'in_hostel')")
        .bind(a.id)
        .run(),
    ).rejects.toThrow(/CHECK|constraint/i);
  });

  it('rejects a child row whose property does not exist', async () => {
    await expect(
      env.DB
        .prepare("INSERT INTO zones (id, property_id, label_en, label_fr, ring) VALUES (?1, ?2, 'a', 'b', 'in_hostel')")
        .bind(newId(), newId())
        .run(),
    ).rejects.toThrow(/FOREIGN KEY|constraint/i);
  });
});
