// Server access. EXPO_PUBLIC_* values are baked into the bundle at build time (set them on the Mac).
import { deviceId } from './deviceId';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.rodinnapripravenost.com';

// Maps work without an account: the server counts downloads per anonymous device id.
export function apiHeaders(): Record<string, string> {
  return { 'X-Device-Id': deviceId() };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown
  ) {
    super(`API ${status}`);
  }
}

export async function apiPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return apiRequest<T>('POST', path, { body, signal });
}

/** JSON request; with a session token for account endpoints. Empty responses (204) give null. */
export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  { body, token, signal }: { body?: unknown; token?: string; signal?: AbortSignal } = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...apiHeaders(),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

/** The server's error code, e.g. 'wrong_code', or null. */
export function errorCode(e: unknown): string | null {
  const detail = e instanceof ApiError ? (e.body as { detail?: unknown } | null)?.detail : null;
  return detail && typeof detail === 'object' && 'code' in detail ? String((detail as { code: unknown }).code) : null;
}
