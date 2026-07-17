import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { WorkItemPriorityService } from './work-item-priority.service';
import type { WorkItemAction } from '@g360/shared';
import { matchesAudience, type AudienceRule } from '../communication/organizational/audience.util';

/** Item "rascunho" coletado de um modulo de origem, antes da priorização. */
interface WorkItemDraft {
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: string;
  itemType: string;
  title: string;
  summary?: string | null;
  status: string;
  criticality?: string | null;
  dueAt?: Date | null;
  assignedUserId: string;
  requesterUserId?: string | null;
  managerUserId?: string | null;
  branchId?: string | null;
  orgNodeId?: string | null;
  processId?: string | null;
  workflowInstanceId?: string | null;
  workflowNodeKey?: string | null;
  requiresDecision?: boolean;
  requiresEvidence?: boolean;
  isBlocking?: boolean;
  isExternal?: boolean;
  isDelegated?: boolean;
  delegatedFromUserId?: string | null;
  recommendedAction?: string | null;
  availableActions: WorkItemAction[];
  context?: Record<string, unknown> | null;
  sourceCreatedAt?: Date | null;
  sourceUpdatedAt?: Date | null;
}

const ACTIVE_ACTION_STATUS = [
  'NOT_STARTED', 'UNDER_ANALYSIS', 'IN_PROGRESS', 'WAITING_THIRD',
  'WAITING_EVIDENCE', 'WAITING_VALIDATION', 'PAUSED', 'REOPENED',
];
const OPEN_RISK_STATUS = ['IDENTIFIED', 'ANALYZING', 'MITIGATING', 'MONITORING'];
const OPEN_NC_STATUS = ['OPEN', 'TRIAGE', 'ANALYSIS', 'ACTION', 'VERIFICATION'];
const DOC_APPROVAL_STATUS = ['WAITING_APPROVAL', 'IN_APPROVAL'];
const DOC_REVIEW_STATUS = ['WAITING_REVIEW', 'ADJUSTMENTS_REQUESTED', 'PERIODIC_REVIEW', 'NEAR_EXPIRATION', 'EXPIRED'];

/**
 * Camada central de leitura/agregação da Central "Meu Dia".
 * Consulta os módulos AUTORIZADOS, consolida itens relevantes do usuário e
 * mantém a projeção WorkItemIndex (que SEMPRE referencia o registro original).
 * Nunca duplica o registro de origem como fonte oficial.
 */
@Injectable()
export class WorkItemAggregationService {
  private readonly logger = new Logger(WorkItemAggregationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly priority: WorkItemPriorityService,
  ) {}

  /** Reconstrói a fatia do índice pertencente ao usuário, a partir das fontes. */
  async rebuildForUser(me: AuthPayload): Promise<number> {
    const companyId = me.companyId;
    const now = new Date();

    const drafts = await this.collectSources(me);
    const delegations = await this.activeDelegations(me, now);
    for (const delegation of delegations) {
      const delegated = await this.collectSources({
        sub: delegation.delegatorUserId,
        companyId,
        email: delegation.delegator.email,
        name: delegation.delegator.name,
        role: delegation.delegator.role as any,
      });
      drafts.push(...delegated.map((d) => ({
        ...d,
        assignedUserId: me.sub,
        isDelegated: true,
        delegatedFromUserId: delegation.delegatorUserId,
        context: {
          ...(d.context ?? {}),
          delegationId: delegation.id,
          delegatedFromUserId: delegation.delegatorUserId,
          delegatedFromName: delegation.delegator.name,
          delegationReason: delegation.reason,
        },
      })));
    }

    const seenKeys: string[] = [];
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const d of drafts) {
      const dedupeKey = `${d.sourceEntityType}:${d.sourceEntityId}:${d.itemType}:${d.assignedUserId}`;
      seenKeys.push(dedupeKey);
      const p = this.priority.compute({
        itemType: d.itemType,
        criticality: d.criticality,
        dueAt: d.dueAt ?? null,
        isBlocking: d.isBlocking,
        requiresDecision: d.requiresDecision,
        now,
      });
      const data = {
        sourceModule: d.sourceModule,
        sourceEntityType: d.sourceEntityType,
        sourceEntityId: d.sourceEntityId,
        workflowInstanceId: d.workflowInstanceId ?? null,
        workflowNodeKey: d.workflowNodeKey ?? null,
        itemType: d.itemType,
        title: d.title,
        summary: d.summary ?? null,
        status: d.status,
        priority: p.priority,
        priorityScore: p.priorityScore,
        priorityReason: p.priorityReason,
        criticality: d.criticality ?? null,
        dueAt: d.dueAt ?? null,
        overdueDays: p.overdueDays,
        slaStatus: p.slaStatus,
        assignedUserId: d.assignedUserId,
        requesterUserId: d.requesterUserId ?? null,
        managerUserId: d.managerUserId ?? null,
        branchId: d.branchId ?? null,
        orgNodeId: d.orgNodeId ?? null,
        processId: d.processId ?? null,
        contextData: (d.context ?? undefined) as any,
        availableActions: (d.availableActions ?? []) as any,
        recommendedAction: d.recommendedAction ?? null,
        requiresDecision: !!d.requiresDecision,
        requiresEvidence: !!d.requiresEvidence,
        isBlocking: !!d.isBlocking,
        isExternal: !!d.isExternal,
        isDelegated: !!d.isDelegated,
        delegatedFromUserId: d.delegatedFromUserId ?? null,
        sourceCreatedAt: d.sourceCreatedAt ?? null,
        sourceUpdatedAt: d.sourceUpdatedAt ?? null,
        refreshedAt: now,
      };
      ops.push(
        this.prisma.workItemIndex.upsert({
          where: { dedupeKey },
          create: { companyId, dedupeKey, ...data },
          update: data,
        }),
      );
    }

    // Remove itens que não estão mais pendentes para este usuário (resolvidos na origem).
    ops.push(
      this.prisma.workItemIndex.deleteMany({
        where: { companyId, assignedUserId: me.sub, dedupeKey: { notIn: seenKeys.length ? seenKeys : ['__none__'] } },
      }),
    );

    // Uma única transação em vez de N upserts sequenciais: colapsa N+1 round-trips
    // ao banco em um só lote. Era o principal gargalo do "Meu Dia" — agravado pela
    // migração para o Postgres gerenciado (maior latência por round-trip).
    await this.prisma.$transaction(ops);

    return drafts.length;
  }

  private async collectSources(me: AuthPayload): Promise<WorkItemDraft[]> {
    return (
      await Promise.all([
        this.collectActions(me).catch((e) => this.warn('actions', e)),
        this.collectActionTasks(me).catch((e) => this.warn('action-tasks', e)),
        this.collectProjectTasks(me).catch((e) => this.warn('project-tasks', e)),
        this.collectWorkflowTasks(me).catch((e) => this.warn('workflow-tasks', e)),
        this.collectApprovals(me).catch((e) => this.warn('approvals', e)),
        this.collectMeetingsToday(me).catch((e) => this.warn('meetings', e)),
        this.collectDocuments(me).catch((e) => this.warn('documents', e)),
        this.collectAudits(me).catch((e) => this.warn('audits', e)),
        this.collectAuditFindings(me).catch((e) => this.warn('audit-findings', e)),
        this.collectFormSubmissions(me).catch((e) => this.warn('form-submissions', e)),
        this.collectRisks(me).catch((e) => this.warn('risks', e)),
        this.collectNonConformities(me).catch((e) => this.warn('nonconformities', e)),
        this.collectIndicatorsOffTarget(me).catch((e) => this.warn('indicators', e)),
        this.collectNotifications(me).catch((e) => this.warn('notifications', e)),
        this.collectUnreadCommunications(me).catch((e) => this.warn('communications', e)),
        this.collectSecurityIncidents(me).catch((e) => this.warn('security-incidents', e)),
        this.collectTimeClock(me).catch((e) => this.warn('time-clock', e)),
        this.collectVacations(me).catch((e) => this.warn('vacations', e)),
        this.collectPersonnelLifecycle(me).catch((e) => this.warn('personnel-lifecycle', e)),
        this.collectSupplies(me).catch((e) => this.warn('supplies', e)),
        this.collectRecruitment(me).catch((e) => this.warn('recruitment', e)),
        this.collectCompensation(me).catch((e) => this.warn('compensation', e)),
      ])
    ).flat();
  }

  private async activeDelegations(me: AuthPayload, now: Date) {
    return this.prisma.userDelegation.findMany({
      where: {
        companyId: me.companyId,
        delegateUserId: me.sub,
        status: 'ACTIVE',
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      select: {
        id: true,
        delegatorUserId: true,
        reason: true,
        delegator: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  /** Reconstrói a fatia de um usuário arbitrário (bus de eventos / visão de equipe). */
  async rebuildFor(companyId: string, userId: string): Promise<number> {
    return this.rebuildForUser({ sub: userId, companyId, email: '', name: '', role: 'VIEWER' as any });
  }

  private warn(source: string, e: unknown): WorkItemDraft[] {
    this.logger.warn(`Falha ao coletar ${source}: ${(e as Error)?.message}`);
    return [];
  }

  // ---------- Coletores por fonte ----------

  private async collectActions(me: AuthPayload): Promise<WorkItemDraft[]> {
    const rows = await this.prisma.actionPlan.findMany({
      where: { companyId: me.companyId, deletedAt: null, responsibleUserId: me.sub, status: { in: ACTIVE_ACTION_STATUS as any } },
      select: {
        id: true, title: true, status: true, criticality: true, priority: true, dueDate: true,
        ownerNodeId: true, progress: true, evidenceRequired: true, origin: true, createdAt: true, updatedAt: true,
      },
    });
    const now = Date.now();
    return rows.map((a) => {
      const overdue = a.dueDate ? a.dueDate.getTime() < now : false;
      return {
        sourceModule: 'actions',
        sourceEntityType: 'ACTION_PLAN',
        sourceEntityId: a.id,
        itemType: overdue ? 'OVERDUE_ACTION' : 'TASK',
        title: a.title,
        summary: `Plano de ação · ${a.progress ?? 0}% concluído`,
        status: a.status,
        criticality: (a.criticality ?? a.priority ?? 'MEDIUM') as string,
        dueAt: a.dueDate,
        assignedUserId: me.sub,
        orgNodeId: a.ownerNodeId,
        requiresEvidence: a.evidenceRequired,
        recommendedAction: overdue ? 'Atualizar prazo ou justificar atraso' : 'Atualizar progresso',
        availableActions: [
          { key: 'open', label: 'Abrir plano', href: `/actions?id=${a.id}` },
          { key: 'vision360', label: 'Abrir Visão 360°', inline: true },
        ],
        context: { progress: a.progress, origin: a.origin },
        sourceCreatedAt: a.createdAt,
        sourceUpdatedAt: a.updatedAt,
      };
    });
  }

  /** Cada etapa real de um plano aparece individualmente na Central de Trabalho. */
  private async collectActionTasks(me: AuthPayload): Promise<WorkItemDraft[]> {
    const rows = await this.prisma.actionTask.findMany({
      where: {
        assignedToId: me.sub,
        done: false,
        action: { companyId: me.companyId, deletedAt: null },
      },
      select: {
        id: true,
        actionId: true,
        title: true,
        dueDate: true,
        startDate: true,
        createdAt: true,
        updatedAt: true,
        action: {
          select: {
            title: true,
            ownerNodeId: true,
            priority: true,
            criticality: true,
            evidenceRequired: true,
          },
        },
      },
    });
    return rows.map((task) => ({
      sourceModule: 'actions',
      sourceEntityType: 'ACTION_TASK',
      sourceEntityId: task.id,
      itemType: 'TASK',
      title: task.title,
      summary: `Tarefa do plano: ${task.action.title}`,
      status: task.startDate ? 'IN_PROGRESS' : 'OPEN',
      criticality: String(task.action.criticality ?? task.action.priority ?? 'MEDIUM'),
      dueAt: task.dueDate,
      assignedUserId: me.sub,
      orgNodeId: task.action.ownerNodeId,
      requiresEvidence: task.action.evidenceRequired,
      recommendedAction: 'Executar a tarefa e registrar evidências',
      availableActions: [
        { key: 'open', label: 'Abrir tarefa no plano', href: `/actions/${task.actionId}` },
        { key: 'vision360', label: 'Abrir Visão 360°', inline: true },
      ],
      context: { actionId: task.actionId, actionTitle: task.action.title },
      sourceCreatedAt: task.createdAt,
      sourceUpdatedAt: task.updatedAt,
    }));
  }

  /** Projetos legados guardam o responsável por nome; a comparação é exata e case-insensitive. */
  private async collectProjectTasks(me: AuthPayload): Promise<WorkItemDraft[]> {
    if (!me.name.trim()) return [];
    const rows = await this.prisma.projectTask.findMany({
      where: {
        progress: { lt: 100 },
        responsible: { equals: me.name, mode: 'insensitive' },
        project: { companyId: me.companyId, deletedAt: null },
      },
      select: {
        id: true,
        projectId: true,
        name: true,
        startDate: true,
        endDate: true,
        progress: true,
        project: { select: { name: true } },
      },
    });
    return rows.map((task) => ({
      sourceModule: 'projects',
      sourceEntityType: 'PROJECT_TASK',
      sourceEntityId: task.id,
      itemType: 'TASK',
      title: task.name,
      summary: `Cronograma ${task.project.name} · ${Math.round(task.progress)}% concluído`,
      status: task.progress > 0 ? 'IN_PROGRESS' : 'OPEN',
      criticality: 'MEDIUM',
      dueAt: task.endDate,
      assignedUserId: me.sub,
      recommendedAction: 'Atualizar o progresso no cronograma',
      availableActions: [{ key: 'open', label: 'Abrir cronograma', href: `/projects?id=${task.projectId}` }],
      context: { projectId: task.projectId, projectName: task.project.name, progress: task.progress, startDate: task.startDate },
    }));
  }

  private async collectWorkflowTasks(me: AuthPayload): Promise<WorkItemDraft[]> {
    const rows = await this.prisma.workflowTask.findMany({
      where: { companyId: me.companyId, responsibleId: me.sub, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      select: {
        id: true, title: true, description: true, status: true, priority: true, criticity: true,
        dueAt: true, workflowInstanceId: true, nodeKey: true, requiredEvidence: true,
        escalationLevel: true, type: true, createdAt: true, updatedAt: true,
      },
    });
    return rows.map((t) => ({
      sourceModule: 'automations',
      sourceEntityType: 'WORKFLOW_TASK',
      sourceEntityId: t.id,
      itemType: 'WORKFLOW_TASK',
      title: t.title,
      summary: t.description ?? 'Tarefa gerada por automação',
      status: t.status,
      criticality: t.criticity ?? t.priority ?? 'MEDIUM',
      dueAt: t.dueAt,
      assignedUserId: me.sub,
      workflowInstanceId: t.workflowInstanceId,
      workflowNodeKey: t.nodeKey,
      requiresEvidence: t.requiredEvidence,
      isBlocking: (t.escalationLevel ?? 0) > 0,
      recommendedAction: 'Concluir tarefa do fluxo',
      availableActions: [
        { key: 'open', label: 'Abrir tarefa', href: `/central-automacoes/tarefas?id=${t.id}` },
        { key: 'flow', label: 'Ver andamento do fluxo', inline: true },
        { key: 'vision360', label: 'Abrir Visão 360°', inline: true },
      ],
      context: { type: t.type, escalationLevel: t.escalationLevel },
      sourceCreatedAt: t.createdAt,
      sourceUpdatedAt: t.updatedAt,
    }));
  }

  private async collectApprovals(me: AuthPayload): Promise<WorkItemDraft[]> {
    const rows = await this.prisma.workflowApproval.findMany({
      where: { companyId: me.companyId, approverId: me.sub, status: 'PENDING' },
      select: {
        id: true, approvalType: true, dueAt: true, requesterId: true,
        workflowInstanceId: true, nodeKey: true, createdAt: true,
      },
    });
    return rows.map((ap) => ({
      sourceModule: 'automations',
      sourceEntityType: 'WORKFLOW_APPROVAL',
      sourceEntityId: ap.id,
      itemType: 'APPROVAL',
      title: 'Aprovação aguardando sua decisão',
      summary: `Tipo: ${ap.approvalType}`,
      status: 'PENDING',
      criticality: 'HIGH',
      dueAt: ap.dueAt,
      assignedUserId: me.sub,
      requesterUserId: ap.requesterId,
      workflowInstanceId: ap.workflowInstanceId,
      workflowNodeKey: ap.nodeKey,
      requiresDecision: true,
      isBlocking: true,
      recommendedAction: 'Aprovar, reprovar ou solicitar ajustes',
      availableActions: [
        { key: 'approve', label: 'Aprovar', kind: 'primary', inline: true },
        { key: 'reject', label: 'Reprovar', kind: 'danger', inline: true, requiresJustification: true },
        { key: 'changes', label: 'Solicitar ajustes', inline: true, requiresJustification: true },
        { key: 'flow', label: 'Ver andamento do fluxo', inline: true },
        { key: 'open', label: 'Abrir aprovações', href: `/central-automacoes/aprovacoes` },
      ],
      context: { approvalType: ap.approvalType },
      sourceCreatedAt: ap.createdAt,
    }));
  }

  private async collectMeetingsToday(me: AuthPayload): Promise<WorkItemDraft[]> {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);
    const rows = await this.prisma.meeting.findMany({
      where: {
        companyId: me.companyId, deletedAt: null, status: 'SCHEDULED',
        startsAt: { gte: dayStart, lte: dayEnd },
        OR: [{ responsibleUserId: me.sub }, { participants: { some: { userId: me.sub } } }],
      },
      select: { id: true, title: true, startsAt: true, endsAt: true, responsibleUserId: true, createdAt: true, updatedAt: true },
    });
    return rows.map((m) => ({
      sourceModule: 'meetings',
      sourceEntityType: 'MEETING',
      sourceEntityId: m.id,
      itemType: 'MEETING',
      title: m.title,
      summary: `Reunião às ${m.startsAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      status: 'SCHEDULED',
      criticality: 'MEDIUM',
      dueAt: m.startsAt,
      assignedUserId: me.sub,
      recommendedAction: 'Abrir a reunião e revisar a pauta',
      availableActions: [
        { key: 'open', label: 'Abrir reunião', href: `/meetings?id=${m.id}` },
        { key: 'vision360', label: 'Abrir Visão 360°', inline: true },
      ],
      context: { startsAt: m.startsAt, endsAt: m.endsAt },
      sourceCreatedAt: m.createdAt,
      sourceUpdatedAt: m.updatedAt,
    }));
  }

  private async collectDocuments(me: AuthPayload): Promise<WorkItemDraft[]> {
    const [rows, editRequests] = await Promise.all([
      this.prisma.document.findMany({
        where: {
          companyId: me.companyId, deletedAt: null,
          OR: [
            { approverUserId: me.sub, status: { in: DOC_APPROVAL_STATUS as any } },
            { ownerUserId: me.sub, status: { in: DOC_REVIEW_STATUS as any } },
          ],
        },
        select: { id: true, code: true, title: true, status: true, version: true, orgNodeId: true, approverUserId: true, createdAt: true, updatedAt: true },
      }),
      this.prisma.documentEditRequest.findMany({
        where: {
          companyId: me.companyId,
          OR: [
            { operatorUserId: me.sub, status: 'REQUESTED' },
            { requesterUserId: me.sub, status: { in: ['APPROVED', 'IN_PROGRESS'] } },
          ],
        },
        include: {
          document: { select: { id: true, code: true, title: true, status: true, version: true, orgNodeId: true, createdAt: true, updatedAt: true } },
          requester: { select: { id: true, name: true, email: true } },
          operator: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);
    const documentTasks = rows.map((d) => {
      const isApproval = d.approverUserId === me.sub && (DOC_APPROVAL_STATUS as string[]).includes(d.status as string);
      const expired = d.status === 'EXPIRED' || d.status === 'NEAR_EXPIRATION';
      return {
        sourceModule: 'documents',
        sourceEntityType: 'DOCUMENT',
        sourceEntityId: d.id,
        itemType: 'DOCUMENT_REVIEW',
        title: `${d.code ? d.code + ' · ' : ''}${d.title}`,
        summary: `Documento v${d.version} · ${d.status}`,
        status: d.status as string,
        criticality: expired ? 'HIGH' : 'MEDIUM',
        dueAt: null,
        assignedUserId: me.sub,
        orgNodeId: d.orgNodeId,
        requiresDecision: isApproval,
        recommendedAction: isApproval ? 'Aprovar ou reprovar o documento' : 'Revisar o documento',
        availableActions: [
          { key: 'open', label: 'Abrir documento', href: `/documents?id=${d.id}` },
          { key: 'impact', label: 'Abrir análise de impacto', inline: true },
          { key: 'vision360', label: 'Abrir Visão 360°', inline: true },
        ],
        context: { code: d.code, version: d.version, status: d.status },
        sourceCreatedAt: d.createdAt,
        sourceUpdatedAt: d.updatedAt,
      };
    });
    const editTasks = editRequests.map((r) => {
      const isOperatorTask = r.operatorUserId === me.sub && r.status === 'REQUESTED';
      const d = r.document;
      const availableActions: WorkItemAction[] = isOperatorTask
        ? [
            { key: 'approve', label: 'Liberar edição', kind: 'primary', inline: true },
            { key: 'reject', label: 'Rejeitar', kind: 'danger', inline: true, requiresJustification: true },
            { key: 'open', label: 'Abrir documento', href: `/documents?focus=${d.id}` },
          ]
        : [
            { key: 'open', label: 'Editar documento', href: `/documents?focus=${d.id}&edit=1` },
            { key: 'complete', label: 'Concluir edição', inline: true },
          ];
      return {
        sourceModule: 'documents',
        sourceEntityType: 'DOCUMENT_EDIT_REQUEST',
        sourceEntityId: r.id,
        itemType: isOperatorTask ? 'DOCUMENT_EDIT_APPROVAL' : 'DOCUMENT_EDIT',
        title: isOperatorTask
          ? `Liberar edição: ${d.code ? d.code + ' - ' : ''}${d.title}`
          : `Editar documento: ${d.code ? d.code + ' - ' : ''}${d.title}`,
        summary: isOperatorTask
          ? `Solicitante: ${r.requester?.name ?? 'Usuário'} - ${r.reason ?? 'Sem justificativa'}`
          : `Liberado para edição online - ${r.status}`,
        status: r.status,
        criticality: isOperatorTask ? 'HIGH' : 'MEDIUM',
        dueAt: r.expiresAt,
        assignedUserId: me.sub,
        requesterUserId: r.requesterUserId,
        orgNodeId: d.orgNodeId,
        requiresDecision: isOperatorTask,
        isBlocking: isOperatorTask,
        recommendedAction: isOperatorTask ? 'Aprovar ou rejeitar a edição do documento' : 'Abrir o documento e editar',
        availableActions,
        context: {
          documentId: d.id,
          code: d.code,
          version: d.version,
          status: d.status,
          reason: r.reason,
          requesterName: r.requester?.name,
          operatorName: r.operator?.name,
        },
        sourceCreatedAt: r.createdAt,
        sourceUpdatedAt: r.updatedAt,
      };
    });
    return [...documentTasks, ...editTasks];
  }

  /** Ajustes de ponto pendentes: viram decisão para quem gerencia o ponto. */
  private async collectTimeClock(me: AuthPayload): Promise<WorkItemDraft[]> {
    let canManage = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(String(me.role));
    if (!canManage) {
      const grants = await this.prisma.user.findUnique({
        where: { id: me.sub },
        select: {
          permissions: { select: { permission: { select: { key: true } } } },
          accessProfile: { select: { permissions: { select: { permission: { select: { key: true } } } } } },
        },
      });
      const keys = new Set<string>();
      grants?.permissions.forEach((item) => keys.add(item.permission.key));
      grants?.accessProfile?.permissions.forEach((item) => keys.add(item.permission.key));
      canManage = keys.has('ponto:manage');
    }
    if (!canManage) return [];

    const requests = await this.prisma.timeAdjustmentRequest.findMany({
      where: { companyId: me.companyId, status: 'REQUESTED' },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    if (!requests.length) return [];
    const userIds = [...new Set(requests.map((r) => r.userId))];
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
    const nameById = new Map(users.map((u) => [u.id, u.name]));

    return requests.map((r) => ({
      sourceModule: 'personnel',
      sourceEntityType: 'TIME_ADJUSTMENT_REQUEST',
      sourceEntityId: r.id,
      itemType: 'TIME_ADJUSTMENT_APPROVAL',
      title: `Ajuste de ponto: ${nameById.get(r.userId) ?? 'Colaborador'} — ${r.dayKey}`,
      summary: r.reason,
      status: r.status,
      criticality: 'MEDIUM',
      dueAt: null,
      assignedUserId: me.sub,
      requesterUserId: r.userId,
      requiresDecision: true,
      recommendedAction: 'Aprovar ou rejeitar o ajuste do espelho de ponto',
      availableActions: [{ key: 'open', label: 'Abrir controle de ponto', href: '/servico-pessoal/ponto?tab=ajustes' }],
      context: { dayKey: r.dayKey, proposedTimes: r.proposedTimes },
      sourceCreatedAt: r.createdAt,
      sourceUpdatedAt: r.updatedAt,
    }));
  }

  /** Férias aguardando aprovação (gestor/DP): decisão para quem tem pessoal:update. */
  private async collectVacations(me: AuthPayload): Promise<WorkItemDraft[]> {
    let canDecide = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(String(me.role));
    if (!canDecide) {
      const grants = await this.prisma.user.findUnique({
        where: { id: me.sub },
        select: {
          permissions: { select: { permission: { select: { key: true } } } },
          accessProfile: { select: { permissions: { select: { permission: { select: { key: true } } } } } },
        },
      });
      const keys = new Set<string>();
      grants?.permissions.forEach((item) => keys.add(item.permission.key));
      grants?.accessProfile?.permissions.forEach((item) => keys.add(item.permission.key));
      canDecide = keys.has('pessoal:update') || keys.has('pessoal:manage');
    }
    if (!canDecide) return [];

    const requests = await this.prisma.vacationRequest.findMany({
      where: { companyId: me.companyId, status: { in: ['REQUESTED', 'MANAGER_APPROVED'] } },
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { startDate: 'asc' },
      take: 50,
    });
    return requests.map((r) => ({
      sourceModule: 'personnel',
      sourceEntityType: 'VACATION_REQUEST',
      sourceEntityId: r.id,
      itemType: 'VACATION_APPROVAL',
      title: `Férias: ${r.employee.name} — ${r.days} dia(s)`,
      summary: r.status === 'REQUESTED' ? 'Aguardando aprovação do gestor' : 'Aguardando aprovação final do DP',
      status: r.status,
      criticality: 'MEDIUM',
      dueAt: r.startDate,
      assignedUserId: me.sub,
      requiresDecision: true,
      recommendedAction: 'Aprovar ou rejeitar a solicitação de férias',
      availableActions: [{ key: 'open', label: 'Abrir férias e afastamentos', href: '/servico-pessoal/ferias?tab=solicitacoes' }],
      context: { employeeId: r.employeeId, startDate: r.startDate, endDate: r.endDate, days: r.days },
      sourceCreatedAt: r.createdAt,
      sourceUpdatedAt: r.updatedAt,
    }));
  }

  /** Fase 4 do DP: admissões/desligamentos em andamento e ASOs vencendo/vencidos. */
  private async collectPersonnelLifecycle(me: AuthPayload): Promise<WorkItemDraft[]> {
    let canManage = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(String(me.role));
    if (!canManage) {
      const grants = await this.prisma.user.findUnique({
        where: { id: me.sub },
        select: {
          permissions: { select: { permission: { select: { key: true } } } },
          accessProfile: { select: { permissions: { select: { permission: { select: { key: true } } } } } },
        },
      });
      const keys = new Set<string>();
      grants?.permissions.forEach((item) => keys.add(item.permission.key));
      grants?.accessProfile?.permissions.forEach((item) => keys.add(item.permission.key));
      canManage = keys.has('pessoal:update') || keys.has('pessoal:manage');
    }
    if (!canManage) return [];

    const soon = new Date(Date.now() + 30 * 86_400_000);
    const [processes, exams] = await Promise.all([
      this.prisma.employeeProcess.findMany({
        where: { companyId: me.companyId, status: 'IN_PROGRESS' },
        include: {
          employee: { select: { id: true, name: true } },
          items: { select: { required: true, doneAt: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 30,
      }),
      this.prisma.medicalExam.findMany({
        where: { companyId: me.companyId, deletedAt: null, validUntil: { lte: soon }, employee: { status: 'ACTIVE' } },
        include: { employee: { select: { id: true, name: true } } },
        orderBy: { validUntil: 'asc' },
        take: 30,
      }),
    ]);

    const processItems: WorkItemDraft[] = processes.map((p) => {
      const pending = p.items.filter((item) => item.required && !item.doneAt).length;
      return {
        sourceModule: 'personnel',
        sourceEntityType: 'EMPLOYEE_PROCESS',
        sourceEntityId: p.id,
        itemType: p.kind === 'ONBOARDING' ? 'EMPLOYEE_ONBOARDING' : 'EMPLOYEE_OFFBOARDING',
        title: `${p.kind === 'ONBOARDING' ? 'Admissão' : 'Desligamento'}: ${p.employee.name}`,
        summary: pending > 0 ? `${pending} item(ns) obrigatório(s) pendente(s) no checklist` : 'Checklist completo — pronto para concluir',
        status: p.status,
        criticality: p.dueDate && p.dueDate.getTime() < Date.now() ? 'HIGH' : 'MEDIUM',
        dueAt: p.dueDate,
        assignedUserId: me.sub,
        requiresDecision: pending === 0,
        recommendedAction: pending > 0 ? 'Completar o checklist do processo' : 'Concluir o processo',
        availableActions: [{ key: 'open', label: 'Abrir admissões e desligamentos', href: '/servico-pessoal/admissoes' }],
        context: { employeeId: p.employeeId, kind: p.kind, pending },
        sourceCreatedAt: p.createdAt,
        sourceUpdatedAt: p.updatedAt,
      };
    });

    const examItems: WorkItemDraft[] = exams.map((exam) => {
      const expired = (exam.validUntil?.getTime() ?? 0) < Date.now();
      return {
        sourceModule: 'personnel',
        sourceEntityType: 'MEDICAL_EXAM',
        sourceEntityId: exam.id,
        itemType: 'MEDICAL_EXAM_EXPIRING',
        title: `ASO ${expired ? 'vencido' : 'vencendo'}: ${exam.employee.name}`,
        summary: `${exam.type} válido até ${exam.validUntil?.toISOString().slice(0, 10) ?? '—'}`,
        status: expired ? 'EXPIRED' : 'EXPIRING',
        criticality: expired ? 'HIGH' : 'MEDIUM',
        dueAt: exam.validUntil,
        assignedUserId: me.sub,
        requiresDecision: false,
        recommendedAction: 'Agendar novo exame ocupacional',
        availableActions: [{ key: 'open', label: 'Abrir saúde ocupacional', href: '/servico-pessoal/admissoes?tab=aso' }],
        context: { employeeId: exam.employeeId, type: exam.type, validUntil: exam.validUntil },
        sourceCreatedAt: exam.createdAt,
        sourceUpdatedAt: exam.updatedAt,
      };
    });

    return [...processItems, ...examItems];
  }

  /** Filas operacionais de Suprimentos: comprador, alçada e almoxarifado. */
  private async collectSupplies(me: AuthPayload): Promise<WorkItemDraft[]> {
    const keys = await this.permissionKeys(me.sub);
    const admin = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(String(me.role));
    const canBuy = admin || keys.has('compras:buy') || keys.has('compras:manage');
    const canApprove = admin || keys.has('compras:approve') || keys.has('compras:manage');
    const canOperateStock = admin || keys.has('estoque:operate') || keys.has('estoque:manage');

    const [requisitions, approvals, withdrawals] = await Promise.all([
      canBuy
        ? this.prisma.purchaseRequisition.findMany({
            where: { companyId: me.companyId, OR: [{ status: 'SUBMITTED', buyerId: null }, { buyerId: me.sub, status: { in: ['IN_TRIAGE', 'IN_QUOTATION'] } }] },
            select: { id: true, number: true, title: true, status: true, urgency: true, requesterId: true, buyerId: true, orgNodeId: true, neededAt: true, createdAt: true, updatedAt: true },
            take: 100,
          })
        : [],
      canApprove
        ? this.prisma.purchaseOrderApproval.findMany({
            where: {
              companyId: me.companyId, status: 'PENDING', purchaseOrder: { status: 'PENDING_APPROVAL' },
              OR: [{ approverUserId: me.sub }, { approverUserId: null, approverRole: String(me.role) }, { approverUserId: null, approverRole: null }],
            },
            include: { purchaseOrder: { select: { id: true, number: true, totalAmount: true, createdById: true, expectedDeliveryAt: true, createdAt: true, updatedAt: true, approvals: { select: { level: true, status: true } } } } },
            take: 100,
          })
        : [],
      canOperateStock
        ? this.prisma.materialWithdrawal.findMany({
            where: { companyId: me.companyId, status: { in: ['REQUESTED', 'APPROVED', 'PARTIALLY_FULFILLED'] } },
            include: { warehouse: { select: { name: true, managerUserId: true } }, items: { select: { id: true } } },
            take: 100,
          })
        : [],
    ]);

    const urgency: Record<string, string> = { LOW: 'LOW', NORMAL: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL' };
    const drafts: WorkItemDraft[] = requisitions.map((row) => ({
      sourceModule: 'procurement', sourceEntityType: 'PURCHASE_REQUISITION', sourceEntityId: row.id,
      itemType: row.buyerId ? 'PROCUREMENT_TRIAGE' : 'PROCUREMENT_QUEUE',
      title: `${row.number} · ${row.title}`,
      summary: row.buyerId ? 'Requisição sob sua responsabilidade' : 'Nova requisição na fila do comprador',
      status: row.status, criticality: urgency[row.urgency] ?? 'MEDIUM', dueAt: row.neededAt,
      assignedUserId: me.sub, requesterUserId: row.requesterId, orgNodeId: row.orgNodeId,
      requiresDecision: !row.buyerId, isBlocking: row.urgency === 'CRITICAL',
      recommendedAction: row.buyerId ? 'Concluir triagem e gerar pedido' : 'Assumir a requisição',
      availableActions: [{ key: 'open', label: 'Abrir fila de compras', href: '/suprimentos?tab=requisitions' }],
      context: { number: row.number, urgency: row.urgency, buyerId: row.buyerId }, sourceCreatedAt: row.createdAt, sourceUpdatedAt: row.updatedAt,
    }));

    const actionableApprovals = approvals.filter((step) => !step.purchaseOrder.approvals.some((other) => other.status === 'PENDING' && other.level < step.level));
    drafts.push(...actionableApprovals.map((step) => ({
      sourceModule: 'procurement', sourceEntityType: 'PURCHASE_ORDER_APPROVAL', sourceEntityId: step.id,
      itemType: 'PURCHASE_APPROVAL', title: `Aprovar ${step.purchaseOrder.number}`,
      summary: `Pedido de ${step.purchaseOrder.totalAmount.toString()} · nível ${step.level}`,
      status: step.status, criticality: 'HIGH', dueAt: step.purchaseOrder.expectedDeliveryAt,
      assignedUserId: me.sub, requesterUserId: step.purchaseOrder.createdById, requiresDecision: true, isBlocking: true,
      recommendedAction: 'Aprovar ou rejeitar o pedido de compra',
      availableActions: [{ key: 'open', label: 'Abrir pedidos', href: '/suprimentos?tab=orders' }],
      context: { purchaseOrderId: step.purchaseOrderId, number: step.purchaseOrder.number, level: step.level, orderAmount: step.orderAmount.toString() },
      sourceCreatedAt: step.purchaseOrder.createdAt, sourceUpdatedAt: step.purchaseOrder.updatedAt,
    })));

    drafts.push(...withdrawals
      .filter((row) => !row.warehouse.managerUserId || row.warehouse.managerUserId === me.sub || admin || keys.has('estoque:manage'))
      .map((row) => ({
        sourceModule: 'inventory', sourceEntityType: 'MATERIAL_WITHDRAWAL', sourceEntityId: row.id,
        itemType: 'WAREHOUSE_QUEUE', title: `Atender ${row.number}`,
        summary: `${row.items.length} item(ns) · ${row.warehouse.name}`,
        status: row.status, criticality: 'MEDIUM', dueAt: row.neededAt, assignedUserId: me.sub,
        requesterUserId: row.requesterId, orgNodeId: row.orgNodeId, requiresDecision: row.status === 'REQUESTED',
        recommendedAction: row.status === 'REQUESTED' ? 'Aprovar e separar materiais' : 'Registrar a baixa dos materiais entregues',
        availableActions: [{ key: 'open', label: 'Abrir almoxarifado', href: '/suprimentos?tab=warehouse' }],
        context: { warehouseId: row.warehouseId, number: row.number }, sourceCreatedAt: row.createdAt, sourceUpdatedAt: row.updatedAt,
      })));
    return drafts;
  }

  /** Recrutamento: aprovações de requisição, vaga a criar, propostas fora da faixa, documentos e experiência. */
  private async collectRecruitment(me: AuthPayload): Promise<WorkItemDraft[]> {
    const keys = await this.permissionKeys(me.sub);
    const admin = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(String(me.role));
    const manage = admin || keys.has('recruit:manage');
    const canApproveRequisition = manage || keys.has('recruit:requisition:approve');
    const canApproveOffer = manage || keys.has('recruit:offer:approve');
    const canPrehire = manage || keys.has('recruit:prehire');
    const canAdmit = manage || keys.has('recruit:admit');

    const [requisitions, toPost, offers, preAdmissions, probations] = await Promise.all([
      canApproveRequisition
        ? this.prisma.recruitRequisition.findMany({
            where: { companyId: me.companyId, status: 'SUBMITTED' },
            select: {
              id: true, code: true, priority: true, requesterId: true, orgNodeId: true, openingsRequested: true,
              createdAt: true, updatedAt: true,
              approvals: { select: { order: true, role: true, decision: true, approverId: true }, orderBy: { order: 'asc' } },
            },
            take: 100,
          })
        : [],
      this.prisma.recruitRequisition.findMany({
        where: {
          companyId: me.companyId, status: 'SENT_TO_RECRUITMENT',
          ...(manage ? {} : { recruiterId: me.sub }),
        },
        select: { id: true, code: true, recruiterId: true, requesterId: true, orgNodeId: true, createdAt: true, updatedAt: true },
        take: 100,
      }),
      canApproveOffer
        ? this.prisma.recruitOffer.findMany({
            where: { companyId: me.companyId, status: 'PENDING_APPROVAL' },
            select: {
              id: true, revision: true, salaryAmountCents: true, expiresAt: true, createdAt: true, updatedAt: true,
              application: { select: { id: true, candidate: { select: { name: true } }, posting: { select: { id: true, title: true } } } },
            },
            take: 100,
          })
        : [],
      canPrehire
        ? this.prisma.recruitPreAdmission.findMany({
            where: { companyId: me.companyId, documents: { some: { status: 'SUBMITTED' } } },
            select: {
              id: true, status: true, admissionTargetDate: true, createdAt: true, updatedAt: true,
              documents: { where: { status: 'SUBMITTED' }, select: { id: true } },
              application: { select: { id: true, candidate: { select: { name: true } }, posting: { select: { id: true, title: true } } } },
            },
            take: 100,
          })
        : [],
      canAdmit
        ? this.prisma.recruitProbationReview.findMany({
            where: { companyId: me.companyId, status: 'PENDING' },
            select: {
              id: true, cycleDay: true, dueAt: true, createdAt: true, updatedAt: true,
              admission: { select: { application: { select: { id: true, candidate: { select: { name: true } }, posting: { select: { id: true, title: true } } } } } },
            },
            take: 100,
          })
        : [],
    ]);

    const hub = '/servico-pessoal/recrutamento';
    const drafts: WorkItemDraft[] = [];

    // Segregação: o solicitante não decide a própria requisição; passo com aprovador
    // nomeado só aparece para ele.
    for (const req of requisitions) {
      if (req.requesterId === me.sub) continue;
      const pending = req.approvals.find((step) => step.decision == null);
      if (pending?.approverId && pending.approverId !== me.sub) continue;
      drafts.push({
        sourceModule: 'recruitment', sourceEntityType: 'RECRUIT_REQUISITION', sourceEntityId: req.id,
        itemType: 'RECRUIT_REQUISITION_APPROVAL', title: `Aprovar requisição de vaga ${req.code}`,
        summary: pending ? `Passo pendente: ${pending.role} · ${req.openingsRequested} vaga(s)` : `${req.openingsRequested} vaga(s)`,
        status: 'SUBMITTED', criticality: req.priority === 'URGENTE' ? 'CRITICAL' : req.priority === 'ALTA' ? 'HIGH' : 'MEDIUM',
        assignedUserId: me.sub, requesterUserId: req.requesterId, orgNodeId: req.orgNodeId,
        requiresDecision: true, isBlocking: req.priority === 'URGENTE',
        recommendedAction: 'Aprovar ou reprovar a requisição (travas de quadro/orçamento na tela)',
        availableActions: [{ key: 'open', label: 'Abrir recrutamento', href: hub }],
        context: { code: req.code, priority: req.priority }, sourceCreatedAt: req.createdAt, sourceUpdatedAt: req.updatedAt,
      });
    }

    drafts.push(...toPost.map((req) => ({
      sourceModule: 'recruitment', sourceEntityType: 'RECRUIT_REQUISITION', sourceEntityId: req.id,
      itemType: 'RECRUIT_POSTING_TODO', title: `Criar vaga de divulgação (${req.code})`,
      summary: req.recruiterId === me.sub ? 'Requisição encaminhada sob sua condução' : 'Requisição aprovada aguardando vaga',
      status: 'SENT_TO_RECRUITMENT', criticality: 'MEDIUM',
      assignedUserId: me.sub, requesterUserId: req.requesterId, orgNodeId: req.orgNodeId,
      requiresDecision: false,
      recommendedAction: 'Abrir a requisição e criar a vaga de divulgação',
      availableActions: [{ key: 'open', label: 'Abrir recrutamento', href: hub }],
      context: { code: req.code }, sourceCreatedAt: req.createdAt, sourceUpdatedAt: req.updatedAt,
    })));

    drafts.push(...offers.map((offer) => ({
      sourceModule: 'recruitment', sourceEntityType: 'RECRUIT_OFFER', sourceEntityId: offer.id,
      itemType: 'RECRUIT_OFFER_APPROVAL', title: `Aprovar proposta fora da faixa — ${offer.application.candidate.name}`,
      summary: `${offer.application.posting.title} · revisão ${offer.revision}`,
      status: 'PENDING_APPROVAL', criticality: 'HIGH', dueAt: offer.expiresAt,
      assignedUserId: me.sub, requiresDecision: true, isBlocking: true,
      recommendedAction: 'Avaliar a justificativa e aprovar ou cancelar a proposta',
      availableActions: [{ key: 'open', label: 'Abrir vaga', href: `${hub}/vagas/${offer.application.posting.id}` }],
      context: { applicationId: offer.application.id, salaryAmountCents: offer.salaryAmountCents },
      sourceCreatedAt: offer.createdAt, sourceUpdatedAt: offer.updatedAt,
    })));

    drafts.push(...preAdmissions.map((pre) => ({
      sourceModule: 'recruitment', sourceEntityType: 'RECRUIT_PRE_ADMISSION', sourceEntityId: pre.id,
      itemType: 'RECRUIT_PREHIRE_DOCS', title: `Revisar documentos de ${pre.application.candidate.name}`,
      summary: `${pre.documents.length} documento(s) enviados na pré-admissão · ${pre.application.posting.title}`,
      status: pre.status, criticality: 'MEDIUM', dueAt: pre.admissionTargetDate,
      assignedUserId: me.sub, requiresDecision: true,
      recommendedAction: 'Aprovar ou rejeitar os documentos enviados pelo candidato',
      availableActions: [{ key: 'open', label: 'Abrir vaga', href: `${hub}/vagas/${pre.application.posting.id}` }],
      context: { applicationId: pre.application.id, submittedDocs: pre.documents.length },
      sourceCreatedAt: pre.createdAt, sourceUpdatedAt: pre.updatedAt,
    })));

    drafts.push(...probations.map((review) => ({
      sourceModule: 'recruitment', sourceEntityType: 'RECRUIT_PROBATION_REVIEW', sourceEntityId: review.id,
      itemType: 'RECRUIT_PROBATION_REVIEW', title: `Avaliação de experiência D+${review.cycleDay} — ${review.admission.application.candidate.name}`,
      summary: review.admission.application.posting.title,
      status: 'PENDING', criticality: 'MEDIUM', dueAt: review.dueAt,
      assignedUserId: me.sub, requiresDecision: true,
      recommendedAction: 'Concluir a avaliação do período de experiência',
      availableActions: [{ key: 'open', label: 'Abrir vaga', href: `${hub}/vagas/${review.admission.application.posting.id}` }],
      context: { applicationId: review.admission.application.id, cycleDay: review.cycleDay },
      sourceCreatedAt: review.createdAt, sourceUpdatedAt: review.updatedAt,
    })));

    return drafts;
  }

  /** Cargos e Salários: movimentações salariais aguardando aprovação. */
  private async collectCompensation(me: AuthPayload): Promise<WorkItemDraft[]> {
    const keys = await this.permissionKeys(me.sub);
    const admin = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(String(me.role));
    const canApprove = admin || keys.has('compensation:movements:approve') || keys.has('compensation:manage');
    if (!canApprove) return [];

    const movements = await this.prisma.compensationMovementRequest.findMany({
      where: { companyId: me.companyId, status: 'REQUESTED' },
      select: {
        id: true, protocol: true, type: true, reason: true, monthlyImpact: true,
        requesterId: true, effectiveAt: true, createdAt: true, updatedAt: true,
      },
      take: 100,
    });

    return movements
      .filter((movement) => movement.requesterId !== me.sub)
      .map((movement) => ({
        sourceModule: 'compensation', sourceEntityType: 'COMPENSATION_MOVEMENT', sourceEntityId: movement.id,
        itemType: 'COMPENSATION_MOVEMENT_APPROVAL', title: `Aprovar movimentação ${movement.protocol}`,
        summary: `${movement.reason}${movement.monthlyImpact != null ? ` · impacto mensal R$ ${Number(movement.monthlyImpact).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}`,
        status: 'REQUESTED', criticality: 'HIGH', dueAt: movement.effectiveAt,
        assignedUserId: me.sub, requesterUserId: movement.requesterId,
        requiresDecision: true,
        recommendedAction: 'Aprovar ou rejeitar a movimentação salarial',
        availableActions: [{ key: 'open', label: 'Abrir aprovações de C&S', href: '/cargos-salarios/aprovacoes' }],
        context: { protocol: movement.protocol, type: movement.type },
        sourceCreatedAt: movement.createdAt, sourceUpdatedAt: movement.updatedAt,
      }));
  }

  /** Chaves de permissão efetivas (perfil + grants diretos) do usuário. */
  private async permissionKeys(userId: string): Promise<Set<string>> {
    const grants = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        permissions: { select: { permission: { select: { key: true } } } },
        accessProfile: { select: { permissions: { select: { permission: { select: { key: true } } } } } },
      },
    });
    const keys = new Set<string>();
    grants?.permissions.forEach((item) => keys.add(item.permission.key));
    grants?.accessProfile?.permissions.forEach((item) => keys.add(item.permission.key));
    return keys;
  }

  private async collectAudits(me: AuthPayload): Promise<WorkItemDraft[]> {
    const rows = await this.prisma.audit.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        leadAuditorUserId: me.sub,
        status: { notIn: ['COMPLETED', 'CLOSED', 'CANCELLED'] as any },
      },
      select: {
        id: true,
        number: true,
        code: true,
        title: true,
        status: true,
        orgNodeId: true,
        plannedDate: true,
        plannedEndAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows.map((audit) => ({
      sourceModule: 'audits',
      sourceEntityType: 'AUDIT',
      sourceEntityId: audit.id,
      itemType: 'AUDIT',
      title: `${audit.code ?? `AUD-${audit.number}`} · ${audit.title}`,
      summary: `Auditoria · ${audit.status}`,
      status: audit.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'OPEN',
      criticality: audit.status === 'WAITING_AUDITED_RESPONSE' ? 'HIGH' : 'MEDIUM',
      dueAt: audit.plannedEndAt ?? audit.plannedDate,
      assignedUserId: me.sub,
      orgNodeId: audit.orgNodeId,
      recommendedAction: 'Dar andamento à auditoria',
      availableActions: [{ key: 'open', label: 'Abrir auditoria', href: `/audits?id=${audit.id}` }],
      context: { auditNumber: audit.number, auditStatus: audit.status },
      sourceCreatedAt: audit.createdAt,
      sourceUpdatedAt: audit.updatedAt,
    }));
  }

  private async collectAuditFindings(me: AuthPayload): Promise<WorkItemDraft[]> {
    const rows = await this.prisma.auditFinding.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        responsibleUserId: me.sub,
        status: { notIn: ['CLOSED', 'CANCELLED'] as any },
      },
      select: {
        id: true,
        auditId: true,
        code: true,
        description: true,
        status: true,
        severity: true,
        criticality: true,
        dueDate: true,
        orgNodeId: true,
        processId: true,
        createdAt: true,
        updatedAt: true,
        audit: { select: { title: true } },
      },
    });
    return rows.map((finding) => ({
      sourceModule: 'audits',
      sourceEntityType: 'AUDIT_FINDING',
      sourceEntityId: finding.id,
      itemType: 'AUDIT',
      title: `Responder constatação ${finding.code ?? ''}`.trim(),
      summary: `${finding.audit.title} · ${finding.description}`,
      status: finding.status === 'IN_TREATMENT' || finding.status === 'IN_FOLLOW_UP' ? 'IN_PROGRESS' : 'OPEN',
      criticality: finding.criticality ?? finding.severity ?? 'HIGH',
      dueAt: finding.dueDate,
      assignedUserId: me.sub,
      orgNodeId: finding.orgNodeId,
      processId: finding.processId,
      recommendedAction: 'Responder a constatação e anexar evidências',
      availableActions: [{ key: 'open', label: 'Abrir auditoria', href: `/audits?id=${finding.auditId}` }],
      context: { auditId: finding.auditId, findingStatus: finding.status },
      sourceCreatedAt: finding.createdAt,
      sourceUpdatedAt: finding.updatedAt,
    }));
  }

  private async collectFormSubmissions(me: AuthPayload): Promise<WorkItemDraft[]> {
    const rows = await this.prisma.formSubmission.findMany({
      where: {
        companyId: me.companyId,
        OR: [
          { assignedToId: me.sub, status: { in: ['ASSIGNED', 'IN_PROGRESS', 'WAITING_CORRECTION'] as any } },
          { reviewedById: me.sub, status: { in: ['SUBMITTED', 'WAITING_APPROVAL'] as any } },
        ],
      },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        assignedToId: true,
        dueDate: true,
        orgNodeId: true,
        processId: true,
        createdAt: true,
        updatedAt: true,
        template: { select: { title: true, type: true } },
      },
    });
    return rows.map((submission) => {
      const review = submission.assignedToId !== me.sub;
      const checklist = String(submission.template.type).includes('CHECKLIST');
      return {
        sourceModule: 'forms',
        sourceEntityType: checklist ? 'CHECKLIST' : 'FORM_SUBMISSION',
        sourceEntityId: submission.id,
        itemType: checklist ? 'CHECKLIST' : 'FORM',
        title: submission.title ?? `${review ? 'Revisar' : 'Preencher'} ${submission.template.title}`,
        summary: `${submission.code ? `${submission.code} · ` : ''}${submission.status}`,
        status: review ? 'WAITING' : submission.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'OPEN',
        criticality: review || submission.status === 'WAITING_CORRECTION' ? 'HIGH' : 'MEDIUM',
        dueAt: submission.dueDate,
        assignedUserId: me.sub,
        orgNodeId: submission.orgNodeId,
        processId: submission.processId,
        requiresDecision: review,
        recommendedAction: review ? 'Revisar e decidir sobre o envio' : 'Preencher e enviar o formulário',
        availableActions: [{ key: 'open', label: 'Abrir formulário', href: `/forms?submission=${submission.id}` }],
        context: { submissionStatus: submission.status, templateType: submission.template.type },
        sourceCreatedAt: submission.createdAt,
        sourceUpdatedAt: submission.updatedAt,
      };
    });
  }

  private async collectRisks(me: AuthPayload): Promise<WorkItemDraft[]> {
    const rows = await this.prisma.riskRegister.findMany({
      where: { companyId: me.companyId, deletedAt: null, responsibleUserId: me.sub, status: { in: OPEN_RISK_STATUS as any } },
      select: { id: true, title: true, status: true, probability: true, impact: true, dueDate: true, orgNodeId: true, createdAt: true, updatedAt: true },
    });
    return rows
      .map((r) => {
        const score = (r.probability ?? 3) * (r.impact ?? 3);
        const criticality = score >= 15 ? 'CRITICAL' : score >= 10 ? 'HIGH' : score >= 5 ? 'MEDIUM' : 'LOW';
        return { r, score, criticality };
      })
      // "Riscos críticos": surface HIGH/CRITICAL (score >= 10).
      .filter((x) => x.score >= 10)
      .map(({ r, score, criticality }) => ({
        sourceModule: 'risks',
        sourceEntityType: 'RISK_REGISTER',
        sourceEntityId: r.id,
        itemType: 'RISK_CRITICAL',
        title: r.title,
        summary: `Risco · prob ${r.probability} × impacto ${r.impact} = ${score}`,
        status: r.status as string,
        criticality,
        dueAt: r.dueDate,
        assignedUserId: me.sub,
        orgNodeId: r.orgNodeId,
        recommendedAction: 'Criar/atualizar tratamento do risco',
        availableActions: [
          { key: 'open', label: 'Abrir risco', href: `/risks?id=${r.id}` },
          { key: 'vision360', label: 'Abrir Visão 360°', inline: true },
        ],
        context: { probability: r.probability, impact: r.impact, score },
        sourceCreatedAt: r.createdAt,
        sourceUpdatedAt: r.updatedAt,
      }));
  }

  private async collectNonConformities(me: AuthPayload): Promise<WorkItemDraft[]> {
    const rows = await this.prisma.nonConformity.findMany({
      where: { companyId: me.companyId, deletedAt: null, responsibleUserId: me.sub, status: { in: OPEN_NC_STATUS as any } },
      select: { id: true, title: true, status: true, severity: true, dueDate: true, orgNodeId: true, createdAt: true, updatedAt: true },
    });
    const sevMap: Record<string, string> = { CRITICAL: 'CRITICAL', MAJOR: 'HIGH', MINOR: 'MEDIUM' };
    return rows.map((nc) => ({
      sourceModule: 'nonconformities',
      sourceEntityType: 'NON_CONFORMITY',
      sourceEntityId: nc.id,
      itemType: 'NONCONFORMITY',
      title: nc.title,
      summary: `Não conformidade · ${nc.status}`,
      status: nc.status as string,
      criticality: sevMap[nc.severity as string] ?? 'MEDIUM',
      dueAt: nc.dueDate,
      assignedUserId: me.sub,
      orgNodeId: nc.orgNodeId,
      recommendedAction: 'Tratar a não conformidade',
      availableActions: [
        { key: 'open', label: 'Abrir NC', href: `/nonconformities?id=${nc.id}` },
        { key: 'vision360', label: 'Abrir Visão 360°', inline: true },
      ],
      context: { severity: nc.severity },
      sourceCreatedAt: nc.createdAt,
      sourceUpdatedAt: nc.updatedAt,
    }));
  }

  private async collectIndicatorsOffTarget(me: AuthPayload): Promise<WorkItemDraft[]> {
    const reds = await this.prisma.indicatorResult.findMany({
      where: { light: 'RED', indicator: { companyId: me.companyId, deletedAt: null, status: 'ACTIVE', responsibleUserId: me.sub } },
      orderBy: { periodDate: 'desc' },
      distinct: ['indicatorId'],
      take: 50,
      select: {
        value: true, attainment: true, deviationPct: true, periodRef: true,
        indicator: { select: { id: true, name: true, code: true, ownerNodeId: true } },
      },
    });
    return reds.map((r) => ({
      sourceModule: 'indicators',
      sourceEntityType: 'INDICATOR',
      sourceEntityId: r.indicator.id,
      itemType: 'INDICATOR_OFF_TARGET',
      title: `${r.indicator.code ? r.indicator.code + ' · ' : ''}${r.indicator.name}`,
      summary: `Fora da meta (${r.periodRef})${r.deviationPct != null ? ` · desvio ${Math.round(r.deviationPct)}%` : ''}`,
      status: 'OPEN',
      criticality: 'HIGH',
      dueAt: null,
      assignedUserId: me.sub,
      orgNodeId: r.indicator.ownerNodeId,
      recommendedAction: 'Registrar análise de causa e/ou criar plano de ação',
      availableActions: [
        { key: 'open', label: 'Abrir indicador', href: `/indicators/${r.indicator.id}` },
        {
          key: 'analyze',
          label: 'Analisar causa',
          href: `/indicators/${r.indicator.id}?analyze=1&periodRef=${encodeURIComponent(r.periodRef)}`,
        },
        { key: 'vision360', label: 'Abrir Visão 360°', inline: true },
      ],
      context: { periodRef: r.periodRef, value: r.value, attainment: r.attainment, deviationPct: r.deviationPct },
    }));
  }

  private async collectNotifications(me: AuthPayload): Promise<WorkItemDraft[]> {
    const notes = await this.prisma.notification.findMany({
      where: { companyId: me.companyId, userId: me.sub, readAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, kind: true, title: true, body: true, link: true, createdAt: true },
    });
    const map: Record<string, { type: string; crit: string }> = {
      MENTION: { type: 'MENTION', crit: 'MEDIUM' },
      MESSAGE: { type: 'MESSAGE', crit: 'LOW' },
      DEVIATION_CRITICAL: { type: 'ALERT', crit: 'HIGH' },
      ACTION_OVERDUE: { type: 'ALERT', crit: 'HIGH' },
      ACTION_DUE_SOON: { type: 'ALERT', crit: 'MEDIUM' },
      INDICATOR_OFF_TARGET: { type: 'ALERT', crit: 'MEDIUM' },
      TARGET_MISSED: { type: 'ALERT', crit: 'MEDIUM' },
      PROJECT_LATE: { type: 'ALERT', crit: 'MEDIUM' },
    };
    return notes.map((n) => {
      const m = map[n.kind as string] ?? { type: 'ALERT', crit: 'LOW' };
      return {
        sourceModule: 'notifications',
        sourceEntityType: 'NOTIFICATION',
        sourceEntityId: n.id,
        itemType: m.type,
        title: n.title,
        summary: n.body ?? null,
        status: 'OPEN',
        criticality: m.crit,
        dueAt: null,
        assignedUserId: me.sub,
        recommendedAction: m.type === 'MESSAGE' || m.type === 'MENTION' ? 'Ler e responder' : 'Verificar o alerta',
        availableActions: [
          { key: 'markRead', label: 'Marcar como lida', inline: true },
          ...(n.link ? [{ key: 'open', label: 'Abrir', href: n.link }] : []),
        ],
        context: { kind: n.kind },
        sourceCreatedAt: n.createdAt,
      };
    });
  }

  /**
   * Comunicados publicados que exigem leitura/confirmação e o usuário ainda
   * não leu/confirmou. O item permanece no Meu Dia até a leitura na origem
   * (Comunicação) — pedido do produto: "comunicado importante aparece no Meu
   * Dia até o usuário ler".
   */
  private async collectUnreadCommunications(me: AuthPayload): Promise<WorkItemDraft[]> {
    const now = new Date();
    const [user, posts] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: me.sub, companyId: me.companyId },
        select: { id: true, defaultNodeId: true, role: true },
      }),
      this.prisma.communicationPost.findMany({
        where: {
          companyId: me.companyId,
          deletedAt: null,
          status: 'PUBLISHED',
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          AND: [{ OR: [{ requiresReadConfirmation: true }, { isMandatory: true }] }],
        },
        orderBy: { publishedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          title: true,
          subtitle: true,
          category: true,
          priority: true,
          audience: true,
          requiresReadConfirmation: true,
          publishedAt: true,
          expiresAt: true,
          reads: { where: { userId: me.sub }, select: { viewedAt: true, confirmedAt: true } },
        },
      }),
    ]);
    if (!user) return [];

    const critFor: Record<string, string> = { LOW: 'LOW', NORMAL: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'HIGH', URGENT: 'HIGH' };
    return posts
      .filter((post) => matchesAudience(user, post.audience as unknown as AudienceRule))
      .filter((post) => {
        const read = post.reads[0];
        // Com confirmação exigida, só sai do Meu Dia após CONFIRMAR; sem
        // confirmação (mandatório), basta ter visualizado.
        return post.requiresReadConfirmation ? !read?.confirmedAt : !read?.viewedAt;
      })
      .map((post) => ({
        sourceModule: 'communication',
        sourceEntityType: 'COMMUNICATION_POST',
        sourceEntityId: post.id,
        itemType: 'COMMUNICATION_UNREAD',
        title: post.title,
        summary: post.subtitle ?? `Comunicado de ${post.category} aguardando sua leitura`,
        status: 'OPEN',
        criticality: critFor[post.priority as string] ?? 'MEDIUM',
        dueAt: post.expiresAt ?? null,
        assignedUserId: me.sub,
        requiresDecision: false,
        recommendedAction: post.requiresReadConfirmation ? 'Ler e confirmar a leitura' : 'Ler o comunicado',
        availableActions: [{ key: 'open', label: 'Ler comunicado', href: `/comunicacao?post=${post.id}` }],
        context: { category: post.category, priority: post.priority, requiresReadConfirmation: post.requiresReadConfirmation },
        sourceCreatedAt: post.publishedAt ?? null,
      }));
  }

  /**
   * Ocorrências patrimoniais abertas sob responsabilidade do usuário (ou
   * criadas por ele, quando sem responsável). Além do card no Meu Dia, o
   * board de Tarefas materializa o item como tarefa automática — fechando a
   * integração ocorrência → tarefa sem duplicar registro de origem.
   */
  private async collectSecurityIncidents(me: AuthPayload): Promise<WorkItemDraft[]> {
    const rows = await this.prisma.securityIncident.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_ACTION'] },
        OR: [{ responsibleUserId: me.sub }, { responsibleUserId: null, createdById: me.sub }],
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        code: true,
        title: true,
        type: true,
        severity: true,
        status: true,
        dueAt: true,
        actionPlanId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const critFor: Record<string, string> = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL', EMERGENCY: 'CRITICAL' };
    return rows.map((r) => ({
      sourceModule: 'asset-security',
      sourceEntityType: 'SECURITY_INCIDENT',
      sourceEntityId: r.id,
      itemType: 'SECURITY_INCIDENT',
      title: `${r.code ? r.code + ' · ' : ''}${r.title}`,
      summary: r.type ? `Ocorrência de segurança (${r.type})` : 'Ocorrência de segurança patrimonial',
      status: r.status,
      criticality: critFor[r.severity as string] ?? 'MEDIUM',
      dueAt: r.dueAt ?? null,
      assignedUserId: me.sub,
      isBlocking: r.severity === 'CRITICAL' || r.severity === 'EMERGENCY',
      recommendedAction: r.actionPlanId ? 'Acompanhar o plano de ação vinculado' : 'Tratar a ocorrência e definir plano de ação',
      availableActions: [
        { key: 'open', label: 'Abrir ocorrência', href: '/seguranca-patrimonial?tab=ocorrencias' },
        ...(r.actionPlanId ? [{ key: 'openPlan', label: 'Abrir plano de ação', href: `/actions/${r.actionPlanId}` }] : []),
      ],
      context: { severity: r.severity, type: r.type, actionPlanId: r.actionPlanId },
      sourceCreatedAt: r.createdAt,
      sourceUpdatedAt: r.updatedAt,
    }));
  }
}
