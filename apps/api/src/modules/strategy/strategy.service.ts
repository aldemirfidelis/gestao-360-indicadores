import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ObjectiveStatus, PerspectiveKind, Prisma, TrafficLight } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';

const STRATEGY_MODULE = 'Mapa Estratégico';

// Status "finais" de uma ação (não contam como aberta/atrasada no hover do mapa).
const FINAL_ACTION_STATUSES = new Set<string>(['DONE', 'DONE_LATE', 'CANCELLED', 'EFFECTIVE', 'INEFFECTIVE']);

type MapBody = {
  name?: string;
  description?: string | null;
  startsAt?: string | Date;
  endsAt?: string | Date;
  active?: boolean;
};

type PerspectiveBody = {
  kind?: PerspectiveKind;
  name?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  position?: number;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
  active?: boolean;
};

type ObjectiveBody = {
  perspectiveId?: string;
  name?: string;
  description?: string | null;
  responsible?: string | null;
  responsibleUserId?: string | null;
  ownerNodeId?: string | null;
  orgNodeIds?: string[];
  indicatorIds?: string[];
  status?: ObjectiveStatus;
  weight?: number;
  priority?: number;
  position?: number;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
  active?: boolean;
};

type RelationBody = {
  fromId?: string;
  toId?: string;
  weight?: number;
  kind?: string;
  label?: string | null;
  description?: string | null;
  active?: boolean;
};

@Injectable()
export class StrategyService {
  constructor(private readonly prisma: PrismaService) {}

  async listMaps(companyId: string, includeInactive = false) {
    return this.prisma.strategicMap.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(includeInactive ? {} : { active: true }),
      },
      include: {
        _count: {
          select: {
            perspectives: true,
            objectives: true,
            versions: true,
          },
        },
      },
      orderBy: [{ active: 'desc' }, { startsAt: 'desc' }, { name: 'asc' }],
    });
  }

  async getMap(companyId: string, id: string, periodRef?: string) {
    const map = await this.prisma.strategicMap.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        perspectives: {
          where: { deletedAt: null },
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
        },
        objectives: {
          where: { deletedAt: null },
          include: {
            perspective: true,
            responsibleUser: { select: { id: true, name: true, email: true } },
            ownerNode: { select: { id: true, name: true, type: true } },
            orgNodeLinks: {
              where: { deletedAt: null },
              include: { orgNode: { select: { id: true, name: true, type: true } } },
            },
            indicatorLinks: {
              where: { deletedAt: null },
              include: { indicator: indicatorSelect(periodRef) },
            },
            indicators: indicatorSelect(periodRef),
            outRelations: {
              where: { deletedAt: null, active: true },
              include: { to: { select: { id: true, name: true, perspectiveId: true, status: true } } },
            },
            inRelations: {
              where: { deletedAt: null, active: true },
              include: { from: { select: { id: true, name: true, perspectiveId: true, status: true } } },
            },
          },
          orderBy: [{ perspective: { position: 'asc' } }, { position: 'asc' }, { name: 'asc' }],
        },
        versions: {
          orderBy: { version: 'desc' },
          take: 20,
          select: {
            id: true,
            version: true,
            title: true,
            description: true,
            status: true,
            createdAt: true,
            publishedAt: true,
            createdBy: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!map) throw new NotFoundException('Mapa nao encontrado');

    const objectiveIndicatorIds = map.objectives.flatMap((obj) => uniqueIndicators(obj).map((indicator) => indicator.id));
    const [actionCounts, treatmentCounts, deviationCounts, actionDetails, projectCounts] = await Promise.all([
      objectiveIndicatorIds.length
        ? this.prisma.actionPlan.groupBy({
            by: ['indicatorId'],
            where: { indicatorId: { in: objectiveIndicatorIds }, deletedAt: null },
            _count: { _all: true },
          })
        : [],
      objectiveIndicatorIds.length
        ? this.prisma.treatmentCase.groupBy({
            by: ['indicatorId'],
            where: { indicatorId: { in: objectiveIndicatorIds } },
            _count: { _all: true },
          })
        : [],
      objectiveIndicatorIds.length
        ? this.prisma.deviation.groupBy({
            by: ['indicatorId'],
            where: { indicatorId: { in: objectiveIndicatorIds }, deletedAt: null },
            _count: { _all: true },
          })
        : [],
      objectiveIndicatorIds.length
        ? this.prisma.actionPlan.findMany({
            where: { indicatorId: { in: objectiveIndicatorIds }, deletedAt: null },
            select: {
              id: true,
              indicatorId: true,
              title: true,
              status: true,
              dueDate: true,
              progress: true,
              priority: true,
              responsibleUser: { select: { id: true, name: true } },
              ownerNode: { select: { id: true, name: true, type: true } },
            },
            orderBy: [{ dueDate: 'asc' }, { title: 'asc' }],
          })
        : [],
      objectiveIndicatorIds.length
        ? this.prisma.project.groupBy({
            by: ['indicatorId'],
            where: { companyId: map.companyId, indicatorId: { in: objectiveIndicatorIds }, deletedAt: null },
            _count: { _all: true },
          })
        : [],
    ]);
    const actionsByIndicator = new Map(actionCounts.map((row) => [row.indicatorId, row._count._all]));
    const treatmentsByIndicator = new Map(treatmentCounts.map((row) => [row.indicatorId, row._count._all]));
    const deviationsByIndicator = new Map(deviationCounts.map((row) => [row.indicatorId, row._count._all]));
    const projectsByIndicator = new Map(
      projectCounts.flatMap((row) => (row.indicatorId ? [[row.indicatorId, row._count._all] as const] : [])),
    );
    const actionDetailsByIndicator = new Map<string, typeof actionDetails>();
    for (const action of actionDetails) {
      if (!action.indicatorId) continue;
      const current = actionDetailsByIndicator.get(action.indicatorId) ?? [];
      current.push(action);
      actionDetailsByIndicator.set(action.indicatorId, current);
    }

    const baseLights = new Map<string, TrafficLight>();
    const baseAttainments = new Map<string, number | null>();
    const now = new Date();
    const enrichedObjectives = map.objectives.map((obj) => {
      const indicators = uniqueIndicators(obj).map((indicator) => ({
        ...indicator,
        actions: actionDetailsByIndicator.get(indicator.id) ?? [],
      }));
      const lights = indicators.map((i) => i.results[0]?.light).filter((l): l is TrafficLight => !!l);
      const attainments = indicators.map((i) => i.results[0]?.attainment).filter((v): v is number => v !== null && v !== undefined);
      const avg = attainments.length > 0 ? attainments.reduce((a, b) => a + b, 0) / attainments.length : null;
      const baseLight = aggregateTrafficLight(lights);
      baseLights.set(obj.id, baseLight);
      baseAttainments.set(obj.id, avg);
      // Ações abertas/atrasadas a partir dos detalhes já carregados (hover/drill-down).
      const objActions = indicators.flatMap((i) => i.actions);
      const openActionCount = objActions.filter((a) => !FINAL_ACTION_STATUSES.has(a.status)).length;
      const lateActionCount = objActions.filter(
        (a) => a.dueDate && new Date(a.dueDate) < now && !FINAL_ACTION_STATUSES.has(a.status),
      ).length;
      return {
        ...obj,
        indicators,
        indicatorLinks: undefined,
        baseLight,
        aggregateAttainment: avg,
        actionCount: indicators.reduce((sum, indicator) => sum + (actionsByIndicator.get(indicator.id) ?? 0), 0),
        openActionCount,
        lateActionCount,
        treatmentCount: indicators.reduce((sum, indicator) => sum + (treatmentsByIndicator.get(indicator.id) ?? 0), 0),
        deviationCount: indicators.reduce((sum, indicator) => sum + (deviationsByIndicator.get(indicator.id) ?? 0), 0),
        projectCount: indicators.reduce((sum, indicator) => sum + (projectsByIndicator.get(indicator.id) ?? 0), 0),
      };
    });

    const propagated = new Map<string, TrafficLight>(baseLights);
    const adjacency: Array<[string, string]> = [];
    for (const obj of enrichedObjectives) {
      for (const out of obj.outRelations) {
        adjacency.push([obj.id, out.to.id]);
      }
    }
    for (let iter = 0; iter < enrichedObjectives.length; iter++) {
      let changed = false;
      for (const [from, to] of adjacency) {
        const a = propagated.get(from) ?? 'GRAY';
        const b = propagated.get(to) ?? 'GRAY';
        const worst = worstLight(a, b);
        if (worst !== b) {
          propagated.set(to, worst);
          changed = true;
        }
      }
      if (!changed) break;
    }

    return {
      ...map,
      objectives: enrichedObjectives.map((obj) => ({
        ...obj,
        aggregateLight: propagated.get(obj.id) ?? obj.baseLight,
      })),
    };
  }

  async options(companyId: string) {
    const [indicators, orgNodes, users] = await Promise.all([
      this.prisma.indicator.findMany({
        where: { companyId, deletedAt: null, status: 'ACTIVE' },
        include: {
          ownerNode: { select: { id: true, name: true, type: true } },
          responsibleUser: { select: { id: true, name: true } },
          results: { orderBy: { periodDate: 'desc' }, take: 1, select: { light: true, attainment: true, periodRef: true } },
        },
        orderBy: [{ name: 'asc' }],
      }),
      this.prisma.orgNode.findMany({
        where: { companyId, deletedAt: null, active: true },
        select: { id: true, name: true, type: true, parentId: true, color: true },
        orderBy: [{ type: 'asc' }, { position: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.user.findMany({
        where: { companyId, deletedAt: null, active: true, status: 'ACTIVE' },
        select: { id: true, name: true, email: true, jobTitle: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { indicators, orgNodes, users };
  }

  async duplicateMap(companyId: string, id: string) {
    const source = await this.prisma.strategicMap.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        perspectives: { where: { deletedAt: null } },
        objectives: {
          where: { deletedAt: null },
          include: {
            indicatorLinks: { where: { deletedAt: null } },
            orgNodeLinks: { where: { deletedAt: null } },
            outRelations: { where: { deletedAt: null } },
          },
        },
      },
    });
    if (!source) throw new NotFoundException('Mapa nao encontrado');

    return this.prisma.$transaction(async (tx) => {
      const newMap = await tx.strategicMap.create({
        data: {
          companyId,
          name: `${source.name} (cópia)`,
          description: source.description,
          startsAt: source.startsAt,
          endsAt: source.endsAt,
          active: true,
        },
      });

      // Perspectivas: mapeia id antigo -> novo
      const perspMap = new Map<string, string>();
      for (const p of source.perspectives) {
        const np = await tx.perspective.create({
          data: {
            mapId: newMap.id,
            kind: p.kind,
            name: p.name,
            description: p.description,
            color: p.color,
            icon: p.icon,
            position: p.position,
            positionX: p.positionX,
            positionY: p.positionY,
            width: p.width,
            height: p.height,
            active: p.active,
          },
        });
        perspMap.set(p.id, np.id);
      }

      // Objetivos: mapeia id antigo -> novo
      const objMap = new Map<string, string>();
      for (const o of source.objectives) {
        const newPerspectiveId = perspMap.get(o.perspectiveId);
        if (!newPerspectiveId) continue;
        const no = await tx.strategicObjective.create({
          data: {
            mapId: newMap.id,
            perspectiveId: newPerspectiveId,
            name: o.name,
            description: o.description,
            responsible: o.responsible,
            responsibleUserId: o.responsibleUserId,
            ownerNodeId: o.ownerNodeId,
            weight: o.weight,
            status: o.status,
            priority: o.priority,
            position: o.position,
            positionX: o.positionX,
            positionY: o.positionY,
            width: o.width,
            height: o.height,
            active: o.active,
          },
        });
        objMap.set(o.id, no.id);
      }

      // Vinculos e relacoes em lote (menos round-trips ao Neon -> evita timeout)
      const indicatorLinks: { objectiveId: string; indicatorId: string }[] = [];
      const orgNodeLinks: { objectiveId: string; orgNodeId: string; kind: string }[] = [];
      const relations: {
        fromId: string;
        toId: string;
        weight: number;
        kind: string;
        label: string | null;
        description: string | null;
        active: boolean;
      }[] = [];
      for (const o of source.objectives) {
        const newObjId = objMap.get(o.id);
        if (!newObjId) continue;
        for (const il of o.indicatorLinks) {
          indicatorLinks.push({ objectiveId: newObjId, indicatorId: il.indicatorId });
        }
        for (const ol of o.orgNodeLinks) {
          orgNodeLinks.push({ objectiveId: newObjId, orgNodeId: ol.orgNodeId, kind: ol.kind });
        }
        for (const rel of o.outRelations) {
          const from = objMap.get(rel.fromId);
          const to = objMap.get(rel.toId);
          if (from && to) {
            relations.push({
              fromId: from,
              toId: to,
              weight: rel.weight,
              kind: rel.kind,
              label: rel.label,
              description: rel.description,
              active: rel.active,
            });
          }
        }
      }
      if (indicatorLinks.length) await tx.strategicObjectiveIndicator.createMany({ data: indicatorLinks });
      if (orgNodeLinks.length) await tx.strategicObjectiveOrgNode.createMany({ data: orgNodeLinks });
      if (relations.length) await tx.objectiveRelation.createMany({ data: relations });

      return newMap;
    }, { timeout: 60000, maxWait: 20000 });
  }

  async createMap(me: AuthPayload, body: MapBody) {
    if (!body.name?.trim()) throw new BadRequestException('Nome do mapa e obrigatorio');
    const created = await this.prisma.strategicMap.create({
      data: {
        companyId: me.companyId,
        name: body.name.trim(),
        description: body.description ?? null,
        startsAt: body.startsAt ? new Date(body.startsAt) : new Date(new Date().getFullYear(), 0, 1),
        endsAt: body.endsAt ? new Date(body.endsAt) : new Date(new Date().getFullYear(), 11, 31),
        active: body.active ?? true,
        createdById: me.sub,
        updatedById: me.sub,
      },
    });
    await this.audit(me, 'CREATE', 'StrategicMap', created.id, null, created, created.name);
    return created;
  }

  async updateMap(me: AuthPayload, id: string, body: MapBody) {
    const before = await this.getMapRecord(me.companyId, id);
    const updated = await this.prisma.strategicMap.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        description: body.description,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
        active: body.active,
        updatedById: me.sub,
      },
    });
    await this.audit(me, 'UPDATE', 'StrategicMap', id, before, updated, updated.name);
    return updated;
  }

  async removeMap(me: AuthPayload, id: string) {
    const before = await this.getMapRecord(me.companyId, id);
    const updated = await this.prisma.strategicMap.update({
      where: { id },
      data: { active: false, deletedAt: new Date(), updatedById: me.sub },
    });
    await this.audit(me, 'DELETE', 'StrategicMap', id, before, updated, updated.name);
    return updated;
  }

  async addPerspective(me: AuthPayload, mapId: string, body: PerspectiveBody) {
    await this.getMapRecord(me.companyId, mapId);
    if (!body.name?.trim()) throw new BadRequestException('Nome da perspectiva e obrigatorio');
    await this.assertPerspectiveNameAvailable(mapId, body.name);
    const count = await this.prisma.perspective.count({ where: { mapId, deletedAt: null } });
    const created = await this.prisma.perspective.create({
      data: {
        mapId,
        kind: body.kind ?? PerspectiveKind.CUSTOM,
        name: body.name.trim(),
        description: body.description ?? null,
        color: body.color ?? null,
        icon: body.icon ?? null,
        active: body.active ?? true,
        position: body.position ?? count,
        positionX: body.positionX ?? 0,
        positionY: body.positionY ?? 0,
        width: body.width ?? 1320,
        height: body.height ?? 230,
        createdById: me.sub,
        updatedById: me.sub,
      },
    });
    await this.audit(me, 'CREATE', 'Perspective', created.id, null, created, created.name);
    return created;
  }

  async updatePerspective(me: AuthPayload, id: string, body: PerspectiveBody) {
    const before = await this.getPerspectiveRecord(me.companyId, id);
    if (body.name && body.name.trim() !== before.name) await this.assertPerspectiveNameAvailable(before.mapId, body.name, id);
    const updated = await this.prisma.perspective.update({
      where: { id },
      data: {
        kind: body.kind,
        name: body.name?.trim(),
        description: body.description,
        color: body.color,
        icon: body.icon,
        position: body.position,
        positionX: body.positionX,
        positionY: body.positionY,
        width: body.width,
        height: body.height,
        active: body.active,
        updatedById: me.sub,
      },
    });
    await this.audit(me, 'UPDATE', 'Perspective', id, before, updated, updated.name);
    return updated;
  }

  async removePerspective(me: AuthPayload, id: string) {
    const before = await this.getPerspectiveRecord(me.companyId, id);
    const activeObjectives = await this.prisma.strategicObjective.count({ where: { perspectiveId: id, deletedAt: null, active: true } });
    if (activeObjectives > 0) {
      throw new ConflictException('Perspectiva possui objetivos ativos. Mova ou inative os objetivos antes de excluir.');
    }
    const updated = await this.prisma.perspective.update({
      where: { id },
      data: { active: false, deletedAt: new Date(), updatedById: me.sub },
    });
    await this.audit(me, 'DELETE', 'Perspective', id, before, updated, updated.name);
    return updated;
  }

  async reorderPerspectives(me: AuthPayload, mapId: string, ids: string[]) {
    await this.getMapRecord(me.companyId, mapId);
    const existing = await this.prisma.perspective.findMany({ where: { mapId, id: { in: ids }, deletedAt: null }, select: { id: true } });
    if (existing.length !== ids.length) throw new BadRequestException('Lista de perspectivas inválida');
    await this.prisma.$transaction(ids.map((id, index) => this.prisma.perspective.update({ where: { id }, data: { position: index, updatedById: me.sub } })));
    await this.audit(me, 'REORDER', 'Perspective', mapId, null, { ids }, 'Reordenacao de perspectivas');
    return { ok: true };
  }

  async addObjective(me: AuthPayload, mapId: string, body: ObjectiveBody) {
    await this.getMapRecord(me.companyId, mapId);
    if (!body.perspectiveId) throw new BadRequestException('Perspectiva e obrigatoria');
    if (!body.name?.trim()) throw new BadRequestException('Nome do objetivo e obrigatorio');
    await this.assertPerspectiveInMap(mapId, body.perspectiveId);
    await this.assertUserInCompany(me.companyId, body.responsibleUserId);
    await this.assertOrgNodeInCompany(me.companyId, body.ownerNodeId);
    const count = await this.prisma.strategicObjective.count({ where: { mapId, perspectiveId: body.perspectiveId, deletedAt: null } });
    const created = await this.prisma.strategicObjective.create({
      data: {
        mapId,
        perspectiveId: body.perspectiveId,
        name: body.name.trim(),
        description: body.description ?? null,
        responsible: body.responsible ?? null,
        responsibleUserId: body.responsibleUserId ?? null,
        ownerNodeId: body.ownerNodeId ?? null,
        weight: body.weight ?? 1,
        priority: body.priority ?? 3,
        position: body.position ?? count,
        positionX: body.positionX ?? 0,
        positionY: body.positionY ?? 0,
        width: body.width ?? 260,
        height: body.height ?? 150,
        status: body.status ?? ObjectiveStatus.PLANNED,
        active: body.active ?? true,
        createdById: me.sub,
        updatedById: me.sub,
      },
    });
    if (body.indicatorIds?.length) await this.replaceObjectiveIndicators(me, created.id, body.indicatorIds, false);
    if (body.orgNodeIds?.length) await this.replaceObjectiveOrgNodes(me, created.id, body.orgNodeIds, false);
    const after = await this.getObjectiveRecord(me.companyId, created.id);
    await this.audit(me, 'CREATE', 'StrategicObjective', created.id, null, after, created.name);
    return after;
  }

  async updateObjective(me: AuthPayload, id: string, body: ObjectiveBody) {
    const before = await this.getObjectiveRecord(me.companyId, id);
    if (body.perspectiveId) await this.assertPerspectiveInMap(before.mapId, body.perspectiveId);
    await this.assertUserInCompany(me.companyId, body.responsibleUserId);
    await this.assertOrgNodeInCompany(me.companyId, body.ownerNodeId);
    const updated = await this.prisma.strategicObjective.update({
      where: { id },
      data: {
        perspectiveId: body.perspectiveId,
        name: body.name?.trim(),
        description: body.description,
        responsible: body.responsible,
        responsibleUserId: normalizeNullable(body.responsibleUserId),
        ownerNodeId: normalizeNullable(body.ownerNodeId),
        status: body.status,
        weight: body.weight,
        priority: body.priority,
        position: body.position,
        positionX: body.positionX,
        positionY: body.positionY,
        width: body.width,
        height: body.height,
        active: body.active,
        updatedById: me.sub,
      },
    });
    if (body.indicatorIds) await this.replaceObjectiveIndicators(me, id, body.indicatorIds, true);
    if (body.orgNodeIds) await this.replaceObjectiveOrgNodes(me, id, body.orgNodeIds, true);
    const after = await this.getObjectiveRecord(me.companyId, id);
    await this.audit(me, 'UPDATE', 'StrategicObjective', id, before, after, updated.name);
    return after;
  }

  async saveLayout(
    me: AuthPayload,
    mapId: string,
    nodes: Array<{
      id: string;
      perspectiveId?: string;
      position?: number;
      positionX: number;
      positionY: number;
      width?: number;
      height?: number;
    }>,
  ) {
    await this.getMapRecord(me.companyId, mapId);
    if (!nodes?.length) return { ok: true };
    const objectives = await this.prisma.strategicObjective.findMany({
      where: { mapId, id: { in: nodes.map((node) => node.id) }, deletedAt: null },
      select: { id: true, perspectiveId: true, positionX: true, positionY: true, position: true, width: true, height: true },
    });
    if (objectives.length !== nodes.length) throw new BadRequestException('Layout contem objetivos inválidos');
    const before = objectives;
    await this.prisma.$transaction(
      nodes.map((node) =>
        this.prisma.strategicObjective.update({
          where: { id: node.id },
          data: {
            perspectiveId: node.perspectiveId,
            position: node.position,
            positionX: node.positionX,
            positionY: node.positionY,
            ...(node.width !== undefined ? { width: node.width } : {}),
            ...(node.height !== undefined ? { height: node.height } : {}),
            updatedById: me.sub,
          },
        }),
      ),
    );
    await this.audit(me, 'LAYOUT_UPDATE', 'StrategicObjective', mapId, before, nodes, 'Layout do mapa estratégico');
    return { ok: true };
  }

  async removeObjective(me: AuthPayload, id: string) {
    const before = await this.getObjectiveRecord(me.companyId, id);
    const updated = await this.prisma.strategicObjective.update({
      where: { id },
      data: { active: false, status: ObjectiveStatus.CANCELLED, deletedAt: new Date(), updatedById: me.sub },
    });
    await this.audit(me, 'DELETE', 'StrategicObjective', id, before, updated, updated.name);
    return updated;
  }

  async addRelation(me: AuthPayload, body: RelationBody) {
    if (!body.fromId || !body.toId) throw new BadRequestException('Objetivos origem e destino sao obrigatorios');
    if (body.fromId === body.toId) throw new BadRequestException('Objetivo origem e destino devem ser diferentes');
    const [from, to] = await Promise.all([
      this.getObjectiveRecord(me.companyId, body.fromId),
      this.getObjectiveRecord(me.companyId, body.toId),
    ]);
    if (from.mapId !== to.mapId) throw new BadRequestException('Objetivos devem pertencer ao mesmo mapa');
    const relation = await this.prisma.objectiveRelation.upsert({
      where: { fromId_toId: { fromId: body.fromId, toId: body.toId } },
      create: {
        fromId: body.fromId,
        toId: body.toId,
        weight: body.weight ?? 1,
        kind: body.kind ?? 'impacta',
        label: body.label ?? null,
        description: body.description ?? null,
      },
      update: {
        weight: body.weight ?? 1,
        kind: body.kind ?? 'impacta',
        label: body.label ?? null,
        description: body.description ?? null,
        active: true,
        deletedAt: null,
      },
    });
    await this.audit(me, 'LINK_CREATED', 'ObjectiveRelation', relation.id, null, relation, relation.label ?? `${from.name} -> ${to.name}`);
    return relation;
  }

  async updateRelation(me: AuthPayload, id: string, body: RelationBody) {
    const before = await this.getRelationRecord(me.companyId, id);
    const updated = await this.prisma.objectiveRelation.update({
      where: { id },
      data: {
        weight: body.weight,
        kind: body.kind,
        label: body.label,
        description: body.description,
        active: body.active,
      },
    });
    await this.audit(me, 'UPDATE', 'ObjectiveRelation', id, before, updated, updated.label ?? 'Ligacao estratégica');
    return updated;
  }

  async removeRelation(me: AuthPayload, id: string) {
    const before = await this.getRelationRecord(me.companyId, id);
    const updated = await this.prisma.objectiveRelation.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
    await this.audit(me, 'LINK_REMOVED', 'ObjectiveRelation', id, before, updated, before.label ?? 'Ligacao estratégica');
    return updated;
  }

  async attachIndicator(me: AuthPayload, objectiveId: string, indicatorId: string) {
    await this.getObjectiveRecord(me.companyId, objectiveId);
    await this.assertIndicatorInCompany(me.companyId, indicatorId);
    const link = await this.prisma.strategicObjectiveIndicator.upsert({
      where: { objectiveId_indicatorId: { objectiveId, indicatorId } },
      create: { objectiveId, indicatorId, createdById: me.sub },
      update: { deletedAt: null },
    });
    await this.prisma.indicator.update({ where: { id: indicatorId }, data: { strategicObjectiveId: objectiveId } });
    await this.audit(me, 'INDICATOR_LINKED', 'StrategicObjectiveIndicator', link.id, null, link, 'Vínculo objetivo-indicador');
    return link;
  }

  async detachIndicator(me: AuthPayload, objectiveId: string, indicatorId: string) {
    await this.getObjectiveRecord(me.companyId, objectiveId);
    await this.assertIndicatorInCompany(me.companyId, indicatorId);
    const before = await this.prisma.strategicObjectiveIndicator.findUnique({
      where: { objectiveId_indicatorId: { objectiveId, indicatorId } },
    });
    if (!before) return { ok: true };
    const updated = await this.prisma.strategicObjectiveIndicator.update({
      where: { objectiveId_indicatorId: { objectiveId, indicatorId } },
      data: { deletedAt: new Date() },
    });
    const indicator = await this.prisma.indicator.findUnique({ where: { id: indicatorId }, select: { strategicObjectiveId: true } });
    if (indicator?.strategicObjectiveId === objectiveId) {
      await this.prisma.indicator.update({ where: { id: indicatorId }, data: { strategicObjectiveId: null } });
    }
    await this.audit(me, 'INDICATOR_UNLINKED', 'StrategicObjectiveIndicator', updated.id, before, updated, 'Remocao de indicador');
    return updated;
  }

  async detachIndicatorLegacy(me: AuthPayload, indicatorId: string) {
    await this.assertIndicatorInCompany(me.companyId, indicatorId);
    const before = await this.prisma.indicator.findUnique({ where: { id: indicatorId } });
    await this.prisma.strategicObjectiveIndicator.updateMany({
      where: { indicatorId, objective: { map: { companyId: me.companyId } }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    const updated = await this.prisma.indicator.update({ where: { id: indicatorId }, data: { strategicObjectiveId: null } });
    await this.audit(me, 'INDICATOR_UNLINKED', 'Indicator', indicatorId, before, updated, updated.name);
    return updated;
  }

  async attachOrgNode(me: AuthPayload, objectiveId: string, orgNodeId: string, kind = 'responsável') {
    await this.getObjectiveRecord(me.companyId, objectiveId);
    await this.assertOrgNodeInCompany(me.companyId, orgNodeId);
    const link = await this.prisma.strategicObjectiveOrgNode.upsert({
      where: { objectiveId_orgNodeId_kind: { objectiveId, orgNodeId, kind } },
      create: { objectiveId, orgNodeId, kind, createdById: me.sub },
      update: { deletedAt: null },
    });
    await this.audit(me, 'ORG_LINKED', 'StrategicObjectiveOrgNode', link.id, null, link, 'Vínculo objetivo-estrutura');
    return link;
  }

  async detachOrgNode(me: AuthPayload, objectiveId: string, orgNodeId: string, kind = 'responsável') {
    await this.getObjectiveRecord(me.companyId, objectiveId);
    const before = await this.prisma.strategicObjectiveOrgNode.findUnique({ where: { objectiveId_orgNodeId_kind: { objectiveId, orgNodeId, kind } } });
    if (!before) return { ok: true };
    const updated = await this.prisma.strategicObjectiveOrgNode.update({
      where: { objectiveId_orgNodeId_kind: { objectiveId, orgNodeId, kind } },
      data: { deletedAt: new Date() },
    });
    await this.audit(me, 'ORG_UNLINKED', 'StrategicObjectiveOrgNode', updated.id, before, updated, 'Remocao de estrutura');
    return updated;
  }

  async listVersions(me: AuthPayload, mapId: string) {
    await this.getMapRecord(me.companyId, mapId);
    return this.prisma.strategicMapVersion.findMany({
      where: { mapId },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { version: 'desc' },
    });
  }

  async createVersion(me: AuthPayload, mapId: string, body: { title?: string; description?: string; publish?: boolean }) {
    const map = await this.getMap(me.companyId, mapId);
    const last = await this.prisma.strategicMapVersion.findFirst({ where: { mapId }, orderBy: { version: 'desc' }, select: { version: true } });
    const version = (last?.version ?? 0) + 1;
    const created = await this.prisma.strategicMapVersion.create({
      data: {
        mapId,
        version,
        title: body.title?.trim() || `Versão ${version}`,
        description: body.description ?? null,
        status: body.publish ? 'PUBLISHED' : 'DRAFT',
        snapshot: JSON.parse(stringify(map) ?? '{}') as Prisma.InputJsonValue,
        createdById: me.sub,
        publishedAt: body.publish ? new Date() : null,
      },
    });
    if (body.publish) {
      await this.prisma.strategicMap.update({
        where: { id: mapId },
        data: { publishedVersionId: created.id, updatedById: me.sub },
      });
    }
    await this.audit(me, body.publish ? 'PUBLISH' : 'VERSION_CREATE', 'StrategicMapVersion', created.id, null, created, created.title);
    return created;
  }

  private async replaceObjectiveIndicators(me: AuthPayload, objectiveId: string, indicatorIds: string[], audit = true) {
    const objective = await this.getObjectiveRecord(me.companyId, objectiveId);
    const indicators = await this.prisma.indicator.findMany({
      where: { companyId: me.companyId, id: { in: indicatorIds }, deletedAt: null },
      select: { id: true },
    });
    if (indicators.length !== uniqueIds(indicatorIds).length) throw new BadRequestException('Lista de indicadores inválida');
    const before = await this.prisma.strategicObjectiveIndicator.findMany({ where: { objectiveId, deletedAt: null } });
    const ids = uniqueIds(indicatorIds);
    await this.prisma.$transaction([
      this.prisma.strategicObjectiveIndicator.updateMany({
        where: { objectiveId, indicatorId: { notIn: ids }, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      ...ids.map((indicatorId) =>
        this.prisma.strategicObjectiveIndicator.upsert({
          where: { objectiveId_indicatorId: { objectiveId, indicatorId } },
          create: { objectiveId, indicatorId, createdById: me.sub },
          update: { deletedAt: null },
        }),
      ),
      ...ids.map((indicatorId) =>
        this.prisma.indicator.update({ where: { id: indicatorId }, data: { strategicObjectiveId: objectiveId } }),
      ),
    ]);
    if (audit) await this.audit(me, 'INDICATOR_LINKED', 'StrategicObjective', objectiveId, before, { indicatorIds: ids }, objective.name);
  }

  private async replaceObjectiveOrgNodes(me: AuthPayload, objectiveId: string, orgNodeIds: string[], audit = true) {
    const objective = await this.getObjectiveRecord(me.companyId, objectiveId);
    const nodes = await this.prisma.orgNode.findMany({
      where: { companyId: me.companyId, id: { in: orgNodeIds }, deletedAt: null },
      select: { id: true },
    });
    if (nodes.length !== uniqueIds(orgNodeIds).length) throw new BadRequestException('Lista de areas/setores inválida');
    const before = await this.prisma.strategicObjectiveOrgNode.findMany({ where: { objectiveId, deletedAt: null } });
    const ids = uniqueIds(orgNodeIds);
    await this.prisma.$transaction([
      this.prisma.strategicObjectiveOrgNode.updateMany({
        where: { objectiveId, orgNodeId: { notIn: ids }, kind: 'responsável', deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      ...ids.map((orgNodeId) =>
        this.prisma.strategicObjectiveOrgNode.upsert({
          where: { objectiveId_orgNodeId_kind: { objectiveId, orgNodeId, kind: 'responsável' } },
          create: { objectiveId, orgNodeId, kind: 'responsável', createdById: me.sub },
          update: { deletedAt: null },
        }),
      ),
    ]);
    if (audit) await this.audit(me, 'ORG_LINKED', 'StrategicObjective', objectiveId, before, { orgNodeIds: ids }, objective.name);
  }

  private async getMapRecord(companyId: string, id: string) {
    const map = await this.prisma.strategicMap.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!map) throw new NotFoundException('Mapa nao encontrado');
    return map;
  }

  private async getPerspectiveRecord(companyId: string, id: string) {
    const perspective = await this.prisma.perspective.findFirst({ where: { id, map: { companyId, deletedAt: null }, deletedAt: null } });
    if (!perspective) throw new NotFoundException('Perspectiva nao encontrada');
    return perspective;
  }

  private async getObjectiveRecord(companyId: string, id: string) {
    const objective = await this.prisma.strategicObjective.findFirst({
      where: { id, map: { companyId, deletedAt: null }, deletedAt: null },
      include: {
        perspective: true,
        indicatorLinks: { where: { deletedAt: null }, select: { indicatorId: true } },
        orgNodeLinks: { where: { deletedAt: null }, select: { orgNodeId: true, kind: true } },
      },
    });
    if (!objective) throw new NotFoundException('Objetivo estratégico nao encontrado');
    return objective;
  }

  private async getRelationRecord(companyId: string, id: string) {
    const relation = await this.prisma.objectiveRelation.findFirst({
      where: { id, from: { map: { companyId, deletedAt: null } }, deletedAt: null },
      include: { from: { select: { id: true, name: true, mapId: true } }, to: { select: { id: true, name: true, mapId: true } } },
    });
    if (!relation) throw new NotFoundException('Ligacao estratégica nao encontrada');
    return relation;
  }

  private async assertPerspectiveInMap(mapId: string, perspectiveId: string) {
    const exists = await this.prisma.perspective.count({ where: { id: perspectiveId, mapId, deletedAt: null, active: true } });
    if (!exists) throw new NotFoundException('Perspectiva nao encontrada para este mapa');
  }

  private async assertPerspectiveNameAvailable(mapId: string, name: string, ignoreId?: string) {
    const exists = await this.prisma.perspective.findFirst({
      where: { mapId, deletedAt: null, id: ignoreId ? { not: ignoreId } : undefined, name: { equals: name.trim(), mode: 'insensitive' } },
      select: { id: true },
    });
    if (exists) throw new ConflictException('Já existe perspectiva com este nome no mapa');
  }

  private async assertIndicatorInCompany(companyId: string, id?: string | null) {
    if (!id) return;
    const exists = await this.prisma.indicator.count({ where: { id, companyId, deletedAt: null } });
    if (!exists) throw new NotFoundException('Indicador nao encontrado para esta empresa');
  }

  private async assertOrgNodeInCompany(companyId: string, id?: string | null) {
    if (!id) return;
    const exists = await this.prisma.orgNode.count({ where: { id, companyId, deletedAt: null } });
    if (!exists) throw new NotFoundException('Area, setor ou processo nao encontrado para esta empresa');
  }

  private async assertUserInCompany(companyId: string, id?: string | null) {
    if (!id) return;
    const exists = await this.prisma.user.count({ where: { id, companyId, deletedAt: null } });
    if (!exists) throw new NotFoundException('Responsável nao encontrado para esta empresa');
  }

  async getOrganograma(companyId: string) {
    let jobs = await this.prisma.orgJob.findMany({
      where: { companyId, active: true },
      orderBy: { name: 'asc' },
    });

    if (jobs.length === 0) {
      const createdJobs = await Promise.all([
        this.prisma.orgJob.create({ data: { companyId, name: 'Gestor de Pessoas', description: 'Liderança de Recursos Humanos' } }),
        this.prisma.orgJob.create({ data: { companyId, name: 'Gestor Administrativo Pl', description: 'Remuneração e orçamentos' } }),
        this.prisma.orgJob.create({ data: { companyId, name: 'Gestor Administrativo Jr', description: 'Suporte operacional do setor' } }),
        this.prisma.orgJob.create({ data: { companyId, name: 'Coordenador Adm Sr', description: 'Coordenação e planejamento administrativo' } }),
        this.prisma.orgJob.create({ data: { companyId, name: 'Analista Sr', description: 'Análise de cargos, salários e planos' } }),
      ]);

      const [gPessoas, gAdmPl, gAdmJr, coordSr, analistaSr] = createdJobs;
      const firstNode = await this.prisma.orgNode.findFirst({ where: { companyId, active: true } });
      const nodeId = firstNode?.id ?? null;

      await Promise.all([
        this.prisma.orgEmployee.create({ data: { companyId, orgNodeId: nodeId, name: 'Victor Rafael de Assis Claudino', jobId: gPessoas.id, registrationId: '945870', band: 'A', shift: 'D', isBudgeted: true } }),
        this.prisma.orgEmployee.create({ data: { companyId, orgNodeId: nodeId, name: 'Marcos Dias Moreira Junior', jobId: gAdmPl.id, registrationId: '943914', band: 'B', shift: 'D', isBudgeted: true } }),
        this.prisma.orgEmployee.create({ data: { companyId, orgNodeId: nodeId, name: 'Jailson Moreira Pimentel', jobId: gAdmJr.id, registrationId: '945951', band: 'A', shift: 'A', isBudgeted: true } }),
        this.prisma.orgEmployee.create({ data: { companyId, orgNodeId: nodeId, name: 'Ana Paula Rodrigues', jobId: coordSr.id, registrationId: '926331', band: 'C', shift: 'D', isBudgeted: true } }),
        this.prisma.orgEmployee.create({ data: { companyId, orgNodeId: nodeId, name: 'Aline Jeronimo de Lima', jobId: coordSr.id, registrationId: '947296', band: 'B', shift: 'D', isBudgeted: true } }),
        this.prisma.orgEmployee.create({ data: { companyId, orgNodeId: nodeId, name: 'Debora Duarte Ferreira Naves', jobId: analistaSr.id, registrationId: '943395', band: 'B', shift: 'D', isBudgeted: true } }),
        this.prisma.orgEmployee.create({ data: { companyId, orgNodeId: nodeId, name: 'Vaga - Segurança Patrimonial', jobId: gAdmJr.id, registrationId: null, band: 'B', shift: 'B', isBudgeted: false, status: 'VACANT' } }),
      ]);

      await Promise.all([
        this.prisma.orgJobCareerPath.create({ data: { companyId, fromJobId: gAdmJr.id, toJobId: gAdmPl.id } }),
        this.prisma.orgJobCareerPath.create({ data: { companyId, fromJobId: gAdmPl.id, toJobId: gPessoas.id } }),
        this.prisma.orgJobCareerPath.create({ data: { companyId, fromJobId: analistaSr.id, toJobId: coordSr.id } }),
      ]);

      jobs = await this.prisma.orgJob.findMany({
        where: { companyId, active: true },
        orderBy: { name: 'asc' },
      });
    }

    const [employees, careerPaths] = await Promise.all([
      this.prisma.orgEmployee.findMany({
        where: { companyId },
        include: {
          job: true,
          jobPretended: true,
          orgNode: true,
          approvalRequests: {
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              approver: { select: { id: true, name: true, email: true } },
              requester: { select: { id: true, name: true, email: true } },
              currentJob: { select: { id: true, name: true } },
              targetJob: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.orgJobCareerPath.findMany({
        where: { companyId },
        include: { fromJob: true, toJob: true },
      }),
    ]);

    return { jobs, employees, careerPaths };
  }

  async createJob(me: AuthPayload, body: { name: string; description?: string }) {
    return this.prisma.orgJob.create({
      data: {
        companyId: me.companyId,
        name: body.name,
        description: body.description ?? null,
      },
    });
  }

  async updateJob(me: AuthPayload, id: string, body: { name?: string; description?: string }) {
    return this.prisma.orgJob.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
      },
    });
  }

  async removeJob(me: AuthPayload, id: string) {
    return this.prisma.orgJob.update({
      where: { id },
      data: { active: false },
    });
  }

  async createEmployee(me: AuthPayload, body: {
    name: string;
    jobId: string;
    jobPretendedId?: string | null;
    orgNodeId?: string;
    orgNodeName?: string;
    registrationId?: string;
    band?: string;
    bandPretended?: string;
    shift?: string;
    isBudgeted?: boolean;
    status?: string;
    approvalStatus?: string;
  }) {
    let finalOrgNodeId = body.orgNodeId || null;

    if (!finalOrgNodeId && body.orgNodeName?.trim()) {
      const existing = await this.prisma.orgNode.findFirst({
        where: {
          companyId: me.companyId,
          name: { equals: body.orgNodeName.trim(), mode: 'insensitive' },
          deletedAt: null,
        },
      });
      if (existing) {
        finalOrgNodeId = existing.id;
      } else {
        const created = await this.prisma.orgNode.create({
          data: {
            companyId: me.companyId,
            name: body.orgNodeName.trim(),
            type: 'AREA',
            active: true,
          },
        });
        finalOrgNodeId = created.id;
      }
    }

    return this.prisma.orgEmployee.create({
      data: {
        companyId: me.companyId,
        name: body.name,
        jobId: body.jobId,
        jobPretendedId: body.jobPretendedId || null,
        orgNodeId: finalOrgNodeId,
        registrationId: body.registrationId || null,
        band: body.band || 'B',
        bandPretended: body.bandPretended || body.band || 'B',
        shift: body.shift || 'D',
        isBudgeted: body.isBudgeted ?? true,
        status: body.status || 'ACTIVE',
        approvalStatus: body.approvalStatus || 'PENDENTE',
      },
    });
  }

  async updateEmployee(me: AuthPayload, id: string, body: {
    name?: string;
    jobId?: string;
    jobPretendedId?: string | null;
    orgNodeId?: string;
    registrationId?: string;
    band?: string;
    bandPretended?: string;
    shift?: string;
    isBudgeted?: boolean;
    status?: string;
    approvalStatus?: string;
  }) {
    return this.prisma.orgEmployee.update({
      where: { id },
      data: {
        name: body.name,
        jobId: body.jobId,
        jobPretendedId: body.jobPretendedId === undefined ? undefined : (body.jobPretendedId || null),
        orgNodeId: body.orgNodeId === undefined ? undefined : (body.orgNodeId || null),
        registrationId: body.registrationId,
        band: body.band,
        bandPretended: body.bandPretended,
        shift: body.shift,
        isBudgeted: body.isBudgeted,
        status: body.status,
        approvalStatus: body.approvalStatus,
      },
    });
  }

  async removeEmployee(me: AuthPayload, id: string) {
    return this.prisma.orgEmployee.delete({
      where: { id },
    });
  }

  async createCareerPath(me: AuthPayload, body: { fromJobId: string; toJobId: string; sourceHandle?: string; targetHandle?: string }) {
    return this.prisma.orgJobCareerPath.upsert({
      where: { fromJobId_toJobId: { fromJobId: body.fromJobId, toJobId: body.toJobId } },
      create: {
        companyId: me.companyId,
        fromJobId: body.fromJobId,
        toJobId: body.toJobId,
        sourceHandle: body.sourceHandle || 'right',
        targetHandle: body.targetHandle || 'left',
      },
      update: {
        sourceHandle: body.sourceHandle,
        targetHandle: body.targetHandle,
      },
    });
  }

  async removeCareerPath(me: AuthPayload, id: string) {
    return this.prisma.orgJobCareerPath.delete({
      where: { id },
    });
  }

  // ============================================================
  // Aprovacoes de cargo (career approvals)
  // ============================================================

  async listApprovers(me: AuthPayload) {
    return this.prisma.user.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        active: true,
        role: { in: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'DIRECTOR', 'MANAGER'] },
      },
      select: { id: true, name: true, email: true, role: true, jobTitle: true },
      orderBy: { name: 'asc' },
    });
  }

  async listCareerApprovals(me: AuthPayload, filter?: { status?: string; scope?: 'mine' | 'requested' | 'all' }) {
    const scope = filter?.scope ?? 'mine';
    const where: any = { companyId: me.companyId };
    if (filter?.status) where.status = filter.status;
    if (scope === 'mine') where.approverId = me.sub;
    else if (scope === 'requested') where.requesterId = me.sub;
    return this.prisma.orgJobApprovalRequest.findMany({
      where,
      include: {
        employee: { include: { orgNode: true } },
        requester: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } },
        currentJob: { select: { id: true, name: true } },
        targetJob: { select: { id: true, name: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getCareerApproval(me: AuthPayload, id: string) {
    const request = await this.prisma.orgJobApprovalRequest.findFirst({
      where: { id, companyId: me.companyId },
      include: {
        employee: { include: { orgNode: true, job: true, jobPretended: true } },
        requester: { select: { id: true, name: true, email: true, jobTitle: true } },
        approver: { select: { id: true, name: true, email: true, jobTitle: true, role: true } },
        currentJob: { select: { id: true, name: true } },
        targetJob: { select: { id: true, name: true } },
        company: { select: { id: true, name: true, tradeName: true, cnpj: true } },
      },
    });
    if (!request) throw new NotFoundException('Solicitação de aprovação não encontrada');
    return request;
  }

  async createCareerApproval(me: AuthPayload, body: {
    employeeId: string;
    approverId: string;
    targetJobId?: string;
    targetBand?: string;
    reason?: string;
  }) {
    const employee = await this.prisma.orgEmployee.findFirst({
      where: { id: body.employeeId, companyId: me.companyId },
      include: { job: true, jobPretended: true },
    });
    if (!employee) throw new NotFoundException('Colaborador nao encontrado');
    const approver = await this.prisma.user.findFirst({
      where: { id: body.approverId, companyId: me.companyId, deletedAt: null, role: { in: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'DIRECTOR', 'MANAGER'] } },
      select: { id: true },
    });
    if (!approver) throw new NotFoundException('Aprovador invalido (precisa ser ADMIN/MANAGER)');

    const existingPending = await this.prisma.orgJobApprovalRequest.findFirst({
      where: { employeeId: body.employeeId, status: 'PENDING' },
    });
    if (existingPending) throw new ConflictException('Ja existe uma solicitacao pendente para este colaborador');

    const targetJobId = body.targetJobId ?? employee.jobPretendedId ?? employee.jobId;
    const targetBand = body.targetBand ?? employee.bandPretended ?? employee.band;

    const request = await this.prisma.orgJobApprovalRequest.create({
      data: {
        companyId: me.companyId,
        employeeId: body.employeeId,
        requesterId: me.sub,
        approverId: body.approverId,
        currentJobId: employee.jobId,
        currentBand: employee.band,
        targetJobId,
        targetBand,
        status: 'PENDING',
        reason: body.reason ?? null,
      },
    });

    await this.prisma.orgEmployee.update({
      where: { id: body.employeeId },
      data: { approvalStatus: 'EM_ANALISE' },
    });

    await this.audit(me, 'CAREER_APPROVAL_CREATED', 'OrgJobApprovalRequest', request.id, null, request, employee.name);
    return request;
  }

  async decideCareerApproval(me: AuthPayload, id: string, body: { decision: 'APPROVED' | 'REJECTED'; decisionNote?: string }) {
    const request = await this.prisma.orgJobApprovalRequest.findFirst({
      where: { id, companyId: me.companyId },
      include: { employee: true },
    });
    if (!request) throw new NotFoundException('Solicitacao nao encontrada');
    if (request.approverId !== me.sub) throw new ConflictException('Apenas o aprovador designado pode decidir esta solicitacao');
    if (request.status !== 'PENDING') throw new ConflictException('Esta solicitacao ja foi decidida');

    const updated = await this.prisma.orgJobApprovalRequest.update({
      where: { id },
      data: {
        status: body.decision,
        decisionNote: body.decisionNote ?? null,
        decidedAt: new Date(),
      },
    });

    if (body.decision === 'APPROVED') {
      await this.prisma.orgEmployee.update({
        where: { id: request.employeeId },
        data: {
          jobId: request.targetJobId,
          band: request.targetBand,
          jobPretendedId: null,
          bandPretended: request.targetBand,
          approvalStatus: 'APROVADO',
        },
      });
    } else {
      await this.prisma.orgEmployee.update({
        where: { id: request.employeeId },
        data: { approvalStatus: 'REPROVADO' },
      });
    }

    await this.audit(me, 'CAREER_APPROVAL_DECIDED', 'OrgJobApprovalRequest', id, request, updated, request.employee.name);
    return updated;
  }

  async cancelCareerApproval(me: AuthPayload, id: string) {
    const request = await this.prisma.orgJobApprovalRequest.findFirst({
      where: { id, companyId: me.companyId },
    });
    if (!request) throw new NotFoundException('Solicitacao nao encontrada');
    if (request.requesterId !== me.sub) throw new ConflictException('Apenas o solicitante pode cancelar');
    if (request.status !== 'PENDING') throw new ConflictException('Apenas solicitacoes pendentes podem ser canceladas');

    const updated = await this.prisma.orgJobApprovalRequest.update({
      where: { id },
      data: { status: 'CANCELLED', decidedAt: new Date() },
    });
    await this.prisma.orgEmployee.update({
      where: { id: request.employeeId },
      data: { approvalStatus: 'PENDENTE' },
    });
    return updated;
  }

  private async audit(me: AuthPayload, action: string, entity: string, entityId: string, beforeValue: unknown, afterValue: unknown, recordLabel?: string | null) {
    await this.prisma.auditLog.create({
      data: {
        companyId: me.companyId,
        userId: me.sub,
        action,
        module: STRATEGY_MODULE,
        entity,
        entityId,
        recordLabel: recordLabel ?? null,
        beforeValue: stringify(beforeValue),
        afterValue: stringify(afterValue),
        payload: stringify({ source: 'strategy-service' }),
        result: 'SUCCESS',
      },
    });
  }
}

function indicatorSelect(periodRef?: string) {
  const resultSelect = { light: true, attainment: true, value: true, periodRef: true };
  return {
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      ownerNodeId: true,
      ownerNode: { select: { id: true, name: true, type: true } },
      responsibleUser: { select: { id: true, name: true } },
      // Com periodRef, faroi/atingimento sao calculados "como estavam" naquele periodo;
      // sem periodRef, usa-se o resultado mais recente.
      results: periodRef
        ? { where: { periodRef }, orderBy: { periodDate: 'desc' as const }, take: 1, select: resultSelect }
        : { orderBy: { periodDate: 'desc' as const }, take: 12, select: resultSelect },
      targets: { orderBy: { periodRef: 'desc' as const }, take: 12, select: { target: true, periodRef: true } },
    },
  };
}

function uniqueIndicators(obj: { indicators?: any[]; indicatorLinks?: Array<{ indicator: any }> }) {
  const map = new Map<string, any>();
  for (const indicator of obj.indicators ?? []) map.set(indicator.id, indicator);
  for (const link of obj.indicatorLinks ?? []) map.set(link.indicator.id, link.indicator);
  return Array.from(map.values());
}

function aggregateTrafficLight(lights: TrafficLight[]) {
  if (lights.length === 0) return TrafficLight.GRAY;
  if (lights.some((light) => light === TrafficLight.RED)) return TrafficLight.RED;
  if (lights.some((light) => light === TrafficLight.YELLOW)) return TrafficLight.YELLOW;
  return TrafficLight.GREEN;
}

const LIGHT_ORDER: Record<TrafficLight, number> = {
  GRAY: 0,
  GREEN: 1,
  YELLOW: 2,
  RED: 3,
};

function worstLight(a: TrafficLight, b: TrafficLight): TrafficLight {
  return LIGHT_ORDER[a] >= LIGHT_ORDER[b] ? a : b;
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)));
}

function normalizeNullable(value: string | null | undefined) {
  if (value === undefined) return undefined;
  return value || null;
}

function stringify(value: unknown) {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}
