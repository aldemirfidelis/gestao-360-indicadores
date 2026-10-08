import { expect, test } from '@playwright/test';
import { apiBaseURL, adminCredentials } from './helpers';

test.describe('produto focado e demonstração pública', () => {
  test.describe.configure({ mode: 'serial' });

  test('home abre demo em um clique e apresenta os módulos preenchidos', async ({ page, request }) => {
    test.setTimeout(90_000);
    const crashes: string[] = [];
    const failedReads: string[] = [];
    page.on('response', response => {
      if (response.url().includes(':3333/api/') && response.request().method() === 'GET' && response.status() >= 400) failedReads.push(`${response.status()} ${response.url().split('/api/')[1]}`);
    });
    page.on('pageerror', error => crashes.push(error.message));
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Acesso aos Candidatos', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Acessar Plataforma', exact: true })).toHaveCount(0);
    await page.evaluate(() => localStorage.setItem('g360.refreshToken', 'stale-admin-refresh'));
    await page.getByRole('link', { name: /Acesse a Demonstração/ }).first().click();
    await expect(page).toHaveURL(/\/meu-dia$/, { timeout: 30_000 });
    await expect(page.getByText('Empresa Demonstração · Dados fictícios · Acesso somente para consulta')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('g360.refreshToken'))).toBeNull();
    const token = await page.evaluate(() => localStorage.getItem('g360.accessToken'));
    const headers = { authorization: `Bearer ${token}` };
    const overview = await request.get(`${apiBaseURL}/my-day`, { headers });
    expect(overview.status()).toBe(200);
    expect((await overview.json()).summary.indicatorsOffTarget).toBeGreaterThan(0);
    const indicators = await request.get(`${apiBaseURL}/indicators`, { headers });
    expect(indicators.status()).toBe(200);
    expect((await indicators.json()).length).toBeGreaterThan(20);
    const prize = await request.get(`${apiBaseURL}/prize/overview`, { headers });
    expect(prize.status()).toBe(200);
    const { cards } = await prize.json();
    expect(cards.eligibleEmployees).toBeGreaterThan(0);
    expect(cards.calculationsProcessed).toBeGreaterThan(0);
    expect(cards.payslipsPublished).toBeGreaterThan(0);
    for (const route of ['/tarefas', '/visualization', '/org', '/strategy', '/indicators', '/deviations', '/actions', '/projects', '/meetings', '/monthly-results', '/okrs', '/gestao-premio', '/gestao-premio/programas', '/gestao-premio/competencias', '/gestao-premio/anexos', '/gestao-premio/realizado', '/gestao-premio/colaboradores', '/gestao-premio/apuracao', '/gestao-premio/ajustes', '/gestao-premio/espelhos', '/gestao-premio/relatorios', '/gestao-premio/folha']) {
      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.getByText('Empresa Demonstração · Dados fictícios · Acesso somente para consulta')).toBeVisible();
      if (['/gestao-premio/realizado', '/gestao-premio/colaboradores', '/gestao-premio/apuracao', '/gestao-premio/ajustes', '/gestao-premio/espelhos', '/gestao-premio/folha'].includes(route)) {
        const select = page.locator('main select').first();
        await expect(select.locator('option')).toHaveCount(4);
        const competenceId = await select.locator('option').nth(1).getAttribute('value');
        await select.selectOption(competenceId!);
        await expect(select).toHaveValue(competenceId!);
        if (route === '/gestao-premio/espelhos') {
          await expect(page.locator('main tbody tr')).toHaveCount(3);
          await expect(page.getByRole('button', { name: 'Dar ciência' })).toHaveCount(0);
        }
      }
      if (route === '/tarefas') {
        await expect(page.getByRole('button', { name: 'Nova tarefa', exact: true })).toBeDisabled();
        await expect(page.getByText('Consolidar resultados do mês', { exact: true })).toBeVisible({ timeout: 20_000 });
      }
    }
    expect(crashes).toEqual([]);
    expect(failedReads).toEqual([]);
  });

  test('demo não altera registros, não troca empresa e não lê dados de outro tenant', async ({ request }) => {
    const login = await request.post(`${apiBaseURL}/auth/demo`, { data: { companyId: 'ignorado', email: adminCredentials.email } });
    expect(login.status()).toBe(201);
    const session = await login.json();
    expect(session.user.email).toBe('visitante@demonstracao.local');
    expect(session.refreshToken).toBe('');
    const headers = { authorization: `Bearer ${session.accessToken}` };
    for (const [method, route] of [['POST', '/indicators'], ['PATCH', '/auth/me/password'], ['POST', '/platform/switch'], ['POST', '/assistant/help']] as const) {
      const response = await request.fetch(`${apiBaseURL}${route}`, { method, headers, data: {} });
      expect(response.status(), `${method} ${route}`).toBe(403);
    }
    const adminLogin = await request.post(`${apiBaseURL}/auth/login`, { data: adminCredentials });
    expect(adminLogin.ok()).toBeTruthy();
    const admin = await adminLogin.json();
    expect(admin.user.companyId).not.toBe(session.user.companyId);
    const original = await request.get(`${apiBaseURL}/indicators`, { headers: { authorization: `Bearer ${admin.accessToken}` } });
    const originalRows = await original.json();
    expect(originalRows.length).toBeGreaterThan(0);
    const foreign = await request.get(`${apiBaseURL}/indicators/${originalRows[0].id}`, { headers });
    expect(foreign.status()).toBe(404);
    const scoped = await request.get(`${apiBaseURL}/indicators`, { headers: { ...headers, 'x-platform-company-id': admin.user.companyId } });
    expect((await scoped.json()).every((row: { companyId: string }) => row.companyId === session.user.companyId)).toBe(true);
  });

  test('perfil próprio continua disponível sem carregar comunicação ou folha', async ({ page, request }) => {
    const login = await request.post(`${apiBaseURL}/auth/login`, { data: adminCredentials });
    expect(login.ok()).toBeTruthy();
    const session = await login.json();
    // Instala a sessão antes do primeiro mount, sem corrida com AuthProvider.
    await page.addInitScript(({ accessToken, refreshToken }) => {
      localStorage.setItem('g360.accessToken', accessToken);
      localStorage.setItem('g360.refreshToken', refreshToken);
    }, { accessToken: session.accessToken, refreshToken: session.refreshToken });
    await page.goto(`/perfil/${session.user.id}`);
    await expect(page.getByRole('heading', { name: session.user.name, exact: true })).toBeVisible();
    await expect(page.getByText('Minha Vida Funcional (Holerites)')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Enviar mensagem' })).toHaveCount(0);
  });

  test('rotas de módulos suspensos retornam 404 no Web e na API', async ({ request }) => {
    for (const route of ['/documents', '/risks', '/forms', '/servico-pessoal', '/carreiras', '/comunicacao']) {
      expect((await request.get(route)).status(), route).toBe(404);
    }
    for (const route of ['/documents', '/risks', '/forms', '/personnel', '/communication/conversations']) {
      expect((await request.get(`${apiBaseURL}${route}`)).status(), route).toBe(404);
    }
  });
});
