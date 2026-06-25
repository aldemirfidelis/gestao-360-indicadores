import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { logSwallowed } from '../../common/logging/swallow';
import { Prisma, TraceEntityType, TraceEventType } from '@prisma/client';
import { ModuleRef } from '@nestjs/core';

export interface TraceabilityRecordInput {
  companyId: string;
  indicatorId?: string | null;
  userId?: string | null;
  eventType: TraceEventType;
  entityType: TraceEntityType;
  entityId: string;
  relatedType?: TraceEntityType | null;
  relatedId?: string | null;
  title: string;
  description?: string | null;
  statusFrom?: string | null;
  statusTo?: string | null;
  metadata?: Prisma.InputJsonValue;
  occurredAt?: Date;
}

@Injectable()
export class TraceabilityService {
  private readonly logger = new Logger(TraceabilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef
  ) {}

  async record(input: TraceabilityRecordInput) {
    const event = await this.prisma.traceabilityEvent.create({
      data: {
        companyId: input.companyId,
        indicatorId: input.indicatorId ?? null,
        userId: input.userId ?? null,
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId,
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId ?? null,
        title: input.title,
        description: input.description ?? null,
        statusFrom: input.statusFrom ?? null,
        statusTo: input.statusTo ?? null,
        metadata: input.metadata,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });

    if (input.statusTo && input.statusFrom !== input.statusTo) {
      await this.prisma.statusHistory.create({
        data: {
          companyId: input.companyId,
          userId: input.userId ?? null,
          entityType: input.entityType,
          entityId: input.entityId,
          statusFrom: input.statusFrom ?? null,
          statusTo: input.statusTo,
          reason: input.title,
          metadata: input.metadata,
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId ?? null,
        action: input.eventType,
        entity: input.entityType,
        entityId: input.entityId,
        payload: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });

    // Forward as domain event to the Workflow engine
    try {
      const { WorkflowEventDispatcher } = await import('../automations/services/workflow-dispatcher.service');
      const dispatcher = this.moduleRef.get(WorkflowEventDispatcher, { strict: false });
      if (dispatcher) {
        const entityMap: Record<string, string> = {
          INDICATOR: 'indicator',
          INDICATOR_RESULT: 'indicator_result',
          ACTION_PLAN: 'action',
          ACTION_TASK: 'action_task',
          DOCUMENT: 'document',
          AUDIT: 'audit',
          NON_CONFORMITY: 'nonconformity',
          FORM_SUBMISSION: 'checklist',
          RISK: 'risk',
          TRAINING: 'training',
        };

        const eventMap: Record<string, string> = {
          CREATED: 'created',
          UPDATED: 'updated',
          STATUS_CHANGED: 'status_changed',
          RESULT_RECORDED: 'result_recorded',
          OFF_TARGET_ALERT: 'out_of_target',
        };

        const entity = entityMap[input.entityType] || input.entityType.toLowerCase();
        const eventTypeStr = eventMap[input.eventType] || input.eventType.toLowerCase();
        const mappedType = `${entity}.${eventTypeStr}`;

        // Asynchronously dispatch event
        setImmediate(() => {
          dispatcher.dispatchEvent(
            input.companyId,
            mappedType,
            input.entityType,
            input.entityId,
            {
              userId: input.userId,
              indicatorId: input.indicatorId,
              relatedType: input.relatedType,
              relatedId: input.relatedId,
              title: input.title,
              description: input.description,
              statusFrom: input.statusFrom,
              statusTo: input.statusTo,
              ...(input.metadata ? (input.metadata as any) : {}),
            }
          ).catch((err) => {
            this.logger.error(`Failed to dispatch workflow event ${mappedType}: ${err.message}`);
          });
        });
      }
    } catch (err) {
      // Dispatcher de workflow pode não estar inicializado — não bloqueia o registro de rastreabilidade.
      logSwallowed('traceability.dispatchWorkflowEvent', err, 'debug');
    }

    return event;
  }

  async list(
    companyId: string,
    filters: {
      indicatorId?: string;
      entityType?: TraceEntityType;
      entityId?: string;
      limit?: number;
    },
  ) {
    return this.prisma.traceabilityEvent.findMany({
      where: {
        companyId,
        ...(filters.indicatorId ? { indicatorId: filters.indicatorId } : {}),
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.entityId ? { entityId: filters.entityId } : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { occurredAt: 'desc' },
      take: filters.limit ?? 200,
    });
  }

  async indicatorTimeline(companyId: string, indicatorId: string) {
    const [indicator, events, results, deviations] = await Promise.all([
      this.prisma.indicator.findFirst({
        where: { id: indicatorId, companyId, deletedAt: null },
        include: {
          ownerNode: { select: { id: true, name: true, type: true, parent: { select: { id: true, name: true, type: true } } } },
          responsibleUser: { select: { id: true, name: true } },
          strategicObjective: {
            select: {
              id: true,
              name: true,
              perspective: { select: { id: true, name: true, kind: true } },
              map: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.list(companyId, { indicatorId, limit: 300 }),
      this.prisma.indicatorResult.findMany({
        where: { indicatorId },
        include: { createdBy: { select: { id: true, name: true, email: true } } },
        orderBy: { periodDate: 'desc' },
      }),
      this.prisma.deviation.findMany({
        where: { companyId, indicatorId, deletedAt: null },
        include: {
          responsibleUser: { select: { id: true, name: true, email: true } },
          causes: true,
          analyses: true,
          actions: {
            include: {
              responsibleUser: { select: { id: true, name: true, email: true } },
              tasks: true,
            },
          },
        },
        orderBy: { openedAt: 'desc' },
      }),
    ]);

    const synthetic = [
      ...(indicator
        ? [{
            id: `indicator-${indicator.id}`,
            eventType: TraceEventType.CREATED,
            entityType: TraceEntityType.INDICATOR,
            entityId: indicator.id,
            title: 'Indicador cadastrado',
            description: `${indicator.name} vinculado a ${indicator.ownerNode.name}`,
            statusFrom: null,
            statusTo: indicator.status,
            occurredAt: indicator.createdAt,
            user: null,
            metadata: {
              code: indicator.code,
              direction: indicator.direction,
              ownerNode: indicator.ownerNode,
              strategicObjective: indicator.strategicObjective,
              responsibleUser: indicator.responsibleUser,
            },
          }]
        : []),
      ...results.map((r) => ({
        id: `result-${r.id}`,
        eventType: r.light === 'RED' ? TraceEventType.OFF_TARGET_ALERT : TraceEventType.RESULT_RECORDED,
        entityType: TraceEntityType.INDICATOR_RESULT,
        entityId: r.id,
        title: r.light === 'RED' ? 'Resultado fora da meta' : 'Resultado lancado',
        description: `${r.periodRef}: realizado ${r.value}`,
        statusFrom: null,
        statusTo: r.light,
        occurredAt: r.updatedAt,
        user: r.createdBy,
        metadata: {
          periodRef: r.periodRef,
          value: r.value,
          light: r.light,
          attainment: r.attainment,
          deviationPct: r.deviationPct,
        },
      })),
      ...deviations.flatMap((d) => [
        {
          id: `deviation-${d.id}`,
          eventType: TraceEventType.CREATED,
          entityType: TraceEntityType.DEVIATION,
          entityId: d.id,
          title: `Desvio #${d.number} aberto`,
          description: d.title,
          statusFrom: null,
          statusTo: d.status,
          occurredAt: d.openedAt,
          user: d.responsibleUser,
          metadata: { severity: d.severity, method: d.method, periodRef: d.periodRef, rootCause: d.rootCause },
        },
        ...d.causes.map((c) => ({
          id: `cause-${c.id}`,
          eventType: TraceEventType.CAUSE_CREATED,
          entityType: TraceEntityType.DEVIATION_CAUSE,
          entityId: c.id,
          relatedType: TraceEntityType.DEVIATION,
          relatedId: d.id,
          title: 'Causa identificada',
          description: c.description,
          statusFrom: null,
          statusTo: null,
          occurredAt: c.createdAt,
          user: null,
          metadata: { category: c.category, weight: c.weight, deviationNumber: d.number },
        })),
        ...d.analyses.map((a) => ({
          id: `analysis-${a.id}`,
          eventType: TraceEventType.ANALYSIS_CREATED,
          entityType: TraceEntityType.DEVIATION_ANALYSIS,
          entityId: a.id,
          relatedType: TraceEntityType.DEVIATION,
          relatedId: d.id,
          title: `Análise de causa registrada (${a.method})`,
          description: a.content,
          statusFrom: null,
          statusTo: null,
          occurredAt: a.createdAt,
          user: null,
          metadata: { method: a.method, deviationNumber: d.number },
        })),
        ...d.actions.map((a) => ({
          id: `action-${a.id}`,
          eventType: TraceEventType.ACTION_CREATED,
          entityType: TraceEntityType.ACTION_PLAN,
          entityId: a.id,
          relatedType: TraceEntityType.DEVIATION,
          relatedId: d.id,
          title: 'Plano de ação vinculado',
          description: a.title,
          statusFrom: null,
          statusTo: a.status,
          occurredAt: a.createdAt,
          user: a.responsibleUser,
          metadata: {
            priority: a.priority,
            dueDate: a.dueDate,
            progress: a.progress,
            tasks: a.tasks.length,
            deviationNumber: d.number,
          },
        })),
      ]),
      ...events.map((e) => ({
        ...e,
        metadata: e.metadata as unknown,
      })),
    ];

    const dedup = new Map<string, (typeof synthetic)[number]>();
    for (const item of synthetic) dedup.set(`${item.entityType}-${item.entityId}-${item.eventType}-${new Date(item.occurredAt).toISOString()}`, item);

    return {
      indicator,
      events: Array.from(dedup.values()).sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      ),
    };
  }
}
