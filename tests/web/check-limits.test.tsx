import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CHECK_LIMIT_DAYS, DAY_SECONDS, pastCheckLimit, type CheckKind } from '../../shared/check-limits.ts';
import { UiProvider } from '../../web/src/context.tsx';
import { Stamp } from '../../web/src/pages.tsx';

// The guest page's stamp: an item checked 89 days ago reads as current, one checked 91 days ago says to check at the
// desk. The limits are imported from the shared file, so a change there moves the page and the staff projection together.

const NOW = 1_800_000_000;
let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  render(null, container);
  container.remove();
});

const text = async (verifiedOn: number | null, kind: CheckKind) => {
  await act(() => render(<UiProvider><Stamp verifiedOn={verifiedOn} timeZone="America/Vancouver" kind={kind} now={NOW} /></UiProvider>, container));
  return container.textContent ?? '';
};

describe.each(['board', 'places'] as const)('guest stamp, %s', (kind) => {
  const days = CHECK_LIMIT_DAYS[kind];
  it('just inside the limit reads as current', async () => {
    expect(await text(NOW - (days - 1) * DAY_SECONDS, kind)).toMatch(/^Checked by staff on /);
  });
  it('just outside the limit says to check at the desk', async () => {
    expect(await text(NOW - (days + 1) * DAY_SECONDS, kind)).toMatch(/^Last checked on .*Check at the desk\.$/);
  });
  it('no stamp at all never reads as current', async () => {
    expect(await text(null, kind)).not.toMatch(/^Checked by staff/);
  });
});

describe('the shared rule', () => {
  it.each(['board', 'places', 'offers'] as const)('%s: exactly at the limit is current, one second past is not', (kind) => {
    const limit = CHECK_LIMIT_DAYS[kind] * DAY_SECONDS;
    expect(pastCheckLimit(NOW - limit, NOW, kind)).toBe(false);
    expect(pastCheckLimit(NOW - limit - 1, NOW, kind)).toBe(true);
    expect(pastCheckLimit(null, NOW, kind)).toBe(true);
  });
});
