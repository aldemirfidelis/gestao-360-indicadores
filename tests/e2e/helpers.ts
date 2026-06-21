import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const apiBaseURL = process.env.E2E_API_URL ?? 'http://127.0.0.1:3333/api';

export const demoCredentials = { email: 'demo@demo.com', password: '123456' };
export const adminCredentials = { email: 'admin@demo.com', password: '123456' };
export const rhManagerCredentials = { email: 'gestor.rh@demo.com', password: '123456' };
export const platformAdminCredentials = { email: 'platform@demo.com', password: 'admin123' };

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    companyId: string;
    permissions?: string[];
  };
}

export async function loginApi(
  request: APIRequestContext,
  credentials: { email: string; password: string } = demoCredentials,
) {
  const response = await request.post(`${apiBaseURL}/auth/login`, { data: credentials });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<Session>;
}

export async function platformLoginApi(request: APIRequestContext) {
  const response = await request.post(`${apiBaseURL}/platform-admin/auth/login`, {
    data: platformAdminCredentials,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<{ accessToken: string; refreshToken: string }>;
}

export async function apiGet<T>(request: APIRequestContext, token: string, path: string) {
  const response = await request.get(`${apiBaseURL}${path}`, {
    headers: authHeaders(token),
  });
  return parseApiResponse<T>(response);
}

export async function apiPost<T>(
  request: APIRequestContext,
  token: string,
  path: string,
  data?: unknown,
) {
  const response = await request.post(`${apiBaseURL}${path}`, {
    headers: authHeaders(token),
    data,
  });
  return parseApiResponse<T>(response);
}

export async function apiPatch<T>(
  request: APIRequestContext,
  token: string,
  path: string,
  data?: unknown,
) {
  const response = await request.patch(`${apiBaseURL}${path}`, {
    headers: authHeaders(token),
    data,
  });
  return parseApiResponse<T>(response);
}

export async function setAppSession(page: Page, session: Pick<Session, 'accessToken' | 'refreshToken'>) {
  await page.goto('/login');
  await page.evaluate(
    ({ accessToken, refreshToken }) => {
      window.localStorage.setItem('g360.accessToken', accessToken);
      window.localStorage.setItem('g360.refreshToken', refreshToken);
    },
    session,
  );
}

export async function setPlatformSession(
  page: Page,
  session: { accessToken: string; refreshToken: string },
) {
  await page.goto('/platform-admin/login');
  await page.evaluate(
    ({ accessToken, refreshToken }) => {
      window.localStorage.setItem('g360.platformAdmin.accessToken', accessToken);
      window.localStorage.setItem('g360.platformAdmin.refreshToken', refreshToken);
    },
    session,
  );
}

export function uniqueCode(prefix: string) {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(4, 14);
  return `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function nextPeriodRef(offset = 0) {
  const month = ((new Date().getMonth() + offset) % 12) + 1;
  return `2026-${String(month).padStart(2, '0')}`;
}

export async function createIndicator(
  request: APIRequestContext,
  token: string,
  options: {
    code?: string;
    name?: string;
    ownerCode?: string;
    direction?: 'HIGHER_BETTER' | 'LOWER_BETTER';
    initialTarget?: number;
    initialResult?: number;
    periodRef?: string;
  } = {},
) {
  const refs = await apiGet<{
    orgNodes: Array<{ id: string; code: string | null; name: string; type: string }>;
    users: Array<{ id: string; email: string; name: string }>;
  }>(request, token, '/indicators/options');
  const owner =
    refs.orgNodes.find((node) => node.code === (options.ownerCode ?? 'RH')) ??
    refs.orgNodes.find((node) => node.type === 'AREA') ??
    refs.orgNodes[0];
  expect(owner, 'seed deve ter ao menos uma area organizacional').toBeTruthy();
  const responsible = refs.users.find((user) => user.email === adminCredentials.email) ?? refs.users[0];
  const code = options.code ?? uniqueCode('E2E');
  return apiPost<any>(request, token, '/indicators', {
    ownerNodeId: owner.id,
    responsibleUserId: responsible?.id ?? null,
    name: options.name ?? `Indicador ${code}`,
    code,
    description: 'Criado por Playwright E2E.',
    type: 'OPERATIONAL',
    unit: 'PERCENT',
    periodicity: 'MONTHLY',
    direction: options.direction ?? 'HIGHER_BETTER',
    initialTarget: options.initialTarget,
    initialResult: options.initialResult,
    initialPeriodRef: options.periodRef ?? nextPeriodRef(),
  });
}

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function parseApiResponse<T>(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  const text = await response.text();
  expect(response.ok(), text).toBeTruthy();
  return (text ? JSON.parse(text) : null) as T;
}
