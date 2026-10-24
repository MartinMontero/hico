import { useCallback, useEffect, useState } from 'preact/hooks';
import { ApiError } from './api.ts';

export type Loaded<T> =
  | { status: 'loading' }
  | { status: 'error'; notFound: boolean; retry: () => void }
  | { status: 'ready'; data: T };

/** Loading, error with retry (nothing the guest typed is lost) and ready. Re-runs when key changes. */
export function useLoad<T>(key: string, fetcher: () => Promise<T>): Loaded<T> {
  const [state, setState] = useState<{ key: string; value: Loaded<T> }>({ key, value: { status: 'loading' } });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    setState({ key, value: { status: 'loading' } });
    fetcher().then(
      (data) => live && setState({ key, value: { status: 'ready', data } }),
      (error: unknown) =>
        live && setState({ key, value: { status: 'error', notFound: error instanceof ApiError && error.status === 404, retry } }),
    );
    return () => {
      live = false;
    };
    // fetcher is recreated every render; key identifies what is being loaded.
  }, [key, attempt]);

  return state.key === key ? state.value : { status: 'loading' };
}
