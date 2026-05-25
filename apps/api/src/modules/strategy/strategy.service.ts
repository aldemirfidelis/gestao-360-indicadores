import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ObjectiveStatus, PerspectiveKind, Prisma, TrafficLight } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';

const STRATEGY_MODULE = 'Mapa Estratégico';

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

  async getMap(companyId: string, id: string) {
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
              include: { indicator: indicatorSelect() },
            },
            indicators: indicatorSelect(),
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
    const [actionCounts, treatmentCounts, deviationCounts] = await Promise.all([
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
    ]);
    const actionsByIndicator = new Map(actionCounts.map((row) => [row.indicatorId, row._count._all]));
    const treatmentsByIndicator = new Map(treatmentCounts.map((row) => [row.indicatorId, row._count._all]));
    const deviationsByIndicator = new Map(deviationCounts.map((row) => [row.indicatorId, row._count._all]));

    const baseLights = new Map<string, TrafficLight>();
    const baseAttainments = new Map<string, number | null>();
    const enrichedObjectives = map.objectives.map((obj) => {
      const indicators = uniqueIndicators(obj);
      const lights = indicators.map((i) => i.results[0]?.light).filter((l): l is TrafficLight => !!l);
      const attainments = indicators.map((i) => i.results[0]?.attainment).filter((v): v is number => v !== null && v !== undefined);
      const avg = attainments.length > 0 ? attainments.reduce((a, b) => a + b, 0) / attainments.length : null;
      const baseLight = aggregateTrafficLight(lights);
      baseLights.set(obj.id, baseLight);
      baseAttainments.set(obj.id, avg);
      return {
        ...obj,
        indicators,
        indicatorLinks: undefined,
        baseLight,
        aggregateAttainment: avg,
        actionCount: indicators.reduce((sum, indicator) => sum + (actionsByIndicator.get(indicator.id) ?? 0), 0),
        treatmentCount: indicators.reduce((sum, indicator) => sum + (treatmentsByIndicator.get(indicator.id) ?? 0), 0),
        deviationCount: indicators.reduce((sum, indicator) => sum + (deviationsByIndicator.get(indicator.id) ?? 0), 0),
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

function indicatorSelect() {
  return {
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      ownerNodeId: true,
      ownerNode: { select: { id: true, name: true, type: true } },
      responsibleUser: { select: { id: true, name: true } },
      results: { orderBy: { periodDate: 'desc' as const }, take: 1, select: { light: true, attainment: true, value: true, periodRef: true } },
      targets: { orderBy: { periodRef: 'desc' as const }, take: 1, select: { target: true, periodRef: true } },
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
