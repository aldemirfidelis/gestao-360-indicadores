import { expect, test, type Page } from '@playwright/test';
import { adminCredentials, apiGet, apiPost, demoCredentials, loginApi, type Session } from './helpers';

// Mesmo padrão de credenciais das suites documents-ged/time-clock.
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
/** CPF válido e único por execução (dígitos verificadores calculados). */
const testCpf = makeCpf(String(stamp).slice(-9));
let managerSession: Session;
let workerSession: Session;
let employeeId: string;

function makeCpf(base9: string): string {
  const digits = base9.padStart(9, '1').split('').map(Number);
  for (const factor of [10, 11]) {
    let sum = 0;
    for (let i = 0; i < factor - 1; i++) sum += digits[i] * (factor - i);
    digits.push(((sum * 10) % 11) % 10);
  }
  return digits.join('');
}

test.beforeAll(async ({ request }) => {
  managerSession = await loginApi(request, managerCredentials);
  workerSession = await loginApi(request, workerCredentials);
});

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

test('API: cria colaborador com perfil, cargo novo e evento de admissão', async ({ request }) => {
  const token = managerSession.accessToken;
  const created = await apiPost<any>(request, token, '/personnel/employees', {
    name: `E2E Colaborador ${stamp}`,
    registrationId: `E2E-${stamp}`,
    jobName: `Analista E2E ${stamp}`,
    profile: {
      cpf: testCpf,
      admissionDate: '2026-01-15',
      contractType: 'CLT',
      phone: '(64) 99999-0000',
    },
  });
  employeeId = created.id;
  expect(created.personnelProfile.cpf).toBe(testCpf);
  expect(created.job.name).toBe(`Analista E2E ${stamp}`);
  expect(created.employmentEvents.some((e: any) => e.type === 'ADMISSAO')).toBe(true);

  // CPF inválido é recusado
  const bad = await request.post(`${apiBase}/personnel/employees`, {
    headers: { authorization: `Bearer ${managerSession.accessToken}` },
    data: { name: 'CPF inválido', profile: { cpf: '111.111.111-11' } },
  });
  expect(bad.status()).toBe(400);

  // CPF duplicado é recusado
  const dup = await request.post(`${apiBase}/personnel/employees`, {
    headers: { authorization: `Bearer ${managerSession.accessToken}` },
    data: { name: 'Duplicado', profile: { cpf: testCpf } },
  });
  expect(dup.status()).toBe(409);
});

test('API: lista mascara o CPF (LGPD) e traz KPIs', async ({ request }) => {
  const result = await apiGet<any>(request, managerSession.accessToken, `/personnel/employees?search=E2E-${stamp}`);
  expect(result.items).toHaveLength(1);
  expect(result.items[0].cpfMasked).toBe(`${testCpf.slice(0, 3)}.•••.•••-${testCpf.slice(9)}`);
  expect(result.items[0].cpfMasked).not.toContain(testCpf.slice(3, 9)); // dígitos do meio ocultos
  expect(result.kpis).toHaveProperty('active');
});

test('API: mudança de área e cargo gera eventos automáticos na linha do tempo', async ({ request }) => {
  const token = managerSession.accessToken;
  const options = await apiGet<any>(request, token, '/personnel/employees/options');
  const node = options.orgNodes[0];
  const patch = await request.patch(`${apiBase}/personnel/employees/${employeeId}`, {
    headers: { authorization: `Bearer ${token}` },
    data: { orgNodeId: node.id, jobName: `Coordenador E2E ${stamp}` },
  });
  expect(patch.ok()).toBe(true);
  const detail = await apiGet<any>(request, token, `/personnel/employees/${employeeId}`);
  expect(detail.employmentEvents.some((e: any) => e.type === 'TRANSFERENCIA')).toBe(true);
  expect(detail.employmentEvents.some((e: any) => e.type === 'MUDANCA_CARGO')).toBe(true);
});

test('API: dependentes e dossiê (upload, download auditado, remoção)', async ({ request }) => {
  const token = managerSession.accessToken;
  const dependent = await apiPost<any>(request, token, `/personnel/employees/${employeeId}/dependents`, {
    name: 'Dependente E2E',
    relationship: 'FILHO',
    birthDate: '15/03/2020',
    isIrDependent: true,
  });
  expect(dependent.relationship).toBe('FILHO');

  const file = await apiPost<any>(request, token, `/personnel/employees/${employeeId}/files`, {
    kind: 'CONTRATO',
    name: 'Contrato de trabalho E2E',
    fileName: 'contrato-e2e.txt',
    mimeType: 'text/plain',
    contentBase64: Buffer.from('Contrato de experiência — teste E2E').toString('base64'),
    validUntil: '2026-12-31',
  });
  expect(file.kind).toBe('CONTRATO');

  const download = await request.get(`${apiBase}/personnel/employees/${employeeId}/files/${file.id}/download`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(download.ok()).toBe(true);
  expect(await download.text()).toContain('Contrato de experiência');

  const detail = await apiGet<any>(request, token, `/personnel/employees/${employeeId}`);
  expect(detail.dependents).toHaveLength(1);
  expect(detail.dossierFiles).toHaveLength(1);
});

test('API: importação cria e atualiza colaboradores', async ({ request }) => {
  const token = managerSession.accessToken;
  const result = await apiPost<any>(request, token, '/personnel/employees/import', {
    rows: [
      // atualiza o já existente (mesmo CPF), trocando o telefone
      { name: `E2E Colaborador ${stamp}`, cpf: testCpf, phone: '(64) 98888-7777' },
      // cria um novo com cargo/área
      { name: `E2E Importado ${stamp}`, registrationId: `E2E-IMP-${stamp}`, jobName: `Auxiliar E2E ${stamp}`, admissionDate: '01/07/2026' },
      // erro: sem nome
      { cpf: '39053344705' },
    ],
  });
  expect(result.updated).toBe(1);
  expect(result.created).toBe(1);
  expect(result.errors).toHaveLength(1);

  const detail = await apiGet<any>(request, token, `/personnel/employees/${employeeId}`);
  expect(detail.personnelProfile.phone).toBe('(64) 98888-7777');
});

test('API: desligamento gera evento e reativação também', async ({ request }) => {
  const token = managerSession.accessToken;
  const off = await request.patch(`${apiBase}/personnel/employees/${employeeId}`, {
    headers: { authorization: `Bearer ${token}` },
    data: { status: 'INACTIVE', reason: 'Desligamento E2E' },
  });
  expect(off.ok()).toBe(true);
  let detail = await apiGet<any>(request, token, `/personnel/employees/${employeeId}`);
  expect(detail.status).toBe('INACTIVE');
  expect(detail.personnelProfile.terminationDate).toBeTruthy();
  expect(detail.employmentEvents.some((e: any) => e.type === 'DESLIGAMENTO')).toBe(true);

  const on = await request.patch(`${apiBase}/personnel/employees/${employeeId}`, {
    headers: { authorization: `Bearer ${token}` },
    data: { status: 'ACTIVE' },
  });
  expect(on.ok()).toBe(true);
  detail = await apiGet<any>(request, token, `/personnel/employees/${employeeId}`);
  expect(detail.status).toBe('ACTIVE');
});

test('API: usuário sem pessoal:* não acessa o prontuário', async ({ request }) => {
  const headers = { authorization: `Bearer ${workerSession.accessToken}` };
  const list = await request.get(`${apiBase}/personnel/employees`, { headers });
  expect(list.status()).toBe(403);
  const create = await request.post(`${apiBase}/personnel/employees`, { headers, data: { name: 'X' } });
  expect(create.status()).toBe(403);
});

// ---------------------------------------------------------------------------
// UI (Chromium)
// ---------------------------------------------------------------------------

test('UI: cadastra colaborador, abre prontuário, adiciona dependente e observação', async ({ page }) => {
  const errors = monitorClientErrors(page);
  const uiName = `E2E UI Colab ${stamp}`;

  await open(page, '/servico-pessoal/colaboradores');
  await expect(page.getByRole('heading', { name: 'Colaboradores' })).toBeVisible({ timeout: 60_000 });

  // Cadastro
  await page.getByRole('button', { name: 'Novo colaborador' }).click();
  const formDialog = page.getByRole('dialog').filter({ hasText: 'Novo colaborador' });
  await formDialog.locator('input').first().fill(uiName);
  await formDialog.getByRole('button', { name: 'Salvar colaborador' }).click();

  // Prontuário abre automaticamente
  const detailDialog = page.getByRole('dialog').filter({ hasText: uiName });
  await expect(detailDialog).toBeVisible({ timeout: 30_000 });
  await expect(detailDialog.getByRole('tab', { name: /Dossiê/ })).toBeVisible();

  // Dependente
  await detailDialog.getByRole('tab', { name: /Dependentes/ }).click();
  await detailDialog.getByPlaceholder('Nome').fill('Filho UI E2E');
  await detailDialog.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByText('Dependente adicionado')).toBeVisible({ timeout: 30_000 });
  await expect(detailDialog.getByText('Filho UI E2E')).toBeVisible();

  // Observação na linha do tempo
  await detailDialog.getByRole('tab', { name: 'Histórico' }).click();
  await expect(detailDialog.getByText('Admissão', { exact: true }).first()).toBeVisible();
  await detailDialog.getByPlaceholder(/Registrar observação/).fill('Observação registrada pelo E2E');
  await detailDialog.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.getByText('Registro adicionado à linha do tempo')).toBeVisible({ timeout: 30_000 });
  await expect(detailDialog.getByText('Observação registrada pelo E2E')).toBeVisible();

  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('UI: lista filtra por busca e mostra KPIs', async ({ page }) => {
  const errors = monitorClientErrors(page);
  await open(page, '/servico-pessoal/colaboradores');
  await expect(page.getByRole('heading', { name: 'Colaboradores' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Cadastro incompleto', { exact: true })).toBeVisible(); // KPI único da página

  await page.getByPlaceholder(/Buscar por nome/).fill(`E2E Colaborador ${stamp}`);
  await expect(page.getByRole('cell', { name: `E2E Colaborador ${stamp}` })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('1 colaborador(es)')).toBeVisible();
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
