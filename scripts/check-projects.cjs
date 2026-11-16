'use strict';
// Ensaio de integração: somente Postgres descartável, nunca a base do produto.
require('reflect-metadata');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const { ProjectsService } = require('./dist/src/modules/projects/projects.service');
const { TasksService } = require('./dist/src/modules/tasks/tasks.service');
const { projectProgress, projectMeasurementDay } = require('@g360/shared');
const db = new PrismaClient();

async function run() {
  const url = new URL(process.env.DATABASE_URL);
  assert.equal(url.hostname, 'localhost');
  assert.equal(url.pathname, '/g360_projects_review');
  assert.equal(process.env.PROJECTS_REVIEW_ISOLATED, '1');
  const a = await db.company.create({ data: { name: 'Projeto fictício A' } });
  const b = await db.company.create({ data: { name: 'Projeto fictício B' } });
  const legacy = await db.project.create({ data: {
    companyId: a.id, name: 'Projeto anterior à curva', startsAt: new Date('2026-01-01'), endsAt: new Date('2026-12-31'),
    tasks: { create: [{ name: 'Etapa 1', progress: 20 }, { name: 'Etapa 2', progress: 80 }] },
    milestones: { create: [{ name: 'Entrega 1', dueDate: new Date('2026-06-01'), done: true }, { name: 'Entrega 2', dueDate: new Date('2026-12-01') }] },
  } });
  const foreign = await db.project.create({ data: { companyId: b.id, name: 'Outra empresa' } });
  const removed = await db.project.create({ data: { companyId: a.id, name: 'Removido', deletedAt: new Date() } });
  const sql = fs.readFileSync('/review/migration.sql', 'utf8').split('-- Primeira medição')[1];
  await db.$executeRawUnsafe(sql.slice(sql.indexOf('INSERT INTO')));
  const baseline = await db.projectProgressSnapshot.findFirst({ where: { projectId: legacy.id } });
  assert.equal(baseline.progress, 50);
  assert.equal(baseline.measuredOn.toISOString(), projectMeasurementDay().toISOString());
  assert.equal(await db.projectProgressSnapshot.count({ where: { projectId: removed.id } }), 0);
  const me = { sub: 'review', companyId: a.id, name: 'Revisor', email: 'review@example.test', role: 'ANALYST' };
  const access = { listAreaFilter: async () => null, assertCanWrite: async () => {} };
  const service = new ProjectsService(db, access);
  assert.equal((await service.getById(me, legacy.id)).curve.historyStartsOn, baseline.measuredOn.toISOString());
  await assert.rejects(service.getById(me, foreign.id), /Projeto não encontrado/);

  const project = await service.create(me, { name: 'Novo projeto', startsAt: '2026-01-01', endsAt: '2026-12-31' });
  const t1 = await service.addTask(me, project.id, { name: 'Uma tarefa', startDate: '2026-01-01', endDate: '2026-12-31' });
  await service.updateTask(me, t1.id, { progress: 50 });
  const milestone = await service.addMilestone(me, project.id, 'Entrega', '2026-12-31');
  await service.toggleMilestone(me, milestone.id, true);
  const detail = await service.getById(me, project.id);
  assert.equal(detail.progressOverall, 75);
  assert.equal(detail.progressSnapshots.length, 1);
  assert.equal(detail.progressSnapshots[0].progress, 75);
  assert.equal(detail.curve.points.find((point) => point.date === detail.curve.measuredOn).actual, 75);

  // Dois escritores simultâneos devem produzir uma medição coerente com os dados finais.
  const t2 = await service.addTask(me, project.id, { name: 'Segunda tarefa' });
  await Promise.all([service.updateTask(me, t1.id, { progress: 100 }), service.updateTask(me, t2.id, { progress: 60 })]);
  const concurrent = await service.getById(me, project.id);
  assert.equal(concurrent.progressOverall, 90);
  assert.equal(concurrent.progressSnapshots[0].progress, projectProgress(concurrent));
  const otherTask = await db.projectTask.create({ data: { projectId: foreign.id, name: 'Tarefa externa' } });
  await assert.rejects(service.updateTask(me, t1.id, { dependencyId: otherTask.id }), /mesmo projeto/);
  await service.updateTask(me, t2.id, { dependencyId: t1.id });
  await assert.rejects(service.updateTask(me, t1.id, { dependencyId: t2.id }), /ciclo/);

  // Uma falha na medição precisa reverter também o avanço da tarefa.
  await db.$executeRawUnsafe('ALTER TABLE "ProjectProgressSnapshot" ADD CONSTRAINT review_fail CHECK (progress < 90) NOT VALID');
  await assert.rejects(service.updateTask(me, t2.id, { progress: 100 }));
  assert.equal((await db.projectTask.findUnique({ where: { id: t2.id } })).progress, 60);
  await db.$executeRawUnsafe('ALTER TABLE "ProjectProgressSnapshot" DROP CONSTRAINT review_fail');
  await service.removeTask(me, t2.id);
  const final = await service.getById(me, project.id);
  assert.equal(final.progressOverall, 100);
  assert.equal(final.progressSnapshots[0].progress, 100);
  await service.updateTask(me, t1.id, { progress: 40 });
  const board = new TasksService(db, null);
  await board.propagateSourceStatus({ automationRuleId: 'PROJECT_TASK', sourceEntityId: t1.id }, 'DONE', me);
  const fromBoard = await service.getById(me, project.id);
  assert.equal(fromBoard.progressOverall, 100);
  assert.equal(fromBoard.progressSnapshots[0].progress, 100);
  await board.propagateSourceStatus({ automationRuleId: 'PROJECT_TASK', sourceEntityId: otherTask.id }, 'DONE', me);
  assert.equal((await db.projectTask.findUnique({ where: { id: otherTask.id } })).progress, 0);
  assert.equal((await db.projectTask.findUnique({ where: { id: otherTask.id } })).projectId, foreign.id);
  assert.ok((await db.projectTask.findUnique({ where: { id: t1.id } })).completedAt, 'conclusão pelo quadro registra a data');

  // Gestão completa: código, gerente, equipe, custos, riscos, status report, reordenação e duplicação.
  const user = await db.user.create({ data: { companyId: a.id, email: `gerente-${a.id}@example.test`, passwordHash: 'x', name: 'Gerente Fictício' } });
  const outsider = await db.user.create({ data: { companyId: b.id, email: `externo-${b.id}@example.test`, passwordHash: 'x', name: 'Pessoa de Outra Empresa' } });
  assert.match((await db.project.findUnique({ where: { id: project.id } })).code, /^PRJ-\d{4}$/);
  const full = await service.create(me, {
    name: 'Projeto completo', startsAt: '2026-01-01', endsAt: '2026-06-30', budget: 1000, priority: 'HIGH',
    category: 'Melhoria', managerId: user.id, objective: 'Validar o módulo', status: 'IN_PROGRESS',
  });
  assert.notEqual(full.code, (await db.project.findUnique({ where: { id: project.id } })).code);
  assert.equal(full.responsible, 'Gerente Fictício');
  assert.ok(full.actualStartAt);
  await assert.rejects(service.create(me, { name: 'Código repetido', code: full.code }), /código/);
  await assert.rejects(service.create(me, { name: 'Gerente externo', managerId: outsider.id }), /pessoa inválida/);
  await assert.rejects(service.update(me, full.id, { endsAt: '2025-12-31' }), /anterior ao início/);
  const [parallelA, parallelB] = await Promise.all([service.create(me, { name: 'Paralelo A' }), service.create(me, { name: 'Paralelo B' })]);
  assert.notEqual(parallelA.code, parallelB.code);

  const first = await service.addTask(me, full.id, { name: 'Planejar', phase: 'Planejamento', startDate: '2026-01-01', endDate: '2026-01-31', assigneeId: user.id });
  const second = await service.addTask(me, full.id, { name: 'Executar', phase: 'Execução', startDate: '2026-02-01', endDate: '2026-05-31', dependencyId: first.id });
  assert.equal(first.responsible, 'Gerente Fictício');
  assert.equal(second.position, first.position + 1);
  await service.reorderTasks(me, full.id, [second.id, first.id]);
  assert.deepEqual((await service.getById(me, full.id)).tasks.map((task) => task.id), [second.id, first.id]);
  await assert.rejects(service.reorderTasks(me, full.id, [first.id]), /todas as tarefas/);
  const gate = await service.addMilestone(me, full.id, 'Aprovação', '2026-03-01', 'Critério de aceite');
  await service.updateMilestone(me, gate.id, { name: 'Aprovação final', dueDate: '2026-03-15' });

  const member = await service.addMember(me, full.id, { userId: user.id, role: 'Líder', allocation: 50 });
  await assert.rejects(service.addMember(me, full.id, { userId: user.id }), /já faz parte/);
  await assert.rejects(service.addMember(me, full.id, { userId: outsider.id }), /pessoa inválida/);
  await service.addMember(me, full.id, { name: 'Consultor externo' });
  await service.updateMember(me, member.id, { allocation: 80 });

  await service.addCost(me, full.id, { kind: 'PLANNED', description: 'Consultoria prevista', amount: 900, date: '2026-01-10', category: 'Serviços' });
  const spent = await service.addCost(me, full.id, { kind: 'ACTUAL', description: 'Consultoria paga', amount: 700, date: '2026-02-10', category: 'Serviços' });
  await service.addCost(me, full.id, { description: 'Material', amount: 500, date: '2026-02-12' });
  await assert.rejects(service.addCost(me, full.id, { description: 'Negativo', amount: -1, date: '2026-02-12' }), /maior que zero/);
  await service.updateCost(me, spent.id, { amount: 600 });

  const risk = await service.addRisk(me, full.id, { title: 'Atraso do fornecedor', probability: 4, impact: 5, ownerId: user.id });
  const issue = await service.addRisk(me, full.id, { kind: 'ISSUE', title: 'Licença pendente' });
  await service.updateRisk(me, issue.id, { status: 'RESOLVED' });
  assert.ok((await db.projectRisk.findUnique({ where: { id: issue.id } })).resolvedAt);
  await assert.rejects(db.projectRisk.update({ where: { id: risk.id }, data: { probability: 9 } }));

  await service.updateTask(me, first.id, { progress: 100 });
  const report = await service.addUpdate(me, full.id, { health: 'YELLOW', summary: 'Planejamento concluído', nextSteps: 'Executar' });
  assert.equal(report.authorName, 'Revisor');

  const complete = await service.getById(me, full.id);
  assert.equal(report.progress, complete.progressOverall);
  assert.deepEqual(complete.finance, { budget: 1000, plannedCost: 900, actualCost: 1100, balance: -100, consumedPct: 110, overBudget: true });
  assert.equal(complete.openRisks, 1);
  assert.equal(complete.openIssues, 0);
  assert.equal(complete.latestHealth, 'YELLOW');
  assert.equal(complete.members.length, 2);
  assert.equal(complete.manager.name, 'Gerente Fictício');
  const listed = (await service.list(me, { priority: 'HIGH', managerId: user.id })).find((item) => item.id === full.id);
  assert.equal(listed.finance.actualCost, 1100);
  assert.equal(listed.costs, undefined);
  const summary = await service.portfolio(me, { search: full.code });
  assert.equal(summary.totalProjects, 1);
  assert.equal(summary.actualCost, 1100);
  assert.equal(summary.overBudget, 1);
  assert.equal((await service.options(me)).categories.includes('Melhoria'), true);
  assert.equal((await service.options(me)).people.some((person) => person.id === outsider.id), false);

  const copy = await service.duplicate(me, full.id, { startsAt: '2026-07-01' });
  const copied = await service.getById(me, copy.id);
  assert.notEqual(copied.code, complete.code);
  assert.equal(copied.status, 'PLANNED');
  assert.equal(copied.progressOverall, 0);
  assert.equal(copied.tasks.length, 2);
  assert.equal(copied.milestones.length, 1);
  assert.equal(copied.members.length, 2);
  assert.equal(copied.costs.length + copied.projectRisks.length + copied.updates.length, 0);
  assert.equal(copied.startsAt.toISOString().slice(0, 10), '2026-07-01');
  const copiedSecond = copied.tasks.find((task) => task.name === 'Executar');
  assert.equal(copiedSecond.dependency.name, 'Planejar');
  assert.notEqual(copiedSecond.dependencyId, first.id);
  await assert.rejects(service.duplicate(me, foreign.id, {}), /Projeto não encontrado/);

  // Registros filhos de outra empresa não são alcançados; excluir o projeto preserva os dados (exclusão lógica).
  const foreignCost = await db.projectCost.create({ data: { projectId: foreign.id, description: 'Externo', amount: 1, date: new Date('2026-01-01') } });
  await assert.rejects(service.updateCost(me, foreignCost.id, { amount: 2 }), /não encontrado/);
  await assert.rejects(service.removeCost(me, foreignCost.id), /não encontrado/);
  await service.removeRisk(me, risk.id);
  await service.removeUpdate(me, report.id);
  await service.removeMember(me, member.id);
  await service.removeMilestone(me, gate.id);
  await service.remove(me, full.id);
  await assert.rejects(service.getById(me, full.id), /Projeto não encontrado/);
  assert.equal(await db.projectCost.count({ where: { projectId: full.id } }), 3);
  console.log('PASS: migração, medição inicial, avanço, marcos, isolamento, concorrência, dependências, quadro de tarefas, rollback e gestão completa (código, equipe, custos, riscos, status report, duplicação).');
}

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
