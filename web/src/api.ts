import type {
  PublicActivity,
  PublicOffer,
  PublicPlace,
  PublicProperty,
  PublicPropertyChoice,
} from '../../shared/types.ts';
import type { EventName } from '../../shared/schemas.ts';

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new ApiError(res.status);
  return (await res.json()) as T;
}

export const api = {
  hostProperties: () => getJson<PublicPropertyChoice[]>('/api/hosts/properties'),
  config: (slug: string) => getJson<PublicProperty>(`/api/p/${slug}/config`),
  activities: (slug: string) => getJson<PublicActivity[]>(`/api/p/${slug}/activities`),
  places: (slug: string) => getJson<PublicPlace[]>(`/api/p/${slug}/places`),
  offers: (slug: string) => getJson<PublicOffer[]>(`/api/p/${slug}/offers`),
  /** Aggregate count only. Failure (offline, read-only) is ignored on purpose. */
  async event(slug: string, event: EventName): Promise<void> {
    try {
      await fetch(`/api/p/${slug}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event }),
      });
    } catch {
      /* ignored */
    }
  },
};
