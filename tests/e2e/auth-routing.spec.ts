import { expect, test } from '@playwright/test';

test('landing publica carrega CTA de acesso', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: /P.gina inicial do Gest.o 360/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Acesse a Demonstra..o/ }).first()).toBeVisible();
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

  // O formulario ja vem pre-preenchido com as credenciais demo; limpar antes de
  // digitar evita valor concatenado (input controlado do React).
  await page.getByLabel('E-mail').fill('');
  await page.getByLabel('E-mail').fill('demo@demo.com');
  await page.getByLabel('Senha').fill('');
  await page.getByLabel('Senha').fill('123456');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));

  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();

  await page.getByRole('button', { name: 'Sair' }).click();
  await page.waitForURL('**/login');
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
});
