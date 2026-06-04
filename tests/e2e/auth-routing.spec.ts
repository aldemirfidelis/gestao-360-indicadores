import { expect, test } from '@playwright/test';

test('landing pública carrega CTA de acesso', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Gestão 360', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Acessar plataforma' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Solicitar demonstração|Agendar demo/ }).first()).toBeVisible();
});

test('login público renderiza formulário com credenciais demo', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByLabel('E-mail')).toHaveValue('admin@demo.com');
  await expect(page.getByLabel('Senha')).toHaveValue('admin123');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});

test('rota privada sem token redireciona para login', async ({ page }) => {
  await page.goto('/dashboard');

  await page.waitForURL('**/login');
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
});
