import { expect, test } from '@playwright/test';

test.describe('login, documentos legais e contatos públicos', () => {
  test.describe.configure({ mode: 'serial' });

  test('login exibe marca, versão e documentos no novo rodapé', async ({ page }) => {
    await page.goto('/login?demo=1');

    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer.getByLabel('Versão da aplicação')).toContainText(/^Versão 0\.1\.0\+/);
    await expect(footer.getByRole('link', { name: 'Termos' })).toHaveAttribute('href', '/termos-de-uso');
    await expect(footer.getByRole('link', { name: 'Privacidade' })).toHaveAttribute('href', '/politica-de-privacidade');
    await expect(footer.getByRole('link', { name: 'LGPD' })).toHaveAttribute('href', '/lgpd');
    await expect(page.getByRole('link', { name: 'Fale com o suporte' })).toHaveAttribute('href', '/suporte#formulario');
  });

  test('formulário de suporte coleta a dúvida e confirma envio', async ({ page }) => {
    await page.route('**/contato/enviar', async (route) => {
      const payload = route.request().postDataJSON();
      expect(payload.requestType).toBe('Suporte técnico');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/suporte#formulario');
    const form = page.getByRole('form', { name: 'Formulário de suporte do Gestão 360' });
    await form.getByLabel('Nome').fill('Pessoa Teste');
    await form.getByLabel('Empresa').fill('Empresa Teste');
    await form.getByLabel('E-mail corporativo').fill('pessoa@example.com');
    await form.getByLabel('Tipo de solicitação').selectOption('Suporte técnico');
    await form.getByLabel('Descreva sua dúvida').fill('Preciso de ajuda para acessar um recurso do portal.');
    await form.getByRole('checkbox').check();
    await form.getByRole('button', { name: 'Enviar para o suporte' }).click();
    await expect(form.getByRole('status')).toContainText('Mensagem enviada');
  });

  test('landing leva ao formulário de trial de 30 dias', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Solicitar meu trial' }).click();
    await expect(page).toHaveURL(/\/teste-gratis/, { timeout: 30_000 });
    await expect(page.getByRole('form', { name: 'Formulário de solicitação de trial do Gestão 360' })).toBeVisible({ timeout: 30_000 });
  });

  test('páginas legais estão publicadas e interligadas', async ({ page }) => {
    await page.goto('/lgpd');
    await expect(page.getByRole('heading', { name: 'Privacidade é um direito — e precisa de um canal claro.' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Lei nº 13.709/ })).toHaveAttribute('href', /planalto\.gov\.br/);

    await page.goto('/termos-de-uso');
    await expect(page.getByRole('heading', { name: '1. Aceitação e escopo' })).toBeVisible();

    await page.goto('/politica-de-privacidade');
    await expect(page.getByRole('heading', { name: '9. Direitos dos titulares' })).toBeVisible();
  });
});
