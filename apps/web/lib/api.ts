const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';

export interface ApiOptions extends RequestInit {
  json?: unknown;
}

const TOKEN_KEY = 'g360.accessToken';
const REFRESH_KEY = 'g360.refreshToken';
const PLATFORM_ACCESS_KEY = 'g360.platformAdmin.accessToken';
const PLATFORM_REFRESH_KEY = 'g360.platformAdmin.refreshToken';
const PLATFORM_COMPANY_CONTEXT_KEY = 'g360.platformAdmin.companyId';
const PLATFORM_BRIDGED_PREFIXES = ['/admin/', '/access/', '/integrations/external', '/users'];

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh?: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, access);
  if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function refreshAccess(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { accessToken: string };
    setTokens(data.accessToken);
    return true;
  } catch {
    return false;
  }
}

function isPlatformAdminContext(path: string) {
  if (typeof window === 'undefined') return false;
  if (!window.location.pathname.startsWith('/platform-admin')) return false;
  if (!window.localStorage.getItem(PLATFORM_ACCESS_KEY)) return false;
  const pathname = path.split('?')[0];
  return PLATFORM_BRIDGED_PREFIXES.some((prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix));
}

async function refreshPlatformAdminAccess(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const refreshToken = window.localStorage.getItem(PLATFORM_REFRESH_KEY);
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/platform-admin/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { accessToken: string };
    window.localStorage.setItem(PLATFORM_ACCESS_KEY, data.accessToken);
    return true;
  } catch {
    return false;
  }
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  if (opts.json !== undefined) {
    headers.set('content-type', 'application/json');
  }
  const platformAdminContext = isPlatformAdminContext(path);
  const token = platformAdminContext && typeof window !== 'undefined'
    ? window.localStorage.getItem(PLATFORM_ACCESS_KEY)
    : getAccessToken();
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (platformAdminContext && typeof window !== 'undefined') {
    const companyId = window.localStorage.getItem(PLATFORM_COMPANY_CONTEXT_KEY);
    if (companyId) headers.set('x-platform-company-id', companyId);
  }

  const init: RequestInit = {
    ...opts,
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body,
  };

  const resolvedPath = platformAdminContext ? `/platform-admin${path}` : path;
  let res = await fetch(`${API_URL}${resolvedPath}`, init);

  if (res.status === 401 && (platformAdminContext ? await refreshPlatformAdminAccess() : await refreshAccess())) {
    const t2 = platformAdminContext && typeof window !== 'undefined'
      ? window.localStorage.getItem(PLATFORM_ACCESS_KEY)
      : getAccessToken();
    if (t2) headers.set('authorization', `Bearer ${t2}`);
    res = await fetch(`${API_URL}${resolvedPath}`, { ...init, headers });
  }

  const text = await res.text();
  const body: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    let message = `Erro ${res.status}`;
    if (body && typeof body === 'object' && 'message' in body) {
      message = String((body as { message: unknown }).message);
    }
    throw new ApiError(res.status, message, body);
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
