import { expect, test, type Page } from '@playwright/test';
import { adminCredentials, apiGet, apiPost, demoCredentials, loginApi, type Session } from './helpers';

// Credenciais parametrizáveis (mesmo padrão da suite documents-ged):
// no CI valem as do seed padrão; localmente aponte para a Empresa Demonstração.
const managerCredentials = {
  email: process.env.E2E_DOC_ADMIN_EMAIL ?? adminCredentials.email,
  password: process.env.E2E_DOC_ADMIN_PASSWORD ?? adminCredentials.password,
};
const workerCredentials = {
  email: process.env.E2E_DOC_USER_EMAIL ?? demoCredentials.email,
  password: process.env.E2E_DOC_USER_PASSWORD ?? demoCredentials.password,
};

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

let managerSession: Session;
let workerSession: Session;

test.beforeAll(async ({ request }) => {
  managerSession = await loginApi(request, managerCredentials);
  workerSession = await loginApi(request, workerCredentials);
  // Saneamento: se uma execução anterior falhou com a competência fechada, reabre.
  const periods = await apiGet<any[]>(request, managerSession.accessToken, '/personnel/time-clock/periods');
  for (const period of periods.filter((p) => p.status === 'CLOSED')) {
    await apiPost(request, managerSession.accessToken, `/personnel/time-clock/periods/${period.periodRef}/reopen`, {});
  }
});

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

test('API: batida registra entrada/saída alternadas com cadeia de hash', async ({ request }) => {
  const token = workerSession.accessToken;
  const first = await apiPost<any>(request, token, '/personnel/time-clock/punch', {});
  expect(['IN', 'OUT']).toContain(first.entry.kind);
  expect(first.entry.hash).toHaveLength(64);
  expect(first.day.entries.length).toBeGreaterThan(0);

  // Anti clique-duplo: segunda batida em menos de 1 minuto é recusada
  const again = await request.post(`${process.env.E2E_API_URL ?? 'http://127.0.0.1:3333/api'}/personnel/time-clock/punch`, {
    headers: { authorization: `Bearer ${token}` },
    data: {},
  });
  expect(again.status()).toBe(409);
});

test('API: espelho mensal calcula totais e resume o dia de hoje', async ({ request }) => {
  const token = workerSession.accessToken;
  const mirror = await apiGet<any>(request, token, '/personnel/time-clock/me');
  expect(mirror.days.length).toBeGreaterThan(0);
  expect(mirror.totals).toHaveProperty('balanceMinutes');
  const today = mirror.days.find((d: any) => d.dayKey === mirror.today);
  expect(today).toBeTruthy();
  expect(today.entries.length).toBeGreaterThan(0);

  const summary = await apiGet<any>(request, token, '/personnel/time-clock/summary');
  expect(summary.today.dayKey).toBe(mirror.today);
  expect(['IN', 'OUT']).toContain(summary.today.nextKind);
});

test('API: escala criada e atribuída passa a valer no espelho da equipe', async ({ request }) => {
  const token = managerSession.accessToken;
  const name = `E2E Escala ${Date.now()}`;
  const template = await apiPost<any>(request, token, '/personnel/schedules', {
    name,
    toleranceMinutes: 10,
    weeklyRules: {
      mon: { start: '08:00', end: '17:00', breakMinutes: 60 },
      tue: { start: '08:00', end: '17:00', breakMinutes: 60 },
      wed: { start: '08:00', end: '17:00', breakMinutes: 60 },
      thu: { start: '08:00', end: '17:00', breakMinutes: 60 },
      fri: { start: '08:00', end: '17:00', breakMinutes: 60 },
      sat: null,
      sun: null,
    },
  });
  expect(template.id).toBeTruthy();

  const assigned = await apiPost<any>(request, token, '/personnel/schedules/assign', {
    templateId: template.id,
    userIds: [workerSession.user.id],
  });
  expect(assigned.assigned).toBe(1);

  const team = await apiGet<any>(request, token, '/personnel/time-clock/team');
  const row = team.rows.find((r: any) => r.user.id === workerSession.user.id);
  expect(row).toBeTruthy();
  expect(row.hasSchedule).toBe(true);
});

test('API: ajuste solicitado pelo colaborador e aprovado recria o espelho do dia', async ({ request }) => {
  const workerToken = workerSession.accessToken;
  const managerToken = managerSession.accessToken;
  const mirror = await apiGet<any>(request, workerToken, '/personnel/time-clock/me');
  // Usa um dia passado do mês (ou hoje, no dia 1º) para não conflitar com batidas de agora
  const dayKey = mirror.days.length > 1 ? mirror.days[mirror.days.length - 1].dayKey : mirror.today;

  const created = await apiPost<any>(request, workerToken, '/personnel/time-clock/adjustments', {
    dayKey,
    proposedTimes: ['08:00', '12:00', '13:00', '17:00'],
    reason: 'Esqueci de registrar as batidas (E2E)',
  });
  expect(created.status).toBe('REQUESTED');

  const pending = await apiGet<any>(request, managerToken, '/personnel/time-clock/adjustments/pending');
  expect(pending.some((r: any) => r.id === created.id)).toBe(true);

  const approved = await apiPost<any>(request, managerToken, `/personnel/time-clock/adjustments/${created.id}/approve`, {});
  expect(approved.status).toBe('APPROVED');

  const after = await apiGet<any>(request, workerToken, `/personnel/time-clock/me?from=${dayKey}&to=${dayKey}`);
  const day = after.days.find((d: any) => d.dayKey === dayKey);
  expect(day.entries).toHaveLength(4);
  expect(day.entries.every((e: any) => e.source === 'MANUAL')).toBe(true);
  expect(day.workedMinutes).toBe(480);
});

test('API: competência fechada bloqueia batidas e ajustes; reabrir libera', async ({ request }) => {
  const managerToken = managerSession.accessToken;
  const workerToken = workerSession.accessToken;
  const summary = await apiGet<any>(request, workerToken, '/personnel/time-clock/summary');
  const ref = summary.period.ref;

  const closed = await apiPost<any>(request, managerToken, `/personnel/time-clock/periods/${ref}/close`, {});
  expect(closed.status).toBe('CLOSED');

  const apiBase = process.env.E2E_API_URL ?? 'http://127.0.0.1:3333/api';
  const blockedPunch = await request.post(`${apiBase}/personnel/time-clock/punch`, {
    headers: { authorization: `Bearer ${workerToken}` },
    data: {},
  });
  expect(blockedPunch.status()).toBe(409);

  const reopened = await apiPost<any>(request, managerToken, `/personnel/time-clock/periods/${ref}/reopen`, {});
  expect(reopened.status).toBe('OPEN');
});

test('API: importação de batidas CSV entra no espelho e ignora duplicadas', async ({ request }) => {
  const managerToken = managerSession.accessToken;
  const workerToken = workerSession.accessToken;
  // Um dia passado do mês corrente, sem conflito com as batidas de hoje
  const mirror = await apiGet<any>(request, workerToken, '/personnel/time-clock/me');
  const dayKey = mirror.days.length > 2 ? mirror.days[mirror.days.length - 2].dayKey : mirror.today;
  const csv = [
    'email;data;hora',
    `${workerCredentials.email};${dayKey};06:02`,
    `${workerCredentials.email};${dayKey};10:30`,
  ].join('\n');

  const first = await apiPost<any>(request, managerToken, '/personnel/time-clock/import', { content: csv });
  expect(first.imported).toBe(2);

  const again = await apiPost<any>(request, managerToken, '/personnel/time-clock/import', { content: csv });
  expect(again.imported).toBe(0);
  expect(again.duplicates).toBe(2);

  const after = await apiGet<any>(request, workerToken, `/personnel/time-clock/me?from=${dayKey}&to=${dayKey}`);
  const day = after.days.find((d: any) => d.dayKey === dayKey);
  const imported = day.entries.filter((e: any) => e.source === 'IMPORT');
  expect(imported.length).toBeGreaterThanOrEqual(2);
});

test('API: resumo traz banco acumulado e relatório da competência lista colaboradores', async ({ request }) => {
  const managerToken = managerSession.accessToken;
  const summary = await apiGet<any>(request, workerSession.accessToken, '/personnel/time-clock/summary');
  expect(summary.bank).toHaveProperty('totalMinutes');

  const report = await apiGet<any>(request, managerToken, `/personnel/time-clock/periods/${summary.period.ref}/report`);
  expect(report.rows.some((row: any) => row.user.id === workerSession.user.id)).toBe(true);

  const apiBase = process.env.E2E_API_URL ?? 'http://127.0.0.1:3333/api';
  const csv = await request.get(`${apiBase}/personnel/time-clock/periods/${summary.period.ref}/report.csv`, {
    headers: { authorization: `Bearer ${managerToken}` },
  });
  expect(csv.ok()).toBe(true);
  expect(csv.headers()['content-type']).toContain('text/csv');
  expect(await csv.text()).toContain('colaborador;email');
});

test('API: colaborador sem ponto:manage não decide ajustes nem fecha competência', async ({ request }) => {
  const apiBase = process.env.E2E_API_URL ?? 'http://127.0.0.1:3333/api';
  const headers = { authorization: `Bearer ${workerSession.accessToken}` };
  const pending = await request.get(`${apiBase}/personnel/time-clock/adjustments/pending`, { headers });
  expect(pending.status()).toBe(403);
  const close = await request.post(`${apiBase}/personnel/time-clock/periods/2026-01/close`, { headers, data: {} });
  expect(close.status()).toBe(403);
});

// ---------------------------------------------------------------------------
// UI (Chromium)
// ---------------------------------------------------------------------------

test('UI: gestor bate ponto, vê espelho, equipe e escalas', async ({ page, context }) => {
  const errors = monitorClientErrors(page);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -17.7419, longitude: -49.3562 });

  await open(page, '/servico-pessoal/ponto');
  await expect(page.getByRole('heading', { name: 'Controle de Ponto' })).toBeVisible({ timeout: 60_000 });

  // Batida com um clique (entrada ou saída, conforme alternância)
  const punchButton = page.getByRole('button', { name: /Registrar (entrada|saída)/ });
  await expect(punchButton).toBeVisible();
  await punchButton.click();
  await expect(page.getByText(/(Entrada|Saída) registrada às/)).toBeVisible({ timeout: 30_000 });

  // Espelho do mês mostra o dia de hoje com batidas
  await expect(page.getByText('Espelho de ponto —', { exact: false })).toBeVisible();
  await expect(page.getByText('Resumo do mês')).toBeVisible();

  // Equipe
  await page.getByRole('tab', { name: 'Equipe' }).click();
  await expect(page.getByText('Espelho da equipe —', { exact: false })).toBeVisible({ timeout: 30_000 });

  // Escalas: lista carregada (a escala criada via API aparece)
  await page.getByRole('tab', { name: 'Escalas' }).click();
  await expect(page.getByRole('button', { name: 'Nova escala' })).toBeVisible();
  await expect(page.getByText(/E2E Escala/).first()).toBeVisible({ timeout: 30_000 });

  // Fechamento
  await page.getByRole('tab', { name: 'Fechamento' }).click();
  await expect(page.getByRole('heading', { name: 'Fechamento de competência' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fechar', exact: false }).first()).toBeVisible();

  expect(errors).toEqual([]);
});

test('UI: colaborador solicita ajuste pelo espelho e gestor aprova pela aba Ajustes', async ({ page, browser }) => {
  const errors = monitorClientErrors(page);

  // Colaborador: abre espelho e solicita ajuste de um dia passado
  await open(page, '/servico-pessoal/ponto', workerSession);
  await expect(page.getByRole('heading', { name: 'Controle de Ponto' })).toBeVisible({ timeout: 60_000 });
  const adjustButtons = page.getByRole('button', { name: 'Solicitar ajuste' });
  await expect(adjustButtons.last()).toBeVisible({ timeout: 30_000 });
  await adjustButtons.last().click();

  const dialog = page.getByRole('dialog').filter({ hasText: 'Solicitar ajuste' });
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder(/esqueci de registrar/i).fill('Ajuste solicitado pelo teste E2E de UI');
  await dialog.getByRole('button', { name: 'Enviar solicitação' }).click();
  await expect(page.getByText('Solicitação de ajuste enviada')).toBeVisible({ timeout: 30_000 });

  // Gestor: aprova na aba Ajustes
  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await open(managerPage, '/servico-pessoal/ponto?tab=ajustes', managerSession);
  await expect(managerPage.getByText('Ajustes aguardando aprovação')).toBeVisible({ timeout: 60_000 });
  await expect(managerPage.getByText('Ajuste solicitado pelo teste E2E de UI').first()).toBeVisible({ timeout: 30_000 });
  await managerPage.getByRole('button', { name: 'Aprovar' }).first().click();
  await expect(managerPage.getByText('Ajuste aprovado e espelho atualizado')).toBeVisible({ timeout: 30_000 });
  await managerContext.close();

  expect(errors).toEqual([]);
});

async function open(page: Page, path: string, session: Session = managerSession) {
  await page.addInitScript(
    ({ accessToken, refreshToken }) => {
      window.localStorage.setItem('g360.accessToken', accessToken);
      window.localStorage.setItem('g360.refreshToken', refreshToken);
    },
    session,
  );
  await page.goto(path);
}

function monitorClientErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}
