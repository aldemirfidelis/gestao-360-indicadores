import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProcessArtifactKind, ProcessArtifactState } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  activitySaveSchema, artifactCreateSchema, artifactSaveSchema, artifactTransitionSchema,
  compareProcessActivities, integrationSchema, raciConsistency, raciSchema, sipocSchema,
  type ProcessIntegrationType, type RaciContent, type SipocContent,
} from '@g360/shared';
import type { ZodTypeAny, output } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { AuthPayload } from '../auth/auth.types';
import { ProcessesService } from './processes.service';
import { ProcessLinksService, PROCESS_TARGETS, type ProcessLinkContext } from './process-links.service';
import { EMPTY_BPMN, readBpmn } from './bpmn';

type Tx = Prisma.TransactionClient;
const fullArtifact = {
  activities: { orderBy: { elementId: 'asc' as const }, include: { raciRows: { include: { artifact: { select: { id: true, name: true, state: true } }, assignments: { select: { role: true, subjectSnapshot: true } } } } } },
  raciRows: { orderBy: { position: 'asc' as const }, include: { assignments: true } },
};
const artifactMetadata = { id: true, processId: true, kind: true, name: true, scenario: true, state: true, revision: true, version: true, reviewDueAt: true, updatedAt: true } as const;
const targetColumns = { ACTIVITY: 'activityId', STEP: 'processStepId', PROJECT_TASK: 'projectTaskId', TASK: 'workspaceTaskId', ACTION: 'actionPlanId' } as const;
const subjectColumns = { USER: 'userId', AREA: 'orgNodeId', JOB: 'orgJobId' } as const;

function parse<T extends ZodTypeAny>(schema: T, body: unknown): output<T> {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException(result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  return result.data;
}
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const signature = (value: any) => JSON.stringify(Object.fromEntries(Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b))));

@Injectable()
export class ProcessGovernanceService {
  constructor(private readonly prisma: PrismaService, private readonly processes: ProcessesService, private readonly links: ProcessLinksService, private readonly access: AccessService) {}

  async dashboard(me: AuthPayload) {
    const areas = await this.access.listAreaFilter(me.sub, 'processes', 'view');
    const where: Prisma.ProcessWhereInput = { companyId: me.companyId, deletedAt: null, ...(areas ? { OR: [{ orgNodeId: { in: areas } }, { orgNodeId: null, indicator: { ownerNodeId: { in: areas } } }, { orgNodeId: null, indicatorId: null }] } : {}) };
    const [total, withoutOwner, documented, pendingReview, overdueReview, activitiesWithoutOwner, modelCount] = await Promise.all([
      this.prisma.process.count({ where }),
      this.prisma.process.count({ where: { AND: [where, { ownerUserId: null }] } }),
      this.prisma.process.count({ where: { AND: [where, { artifacts: { some: { state: { not: 'ARCHIVED' }, versions: { some: { state: 'PUBLISHED' } } } } }] } }),
      this.prisma.processArtifact.count({ where: { process: where, state: 'IN_REVIEW' } }),
      this.prisma.processArtifact.count({ where: { process: where, state: { not: 'ARCHIVED' }, reviewDueAt: { lt: new Date() } } }),
      this.prisma.processActivity.count({ where: { process: where, artifact: { state: { not: 'ARCHIVED' } }, active: true, ownerUserId: null, orgNodeId: null, orgJobId: null } }),
      this.prisma.processArtifact.groupBy({ by: ['kind'], where: { process: where, state: { not: 'ARCHIVED' } }, _count: true }),
    ]);
    const records = await this.prisma.process.findMany({ where, select: { id: true, name: true, ownerUserId: true, indicatorId: true, artifacts: { where: { state: { not: 'ARCHIVED' } }, select: { state: true, reviewDueAt: true } } } });
    const integrations = await this.prisma.processIntegration.findMany({ where: { process: where, targetKey: { startsWith: 'INDICATOR:' } }, select: { id: true, processId: true, targetKey: true, indicatorId: true } });
    const operational = await this.prisma.processIntegration.findMany({ where: { process: where, OR: [{ deviationId: { not: null } }, { projectId: { not: null } }] }, select: { id: true, processId: true, targetKey: true, deviationId: true, projectId: true } });
    const rawLinks = [...integrations, ...operational, ...records.filter((record) => record.indicatorId).map((record) => ({ id: `primary:${record.id}`, processId: record.id, targetKey: `INDICATOR:${record.indicatorId}`, indicatorId: record.indicatorId }))];
    const visible = await this.resolveLinks(await this.links.context(me), rawLinks);
    const sourceById = new Map(rawLinks.map((link) => [link.id, link.processId]));
    const outsideTarget = new Set<string>(), openDeviations = new Set<string>(), improvementProjects = new Set<string>();
    for (const link of visible) {
      const processId = sourceById.get(link.id)!;
      if (link.type === 'INDICATOR' && ['RED', 'YELLOW'].includes(link.target.result?.light)) outsideTarget.add(processId);
      if (link.type === 'DEVIATION' && !['CLOSED', 'CLOSED_LATE', 'CANCELLED'].includes(link.target.status)) openDeviations.add(processId);
      if (link.type === 'PROJECT' && !['DONE', 'CANCELLED'].includes(link.target.status)) improvementProjects.add(processId);
    }
    const attention = records.map((record) => ({ id: record.id, name: record.name, reasons: [!record.ownerUserId && 'Sem proprietário', record.artifacts.some((item) => item.state === 'IN_REVIEW') && 'Em revisão', record.artifacts.some((item) => item.reviewDueAt && item.reviewDueAt < new Date()) && 'Revisão vencida', outsideTarget.has(record.id) && 'Indicador fora da meta', openDeviations.has(record.id) && 'Desvio em aberto', improvementProjects.has(record.id) && 'Projeto de melhoria'].filter(Boolean) })).filter((record) => record.reasons.length);
    return { total, withoutOwner, documented, pendingReview, overdueReview, activitiesWithoutOwner, outsideTarget: outsideTarget.size, openDeviations: openDeviations.size, improvementProjects: improvementProjects.size, attention, models: Object.fromEntries(modelCount.map((group) => [group.kind, group._count])) };
  }

  private async scoped(me: AuthPayload, processId: string, action?: 'edit' | 'approve') {
    const process = await this.processes.getById(me, processId);
    if (action) {
      if (process.status === 'ARCHIVED') throw new ConflictException('Reative o processo antes de alterar seus artefatos.');
      if (process.areaId) await this.access.assertCanWrite(me.sub, process.areaId, 'processes', action);
    }
    return process;
  }

  private async load(me: AuthPayload, artifactId: string, action?: 'edit' | 'approve') {
    const artifact = await this.prisma.processArtifact.findFirst({ where: { id: artifactId, process: { companyId: me.companyId, deletedAt: null } }, include: fullArtifact });
    if (!artifact) throw new NotFoundException('Artefato não encontrado.');
    const process = await this.scoped(me, artifact.processId, action);
    return { artifact, process };
  }

  private async lock(tx: Tx, artifactId: string, me: AuthPayload, revision: number, editable = true) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT a.id FROM "ProcessArtifact" a JOIN "Process" p ON p.id = a."processId" WHERE a.id = ${artifactId} AND p."companyId" = ${me.companyId} AND p."deletedAt" IS NULL FOR UPDATE OF a`;
    if (!rows.length) throw new NotFoundException('Artefato não encontrado.');
    const artifact = await tx.processArtifact.findUniqueOrThrow({ where: { id: artifactId }, include: fullArtifact });
    if (artifact.revision !== revision) throw new ConflictException('Outra pessoa alterou este artefato. Recarregue a versão atual antes de salvar.');
    if (editable && artifact.state !== 'DRAFT') throw new ConflictException('Crie uma revisão para editar um artefato em revisão, aprovado, publicado ou arquivado.');
    return artifact;
  }

  private async checkpoint(tx: Tx, artifactId: string, process: any, me: AuthPayload, changeNote: string, action: string) {
    const artifact = await tx.processArtifact.findUniqueOrThrow({ where: { id: artifactId }, include: fullArtifact });
    const version = artifact.version + 1;
    const integrations = await tx.processIntegration.findMany({ where: { processId: process.id, OR: [{ activityId: null, artifactId: null }, { artifactId }, { activity: { artifactId } }] } });
    await tx.processArtifactVersion.create({ data: {
      artifactId, version, state: artifact.state, authorId: me.sub, authorName: me.name, changeNote,
      snapshot: json({ kind: artifact.kind, name: artifact.name, scenario: artifact.scenario, state: artifact.state, reviewDueAt: artifact.reviewDueAt, content: artifact.content, bpmnXml: artifact.bpmnXml, activities: artifact.activities, raciRows: artifact.raciRows, raci: artifact.kind === 'RACI' ? this.raciContent(artifact) : null, integrations, process: { id: process.id, name: process.name, objective: process.objective, orgNode: process.orgNode, owner: process.owner } }),
    } });
    await tx.processArtifact.update({ where: { id: artifactId }, data: { version, revision: { increment: 1 } } });
    await this.audit(tx, process.id, me, action, { artifactId, kind: artifact.kind, version, state: artifact.state, changeNote });
  }

  private async audit(tx: Tx, processId: string, me: AuthPayload, action: string, metadata: Record<string, unknown>) {
    await tx.auditLog.create({ data: { companyId: me.companyId, userId: me.sub, module: 'Processos', entity: 'Process', entityId: processId, action, payload: JSON.stringify(metadata), result: 'SUCCESS' } });
    await tx.traceabilityEvent.create({ data: { companyId: me.companyId, userId: me.sub, entityType: 'PROCESS', entityId: processId, eventType: action === 'CREATE_ARTIFACT' ? 'CREATED' : 'UPDATED', title: action, description: String(metadata.changeNote ?? ''), metadata: json(metadata) } });
  }

  async overview(me: AuthPayload, processId: string) {
    const process = await this.scoped(me, processId);
    const [artifacts, activities, integrations, history] = await Promise.all([
      this.prisma.processArtifact.findMany({ where: { processId }, select: artifactMetadata, orderBy: { updatedAt: 'desc' } }),
      this.prisma.processActivity.findMany({ where: { processId, active: true, artifact: { state: { not: 'ARCHIVED' } } }, include: { artifact: { select: { name: true, scenario: true, state: true, revision: true } } }, orderBy: { name: 'asc' } }),
      this.prisma.processIntegration.findMany({ where: { processId } }),
      this.prisma.traceabilityEvent.findMany({ where: { companyId: me.companyId, OR: [{ entityType: 'PROCESS', entityId: processId }, { relatedType: 'PROCESS', relatedId: processId }] }, orderBy: { occurredAt: 'desc' }, take: 100, select: { id: true, title: true, description: true, occurredAt: true, userId: true, metadata: true } }),
    ]);
    const context = await this.links.context(me);
    const visibleLinks = await this.resolveLinks(context, integrations);
    return { process, artifacts, activities, integrations: visibleLinks, hiddenIntegrations: integrations.length - visibleLinks.length, history,
      metrics: { withoutOwner: activities.filter((activity) => !activity.ownerUserId && !activity.orgNodeId && !activity.orgJobId).length, inReview: artifacts.filter((artifact) => artifact.state === 'IN_REVIEW').length, overdueReview: artifacts.filter((artifact) => artifact.reviewDueAt && artifact.reviewDueAt < new Date() && artifact.state !== 'ARCHIVED').length, indicatorsOffTarget: visibleLinks.filter((link) => link.type === 'INDICATOR' && ['RED', 'YELLOW'].includes(link.target.result?.light)).length },
    };
  }

  private async resolveLinks(context: ProcessLinkContext, integrations: any[]) {
    const result: any[] = [];
    const groups = new Map<ProcessIntegrationType, string[]>();
    for (const integration of integrations) {
      const type = integration.targetKey.split(':')[0] as ProcessIntegrationType;
      if (!this.links.canRead(context, type)) continue;
      groups.set(type, [...(groups.get(type) ?? []), integration[PROCESS_TARGETS[type].field]]);
    }
    const targets = new Map<string, any>();
    for (const [type, ids] of groups) {
      const unique = [...new Set(ids)];
      for (let offset = 0; offset < unique.length; offset += 500) for (const target of await this.links.query(context, type, unique.slice(offset, offset + 500))) targets.set(`${type}:${target.id}`, target);
    }
    for (const integration of integrations) {
      const type = integration.targetKey.split(':')[0] as ProcessIntegrationType;
      const target = targets.get(integration.targetKey);
      if (target) result.push({ id: integration.id, type, activityId: integration.activityId, artifactId: integration.artifactId, label: integration.label, target });
    }
    return result;
  }

  async getArtifact(me: AuthPayload, artifactId: string) {
    const { artifact } = await this.load(me, artifactId);
    const versions = await this.prisma.processArtifactVersion.findMany({ where: { artifactId }, orderBy: { version: 'desc' }, take: 100, select: { id: true, version: true, state: true, changeNote: true, authorName: true, createdAt: true } });
    return { ...artifact, raci: artifact.kind === 'RACI' ? this.raciContent(artifact) : null, versions, validation: await this.validateArtifact(me, artifact) };
  }

  async createArtifact(me: AuthPayload, processId: string, body: unknown) {
    const input = parse(artifactCreateSchema, body);
    const process = await this.scoped(me, processId, 'edit');
    const base = input.basedOnId ? (await this.load(me, input.basedOnId)).artifact : null;
    if (base && (base.processId !== processId || base.kind !== input.kind)) throw new BadRequestException('A versão de origem deve ser do mesmo processo e ferramenta.');
    const legacyParties = (value: string | null) => (value ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((name) => ({ id: randomUUID(), name, type: 'EXTERNAL' as const }));
    const initial = input.kind === 'SIPOC' ? sipocSchema.parse({ suppliers: legacyParties(process.suppliers), inputs: legacyParties(process.inputs).map(({ id, name }) => ({ id, name })), steps: process.steps.map((step: any) => ({ id: randomUUID(), name: step.name, description: step.description ?? '', processStepId: step.id })), outputs: legacyParties(process.outputs).map(({ id, name }) => ({ id, name })), customers: legacyParties(process.customers) }) : {};
    const artifactId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.processArtifact.create({ data: { processId, kind: input.kind, name: input.name, scenario: input.scenario, content: json(base?.content ?? initial), bpmnXml: input.kind === 'BPMN' ? base?.bpmnXml ?? EMPTY_BPMN : null } });
      if (input.kind === 'BPMN') await this.syncActivities(tx, created.id, processId, created.bpmnXml!, base?.activities);
      if (input.kind === 'RACI') {
        const sourceRows: RaciContent['rows'] = base ? this.raciContent(base).rows.map((row) => ({ ...row, id: randomUUID() })) : process.steps.map((step: any) => ({ id: randomUUID(), name: step.name, targetType: 'STEP', targetId: step.id, assignments: [] }));
        await this.saveRaci(tx, created.id, processId, me, { rows: sourceRows });
      }
      await this.checkpoint(tx, created.id, process, me, base ? `Criado a partir de ${base.name}, revisão ${base.revision}.` : 'Artefato criado.', 'CREATE_ARTIFACT');
      return created.id;
    }, { timeout: 30_000 });
    return this.getArtifact(me, artifactId);
  }

  async saveArtifact(me: AuthPayload, artifactId: string, body: unknown) {
    const input = parse(artifactSaveSchema, body);
    const { artifact, process } = await this.load(me, artifactId, 'edit');
    const content = artifact.kind === 'SIPOC' && input.content !== undefined ? parse(sipocSchema, input.content) : null;
    if (content) await this.validateSipocReferences(me, process.id, content);
    const raci = artifact.kind === 'RACI' && input.content !== undefined ? parse(raciSchema, input.content) : null;
    if (artifact.kind !== 'BPMN' && input.bpmnXml !== undefined) throw new BadRequestException('XML é permitido somente no BPMN.');
    if (artifact.kind === 'BPMN' && input.content !== undefined) throw new BadRequestException('Use o XML para salvar o BPMN.');
    if (input.bpmnXml !== undefined) await readBpmn(input.bpmnXml);
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, artifactId, me, input.revision);
      if (raci) await this.saveRaci(tx, artifactId, process.id, me, raci);
      if (content) await this.syncSipocLinks(tx, artifactId, process.id, content);
      if (input.bpmnXml !== undefined) await this.syncActivities(tx, artifactId, process.id, input.bpmnXml);
      await tx.processArtifact.update({ where: { id: artifactId }, data: { ...(input.name ? { name: input.name } : {}), ...(content ? { content: json(content) } : {}), ...(input.bpmnXml !== undefined ? { bpmnXml: input.bpmnXml } : {}), ...(input.reviewDueAt !== undefined ? { reviewDueAt: input.reviewDueAt ? new Date(input.reviewDueAt) : null } : {}) } });
      await this.checkpoint(tx, artifactId, process, me, input.changeNote, 'SAVE_ARTIFACT');
    }, { timeout: 30_000 });
    return this.getArtifact(me, artifactId);
  }

  private async syncActivities(tx: Tx, artifactId: string, processId: string, xml: string, source?: any[]) {
    const parsed = await readBpmn(xml);
    await tx.processActivity.updateMany({ where: { artifactId }, data: { active: false } });
    for (const activity of parsed.activities) {
      const previous = source?.find((item) => item.elementId === activity.elementId);
      const copied = previous ? { description: previous.description, orgNodeId: previous.orgNodeId, ownerUserId: previous.ownerUserId, orgJobId: previous.orgJobId, expectedMinutes: previous.expectedMinutes, slaMinutes: previous.slaMinutes, systems: previous.systems } : {};
      await tx.processActivity.upsert({ where: { artifactId_elementId: { artifactId, elementId: activity.elementId } }, create: { processId, artifactId, ...activity, ...copied }, update: { name: activity.name, elementType: activity.elementType, active: true } });
    }
  }

  private raciContent(artifact: any): RaciContent {
    return { rows: (artifact.raciRows ?? []).map((row: any) => {
      const targetType = (Object.keys(targetColumns) as Array<keyof typeof targetColumns>).find((type) => row[targetColumns[type]]);
      const grouped = new Map<string, any>();
      for (const assignment of row.assignments) {
        const subjectType = (Object.keys(subjectColumns) as Array<keyof typeof subjectColumns>).find((type) => assignment[subjectColumns[type]])!;
        const group = grouped.get(assignment.subjectKey) ?? { subjectType, subjectId: assignment[subjectColumns[subjectType]], roles: [] };
        group.roles.push(assignment.role); grouped.set(assignment.subjectKey, group);
      }
      return { id: row.id, name: row.name, targetType: targetType ?? null, targetId: targetType ? row[targetColumns[targetType]] : null, assignments: [...grouped.values()] };
    }) };
  }

  private async saveRaci(tx: Tx, artifactId: string, processId: string, me: AuthPayload, content: RaciContent) {
    const duplicateIssues = raciConsistency(content).errors.filter((issue) => /repetid/.test(issue));
    if (duplicateIssues.length) throw new BadRequestException(duplicateIssues.join(' '));
    const context = await this.links.context(me);
    const subjectCache = new Map<string, Promise<any>>();
    const prepared: Array<{ row: RaciContent['rows'][number]; assignments: any[] }> = [];
    for (const row of content.rows) {
      const existing = await tx.processRaciRow.findUnique({ where: { id: row.id }, select: { artifactId: true } });
      if (existing && existing.artifactId !== artifactId) throw new BadRequestException('Identificador de atividade pertence a outra matriz.');
      if (row.targetType && row.targetId) {
        if (row.targetType === 'ACTIVITY') {
          if (!await tx.processActivity.findFirst({ where: { id: row.targetId, processId, active: true } })) throw new BadRequestException('Atividade BPMN não pertence ao processo.');
        } else if (row.targetType === 'STEP') {
          if (!await tx.processStep.findFirst({ where: { id: row.targetId, processId } })) throw new BadRequestException('Etapa não pertence ao processo.');
        } else await this.links.requireTarget(context, row.targetType, row.targetId);
      }
      const assignments: any[] = [];
      for (const assignment of row.assignments) {
        const subjectKey = `${assignment.subjectType}:${assignment.subjectId}`;
        if (!subjectCache.has(subjectKey)) subjectCache.set(subjectKey, this.links.subject(me, assignment.subjectType, assignment.subjectId));
        const subject = await subjectCache.get(subjectKey)!;
        for (const role of assignment.roles) assignments.push({ role, subjectKey: `${assignment.subjectType}:${assignment.subjectId}`, [subjectColumns[assignment.subjectType]]: assignment.subjectId, subjectSnapshot: json(subject) });
      }
      prepared.push({ row, assignments });
    }
    await tx.processRaciRow.deleteMany({ where: { artifactId, id: { notIn: content.rows.map((row) => row.id) } } });
    for (const [position, { row, assignments }] of prepared.entries()) {
      const data: any = { name: row.name, position, activityId: null, processStepId: null, projectTaskId: null, workspaceTaskId: null, actionPlanId: null };
      if (row.targetType && row.targetId) data[targetColumns[row.targetType]] = row.targetId;
      await tx.processRaciRow.upsert({ where: { id: row.id }, create: { id: row.id, artifactId, ...data }, update: data });
      await tx.processRaciAssignment.deleteMany({ where: { rowId: row.id } });
      if (assignments.length) await tx.processRaciAssignment.createMany({ data: assignments.map((assignment) => ({ ...assignment, rowId: row.id })) });
    }
    await this.syncArtifactLinks(tx, artifactId, processId, content.rows.filter((row) => row.targetId && row.targetType && !['ACTIVITY', 'STEP'].includes(row.targetType)).map((row) => [row.targetType as ProcessIntegrationType, row.targetId!]));
  }

  async validateArtifact(me: AuthPayload, artifact: any) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const subjects = new Map<string, Promise<any>>();
    const subject = (type: 'USER' | 'AREA' | 'JOB', id: string, allowInactive = false) => {
      const key = `${type}:${id}:${allowInactive}`;
      if (!subjects.has(key)) subjects.set(key, this.links.subject(me, type, id, allowInactive));
      return subjects.get(key)!;
    };
    if (artifact.kind === 'BPMN') {
      const bpmn = await readBpmn(artifact.bpmnXml ?? ''); errors.push(...bpmn.issues);
      for (const activity of artifact.activities ?? []) {
        if (!activity.active) continue;
        if (!activity.ownerUserId && !activity.orgNodeId && !activity.orgJobId) warnings.push(`${activity.name}: responsabilidade operacional ainda não definida.`);
        for (const [type, subjectId] of [['USER', activity.ownerUserId], ['AREA', activity.orgNodeId], ['JOB', activity.orgJobId]] as const) {
          if (!subjectId) continue;
          try { await subject(type, subjectId); } catch (error) { if (error instanceof NotFoundException) errors.push(`${activity.name}: responsável ou área indisponível; revise a atividade.`); else throw error; }
        }
      }
    } else if (artifact.kind === 'SIPOC') {
      const content = parse(sipocSchema, artifact.content);
      for (const column of ['suppliers', 'inputs', 'steps', 'outputs', 'customers'] as const) if (!content[column].length) errors.push(`Preencha a coluna ${column} do SIPOC.`);
      try { await this.validateSipocReferences(me, artifact.processId, content); } catch (error) { if (error instanceof Error) errors.push(error.message); else throw error; }
    } else {
      const consistency = raciConsistency(this.raciContent(artifact)); errors.push(...consistency.errors); warnings.push(...consistency.warnings);
      const context = await this.links.context(me);
      for (const row of artifact.raciRows) {
        if (row.activityId && !await this.prisma.processActivity.findFirst({ where: { id: row.activityId, active: true } })) errors.push(`${row.name}: atividade removida do desenho; revise o vínculo.`);
        for (const [type, field] of [['PROJECT_TASK', 'projectTaskId'], ['TASK', 'workspaceTaskId'], ['ACTION', 'actionPlanId']] as const) {
          if (!row[field]) continue;
          try { await this.links.requireTarget(context, type, row[field]); } catch (error) { if (error instanceof NotFoundException || error instanceof ForbiddenException) errors.push(`${row.name}: registro relacionado indisponível ou fora do escopo; revise o vínculo.`); else throw error; }
        }
        for (const assignment of row.assignments) {
          const type = (Object.keys(subjectColumns) as Array<keyof typeof subjectColumns>).find((key) => assignment[subjectColumns[key]])!;
          try {
            const current = await subject(type, assignment[subjectColumns[type]], true);
            if (!current.active || signature(current) !== signature(assignment.subjectSnapshot)) errors.push(`${row.name}: ${current.name} teve alteração organizacional ou foi inativado. Revise e salve a matriz.`);
          } catch (error) { if (error instanceof NotFoundException) errors.push(`${row.name}: participante indisponível; revise a matriz.`); else throw error; }
        }
      }
    }
    return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
  }

  private async validateSipocReferences(me: AuthPayload, processId: string, content: SipocContent) {
    const context = await this.links.context(me);
    const refs: Array<[ProcessIntegrationType, string]> = [];
    for (const party of [...content.suppliers, ...content.customers]) {
      if (party.orgNodeId) refs.push(['AREA', party.orgNodeId]);
      if (party.relatedProcessId) refs.push(['PROCESS', party.relatedProcessId]);
    }
    for (const item of content.inputs) {
      item.documentIds.forEach((id) => refs.push(['DOCUMENT', id])); item.formTemplateIds.forEach((id) => refs.push(['FORM', id]));
    }
    for (const item of content.outputs) {
      item.indicatorIds.forEach((id) => refs.push(['INDICATOR', id])); item.documentIds.forEach((id) => refs.push(['DOCUMENT', id]));
    }
    for (const step of content.steps) if (step.processStepId && !await this.prisma.processStep.findFirst({ where: { id: step.processStepId, processId } })) throw new BadRequestException('Etapa SIPOC não pertence ao processo.');
    const grouped = new Map<ProcessIntegrationType, string[]>();
    for (const [type, id] of refs) grouped.set(type, [...(grouped.get(type) ?? []), id]);
    for (const [type, ids] of grouped) {
      const unique = [...new Set(ids)];
      if ((await this.links.query(context, type, unique)).length !== unique.length) throw new NotFoundException('Um registro SIPOC não está disponível no seu escopo.');
    }
  }

  private async syncSipocLinks(tx: Tx, artifactId: string, processId: string, content: SipocContent) {
    const refs: Array<[ProcessIntegrationType, string]> = [];
    for (const party of [...content.suppliers, ...content.customers]) {
      if (party.orgNodeId) refs.push(['AREA', party.orgNodeId]);
      if (party.relatedProcessId) refs.push(['PROCESS', party.relatedProcessId]);
    }
    for (const item of content.inputs) { item.documentIds.forEach((id) => refs.push(['DOCUMENT', id])); item.formTemplateIds.forEach((id) => refs.push(['FORM', id])); }
    for (const item of content.outputs) { item.indicatorIds.forEach((id) => refs.push(['INDICATOR', id])); item.documentIds.forEach((id) => refs.push(['DOCUMENT', id])); }
    await this.syncArtifactLinks(tx, artifactId, processId, refs);
  }

  private async syncArtifactLinks(tx: Tx, artifactId: string, processId: string, refs: Array<[ProcessIntegrationType, string]>) {
    await tx.processIntegration.deleteMany({ where: { artifactId, activityId: null } });
    const unique = new Map(refs.map((ref) => [`${ref[0]}:${ref[1]}`, ref]));
    for (const [targetKey, [type, targetId]] of unique) await tx.processIntegration.create({ data: { processId, artifactId, scopeKey: `ARTIFACT:${artifactId}`, targetKey, [PROCESS_TARGETS[type].field]: targetId } });
  }

  async transition(me: AuthPayload, artifactId: string, body: unknown) {
    const input = parse(artifactTransitionSchema, body);
    const context = await this.links.context(me);
    const permission = input.action === 'APPROVE' ? 'processes:approve' : input.action === 'PUBLISH' ? 'processes:publish' : input.action === 'ARCHIVE' ? 'processes:delete' : 'processes:update';
    if (!context.admin && !context.permissions.has(permission) && !context.permissions.has('processes:manage')) throw new ForbiddenException('Sem permissão para esta ação de governança.');
    const { process } = await this.load(me, artifactId, ['APPROVE', 'PUBLISH'].includes(input.action) ? 'approve' : 'edit');
    await this.prisma.$transaction(async (tx) => {
      const artifact = await this.lock(tx, artifactId, me, input.revision, false);
      const allowed: Record<string, ProcessArtifactState[]> = { SUBMIT: ['DRAFT'], APPROVE: ['IN_REVIEW'], PUBLISH: ['APPROVED'], REVISE: ['IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'], ARCHIVE: ['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED'] };
      if (!allowed[input.action].includes(artifact.state)) throw new ConflictException('Transição não permitida no estado atual.');
      if (['SUBMIT', 'APPROVE', 'PUBLISH'].includes(input.action)) {
        const validation = await this.validateArtifact(me, artifact);
        if (!process.ownerUserId) validation.errors.push('Defina o proprietário do processo.');
        else {
          try { await this.links.subject(me, 'USER', process.ownerUserId); } catch (error) { if (error instanceof NotFoundException) validation.errors.push('Revise o proprietário do processo; ele está inativo ou fora do escopo.'); else throw error; }
        }
        if (validation.errors.length) throw new BadRequestException(validation.errors.join(' '));
      }
      const states: Record<string, ProcessArtifactState> = { SUBMIT: 'IN_REVIEW', APPROVE: 'APPROVED', PUBLISH: 'PUBLISHED', REVISE: 'DRAFT', ARCHIVE: 'ARCHIVED' };
      await tx.processArtifact.update({ where: { id: artifactId }, data: { state: states[input.action] } });
      await this.checkpoint(tx, artifactId, process, me, input.changeNote, input.action);
      if (input.action === 'SUBMIT' && process.ownerUserId && process.ownerUserId !== me.sub) await tx.notification.create({ data: { companyId: me.companyId, userId: process.ownerUserId, kind: 'ACTION_DUE_SOON', title: `Revisão de processo: ${process.name}`, body: input.changeNote, link: `/processes/${process.id}?artifact=${artifact.id}` } });
    }, { timeout: 30_000 });
    return this.getArtifact(me, artifactId);
  }

  async version(me: AuthPayload, artifactId: string, versionId: string) {
    await this.load(me, artifactId);
    const version = await this.prisma.processArtifactVersion.findFirst({ where: { id: versionId, artifactId } });
    if (!version) throw new NotFoundException('Versão não encontrada.');
    return version;
  }

  async versions(me: AuthPayload, artifactId: string, before?: string) {
    await this.load(me, artifactId);
    const number = before === undefined ? undefined : Number(before);
    if (number !== undefined && (!Number.isSafeInteger(number) || number < 1)) throw new BadRequestException('Número de versão inválido.');
    return this.prisma.processArtifactVersion.findMany({ where: { artifactId, ...(number ? { version: { lt: number } } : {}) }, orderBy: { version: 'desc' }, take: 100, select: { id: true, version: true, state: true, changeNote: true, authorName: true, createdAt: true } });
  }

  async compare(me: AuthPayload, firstId: string, secondId: string) {
    const first = (await this.load(me, firstId)).artifact;
    const second = (await this.load(me, secondId)).artifact;
    if (first.kind !== 'BPMN' || second.kind !== 'BPMN' || first.processId !== second.processId) throw new BadRequestException('Compare dois BPMNs do mesmo processo.');
    return compareProcessActivities(first.activities.filter((activity) => activity.active), second.activities.filter((activity) => activity.active));
  }

  async saveActivity(me: AuthPayload, activityId: string, body: unknown) {
    const input = parse(activitySaveSchema, body);
    const activity = await this.prisma.processActivity.findFirst({ where: { id: activityId, process: { companyId: me.companyId, deletedAt: null }, active: true } });
    if (!activity) throw new NotFoundException('Atividade não encontrada.');
    const { process } = await this.load(me, activity.artifactId, 'edit');
    if (input.orgNodeId) await this.links.subject(me, 'AREA', input.orgNodeId);
    if (input.ownerUserId) await this.links.subject(me, 'USER', input.ownerUserId);
    if (input.orgJobId) await this.links.subject(me, 'JOB', input.orgJobId);
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, activity.artifactId, me, input.revision);
      const { revision, ...data } = input;
      await tx.processActivity.update({ where: { id: activityId }, data });
      await this.checkpoint(tx, activity.artifactId, process, me, 'Propriedades da atividade atualizadas.', 'UPDATE_ACTIVITY');
    }, { timeout: 30_000 });
    return this.getArtifact(me, activity.artifactId);
  }

  async addIntegration(me: AuthPayload, processId: string, body: unknown) {
    const input = parse(integrationSchema, body);
    const process = await this.scoped(me, processId, 'edit');
    const context = await this.links.context(me);
    await this.links.requireTarget(context, input.type, input.targetId);
    if (input.type === 'PROCESS' && input.targetId === processId) throw new BadRequestException('O processo não pode ser relacionado a si mesmo.');
    const activity = input.activityId ? await this.prisma.processActivity.findFirst({ where: { id: input.activityId, processId, active: true }, include: { artifact: true } }) : null;
    if (input.activityId && !activity) throw new BadRequestException('Atividade não pertence ao processo.');
    if (activity && activity.artifact.state !== 'DRAFT') throw new ConflictException('Revise o BPMN antes de alterar vínculos da atividade.');
    await this.prisma.$transaction(async (tx) => {
      if (activity) await this.lock(tx, activity.artifactId, me, activity.artifact.revision);
      const scopeKey = input.activityId ?? 'PROCESS';
      const targetKey = `${input.type}:${input.targetId}`;
      await tx.processIntegration.upsert({ where: { processId_scopeKey_targetKey: { processId, scopeKey, targetKey } }, create: { processId, activityId: input.activityId ?? null, scopeKey, targetKey, label: input.label, [PROCESS_TARGETS[input.type].field]: input.targetId }, update: { label: input.label } });
      if (activity) await this.checkpoint(tx, activity.artifactId, process, me, 'Vínculo da atividade atualizado.', 'LINK_ACTIVITY');
      else await this.audit(tx, processId, me, 'LINK_PROCESS', { type: input.type, targetId: input.targetId });
    }, { timeout: 30_000 });
    return this.overview(me, processId);
  }

  async removeIntegration(me: AuthPayload, integrationId: string) {
    const integration = await this.prisma.processIntegration.findFirst({ where: { id: integrationId, process: { companyId: me.companyId, deletedAt: null } }, include: { activity: { include: { artifact: true } } } });
    if (!integration) throw new NotFoundException('Vínculo não encontrado.');
    if (integration.artifactId) throw new ConflictException('Este vínculo pertence ao SIPOC ou à RACI. Revise o artefato de origem para alterá-lo.');
    const process = await this.scoped(me, integration.processId, 'edit');
    await this.prisma.$transaction(async (tx) => {
      if (integration.activity) await this.lock(tx, integration.activity.artifactId, me, integration.activity.artifact.revision);
      await tx.processIntegration.delete({ where: { id: integrationId } });
      if (integration.activity) await this.checkpoint(tx, integration.activity.artifactId, process, me, 'Vínculo da atividade removido.', 'UNLINK_ACTIVITY');
      else await this.audit(tx, process.id, me, 'UNLINK_PROCESS', { targetKey: integration.targetKey });
    }, { timeout: 30_000 });
    return { ok: true };
  }

  async related(me: AuthPayload, type: ProcessIntegrationType, targetId: string) {
    parse(integrationSchema, { type, targetId });
    const context = await this.links.context(me);
    await this.links.requireTarget(context, type, targetId);
    const targetWhere = type === 'PROJECT' ? { OR: [{ projectId: targetId }, { projectTask: { projectId: targetId } }, { workspaceTask: { projectId: targetId } }] } : { [PROCESS_TARGETS[type].field]: targetId };
    const integrations = await this.prisma.processIntegration.findMany({ where: { ...targetWhere, process: { companyId: me.companyId, deletedAt: null } }, include: { process: { select: { id: true, name: true, orgNodeId: true, indicator: { select: { ownerNodeId: true } } } }, activity: { select: { id: true, name: true } } }, take: 100 });
    const areas = await this.access.listAreaFilter(me.sub, 'processes', 'view');
    const result = integrations.filter((link) => !areas || !(link.process.orgNodeId ?? link.process.indicator?.ownerNodeId) || areas.includes((link.process.orgNodeId ?? link.process.indicator?.ownerNodeId)!)).map((link) => ({ id: link.id, process: { id: link.process.id, name: link.process.name }, activity: link.activity, href: `/processes/${link.processId}` }));
    if (type === 'INDICATOR' || type === 'AREA') {
      const legacy = await this.processes.list(me, type === 'INDICATOR' ? { indicatorId: targetId } : { orgNodeId: targetId });
      for (const process of legacy) if (!result.some((item) => item.process.id === process.id)) result.push({ id: `process:${process.id}`, process: { id: process.id, name: process.name }, activity: null, href: `/processes/${process.id}` });
    }
    return result;
  }

  async targets(me: AuthPayload, type: ProcessIntegrationType, search?: string, selected: string[] = []) {
    if (selected.length > 100) throw new BadRequestException('Selecione até 100 registros.');
    for (const targetId of selected) parse(integrationSchema, { type, targetId });
    const context = await this.links.context(me);
    const types = (Object.keys(PROCESS_TARGETS) as ProcessIntegrationType[]).filter((key) => this.links.canRead(context, key));
    const [items, selectedItems] = await Promise.all([type ? this.links.query(context, type, undefined, search) : [], selected.length ? this.links.query(context, type, selected) : []]);
    return { types, items, selectedItems };
  }

  async subjects(me: AuthPayload, search = '') {
    const areas = await this.access.listAreaFilter(me.sub, 'processes', 'view');
    const term = search.trim().slice(0, 120);
    const [users, orgNodes, jobs] = await Promise.all([
      this.prisma.user.findMany({ where: { companyId: me.companyId, active: true, deletedAt: null, ...(areas ? { defaultNodeId: { in: areas } } : {}), ...(term ? { name: { contains: term, mode: 'insensitive' } } : {}) }, take: 100, select: { id: true, name: true, defaultNodeId: true }, orderBy: { name: 'asc' } }),
      this.prisma.orgNode.findMany({ where: { companyId: me.companyId, active: true, deletedAt: null, ...(areas ? { id: { in: areas } } : {}), ...(term ? { name: { contains: term, mode: 'insensitive' } } : {}) }, take: 100, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.orgJob.findMany({ where: { companyId: me.companyId, active: true, ...(areas ? { employees: { some: { orgNodeId: { in: areas }, status: 'ACTIVE' } } } : {}), ...(term ? { name: { contains: term, mode: 'insensitive' } } : {}) }, take: 100, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    return [...users.map((item) => ({ ...item, subjectType: 'USER' })), ...orgNodes.map((item) => ({ ...item, subjectType: 'AREA' })), ...jobs.map((item) => ({ ...item, subjectType: 'JOB' }))];
  }
}
