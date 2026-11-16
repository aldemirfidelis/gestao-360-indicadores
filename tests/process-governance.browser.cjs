'use strict';
// Ensaio de interface isolado, após scripts/check-process-governance.cjs.
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fixture = JSON.parse(fs.readFileSync('/review/process-fixture.json', 'utf8'));
assert.equal(process.env.PROCESS_REVIEW_ISOLATED, '1');
const base = 'http://localhost:3000';
const report = [];
const pass = text => { report.push(text); console.log('PASS:', text); };
async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  // Mesmo encaminhamento /api do Caddy; nenhum endereço de produção é usado.
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: 'http://api:3333' + url.pathname + url.search });
    await route.fulfill({ response });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  const responseFor = async (action, path, method = 'POST') => {
    const responsePromise = page.waitForResponse(response => response.url().includes(path) && response.request().method() === method);
    await action();
    const response = await responsePromise;
    const body = await response.json();
    assert.ok(response.ok(), JSON.stringify(body));
    return body;
  };
  const login = async email => {
    await page.goto(base + '/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill('ProcessReviewOnly2026!');
    await responseFor(() => page.getByRole('button', { name: 'Entrar no sistema' }).click(), '/auth/login');
    await page.waitForFunction(() => Boolean(localStorage.getItem('g360.accessToken')));
  };
  const openProcess = async () => {
    await page.goto(base + '/processes/' + fixture.processId);
    await page.getByRole('tab', { name: 'SIPOC', exact: true }).waitFor();
  };
  const create = async (kind, name, scenario = 'AS_IS', basedOnId) => {
    await page.getByRole('tab', { name: kind === 'RACI' ? 'Matriz RACI' : kind, exact: true }).click();
    await page.getByRole('button', { name: 'Criar ' + kind, exact: true }).click();
    await page.getByLabel('Nome do novo artefato').fill(name);
    await page.getByRole('dialog').locator('select').first().selectOption(scenario);
    if (basedOnId) await page.getByRole('dialog').locator('select').nth(1).selectOption(basedOnId);
    const artifact = await responseFor(() => page.getByRole('button', { name: 'Criar artefato', exact: true }).click(), '/artifacts');
    await page.waitForFunction(expected => document.querySelector('input[aria-label="Nome do artefato"]')?.value === expected, name);
    return artifact;
  };
  const save = async artifactId => {
    await page.getByLabel('Descrição da alteração', { exact: true }).fill('Verificação de interface');
    const artifact = await responseFor(() => page.getByRole('button', { name: 'Salvar versão', exact: true }).click(), '/artifacts/' + artifactId, 'PATCH');
    await page.getByText('Versão salva no processo', { exact: true }).waitFor();
    return artifact;
  };
  try {
    await login(fixture.owner.email);
    await openProcess();
    let sipoc = await create('SIPOC', 'SIPOC validado no navegador');
    await page.getByRole('button', { name: 'Adicionar', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input').first().fill('Fornecedor verificado na interface');
    await dialog.getByRole('button', { name: 'Aplicar ao rascunho', exact: true }).click();
    sipoc = await save(sipoc.id);
    assert.ok(sipoc.content.suppliers.some(item => item.name === 'Fornecedor verificado na interface'));
    await page.reload();
    await page.getByRole('tab', { name: 'SIPOC', exact: true }).click();
    await page.getByLabel('Selecionar SIPOC').selectOption(sipoc.id);
    await page.getByRole('button', { name: 'Fornecedor verificado na interface', exact: true }).waitFor();
    pass('Criação, edição e recarga de SIPOC com dados persistidos');

    let bpmn = await create('BPMN', 'BPMN validado no navegador');
    await page.getByLabel('Importar BPMN XML', { exact: true }).setInputFiles('/review/process-digital-implementation.bpmn');
    await page.locator('.djs-element[data-element-id="Tests"]').first().waitFor();
    await page.locator('.djs-element[data-element-id="Tests"] .djs-hit').first().click();
    await page.getByLabel('Nome do elemento BPMN').fill('Executar testes automatizados');
    await page.getByRole('button', { name: 'Aplicar ao desenho', exact: true }).click();
    bpmn = await save(bpmn.id);
    assert.ok(bpmn.bpmnXml.includes('Executar testes automatizados'));
    await page.reload();
    await page.getByRole('tab', { name: 'BPMN', exact: true }).click();
    await page.getByLabel('Selecionar BPMN').selectOption(bpmn.id);
    await page.locator('.djs-element[data-element-id="Tests"]').first().waitFor();
    await page.getByLabel('Importar BPMN XML', { exact: true }).setInputFiles({ name: 'invalido.bpmn', mimeType: 'application/xml', buffer: Buffer.from('<invalid>') });
    await page.getByRole('alert').filter({ hasText: 'XML BPMN inválido' }).waitFor();
    await page.locator('.djs-element[data-element-id="Tests"]').first().waitFor();
    for (const label of ['Exportar BPMN XML', 'Exportar SVG']) {
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: label, exact: true }).click();
      const download = await downloadPromise;
      const filepath = '/review/' + download.suggestedFilename(); await download.saveAs(filepath);
      const exported = fs.readFileSync(filepath, 'utf8');
      assert.ok(label === 'Exportar SVG' ? exported.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').includes('Executar testes automatizados') : exported.includes('Executar testes automatizados'));
    }
    await page.screenshot({ path: '/review/bpmn-desktop.png', fullPage: true });
    pass('Importação BPMN, edição visual, recarga e exportações XML/SVG');
    let tobe = await create('BPMN', 'BPMN TO-BE validado', 'TO_BE', bpmn.id);
    await page.locator('.djs-element[data-element-id="Tests"] .djs-hit').first().click();
    await page.getByLabel('Nome do elemento BPMN').fill('Validar testes automaticamente');
    await page.getByRole('button', { name: 'Aplicar ao desenho', exact: true }).click();
    tobe = await save(tobe.id);
    const comparison = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Comparar AS-IS e TO-BE', exact: true }) });
    await comparison.locator('select').first().selectOption(bpmn.id);
    const compared = await responseFor(() => comparison.locator('select').nth(1).selectOption(tobe.id), '/compare/', 'GET');
    assert.equal(compared.modified.length, 1);
    await comparison.getByRole('heading', { name: 'Modificadas: 1', exact: true }).waitFor();
    pass('Criação TO-BE a partir do AS-IS e comparação visual de uma atividade modificada');

    let raci = await create('RACI', 'RACI validada no navegador');
    await page.locator('select').filter({ has: page.locator(`option[value="USER:${fixture.owner.id}"]`) }).selectOption('USER:' + fixture.owner.id);
    const rowName = await page.getByLabel('Atividade da matriz').first().inputValue();
    await page.getByLabel(`R: ${rowName} / ${fixture.owner.name}`, { exact: true }).check();
    await page.getByLabel(`A: ${rowName} / ${fixture.owner.name}`, { exact: true }).check();
    raci = await save(raci.id);
    assert.equal(raci.validation.errors.length, 0);
    for (const [label, state] of [['Enviar para revisão', 'IN_REVIEW'], ['Aprovar', 'APPROVED'], ['Publicar', 'PUBLISHED']]) {
      await page.getByLabel('Descrição da alteração', { exact: true }).fill('Decisão validada na interface');
      raci = await responseFor(() => page.getByRole('button', { name: label, exact: true }).click(), '/transition');
      assert.equal(raci.state, state);
      await page.getByRole('button', { name: label, exact: true }).waitFor({ state: 'detached' });
    }
    assert.equal(await page.getByRole('button', { name: 'Salvar versão', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Ver versão', exact: true }).last().click();
    await page.getByRole('heading', { name: /Versão preservada/ }).waitFor();
    assert.equal(await page.getByRole('dialog').getByRole('button', { name: 'Salvar versão', exact: true }).count(), 0);
    await page.keyboard.press('Escape');
    pass('RACI R+A, aprovação/publicação e consulta de versão imutável');

    await page.getByRole('tab', { name: 'Registros relacionados', exact: true }).click();
    const projectLink = page.getByRole('link', { name: 'Automatização da implantação', exact: true }).first();
    await projectLink.click();
    await page.getByRole('link', { name: 'Implantação de solução digital', exact: true }).first().waitFor();
    await page.getByRole('link', { name: 'Implantação de solução digital', exact: true }).first().click();
    await page.getByRole('tab', { name: 'SIPOC', exact: true }).waitFor();
    pass('Navegação processo → projeto → processo');
    const protectedTask = await page.evaluate(async id => {
      const headers = { authorization: 'Bearer ' + localStorage.getItem('g360.accessToken') };
      const before = await (await fetch('/api/projects/' + id, { headers })).json();
      const result = await fetch('/api/projects/tasks/' + before.tasks[0].id, { method: 'DELETE', headers });
      const body = await result.json();
      const after = await (await fetch('/api/projects/' + id, { headers })).json();
      return { status: result.status, message: body.message, before: before.tasks.length, after: after.tasks.length };
    }, fixture.projectId);
    assert.equal(protectedTask.status, 409); assert.equal(protectedTask.before, protectedTask.after); assert.ok(protectedTask.message.includes('vínculos'));
    pass('Exclusão de tarefa vinculada protegida com mensagem 409 e dados preservados');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('tab', { name: 'SIPOC', exact: true }).click();
    await page.getByLabel('Selecionar SIPOC').selectOption(sipoc.id);
    await page.getByRole('button', { name: 'Fornecedor verificado na interface', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Fornecedor verificado na interface', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/review/sipoc-mobile.png', fullPage: true });
    const width = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert.ok(width.document <= width.viewport + 2, JSON.stringify(width));
    pass('SIPOC utilizável em tela de 390 pixels');
    for (const [kind, artifactId] of [['BPMN', bpmn.id], ['RACI', raci.id]]) {
      await page.getByRole('tab', { name: kind === 'RACI' ? 'Matriz RACI' : kind, exact: true }).click();
      await page.getByLabel('Selecionar ' + kind).selectOption(artifactId);
      const element = kind === 'BPMN' ? page.getByTestId('bpmn-canvas') : page.getByLabel('Atividade da matriz').first();
      await element.scrollIntoViewIfNeeded();
      const dimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert.ok(dimensions.document <= dimensions.viewport + 2, JSON.stringify(dimensions));
      await page.screenshot({ path: '/review/' + kind.toLowerCase() + '-mobile.png', fullPage: true });
    }
    pass('BPMN e RACI sem transbordamento da página em tela de 390 pixels');

    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.setViewportSize({ width: 1440, height: 1000 });
    await login(fixture.viewer.email);
    await openProcess();
    await page.getByRole('tab', { name: 'Matriz RACI', exact: true }).click();
    await page.getByLabel('Selecionar RACI').selectOption(raci.id);
    await page.getByLabel('Atividade da matriz').first().waitFor();
    assert.equal(await page.getByRole('button', { name: 'Criar RACI', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Salvar versão', exact: true }).count(), 0);
    const denied = await page.evaluate(async id => {
      const response = await fetch('/api/processes/governance/artifacts/' + id, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + localStorage.getItem('g360.accessToken') }, body: JSON.stringify({ revision: 1, name: 'Tentativa', changeNote: 'Sem autorização' }) }); return response.status;
    }, raci.id);
    assert.equal(denied, 403);
    pass('Perfil de leitura sem controles de edição e PATCH negado pela API');
    assert.deepEqual(errors, []);
    fs.writeFileSync('/review/browser-report.json', JSON.stringify({ report, errors }, null, 2));
  } catch (error) {
    await page.screenshot({ path: '/review/browser-failure.png', fullPage: true }).catch(() => {});
    console.error((await page.locator('body').innerText()).slice(-7000));
    throw error;
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
