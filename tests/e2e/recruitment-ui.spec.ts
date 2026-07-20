import { expect, test } from '@playwright/test';
import { adminCredentials, apiGet, apiPost, loginApi, setAppSession, type Session } from './helpers';

/**
 * Smoke da superfície nova do ATS (redesign UX 2026-07):
 * hub com funil + sheet da requisição (sem window.prompt, enums traduzidos),
 * fluxo requisição → aprovação → encaminhamento → vaga, e página da vaga
 * com pipeline/divulgação/triagem.
 *
 * Credenciais parametrizáveis p/ rodar contra o dev-DB local (padrão do
 * documents-ged.spec.ts): E2E_RECRUIT_ADMIN_EMAIL / E2E_RECRUIT_ADMIN_PASSWORD.
 * O usuário precisa de recruit:manage, recruit:requisition:approve,
 * recruit:admit e pessoal:view.
 */

const recruitAdminCredentials = {
  email: process.env.E2E_RECRUIT_ADMIN_EMAIL ?? adminCredentials.email,
  password: process.env.E2E_RECRUIT_ADMIN_PASSWORD ?? adminCredentials.password,
};

interface EmployeeOptions {
  jobs: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string }>;
}

let session: Session;

test.beforeEach(async ({ page, request }) => {
  session = await loginApi(request, recruitAdminCredentials);
  await setAppSession(page, session);
});

async function createRequisition(request: Parameters<typeof apiGet>[0], overrides: Record<string, unknown> = {}) {
  const options = await apiGet<EmployeeOptions>(request, session.accessToken, '/personnel/employees/options');
  expect(options.jobs.length, 'dev-DB precisa ter ao menos um cargo').toBeGreaterThan(0);
  return apiPost<{ id: string; code: string }>(request, session.accessToken, '/recruitment/requisitions', {
    orgJobId: options.jobs[0].id,
    vacancyType: 'AUMENTO',
    priority: 'NORMAL',
    openingsRequested: 1,
    reason: 'Smoke E2E da UI nova do recrutamento.',
    ...overrides,
  });
}

test('hub do recrutamento mostra funil e requisições com status traduzido', async ({ page, request }) => {
  await createRequisition(request);

  await page.goto('/recrutamento');
  await expect(page.getByRole('heading', { name: 'Recrutamento e Seleção' })).toBeVisible();
  // Funil didático com contagens
  await expect(page.getByText('1 · Rascunhos')).toBeVisible();
  await expect(page.getByText('6 · Preenchidas')).toBeVisible();
  // Tabela traduzida: nada de enum cru
  await expect(page.getByText('Requisições de vaga')).toBeVisible();
  await expect(page.locator('table').getByText('Rascunho').first()).toBeVisible();
  await expect(page.locator('table').getByText('DRAFT', { exact: true })).toHaveCount(0);
  await expect(page.locator('table').getByText('AUMENTO', { exact: true })).toHaveCount(0);
});

test('fluxo completo: requisição → aprovação → encaminhar → criar vaga', async ({ page, request }) => {
  // Primeira visita à rota dinâmica /vagas/[id] compila sob demanda no next dev
  // (lento nesta máquina) — triplica o timeout para não falhar por compilação.
  test.slow();
  // Segregação de funções: o solicitante não pode aprovar — cria a requisição
  // em nome de OUTRO usuário para que a sessão da UI possa decidir o workflow.
  const options = await apiGet<EmployeeOptions>(request, session.accessToken, '/personnel/employees/options');
  const otherUser = options.users.find((user) => user.id !== session.user.id);
  test.skip(!otherUser, 'dev-DB precisa de um segundo usuário para a segregação');
  const requisition = await createRequisition(request, {
    vacancyType: 'SUBSTITUICAO',
    priority: 'ALTA',
    requesterId: otherUser!.id,
    reason: 'Fluxo E2E ponta a ponta na UI nova.',
  });

  await page.goto('/recrutamento');
  await page.getByText(requisition.code).click();

  // Sheet com stepper e próximo passo
  await expect(page.getByText('Próximo passo:')).toBeVisible();
  await expect(page.getByText('Travas de quadro e orçamento')).toBeVisible();
  await expect(page.getByText('Fluxo de aprovação')).toBeVisible();

  await page.getByRole('button', { name: 'Enviar para aprovação' }).click();
  await expect(page.getByRole('button', { name: 'Aprovar este passo' })).toBeVisible();

  await page.getByRole('button', { name: 'Aprovar este passo' }).click();
  await expect(page.getByRole('button', { name: 'Encaminhar ao recrutamento' })).toBeVisible();

  // Travas flexíveis: sem posição vinculada, o encaminhamento exige aprovar a
  // exceção (auditada) — a UI orienta e abre o ReasonDialog.
  await page.getByRole('button', { name: 'Aprovar exceção' }).first().click();
  // O Sheet também é role=dialog; o ReasonDialog é o que tem o campo "Justificativa".
  const reasonDialog = page.getByRole('dialog').filter({ hasText: 'Justificativa' });
  await reasonDialog.getByRole('textbox').fill('Exceção aprovada no smoke E2E.');
  await reasonDialog.getByRole('button', { name: 'Aprovar exceção' }).click();
  await expect(reasonDialog).toHaveCount(0);
  // O refetch do gate remove a pendência da lista.
  await expect(page.getByRole('button', { name: 'Aprovar exceção' })).toHaveCount(0, { timeout: 15000 });

  await page.getByRole('button', { name: 'Encaminhar ao recrutamento' }).click();
  await expect(page.getByRole('button', { name: 'Criar vaga de divulgação' })).toBeVisible();

  await page.getByRole('button', { name: 'Criar vaga de divulgação' }).click();
  // Redireciona direto para a página da vaga
  await page.waitForURL(/\/recrutamento\/vagas\/[\w-]+$/);
  await expect(page.getByRole('tab', { name: /Pipeline de candidatos/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Divulgação' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Triagem e scorecard' })).toBeVisible();
  await expect(page.getByText('Próximo passo:')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publicar' })).toBeVisible();

  // Pipeline vazio com orientação
  await expect(page.getByText('Nenhuma candidatura ainda.')).toBeVisible();

  // Aba de divulgação editável
  await page.getByRole('tab', { name: 'Divulgação' }).click();
  await expect(page.getByText('Título público')).toBeVisible();

  // Aba de triagem/scorecard
  await page.getByRole('tab', { name: 'Triagem e scorecard' }).click();
  await expect(page.getByText('Perguntas de triagem')).toBeVisible();
  await expect(page.getByText('Scorecard de avaliação')).toBeVisible();
});

test('lista de vagas traduzida e navegável', async ({ page }) => {
  await page.goto('/recrutamento/vagas');
  await expect(page.getByRole('heading', { name: 'Vagas' })).toBeVisible();
  await expect(page.getByText('PUBLISHED', { exact: true })).toHaveCount(0);
});
