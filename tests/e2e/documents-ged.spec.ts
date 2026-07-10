import { expect, test, type Page } from '@playwright/test';
import {
  adminCredentials,
  apiGet,
  apiPost,
  demoCredentials,
  loginApi,
  type Session,
  uniqueCode,
} from './helpers';

// Credenciais parametrizáveis: no CI valem as do seed padrão (helpers);
// localmente é possível apontar para a Empresa Demonstração via env.
const docAdminCredentials = {
  email: process.env.E2E_DOC_ADMIN_EMAIL ?? adminCredentials.email,
  password: process.env.E2E_DOC_ADMIN_PASSWORD ?? adminCredentials.password,
};
const docUserCredentials = {
  email: process.env.E2E_DOC_USER_EMAIL ?? demoCredentials.email,
  password: process.env.E2E_DOC_USER_PASSWORD ?? demoCredentials.password,
};

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

let adminSession: Session;
let demoSession: Session;

test.beforeAll(async ({ request }) => {
  adminSession = await loginApi(request, docAdminCredentials);
  demoSession = await loginApi(request, docUserCredentials);
});

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

// ---------------------------------------------------------------------------
// API: ciclo de vida completo do documento
// ---------------------------------------------------------------------------

test('API: documento percorre o ciclo elaboração -> revisão -> aprovação -> publicação', async ({ request }) => {
  const token = adminSession.accessToken;
  const doc = await apiPost<any>(request, token, '/documents', {
    title: `E2E Ciclo completo ${uniqueCode('DOC')}`,
    description: 'Documento criado pelo teste E2E do módulo GED.',
    type: 'PROCEDURE',
  });
  expect(doc.status).toBe('DRAFT');
  expect(doc.code).toBeTruthy();
  expect(doc.versions).toHaveLength(1);
  expect(doc.files.some((file: any) => file.kind === 'DOCX')).toBe(true);

  const afterSubmit = await apiPost<any>(request, token, `/documents/${doc.id}/submit-review`, {});
  expect(afterSubmit.status).toBe('WAITING_REVIEW');
  const afterStart = await apiPost<any>(request, token, `/documents/${doc.id}/start-review`, {});
  expect(afterStart.status).toBe('IN_REVIEW');
  const afterReview = await apiPost<any>(request, token, `/documents/${doc.id}/complete-review`, {});
  expect(afterReview.status).toBe('REVIEWED');
  const afterSend = await apiPost<any>(request, token, `/documents/${doc.id}/send-approval`, {});
  expect(afterSend.status).toBe('WAITING_APPROVAL');
  const afterStartApproval = await apiPost<any>(request, token, `/documents/${doc.id}/start-approval`, {});
  expect(afterStartApproval.status).toBe('IN_APPROVAL');
  const afterApprove = await apiPost<any>(request, token, `/documents/${doc.id}/approve`, {});
  expect(afterApprove.status).toBe('APPROVED');
  const published = await apiPost<any>(request, token, `/documents/${doc.id}/publish`, {});
  expect(published.status).toBe('PUBLISHED');
  expect(published.publishedAt).toBeTruthy();
  expect(published.files.some((file: any) => file.kind === 'PDF')).toBe(true);
  expect(published.versions[0].status).toBe('PUBLISHED');

  // Nova revisão a partir do publicado
  const revised = await apiPost<any>(request, token, `/documents/${doc.id}/new-revision`, { reason: 'Atualização E2E' });
  expect(revised.status).toBe('IN_DEVELOPMENT');
  expect(revised.version).toBe(doc.version + 1);
  expect(revised.versions[0].versionLabel).toContain('01');
});

test('API: documento reprovado pode ser reenviado para revisão', async ({ request }) => {
  const token = adminSession.accessToken;
  const doc = await apiPost<any>(request, token, '/documents', {
    title: `E2E Reprovação ${uniqueCode('DOC')}`,
    type: 'PROCEDURE',
  });
  await apiPost<any>(request, token, `/documents/${doc.id}/submit-review`, {});
  await apiPost<any>(request, token, `/documents/${doc.id}/start-review`, {});
  await apiPost<any>(request, token, `/documents/${doc.id}/complete-review`, {});
  await apiPost<any>(request, token, `/documents/${doc.id}/send-approval`, {});
  await apiPost<any>(request, token, `/documents/${doc.id}/start-approval`, {});
  const rejected = await apiPost<any>(request, token, `/documents/${doc.id}/reject`, { comment: 'Reprovado pelo E2E' });
  expect(rejected.status).toBe('REJECTED');

  // Regressão: REJECTED -> WAITING_REVIEW precisa ser aceito (o botão existe na UI)
  const resubmitted = await apiPost<any>(request, token, `/documents/${doc.id}/submit-review`, {});
  expect(resubmitted.status).toBe('WAITING_REVIEW');
});

test('API: confirmação de leitura é idempotente e expõe quem leu', async ({ request }) => {
  const token = adminSession.accessToken;
  const doc = await apiPost<any>(request, token, '/documents', {
    title: `E2E Leitura ${uniqueCode('DOC')}`,
    type: 'INSTRUCTION',
  });
  await apiPost<any>(request, token, `/documents/${doc.id}/read-confirmations`, {});
  await apiPost<any>(request, token, `/documents/${doc.id}/read-confirmations`, {});
  const detail = await apiGet<any>(request, token, `/documents/${doc.id}`);
  const mine = detail.readConfirmations.filter((item: any) => item.userId === adminSession.user.id);
  expect(mine).toHaveLength(1);
  expect(mine[0].user?.name).toBeTruthy();
});

test('API: solicitação de edição vai ao operador e liberação habilita o solicitante', async ({ request }) => {
  const adminToken = adminSession.accessToken;
  const demoToken = demoSession.accessToken;
  const doc = await apiPost<any>(request, adminToken, '/documents', {
    title: `E2E Liberação ${uniqueCode('DOC')}`,
    type: 'PROCEDURE',
    ownerUserId: adminSession.user.id,
  });

  // Usuário comum solicita edição; operador resolvido = responsável (admin)
  const requestEdit = await apiPost<any>(request, demoToken, `/documents/${doc.id}/edit-requests`, {
    reason: 'Preciso ajustar o procedimento (E2E)',
  });
  expect(requestEdit.status).toBe('REQUESTED');
  expect(requestEdit.operatorUserId).toBe(adminSession.user.id);

  // Repetir a solicitação não duplica
  const repeated = await apiPost<any>(request, demoToken, `/documents/${doc.id}/edit-requests`, {});
  expect(repeated.id).toBe(requestEdit.id);

  // Operador aprova; solicitante passa a conseguir abrir o editor
  const approved = await apiPost<any>(request, adminToken, `/documents/edit-requests/${requestEdit.id}/approve`, {});
  expect(approved.status).toBe('APPROVED');
  const session = await apiPost<any>(request, demoToken, `/documents/${doc.id}/editor/open`, {});
  expect(session.documentId).toBe(doc.id);

  const completed = await apiPost<any>(request, demoToken, `/documents/edit-requests/${requestEdit.id}/complete`, {});
  expect(completed.status).toBe('COMPLETED');
});

test('API: liberar edição de documento publicado cria nova revisão automaticamente', async ({ request }) => {
  const token = adminSession.accessToken;
  const doc = await apiPost<any>(request, token, '/documents', {
    title: `E2E Auto-revisão ${uniqueCode('DOC')}`,
    type: 'PROCEDURE',
  });
  await apiPost<any>(request, token, `/documents/${doc.id}/submit-review`, {});
  await apiPost<any>(request, token, `/documents/${doc.id}/start-review`, {});
  await apiPost<any>(request, token, `/documents/${doc.id}/complete-review`, {});
  await apiPost<any>(request, token, `/documents/${doc.id}/send-approval`, {});
  await apiPost<any>(request, token, `/documents/${doc.id}/start-approval`, {});
  await apiPost<any>(request, token, `/documents/${doc.id}/approve`, {});
  const published = await apiPost<any>(request, token, `/documents/${doc.id}/publish`, {});
  expect(published.status).toBe('PUBLISHED');

  const granted = await apiPost<any>(request, token, `/documents/${doc.id}/edit-requests/grant`, {
    requesterUserId: adminSession.user.id,
    reason: 'Autoedição do operador (E2E)',
  });
  expect(['APPROVED', 'IN_PROGRESS']).toContain(granted.status);

  const detail = await apiGet<any>(request, token, `/documents/${doc.id}`);
  expect(detail.status).toBe('IN_DEVELOPMENT');
  expect(detail.version).toBe(published.version + 1);
});

// ---------------------------------------------------------------------------
// UI (Chromium): fluxo real de cliques no módulo
// ---------------------------------------------------------------------------

test('UI: cria documento, edita com um clique e conclui o fluxo até publicar', async ({ page }) => {
  const errors = monitorClientErrors(page);
  const title = `E2E UI GED ${uniqueCode('UI')}`;
  await open(page, '/documents');
  await expect(page.getByRole('heading', { name: 'Documentos' })).toBeVisible({ timeout: 60_000 });

  // Criação pelo diálogo
  await page.getByRole('button', { name: 'Novo documento' }).first().click();
  const createDialog = page.getByRole('dialog').filter({ hasText: 'Novo documento' });
  await createDialog.locator('input').first().fill(title);
  await createDialog.getByRole('button', { name: 'Salvar documento' }).click();

  // Detalhe abre automaticamente após criar
  const detailDialog = page.getByRole('dialog').filter({ hasText: title });
  await expect(detailDialog).toBeVisible({ timeout: 30_000 });

  // Regressão do bug: apenas UM botão "Editar documento" e a atribuição é distinta
  await expect(detailDialog.getByRole('button', { name: 'Editar documento', exact: true })).toHaveCount(1);
  await expect(detailDialog.getByRole('button', { name: 'Atribuir edição a outro usuário' })).toBeVisible();

  // Atribuir abre o diálogo de liberação (com seleção de usuário) e pode ser cancelado
  await detailDialog.getByRole('button', { name: 'Atribuir edição a outro usuário' }).click();
  const grantDialog = page.getByRole('dialog').filter({ hasText: 'Liberar edição do documento' });
  await expect(grantDialog).toBeVisible();
  await expect(grantDialog.getByRole('button', { name: 'Enviar para edição' })).toBeDisabled();
  await grantDialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(grantDialog).toBeHidden();

  // Um clique para editar: libera para si e (se online) abre o editor
  await detailDialog.getByRole('button', { name: 'Editar documento', exact: true }).click();
  await expect(detailDialog.getByRole('button', { name: 'Concluir edição' })).toBeVisible({ timeout: 30_000 });
  const editorDialog = page.getByRole('dialog').filter({ hasText: 'Editor DOCX pela web' });
  if (await editorDialog.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await expect(editorDialog).toBeHidden();
  }
  await detailDialog.getByRole('button', { name: 'Concluir edição' }).click();
  await expect(detailDialog.getByRole('button', { name: 'Concluir edição' })).toBeHidden({ timeout: 30_000 });

  // Fluxo documental completo por cliques
  await detailDialog.getByRole('button', { name: 'Enviar revisão' }).click();
  await detailDialog.getByRole('button', { name: 'Iniciar revisão' }).click();
  await detailDialog.getByRole('button', { name: 'Revisado' }).click();
  await detailDialog.getByRole('button', { name: 'Enviar aprovação' }).click();
  await detailDialog.getByRole('button', { name: 'Iniciar aprovação' }).click();
  await detailDialog.getByRole('button', { name: 'Aprovar', exact: true }).click();
  await detailDialog.getByRole('button', { name: 'Publicar' }).click();
  await expect(detailDialog.getByRole('button', { name: 'Nova revisão' })).toBeVisible({ timeout: 30_000 });

  // Distribuição: confirmar leitura e ver a lista real
  await detailDialog.getByRole('tab', { name: 'Distribuição' }).click();
  await detailDialog.getByRole('button', { name: 'Confirmar leitura' }).click();
  await expect(detailDialog.getByText('Leitura confirmada').first()).toBeVisible({ timeout: 30_000 });
  await expect(detailDialog.getByText(adminSession.user.name).first()).toBeVisible();

  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('UI: rail de situação filtra o acervo e a matriz lista os documentos', async ({ page }) => {
  const errors = monitorClientErrors(page);
  await open(page, '/documents');
  await expect(page.getByRole('heading', { name: 'Documentos' })).toBeVisible({ timeout: 60_000 });

  // Filtro por situação
  await page.getByRole('button', { name: /Publicados \(vigentes\)/ }).click();
  await expect(page.getByText(/documento\(s\) no escopo atual/)).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros' }).click();

  // Matriz geral
  await page.getByRole('tab', { name: 'Matriz Geral' }).click();
  await expect(page.getByRole('columnheader', { name: 'Revisão' })).toBeVisible();
  expect(errors).toEqual([]);
});

async function open(page: Page, path: string) {
  await page.addInitScript(
    ({ accessToken, refreshToken }) => {
      window.localStorage.setItem('g360.accessToken', accessToken);
      window.localStorage.setItem('g360.refreshToken', refreshToken);
    },
    adminSession,
  );
  await page.goto(path);
}

function monitorClientErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}
