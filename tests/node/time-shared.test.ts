/// <reference types="node" />
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dayBounds, epochToLocal, localToEpoch } from '../../shared/time.ts';

// The same instant must come back as the same wall clock, in the PROPERTY's zone, whatever the device's zone is.
const originalTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Pacific/Auckland';
});
afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

const TOR = 'America/Toronto'; // falls back on 1 November 2026 and springs forward on 8 March 2026
const VAN = 'America/Vancouver';
const at = (iso: string) => Date.parse(iso) / 1000;

describe('localToEpoch / epochToLocal', () => {
  it('round-trips an ordinary time, independent of the device zone', () => {
    const t = localToEpoch('2026-10-26', '19:00', VAN);
    expect(epochToLocal(t, VAN)).toEqual({ date: '2026-10-26', time: '19:00' });
    expect(epochToLocal(t, 'Pacific/Auckland').date).not.toBe(undefined);
    expect(localToEpoch('2026-10-26', '19:00', TOR)).toBe(at('2026-10-26T23:00:00Z')); // EDT, UTC-4
  });

  it('autumn change in Toronto: 23:30 on 1 November is EST (UTC-5)', () => {
    expect(localToEpoch('2026-11-01', '23:30', TOR)).toBe(at('2026-11-02T04:30:00Z'));
    expect(epochToLocal(at('2026-11-02T04:30:00Z'), TOR)).toEqual({ date: '2026-11-01', time: '23:30' });
  });

  it('a time that happens twice (01:30 on 1 November in Toronto) is the earlier one', () => {
    expect(localToEpoch('2026-11-01', '01:30', TOR)).toBe(at('2026-11-01T05:30:00Z')); // EDT, the first 01:30
  });

  it('spring change in Toronto: 03:30 on 8 March is EDT, and the skipped 02:30 lands after the gap', () => {
    expect(localToEpoch('2026-03-08', '03:30', TOR)).toBe(at('2026-03-08T07:30:00Z'));
    const skipped = localToEpoch('2026-03-08', '02:30', TOR);
    expect(skipped).toBeGreaterThanOrEqual(at('2026-03-08T07:00:00Z'));
    expect(epochToLocal(skipped, TOR).date).toBe('2026-03-08');
  });

  it('spring change in Vancouver (8 March 2026): 00:30 on 9 March is PDT', () => {
    expect(localToEpoch('2026-03-09', '00:30', VAN)).toBe(at('2026-03-09T07:30:00Z'));
    expect(localToEpoch('2026-03-08', '01:30', VAN)).toBe(at('2026-03-08T09:30:00Z')); // PST, before the change
  });

  it('a day has 25 hours when the clocks go back and 23 when they go forward', () => {
    const fall = dayBounds('2026-11-01', TOR);
    expect(fall.end - fall.start + 1).toBe(25 * 3600);
    const spring = dayBounds('2026-03-08', TOR);
    expect(spring.end - spring.start + 1).toBe(23 * 3600);
    const plain = dayBounds('2026-10-26', TOR);
    expect(plain.end - plain.start + 1).toBe(24 * 3600);
  });
});
