import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActionAiSuggestionStatus,
  ActionAnalysisTool,
  ActionEffectivenessStatus,
  ActionOrigin,
  ActionPriority,
  ActionStatus,
  ActionStepStatus,
  ActionToolStatus,
  MeetingFormat,
  MeetingKind,
  MeetingParticipantRole,
  MeetingStatus,
  Prisma,
  TraceEntityType,
  TraceEventType,
  TreatmentStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TraceabilityService } from '../traceability/traceability.service';
import { WorkItemEventBus } from '../my-day/work-item-event-bus';
import { GeminiService } from '../ai/gemini.service';
import { AccessService } from '../access/access.service';

interface ActionFilter {
  companyId: string;
  enforceUserId?: string;
  status?: ActionStatus;
  responsibleUserId?: string;
  ownerNodeId?: string;
  indicatorId?: string;
  strategicObjectiveId?: string;
  effectivenessStatus?: ActionEffectivenessStatus;
  overdue?: boolean;
  origin?: string;
  search?: string;
}

const finalStatuses: ActionStatus[] = [
  ActionStatus.DONE,
  ActionStatus.DONE_LATE,
  ActionStatus.CANCELLED,
  ActionStatus.EFFECTIVE,
  ActionStatus.INEFFECTIVE,
];

@Injectable()
export class ActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityService,
    private readonly gemini: GeminiService,
    private readonly access: AccessService,
    private readonly workItemBus: WorkItemEventBus,
  ) {}

  async list(f: ActionFilter) {
    const where: Prisma.ActionPlanWhereInput = {
      companyId: f.companyId,
      deletedAt: null,
      ...(f.status ? { status: f.status } : {}),
      ...(f.responsibleUserId ? { responsibleUserId: f.responsibleUserId } : {}),
      ...(f.ownerNodeId ? { ownerNodeId: f.ownerNodeId } : {}),
      ...(f.indicatorId ? { indicatorId: f.indicatorId } : {}),
      ...(f.strategicObjectiveId ? { strategicObjectiveId: f.strategicObjectiveId } : {}),
      ...(f.effectivenessStatus ? { effectivenessStatus: f.effectivenessStatus } : {}),
      ...(f.origin ? { origin: f.origin as ActionOrigin } : {}),
      ...(f.search
        ? {
            OR: [
              { title: { contains: f.search, mode: 'insensitive' } },
              { description: { contains: f.search, mode: 'insensitive' } },
              { problemDescription: { contains: f.search, mode: 'insensitive' } },
              { rootCause: { contains: f.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(f.overdue
        ? {
            dueDate: { lt: new Date() },
            status: { notIn: finalStatuses },
          }
        : {}),
    };
    // Restrição por área (visibilidade). null = sem restrição (admin/diretor/flag off).
    if (f.enforceUserId) {
      const permitted = await this.access.listAreaFilter(f.enforceUserId, 'action_plans', 'view');
      if (permitted !== null) {
        const eff = f.ownerNodeId ? permitted.filter((id) => id === f.ownerNodeId) : permitted;
        if (eff.length === 0) return [];
        where.ownerNodeId = { in: eff };
      }
    }
    return this.prisma.actionPlan.findMany({
      where,
      include: this.listInclude(),
      orderBy: [{ priority: 'desc' }, { criticality: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async options(companyId: string) {
    const [users, orgNodes, branches, indicators, deviations, meetings, strategicObjectives] = await Promise.all([
      this.prisma.user.findMany({
        where: { companyId, deletedAt: null, active: true },
        select: { id: true, name: true, email: true, jobTitle: true, defaultNodeId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.orgNode.findMany({
        where: { companyId, deletedAt: null, active: true },
        select: { id: true, name: true, type: true, branchId: true, parentId: true },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.branch.findMany({
        where: { companyId, deletedAt: null, active: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.indicator.findMany({
        where: { companyId, deletedAt: null },
        select: {
          id: true,
          name: true,
          code: true,
          ownerNodeId: true,
          strategicObjectiveId: true,
          responsibleUserId: true,
          results: {
            orderBy: { periodDate: 'desc' },
            take: 6,
            select: { id: true, periodRef: true, value: true, light: true, attainment: true, deviationPct: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.deviation.findMany({
        where: { companyId, deletedAt: null },
        select: { id: true, number: true, title: true, indicatorId: true, method: true, rootCause: true, status: true },
        orderBy: { openedAt: 'desc' },
        take: 150,
      }),
      this.prisma.meeting.findMany({
        where: { companyId, deletedAt: null },
        select: { id: true, title: true, indicatorId: true, deviationId: true, analysisId: true, treatmentId: true, startsAt: true },
        orderBy: { startsAt: 'desc' },
        take: 150,
      }),
      this.prisma.strategicObjective.findMany({
        where: { map: { companyId }, deletedAt: null, active: true },
        select: { id: true, name: true, perspective: { select: { id: true, name: true } }, ownerNodeId: true },
        orderBy: [{ perspective: { position: 'asc' } }, { position: 'asc' }, { name: 'asc' }],
      }),
    ]);

    return {
      users,
      orgNodes,
      branches,
      indicators,
      deviations,
      meetings,
      strategicObjectives,
      statuses: Object.values(ActionStatus),
      priorities: Object.values(ActionPriority),
      origins: Object.values(ActionOrigin),
      analysisTools: Object.values(ActionAnalysisTool),
      effectivenessStatuses: Object.values(ActionEffectivenessStatus),
    };
  }

  async getById(id: string, companyId?: string) {
    const action = await this.prisma.actionPlan.findFirst({
      where: { id, deletedAt: null, ...(companyId ? { companyId } : {}) },
      include: this.detailInclude(),
    });
    if (!action) throw new NotFoundException('Ação nao encontrada');
    return {
      ...action,
      originTrail: this.buildOriginTrail(action),
      aiReadiness: this.assessActionReadiness(action),
    };
  }

  async create(input: any, createdById: string) {
    const inferred = await this.inferLinks(input);
    const ownerNodeId = input.ownerNodeId ?? inferred.ownerNodeId ?? null;
    // Só pode criar plano de ação na própria área (ou área autorizada).
    await this.access.assertCanWrite(createdById, ownerNodeId, 'action_plans', 'create');
    const action = await this.prisma.actionPlan.create({
      data: {
        companyId: input.companyId,
        branchId: input.branchId ?? inferred.branchId ?? null,
        strategicObjectiveId: input.strategicObjectiveId ?? inferred.strategicObjectiveId ?? null,
        indicatorId: input.indicatorId ?? inferred.indicatorId ?? null,
        indicatorResultId: input.indicatorResultId ?? inferred.indicatorResultId ?? null,
        deviationId: input.deviationId ?? inferred.deviationId ?? null,
        analysisId: input.analysisId ?? inferred.analysisId ?? null,
        meetingId: input.meetingId ?? inferred.meetingId ?? null,
        treatmentId: input.treatmentId ?? inferred.treatmentId ?? null,
        ownerNodeId,
        title: input.title,
        description: input.description ?? null,
        problemDescription: input.problemDescription ?? inferred.problemDescription ?? null,
        origin: input.origin,
        originRefId: input.originRefId ?? null,
        analysisTool: input.analysisTool ?? inferred.analysisTool ?? null,
        rootCause: input.rootCause ?? inferred.rootCause ?? null,
        responsibleUserId: input.responsibleUserId ?? inferred.responsibleUserId ?? null,
        priority: input.priority,
        criticality: input.criticality ?? input.priority,
        status: input.status,
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
        estimatedCost: input.estimatedCost ?? null,
        expectedResult: input.expectedResult ?? null,
        achievedResult: input.achievedResult ?? null,
        evidenceRequired: input.evidenceRequired ?? true,
        createdById,
      },
    });

    await this.recordHistory(action.id, createdById, 'CREATE', null, null, action.title);
    await this.audit(action.companyId, createdById, 'CREATE', 'ActionPlan', action.id, null, action);
    await this.traceability.record({
      companyId: action.companyId,
      indicatorId: action.indicatorId,
      userId: createdById,
      eventType: TraceEventType.ACTION_CREATED,
      entityType: TraceEntityType.ACTION_PLAN,
      entityId: action.id,
      title: 'Plano de ação criado',
      description: action.title,
      statusTo: action.status,
      metadata: {
        origin: action.origin,
        priority: action.priority,
        criticality: action.criticality,
        dueDate: action.dueDate,
        analysisTool: action.analysisTool,
      },
    });
    this.workItemBus.markDirty(action.companyId, [action.responsibleUserId], 'action.created');
    return action;
  }

  async createMeetingForAction(
    actionId: string,
    body: { startsAt?: string; title?: string; location?: string; format?: MeetingFormat; objective?: string },
    userId?: string,
  ) {
    const action = await this.prisma.actionPlan.findUnique({
      where: { id: actionId },
      include: { meeting: true },
    });
    if (!action || action.deletedAt) throw new NotFoundException('AÃ§Ã£o nao encontrada');
    if (action.meetingId && action.meeting) return this.getById(actionId);

    const startsAt = body.startsAt ? new Date(body.startsAt) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    const meeting = await this.prisma.meeting.create({
      data: {
        companyId: action.companyId,
        indicatorId: action.indicatorId ?? null,
        deviationId: action.deviationId ?? null,
        analysisId: action.analysisId ?? null,
        treatmentId: action.treatmentId ?? null,
        responsibleUserId: action.responsibleUserId ?? userId ?? null,
        title: body.title?.trim() || `Reunião do plano - ${action.title}`,
        kind: MeetingKind.DEVIATION,
        format: body.format ?? MeetingFormat.ONLINE,
        status: MeetingStatus.SCHEDULED,
        startsAt,
        location: body.location ?? null,
        objective: body.objective ?? `Analisar causa e definir tarefas para o plano de ação "${action.title}".`,
      },
    });

    await this.prisma.actionPlan.update({ where: { id: actionId }, data: { meetingId: meeting.id } });

    const participantIds = Array.from(new Set([action.responsibleUserId, userId].filter(Boolean))) as string[];
    await Promise.all(
      participantIds.map((participantId) =>
        this.prisma.meetingParticipant.upsert({
          where: { meetingId_userId: { meetingId: meeting.id, userId: participantId } },
          create: {
            meetingId: meeting.id,
            userId: participantId,
            role: participantId === action.responsibleUserId ? MeetingParticipantRole.RESPONSIBLE : MeetingParticipantRole.PARTICIPANT,
          },
          update: {},
        }),
      ),
    );

    await this.recordHistory(actionId, userId, 'MEETING_CREATED', null, null, meeting.title);
    await this.audit(action.companyId, userId, 'MEETING_CREATED', 'Meeting', meeting.id, null, meeting);
    await this.traceability.record({
      companyId: action.companyId,
      indicatorId: action.indicatorId,
      userId,
      eventType: TraceEventType.MEETING_CREATED,
      entityType: TraceEntityType.MEETING,
      entityId: meeting.id,
      relatedType: TraceEntityType.ACTION_PLAN,
      relatedId: actionId,
      title: 'Reunião marcada para o plano de ação',
      description: meeting.title,
      statusTo: meeting.status,
      metadata: { actionId, startsAt: meeting.startsAt, format: meeting.format },
    });
    return this.getById(actionId);
  }

  async update(id: string, patch: any, userId?: string) {
    const before = await this.prisma.actionPlan.findUnique({ where: { id } });
    if (!before || before.deletedAt) throw new NotFoundException('Ação nao encontrada');
    if (userId) await this.access.assertCanWrite(userId, before.ownerNodeId, 'action_plans', 'edit');
    const data = this.toActionUpdate(patch, before);
    const updated = await this.prisma.actionPlan.update({ where: { id }, data });

    const changed = Object.keys(data).filter((key) => JSON.stringify((before as any)[key]) !== JSON.stringify((updated as any)[key]));
    for (const field of changed) {
      await this.recordHistory(id, userId, 'UPDATE', field, stringify((before as any)[field]), stringify((updated as any)[field]));
    }
    await this.audit(updated.companyId, userId, 'UPDATE', 'ActionPlan', id, before, updated);
    await this.traceability.record({
      companyId: updated.companyId,
      indicatorId: updated.indicatorId,
      userId,
      eventType: TraceEventType.UPDATED,
      entityType: TraceEntityType.ACTION_PLAN,
      entityId: id,
      title: 'Plano de ação atualizado',
      description: updated.title,
      statusFrom: before.status,
      statusTo: updated.status,
      metadata: { changed },
    });
    return updated;
  }

  async changeStatus(id: string, status: ActionStatus, userId?: string, reason?: string) {
    const action = await this.getById(id);
    let completedAt: Date | null = action.completedAt;
    let finalStatus = status;
    let effectivenessStatus: ActionEffectivenessStatus | undefined;
    let reopenedAt: Date | null | undefined;

    if (status === ActionStatus.DONE) {
      completedAt = new Date();
      if (action.dueDate && completedAt > action.dueDate) finalStatus = ActionStatus.DONE_LATE;
      effectivenessStatus = ActionEffectivenessStatus.PENDING;
    }
    if (status === ActionStatus.REOPENED) {
      reopenedAt = new Date();
      effectivenessStatus = ActionEffectivenessStatus.REOPENED;
    }
    if (status === ActionStatus.CANCELLED && reason) {
      await this.recordHistory(id, userId, 'CANCEL_REASON', 'cancelReason', action.cancelReason, reason);
    }

    const updated = await this.prisma.actionPlan.update({
      where: { id },
      data: {
        status: finalStatus,
        completedAt,
        ...(effectivenessStatus ? { effectivenessStatus } : {}),
        ...(reopenedAt ? { reopenedAt } : {}),
        ...(reason ? { cancelReason: reason } : {}),
      },
    });
    const ctx = await this.actionTraceContext(id);
    if (ctx.treatmentId) await this.updateTreatmentFromActions(ctx.treatmentId);
    await this.recordHistory(id, userId, 'STATUS', 'status', action.status, updated.status);
    await this.audit(updated.companyId, userId, 'STATUS_CHANGE', 'ActionPlan', id, action, updated);
    await this.traceability.record({
      companyId: updated.companyId,
      indicatorId: ctx.indicatorId,
      userId,
      eventType: TraceEventType.ACTION_STATUS_CHANGED,
      entityType: TraceEntityType.ACTION_PLAN,
      entityId: id,
      title: 'Status do plano de ação alterado',
      description: updated.title,
      statusFrom: action.status,
      statusTo: updated.status,
      metadata: { progress: updated.progress, completedAt: updated.completedAt, reason },
    });
    this.workItemBus.markDirty(action.companyId, [action.responsibleUserId, updated.responsibleUserId], 'action.status');
    return updated;
  }

  async addTask(
    actionId: string,
    body: { title: string; dueDate?: Date; startDate?: Date; endDate?: Date; assignedToId?: string },
    userId?: string,
  ) {
    const count = await this.prisma.actionTask.count({ where: { actionId } });
    const task = await this.prisma.actionTask.create({
      data: {
        actionId,
        title: body.title,
        dueDate: body.dueDate ?? null,
        startDate: body.startDate ?? null,
        endDate: body.endDate ?? null,
        assignedToId: body.assignedToId ?? null,
        position: count,
      },
    });
    const ctx = await this.actionTraceContext(actionId);
    await this.recordHistory(actionId, userId, 'TASK_CREATED', null, null, task.title);
    await this.audit(ctx.companyId, userId, 'TASK_CREATED', 'ActionTask', task.id, null, task);
    await this.traceability.record({
      companyId: ctx.companyId,
      indicatorId: ctx.indicatorId,
      userId,
      eventType: TraceEventType.TASK_UPDATED,
      entityType: TraceEntityType.ACTION_TASK,
      entityId: task.id,
      relatedType: TraceEntityType.ACTION_PLAN,
      relatedId: actionId,
      title: 'Tarefa criada no plano de ação',
      description: task.title,
      metadata: { dueDate: task.dueDate, startDate: task.startDate, endDate: task.endDate },
    });
    return task;
  }

  async updateTask(
    taskId: string,
    patch: { title?: string; completionNote?: string | null; dueDate?: Date | null; startDate?: Date | null; endDate?: Date | null; assignedToId?: string | null; done?: boolean },
    userId?: string,
  ) {
    const existing = await this.prisma.actionTask.findUnique({ where: { id: taskId } });
    if (!existing) throw new NotFoundException('Tarefa nao encontrada');

    if (patch.done === true) {
      const nextEnd = patch.endDate !== undefined ? patch.endDate : existing.endDate;
      const nextNote = patch.completionNote !== undefined ? patch.completionNote : existing.completionNote;
      if (!nextNote?.trim()) {
        throw new BadRequestException('Informe o que foi feito para concluir a tarefa.');
      }
      if (!nextEnd) patch.endDate = new Date();
    }

    const data: any = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.completionNote !== undefined) data.completionNote = patch.completionNote;
    if (patch.dueDate !== undefined) data.dueDate = patch.dueDate;
    if (patch.startDate !== undefined) data.startDate = patch.startDate;
    if (patch.endDate !== undefined) data.endDate = patch.endDate;
    if (patch.assignedToId !== undefined) data.assignedToId = patch.assignedToId;
    if (patch.done !== undefined) data.done = patch.done;

    const t = await this.prisma.actionTask.update({ where: { id: taskId }, data });
    if (patch.done !== undefined) await this.recalcProgress(t.actionId);
    const ctx = await this.actionTraceContext(t.actionId);
    const event = patch.done === true ? 'TASK_DONE' : patch.done === false ? 'TASK_REOPENED' : 'TASK_UPDATED';
    await this.recordHistory(t.actionId, userId, event, null, null, t.title);
    await this.audit(ctx.companyId, userId, 'TASK_UPDATED', 'ActionTask', taskId, existing, t);
    await this.traceability.record({
      companyId: ctx.companyId,
      indicatorId: ctx.indicatorId,
      userId,
      eventType: TraceEventType.TASK_UPDATED,
      entityType: TraceEntityType.ACTION_TASK,
      entityId: taskId,
      relatedType: TraceEntityType.ACTION_PLAN,
      relatedId: t.actionId,
      title: patch.done === true ? 'Tarefa concluida' : patch.done === false ? 'Tarefa reaberta' : 'Tarefa atualizada',
      description: t.title,
      statusTo: patch.done === undefined ? undefined : patch.done ? 'DONE' : 'OPEN',
      metadata: { startDate: t.startDate, endDate: t.endDate, assignedToId: t.assignedToId, dueDate: t.dueDate, completionNote: t.completionNote },
    });
    return t;
  }

  async toggleTask(taskId: string, done: boolean, userId?: string) {
    return this.updateTask(taskId, { done }, userId);
  }

  async deleteTask(taskId: string, userId?: string) {
    const existing = await this.prisma.actionTask.findUnique({ where: { id: taskId } });
    if (!existing) throw new NotFoundException('Tarefa nao encontrada');
    const ctx = await this.actionTraceContext(existing.actionId);
    await this.prisma.actionTask.delete({ where: { id: taskId } });
    await this.recalcProgress(existing.actionId);
    await this.recordHistory(existing.actionId, userId, 'TASK_DELETED', null, existing.title, null);
    await this.audit(ctx.companyId, userId, 'TASK_DELETED', 'ActionTask', taskId, existing, null);
    await this.traceability.record({
      companyId: ctx.companyId,
      indicatorId: ctx.indicatorId,
      userId,
      eventType: TraceEventType.TASK_UPDATED,
      entityType: TraceEntityType.ACTION_TASK,
      entityId: taskId,
      relatedType: TraceEntityType.ACTION_PLAN,
      relatedId: existing.actionId,
      title: 'Tarefa removida do plano de acao',
      description: existing.title,
    });
    return { ok: true };
  }

  async saveAnalysis(actionId: string, body: any, userId?: string, companyId?: string) {
    const method = body.method as ActionAnalysisTool;
    if (!method) throw new NotFoundException('Ferramenta de análise obrigatoria');
    const action = await this.prisma.actionPlan.findFirst({
      where: { id: actionId, deletedAt: null, ...(companyId ? { companyId } : {}) },
    });
    if (!action || action.deletedAt) throw new NotFoundException('Ação nao encontrada');
    if (userId) await this.access.assertCanWrite(userId, action.ownerNodeId, 'action_plans', 'edit');

    const session = await this.prisma.actionAnalysisSession.upsert({
      where: { actionId_method: { actionId, method } },
      create: {
        actionId,
        method,
        status: body.status ?? ActionToolStatus.IN_PROGRESS,
        problem: body.problem ?? action.problemDescription ?? action.description ?? null,
        rootCause: body.rootCause ?? action.rootCause ?? null,
        responsibleUserId: body.responsibleUserId ?? action.responsibleUserId ?? null,
        data: body.data ?? undefined,
        aiSummary: body.aiSummary ?? null,
      },
      update: {
        status: body.status ?? ActionToolStatus.IN_PROGRESS,
        problem: body.problem ?? null,
        rootCause: body.rootCause ?? null,
        responsibleUserId: body.responsibleUserId ?? null,
        data: body.data ?? undefined,
        aiSummary: body.aiSummary ?? null,
      },
    });

    await this.replaceToolRows(session.id, method, body);
    await this.prisma.actionPlan.update({
      where: { id: actionId },
      data: {
        analysisTool: method,
        problemDescription: body.problem ?? action.problemDescription,
        rootCause: body.rootCause ?? action.rootCause,
        status: finalStatuses.includes(action.status) ? action.status : ActionStatus.UNDER_ANALYSIS,
      },
    });
    await this.recordHistory(actionId, userId, 'ANALYSIS_SAVED', 'analysisTool', action.analysisTool, method);
    await this.audit(action.companyId, userId, 'ANALYSIS_SAVED', 'ActionAnalysisSession', session.id, null, body);
    await this.traceability.record({
      companyId: action.companyId,
      indicatorId: action.indicatorId,
      userId,
      eventType: TraceEventType.ANALYSIS_CREATED,
      entityType: TraceEntityType.ACTION_PLAN,
      entityId: actionId,
      title: `Ferramenta de análise salva (${method})`,
      description: body.rootCause ?? body.problem ?? action.title,
      metadata: { method, sessionId: session.id },
    });
    return this.getById(actionId);
  }

  async addEvidence(actionId: string, body: any, userId?: string) {
    const action = await this.prisma.actionPlan.findUnique({ where: { id: actionId } });
    if (!action || action.deletedAt) throw new NotFoundException('Ação nao encontrada');
    const taskId = body.taskId || null;
    if (taskId) {
      const task = await this.prisma.actionTask.findFirst({ where: { id: taskId, actionId }, select: { id: true } });
      if (!task) throw new BadRequestException('Tarefa nao pertence a este plano');
    }
    const base64 = body.dataBase64 ? String(body.dataBase64).split(',').pop()! : null;
    const buffer = base64 ? Buffer.from(base64, 'base64') : null;
    const MAX_BYTES = 5 * 1024 * 1024;
    if (buffer && buffer.length === 0) throw new BadRequestException('Arquivo vazio');
    if (buffer && buffer.length > MAX_BYTES) throw new BadRequestException('Arquivo excede o limite de 5 MB');
    const title = (body.title ?? body.fileName ?? '').trim();
    if (!title) throw new BadRequestException('Titulo da evidencia obrigatorio');
    const evidence = await this.prisma.actionEvidence.create({
      data: {
        actionId,
        taskId,
        title: title.slice(0, 255),
        description: body.description ?? null,
        url: body.url ?? null,
        fileName: body.fileName ?? null,
        fileType: body.fileType ?? body.mimeType ?? null,
        mimeType: body.mimeType ?? body.fileType ?? null,
        sizeBytes: buffer ? buffer.length : body.sizeBytes ?? null,
        data: buffer ?? undefined,
        uploadedById: userId ?? null,
      },
    });
    if (action.status === ActionStatus.WAITING_EVIDENCE) {
      await this.prisma.actionPlan.update({ where: { id: actionId }, data: { status: ActionStatus.WAITING_VALIDATION } });
    }
    await this.recordHistory(actionId, userId, 'EVIDENCE_ADDED', null, null, evidence.title);
    await this.audit(action.companyId, userId, 'EVIDENCE_ADDED', 'ActionEvidence', evidence.id, null, evidence);
    await this.traceability.record({
      companyId: action.companyId,
      indicatorId: action.indicatorId,
      userId,
      eventType: TraceEventType.EVIDENCE_ADDED,
      entityType: TraceEntityType.ACTION_PLAN,
      entityId: actionId,
      title: taskId ? 'Evidencia adicionada a tarefa' : 'Evidencia adicionada ao plano',
      description: evidence.title,
      metadata: { evidenceId: evidence.id, taskId, url: evidence.url, fileName: evidence.fileName },
    });
    return evidence;
  }

  async getEvidenceFile(evidenceId: string, companyId: string) {
    const evidence = await this.prisma.actionEvidence.findFirst({
      where: { id: evidenceId, deletedAt: null, action: { is: { companyId, deletedAt: null } } },
    });
    if (!evidence || !evidence.data) throw new NotFoundException('Anexo nao encontrado');
    return {
      id: evidence.id,
      fileName: evidence.fileName ?? evidence.title,
      mimeType: evidence.mimeType ?? evidence.fileType ?? null,
      dataBase64: Buffer.from(evidence.data).toString('base64'),
    };
  }

  async addComment(actionId: string, body: any, userId?: string, authorName?: string) {
    const action = await this.prisma.actionPlan.findUnique({ where: { id: actionId } });
    if (!action || action.deletedAt) throw new NotFoundException('Ação nao encontrada');
    const comment = await this.prisma.actionComment.create({
      data: { actionId, authorId: userId ?? null, authorName: authorName ?? null, comment: body.comment },
    });
    await this.recordHistory(actionId, userId, 'COMMENT_ADDED', null, null, comment.comment);
    await this.audit(action.companyId, userId, 'COMMENT_ADDED', 'ActionComment', comment.id, null, comment);
    await this.traceability.record({
      companyId: action.companyId,
      indicatorId: action.indicatorId,
      userId,
      eventType: TraceEventType.COMMENT_ADDED,
      entityType: TraceEntityType.ACTION_PLAN,
      entityId: actionId,
      title: 'Comentario adicionado ao plano',
      description: comment.comment,
    });
    return comment;
  }

  async requestEffectivenessReview(actionId: string, body: any, userId?: string) {
    const action = await this.getById(actionId);
    const updated = await this.prisma.actionPlan.update({
      where: { id: actionId },
      data: {
        effectivenessStatus: ActionEffectivenessStatus.PENDING,
        effectivenessSummary: body?.summary ?? action.effectivenessSummary,
        effectivenessEvidence: body?.evidence ?? action.effectivenessEvidence,
        achievedResult: body?.achievedResult ?? action.achievedResult,
        status: ActionStatus.WAITING_VALIDATION,
      },
    });
    await this.recordHistory(actionId, userId, 'EFFECTIVENESS_REQUESTED', 'effectivenessStatus', action.effectivenessStatus, ActionEffectivenessStatus.PENDING);
    await this.audit(updated.companyId, userId, 'EFFECTIVENESS_REQUESTED', 'ActionPlan', actionId, action, updated);
    await this.traceability.record({
      companyId: updated.companyId,
      indicatorId: updated.indicatorId,
      userId,
      eventType: TraceEventType.UPDATED,
      entityType: TraceEntityType.ACTION_PLAN,
      entityId: actionId,
      title: 'Eficácia enviada para análise',
      description: body?.summary ?? updated.title,
      statusFrom: action.status,
      statusTo: updated.status,
      metadata: { requested: true },
    });
    return updated;
  }

  async validateEffectiveness(actionId: string, body: any, userId?: string) {
    const action = await this.getById(actionId);
    const status = body.effective
      ? ActionEffectivenessStatus.EFFECTIVE
      : body.reopen
        ? ActionEffectivenessStatus.REOPENED
        : ActionEffectivenessStatus.INEFFECTIVE;
    const actionStatus = body.effective ? ActionStatus.EFFECTIVE : body.reopen ? ActionStatus.REOPENED : ActionStatus.INEFFECTIVE;
    const updated = await this.prisma.actionPlan.update({
      where: { id: actionId },
      data: {
        effectivenessStatus: status,
        effectivenessChecklist: body.checklist ?? undefined,
        effectivenessSummary: body.summary ?? null,
        effectivenessEvidence: body.evidence ?? null,
        effectivenessValidatedById: userId ?? null,
        effectivenessValidatedAt: new Date(),
        achievedResult: body.achievedResult ?? action.achievedResult,
        status: actionStatus,
        ...(body.reopen ? { reopenedAt: new Date() } : {}),
      },
    });
    await this.recordHistory(actionId, userId, 'EFFECTIVENESS', 'effectivenessStatus', action.effectivenessStatus, status);
    await this.audit(updated.companyId, userId, 'EFFECTIVENESS_VALIDATED', 'ActionPlan', actionId, action, updated);
    // Fecha o ciclo do fluxo: a validação de eficácia repercute no status da tratativa
    // (reabertura volta a ACTIONS_IN_PROGRESS; eficaz/ineficaz com tudo concluído →
    // AWAITING_REEVALUATION). Sem isto, a tratativa ficava "presa" após a eficácia.
    if (updated.treatmentId) await this.updateTreatmentFromActions(updated.treatmentId);
    await this.traceability.record({
      companyId: updated.companyId,
      indicatorId: updated.indicatorId,
      userId,
      eventType: body.reopen ? TraceEventType.REOPENED : TraceEventType.CLOSED,
      entityType: TraceEntityType.ACTION_PLAN,
      entityId: actionId,
      title: body.effective ? 'Eficacia validada' : 'Plano marcado como ineficaz',
      description: body.summary ?? updated.title,
      statusFrom: action.status,
      statusTo: updated.status,
      metadata: { effectivenessStatus: status, checklist: body.checklist },
    });
    return updated;
  }

  async aiAssist(actionId: string, body: any, userId?: string) {
    const action = await this.getById(actionId);
    const aiSuggestions = await this.generateSuggestionsViaGemini(action, body?.scope);
    const suggestions = aiSuggestions ?? this.generateSuggestions(action, body?.scope);
    const saved = await this.prisma.$transaction(
      suggestions.map((suggestion) =>
        this.prisma.actionAiSuggestion.create({
          data: {
            actionId,
            sessionId: body?.sessionId ?? null,
            suggestionType: suggestion.type,
            title: suggestion.title,
            content: suggestion.content,
            context: suggestion.context,
          },
        }),
      ),
    );
    await this.recordHistory(actionId, userId, 'AI_USED', null, null, body?.scope ?? 'general');
    await this.audit(action.companyId, userId, 'AI_USED', 'ActionPlan', actionId, null, { scope: body?.scope, suggestions, source: aiSuggestions ? 'gemini' : 'rules' });
    return saved;
  }

  async ishikawaAiSuggestions(actionId: string, body: any, userId?: string, companyId?: string) {
    const action = await this.getById(actionId, companyId);
    const session = action.analysisSessions?.find((item: any) => item.method === ActionAnalysisTool.ISHIKAWA);
    const causes = Array.isArray(body?.causes) ? body.causes : (session?.ishikawaCauses ?? []);
    const problem = nonEmptyText(body?.problem) ?? session?.problem ?? action.problemDescription ?? action.description ?? action.title;
    const aiSuggestions = await this.generateIshikawaSuggestionsViaGemini(action, problem, causes);
    const suggestions = aiSuggestions ?? defaultIshikawaCauseSuggestions(problem, causes);
    await this.recordHistory(actionId, userId, 'AI_ISHIKAWA_SUGGESTIONS', null, null, problem);
    await this.audit(action.companyId, userId, 'AI_ISHIKAWA_SUGGESTIONS', 'ActionIshikawaCause', actionId, null, { problem, suggestions, source: aiSuggestions ? 'gemini' : 'rules' });
    return suggestions;
  }

  async convertIshikawaCauseToTask(actionId: string, causeId: string, body: any, userId?: string, companyId?: string) {
    const action = await this.prisma.actionPlan.findFirst({
      where: { id: actionId, deletedAt: null, ...(companyId ? { companyId } : {}) },
    });
    if (!action) throw new NotFoundException('Ação nao encontrada');
    if (userId) await this.access.assertCanWrite(userId, action.ownerNodeId, 'action_plans', 'edit');

    const cause = await this.prisma.actionIshikawaCause.findFirst({
      where: { id: causeId, session: { actionId } },
      include: { session: true },
    });
    if (!cause) throw new NotFoundException('Causa nao encontrada');

    if (cause.convertedToTaskId) return this.getById(actionId, companyId);

    const taskTitle = nonEmptyText(body?.title) ?? `Tratar causa Ishikawa: ${cause.title ?? cause.description}`;
    const count = await this.prisma.actionTask.count({ where: { actionId } });
    const task = await this.prisma.actionTask.create({
      data: {
        actionId,
        title: taskTitle,
        dueDate: cause.dueDate ?? action.dueDate ?? null,
        assignedToId: cause.responsibleUserId ?? action.responsibleUserId ?? null,
        position: count,
      },
    });

    const markRootCause = Boolean(body?.markRootCause ?? cause.likelyRootCause);
    await this.prisma.actionIshikawaCause.update({
      where: { id: cause.id },
      data: {
        convertedToTaskId: task.id,
        status: 'CONVERTED_TO_ACTION',
        likelyRootCause: markRootCause,
      },
    });
    if (markRootCause) {
      const rootCause = cause.title ?? cause.description;
      await this.prisma.actionAnalysisSession.update({
        where: { id: cause.sessionId },
        data: { rootCause },
      });
      await this.prisma.actionPlan.update({ where: { id: actionId }, data: { rootCause } });
    }

    await this.recalcProgress(actionId);
    await this.recordHistory(actionId, userId, 'ISHIKAWA_CONVERTED_TO_TASK', null, cause.title ?? cause.description, task.title);
    await this.audit(action.companyId, userId, 'ISHIKAWA_CONVERTED_TO_TASK', 'ActionIshikawaCause', cause.id, cause, { taskId: task.id });
    await this.traceability.record({
      companyId: action.companyId,
      indicatorId: action.indicatorId,
      userId,
      eventType: TraceEventType.TASK_UPDATED,
      entityType: TraceEntityType.ACTION_TASK,
      entityId: task.id,
      relatedType: TraceEntityType.ACTION_PLAN,
      relatedId: actionId,
      title: 'Causa Ishikawa convertida em tarefa',
      description: task.title,
      metadata: { causeId: cause.id, sessionId: cause.sessionId },
    });
    return this.getById(actionId, companyId);
  }

  async pdcaAiSuggestions(actionId: string, body: any, userId?: string, companyId?: string) {
    const action = await this.getById(actionId, companyId);
    const session = action.analysisSessions?.find((item: any) => item.method === ActionAnalysisTool.PDCA);
    const stages = Array.isArray(body?.stages) ? body.stages : (session?.pdcaSteps ?? []);
    const aiSuggestions = await this.generatePdcaSuggestionsViaGemini(action, stages);
    const suggestions = aiSuggestions ?? defaultPdcaSuggestions(action, stages);
    await this.recordHistory(actionId, userId, 'AI_PDCA_SUGGESTIONS', null, null, action.title);
    await this.audit(action.companyId, userId, 'AI_PDCA_SUGGESTIONS', 'ActionPdcaStep', actionId, null, { suggestions, source: aiSuggestions ? 'gemini' : 'rules' });
    return suggestions;
  }

  async convertPdcaStageToTask(actionId: string, stageId: string, body: any, userId?: string, companyId?: string) {
    const action = await this.prisma.actionPlan.findFirst({
      where: { id: actionId, deletedAt: null, ...(companyId ? { companyId } : {}) },
    });
    if (!action) throw new NotFoundException('Ação nao encontrada');
    if (userId) await this.access.assertCanWrite(userId, action.ownerNodeId, 'action_plans', 'edit');

    const stage = await this.prisma.actionPdcaStep.findFirst({
      where: { id: stageId, session: { actionId } },
      include: { session: true },
    });
    if (!stage) throw new NotFoundException('Etapa PDCA nao encontrada');
    if (stage.convertedToTaskId) return this.getById(actionId, companyId);

    const data = (stage.data && typeof stage.data === 'object' ? stage.data : {}) as Record<string, any>;
    const title = nonEmptyText(body?.title) ?? `PDCA ${pdcaPhaseLabel(stage.phase)}: ${stage.title ?? data.title ?? action.title}`;
    const count = await this.prisma.actionTask.count({ where: { actionId } });
    const task = await this.prisma.actionTask.create({
      data: {
        actionId,
        title,
        dueDate: stage.dueDate ?? action.dueDate ?? null,
        assignedToId: stage.responsibleUserId ?? action.responsibleUserId ?? null,
        position: count,
      },
    });

    await this.prisma.actionPdcaStep.update({
      where: { id: stage.id },
      data: {
        convertedToTaskId: task.id,
        data: { ...data, convertedTaskId: task.id, convertedAt: new Date().toISOString() } as any,
      },
    });
    await this.recalcProgress(actionId);
    await this.recordHistory(actionId, userId, 'PDCA_CONVERTED_TO_TASK', null, stage.title ?? stage.phase, task.title);
    await this.audit(action.companyId, userId, 'PDCA_CONVERTED_TO_TASK', 'ActionPdcaStep', stage.id, stage, { taskId: task.id });
    await this.traceability.record({
      companyId: action.companyId,
      indicatorId: action.indicatorId,
      userId,
      eventType: TraceEventType.TASK_UPDATED,
      entityType: TraceEntityType.ACTION_TASK,
      entityId: task.id,
      relatedType: TraceEntityType.ACTION_PLAN,
      relatedId: actionId,
      title: 'Etapa PDCA convertida em tarefa',
      description: task.title,
      metadata: { stageId: stage.id, phase: stage.phase, sessionId: stage.sessionId },
    });
    return this.getById(actionId, companyId);
  }

  private async generateSuggestionsViaGemini(action: any, scope?: string) {
    if (!this.gemini.isEnabled) return null;
    const context = {
      scope: scope ?? 'general',
      indicator: action.indicator?.name,
      objective: action.strategicObjective?.name,
      area: action.ownerNode?.name,
      status: action.status,
      dueDate: action.dueDate,
    };
    const rootCause = action.rootCause || action.analysisSessions?.[0]?.rootCause;
    const problem =
      action.problemDescription || action.description || action.deviation?.title || action.indicator?.name || action.title;
    const lastResults = action.indicator?.results?.slice?.(-6) ?? [];

    const prompt = `Voce e um consultor senior em gestao de planos de acao em empresas industriais brasileiras.
Para o plano abaixo, gere 3 sugestoes objetivas em portugues do Brasil:
1. Uma pergunta de aprofundamento sobre a causa-raiz (type=QUESTION)
2. Uma sugestao de acao no formato 5W2H curto (type=ACTION)
3. Um criterio de eficacia mensuravel (type=EFFECTIVENESS)

Considere o contexto historico, a periodicidade do indicador (se houver) e priorize acoes que atacam a causa-raiz.

Responda no schema JSON:
{
  "suggestions": [
    { "type": "QUESTION", "title": "...", "content": "..." },
    { "type": "ACTION", "title": "...", "content": "..." },
    { "type": "EFFECTIVENESS", "title": "...", "content": "..." }
  ]
}

CONTEXTO DO PLANO:
- Titulo: ${action.title ?? '-'}
- Descricao: ${action.description ?? '-'}
- Problema: ${problem ?? '-'}
- Causa raiz informada: ${rootCause ?? 'nao definida'}
- Indicador: ${action.indicator?.name ?? '-'} (tipo ${action.indicator?.type ?? '-'})
- Objetivo estrategico: ${action.strategicObjective?.name ?? '-'}
- Area: ${action.ownerNode?.name ?? '-'}
- Status atual: ${action.status ?? '-'}
- Escopo solicitado: ${scope ?? 'general'}

ULTIMOS RESULTADOS DO INDICADOR (mais recentes ao fim):
${JSON.stringify(lastResults, null, 2)}`;

    interface GeminiActionResp {
      suggestions?: Array<{ type?: string; title?: string; content?: string }>;
    }
    const json = await this.gemini.generateJson<GeminiActionResp>(prompt, {
      temperature: 0.45,
      maxOutputTokens: 1200,
    });
    if (!json?.suggestions?.length) return null;
    const allowed = new Set(['QUESTION', 'ACTION', 'EFFECTIVENESS']);
    const cleaned = json.suggestions
      .filter((s) => s.type && allowed.has(s.type) && s.title && s.content)
      .map((s) => ({
        type: s.type as 'QUESTION' | 'ACTION' | 'EFFECTIVENESS',
        title: s.title!,
        content: s.content!,
        context,
      }));
    if (cleaned.length === 0) return null;
    return cleaned;
  }

  private async generateIshikawaSuggestionsViaGemini(action: any, problem: string, causes: any[]) {
    if (!this.gemini.isEnabled) return null;
    const existingCauses = causes
      .map((cause) => `${ishikawaCategoryLabel(cause.category)}: ${cause.title ?? cause.description ?? ''}`)
      .filter((line) => !line.endsWith(': '))
      .join('\n');
    const lastResults = action.indicator?.results?.slice?.(-6) ?? [];
    const prompt = `Voce e um facilitador senior de analise de causa Ishikawa 6M para empresas industriais brasileiras.
Gere sugestoes objetivas de causas possiveis, separadas nas categorias 6M.
Nao confirme causa raiz. A resposta deve ser apenas JSON valido no schema:
{
  "suggestions": [
    { "category": "METHOD", "title": "...", "justification": "...", "priority": "HIGH" }
  ]
}

Categorias permitidas:
METHOD, MACHINE, MANPOWER, MATERIAL, ENVIRONMENT, MEASUREMENT.
Prioridades permitidas:
LOW, MEDIUM, HIGH, CRITICAL.

CONTEXTO DO PLANO:
- Titulo: ${action.title ?? '-'}
- Descricao: ${action.description ?? '-'}
- Problema principal: ${problem ?? '-'}
- Indicador: ${action.indicator?.name ?? '-'}
- Meta/resultados recentes: ${JSON.stringify(lastResults, null, 2)}
- Area/setor: ${action.ownerNode?.name ?? '-'}
- Causas ja cadastradas:
${existingCauses || '- nenhuma'}`;

    interface GeminiIshikawaResp {
      suggestions?: Array<{ category?: string; title?: string; justification?: string; priority?: string }>;
    }
    const json = await this.gemini.generateJson<GeminiIshikawaResp>(prompt, {
      temperature: 0.35,
      maxOutputTokens: 1800,
    });
    const suggestions = json?.suggestions
      ?.map((item) => ({
        category: normalizeIshikawaCategory(item.category),
        title: nonEmptyText(item.title),
        justification: nonEmptyText(item.justification) ?? 'Sugestao gerada para facilitar a discussao da equipe.',
        priority: normalizeActionPriority(item.priority),
      }))
      .filter((item) => item.title);
    return suggestions?.length ? suggestions : null;
  }

  private async generatePdcaSuggestionsViaGemini(action: any, stages: any[]) {
    if (!this.gemini.isEnabled) return null;
    const currentStages = stages
      .map((stage) => `${pdcaPhaseLabel(stage.phase)}: ${stage.description ?? stage.objective ?? ''}`)
      .filter((line) => !line.endsWith(': '))
      .join('\n');
    const lastResults = action.indicator?.results?.slice?.(-6) ?? [];
    const prompt = `Voce e um facilitador senior de melhoria continua PDCA em empresas brasileiras.
Gere sugestoes objetivas para preencher um ciclo PDCA dentro de um plano de acao.
Nao salve nem confirme decisoes. Responda somente JSON valido no schema:
{
  "suggestions": [
    { "phase": "PLAN", "field": "objective", "suggestion": "...", "justification": "..." }
  ]
}

Fases permitidas: PLAN, DO, CHECK, ACT.
Campos sugeridos: objective, description, checklist, risks, evidence, standardization, measurement.

CONTEXTO DO PLANO:
- Titulo: ${action.title ?? '-'}
- Descricao: ${action.description ?? '-'}
- Problema principal: ${action.problemDescription ?? '-'}
- Causa raiz: ${action.rootCause ?? '-'}
- Indicador: ${action.indicator?.name ?? '-'}
- Resultados recentes: ${JSON.stringify(lastResults, null, 2)}
- Area/setor: ${action.ownerNode?.name ?? '-'}
- Etapas ja preenchidas:
${currentStages || '- nenhuma'}`;

    interface GeminiPdcaResp {
      suggestions?: Array<{ phase?: string; field?: string; suggestion?: string; justification?: string }>;
    }
    const json = await this.gemini.generateJson<GeminiPdcaResp>(prompt, {
      temperature: 0.35,
      maxOutputTokens: 1800,
    });
    const suggestions = json?.suggestions
      ?.map((item) => ({
        phase: normalizePdcaPhase(item.phase),
        field: nonEmptyText(item.field) ?? 'description',
        suggestion: nonEmptyText(item.suggestion),
        justification: nonEmptyText(item.justification) ?? 'Sugestão gerada para facilitar a condução do ciclo PDCA.',
      }))
      .filter((item) => item.suggestion);
    return suggestions?.length ? suggestions : null;
  }

  async decideSuggestion(id: string, status: ActionAiSuggestionStatus, userId?: string) {
    const suggestion = await this.prisma.actionAiSuggestion.update({
      where: { id },
      data: { status, decidedAt: new Date(), decidedById: userId ?? null },
      include: { action: true },
    });
    await this.recordHistory(suggestion.actionId, userId, `AI_${status}`, null, null, suggestion.title);
    await this.audit(suggestion.action.companyId, userId, `AI_${status}`, 'ActionAiSuggestion', id, null, suggestion);
    return suggestion;
  }

  async recalcProgress(actionId: string) {
    const tasks = await this.prisma.actionTask.findMany({ where: { actionId } });
    if (tasks.length === 0) {
      await this.prisma.actionPlan.update({ where: { id: actionId }, data: { progress: 0 } });
      return;
    }
    const done = tasks.filter((t) => t.done).length;
    const progress = Math.round((done / tasks.length) * 100);
    const status = progress >= 100 ? ActionStatus.WAITING_VALIDATION : ActionStatus.IN_PROGRESS;
    await this.prisma.actionPlan.update({ where: { id: actionId }, data: { progress, status } });
  }

  async requestDeletionApproval(actionId: string, companyId: string, userId?: string, reason?: string) {
    const action = await this.prisma.actionPlan.findFirst({ where: { id: actionId, companyId, deletedAt: null } });
    if (!action) throw new NotFoundException('Acao nao encontrada');

    const existing = await this.prisma.generalApprovalRequest.findFirst({
      where: {
        companyId,
        type: 'ACTION_PLAN_DELETION',
        entityType: 'ActionPlan',
        entityId: actionId,
        status: 'PENDING',
      },
    });
    if (existing) return (await this.hydrateGeneralApprovals([existing]))[0];

    const request = await this.prisma.generalApprovalRequest.create({
      data: {
        companyId,
        type: 'ACTION_PLAN_DELETION',
        entityType: 'ActionPlan',
        entityId: actionId,
        title: `Eliminar plano de acao: ${action.title}`,
        description: 'Solicitacao de eliminacao enviada para validacao da gestao.',
        requesterId: userId ?? null,
        reason: reason ?? null,
      },
    });
    await this.recordHistory(actionId, userId, 'DELETE_REQUESTED', null, null, reason ?? 'Solicitacao enviada para aprovacao');
    await this.audit(companyId, userId, 'DELETE_APPROVAL_REQUESTED', 'GeneralApprovalRequest', request.id, null, request);
    await this.traceability.record({
      companyId,
      indicatorId: action.indicatorId,
      userId,
      eventType: TraceEventType.UPDATED,
      entityType: TraceEntityType.ACTION_PLAN,
      entityId: actionId,
      title: 'Eliminacao do plano enviada para aprovacao',
      description: reason ?? action.title,
      metadata: { approvalRequestId: request.id },
    });
    return (await this.hydrateGeneralApprovals([request]))[0];
  }

  async listGeneralApprovals(companyId: string, userId?: string, scope: 'pending' | 'requested' | 'all' = 'pending') {
    const where: Prisma.GeneralApprovalRequestWhereInput = {
      companyId,
      ...(scope === 'pending' ? { status: 'PENDING' } : {}),
      ...(scope === 'requested' && userId ? { requesterId: userId } : {}),
    };
    const rows = await this.prisma.generalApprovalRequest.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return this.hydrateGeneralApprovals(rows);
  }

  async decideGeneralApproval(requestId: string, companyId: string, userId: string | undefined, decision: 'APPROVED' | 'REJECTED', decisionNote?: string) {
    const request = await this.prisma.generalApprovalRequest.findFirst({ where: { id: requestId, companyId } });
    if (!request) throw new NotFoundException('Solicitacao nao encontrada');
    if (request.status !== 'PENDING') throw new BadRequestException('Esta solicitacao ja foi decidida.');

    if (decision === 'APPROVED' && request.type === 'ACTION_PLAN_DELETION' && request.entityType === 'ActionPlan') {
      await this.remove(request.entityId, userId, request.reason ?? decisionNote ?? 'Eliminacao aprovada pela gestao.');
    }

    const updated = await this.prisma.generalApprovalRequest.update({
      where: { id: requestId },
      data: {
        status: decision,
        approverId: userId ?? null,
        decisionNote: decisionNote ?? null,
        decidedAt: new Date(),
      },
    });
    await this.audit(companyId, userId, `GENERAL_APPROVAL_${decision}`, 'GeneralApprovalRequest', requestId, request, updated);
    return (await this.hydrateGeneralApprovals([updated]))[0];
  }

  async remove(id: string, userId?: string, reason?: string) {
    const before = await this.prisma.actionPlan.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Ação nao encontrada');
    if (userId) await this.access.assertCanWrite(userId, before.ownerNodeId, 'action_plans', 'delete');
    const removed = await this.prisma.actionPlan.update({
      where: { id },
      data: { deletedAt: new Date(), status: ActionStatus.CANCELLED, cancelReason: reason ?? null },
    });
    const ctx = await this.actionTraceContext(id);
    await this.recordHistory(id, userId, 'DELETE', 'deletedAt', null, removed.deletedAt?.toISOString() ?? null);
    await this.audit(removed.companyId, userId, 'DELETE', 'ActionPlan', id, before, removed);
    await this.traceability.record({
      companyId: removed.companyId,
      indicatorId: ctx.indicatorId,
      userId,
      eventType: TraceEventType.STATUS_CHANGED,
      entityType: TraceEntityType.ACTION_PLAN,
      entityId: id,
      title: 'Plano de ação cancelado',
      description: removed.title,
      statusTo: ActionStatus.CANCELLED,
      metadata: { reason },
    });
    return removed;
  }

  private listInclude() {
    return {
      ownerNode: { select: { id: true, name: true, type: true } },
      responsibleUser: { select: { id: true, name: true, avatarUrl: true, email: true } },
      indicator: { select: { id: true, name: true, code: true, ownerNode: { select: { id: true, name: true } } } },
      indicatorResult: { select: { id: true, periodRef: true, value: true, light: true, deviationPct: true } },
      strategicObjective: { select: { id: true, name: true, perspective: { select: { id: true, name: true } } } },
      deviation: { select: { id: true, number: true, title: true, method: true, rootCause: true, status: true } },
      analysis: { select: { id: true, method: true, content: true } },
      meeting: { select: { id: true, title: true, startsAt: true } },
      treatment: { select: { id: true, title: true, status: true, periodRef: true } },
      _count: { select: { tasks: true, evidences: true, comments: true, analysisSessions: true } },
    } satisfies Prisma.ActionPlanInclude;
  }

  private detailInclude() {
    return {
      branch: { select: { id: true, name: true, code: true } },
      ownerNode: true,
      responsibleUser: true,
      createdBy: true,
      indicator: {
        include: {
          ownerNode: true,
          responsibleUser: { select: { id: true, name: true, email: true } },
          strategicObjective: { include: { perspective: true, map: true } },
          results: { orderBy: { periodDate: 'desc' }, take: 12 },
        },
      },
      indicatorResult: true,
      strategicObjective: { include: { perspective: true, map: true } },
      deviation: { include: { causes: true, analyses: true } },
      analysis: true,
      meeting: { include: { participants: { include: { user: { select: { id: true, name: true } } } }, decisions: true } },
      treatment: { include: { result: true } },
      tasks: {
        orderBy: { position: 'asc' },
        include: {
          assignedTo: { select: { id: true, name: true, email: true, avatarUrl: true } },
          _count: { select: { evidences: true } },
        },
      },
      participants: { orderBy: { createdAt: 'asc' } },
      evidences: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
      comments: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
      history: { orderBy: { createdAt: 'desc' }, take: 80 },
      aiSuggestions: { orderBy: { createdAt: 'desc' }, take: 50 },
      analysisSessions: {
        orderBy: { updatedAt: 'desc' },
        include: {
          fiveWhys: { orderBy: { position: 'asc' } },
          ishikawaCauses: { orderBy: [{ category: 'asc' }, { orderIndex: 'asc' }, { createdAt: 'asc' }] },
          maspSteps: { orderBy: { step: 'asc' } },
          pdcaSteps: { orderBy: { phase: 'asc' } },
          fiveW2H: true,
        },
      },
    } satisfies Prisma.ActionPlanInclude;
  }

  private async inferLinks(input: any) {
    const out: Record<string, any> = {};
    if (input.origin === ActionOrigin.DEVIATION && input.originRefId) {
      const deviation = await this.prisma.deviation.findUnique({
        where: { id: input.originRefId },
        include: { indicator: { select: { ownerNodeId: true, strategicObjectiveId: true } }, analyses: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      if (deviation) {
        out.deviationId = deviation.id;
        out.indicatorId = deviation.indicatorId;
        out.ownerNodeId = deviation.indicator.ownerNodeId;
        out.strategicObjectiveId = deviation.indicator.strategicObjectiveId;
        out.analysisId = deviation.analyses[0]?.id;
        out.analysisTool = this.methodToTool(deviation.method);
        out.rootCause = deviation.rootCause;
        out.problemDescription = deviation.fact ?? deviation.title;
        out.responsibleUserId = deviation.responsibleUserId;
      }
    }
    if (input.origin === ActionOrigin.MEETING && input.originRefId) {
      const meeting = await this.prisma.meeting.findUnique({ where: { id: input.originRefId } });
      if (meeting) {
        out.meetingId = meeting.id;
        out.indicatorId = meeting.indicatorId;
        out.deviationId = meeting.deviationId;
        out.analysisId = meeting.analysisId;
        out.treatmentId = meeting.treatmentId;
        out.responsibleUserId = meeting.responsibleUserId;
      }
    }
    if (input.origin === ActionOrigin.INDICATOR && input.originRefId) {
      const indicator = await this.prisma.indicator.findUnique({ where: { id: input.originRefId } });
      if (indicator) {
        out.indicatorId = indicator.id;
        out.ownerNodeId = indicator.ownerNodeId;
        out.strategicObjectiveId = indicator.strategicObjectiveId;
        out.responsibleUserId = indicator.responsibleUserId;
      }
    }
    if ((input.origin === ActionOrigin.OBJECTIVE || input.origin === ActionOrigin.STRATEGIC_MAP) && input.originRefId) {
      out.strategicObjectiveId = input.originRefId;
    }
    return out;
  }

  private toActionUpdate(patch: any, before: any): Prisma.ActionPlanUpdateInput {
    const data: Prisma.ActionPlanUpdateInput = {};
    const simple = [
      'title',
      'description',
      'problemDescription',
      'origin',
      'originRefId',
      'priority',
      'criticality',
      'status',
      'progress',
      'estimatedCost',
      'actualCost',
      'responsibleEmail',
      'evidenceRequired',
      'expectedResult',
      'achievedResult',
      'rootCause',
      'analysisTool',
      'cancelReason',
    ];
    for (const key of simple) if (key in patch) (data as any)[key] = patch[key];
    const nullableRelations = ['branchId', 'ownerNodeId', 'responsibleUserId', 'strategicObjectiveId', 'indicatorId', 'indicatorResultId', 'meetingId', 'analysisId', 'treatmentId', 'deviationId'];
    for (const key of nullableRelations) if (key in patch) (data as any)[key] = patch[key] || null;
    if ('startDate' in patch) data.startDate = patch.startDate ? new Date(patch.startDate) : null;
    if ('dueDate' in patch) data.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
    if ('status' in patch && patch.status === ActionStatus.DONE) {
      const completedAt = new Date();
      data.completedAt = completedAt;
      data.status = before.dueDate && completedAt > before.dueDate ? ActionStatus.DONE_LATE : ActionStatus.DONE;
      data.effectivenessStatus = ActionEffectivenessStatus.PENDING;
    }
    if ('status' in patch && patch.status === ActionStatus.REOPENED) {
      data.reopenedAt = new Date();
      data.effectivenessStatus = ActionEffectivenessStatus.REOPENED;
    }
    return data;
  }

  private async replaceToolRows(sessionId: string, method: ActionAnalysisTool, body: any) {
    if (method === ActionAnalysisTool.FIVE_WHYS) {
      await this.prisma.actionFiveWhy.deleteMany({ where: { sessionId } });
      const rows = (body.fiveWhys ?? []).map((item: any, index: number) => ({
        sessionId,
        position: item.position ?? index + 1,
        question: item.question ?? `${index + 1}o por que?`,
        answer: item.answer ?? null,
        evidence: item.evidence ?? null,
        aiPrompt: item.aiPrompt ?? null,
        isRootCause: item.isRootCause ?? false,
      }));
      if (rows.length > 0) await this.prisma.actionFiveWhy.createMany({ data: rows });
    }
    if (method === ActionAnalysisTool.ISHIKAWA) {
      await this.prisma.actionIshikawaCause.deleteMany({ where: { sessionId } });
      const rows: Prisma.ActionIshikawaCauseCreateManyInput[] = (body.ishikawaCauses ?? [])
        .map((item: any, index: number) => {
          const title = nonEmptyText(item.title) ?? nonEmptyText(item.description);
          if (!title) return null;
          const description = nonEmptyText(item.description) ?? title;
          const status = normalizeCauseStatus(item.status, item.isRootCause ?? item.likelyRootCause);
          return {
            ...(persistedId(item.id) ? { id: item.id } : {}),
            sessionId,
            category: normalizeIshikawaCategory(item.category),
            title,
            description,
            priority: normalizeActionPriority(item.priority),
            impact: clampScale(item.severity ?? item.impact),
            probability: clampScale(item.probability),
            status,
            evidence: nonEmptyText(item.evidence),
            responsibleUserId: nonEmptyText(item.responsibleUserId),
            dueDate: coerceDate(item.dueDate),
            positionX: numberOrNull(item.positionX),
            positionY: numberOrNull(item.positionY),
            orderIndex: Number.isFinite(Number(item.orderIndex)) ? Number(item.orderIndex) : index,
            tags: normalizeTags(item.tags) as any,
            isAiSuggested: Boolean(item.isAiSuggested),
            convertedToTaskId: nonEmptyText(item.convertedToTaskId),
            likelyRootCause: Boolean(item.isRootCause ?? item.likelyRootCause ?? status === 'ROOT_CAUSE'),
          };
        })
        .filter((item: Prisma.ActionIshikawaCauseCreateManyInput | null): item is Prisma.ActionIshikawaCauseCreateManyInput => Boolean(item));
      if (rows.length > 0) await this.prisma.actionIshikawaCause.createMany({ data: rows });
    }
    if (method === ActionAnalysisTool.MASP) {
      await this.prisma.actionMaspStep.deleteMany({ where: { sessionId } });
      const rows = (body.maspSteps ?? defaultMaspSteps()).map((item: any, index: number) => ({
        sessionId,
        step: item.step ?? index + 1,
        title: item.title,
        description: item.description ?? null,
        responsibleUserId: item.responsibleUserId ?? null,
        dueDate: item.dueDate ? new Date(item.dueDate) : null,
        evidence: item.evidence ?? null,
        comments: item.comments ?? null,
        status: item.status ?? ActionStepStatus.PENDING,
        validated: item.validated ?? false,
      }));
      await this.prisma.actionMaspStep.createMany({ data: rows });
    }
    if (method === ActionAnalysisTool.PDCA) {
      await this.prisma.actionPdcaStep.deleteMany({ where: { sessionId } });
      const rows: Prisma.ActionPdcaStepCreateManyInput[] = (body.pdcaSteps ?? defaultPdcaSteps()).map((item: any, index: number) => {
        const phase = normalizePdcaPhase(item.phase, index);
        const status = normalizeActionStepStatus(item.status);
        const progress = clampProgress(item.progress ?? (status === ActionStepStatus.DONE || status === ActionStepStatus.VALIDATED ? 100 : 0));
        return {
          ...(persistedId(item.id) ? { id: item.id } : {}),
          sessionId,
          phase,
          title: nonEmptyText(item.title) ?? pdcaPhaseLabel(phase),
          subtitle: nonEmptyText(item.subtitle) ?? pdcaPhaseSubtitle(phase),
          description: nonEmptyText(item.description),
          objective: nonEmptyText(item.objective),
          responsibleUserId: nonEmptyText(item.responsibleUserId),
          dueDate: coerceDate(item.dueDate),
          priority: normalizeActionPriority(item.priority),
          progress,
          evidence: nonEmptyText(item.evidence),
          comments: nonEmptyText(item.comments),
          status,
          validated: Boolean(item.validated ?? status === ActionStepStatus.VALIDATED),
          checklist: (normalizePdcaChecklist(item.checklist).length ? normalizePdcaChecklist(item.checklist) : defaultPdcaChecklist(phase)) as any,
          data: normalizePdcaData(item, phase) as any,
          isAiSuggested: Boolean(item.isAiSuggested),
          convertedToTaskId: nonEmptyText(item.convertedToTaskId),
          completedAt: item.completedAt ? coerceDate(item.completedAt) : (status === ActionStepStatus.DONE || status === ActionStepStatus.VALIDATED ? new Date() : null),
        };
      });
      await this.prisma.actionPdcaStep.createMany({ data: rows });
    }
    if (method === ActionAnalysisTool.FIVE_W_TWO_H) {
      await this.prisma.actionFiveW2H.deleteMany({ where: { sessionId } });
      const item = body.fiveW2H ?? {};
      await this.prisma.actionFiveW2H.create({
        data: {
          sessionId,
          what: item.what ?? null,
          why: item.why ?? null,
          where: item.where ?? null,
          when: item.when ? new Date(item.when) : null,
          who: item.who ?? null,
          how: item.how ?? null,
          howMuch: item.howMuch === '' || item.howMuch === undefined ? null : Number(item.howMuch),
          reviewNotes: item.reviewNotes ?? null,
          completeScore: fiveW2HScore(item),
        },
      });
    }
  }

  private async actionTraceContext(actionId: string) {
    const action = await this.prisma.actionPlan.findUnique({
      where: { id: actionId },
      select: {
        companyId: true,
        indicatorId: true,
        treatmentId: true,
        deviation: { select: { indicatorId: true } },
        origin: true,
        originRefId: true,
      },
    });
    if (!action) throw new NotFoundException('Ação nao encontrada');
    let indicatorId = action.indicatorId ?? action.deviation?.indicatorId ?? null;
    if (!indicatorId && action.origin === ActionOrigin.INDICATOR) indicatorId = action.originRefId;
    return { companyId: action.companyId, indicatorId, treatmentId: action.treatmentId };
  }

  private async updateTreatmentFromActions(treatmentId: string) {
    const actions = await this.prisma.actionPlan.findMany({
      where: { treatmentId, deletedAt: null },
      select: { status: true, dueDate: true },
    });
    if (actions.length === 0) return;
    const now = new Date();
    const allDone = actions.every((action) => finalStatuses.includes(action.status));
    const hasOverdue = actions.some((action) => action.dueDate && action.dueDate < now && !finalStatuses.includes(action.status));
    const status = allDone
      ? TreatmentStatus.AWAITING_REEVALUATION
      : hasOverdue
        ? TreatmentStatus.ACTIONS_OVERDUE
        : TreatmentStatus.ACTIONS_IN_PROGRESS;
    await this.prisma.treatmentCase.update({ where: { id: treatmentId }, data: { status } });
  }

  private buildOriginTrail(action: any) {
    const trail = [];
    if (action.strategicObjective) trail.push({ type: 'Objetivo estratégico', label: action.strategicObjective.name, href: `/strategy/${action.strategicObjective.mapId ?? action.strategicObjective.map?.id ?? ''}` });
    if (action.ownerNode) trail.push({ type: 'Area/Setor', label: action.ownerNode.name, href: '/org' });
    if (action.indicator) trail.push({ type: 'Indicador', label: action.indicator.name, href: `/indicators/${action.indicator.id}` });
    if (action.indicatorResult) trail.push({ type: 'Resultado', label: `${action.indicatorResult.periodRef} - ${action.indicatorResult.light}`, href: action.indicator ? `/indicators/${action.indicator.id}` : undefined });
    if (action.deviation) trail.push({ type: 'Desvio', label: `#${action.deviation.number} ${action.deviation.title}`, href: `/deviations/${action.deviation.id}` });
    if (action.analysis) trail.push({ type: 'Análise de causa', label: action.analysis.method, href: action.deviation ? `/deviations/${action.deviation.id}` : undefined });
    if (action.meeting) trail.push({ type: 'Reunião', label: action.meeting.title, href: `/meetings/${action.meeting.id}` });
    trail.push({ type: 'Plano de ação', label: action.title, href: `/actions/${action.id}` });
    return trail;
  }

  private assessActionReadiness(action: any) {
    const gaps = [];
    if (!action.rootCause && action.analysisSessions.length === 0) gaps.push('Causa raiz ainda nao registrada.');
    if (!action.responsibleUserId && !action.responsibleEmail) gaps.push('Responsável nao definido.');
    if (!action.dueDate) gaps.push('Prazo final ausente.');
    if (!action.expectedResult) gaps.push('Resultado esperado ausente.');
    if (action.evidenceRequired && action.evidences.length === 0) gaps.push('Evidencia esperada ainda nao anexada.');
    return {
      score: Math.max(0, 100 - gaps.length * 18),
      gaps,
    };
  }

  private generateSuggestions(action: any, scope?: string) {
    const context = {
      scope: scope ?? 'general',
      indicator: action.indicator?.name,
      objective: action.strategicObjective?.name,
      area: action.ownerNode?.name,
      status: action.status,
      dueDate: action.dueDate,
    };
    const rootCause = action.rootCause || action.analysisSessions?.[0]?.rootCause;
    const problem = action.problemDescription || action.description || action.deviation?.title || action.indicator?.name || action.title;
    return [
      {
        type: 'QUESTION',
        title: 'Pergunta de aprofundamento',
        content: rootCause
          ? `Confirme se a causa raiz "${rootCause}" possui evidencia objetiva e esta sob controle da area responsável.`
          : `A causa raiz ainda parece indefinida. Use 5 Porques ou Ishikawa para separar sintoma de causa do problema: "${problem}".`,
        context,
      },
      {
        type: 'ACTION',
        title: 'Sugestão de ação estruturada',
        content: `Defina uma ação em formato 5W2H: o que será feito, por que resolve a causa, quem responde, prazo, local, metodo de execucao, custo estimado e evidencia esperada.`,
        context,
      },
      {
        type: 'EFFECTIVENESS',
        title: 'Criterio de eficacia',
        content: action.indicator
          ? `Valide a eficacia comparando o próximo resultado do indicador "${action.indicator.name}" com o resultado que gerou o plano e anexe evidencia da melhoria.`
          : `Defina um indicador de eficacia antes de concluir o plano, para evitar encerrar a ação apenas por entrega de tarefa.`,
        context,
      },
    ];
  }

  private async hydrateGeneralApprovals(rows: any[]) {
    if (rows.length === 0) return [];
    const userIds = Array.from(new Set(rows.flatMap((row) => [row.requesterId, row.approverId].filter(Boolean))));
    const actionIds = rows
      .filter((row) => row.entityType === 'ActionPlan')
      .map((row) => row.entityId);
    const [users, actions] = await Promise.all([
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds as string[] } },
            select: { id: true, name: true, email: true, role: true },
          })
        : Promise.resolve([]),
      actionIds.length
        ? this.prisma.actionPlan.findMany({
            where: { id: { in: actionIds } },
            select: {
              id: true,
              title: true,
              status: true,
              deletedAt: true,
              responsibleUser: { select: { id: true, name: true, email: true } },
              ownerNode: { select: { id: true, name: true } },
            },
          })
        : Promise.resolve([]),
    ]);
    const userById = new Map(users.map((user) => [user.id, user]));
    const actionById = new Map(actions.map((action) => [action.id, action]));
    return rows.map((row) => ({
      ...row,
      requester: row.requesterId ? userById.get(row.requesterId) ?? null : null,
      approver: row.approverId ? userById.get(row.approverId) ?? null : null,
      actionPlan: row.entityType === 'ActionPlan' ? actionById.get(row.entityId) ?? null : null,
    }));
  }

  private methodToTool(method: string | null | undefined): ActionAnalysisTool | null {
    if (!method) return null;
    if (method === 'FIVE_WHYS') return ActionAnalysisTool.FIVE_WHYS;
    if (method === 'ISHIKAWA') return ActionAnalysisTool.ISHIKAWA;
    if (method === 'MASP') return ActionAnalysisTool.MASP;
    if (method === 'PDCA') return ActionAnalysisTool.PDCA;
    if (method === 'PARETO') return ActionAnalysisTool.PARETO;
    if (method === 'FCA') return ActionAnalysisTool.FCA;
    return ActionAnalysisTool.ROOT_CAUSE;
  }

  private async recordHistory(actionId: string, userId: string | undefined, eventType: string, field: string | null, beforeValue: string | null, afterValue: string | null) {
    await this.prisma.actionHistory.create({
      data: { actionId, userId: userId ?? null, eventType, field, beforeValue, afterValue },
    });
  }

  private async audit(companyId: string | null | undefined, userId: string | undefined, action: string, entity: string, entityId: string, beforeValue: unknown, afterValue: unknown) {
    await this.prisma.auditLog.create({
      data: {
        companyId: companyId ?? null,
        userId: userId ?? null,
        action,
        module: 'Planos de ação',
        entity,
        entityId,
        beforeValue: stringify(beforeValue),
        afterValue: stringify(afterValue),
        result: 'SUCCESS',
      },
    });
  }
}

function defaultMaspSteps() {
  return [
    { step: 1, title: 'Identificação do problema' },
    { step: 2, title: 'Observacao' },
    { step: 3, title: 'Análise' },
    { step: 4, title: 'Plano de ação' },
    { step: 5, title: 'Execucao' },
    { step: 6, title: 'Verificação' },
    { step: 7, title: 'Padronizacao' },
    { step: 8, title: 'Conclusão' },
  ];
}

function defaultPdcaSteps() {
  return ['PLAN', 'DO', 'CHECK', 'ACT'].map((phase) => ({
    phase,
    title: pdcaPhaseLabel(phase),
    subtitle: pdcaPhaseSubtitle(phase),
    status: ActionStepStatus.PENDING,
    progress: 0,
    checklist: defaultPdcaChecklist(phase),
  }));
}

function normalizePdcaPhase(value: unknown, index = 0) {
  const key = normalizeKey(value);
  const map: Record<string, string> = {
    PLAN: 'PLAN',
    PLANEJAR: 'PLAN',
    DO: 'DO',
    EXECUTAR: 'DO',
    CHECK: 'CHECK',
    CHECAR: 'CHECK',
    VERIFICAR: 'CHECK',
    ACT: 'ACT',
    AGIR: 'ACT',
    PADRONIZAR: 'ACT',
  };
  return map[key] ?? ['PLAN', 'DO', 'CHECK', 'ACT'][index] ?? 'PLAN';
}

function pdcaPhaseLabel(value: unknown) {
  const phase = normalizePdcaPhase(value);
  const labels: Record<string, string> = {
    PLAN: 'Plan',
    DO: 'Do',
    CHECK: 'Check',
    ACT: 'Act',
  };
  return labels[phase] ?? phase;
}

function pdcaPhaseSubtitle(value: unknown) {
  const phase = normalizePdcaPhase(value);
  const subtitles: Record<string, string> = {
    PLAN: 'Planejar causas, metas e ações',
    DO: 'Executar ações definidas',
    CHECK: 'Medir resultados e verificar eficácia',
    ACT: 'Padronizar, corrigir e evoluir',
  };
  return subtitles[phase] ?? '';
}

function normalizeActionStepStatus(value: unknown): ActionStepStatus {
  const key = normalizeKey(value);
  const map: Record<string, ActionStepStatus> = {
    PENDING: ActionStepStatus.PENDING,
    PENDENTE: ActionStepStatus.PENDING,
    IN_PROGRESS: ActionStepStatus.IN_PROGRESS,
    EM_ANDAMENTO: ActionStepStatus.IN_PROGRESS,
    DONE: ActionStepStatus.DONE,
    CONCLUIDA: ActionStepStatus.DONE,
    CONCLUIDO: ActionStepStatus.DONE,
    BLOCKED: ActionStepStatus.BLOCKED,
    BLOQUEADA: ActionStepStatus.BLOCKED,
    BLOQUEADO: ActionStepStatus.BLOCKED,
    VALIDATED: ActionStepStatus.VALIDATED,
    VALIDADA: ActionStepStatus.VALIDATED,
    REOPENED: ActionStepStatus.IN_PROGRESS,
    REABERTA: ActionStepStatus.IN_PROGRESS,
    OVERDUE: ActionStepStatus.IN_PROGRESS,
    ATRASADA: ActionStepStatus.IN_PROGRESS,
  };
  return map[key] ?? ActionStepStatus.PENDING;
}

function clampProgress(value: unknown) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function defaultPdcaChecklist(value: unknown) {
  const phase = normalizePdcaPhase(value);
  const items: Record<string, string[]> = {
    PLAN: ['Problema definido', 'Causa raiz validada', 'Meta definida', 'Responsável definido', 'Prazo definido'],
    DO: ['Ações iniciadas', 'Responsáveis acionados', 'Evidências coletadas', 'Impedimentos registrados'],
    CHECK: ['Indicador medido', 'Resultado comparado com a meta', 'Eficácia avaliada', 'Desvio registrado'],
    ACT: ['Lições aprendidas registradas', 'Ajustes definidos', 'Padronização criada', 'Próximo ciclo definido'],
  };
  return (items[phase] ?? []).map((title, index) => ({ id: `${phase}-${index + 1}`, title, done: false }));
}

function normalizePdcaChecklist(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => ({
      id: nonEmptyText((item as any)?.id) ?? `item-${index + 1}`,
      title: nonEmptyText((item as any)?.title) ?? nonEmptyText(item) ?? `Item ${index + 1}`,
      done: Boolean((item as any)?.done),
    }))
    .filter((item) => item.title);
}

function normalizePdcaData(item: any, phase: string) {
  const reserved = new Set([
    'id',
    'sessionId',
    'phase',
    'title',
    'subtitle',
    'description',
    'objective',
    'responsibleUserId',
    'dueDate',
    'priority',
    'progress',
    'evidence',
    'comments',
    'status',
    'validated',
    'checklist',
    'data',
    'isAiSuggested',
    'convertedToTaskId',
    'completedAt',
    'createdAt',
    'updatedAt',
  ]);
  const data = item.data && typeof item.data === 'object' && !Array.isArray(item.data) ? { ...item.data } : {};
  for (const [key, value] of Object.entries(item)) {
    if (!reserved.has(key)) data[key] = value;
  }
  return { ...data, phase };
}

function defaultPdcaSuggestions(action: any, stages: any[]) {
  const filled = new Set(stages.map((stage) => `${normalizePdcaPhase(stage.phase)}:${normalizeKey(stage.description ?? stage.objective ?? '')}`));
  const indicatorName = action.indicator?.name ?? 'indicador relacionado';
  const suggestions = [
    {
      phase: 'PLAN',
      field: 'objective',
      suggestion: `Definir claramente o problema, a causa raiz e a meta de melhoria para ${action.title}.`,
      justification: 'A etapa Plan precisa deixar explícitos objetivo, meta, responsável e critério de sucesso antes da execução.',
    },
    {
      phase: 'PLAN',
      field: 'checklist',
      suggestion: 'Validar problema, causa raiz, meta, responsável, prazo, riscos e recursos necessários.',
      justification: 'Checklist reduz risco de avançar para execução sem premissas mínimas.',
    },
    {
      phase: 'DO',
      field: 'description',
      suggestion: 'Executar as ações priorizadas, registrar impedimentos e anexar evidências operacionais por etapa.',
      justification: 'A execução deve gerar rastreabilidade para posterior verificação de eficácia.',
    },
    {
      phase: 'CHECK',
      field: 'measurement',
      suggestion: `Comparar o realizado do ${indicatorName} com a meta e registrar desvio, tendência e evidência da medição.`,
      justification: 'A etapa Check deve confirmar se a melhoria está aparecendo nos dados.',
    },
    {
      phase: 'ACT',
      field: 'standardization',
      suggestion: 'Registrar lições aprendidas, padronizar o novo procedimento e definir próxima revisão do ciclo.',
      justification: 'A etapa Act evita que a melhoria fique apenas como ação pontual.',
    },
  ];
  return suggestions.filter((item) => !filled.has(`${item.phase}:${normalizeKey(item.suggestion)}`));
}

function fiveW2HScore(item: any) {
  const keys = ['what', 'why', 'where', 'when', 'who', 'how', 'howMuch'];
  const filled = keys.filter((key) => item[key] !== undefined && item[key] !== null && item[key] !== '').length;
  return Math.round((filled / keys.length) * 100);
}

const ISHIKAWA_CATEGORY_LABELS: Record<string, string> = {
  METHOD: 'Método',
  MACHINE: 'Máquina',
  MANPOWER: 'Mão de obra',
  MATERIAL: 'Material',
  ENVIRONMENT: 'Meio ambiente',
  MEASUREMENT: 'Medição',
};

function nonEmptyText(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function persistedId(value: unknown) {
  const text = nonEmptyText(value);
  return text && !text.startsWith('temp-') ? text : null;
}

function normalizeKey(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeIshikawaCategory(value: unknown) {
  const key = normalizeKey(value);
  const map: Record<string, string> = {
    METHOD: 'METHOD',
    METODO: 'METHOD',
    MACHINE: 'MACHINE',
    MAQUINA: 'MACHINE',
    MANPOWER: 'MANPOWER',
    MAO_DE_OBRA: 'MANPOWER',
    MAO_OBRA: 'MANPOWER',
    MATERIAL: 'MATERIAL',
    ENVIRONMENT: 'ENVIRONMENT',
    MEIO_AMBIENTE: 'ENVIRONMENT',
    MEASUREMENT: 'MEASUREMENT',
    MEDICAO: 'MEASUREMENT',
  };
  return map[key] ?? 'METHOD';
}

function ishikawaCategoryLabel(value: unknown) {
  const category = normalizeIshikawaCategory(value);
  return ISHIKAWA_CATEGORY_LABELS[category] ?? category;
}

function normalizeActionPriority(value: unknown): ActionPriority {
  const key = normalizeKey(value);
  const map: Record<string, ActionPriority> = {
    LOW: ActionPriority.LOW,
    BAIXA: ActionPriority.LOW,
    MEDIUM: ActionPriority.MEDIUM,
    MEDIA: ActionPriority.MEDIUM,
    HIGH: ActionPriority.HIGH,
    ALTA: ActionPriority.HIGH,
    CRITICAL: ActionPriority.CRITICAL,
    CRITICA: ActionPriority.CRITICAL,
  };
  return map[key] ?? ActionPriority.MEDIUM;
}

function normalizeCauseStatus(value: unknown, rootCause?: unknown) {
  if (rootCause) return 'ROOT_CAUSE';
  const key = normalizeKey(value);
  const map: Record<string, string> = {
    DRAFT: 'DRAFT',
    RASCUNHO: 'DRAFT',
    IN_REVIEW: 'IN_REVIEW',
    EM_ANALISE: 'IN_REVIEW',
    LIKELY_CAUSE: 'LIKELY_CAUSE',
    CAUSA_PROVAVEL: 'LIKELY_CAUSE',
    ROOT_CAUSE: 'ROOT_CAUSE',
    CAUSA_RAIZ: 'ROOT_CAUSE',
    DISCARDED: 'DISCARDED',
    DESCARTADA: 'DISCARDED',
    CONVERTED_TO_ACTION: 'CONVERTED_TO_ACTION',
    CONVERTIDA_EM_PLANO_DE_ACAO: 'CONVERTED_TO_ACTION',
  };
  return map[key] ?? 'DRAFT';
}

function clampScale(value: unknown) {
  const numeric = Number(value ?? 3);
  if (!Number.isFinite(numeric)) return 3;
  return Math.max(1, Math.min(5, Math.round(numeric)));
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function coerceDate(value: unknown) {
  const text = nonEmptyText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  const text = nonEmptyText(value);
  return text ? text.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

function defaultIshikawaCauseSuggestions(problem: string, causes: any[]) {
  const context = problem ? `Relacionada ao problema: ${problem}` : 'Sugestão para discussão da equipe.';
  const existing = new Set(
    causes
      .map((cause) => normalizeKey(cause.title ?? cause.description))
      .filter(Boolean),
  );
  const suggestions = [
    { category: 'METHOD', title: 'Parâmetros operacionais não padronizados', priority: ActionPriority.HIGH, justification: `${context} Verifique se os critérios de operação estão claros, medidos e seguidos por turno.` },
    { category: 'METHOD', title: 'Frequência de limpeza inadequada', priority: ActionPriority.MEDIUM, justification: 'Pode indicar rotina preventiva insuficiente para manter estabilidade do processo.' },
    { category: 'METHOD', title: 'Baixa embebição', priority: ActionPriority.HIGH, justification: 'Hipótese relevante quando há perda ou extração abaixo do esperado no bagaço.' },
    { category: 'MACHINE', title: 'Desgaste de rolos difusores', priority: ActionPriority.HIGH, justification: 'Falhas mecânicas podem reduzir eficiência e gerar variação operacional.' },
    { category: 'MACHINE', title: 'Calibração inadequada de instrumentos', priority: ActionPriority.MEDIUM, justification: 'Instrumentos fora de calibração podem mascarar o desvio real.' },
    { category: 'MACHINE', title: 'Falha em sensores de vazão', priority: ActionPriority.MEDIUM, justification: 'Medições incorretas podem induzir ajustes operacionais equivocados.' },
    { category: 'MANPOWER', title: 'Procedimento não seguido', priority: ActionPriority.HIGH, justification: 'Avalie aderência ao procedimento padrão e variações entre equipes.' },
    { category: 'MANPOWER', title: 'Treinamento insuficiente', priority: ActionPriority.MEDIUM, justification: 'Pode explicar decisões manuais inconsistentes e baixa repetibilidade.' },
    { category: 'MANPOWER', title: 'Ajustes manuais inconsistentes', priority: ActionPriority.MEDIUM, justification: 'Ajustes sem critério padronizado aumentam dispersão do resultado.' },
    { category: 'MATERIAL', title: 'Variação da matéria-prima', priority: ActionPriority.HIGH, justification: 'Mudanças na qualidade de entrada podem alterar o desempenho do processo.' },
    { category: 'MATERIAL', title: 'Qualidade do bagaço fora do padrão', priority: ActionPriority.MEDIUM, justification: 'A condição do material pode impactar diretamente a perda medida.' },
    { category: 'ENVIRONMENT', title: 'Temperatura ambiente elevada', priority: ActionPriority.MEDIUM, justification: 'Condições ambientais extremas podem afetar estabilidade e medições.' },
    { category: 'ENVIRONMENT', title: 'Ventilação inadequada', priority: ActionPriority.LOW, justification: 'Ambiente operacional inadequado pode contribuir para variações indiretas.' },
    { category: 'MEASUREMENT', title: 'Falha no monitoramento', priority: ActionPriority.HIGH, justification: 'Sem monitoramento consistente, a equipe pode reagir tarde ao desvio.' },
    { category: 'MEASUREMENT', title: 'Amostragem inconsistente', priority: ActionPriority.MEDIUM, justification: 'Amostras não representativas comprometem a leitura do indicador.' },
    { category: 'MEASUREMENT', title: 'Equipamentos de medição descalibrados', priority: ActionPriority.MEDIUM, justification: 'Valide calibração e rastreabilidade antes de confirmar a causa raiz.' },
  ];
  return suggestions.filter((item) => !existing.has(normalizeKey(item.title))).slice(0, 12);
}

function stringify(value: unknown) {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}
