import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
  adminCredentials,
  apiBaseURL,
  apiGet,
  apiPost,
  createIndicator,
  loginApi,
  nextPeriodRef,
  rhManagerCredentials,
  setAppSession,
  type Session,
  uniqueCode,
} from './helpers';

test.describe.configure({ mode: 'serial' });

let adminSession: Session;
let rhManagerSession: Session;
let redIndicator: any;
let currentTreatment: any;
let deviationIndicator: any;
let explicitDeviation: any;
let analysis: any;
let deviationAction: any;
let restrictedIndicator: any;

test.beforeAll(async ({ request }) => {
  adminSession = await loginApi(request, adminCredentials);
  rhManagerSession = await loginApi(request, rhManagerCredentials);

  redIndicator = await createIndicator(request, adminSession.accessToken, {
    code: uniqueCode('E2E-RED'),
    name: 'E2E Resultado vermelho',
    ownerCode: 'RH',
    direction: 'HIGHER_BETTER',
    initialTarget: 100,
    initialResult: 45,
    periodRef: nextPeriodRef(1),
  });

  currentTreatment = await apiGet<any>(
    request,
    adminSession.accessToken,
    `/treatments/indicators/${redIndicator.id}/current?periodRef=${redIndicator.results.at(-1).periodRef}`,
  );

  deviationIndicator = await createIndicator(request, adminSession.accessToken, {
    code: uniqueCode('E2E-DEV'),
    name: 'E2E Desvio completo',
    ownerCode: 'RH',
    direction: 'HIGHER_BETTER',
    initialTarget: 100,
    initialResult: 80,
    periodRef: nextPeriodRef(2),
  });

  restrictedIndicator = await createIndicator(request, adminSession.accessToken, {
    code: uniqueCode('E2E-PROD'),
    name: 'E2E Indicador Producao restrito',
    ownerCode: 'PROD',
    direction: 'HIGHER_BETTER',
    initialTarget: 100,
    initialResult: 100,
    periodRef: nextPeriodRef(3),
  });
});

test('resultado vermelho gera alerta e tratativa automatica na API', async () => {
  const last = redIndicator.results.at(-1);

  expect(last.light).toBe('RED');
  expect(currentTreatment).toEqual(
    expect.objectContaining({
      periodRef: last.periodRef,
      status: 'AWAITING_CAUSE_ANALYSIS',
    }),
  );
});

test('resultado vermelho aparece na tela do indicador com tratativa', async ({ page }) => {
  await openAsAdmin(page, `/indicators/${redIndicator.id}`);

  await expect(page.getByText('E2E Resultado vermelho')).toBeVisible();
  await expect(page.getByText('Desvio principal')).toBeVisible();
  await expect(page.getByText(/Abrir tratativa em andamento|Ver fila de tratativas/)).toBeVisible();
});

test('cria desvio a partir de indicador fora do alvo', async ({ request }) => {
  explicitDeviation = await apiPost<any>(request, adminSession.accessToken, '/deviations', {
    indicatorId: deviationIndicator.id,
    periodRef: deviationIndicator.results.at(-1).periodRef,
    title: 'E2E Desvio com analise e acao',
    severity: 'CRITICAL',
    method: 'FIVE_WHYS',
    fact: 'Resultado abaixo da meta no fluxo E2E.',
  });

  expect(explicitDeviation.number).toBeGreaterThan(0);
});

test('abre analise de causa do desvio', async ({ request }) => {
  analysis = await apiPost<any>(request, adminSession.accessToken, `/deviations/${explicitDeviation.id}/analyses`, {
    method: 'FIVE_WHYS',
    content: '1. Falha operacional; 2. Sem padrao; 3. Plano de resposta criado.',
  });

  expect(analysis).toEqual(expect.objectContaining({ method: 'FIVE_WHYS' }));
});

test('cria acao vinculada ao desvio', async ({ request }) => {
  deviationAction = await apiPost<any>(request, adminSession.accessToken, `/deviations/${explicitDeviation.id}/actions`, {
    title: 'E2E Acao corretiva do desvio',
    description: 'Acao criada pelo Playwright para validar fluxo critico.',
    priority: 'HIGH',
    dueDate: '2026-12-20',
  });

  expect(deviationAction).toEqual(
    expect.objectContaining({
      title: 'E2E Acao corretiva do desvio',
      deviationId: explicitDeviation.id,
      origin: 'DEVIATION',
    }),
  );
});

test('desvio detalhado lista analise e acao criadas', async ({ request }) => {
  const detail = await apiGet<any>(request, adminSession.accessToken, `/deviations/${explicitDeviation.id}`);

  expect(detail.analyses.map((item: any) => item.id)).toContain(analysis.id);
  expect(detail.actions.map((item: any) => item.id)).toContain(deviationAction.id);
});

test('acao criada pelo desvio aparece na listagem de planos', async ({ request }) => {
  const actions = await apiGet<any[]>(request, adminSession.accessToken, '/actions?search=E2E%20Acao%20corretiva');

  expect(actions.some((item) => item.id === deviationAction.id)).toBe(true);
});

test('usuario restrito nao acessa indicador de outra area pela API direta', async ({ request }) => {
  const response = await request.get(`${apiBaseURL}/indicators/${restrictedIndicator.id}`, {
    headers: { authorization: `Bearer ${rhManagerSession.accessToken}` },
  });

  expect(response.status()).toBe(403);
});

test('usuario restrito nao visualiza indicador de outra area por URL direta', async ({ page }) => {
  await setAppSession(page, rhManagerSession);
  const denied = page.waitForResponse(
    (response) => response.url().includes(`/indicators/${restrictedIndicator.id}`) && response.status() === 403,
  );
  await page.goto(`/indicators/${restrictedIndicator.id}`);
  await denied;

  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
  await expect(page.getByText(restrictedIndicator.name)).not.toBeVisible();
});

test('settings/database exige SUPER_ADMIN no gate do frontend', async ({ page }) => {
  await setAppSession(page, rhManagerSession);
  await page.goto('/settings/database');

  await expect(page.getByText('Acesso restrito')).toBeVisible();
  await expect(page.getByText('SUPER_ADMIN')).toBeVisible();
});

test('settings/portal exige SUPER_ADMIN no gate do frontend', async ({ page }) => {
  await setAppSession(page, rhManagerSession);
  await page.goto('/settings/portal');

  await expect(page.getByText('Acesso restrito')).toBeVisible();
  await expect(page.getByText('SUPER_ADMIN')).toBeVisible();
});

test('preview de importacao acusa erro de validacao na API', async ({ request }) => {
  const preview = await apiPost<any>(request, adminSession.accessToken, '/imports/preview', {
    target: 'RESULTS',
    rows: [{ rowIndex: 2, data: { code: 'E2E-INEXISTENTE', periodRef: '2026-06', value: 50 } }],
  });

  expect(preview.errorRows).toBe(1);
  expect(preview.rows[0].message).toContain('Indicador "E2E-INEXISTENTE" nao encontrado');
});

test('importacao CSV mostra erro de validacao na interface', async ({ page }) => {
  await openAsAdmin(page, '/imports');

  await page.locator('input[type="file"]').setInputFiles({
    name: 'e2e-resultados-invalidos.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('code,periodRef,value,note\nE2E-INEXISTENTE,2026-06,50,linha invalida\n'),
  });
  await page.getByRole('button', { name: /Preview/ }).click();

  await expect(page.getByText('1 com erro')).toBeVisible();
  await expect(page.getByText(/Indicador "E2E-INEXISTENTE" nao encontrado/)).toBeVisible();
});

test('modulo FASE 6 Auditorias carrega autenticado', async ({ page }) => {
  await openAsAdmin(page, '/audits');

  await expect(page.getByText('Auditorias e Compliance')).toBeVisible();
});

test('modulo FASE 6 Processos carrega autenticado', async ({ page }) => {
  await openAsAdmin(page, '/processes');

  await expect(page.getByText('Processos e SIPOC')).toBeVisible();
});

test('modulo FASE 6 Formularios carrega autenticado', async ({ page }) => {
  await openAsAdmin(page, '/forms');

  await expect(page.getByText(/Formul.rios e Listas de verifica..o/)).toBeVisible();
});

async function openAsAdmin(page: Page, path: string) {
  await setAppSession(page, adminSession);
  await page.goto(path);
}
