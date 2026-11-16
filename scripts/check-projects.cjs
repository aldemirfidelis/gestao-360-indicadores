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
  console.log('PASS: migração, medição inicial, avanço, marcos, isolamento, concorrência, dependências, quadro de tarefas e rollback.');
}

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
