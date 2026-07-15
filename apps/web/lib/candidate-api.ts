const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';

export interface CandidateApiOptions extends RequestInit {
  json?: unknown;
}

export interface CandidateSession {
  token: string;
  candidate: { id: string; email: string; name: string };
}

const TOKEN_KEY = 'g360.candidateToken';

export function getCandidateToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setCandidateToken(token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearCandidateToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
}

export class CandidateApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function candidateApi<T>(path: string, opts: CandidateApiOptions = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  if (opts.json !== undefined) headers.set('content-type', 'application/json');
  const token = getCandidateToken();
  if (token) headers.set('authorization', `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body,
  });
  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) {
    let message = `Erro ${res.status}`;
    if (body && typeof body === 'object' && 'message' in body) message = String((body as { message: unknown }).message);
    throw new CandidateApiError(res.status, message, body);
  }
  return body as T;
}

export function companyQuery(empresa: string | null): string {
  if (!empresa) return '';
  return `?empresa=${encodeURIComponent(empresa)}`;
}

export function resolveCareersCompanySlug(param: string | null): string | null {
  if (param) return param;
  if (typeof window === 'undefined') return null;
  const parts = window.location.hostname.split('.');
  if (parts.length >= 3 && !['www', 'app'].includes(parts[0])) return parts[0];
  return null;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
