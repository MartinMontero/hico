// Local date and time in a property's time zone, to and from UTC epoch seconds. Dates are STORED in UTC and
// shown in the property's zone, never the device's (CLAUDE.md). Uses Intl, so it follows the IANA data the
// runtime has (see O-19 about British Columbia).

function parts(epochMs: number, timeZone: string): Record<string, number> {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const out: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(epochMs))) if (p.type !== 'literal') out[p.type] = Number(p.value);
  return out;
}

/** Offset of the zone from UTC at an instant, in milliseconds (positive east of Greenwich). */
export function zoneOffsetMs(epochMs: number, timeZone: string): number {
  const p = parts(epochMs, timeZone);
  const asUtc = Date.UTC(p['year'] as number, (p['month'] as number) - 1, p['day'] as number, p['hour'] as number, p['minute'] as number, p['second'] as number);
  return asUtc - Math.floor(epochMs / 1000) * 1000;
}

/**
 * The instant (epoch seconds) at which the wall clock in `timeZone` reads `date` `time`.
 * A time that does not exist (the hour skipped when clocks go forward) moves to the first instant after the gap;
 * a time that happens twice (clocks go back) is the earlier of the two.
 */
export function localToEpoch(date: string, time: string, timeZone: string): number {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const [h, mi] = time.split(':').map(Number) as [number, number];
  const wall = Date.UTC(y, mo - 1, d, h, mi, 0);
  // Try the offset just before and just after; the right one maps back to the same wall time.
  const candidates = [zoneOffsetMs(wall - 24 * 3600 * 1000, timeZone), zoneOffsetMs(wall + 24 * 3600 * 1000, timeZone)];
  const instants = [...new Set(candidates)].map((off) => wall - off).filter((t) => zoneOffsetMs(t, timeZone) === wall - t).sort((a, b) => a - b);
  if (instants.length > 0) return (instants[0] as number) / 1000;
  // Inside the gap: use the offset in force before the change, which lands just after the gap.
  return (wall - (candidates[0] as number)) / 1000;
}

/** 'YYYY-MM-DD' and 'HH:MM' of an instant on the wall clock of `timeZone`. */
export function epochToLocal(epochSeconds: number, timeZone: string): { date: string; time: string } {
  const p = parts(epochSeconds * 1000, timeZone);
  const two = (n: number | undefined) => String(n ?? 0).padStart(2, '0');
  return { date: `${String(p['year']).padStart(4, '0')}-${two(p['month'])}-${two(p['day'])}`, time: `${two(p['hour'])}:${two(p['minute'])}` };
}

/** Start of a local calendar day and the last second of it, as instants. */
export function dayBounds(date: string, timeZone: string): { start: number; end: number } {
  const start = localToEpoch(date, '00:00', timeZone);
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start, end: localToEpoch(next.toISOString().slice(0, 10), '00:00', timeZone) - 1 };
}
