const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';

const ACCESS_KEY = 'g360.platformAdmin.accessToken';
const REFRESH_KEY = 'g360.platformAdmin.refreshToken';

export interface PlatformAdminApiOptions extends RequestInit {
  json?: unknown;
}

export function getPlatformAdminAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getPlatformAdminRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setPlatformAdminTokens(accessToken: string, refreshToken?: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) window.localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearPlatformAdminTokens() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

async function refreshAccess() {
  const refreshToken = getPlatformAdminRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/platform-admin/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { accessToken: string };
    setPlatformAdminTokens(body.accessToken);
    return true;
  } catch {
    return false;
  }
}

export async function platformAdminApi<T>(path: string, opts: PlatformAdminApiOptions = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  if (opts.json !== undefined) headers.set('content-type', 'application/json');
  const token = getPlatformAdminAccessToken();
  if (token) headers.set('authorization', `Bearer ${token}`);

  const init: RequestInit = {
    ...opts,
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body,
  };
  let res = await fetch(`${API_URL}/platform-admin${path}`, init);

  if (res.status === 401 && (await refreshAccess())) {
    const retryHeaders = new Headers(headers);
    const nextToken = getPlatformAdminAccessToken();
    if (nextToken) retryHeaders.set('authorization', `Bearer ${nextToken}`);
    res = await fetch(`${API_URL}/platform-admin${path}`, { ...init, headers: retryHeaders });
  }

  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) {
    const message = body && typeof body === 'object' && 'message' in body ? String((body as { message: unknown }).message) : `Erro ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
