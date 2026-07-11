import { expect, test, type Page } from '@playwright/test';
import { adminCredentials, apiGet, apiPost, demoCredentials, loginApi, type Session } from './helpers';

// Mesmo padrão de credenciais das demais suites do Serviço Pessoal.
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

const apiBase = process.env.E2E_API_URL ?? 'http://127.0.0.1:3333/api';
const stamp = Date.now();
const testCpf = makeCpf(String(stamp).slice(-9));
let managerSession: Session;
let workerSession: Session;
let employeeId: string;
let vacationId: string;
let vacationStart: string; // YYYY-MM-DD (futuro)
let vacationEnd: string;

function makeCpf(base9: string): string {
  const digits = base9.padStart(9, '2').split('').map(Number);
  for (const factor of [10, 11]) {
    let sum = 0;
    for (let i = 0; i < factor - 1; i++) sum += digits[i] * (factor - i);
    digits.push(((sum * 10) % 11) % 10);
  }
  return digits.join('');
}

function isoPlusDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

test.beforeAll(async ({ request }) => {
  managerSession = await loginApi(request, managerCredentials);
  workerSession = await loginApi(request, workerCredentials);
  // Idempotência: desvincula colaboradores E2E de execuções anteriores do mesmo usuário
  const previous = await apiGet<any>(request, managerSession.accessToken, '/personnel/employees?search=E2E Ferias');
  for (const item of previous.items ?? []) {
    await request.patch(`${apiBase}/personnel/employees/${item.id}`, {
      headers: { authorization: `Bearer ${managerSession.accessToken}` },
      data: { profile: { userId: null }, status: 'INACTIVE', reason: 'Limpeza E2E' },
    });
  }
  // Colaborador de teste vinculado ao usuário comum, com 2 períodos aquisitivos completos
  const created = await apiPost<any>(request, managerSession.accessToken, '/personnel/employees', {
    name: `E2E Ferias ${stamp}`,
    registrationId: `E2E-FER-${stamp}`,
    jobName: `Analista Ferias E2E ${stamp}`,
    profile: {
      cpf: testCpf,
      admissionDate: new Date(Date.now() - 800 * 86_400_000).toISOString().slice(0, 10), // ~2,2 anos atrás
      userId: workerSession.user.id,
    },
  });
  employeeId = created.id;
});

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

test('API: autoatendimento mostra períodos aquisitivos e saldo (CLT)', async ({ request }) => {
  const overview = await apiGet<any>(request, workerSession.accessToken, '/personnel/vacations/me');
  expect(overview.linked).toBe(true);
  expect(overview.employee.id).toBe(employeeId);
  expect(overview.balance.periods).toHaveLength(2); // 2 períodos de 12 meses completos
  expect(overview.balance.totalBalance).toBe(60);
  expect(overview.balance.periods[0].entitledDays).toBe(30);
});

test('API: colaborador solicita férias; validações de intervalo e sobreposição', async ({ request }) => {
  vacationStart = isoPlusDays(30);
  vacationEnd = isoPlusDays(39); // 10 dias corridos
  const created = await apiPost<any>(request, workerSession.accessToken, '/personnel/vacations/me', {
    startDate: vacationStart,
    endDate: vacationEnd,
    notes: 'Férias solicitadas pelo E2E',
  });
  vacationId = created.id;
  expect(created.status).toBe('REQUESTED');
  expect(created.days).toBe(10);

  // Sobreposição é recusada
  const headers = { authorization: `Bearer ${workerSession.accessToken}` };
  const overlap = await request.post(`${apiBase}/personnel/vacations/me`, {
    headers,
    data: { startDate: isoPlusDays(35), endDate: isoPlusDays(44) },
  });
  expect(overlap.status()).toBe(409);

  // Menos de 5 dias é recusado
  const short = await request.post(`${apiBase}/personnel/vacations/me`, {
    headers,
    data: { startDate: isoPlusDays(60), endDate: isoPlusDays(62) },
  });
  expect(short.status()).toBe(400);
});

test('API: aprovação em 2 níveis (gestor -> DP) gera evento no prontuário', async ({ request }) => {
  const token = managerSession.accessToken;
  const first = await apiPost<any>(request, token, `/personnel/vacations/${vacationId}/approve`, {});
  expect(first.status).toBe('MANAGER_APPROVED');
  const second = await apiPost<any>(request, token, `/personnel/vacations/${vacationId}/approve`, {});
  expect(second.status).toBe('APPROVED');

  const detail = await apiGet<any>(request, token, `/personnel/employees/${employeeId}`);
  expect(detail.employmentEvents.some((e: any) => e.type === 'FERIAS')).toBe(true);
});

test('API: férias aprovadas abonam o dia no espelho da equipe (status VACATION)', async ({ request }) => {
  const team = await apiGet<any>(request, managerSession.accessToken, `/personnel/time-clock/team?day=${vacationStart}`);
  const row = team.rows.find((r: any) => r.user.id === workerSession.user.id);
  expect(row).toBeTruthy();
  expect(row.status).toBe('VACATION');
  expect(row.plannedMinutes).toBe(0);
});

test('API: afastamento cobre o espelho (LEAVE) e CID fica restrito', async ({ request }) => {
  const token = managerSession.accessToken;
  const yesterday = isoPlusDays(-1);
  const leave = await apiPost<any>(request, token, '/personnel/leaves', {
    employeeId,
    type: 'ATESTADO',
    startDate: yesterday,
    endDate: isoPlusDays(0),
    cid: 'J06.9',
    description: 'Atestado E2E',
  });
  expect(leave.id).toBeTruthy();

  // Espelho do colaborador: ontem coberto como LEAVE, jornada abonada
  const mirror = await apiGet<any>(request, workerSession.accessToken, `/personnel/time-clock/me?from=${yesterday}&to=${yesterday}`);
  const day = mirror.days.find((d: any) => d.dayKey === yesterday);
  expect(day.status).toBe('LEAVE');
  expect(day.plannedMinutes).toBe(0);
  expect(day.balanceMinutes).toBe(0);

  // Lista não expõe o CID (LGPD): apenas hasCid
  const leaves = await apiGet<any>(request, token, '/personnel/leaves');
  const mine = leaves.find((l: any) => l.id === leave.id);
  expect(mine.hasCid).toBe(true);
  expect(mine.cid).toBeUndefined();
});

test('API: saldo desconta os dias solicitados e endpoint de saldos lista o colaborador', async ({ request }) => {
  const overview = await apiGet<any>(request, workerSession.accessToken, '/personnel/vacations/me');
  expect(overview.balance.totalBalance).toBe(50); // 60 - 10 aprovados

  const balances = await apiGet<any>(request, managerSession.accessToken, '/personnel/vacations/balances');
  const row = balances.find((b: any) => b.employee.id === employeeId);
  expect(row.totalBalance).toBe(50);
});

test('API: colaborador sem pessoal:* não aprova nem lista solicitações da empresa', async ({ request }) => {
  const headers = { authorization: `Bearer ${workerSession.accessToken}` };
  const approve = await request.post(`${apiBase}/personnel/vacations/${vacationId}/approve`, { headers, data: {} });
  expect(approve.status()).toBe(403);
  const list = await request.get(`${apiBase}/personnel/vacations`, { headers });
  expect(list.status()).toBe(403);
});

// ---------------------------------------------------------------------------
// UI (Chromium)
// ---------------------------------------------------------------------------

test('UI: colaborador vê saldo e solicita férias; gestor aprova em 2 níveis', async ({ page, browser }) => {
  const errors = monitorClientErrors(page);

  // Colaborador: Minhas Férias
  await open(page, '/servico-pessoal/ferias', workerSession);
  await expect(page.getByRole('heading', { name: 'Férias e Afastamentos' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Saldo disponível')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Períodos aquisitivos', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Solicitar férias' }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Solicitar minhas férias' });
  await dialog.locator('input[type="date"]').first().fill(isoPlusDays(90));
  await dialog.locator('input[type="date"]').nth(1).fill(isoPlusDays(96)); // 7 dias
  await expect(dialog.getByText(/7 dia\(s\) corridos/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Enviar solicitação' }).click();
  await expect(page.getByText('Solicitação de férias enviada')).toBeVisible({ timeout: 30_000 });

  // Gestor DP: aprova em 2 cliques
  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await open(managerPage, '/servico-pessoal/ferias?tab=solicitacoes', managerSession);
  await expect(managerPage.getByRole('heading', { name: 'Férias e Afastamentos' })).toBeVisible({ timeout: 60_000 });
  const requestCard = managerPage.locator('div.rounded-md.border').filter({ hasText: `E2E Ferias ${stamp}` }).first();
  await expect(requestCard).toBeVisible({ timeout: 30_000 });
  await requestCard.getByRole('button', { name: 'Aprovar (gestor)' }).click();
  // 1º nível aprovado: o mesmo cartão passa a oferecer a aprovação final do DP
  await expect(requestCard.getByRole('button', { name: 'Aprovar (DP)' })).toBeVisible({ timeout: 30_000 });
  await requestCard.getByRole('button', { name: 'Aprovar (DP)' }).click();
  // 2º nível aprovado: sai da fila de pendentes (vai para o histórico como Aprovada)
  await expect(requestCard).toBeHidden({ timeout: 30_000 });
  await managerContext.close();

  expect(errors).toEqual([]);
});

test('UI: aba Saldos alerta vencimentos e aba Afastamentos registra atestado', async ({ page }) => {
  const errors = monitorClientErrors(page);
  await open(page, '/servico-pessoal/ferias?tab=saldos', managerSession);
  await expect(page.getByRole('heading', { name: 'Férias e Afastamentos' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Saldo de férias por colaborador')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('cell', { name: `E2E Ferias ${stamp}` })).toBeVisible();

  await page.getByRole('tab', { name: 'Afastamentos' }).click();
  await expect(page.getByRole('heading', { name: 'Afastamentos e atestados' })).toBeVisible();
  await expect(page.getByText('Atestado E2E').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('CID registrado').first()).toBeVisible();
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
