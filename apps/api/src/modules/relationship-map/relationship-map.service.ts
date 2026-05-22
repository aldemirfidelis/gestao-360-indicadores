import { Injectable, NotFoundException } from '@nestjs/common';
import { MapMode, MapNodeType, Prisma, TraceEntityType, TraceEventType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TraceabilityService } from '../traceability/traceability.service';

@Injectable()
export class RelationshipMapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityService,
  ) {}

  async defaultMap(companyId: string) {
    const map = await this.ensureDefaultMap(companyId);
    if (await this.shouldSyncDefaultMap(companyId, map.id, map.updatedAt)) {
      await this.syncDefaultMap(companyId, map.id);
    }
    return this.getById(companyId, map.id);
  }

  async getById(companyId: string, id: string) {
    const map = await this.prisma.relationshipMap.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        nodes: { orderBy: [{ positionY: 'asc' }, { positionX: 'asc' }] },
        edges: true,
        layouts: true,
      },
    });
    if (!map) throw new NotFoundException('Mapa nao encontrado');
    return map;
  }

  async list(companyId: string) {
    return this.prisma.relationshipMap.findMany({
      where: { companyId, deletedAt: null },
      include: { _count: { select: { nodes: true, edges: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createMap(companyId: string, body: { name: string; description?: string; mode?: MapMode }) {
    return this.prisma.relationshipMap.create({
      data: {
        companyId,
        name: body.name,
        description: body.description ?? null,
        mode: body.mode ?? MapMode.TRACEABILITY,
      },
    });
  }

  async createNode(companyId: string, body: any) {
    const mapId = body.mapId ?? (await this.ensureDefaultMap(companyId)).id;
    await this.assertMap(companyId, mapId);
    const node = await this.prisma.mapNode.create({
      data: {
        mapId,
        type: body.type ?? MapNodeType.CUSTOM,
        refTable: body.refTable ?? null,
        refId: body.refId ?? null,
        label: body.label,
        status: body.status ?? null,
        responsible: body.responsible ?? null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        positionX: body.positionX ?? 0,
        positionY: body.positionY ?? 0,
        data: body.data as Prisma.InputJsonValue | undefined,
      },
    });
    await this.traceability.record({
      companyId,
      eventType: TraceEventType.CREATED,
      entityType: TraceEntityType.MAP_NODE,
      entityId: node.id,
      title: `Bloco criado no mapa: ${node.label}`,
      metadata: { type: node.type, refTable: node.refTable, refId: node.refId },
    });
    return node;
  }

  async updateNode(companyId: string, id: string, body: any) {
    const node = await this.prisma.mapNode.findFirst({
      where: { id, map: { companyId, deletedAt: null } },
    });
    if (!node) throw new NotFoundException('No do mapa nao encontrado');
    const updated = await this.prisma.mapNode.update({
      where: { id },
      data: {
        label: body.label,
        status: body.status,
        responsible: body.responsible,
        collapsed: body.collapsed,
        dueDate: body.dueDate === undefined ? undefined : body.dueDate ? new Date(body.dueDate) : null,
        positionX: body.positionX,
        positionY: body.positionY,
        data: body.data as Prisma.InputJsonValue | undefined,
      },
    });
    await this.traceability.record({
      companyId,
      eventType: TraceEventType.UPDATED,
      entityType: TraceEntityType.MAP_NODE,
      entityId: id,
      title: `Bloco atualizado: ${updated.label}`,
      metadata: { before: { label: node.label, status: node.status }, after: { label: updated.label, status: updated.status } },
    });
    return updated;
  }

  async removeNode(companyId: string, id: string) {
    const node = await this.prisma.mapNode.findFirst({ where: { id, map: { companyId } } });
    if (!node) throw new NotFoundException('No do mapa nao encontrado');
    await this.prisma.mapNode.delete({ where: { id } });
    await this.traceability.record({
      companyId,
      eventType: TraceEventType.LINK_REMOVED,
      entityType: TraceEntityType.MAP_NODE,
      entityId: id,
      title: `Bloco removido do mapa: ${node.label}`,
    });
    return { ok: true };
  }

  async createEdge(companyId: string, body: any) {
    const mapId = body.mapId ?? (await this.ensureDefaultMap(companyId)).id;
    await this.assertMap(companyId, mapId);
    const edge = await this.prisma.mapEdge.upsert({
      where: {
        mapId_sourceNodeId_targetNodeId_kind: {
          mapId,
          sourceNodeId: body.sourceNodeId,
          targetNodeId: body.targetNodeId,
          kind: body.kind ?? 'relates_to',
        },
      },
      create: {
        mapId,
        sourceNodeId: body.sourceNodeId,
        targetNodeId: body.targetNodeId,
        kind: body.kind ?? 'relates_to',
        label: body.label ?? null,
        data: body.data as Prisma.InputJsonValue | undefined,
      },
      update: {
        label: body.label ?? null,
        data: body.data as Prisma.InputJsonValue | undefined,
      },
    });
    await this.traceability.record({
      companyId,
      eventType: TraceEventType.LINK_CREATED,
      entityType: TraceEntityType.MAP_EDGE,
      entityId: edge.id,
      title: 'Conexao criada no mapa',
      metadata: { sourceNodeId: edge.sourceNodeId, targetNodeId: edge.targetNodeId, kind: edge.kind },
    });
    return edge;
  }

  async removeEdge(companyId: string, id: string) {
    const edge = await this.prisma.mapEdge.findFirst({ where: { id, map: { companyId } } });
    if (!edge) throw new NotFoundException('Conexao nao encontrada');
    await this.prisma.mapEdge.delete({ where: { id } });
    await this.traceability.record({
      companyId,
      eventType: TraceEventType.LINK_REMOVED,
      entityType: TraceEntityType.MAP_EDGE,
      entityId: id,
      title: 'Conexao removida do mapa',
      metadata: { sourceNodeId: edge.sourceNodeId, targetNodeId: edge.targetNodeId, kind: edge.kind },
    });
    return { ok: true };
  }

  async saveLayout(companyId: string, userId: string, mapId: string, body: { mode?: MapMode; viewport?: any; nodes?: Array<{ id: string; positionX: number; positionY: number }> }) {
    await this.assertMap(companyId, mapId);
    if (body.nodes?.length) {
      await this.prisma.$transaction(
        body.nodes.map((node) =>
          this.prisma.mapNode.update({
            where: { id: node.id },
            data: { positionX: node.positionX, positionY: node.positionY },
          }),
        ),
      );
    }
    return this.prisma.mapLayout.upsert({
      where: { mapId_mode: { mapId, mode: body.mode ?? MapMode.TRACEABILITY } },
      create: {
        mapId,
        mode: body.mode ?? MapMode.TRACEABILITY,
        viewport: body.viewport as Prisma.InputJsonValue | undefined,
        nodesJson: body.nodes as Prisma.InputJsonValue | undefined,
        updatedById: userId,
      },
      update: {
        viewport: body.viewport as Prisma.InputJsonValue | undefined,
        nodesJson: body.nodes as Prisma.InputJsonValue | undefined,
        updatedById: userId,
      },
    });
  }

  private async ensureDefaultMap(companyId: string) {
    const existing = await this.prisma.relationshipMap.findFirst({
      where: { companyId, deletedAt: null, active: true, name: 'Mapa de Rastreabilidade 360' },
    });
    if (existing) return existing;
    return this.prisma.relationshipMap.create({
      data: {
        companyId,
        name: 'Mapa de Rastreabilidade 360',
        description: 'Fluxo Empresa -> Diretrizes -> Areas -> Indicadores -> Desvios -> Reunioes -> Planos de acao.',
        mode: MapMode.TRACEABILITY,
      },
    });
  }

  private async assertMap(companyId: string, mapId: string) {
    const count = await this.prisma.relationshipMap.count({ where: { id: mapId, companyId, deletedAt: null } });
    if (!count) throw new NotFoundException('Mapa nao encontrado');
  }

  private async shouldSyncDefaultMap(companyId: string, mapId: string, lastSyncAt: Date) {
    const nodeCount = await this.prisma.mapNode.count({ where: { mapId } });
    if (nodeCount === 0) return true;

    const [orgNodes, indicators, deviations, treatments, actions, meetings, strategicMaps, perspectives, objectives, relations] = await Promise.all([
      this.prisma.orgNode.aggregate({ where: { companyId, deletedAt: null }, _max: { updatedAt: true } }),
      this.prisma.indicator.aggregate({ where: { companyId, deletedAt: null }, _max: { updatedAt: true } }),
      this.prisma.deviation.aggregate({ where: { companyId, deletedAt: null }, _max: { updatedAt: true } }),
      this.prisma.treatmentCase.aggregate({ where: { companyId }, _max: { updatedAt: true } }),
      this.prisma.actionPlan.aggregate({ where: { companyId, deletedAt: null }, _max: { updatedAt: true } }),
      this.prisma.meeting.aggregate({ where: { companyId, deletedAt: null }, _max: { updatedAt: true } }),
      this.prisma.strategicMap.aggregate({ where: { companyId, deletedAt: null }, _max: { updatedAt: true } }),
      this.prisma.perspective.aggregate({ where: { map: { companyId, deletedAt: null }, deletedAt: null }, _max: { updatedAt: true } }),
      this.prisma.strategicObjective.aggregate({ where: { map: { companyId, deletedAt: null }, deletedAt: null }, _max: { updatedAt: true } }),
      this.prisma.objectiveRelation.aggregate({ where: { from: { map: { companyId, deletedAt: null } } }, _max: { updatedAt: true } }),
    ]);

    return [
      orgNodes._max.updatedAt,
      indicators._max.updatedAt,
      deviations._max.updatedAt,
      treatments._max.updatedAt,
      actions._max.updatedAt,
      meetings._max.updatedAt,
      strategicMaps._max.updatedAt,
      perspectives._max.updatedAt,
      objectives._max.updatedAt,
      relations._max.updatedAt,
    ].some((updatedAt) => !!updatedAt && updatedAt > lastSyncAt);
  }

  private async syncDefaultMap(companyId: string, mapId: string) {
    const [company, orgNodes, strategicMaps, indicators, deviations, treatments, actions, meetings] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } }),
      this.prisma.orgNode.findMany({
        where: { companyId, deletedAt: null, active: true },
        include: { parent: { select: { id: true } }, responsibleUser: { select: { name: true } } },
        orderBy: [{ type: 'asc' }, { position: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.strategicMap.findMany({
        where: { companyId, deletedAt: null, active: true },
        include: {
          perspectives: { where: { deletedAt: null, active: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }] },
          objectives: {
            where: { deletedAt: null, active: true },
            include: {
              perspective: { select: { id: true, name: true, color: true } },
              ownerNode: { select: { id: true, name: true } },
              responsibleUser: { select: { name: true } },
              orgNodeLinks: { where: { deletedAt: null }, select: { orgNodeId: true, kind: true } },
              indicatorLinks: { where: { deletedAt: null }, select: { indicatorId: true } },
              indicators: { select: { id: true } },
              outRelations: { where: { deletedAt: null, active: true }, select: { toId: true, kind: true, label: true } },
            },
            orderBy: [{ perspective: { position: 'asc' } }, { position: 'asc' }, { name: 'asc' }],
          },
        },
        orderBy: [{ startsAt: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.indicator.findMany({
        where: { companyId, deletedAt: null, status: 'ACTIVE' },
        include: {
          ownerNode: { select: { id: true, name: true } },
          responsibleUser: { select: { name: true } },
          strategicObjective: { select: { id: true, name: true, perspective: { select: { id: true, name: true } } } },
          strategicObjectiveLinks: {
            where: { deletedAt: null },
            include: { objective: { select: { id: true, name: true, perspective: { select: { id: true, name: true } } } } },
          },
          results: { orderBy: { periodDate: 'desc' }, take: 1, select: { light: true, periodRef: true, attainment: true } },
        },
      }),
      this.prisma.deviation.findMany({
        where: { companyId, deletedAt: null },
        include: { indicator: { select: { id: true } }, responsibleUser: { select: { name: true } } },
        orderBy: { openedAt: 'desc' },
        take: 150,
      }),
      this.prisma.treatmentCase.findMany({
        where: { companyId },
        include: { indicator: { select: { id: true, name: true, responsibleUser: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 150,
      }),
      this.prisma.actionPlan.findMany({
        where: { companyId, deletedAt: null },
        include: { responsibleUser: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.meeting.findMany({ where: { companyId, deletedAt: null }, orderBy: { startsAt: 'desc' }, take: 80 }),
    ]);

    if (company) {
      await this.upsertRefNode(mapId, 'Company', company.id, MapNodeType.COMPANY, company.name, 0, 0, 'ACTIVE');
    }

    for (const [index, node] of orgNodes.entries()) {
      await this.upsertRefNode(
        mapId,
        'OrgNode',
        node.id,
        this.orgNodeMapType(node.type),
        node.name,
        this.columnForType(this.orgNodeMapType(node.type)),
        (index % 20) * 92,
        node.active ? 'ACTIVE' : 'INACTIVE',
        node.responsibleUser?.name,
      );
      if (node.parentId) {
        await this.upsertRefEdge(mapId, 'OrgNode', node.parentId, 'OrgNode', node.id, 'contains', 'estrutura');
      } else if (company) {
        await this.upsertRefEdge(mapId, 'Company', company.id, 'OrgNode', node.id, 'contains', 'estrutura');
      }
    }

    for (const [mapIndex, strategicMap] of strategicMaps.entries()) {
      await this.upsertRefNode(
        mapId,
        'StrategicMap',
        strategicMap.id,
        MapNodeType.GUIDELINE,
        strategicMap.name,
        220,
        mapIndex * 180,
        strategicMap.active ? 'ACTIVE' : 'INACTIVE',
        undefined,
        strategicMap.endsAt,
        { startsAt: strategicMap.startsAt.toISOString(), endsAt: strategicMap.endsAt.toISOString() },
      );
      if (company) {
        await this.upsertRefEdge(mapId, 'Company', company.id, 'StrategicMap', strategicMap.id, 'strategy', 'estrategia');
      }

      for (const [perspectiveIndex, perspective] of strategicMap.perspectives.entries()) {
        await this.upsertRefNode(
          mapId,
          'Perspective',
          perspective.id,
          MapNodeType.GUIDELINE,
          perspective.name,
          460,
          mapIndex * 180 + perspectiveIndex * 92,
          'ACTIVE',
          undefined,
          undefined,
          { mapId: strategicMap.id, color: perspective.color },
        );
        await this.upsertRefEdge(mapId, 'StrategicMap', strategicMap.id, 'Perspective', perspective.id, 'has_perspective', 'perspectiva');
      }

      for (const [objectiveIndex, objective] of strategicMap.objectives.entries()) {
        await this.upsertRefNode(
          mapId,
          'StrategicObjective',
          objective.id,
          MapNodeType.OBJECTIVE,
          objective.name,
          700,
          mapIndex * 180 + objectiveIndex * 92,
          objective.status,
          objective.responsibleUser?.name ?? objective.responsible ?? undefined,
          undefined,
          {
            mapId: strategicMap.id,
            perspectiveId: objective.perspectiveId,
            perspective: objective.perspective?.name,
            priority: objective.priority,
            weight: objective.weight,
            ownerNodeId: objective.ownerNodeId,
          },
        );
        await this.upsertRefEdge(mapId, 'Perspective', objective.perspectiveId, 'StrategicObjective', objective.id, 'contains_objective', 'objetivo');
        if (objective.ownerNodeId) {
          await this.upsertRefEdge(mapId, 'OrgNode', objective.ownerNodeId, 'StrategicObjective', objective.id, 'owns_strategy', 'responsavel');
        }
        for (const link of objective.orgNodeLinks) {
          await this.upsertRefEdge(mapId, 'OrgNode', link.orgNodeId, 'StrategicObjective', objective.id, link.kind, 'estrutura');
        }
        for (const relation of objective.outRelations) {
          await this.upsertRefEdge(mapId, 'StrategicObjective', objective.id, 'StrategicObjective', relation.toId, relation.kind, relation.label ?? 'impacta');
        }
      }
    }

    for (const [index, indicator] of indicators.entries()) {
      const strategicOrigins = [
        ...(indicator.strategicObjective ? [indicator.strategicObjective] : []),
        ...indicator.strategicObjectiveLinks.map((link) => link.objective),
      ].filter((objective, originIndex, all) => all.findIndex((item) => item.id === objective.id) === originIndex);
      await this.upsertRefNode(
        mapId,
        'Indicator',
        indicator.id,
        MapNodeType.INDICATOR,
        indicator.name,
        900,
        (index % 30) * 92,
        indicator.results[0]?.light ?? 'GRAY',
        indicator.responsibleUser?.name,
        undefined,
        {
          code: indicator.code,
          periodRef: indicator.results[0]?.periodRef,
          attainment: indicator.results[0]?.attainment,
          strategicOrigins: strategicOrigins.map((objective) => ({
            id: objective.id,
            name: objective.name,
            perspective: objective.perspective?.name,
          })),
        },
      );
      await this.upsertRefEdge(mapId, 'OrgNode', indicator.ownerNodeId, 'Indicator', indicator.id, 'owns', 'acompanha');
      for (const objective of strategicOrigins) {
        await this.upsertRefEdge(mapId, 'StrategicObjective', objective.id, 'Indicator', indicator.id, 'measured_by', 'indicador');
      }
    }

    for (const [index, deviation] of deviations.entries()) {
      await this.upsertRefNode(
        mapId,
        'Deviation',
        deviation.id,
        MapNodeType.DEVIATION,
        `#${deviation.number} ${deviation.title}`,
        1220,
        (index % 30) * 92,
        deviation.status,
        deviation.responsibleUser?.name,
        deviation.dueDate ?? undefined,
        { severity: deviation.severity, periodRef: deviation.periodRef },
      );
      await this.upsertRefEdge(mapId, 'Indicator', deviation.indicatorId, 'Deviation', deviation.id, 'generated', 'desvio');
    }

    for (const [index, treatment] of treatments.entries()) {
      await this.upsertRefNode(
        mapId,
        'TreatmentCase',
        treatment.id,
        MapNodeType.FOLLOW_UP,
        treatment.title || `Tratativa - ${treatment.indicator.name}`,
        1380,
        (index % 30) * 92,
        treatment.status,
        treatment.indicator.responsibleUser?.name,
        undefined,
        { periodRef: treatment.periodRef, indicatorId: treatment.indicatorId, deviationId: treatment.deviationId },
      );
      await this.upsertRefEdge(mapId, 'Indicator', treatment.indicatorId, 'TreatmentCase', treatment.id, 'requires_treatment', 'tratativa');
      if (treatment.deviationId) {
        await this.upsertRefEdge(mapId, 'TreatmentCase', treatment.id, 'Deviation', treatment.deviationId, 'analyses', 'analise');
      }
    }

    for (const [index, meeting] of meetings.entries()) {
      await this.upsertRefNode(
        mapId,
        'Meeting',
        meeting.id,
        MapNodeType.MEETING,
        meeting.title,
        1540,
        (index % 20) * 92,
        meeting.startsAt > new Date() ? 'SCHEDULED' : 'DONE',
        undefined,
        meeting.startsAt,
        { kind: meeting.kind },
      );
      if (meeting.treatmentId) {
        await this.upsertRefEdge(mapId, 'TreatmentCase', meeting.treatmentId, 'Meeting', meeting.id, 'schedules', 'reuniao');
      } else if (company) {
        await this.upsertRefEdge(mapId, 'Company', company.id, 'Meeting', meeting.id, 'governance', 'reuniao');
      }
    }

    for (const [index, action] of actions.entries()) {
      await this.upsertRefNode(
        mapId,
        'ActionPlan',
        action.id,
        MapNodeType.ACTION,
        action.title,
        1860,
        (index % 35) * 92,
        action.status,
        action.responsibleUser?.name,
        action.dueDate ?? undefined,
        { priority: action.priority, progress: action.progress, origin: action.origin },
      );
      if (action.treatmentId) {
        await this.upsertRefEdge(mapId, 'TreatmentCase', action.treatmentId, 'ActionPlan', action.id, 'generates', 'acao');
      } else if (action.meetingId) {
        await this.upsertRefEdge(mapId, 'Meeting', action.meetingId, 'ActionPlan', action.id, 'generates', 'acao');
      } else if (action.deviationId) {
        await this.upsertRefEdge(mapId, 'Deviation', action.deviationId, 'ActionPlan', action.id, 'treated_by', 'acao');
      } else if (action.origin === 'MEETING' && action.originRefId) {
        await this.upsertRefEdge(mapId, 'Meeting', action.originRefId, 'ActionPlan', action.id, 'generates', 'acao');
      } else if (action.ownerNodeId) {
        await this.upsertRefEdge(mapId, 'OrgNode', action.ownerNodeId, 'ActionPlan', action.id, 'owns', 'acao');
      } else if (company) {
        await this.upsertRefEdge(mapId, 'Company', company.id, 'ActionPlan', action.id, 'tracks', 'acao');
      }
    }

    await this.prisma.relationshipMap.update({
      where: { id: mapId },
      data: { active: true },
    });
  }

  private async upsertRefNode(
    mapId: string,
    refTable: string,
    refId: string,
    type: MapNodeType,
    label: string,
    positionX: number,
    positionY: number,
    status?: string | null,
    responsible?: string | null,
    dueDate?: Date,
    data?: Prisma.InputJsonValue,
  ) {
    const existing = await this.prisma.mapNode.findFirst({ where: { mapId, refTable, refId } });
    if (existing) {
      return this.prisma.mapNode.update({
        where: { id: existing.id },
        data: { type, label, status: status ?? null, responsible: responsible ?? null, dueDate: dueDate ?? null, data },
      });
    }
    return this.prisma.mapNode.create({
      data: { mapId, refTable, refId, type, label, status: status ?? null, responsible: responsible ?? null, dueDate: dueDate ?? null, positionX, positionY, data },
    });
  }

  private async upsertRefEdge(
    mapId: string,
    sourceTable: string,
    sourceId: string,
    targetTable: string,
    targetId: string,
    kind: string,
    label?: string,
  ) {
    const [source, target] = await Promise.all([
      this.prisma.mapNode.findFirst({ where: { mapId, refTable: sourceTable, refId: sourceId }, select: { id: true } }),
      this.prisma.mapNode.findFirst({ where: { mapId, refTable: targetTable, refId: targetId }, select: { id: true } }),
    ]);
    if (!source || !target) return null;
    return this.prisma.mapEdge.upsert({
      where: { mapId_sourceNodeId_targetNodeId_kind: { mapId, sourceNodeId: source.id, targetNodeId: target.id, kind } },
      create: { mapId, sourceNodeId: source.id, targetNodeId: target.id, kind, label: label ?? null },
      update: { label: label ?? null },
    });
  }

  private orgNodeMapType(type: string): MapNodeType {
    if (type === 'COMPANY' || type === 'BRANCH') return MapNodeType.COMPANY;
    if (['DIRECTORATE', 'MANAGEMENT', 'COORDINATION'].includes(type)) return MapNodeType.GUIDELINE;
    if (type === 'SECTOR') return MapNodeType.SECTOR;
    if (type === 'AREA') return MapNodeType.AREA;
    if (type === 'PROCESS') return MapNodeType.PROCESS;
    return MapNodeType.CUSTOM;
  }

  private columnForType(type: MapNodeType) {
    switch (type) {
      case MapNodeType.COMPANY:
        return 0;
      case MapNodeType.GUIDELINE:
        return 250;
      case MapNodeType.SECTOR:
        return 500;
      case MapNodeType.AREA:
      case MapNodeType.PROCESS:
        return 700;
      default:
        return 900;
    }
  }
}
