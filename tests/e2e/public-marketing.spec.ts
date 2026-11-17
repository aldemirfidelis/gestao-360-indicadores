import { expect, test } from '@playwright/test';

test.describe('apresentação pública e conversão', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/public/site-events', route => route.fulfill({ json: { ok: true } }));
  });

  test('permite explorar a jornada, os processos e a análise por teclado', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Sua gestão, conectada.');
    const journey = page.getByRole('tablist', { name: 'Etapas da gestão conectada' });
    await journey.getByRole('tab', { name: /Indicadores/ }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(journey.getByRole('tab', { name: /Desvios/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#journey-panel')).toContainText('O resultado fora da meta');
    await page.keyboard.press('End');
    await expect(page.locator('#journey-panel')).toContainText('verifique a eficácia');
    const processes = page.getByRole('tablist', { name: 'Ferramentas de gestão de processos' });
    await processes.getByRole('tab', { name: 'RACI' }).click();
    await expect(page.locator('#process-panel table')).toContainText('Realizar triagem');
    await processes.getByRole('tab', { name: 'BPMN' }).click();
    await expect(page.locator('#process-panel').getByRole('img', { name: /Exemplo BPMN/ })).toBeVisible();
    await page.getByRole('tab', { name: 'PDCA', exact: true }).click();
    await expect(page.locator('#analysis-panel')).toContainText('Verificar');
  });

  test('menu móvel oferece destinos e retorna o foco ao fechar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Abrir menu' });
    await toggle.click();
    const nav = page.getByRole('navigation', { name: 'Navegação no celular' });
    await nav.locator('summary').filter({ hasText: 'Plataforma' }).click();
    await expect(nav.getByRole('link', { name: 'Processos: SIPOC, BPMN e RACI' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('falha no envio preserva os campos e uma tentativa envia apenas uma mensagem', async ({ page }) => {
    let calls = 0;
    await page.route('**/contato/enviar', async route => {
      calls++;
      const payload = route.request().postDataJSON();
      expect(payload.requestType).toBe('Trial de 30 dias');
      expect(payload.privacy).toBe('accepted');
      expect(payload.website).toBe('');
      await new Promise(resolve => setTimeout(resolve, 150));
      await route.fulfill({ status: calls === 1 ? 503 : 200, json: calls === 1 ? { message: 'Envio temporariamente indisponível.' } : { ok: true } });
    });
    await page.goto('/teste-gratis');
    const form = page.getByRole('form', { name: 'Formulário de solicitação de trial do Gestão 360' });
    await form.getByLabel('Nome').fill('Pessoa de Exemplo');
    await form.getByLabel('Empresa').fill('Empresa Fictícia');
    await form.getByLabel('E-mail corporativo').fill('avaliacao@example.test');
    await form.getByLabel('Objetivo do trial').fill('Avaliar processos e indicadores com a equipe de operações.');
    await form.getByRole('checkbox').check();
    await form.getByRole('button', { name: 'Solicitar trial de 30 dias' }).click();
    await expect(form.getByRole('alert')).toContainText('temporariamente indisponível');
    await expect(form.getByLabel('Nome')).toHaveValue('Pessoa de Exemplo');
    await expect(form.getByRole('checkbox')).toBeChecked();
    await form.evaluate(element => { element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    await expect(form.getByRole('status')).toContainText('Solicitação recebida');
    expect(calls).toBe(2);
    await expect(form.getByLabel('Nome')).toHaveValue('');
  });

  test('falha na demonstração informa o erro e permite tentar novamente', async ({ page }) => {
    await page.route('**/api/auth/demo', route => route.fulfill({ status: 503, json: { message: 'Indisponível' } }));
    await page.goto('/');
    const demo = page.getByRole('link', { name: 'Conhecer a demonstração', exact: true }).first();
    await demo.click();
    await expect(page.getByText('Demonstração indisponível no momento. Tente novamente em instantes.')).toBeVisible();
    await expect(demo).toHaveAttribute('aria-disabled', 'false');
    await expect(page).toHaveURL(/\/$/);
  });
});
