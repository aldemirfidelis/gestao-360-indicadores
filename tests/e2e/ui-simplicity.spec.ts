import { expect, test, type Page } from '@playwright/test';

// Revisão de apresentação isolada: todas as respostas vêm destas fixtures,
// inclusive autenticação. Nenhuma consulta ou gravação chega ao banco.
const user = { id: 'ui-user', name: 'Usuário de exemplo', email: 'ui@example.test', role: 'SUPER_ADMIN', companyId: 'ui-company', permissions: [] };
const process = {
  id: 'ui-process', number: 1, code: 'PROC-01', name: 'Atendimento ao cliente', type: 'CORE', status: 'ACTIVE', version: '1',
  objective: 'Atender com qualidade.', description: null, orgNode: null, indicator: null, owner: user,
  orgNodeId: null, indicatorId: null, ownerUserId: user.id, areaId: null,
  suppliers: 'Cliente', inputs: 'Solicitação', outputs: 'Atendimento concluído', customers: 'Solicitante',
  stepsCount: 1, steps: [{ id: 'ui-step', order: 1, name: 'Receber solicitação', responsible: user.name, description: null }],
};
const fixtures: Record<string, unknown> = {
  '/auth/me': user,
  '/portal/config': { modules: [], pages: [], navOverrides: [], maintenance: { global: { active: false, allowSuperAdmin: true } }, flags: {}, announcements: [] },
  '/companies/me/branding': {},
  '/notifications': [], '/notifications/unread-count': { count: 0 }, '/notifications/count': { count: 0 },
  '/processes': [process], '/processes/options': { orgNodes: [], users: [user], indicators: [] },
  '/processes/summary': { total: 1, active: 1, underReview: 0, withoutSteps: 0, mappedSteps: 1 },
  '/processes/governance/dashboard': {
    total: 1, documented: 1, pendingReview: 4, overdueReview: 0, withoutOwner: 0, activitiesWithoutOwner: 0,
    outsideTarget: 0, openDeviations: 0, improvementProjects: 1,
    attention: [{ id: process.id, name: process.name, reasons: ['Em revisão', 'Projeto de melhoria'] }],
  },
  '/processes/governance/pmo': { available: false, canCreate: false },
  '/projects': [], '/projects/options': { people: [user], indicators: [], categories: [] },
  '/projects/portfolio': { totalProjects: 0, activeProjects: 0, avgProgress: 0, tasksOverdue: 0, milestonesOverdue: 0, openRisks: 0, openIssues: 0, activeBudget: 0, actualCost: 0, criticalProjects: [] },
  '/projects/portfolio/execution': { curve: { hasSchedule: false, progress: null, points: [] }, tasks: [], milestones: [], totals: {} },
};

async function prepare(page: Page, demo = false) {
  await page.addInitScript(() => localStorage.setItem('g360.accessToken', 'synthetic-ui-review'));
  await page.route('**/api/**', async (route) => {
    const key = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    const body = key === '/auth/me' ? { ...user, isDemo: demo } : fixtures[key] ?? [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

for (const width of [1440, 390]) {
  test.describe(`Interface sem repetição em ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('Processos prioriza a lista e mantém os detalhes acessíveis pelo teclado', async ({ page }) => {
      await prepare(page);
      await page.goto('/processes');
      await expect(page.getByRole('tab', { name: 'Processos', exact: true })).toHaveAttribute('data-state', 'active');
      await expect(page.getByRole('heading', { name: 'Governança de processos', exact: true })).toHaveCount(0);
      await expect(page.getByText('Fornecedores', { exact: true })).toBeHidden();
      const expand = page.getByRole('button', { name: /PROC-01/ });
      await expand.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByText('Fornecedores', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
      const size = await page.locator('main').evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth }));
      expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
      await page.getByRole('button', { name: 'Filtros', exact: true }).click();
      await page.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
      await page.getByRole('button', { name: 'Filtros (1)', exact: true }).click();
      await expect(page.getByLabel('Status', { exact: true })).toBeHidden();
      await page.getByRole('button', { name: 'Filtros (1)', exact: true }).click();
      await expect(page.getByLabel('Status', { exact: true })).toHaveValue('ACTIVE');
      await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
      await expect(page.getByLabel('Status', { exact: true })).toHaveValue('');
    });

    test('Governança diferencia revisão cadastral de artefatos e omite atalhos para a própria página', async ({ page }) => {
      await prepare(page);
      await page.goto('/processes');
      await page.getByRole('tab', { name: 'Governança', exact: true }).click();
      await expect(page.getByText('Artefatos em revisão', { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Abrir processos', exact: true })).toHaveCount(0);
      await expect(page.getByText('Atividades sem responsável', { exact: true })).toHaveCount(0);
      await page.getByText('Outros dados de governança', { exact: true }).click();
      await expect(page.getByText('Atividades sem responsável', { exact: true })).toBeVisible();
    });

    test('Portfólio abre nos projetos com uma única ação de criação', async ({ page }) => {
      await prepare(page);
      await page.goto('/projects/cronograma');
      await expect(page.getByRole('tab', { name: 'Projetos', exact: true })).toHaveAttribute('data-state', 'active');
      await expect(page.getByRole('heading', { name: 'Curva S do portfólio', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Novo projeto', exact: true })).toHaveCount(1);
      await page.getByRole('tab', { name: 'Cronograma', exact: true }).click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
    });

    test('Demonstração mantém consulta e expansão sem ações de edição', async ({ page }) => {
      await prepare(page, true);
      await page.goto('/processes?focus=ui-process');
      await expect(page.getByText('Fornecedores', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Novo processo', exact: true })).toHaveCount(0);
    });
  });
}
