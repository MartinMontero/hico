/// <reference types="node" />
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { PublicActivity } from '../../shared/types.ts';
import { addDays, occurrencesOn, weekFrom, weekdayOf, ymdInZone } from '../../web/src/time.ts';

// Dates are stored in UTC and shown in the PROPERTY's zone, never the device's (CLAUDE.md).
// 05 §13: BC no longer changes clocks (the last change was 8 March 2026; none on 1 November 2026, O-19), so the autumn
// change is tested on America/Toronto, and the spring change on America/Vancouver. A device far from the property is Pacific/Auckland.

const VAN = 'America/Vancouver';
const originalTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Pacific/Auckland'; // a device far from the property
});
afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

const at = (iso: string) => new Date(iso);

describe('property time, not device time', () => {
  it('the same instant is a different day in Auckland and in Vancouver', () => {
    const instant = at('2026-10-24T03:30:00Z'); // 20:30 on 23 Oct in Vancouver, 16:30 on 24 Oct in Auckland
    expect(ymdInZone(instant, VAN)).toBe('2026-10-23');
    expect(ymdInZone(instant, 'Pacific/Auckland')).toBe('2026-10-24');
  });

  it('week strip starts at today in the property zone', () => {
    const week = weekFrom(at('2026-10-24T03:30:00Z'), VAN);
    expect(week[0]).toBe('2026-10-23');
    expect(week).toHaveLength(7);
    expect(week[6]).toBe('2026-10-29');
  });
});

// In the tz data of this runtime (2026b) America/Vancouver has NO autumn change: it moved to
// UTC-7 for good on 8 March 2026. The date logic must therefore come from the IANA zone and never
// from an assumed offset, so the autumn change is tested in a Canadian zone that still falls back.
const TOR = 'America/Toronto';
describe('daylight saving, autumn (1 November 2026 in Toronto: clocks go back at 02:00 EDT)', () => {
  it('both 01:30s that night are 1 November', () => {
    expect(ymdInZone(at('2026-11-01T05:30:00Z'), TOR)).toBe('2026-11-01'); // 01:30 EDT
    expect(ymdInZone(at('2026-11-01T06:30:00Z'), TOR)).toBe('2026-11-01'); // 01:30 EST
  });
  it('23:30 EST on 1 November is still 1 November (UTC-5, not UTC-4)', () => {
    expect(ymdInZone(at('2026-11-02T04:30:00Z'), TOR)).toBe('2026-11-01');
    expect(ymdInZone(at('2026-11-02T05:30:00Z'), TOR)).toBe('2026-11-02');
  });
  it('a week crossing the change has seven consecutive dates', () => {
    expect(weekFrom(at('2026-10-30T20:00:00Z'), TOR)).toEqual([
      '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05',
    ]);
  });
});
describe('daylight saving, spring (8 March 2026: clocks go forward at 02:00 PST)', () => {
  it('00:30 PDT on 9 March is 9 March (UTC-7, not UTC-8)', () => {
    expect(ymdInZone(at('2026-03-09T07:30:00Z'), VAN)).toBe('2026-03-09');
    expect(ymdInZone(at('2026-03-09T06:30:00Z'), VAN)).toBe('2026-03-08');
  });
  it('a week crossing the change has seven consecutive dates', () => {
    expect(weekFrom(at('2026-03-06T20:00:00Z'), VAN)).toEqual([
      '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12',
    ]);
  });
});

function activity(over: Partial<PublicActivity>): PublicActivity {
  return {
    id: 'x'.repeat(32), title: { en: 'T', fr: 'T' }, description: { en: '', fr: '' }, changeNote: { en: '', fr: '' }, category: 'social', zone: null,
    hostLabel: '', timezone: VAN, weekday: null, startLocal: null, endLocal: null, startsAt: null, endsAt: null,
    capacity: null, status: 'active', cancelledDates: [], verifiedOn: null, isPlaceholder: false, ...over,
  };
}

describe('which activities fall on a day', () => {
  it('a weekly activity appears on its weekday only, at its wall-clock time', () => {
    const monday = activity({ weekday: 1, startLocal: '19:00', title: { en: 'Trivia', fr: 'Quiz' } });
    expect(weekdayOf('2026-10-26')).toBe(1);
    expect(occurrencesOn('2026-10-26', [monday], VAN).map((o) => o.start)).toEqual(['19:00']);
    expect(occurrencesOn('2026-10-27', [monday], VAN)).toEqual([]);
  });

  it('keeps 19:00 local on both sides of a daylight-saving change', () => {
    const monday = activity({ weekday: 1, startLocal: '19:00' });
    expect(occurrencesOn('2026-10-26', [monday], VAN)[0]?.start).toBe('19:00'); // before 1 Nov
    expect(occurrencesOn('2026-11-02', [monday], VAN)[0]?.start).toBe('19:00'); // after
  });

  it('a cancelled date marks that day only; the series stays', () => {
    const monday = activity({ weekday: 1, startLocal: '19:00', cancelledDates: ['2026-11-02'] });
    expect(occurrencesOn('2026-11-02', [monday], VAN)[0]?.cancelled).toBe(true);
    expect(occurrencesOn('2026-11-09', [monday], VAN)[0]?.cancelled).toBe(false);
  });

  it('a one-off sits on the day it falls in the PROPERTY zone, with the local time', () => {
    const oneOff = activity({ startsAt: Math.floor(at('2026-11-02T04:30:00Z').getTime() / 1000) }); // 23:30 EST on 1 Nov in Toronto
    expect(occurrencesOn('2026-11-01', [oneOff], TOR).map((o) => o.start)).toEqual(['23:30']);
    expect(occurrencesOn('2026-11-02', [oneOff], TOR)).toEqual([]);
  });

  it('the nonexistent hour on spring-forward night shows as 03:30, not 02:30', () => {
    const oneOff = activity({ startsAt: Math.floor(at('2026-03-08T10:30:00Z').getTime() / 1000) });
    expect(occurrencesOn('2026-03-08', [oneOff], VAN).map((o) => o.start)).toEqual(['03:30']);
  });

  it('is earliest first', () => {
    const late = activity({ weekday: 1, startLocal: '20:00', title: { en: 'Late', fr: 'Tard' } });
    const early = activity({ weekday: 1, startLocal: '09:00', title: { en: 'Early', fr: 'Tôt' } });
    expect(occurrencesOn('2026-10-26', [late, early], VAN).map((o) => o.activity.title.en)).toEqual(['Early', 'Late']);
  });

  it('addDays crosses month ends and leap days', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});
