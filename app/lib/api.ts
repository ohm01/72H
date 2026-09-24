// Server access. EXPO_PUBLIC_* values are baked into the bundle at build time (set them on the Mac).
import { deviceId } from './deviceId';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.jennase.org';

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
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...apiHeaders() },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}
