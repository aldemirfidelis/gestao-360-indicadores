import { expect, test } from '@playwright/test';
import { platformAdminCredentials } from './helpers';

test('Platform Admin faz login, seleciona empresa e lista usuarios', async ({ page }) => {
  await page.goto('/platform-admin/login');

  await page.getByLabel('E-mail interno').fill(platformAdminCredentials.email);
  await page.getByLabel('Senha').fill(platformAdminCredentials.password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.waitForURL('**/platform-admin');
  await expect(page.getByText('Portal Administrativo Global').first()).toBeVisible();

  await page.getByRole('button', { name: 'Usuários' }).click();
  await expect(page.getByRole('heading', { name: /Usu.rios da empresa/ })).toBeVisible();

  const companySelect = page.locator('select').first();
  await expect(companySelect).toBeVisible();
  const selectedCompany = await companySelect.inputValue();
  expect(selectedCompany).toBeTruthy();

  await expect(page.getByText('admin@demo.com')).toBeVisible();
});
