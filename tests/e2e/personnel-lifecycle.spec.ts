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
let managerSession: Session;
let workerSession: Session;
let employeeId: string;
let onboardingId: string;

test.beforeAll(async ({ request }) => {
  managerSession = await loginApi(request, managerCredentials);
  workerSession = await loginApi(request, workerCredentials);
  const created = await apiPost<any>(request, managerSession.accessToken, '/personnel/employees', {
    name: `E2E Lifecycle ${stamp}`,
    registrationId: `E2E-LC-${stamp}`,
    jobName: `Analista Lifecycle E2E ${stamp}`,
    profile: { admissionDate: new Date().toISOString().slice(0, 10) },
  });
  employeeId = created.id;
});

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

test('API: admissão inicia com checklist padrão e evento na timeline', async ({ request }) => {
  const token = managerSession.accessToken;
  const process = await apiPost<any>(request, token, '/personnel/processes', {
    kind: 'ONBOARDING',
    employeeId,
  });
  onboardingId = process.id;
  expect(process.status).toBe('IN_PROGRESS');
  expect(process.items.length).toBeGreaterThanOrEqual(10);
  expect(process.items.some((item: any) => item.dossierKind === 'CPF' && item.required)).toBe(true);

  // Duplicado é recusado
  const dup = await request.post(`${apiBase}/personnel/processes`, {
    headers: { authorization: `Bearer ${token}` },
    data: { kind: 'ONBOARDING', employeeId },
  });
  expect(dup.status()).toBe(409);

  const detail = await apiGet<any>(request, token, `/personnel/employees/${employeeId}`);
  expect(detail.employmentEvents.some((e: any) => e.type === 'PROCESSO')).toBe(true);
});

test('API: item vinculado ao dossiê ganha badge automático após upload', async ({ request }) => {
  const token = managerSession.accessToken;
  await apiPost<any>(request, token, `/personnel/employees/${employeeId}/files`, {
    kind: 'CPF',
    name: 'CPF digitalizado',
    fileName: 'cpf-e2e.txt',
    mimeType: 'text/plain',
    contentBase64: Buffer.from('CPF do colaborador E2E').toString('base64'),
  });
  const process = await apiGet<any>(request, token, `/personnel/processes/${onboardingId}`);
  const cpfItem = process.items.find((item: any) => item.dossierKind === 'CPF');
  expect(cpfItem.dossierSatisfied).toBe(true);
  const contractItem = process.items.find((item: any) => item.dossierKind === 'CONTRATO');
  expect(contractItem.dossierSatisfied).toBe(false);
});

test('API: conclusão bloqueada com obrigatórios pendentes; libera após checklist completo', async ({ request }) => {
  const token = managerSession.accessToken;
  const headers = { authorization: `Bearer ${token}` };

  const blocked = await request.post(`${apiBase}/personnel/processes/${onboardingId}/complete`, { headers, data: {} });
  expect(blocked.status()).toBe(409);

  const process = await apiGet<any>(request, token, `/personnel/processes/${onboardingId}`);
  for (const item of process.items.filter((i: any) => i.required && !i.doneAt)) {
    await apiPost<any>(request, token, `/personnel/processes/${onboardingId}/items/${item.id}/toggle`, { done: true });
  }
  const completed = await apiPost<any>(request, token, `/personnel/processes/${onboardingId}/complete`, {});
  expect(completed.status).toBe('COMPLETED');

  // Toggle após conclusão é recusado
  const anyItem = completed.items[0];
  const late = await request.post(`${apiBase}/personnel/processes/${onboardingId}/items/${anyItem.id}/toggle`, { headers, data: {} });
  expect(late.status()).toBe(409);
});

test('API: desligamento concluído desativa o colaborador e registra DESLIGAMENTO', async ({ request }) => {
  const token = managerSession.accessToken;
  const process = await apiPost<any>(request, token, '/personnel/processes', {
    kind: 'OFFBOARDING',
    employeeId,
  });
  for (const item of process.items.filter((i: any) => i.required)) {
    await apiPost<any>(request, token, `/personnel/processes/${process.id}/items/${item.id}/toggle`, { done: true });
  }
  await apiPost<any>(request, token, `/personnel/processes/${process.id}/complete`, { note: 'Desligamento E2E via checklist' });

  const detail = await apiGet<any>(request, token, `/personnel/employees/${employeeId}`);
  expect(detail.status).toBe('INACTIVE');
  expect(detail.personnelProfile.terminationDate).toBeTruthy();
  expect(detail.employmentEvents.some((e: any) => e.type === 'DESLIGAMENTO')).toBe(true);

  // Reativa para os testes de ASO
  await request.patch(`${apiBase}/personnel/employees/${employeeId}`, {
    headers: { authorization: `Bearer ${token}` },
    data: { status: 'ACTIVE' },
  });
});

test('API: ASO com validade automática de 12 meses, alerta de vencido e evento', async ({ request }) => {
  const token = managerSession.accessToken;
  const examDate = new Date().toISOString().slice(0, 10);
  const exam = await apiPost<any>(request, token, '/personnel/medical-exams', {
    employeeId,
    type: 'ADMISSIONAL',
    examDate,
    physician: 'Dr. E2E',
  });
  expect(exam.status).toBe('VALID');
  expect(exam.validUntil).toBeTruthy();
  const months = (new Date(exam.validUntil).getTime() - new Date(exam.examDate).getTime()) / (30 * 86_400_000);
  expect(months).toBeGreaterThan(11);

  // Exame vencido aparece no filtro expiring e nos KPIs
  const oldDate = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
  await apiPost<any>(request, token, '/personnel/medical-exams', {
    employeeId,
    type: 'PERIODICO',
    examDate: oldDate,
  });
  const expiring = await apiGet<any>(request, token, '/personnel/medical-exams?expiring=true');
  expect(expiring.items.some((item: any) => item.employee.id === employeeId && item.status === 'EXPIRED')).toBe(true);
  expect(expiring.kpis.expired).toBeGreaterThanOrEqual(1);

  // Demissional não tem validade
  const demissional = await apiPost<any>(request, token, '/personnel/medical-exams', {
    employeeId,
    type: 'DEMISSIONAL',
    examDate,
  });
  expect(demissional.validUntil).toBeNull();
  expect(demissional.status).toBe('NO_EXPIRY');

  const detail = await apiGet<any>(request, token, `/personnel/employees/${employeeId}`);
  expect(detail.employmentEvents.some((e: any) => e.type === 'ASO')).toBe(true);
});

test('API: usuário sem pessoal:* não acessa processos nem exames', async ({ request }) => {
  const headers = { authorization: `Bearer ${workerSession.accessToken}` };
  const processes = await request.get(`${apiBase}/personnel/processes`, { headers });
  expect(processes.status()).toBe(403);
  const exams = await request.post(`${apiBase}/personnel/medical-exams`, { headers, data: {} });
  expect(exams.status()).toBe(403);
});

// ---------------------------------------------------------------------------
// UI (Chromium)
// ---------------------------------------------------------------------------

test('UI: inicia admissão, marca itens do checklist e conclui; registra ASO', async ({ page, request }) => {
  const errors = monitorClientErrors(page);
  const uiName = `E2E Lifecycle UI ${stamp}`;

  // Colaborador novo para o fluxo de UI
  await apiPost<any>(request, managerSession.accessToken, '/personnel/employees', {
    name: uiName,
    jobName: `Analista LC UI ${stamp}`,
  });

  await open(page, '/servico-pessoal/admissoes');
  await expect(page.getByRole('heading', { name: 'Admissão, Desligamento e ASO' })).toBeVisible({ timeout: 60_000 });

  // Inicia admissão pelo dialog
  await page.getByRole('button', { name: 'Iniciar admissão' }).click();
  const startDialog = page.getByRole('dialog').filter({ hasText: 'Iniciar admissão digital' });
  await startDialog.getByRole('combobox').selectOption({ label: uiName });
  await startDialog.getByRole('button', { name: 'Iniciar processo' }).click();

  // Detalhe abre com o checklist padrão
  const detailDialog = page.getByRole('dialog').filter({ hasText: `Admissão — ${uiName}` });
  await expect(detailDialog).toBeVisible({ timeout: 30_000 });
  await expect(detailDialog.getByText('Contrato de trabalho assinado')).toBeVisible();

  // Marca todos os checkboxes obrigatórios (um a um, aguardando o refetch)
  const checkboxes = detailDialog.locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) {
    const box = checkboxes.nth(i);
    if (!(await box.isChecked())) {
      await box.check();
      await page.waitForTimeout(400); // aguarda o toggle persistir e o dialog refazer o fetch
    }
  }
  await detailDialog.getByRole('button', { name: 'Concluir admissão' }).click();
  await expect(page.getByText('Processo concluído')).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press('Escape');

  // Registra um ASO pela aba Saúde Ocupacional
  await page.getByRole('tab', { name: 'Saúde Ocupacional' }).click();
  await page.getByRole('button', { name: 'Registrar exame' }).click();
  const examDialog = page.getByRole('dialog').filter({ hasText: 'Registrar exame ocupacional' });
  await examDialog.getByRole('combobox').first().selectOption({ label: uiName });
  await examDialog.locator('input[type="date"]').first().fill(new Date().toISOString().slice(0, 10));
  await examDialog.getByRole('button', { name: 'Registrar exame' }).click();
  await expect(page.getByText('Exame registrado')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('cell', { name: uiName }).first()).toBeVisible();

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
