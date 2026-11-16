'use strict';
// Ensaio de integração do PMO de Processos: somente Postgres descartável, nunca a base do produto.
// Executar com os serviços compilados (./dist) na rede do banco descartável, como os demais ensaios.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');
const { AuthService } = require('./dist/src/modules/auth/auth.service');
const { AccessService } = require('./dist/src/modules/access/access.service');
const { TraceabilityService } = require('./dist/src/modules/traceability/traceability.service');
const { ProcessesService } = require('./dist/src/modules/processes/processes.service');
const { ProcessLinksService } = require('./dist/src/modules/processes/process-links.service');
const { ProcessGovernanceService } = require('./dist/src/modules/processes/process-governance.service');
const { ProcessPmoService } = require('./dist/src/modules/processes/process-pmo.service');
const { ProjectsService } = require('./dist/src/modules/projects/projects.service');
const { PERMISSION_CATALOG } = require('./dist/src/modules/users/permission-catalog');
const { projectMeasurementDay } = require('@g360/shared');
const db = new PrismaClient();
const pass = (message) => console.log('PASS:', message);
// Mesmo "hoje" dos serviços (dia de São Paulo), para o ensaio não depender do horário.
const day = (offset) => new Date(projectMeasurementDay().getTime() + offset * 86_400_000).toISOString().slice(0, 10);

async function run() {
  const url = new URL(process.env.DATABASE_URL);
  assert.equal(url.hostname, 'localhost');
  assert.equal(url.pathname, '/g360_process_pmo_review');
  assert.equal(process.env.PROCESS_PMO_REVIEW_ISOLATED, '1');

  const company = await db.company.create({ data: { name: 'Ensaio isolado de PMO de processos', areaAccessEnabled: false } });
  const foreign = await db.company.create({ data: { name: 'Sentinela de isolamento do PMO' } });
  const area = await db.orgNode.create({ data: { companyId: company.id, name: 'Operações', type: 'AREA' } });
  const user = (name, email, role) => db.user.create({ data: { companyId: company.id, name, email, passwordHash: 'x', role, defaultNodeId: area.id } });
  const owner = await user('Gestora do processo', 'pmo-owner@example.test', 'SUPER_ADMIN');
  const editor = await user('Analista de melhoria', 'pmo-editor@example.test', 'ANALYST');
  const reader = await user('Leitor de projetos', 'pmo-reader@example.test', 'VIEWER');
  const noProjects = await user('Editor sem projetos', 'pmo-noprojects@example.test', 'ANALYST');
  for (const [key, description, module, action] of PERMISSION_CATALOG) {
    await db.permission.upsert({ where: { key }, create: { key, description, module, action }, update: {} });
  }
  const grants = [
    [editor.id, ['processes:view', 'processes:update', 'processes:create', 'projects:view', 'projects:create', 'projects:update', 'indicators:view']],
    [reader.id, ['processes:view', 'processes:update', 'projects:view']],
    [noProjects.id, ['processes:view', 'processes:update']],
  ];
  for (const [userId, keys] of grants) for (const key of keys) {
    const permission = await db.permission.findUniqueOrThrow({ where: { key } });
    await db.userPermission.create({ data: { userId, permissionId: permission.id } });
  }
  const payload = (record) => ({ sub: record.id, companyId: record.companyId, name: record.name, email: record.email, role: record.role });
  const me = payload(owner), edit = payload(editor), read = payload(reader), blind = payload(noProjects);

  const auth = new AuthService(db, new JwtService(), null);
  const access = new AccessService(db, { write: async () => {}, record: async () => {} });
  const trace = new TraceabilityService(db, null);
  const processes = new ProcessesService(db, trace, access);
  const portal = { getEffectiveConfig: async () => ({ modules: ['processes', 'projects', 'indicators', 'org', 'tasks', 'actions'].map((code) => ({ code, unavailable: false, hidden: false, maintenance: false, allowedRoles: [] })) }) };
  const links = new ProcessLinksService(db, access, auth, portal);
  const governance = new ProcessGovernanceService(db, processes, links, access);
  const projects = new ProjectsService(db, access);
  const pmo = new ProcessPmoService(db, processes, links, projects, access);

  const indicator = await db.indicator.create({ data: { companyId: company.id, ownerNodeId: area.id, name: 'Lead time do atendimento', code: 'PMO-01', direction: 'LOWER_BETTER' } });
  const proc = await processes.create(me, { name: 'Atendimento ao cliente', orgNodeId: area.id, ownerUserId: owner.id, indicatorId: indicator.id });
  const other = await processes.create(me, { name: 'Compras sem melhoria' });
  const foreignProcess = await db.process.create({ data: { companyId: foreign.id, number: 1, name: 'Processo externo' } });
  const foreignProject = await db.project.create({ data: { companyId: foreign.id, name: 'Projeto externo', code: 'PRJ-0001' } });

  // 1. Projeto de melhoria criado a partir do processo, já vinculado, com auditoria e histórico.
  const created = await pmo.createImprovementProject(edit, proc.id, {
    name: 'Reduzir fila do atendimento', category: 'Melhoria de processo', indicatorId: indicator.id,
    startsAt: day(-30), endsAt: day(30), budget: 10000, priority: 'HIGH',
  });
  assert.match(created.code, /^PRJ-\d{4}$/);
  const link = await db.processIntegration.findFirstOrThrow({ where: { processId: proc.id, projectId: created.id } });
  assert.equal(link.targetKey, `PROJECT:${created.id}`);
  assert.equal(link.scopeKey, 'PROCESS');
  assert.equal(await db.auditLog.count({ where: { entityId: proc.id, action: 'LINK_PROCESS' } }), 1);
  assert.equal(await db.traceabilityEvent.count({ where: { entityType: 'PROCESS', entityId: proc.id, title: 'Projeto de melhoria criado' } }), 1);
  assert.equal((await governance.overview(edit, proc.id)).integrations.filter((item) => item.type === 'PROJECT').length, 1);
  pass('Projeto de melhoria criado já vinculado, com código, auditoria e histórico do processo');

  // 2. Permissões: sem criar projetos, sem módulo Projetos ou com processo arquivado não cria nada.
  const before = await db.project.count({ where: { companyId: company.id } });
  await assert.rejects(pmo.createImprovementProject(read, proc.id, { name: 'Sem permissão' }), /permissão para criar projetos/);
  await assert.rejects(pmo.createImprovementProject(blind, proc.id, { name: 'Sem módulo' }), /permissão para criar projetos/);
  await assert.rejects(pmo.createImprovementProject(edit, foreignProcess.id, { name: 'Outra empresa' }), /encontrado/);
  await assert.rejects(pmo.createImprovementProject(edit, proc.id, { name: '' }), /obrigatório/);
  await db.process.update({ where: { id: other.id }, data: { status: 'ARCHIVED' } });
  await assert.rejects(pmo.createImprovementProject(edit, other.id, { name: 'Arquivado' }), /Reative o processo/);
  await db.process.update({ where: { id: other.id }, data: { status: 'ACTIVE' } });
  assert.equal(await db.project.count({ where: { companyId: company.id } }), before);
  assert.deepEqual(await pmo.overview(blind), { available: false, canCreate: false });
  pass('Permissões de Projetos, módulo, empresa, validação e processo arquivado respeitados');

  // 3. Projeto existente vinculado pelo mesmo vínculo de "Registros relacionados"; externo é recusado.
  const legacy = await projects.create(edit, { name: 'Novo script de atendimento', startsAt: day(-10), endsAt: day(20) });
  await governance.addIntegration(edit, proc.id, { type: 'PROJECT', targetId: legacy.id });
  await assert.rejects(governance.addIntegration(edit, proc.id, { type: 'PROJECT', targetId: foreignProject.id }), /não encontrado|fora do escopo/);
  const linked = await projects.list(edit, { processId: proc.id });
  assert.deepEqual(linked.map((item) => item.id).sort(), [created.id, legacy.id].sort());
  assert.deepEqual(await projects.list(edit, { processId: other.id }), []);
  assert.deepEqual(await projects.list(edit, { processId: foreignProcess.id }), []);
  pass('Vínculo de projeto existente e filtro do portfólio por processo isolados por empresa');

  // 4. Cronograma: tarefas, marcos, avanço, Gantt (datas), curva S e agenda do portfólio do processo.
  const late = await projects.addTask(edit, created.id, { name: 'Mapear fila atual', startDate: day(-30), endDate: day(-5) });
  await projects.addTask(edit, created.id, { name: 'Implantar triagem', startDate: day(-4), endDate: day(7) });
  await projects.updateTask(edit, late.id, { progress: 40 });
  const gate = await projects.addMilestone(edit, created.id, 'Piloto aprovado', day(-1));
  await projects.addMilestone(edit, legacy.id, 'Script publicado', day(5));
  const portfolio = await projects.portfolio(edit, { processId: proc.id });
  assert.equal(portfolio.totalProjects, 2);
  assert.equal(portfolio.tasksOverdue, 1);
  assert.equal(portfolio.milestonesOverdue, 1);
  assert.equal(portfolio.timeline.length, 2);
  const execution = await projects.execution(edit, { processId: proc.id });
  const current = await projects.list(edit, { processId: proc.id });
  assert.equal(execution.curve.hasSchedule, true);
  assert.equal(execution.curve.projects, 2);
  assert.equal(execution.curve.progress, Math.round(current.reduce((sum, item) => sum + item.progressOverall, 0) / current.length));
  assert.equal(execution.milestones[0].id, gate.id);
  assert.equal(execution.milestones[0].overdue, true);
  assert.equal(execution.tasks[0].id, late.id);
  assert.equal(execution.tasks[0].overdue, true);
  assert.deepEqual(execution.totals, { openMilestones: 2, overdueMilestones: 1, openTasks: 2, overdueTasks: 1, dueSoonTasks: 1 });
  pass('Portfólio do processo com tarefas, marcos, pendências vencidas, curva S e agenda');

  // 5. Painel PMO consolidado dos processos.
  await projects.addCost(edit, created.id, { kind: 'ACTUAL', description: 'Consultoria', amount: 12000, date: day(-3) });
  const panel = await pmo.overview(edit);
  assert.equal(panel.available, true);
  assert.equal(panel.canCreate, true);
  assert.equal(panel.totals.processes, 2);
  assert.equal(panel.totals.withProjects, 1);
  const row = panel.processes[0];
  assert.equal(row.process.id, proc.id);
  assert.equal(row.projects, 2);
  assert.equal(row.active, 2);
  assert.equal(row.tasksOverdue, 1);
  assert.equal(row.milestonesOverdue, 1);
  assert.equal(row.budget, 10000);
  assert.equal(row.actualCost, 12000);
  assert.equal(row.pmoStatus, 'CRITICAL');
  assert.equal(row.nextMilestone.name, 'Piloto aprovado');
  assert.equal((await pmo.overview(read)).canCreate, false);
  pass('Painel PMO por processo com avanço, situação, pendências, próximo marco e custos');

  // 6. Desvincular preserva o projeto; projeto excluído sai do portfólio e do painel.
  const legacyLink = await db.processIntegration.findFirstOrThrow({ where: { processId: proc.id, projectId: legacy.id } });
  await governance.removeIntegration(edit, legacyLink.id);
  assert.deepEqual((await projects.list(edit, { processId: proc.id })).map((item) => item.id), [created.id]);
  assert.ok(await db.project.findFirst({ where: { id: legacy.id, deletedAt: null } }));
  await projects.remove(me, created.id);
  assert.deepEqual(await projects.list(edit, { processId: proc.id }), []);
  assert.equal((await pmo.overview(edit)).processes.length, 0);
  assert.equal(await db.processIntegration.count({ where: { processId: proc.id, projectId: created.id } }), 1);
  assert.equal(await db.process.count({ where: { id: foreignProcess.id, companyId: foreign.id } }), 1);
  pass('Desvincular preserva o projeto; exclusão lógica tira o projeto do portfólio sem apagar o vínculo');

  console.log('6 grupos de integração do PMO de processos aprovados. Dados somente no banco descartável.');
}

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
