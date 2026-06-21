import { expect, test } from '@playwright/test';

test('landing publica carrega CTA de acesso', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Gest.o 360/, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Acessar plataforma' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Solicitar demonstra..o|Agendar demo/ }).first()).toBeVisible();
});

test('login publico renderiza formulario com credenciais demo', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByLabel('E-mail')).toHaveValue('demo@demo.com');
  await expect(page.getByLabel('Senha')).toHaveValue('123456');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});

test('rota privada sem token redireciona para login', async ({ page }) => {
  await page.goto('/dashboard');

  await page.waitForURL('**/login');
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
});

test('login, dashboard e logout funcionam pela interface', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('E-mail').fill('demo@demo.com');
  await page.getByLabel('Senha').fill('123456');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));

  await page.goto('/dashboard');
  await expect(page.getByText(/Vis.o geral do Gest.o 360/)).toBeVisible();

  await page.getByRole('button', { name: 'Sair' }).click();
  await page.waitForURL('**/login');
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
});
