import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ActionOrigin,
  ActionPriority,
  ActionStatus,
  AnalysisMethod,
  DeviationSeverity,
  DeviationStatus,
  Prisma,
  TraceEntityType,
  TraceEventType,
} from '@prisma/client';
import { TraceabilityService } from '../traceability/traceability.service';
import { AccessService } from '../access/access.service';
import { AuthPayload } from '../auth/auth.types';

/** Chave de módulo usada nas regras de visibilidade por área (AccessService). */
const MODULE = 'deviations';

export interface OpenDeviationInput {
  companyId: string;
  indicatorId: string;
  periodRef: string;
  title?: string;
  severity?: DeviationSeverity;
  responsibleUserId?: string | null;
  dueDate?: Date | null;
  method?: AnalysisMethod;
  fact?: string;
  createdById?: string;
}

@Injectable()
export class DeviationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityService,
    private readonly access: AccessService,
  ) {}

  /**
   * Carrega um desvio garantindo isolamento por EMPRESA (defesa contra acesso direto
   * via id de outra empresa) e traz a área (ownerNode do indicador) para o enforcement.
   */
  private async loadScoped(id: string, companyId: string) {
    const dev = await this.prisma.deviation.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { indicator: { select: { ownerNodeId: true } } },
    });
    if (!dev) throw new NotFoundException('Desvio nao encontrado');
    return dev;
  }

  /** Filtro de área para listagens: ids permitidos (ou null = sem restrição). */
  private async areaFilter(userId: string): Promise<string[] | null> {
    return this.access.listAreaFilter(userId, MODULE, 'view');
  }

  async list(me: AuthPayload, status?: DeviationStatus, indicatorId?: string) {
    const permitted = await this.areaFilter(me.sub);
    if (permitted && permitted.length === 0) return []; // sem áreas visíveis
    return this.prisma.deviation.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(indicatorId ? { indicatorId } : {}),
        // A área do desvio é a área (ownerNode) do indicador associado.
        ...(permitted ? { indicator: { ownerNodeId: { in: permitted } } } : {}),
      },
      include: {
        indicator: { select: { id: true, name: true, code: true, ownerNodeId: true } },
        responsibleUser: { select: { id: true, name: true } },
        _count: { select: { causes: true, actions: true, analyses: true } },
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  async getById(me: AuthPayload, id: string) {
    const d = await this.prisma.deviation.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: {
        indicator: true,
        responsibleUser: true,
        causes: true,
        analyses: true,
        actions: { include: { responsibleUser: { select: { id: true, name: true } } } },
      },
    });
    if (!d) throw new NotFoundException('Desvio nao encontrado');

    // Restrição por área: bloqueia acesso direto a desvio de área não permitida e
    // aplica projeção RESUMIDA quando o nível de visibilidade for SUMMARY.
    const ownerNodeId = d.indicator?.ownerNodeId ?? null;
    const permitted = await this.areaFilter(me.sub);
    if (permitted && ownerNodeId && !permitted.includes(ownerNodeId)) {
      throw new ForbiddenException('Você não tem acesso aos desvios desta área.');
    }
    const level = await this.access.visibilityLevel(me.sub, MODULE, ownerNodeId);
    if (level === 'SUMMARY') return summarizeDeviation(d);
    return d;
  }

  async open(input: OpenDeviationInput): Promise<{ id: string; number: number }> {
    // Indicador precisa pertencer à empresa; sua área define o escopo do desvio.
    const indicator = await this.prisma.indicator.findFirst({
      where: { id: input.indicatorId, companyId: input.companyId, deletedAt: null },
      select: { name: true, ownerNodeId: true },
    });
    if (!indicator) throw new NotFoundException('Indicador nao encontrado');
    if (input.createdById) {
      await this.access.assertCanWrite(input.createdById, indicator.ownerNodeId, MODULE, 'create');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const last = await tx.deviation.findFirst({
        where: { companyId: input.companyId },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      const number = (last?.number ?? 0) + 1;

      const title =
        input.title ?? `Desvio #${number} - ${indicator.name ?? 'Indicador'} (${input.periodRef})`;

      const deviation = await tx.deviation.create({
        data: {
          companyId: input.companyId,
          indicatorId: input.indicatorId,
          periodRef: input.periodRef,
          number,
          title,
          severity: input.severity ?? DeviationSeverity.MODERATE,
          status: DeviationStatus.OPEN,
          method: input.method ?? AnalysisMethod.FCA,
          fact: input.fact,
          responsibleUserId: input.responsibleUserId ?? null,
          dueDate: input.dueDate ?? null,
        },
      });

      return { id: deviation.id, number: deviation.number };
    });
    await this.traceability.record({
      companyId: input.companyId,
      indicatorId: input.indicatorId,
      userId: input.createdById,
      eventType: TraceEventType.CREATED,
      entityType: TraceEntityType.DEVIATION,
      entityId: result.id,
      title: `Desvio #${result.number} aberto`,
      description: input.title ?? `Desvio aberto para o período ${input.periodRef}`,
      statusTo: DeviationStatus.OPEN,
      metadata: { periodRef: input.periodRef, severity: input.severity ?? DeviationSeverity.MODERATE },
    });

    return result;
  }

  async update(me: AuthPayload, id: string, patch: Prisma.DeviationUpdateInput) {
    const before = await this.loadScoped(id, me.companyId);
    await this.access.assertCanWrite(me.sub, before.indicator?.ownerNodeId ?? null, MODULE, 'edit');
    const updated = await this.prisma.deviation.update({ where: { id }, data: patch });
    const nextStatus = typeof patch.status === 'string' ? patch.status : undefined;
    if (nextStatus && before.status !== nextStatus) {
      await this.traceability.record({
        companyId: updated.companyId,
        indicatorId: updated.indicatorId,
        userId: me.sub,
        eventType: TraceEventType.STATUS_CHANGED,
        entityType: TraceEntityType.DEVIATION,
        entityId: updated.id,
        title: `Status do desvio #${updated.number} alterado`,
        description: updated.title,
        statusFrom: before.status,
        statusTo: nextStatus,
      });
    }
    return updated;
  }

  async addCause(me: AuthPayload, deviationId: string, description: string, category?: string, weight = 1) {
    const dev = await this.loadScoped(deviationId, me.companyId);
    await this.access.assertCanWrite(me.sub, dev.indicator?.ownerNodeId ?? null, MODULE, 'edit');
    const cause = await this.prisma.deviationCause.create({
      data: { deviationId, description, category: category ?? null, weight },
    });
    await this.traceability.record({
      companyId: dev.companyId,
      indicatorId: dev.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.CAUSE_CREATED,
      entityType: TraceEntityType.DEVIATION_CAUSE,
      entityId: cause.id,
      relatedType: TraceEntityType.DEVIATION,
      relatedId: deviationId,
      title: 'Causa identificada',
      description,
      metadata: { category, weight, deviationNumber: dev.number },
    });
    return cause;
  }

  async removeCause(me: AuthPayload, causeId: string) {
    // A causa não tem companyId — isola pela empresa do desvio pai.
    const cause = await this.prisma.deviationCause.findFirst({
      where: { id: causeId, deviation: { companyId: me.companyId, deletedAt: null } },
      include: { deviation: { include: { indicator: { select: { ownerNodeId: true } } } } },
    });
    if (!cause) throw new NotFoundException('Causa nao encontrada');
    await this.access.assertCanWrite(me.sub, cause.deviation.indicator?.ownerNodeId ?? null, MODULE, 'edit');
    return this.prisma.deviationCause.delete({ where: { id: causeId } });
  }

  async addAnalysis(me: AuthPayload, deviationId: string, method: AnalysisMethod, content: string) {
    const dev = await this.loadScoped(deviationId, me.companyId);
    await this.access.assertCanWrite(me.sub, dev.indicator?.ownerNodeId ?? null, MODULE, 'edit');
    const analysis = await this.prisma.deviationAnalysis.create({
      data: { deviationId, method, content },
    });
    await this.traceability.record({
      companyId: dev.companyId,
      indicatorId: dev.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.ANALYSIS_CREATED,
      entityType: TraceEntityType.DEVIATION_ANALYSIS,
      entityId: analysis.id,
      relatedType: TraceEntityType.DEVIATION,
      relatedId: deviationId,
      title: `Análise de causa registrada (${method})`,
      description: content,
      metadata: { method, deviationNumber: dev.number },
    });
    return analysis;
  }

  async createAction(
    me: AuthPayload,
    deviationId: string,
    body: {
      title: string;
      description?: string;
      responsibleUserId?: string | null;
      ownerNodeId?: string | null;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      dueDate?: string | null;
      estimatedCost?: number | null;
    },
  ) {
    const dev = await this.loadScoped(deviationId, me.companyId);
    // Criar uma ação a partir do desvio exige poder atuar na área do desvio.
    await this.access.assertCanWrite(me.sub, dev.indicator?.ownerNodeId ?? null, MODULE, 'edit');

    const action = await this.prisma.actionPlan.create({
      data: {
        companyId: dev.companyId,
        deviationId: dev.id,
        origin: ActionOrigin.DEVIATION,
        originRefId: dev.id,
        title: body.title,
        description: body.description ?? null,
        responsibleUserId: body.responsibleUserId ?? dev.responsibleUserId ?? null,
        ownerNodeId: body.ownerNodeId ?? dev.indicator?.ownerNodeId ?? null,
        priority: (body.priority as ActionPriority | undefined) ?? ActionPriority.HIGH,
        status: ActionStatus.NOT_STARTED,
        dueDate: body.dueDate ? new Date(body.dueDate) : dev.dueDate,
        estimatedCost: body.estimatedCost ?? null,
        createdById: me.sub,
      },
    });

    await this.prisma.deviation.update({
      where: { id: deviationId },
      data: { status: DeviationStatus.WAITING_ACTION },
    });

    await this.traceability.record({
      companyId: dev.companyId,
      indicatorId: dev.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.ACTION_CREATED,
      entityType: TraceEntityType.ACTION_PLAN,
      entityId: action.id,
      relatedType: TraceEntityType.DEVIATION,
      relatedId: dev.id,
      title: 'Plano de ação criado a partir do desvio',
      description: action.title,
      statusFrom: dev.status,
      statusTo: DeviationStatus.WAITING_ACTION,
      metadata: { priority: action.priority, dueDate: action.dueDate, deviationNumber: dev.number },
    });

    return action;
  }

  async close(me: AuthPayload, id: string) {
    const dev = await this.prisma.deviation.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: {
        indicator: { select: { ownerNodeId: true } },
        actions: { select: { status: true } },
      },
    });
    if (!dev) throw new NotFoundException('Desvio nao encontrado');
    await this.access.assertCanWrite(me.sub, dev.indicator?.ownerNodeId ?? null, MODULE, 'edit');

    const completedStatuses = ['DONE', 'DONE_LATE', 'CANCELLED', 'EFFECTIVE', 'INEFFECTIVE'];
    const open = dev.actions.filter((a) => !completedStatuses.includes(a.status));
    if (open.length > 0) {
      throw new ForbiddenException(
        `Existem ${open.length} ação(oes) abertas. Conclua-as antes de fechar o desvio.`,
      );
    }
    const lateClose = dev.dueDate && dev.dueDate < new Date();
    const closed = await this.prisma.deviation.update({
      where: { id },
      data: {
        status: lateClose ? DeviationStatus.CLOSED_LATE : DeviationStatus.CLOSED,
        closedAt: new Date(),
      },
    });
    await this.traceability.record({
      companyId: closed.companyId,
      indicatorId: closed.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.CLOSED,
      entityType: TraceEntityType.DEVIATION,
      entityId: closed.id,
      title: `Desvio #${closed.number} concluido`,
      description: closed.title,
      statusFrom: dev.status,
      statusTo: closed.status,
    });
    return closed;
  }
}

/**
 * Projeção RESUMIDA (nível SUMMARY): oculta o conteúdo sensível de causa/análise/fato
 * mantendo a identificação do desvio. Espelha a estratégia de summarizeIndicator.
 */
function summarizeDeviation(
  d: Prisma.DeviationGetPayload<{
    include: {
      indicator: true;
      responsibleUser: true;
      causes: true;
      analyses: true;
      actions: { include: { responsibleUser: { select: { id: true; name: true } } } };
    };
  }>,
) {
  return {
    id: d.id,
    companyId: d.companyId,
    number: d.number,
    title: d.title,
    periodRef: d.periodRef,
    severity: d.severity,
    status: d.status,
    method: d.method,
    dueDate: d.dueDate,
    openedAt: d.openedAt,
    closedAt: d.closedAt,
    indicator: d.indicator
      ? { id: d.indicator.id, name: d.indicator.name, code: d.indicator.code, ownerNodeId: d.indicator.ownerNodeId }
      : null,
    responsibleUser: d.responsibleUser ? { id: d.responsibleUser.id, name: d.responsibleUser.name } : null,
    summary: true as const,
    _count: { causes: d.causes.length, analyses: d.analyses.length, actions: d.actions.length },
  };
}
