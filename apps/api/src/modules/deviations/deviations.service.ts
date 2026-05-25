import { Injectable, NotFoundException } from '@nestjs/common';
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
  ) {}

  async list(companyId: string, status?: DeviationStatus, indicatorId?: string) {
    return this.prisma.deviation.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(indicatorId ? { indicatorId } : {}),
      },
      include: {
        indicator: { select: { id: true, name: true, code: true } },
        responsibleUser: { select: { id: true, name: true } },
        _count: { select: { causes: true, actions: true, analyses: true } },
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  async getById(id: string) {
    const d = await this.prisma.deviation.findFirst({
      where: { id, deletedAt: null },
      include: {
        indicator: true,
        responsibleUser: true,
        causes: true,
        analyses: true,
        actions: { include: { responsibleUser: { select: { id: true, name: true } } } },
      },
    });
    if (!d) throw new NotFoundException('Desvio nao encontrado');
    return d;
  }

  async open(input: OpenDeviationInput): Promise<{ id: string; number: number }> {
    const result = await this.prisma.$transaction(async (tx) => {
      const last = await tx.deviation.findFirst({
        where: { companyId: input.companyId },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      const number = (last?.number ?? 0) + 1;

      const indicator = await tx.indicator.findUnique({
        where: { id: input.indicatorId },
        select: { name: true },
      });

      const title =
        input.title ?? `Desvio #${number} - ${indicator?.name ?? 'Indicador'} (${input.periodRef})`;

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
      description: input.title ?? `Desvio aberto para o periodo ${input.periodRef}`,
      statusTo: DeviationStatus.OPEN,
      metadata: { periodRef: input.periodRef, severity: input.severity ?? DeviationSeverity.MODERATE },
    });

    return result;
  }

  async update(id: string, patch: Prisma.DeviationUpdateInput, userId?: string) {
    const before = await this.prisma.deviation.findUnique({ where: { id } });
    const updated = await this.prisma.deviation.update({ where: { id }, data: patch });
    const nextStatus = typeof patch.status === 'string' ? patch.status : undefined;
    if (before && nextStatus && before.status !== nextStatus) {
      await this.traceability.record({
        companyId: updated.companyId,
        indicatorId: updated.indicatorId,
        userId,
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

  async addCause(deviationId: string, description: string, category?: string, weight = 1, userId?: string) {
    const cause = await this.prisma.deviationCause.create({
      data: { deviationId, description, category: category ?? null, weight },
    });
    const dev = await this.prisma.deviation.findUnique({ where: { id: deviationId } });
    if (dev) {
      await this.traceability.record({
        companyId: dev.companyId,
        indicatorId: dev.indicatorId,
        userId,
        eventType: TraceEventType.CAUSE_CREATED,
        entityType: TraceEntityType.DEVIATION_CAUSE,
        entityId: cause.id,
        relatedType: TraceEntityType.DEVIATION,
        relatedId: deviationId,
        title: 'Causa identificada',
        description,
        metadata: { category, weight, deviationNumber: dev.number },
      });
    }
    return cause;
  }

  async removeCause(causeId: string) {
    return this.prisma.deviationCause.delete({ where: { id: causeId } });
  }

  async addAnalysis(deviationId: string, method: AnalysisMethod, content: string, userId?: string) {
    const analysis = await this.prisma.deviationAnalysis.create({
      data: { deviationId, method, content },
    });
    const dev = await this.prisma.deviation.findUnique({ where: { id: deviationId } });
    if (dev) {
      await this.traceability.record({
        companyId: dev.companyId,
        indicatorId: dev.indicatorId,
        userId,
        eventType: TraceEventType.ANALYSIS_CREATED,
        entityType: TraceEntityType.DEVIATION_ANALYSIS,
        entityId: analysis.id,
        relatedType: TraceEntityType.DEVIATION,
        relatedId: deviationId,
        title: `Analise de causa registrada (${method})`,
        description: content,
        metadata: { method, deviationNumber: dev.number },
      });
    }
    return analysis;
  }

  async createAction(
    deviationId: string,
    createdById: string,
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
    const dev = await this.prisma.deviation.findFirst({
      where: { id: deviationId, deletedAt: null },
      include: { indicator: { select: { ownerNodeId: true } } },
    });
    if (!dev) throw new NotFoundException('Desvio nao encontrado');

    const action = await this.prisma.actionPlan.create({
      data: {
        companyId: dev.companyId,
        deviationId: dev.id,
        origin: ActionOrigin.DEVIATION,
        originRefId: dev.id,
        title: body.title,
        description: body.description ?? null,
        responsibleUserId: body.responsibleUserId ?? dev.responsibleUserId ?? null,
        ownerNodeId: body.ownerNodeId ?? dev.indicator.ownerNodeId ?? null,
        priority: (body.priority as ActionPriority | undefined) ?? ActionPriority.HIGH,
        status: ActionStatus.NOT_STARTED,
        dueDate: body.dueDate ? new Date(body.dueDate) : dev.dueDate,
        estimatedCost: body.estimatedCost ?? null,
        createdById,
      },
    });

    await this.prisma.deviation.update({
      where: { id: deviationId },
      data: { status: DeviationStatus.WAITING_ACTION },
    });

    await this.traceability.record({
      companyId: dev.companyId,
      indicatorId: dev.indicatorId,
      userId: createdById,
      eventType: TraceEventType.ACTION_CREATED,
      entityType: TraceEntityType.ACTION_PLAN,
      entityId: action.id,
      relatedType: TraceEntityType.DEVIATION,
      relatedId: dev.id,
      title: 'Plano de acao criado a partir do desvio',
      description: action.title,
      statusFrom: dev.status,
      statusTo: DeviationStatus.WAITING_ACTION,
      metadata: { priority: action.priority, dueDate: action.dueDate, deviationNumber: dev.number },
    });

    return action;
  }

  async close(id: string, userId?: string) {
    const dev = await this.getById(id);
    const completedStatuses = ['DONE', 'DONE_LATE', 'CANCELLED', 'EFFECTIVE', 'INEFFECTIVE'];
    const open = dev.actions.filter((a) => !completedStatuses.includes(a.status));
    if (open.length > 0) {
      throw new NotFoundException(
        `Existem ${open.length} acao(oes) abertas. Conclua-as antes de fechar o desvio.`,
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
      userId,
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
