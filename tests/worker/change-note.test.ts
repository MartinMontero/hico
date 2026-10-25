import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { LIMITS } from '../../shared/limits.ts';
import type { PublicActivity, StaffActivity } from '../../shared/types.ts';
import { call } from '../support/app.ts';
import { makeProperty, makeStaff, nameStaff, sessionCookieFor, type PropertyFixture } from '../support/fixtures.ts';

// A short staff note on an activity that has changed (O-24, D-39): at most 120 characters, shown to guests in both
// languages, cleared by clearing it. It is content, so any property that offers a shared activity may set it (D-23).

let A: PropertyFixture, B: PropertyFixture;
let cAdminA: string, cAdminAB: string, cEditorB: string;
const json = async <T>(res: Response) => (await res.json()) as T;
const staff = (p: PropertyFixture, cookie: string, path: string, body?: unknown) =>
  call(`/api/staff/p/${p.slug}${path}`, { host: p.host, method: body === undefined ? 'GET' : 'POST', headers: { Cookie: cookie }, body });
const guest = async (p: PropertyFixture) => json<PublicActivity[]>(await call(`/api/p/${p.slug}/activities`, { host: p.host }));
const body = (over: Record<string, unknown> = {}) => ({
  titleEn: 'Trivia', titleFr: 'Quiz', descriptionEn: '', descriptionFr: '', changeNoteEn: '', changeNoteFr: '', category: 'social', zoneId: null, hostLabel: '', capacity: null,
  schedule: { kind: 'weekly', weekday: 2, startLocal: '19:00', endLocal: null }, ...over,
});

beforeAll(async () => {
  A = await makeProperty(env.DB, 'cn-a', { host: 'cn-a.test' });
  B = await makeProperty(env.DB, 'cn-b', { host: 'cn-b.test' });
  const adminA = await makeStaff(env.DB, 'cn-admin-a@x.test', [{ propertyId: A.id, role: 'admin' }]);
  const adminAB = await makeStaff(env.DB, 'cn-admin-ab@x.test', [{ propertyId: A.id, role: 'admin' }, { propertyId: B.id, role: 'admin' }]);
  const editorB = await makeStaff(env.DB, 'cn-editor-b@x.test', [{ propertyId: B.id, role: 'editor' }]);
  for (const [id, n] of [[adminA, 'Ann'], [adminAB, 'Cam'], [editorB, 'Bo']] as const) await nameStaff(env.DB, id, n);
  [cAdminA, cAdminAB, cEditorB] = [await sessionCookieFor(env.DB, adminA), await sessionCookieFor(env.DB, adminAB), await sessionCookieFor(env.DB, editorB)];
});

describe('the change note', () => {
  it('is stored with the activity and shown to guests and staff in both languages', async () => {
    const made = await json<StaffActivity>(await staff(A, cAdminA, '/activities', body({ changeNoteEn: 'Moved to 8 pm', changeNoteFr: 'Déplacé à 20 h' })));
    expect(made.changeNote).toEqual({ en: 'Moved to 8 pm', fr: 'Déplacé à 20 h' });
    const seen = (await guest(A)).find((a) => a.id === made.id);
    expect(seen?.changeNote).toEqual({ en: 'Moved to 8 pm', fr: 'Déplacé à 20 h' });
    const listed = (await json<StaffActivity[]>(await staff(A, cAdminA, '/activities'))).find((a) => a.id === made.id);
    expect(listed?.changeNote.en).toBe('Moved to 8 pm');
  });

  it('is empty when nothing has changed, and clearing it clears it for guests', async () => {
    const made = await json<StaffActivity>(await staff(A, cAdminA, '/activities', body({ changeNoteEn: 'Cancelled for rain, back Tuesday', changeNoteFr: 'Annulé pour la pluie' })));
    expect((await guest(A)).find((a) => a.id === made.id)?.changeNote.en).not.toBe('');
    const cleared = await staff(A, cAdminA, `/activities/${made.id}`, { ...body(), version: made.version });
    expect(cleared.status).toBe(200);
    expect((await guest(A)).find((a) => a.id === made.id)?.changeNote).toEqual({ en: '', fr: '' });
    const plain = await json<StaffActivity>(await staff(A, cAdminA, '/activities', body({ titleEn: 'No change' })));
    expect(plain.changeNote).toEqual({ en: '', fr: '' });
  });

  it('allows exactly 120 characters (the limit Martin accepted) and refuses 121, in either language, and control characters', async () => {
    expect(LIMITS.changeNote).toBe(120);
    expect((await staff(A, cAdminA, '/activities', body({ changeNoteEn: 'x'.repeat(120), changeNoteFr: 'é'.repeat(120) }))).status).toBe(200);
    for (const over of [{ changeNoteEn: 'x'.repeat(121) }, { changeNoteFr: 'x'.repeat(121) }, { changeNoteEn: 'bad\u0000note' }]) {
      expect((await staff(A, cAdminA, '/activities', body(over))).status, JSON.stringify(over).slice(0, 40)).toBe(400);
    }
    // A request that leaves the fields out is refused like any other missing text field.
    const without: Record<string, unknown> = body();
    delete without['changeNoteEn'];
    delete without['changeNoteFr'];
    expect((await staff(A, cAdminA, '/activities', without)).status).toBe(400);
  });

  it('the database itself refuses more than 120 characters', async () => {
    const made = await json<StaffActivity>(await staff(A, cAdminA, '/activities', body({ titleEn: 'Direct' })));
    for (const column of ['change_note_en', 'change_note_fr']) {
      await expect(env.DB.prepare(`UPDATE activities SET ${column} = ?2 WHERE id = ?1`).bind(made.id, 'x'.repeat(121)).run()).rejects.toThrow(/CHECK/i);
      await expect(env.DB.prepare(`UPDATE activities SET ${column} = ?2 WHERE id = ?1`).bind(made.id, 'x'.repeat(120)).run()).resolves.toBeDefined();
    }
  });

  it('is stored verbatim as text, hostile or not', async () => {
    const payload = '<img src=x onerror=alert(1)> \'; DROP TABLE activities; -- {{7*7}}';
    const made = await json<StaffActivity>(await staff(A, cAdminA, '/activities', body({ changeNoteEn: payload, changeNoteFr: payload })));
    expect((await guest(A)).find((a) => a.id === made.id)?.changeNote).toEqual({ en: payload, fr: payload });
  });

  it('re-checking an activity keeps its note, and a copy starts without one', async () => {
    const made = await json<StaffActivity>(await staff(A, cAdminA, '/activities', body({ changeNoteEn: 'Moved to 9 pm', changeNoteFr: 'Déplacé à 21 h' })));
    expect((await staff(A, cAdminA, `/activities/${made.id}/reverify`, { version: made.version })).status).toBe(200);
    expect((await guest(A)).find((a) => a.id === made.id)?.changeNote.en).toBe('Moved to 9 pm');
    const copy = await json<StaffActivity>(await staff(A, cAdminA, `/activities/${made.id}/duplicate`, {}));
    expect(copy.changeNote).toEqual({ en: '', fr: '' });
  });

  it('on a shared activity, any property that offers it may set the note, and both properties\' guests see it (D-23)', async () => {
    const made = await json<StaffActivity>(await staff(A, cAdminAB, '/activities', body({ titleEn: 'Shared hike' })));
    expect((await staff(A, cAdminAB, `/activities/${made.id}/offered-at/add`, { slug: B.slug })).status).toBe(200);
    const seenByB = (await json<StaffActivity[]>(await staff(B, cEditorB, '/activities'))).find((a) => a.id === made.id) as StaffActivity;
    const edited = await staff(B, cEditorB, `/activities/${made.id}`, { ...body({ titleEn: 'Shared hike', changeNoteEn: 'Leaves from the lobby', changeNoteFr: 'Départ du hall' }), version: seenByB.version });
    expect(edited.status).toBe(200);
    expect((await guest(A)).find((a) => a.id === made.id)?.changeNote.en).toBe('Leaves from the lobby');
    expect((await guest(B)).find((a) => a.id === made.id)?.changeNote.fr).toBe('Départ du hall');
  });

  it('a property that does not offer the activity cannot touch its note', async () => {
    const solo = await json<StaffActivity>(await staff(A, cAdminA, '/activities', body({ titleEn: 'A only' })));
    const res = await staff(B, cEditorB, `/activities/${solo.id}`, { ...body({ changeNoteEn: 'hijack' }), version: solo.version });
    expect(res.status).toBe(404);
    expect((await guest(A)).find((a) => a.id === solo.id)?.changeNote.en).toBe('');
  });
});
