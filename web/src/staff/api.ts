// Staff API client. Every write is a same-origin JSON POST, so the browser sends the Origin the server checks.

export interface StaffResult<T> {
  status: number;
  data: T | null;
  error: string | null;
  /** The parsed body whatever the status: a 409 carries the current record in it. */
  body: unknown;
}

// Status 0 means the network failed: the screens show the same "try again" text as for a server error.
export async function staffGet<T>(path: string): Promise<StaffResult<T>> {
  try {
    const res = await fetch(path, { headers: { Accept: 'application/json' } });
    const body: unknown = await res.json().catch(() => null);
    return toResult<T>(res.status, body);
  } catch {
    return toResult<T>(0, null);
  }
}

export async function staffPost<T>(path: string, body: unknown = {}): Promise<StaffResult<T>> {
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
    const parsed: unknown = await res.json().catch(() => null);
    return toResult<T>(res.status, parsed);
  } catch {
    return toResult<T>(0, null);
  }
}

function toResult<T>(status: number, body: unknown): StaffResult<T> {
  const error = body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string' ? (body as { error: string }).error : null;
  return { status, data: status < 400 ? (body as T) : null, error, body };
}

export interface Me {
  displayName: string;
  email: string;
  passkeys: number;
  properties: { slug: string; name: { en: string; fr: string }; role: 'editor' | 'admin' }[];
}

export const AUTH = '/api/staff/auth';
