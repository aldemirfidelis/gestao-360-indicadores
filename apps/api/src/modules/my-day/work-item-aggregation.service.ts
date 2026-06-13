import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { WorkItemPriorityService } from './work-item-priority.service';
import type { WorkItemAction } from '@g360/shared';

/** Item "rascunho" coletado de um modulo de origem, antes da priorizacao. */
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
 * Camada central de leitura/agregacao da Central "Meu Dia".
 * Consulta os modulos AUTORIZADOS, consolida itens relevantes do usuario e
 * mantem a projecao WorkItemIndex (que SEMPRE referencia o registro original).
 * Nunca duplica o registro de origem como fonte oficial.
 */
@Injectable()
export class WorkItemAggregationService {
  private readonly logger = new Logger(WorkItemAggregationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly priority: WorkItemPriorityService,
  ) {}

  /** Reconstroi a fatia do indice pertencente ao usuario, a partir das fontes. */
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
      await this.prisma.workItemIndex.upsert({
        where: { dedupeKey },
        create: { companyId, dedupeKey, ...data },
        update: data,
      });
    }

    // Remove itens que nao estao mais pendentes para este usuario (resolvidos na origem).
    await this.prisma.workItemIndex.deleteMany({
      where: { companyId, assignedUserId: me.sub, dedupeKey: { notIn: seenKeys.length ? seenKeys : ['__none__'] } },
    });

    return drafts.length;
  }

  private async collectSources(me: AuthPayload): Promise<WorkItemDraft[]> {
    return (
      await Promise.all([
        this.collectActions(me).catch((e) => this.warn('actions', e)),
        this.collectWorkflowTasks(me).catch((e) => this.warn('workflow-tasks', e)),
        this.collectApprovals(me).catch((e) => this.warn('approvals', e)),
        this.collectMeetingsToday(me).catch((e) => this.warn('meetings', e)),
        this.collectDocuments(me).catch((e) => this.warn('documents', e)),
        this.collectRisks(me).catch((e) => this.warn('risks', e)),
        this.collectNonConformities(me).catch((e) => this.warn('nonconformities', e)),
        this.collectIndicatorsOffTarget(me).catch((e) => this.warn('indicators', e)),
        this.collectNotifications(me).catch((e) => this.warn('notifications', e)),
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

  /** Reconstroi a fatia de um usuario arbitrario (bus de eventos / visao de equipe). */
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
            { key: 'approve', label: 'Liberar edicao', kind: 'primary', inline: true },
            { key: 'reject', label: 'Rejeitar', kind: 'danger', inline: true, requiresJustification: true },
            { key: 'open', label: 'Abrir documento', href: `/documents?focus=${d.id}` },
          ]
        : [
            { key: 'open', label: 'Editar documento', href: `/documents?focus=${d.id}&edit=1` },
            { key: 'complete', label: 'Concluir edicao', inline: true },
          ];
      return {
        sourceModule: 'documents',
        sourceEntityType: 'DOCUMENT_EDIT_REQUEST',
        sourceEntityId: r.id,
        itemType: isOperatorTask ? 'DOCUMENT_EDIT_APPROVAL' : 'DOCUMENT_EDIT',
        title: isOperatorTask
          ? `Liberar edicao: ${d.code ? d.code + ' - ' : ''}${d.title}`
          : `Editar documento: ${d.code ? d.code + ' - ' : ''}${d.title}`,
        summary: isOperatorTask
          ? `Solicitante: ${r.requester?.name ?? 'Usuario'} - ${r.reason ?? 'Sem justificativa'}`
          : `Liberado para edicao online - ${r.status}`,
        status: r.status,
        criticality: isOperatorTask ? 'HIGH' : 'MEDIUM',
        dueAt: r.expiresAt,
        assignedUserId: me.sub,
        requesterUserId: r.requesterUserId,
        orgNodeId: d.orgNodeId,
        requiresDecision: isOperatorTask,
        isBlocking: isOperatorTask,
        recommendedAction: isOperatorTask ? 'Aprovar ou rejeitar a edicao do documento' : 'Abrir o documento e editar no Microsoft 365',
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
}
