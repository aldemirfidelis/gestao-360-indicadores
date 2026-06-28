import { expect, test, type Page } from '@playwright/test';
import { demoCredentials, loginApi, type Session } from './helpers';

test.describe.configure({ mode: 'serial' });
test.setTimeout(90_000);

let session: Session;

test.beforeAll(async ({ request }) => {
  session = await loginApi(request, demoCredentials);
});

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('painel de cargos usa atalhos navegáveis', async ({ page }) => {
  const errors = monitorClientErrors(page);
  await open(page, '/cargos-salarios');
  await expect(page.getByRole('heading', { name: 'Cargos e Salários' })).toBeVisible();
  await page.getByRole('button', { name: 'Tabelas salariais' }).click();
  await expect(page).toHaveURL(/\/cargos-salarios\/tabelas-salariais/, { timeout: 60_000 });
  expect(errors).toEqual([]);
});

test('painel de comunicação filtra e abre métricas', async ({ page }) => {
  const errors = monitorClientErrors(page);
  await open(page, '/comunicacao');
  await expect(page.getByRole('heading', { name: 'Comunicação Organizacional' })).toBeVisible();
  await page.getByRole('button', { name: 'Métricas e relatórios' }).click();
  await expect(page).toHaveURL(/\/comunicacao/);
  await expect(page.getByRole('heading', { name: 'Engajamento' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('documentos abre o histórico real de revisões', async ({ page }) => {
  const errors = monitorClientErrors(page);
  await open(page, '/documents');
  await page.getByRole('button', { name: 'Histórico de revisões' }).click();
  await expect(page.getByRole('heading', { name: 'Histórico de revisões do acervo' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('projetos abre a previsão financeira calculada', async ({ page }) => {
  const errors = monitorClientErrors(page);
  await open(page, '/projects');
  await page.getByRole('button', { name: 'Previsão financeira' }).click();
  await expect(page.getByRole('heading', { name: 'Previsão financeira do portfólio' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('não conformidades abre o cronograma de auditorias', async ({ page }) => {
  const errors = monitorClientErrors(page);
  await open(page, '/nonconformities');
  await page.getByRole('button', { name: 'Cronograma de Auditorias' }).click();
  await expect(page).toHaveURL(/\/audits/, { timeout: 60_000 });
  expect(errors).toEqual([]);
});

test('segurança patrimonial navega da operação para materiais', async ({ page }) => {
  const errors = monitorClientErrors(page);
  await open(page, '/seguranca-patrimonial?tab=operation');
  await page.getByText('Material / Chave', { exact: true }).click();
  await expect(page).toHaveURL(/tab=assets/, { timeout: 60_000 });
  expect(errors).toEqual([]);
});

test('fluxograma de alimentos carrega sem exceção no cliente', async ({ page }) => {
  const errors = monitorClientErrors(page);
  await open(page, '/seguranca-alimentos?tab=flow');
  await expect(page.getByText('3D ISOMÉTRICO')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

async function open(page: Page, path: string) {
  await page.addInitScript(
    ({ accessToken, refreshToken }) => {
      window.localStorage.setItem('g360.accessToken', accessToken);
      window.localStorage.setItem('g360.refreshToken', refreshToken);
    },
    session,
  );
  await page.route('**/api/auth/me', async (route) => {
    const response = await route.fetch();
    const profile = await response.json();
    await route.fulfill({ response, json: { ...profile, role: 'SUPER_ADMIN' } });
  });
  await page.route('**/api/portal/config', async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    await route.fulfill({
      response,
      json: {
        ...config,
        modules: (config.modules ?? []).map((item: any) => ({
          ...item,
          status: 'ACTIVE',
          hidden: false,
          maintenance: false,
          unavailable: false,
          companyModuleStatus: 'ACTIVE',
        })),
        pages: (config.pages ?? []).map((item: any) => ({
          ...item,
          status: 'ACTIVE',
          hidden: false,
          maintenance: false,
          unavailable: false,
        })),
      },
    });
  });
  if (path.startsWith('/cargos-salarios')) {
    await page.route('**/api/cargos-salarios/overview*', (route) =>
      route.fulfill({
        json: {
          periodRef: '2026-06',
          salaryMasked: false,
          cards: {
            allocatedEmployees: 10,
            plannedPositions: 12,
            openPositions: 2,
            pendingApprovals: 0,
            employeesBelowRange: 1,
            employeesWithinRange: 8,
            employeesAboveRange: 1,
            realizedCost: 50_000,
            plannedBudget: 55_000,
            budgetVariation: 5_000,
          },
          charts: {
            plannedVsRealizedByArea: [],
            employeesByBand: [],
            salaryFit: [],
            budgetPlannedVsRealized: [],
            movementsByType: [],
            correctionPriorities: [],
            compaRatioAverage: 95,
          },
        },
      }),
    );
    await page.route('**/api/cargos-salarios/options*', (route) => route.fulfill({ json: { orgNodes: [], jobs: [] } }));
    await page.route('**/api/cargos-salarios/approvals*', (route) =>
      route.fulfill({ json: { movements: [], descriptions: [], salaryTables: [], simulations: [] } }),
    );
  }
  if (path.startsWith('/seguranca-alimentos')) {
    await page.route('**/api/food-safety/programs', (route) =>
      route.fulfill({
        json: [{
          id: 'program-e2e',
          code: 'FSMS-E2E',
          name: 'Programa E2E',
          description: null,
          scope: null,
          visibility: 'COMPANY',
          status: 'ACTIVE',
          orgNodeId: null,
          ownerUserId: null,
          orgNode: null,
          owner: null,
          _count: { processes: 1 },
        }],
      }),
    );
    await page.route('**/api/food-safety/processes*', (route) =>
      route.fulfill({
        json: [{
          id: 'process-e2e',
          number: 1,
          code: 'PROC-E2E',
          name: 'Processo E2E',
          description: null,
          objective: null,
          productName: null,
          productionLine: null,
          version: '1',
          status: 'PUBLISHED',
          positionX: 0,
          positionY: 0,
          programId: 'program-e2e',
          orgNodeId: null,
          ownerUserId: null,
          orgNode: null,
          owner: null,
          steps: [{
            id: 'step-e2e',
            number: 1,
            code: 'STEP-E2E',
            name: 'Recepção',
            description: null,
            type: 'RECEIVING',
            inputs: null,
            outputs: null,
            positionX: 0,
            positionY: 0,
            isControlPoint: false,
          }],
        }],
      }),
    );
    await page.route('**/api/food-safety/options*', (route) =>
      route.fulfill({
        json: {
          orgNodes: [],
          users: [],
          programStatuses: ['ACTIVE'],
          processStatuses: ['PUBLISHED'],
          stepTypes: ['RECEIVING'],
          hazardCategories: [],
          riskLevels: [],
          controlTypes: [],
          hazardStatuses: [],
          visibilities: ['COMPANY'],
        },
      }),
    );
    await page.route('**/api/food-safety/summary*', (route) =>
      route.fulfill({ json: { processes: 1, published: 1, draft: 0, inReview: 0, pendingApproval: 0, obsolete: 0, steps: 1, controlPoints: 0 } }),
    );
    await page.route('**/api/food-safety/hazards*', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/food-safety/control-plans*', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/food-safety/risk-matrix*', (route) =>
      route.fulfill({ json: { id: 'matrix-e2e', name: 'Matriz', severityScale: 5, probabilityScale: 5, useDetection: false, detectionScale: 1, thresholdLow: 4, thresholdModerate: 9, thresholdHigh: 15 } }),
    );
  }
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 90_000 });
}

function monitorClientErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}
