// "I'm In" (D-18): the guest's own plan, kept on this device only. It shows nothing to anyone else, counts nothing and
// is never sent anywhere. localStorage is a per-device convenience, so every access is wrapped (CLAUDE.md): when storage
// is blocked the plan lives in memory for this visit.
import { useCallback, useState } from 'preact/hooks';

const keyFor = (slug: string) => `hc_plan:${slug}`;

export function readPlan(slug: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(keyFor(slug));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function writePlan(slug: string, plan: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(keyFor(slug), JSON.stringify([...plan]));
  } catch {
    /* blocked or full: the plan stays in memory for this visit */
  }
}

export function usePlan(slug: string) {
  const [plan, setPlan] = useState<Set<string>>(() => readPlan(slug));
  /** Adds or removes an activity; returns true when it was added. */
  const toggle = useCallback(
    (id: string): boolean => {
      const next = new Set(plan);
      const added = !next.has(id);
      if (added) next.add(id);
      else next.delete(id);
      writePlan(slug, next);
      setPlan(next);
      return added;
    },
    [plan, slug],
  );
  return { plan, toggle };
}