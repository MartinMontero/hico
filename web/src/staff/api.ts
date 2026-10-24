// Staff API client. Every write is a same-origin JSON POST, so the browser sends the Origin the server checks.

export interface StaffResult<T> {
  status: number;
  data: T | null;
  error: string | null;
}

export async function staffGet<T>(path: string): Promise<StaffResult<T>> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } });
  const body: unknown = await res.json().catch(() => null);
  return toResult<T>(res.status, body);
}

export async function staffPost<T>(path: string, body: unknown = {}): Promise<StaffResult<T>> {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
  const parsed: unknown = await res.json().catch(() => null);
  return toResult<T>(res.status, parsed);
}

function toResult<T>(status: number, body: unknown): StaffResult<T> {
  const error = body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string' ? (body as { error: string }).error : null;
  return { status, data: status < 400 ? (body as T) : null, error };
}

export interface Me {
  displayName: string;
  email: string;
  passkeys: number;
  properties: { slug: string; name: { en: string; fr: string }; role: 'editor' | 'admin' }[];
}

export const AUTH = '/api/staff/auth';
