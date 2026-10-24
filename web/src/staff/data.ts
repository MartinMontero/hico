import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { staffGet, staffPost, type StaffResult } from './api.ts';

export interface PropertyContext {
  slug: string;
  role: 'editor' | 'admin';
  timezone: string;
  name: { en: string; fr: string };
}

export interface Api {
  base: string;
  get: <T>(path: string) => Promise<StaffResult<T>>;
  post: <T>(path: string, body?: unknown) => Promise<StaffResult<T>>;
}

/** The property's staff API. A 401 anywhere means the session ended: the console goes back to the sign-in screen. */
export function useApi(slug: string, onSignedOut: () => void): Api {
  const out = useRef(onSignedOut);
  out.current = onSignedOut;
  const base = `/api/staff/p/${slug}`;
  return useRef<Api>({
    base,
    get: async <T,>(path: string) => {
      const res = await staffGet<T>(`${base}${path}`);
      if (res.status === 401) out.current();
      return res;
    },
    post: async <T,>(path: string, body: unknown = {}) => {
      const res = await staffPost<T>(`${base}${path}`, body);
      if (res.status === 401) out.current();
      return res;
    },
  }).current;
}

export type Resource<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; code: number };

/** Loads a list once and again on `reload`. The old data stays on screen while it reloads. */
export function useResource<T>(api: Api, path: string, enabled = true): { state: Resource<T>; reload: () => Promise<void> } {
  const [state, setState] = useState<Resource<T>>({ status: 'loading' });
  const reload = useCallback(async () => {
    const res = await api.get<T>(path);
    if (res.status === 200 && res.data !== null) setState({ status: 'ready', data: res.data });
    else setState({ status: 'error', code: res.status });
  }, [api, path]);
  useEffect(() => {
    if (enabled) void reload();
  }, [reload, enabled]);
  return { state, reload };
}
