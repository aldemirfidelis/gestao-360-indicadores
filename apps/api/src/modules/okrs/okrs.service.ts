import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Direction, IndicatorUnit, ObjectiveStatus } from '@prisma/client';
import { AuthPayload } from '../auth/auth.types';

interface KRComputed {
  id: string;
  metric: string;
  unit: IndicatorUnit;
  startValue: number;
  currentValue: number;
  targetValue: number;
  direction: Direction;
  weight: number;
  progress: number; // 0..1
}

@Injectable()
export class OkrsService {
  constructor(private readonly prisma: PrismaService) {}

  private strategicObjectiveSelect() {
    return {
      id: true,
      name: true,
      status: true,
      ownerNode: { select: { id: true, name: true, type: true } },
      perspective: { select: { id: true, name: true } },
      map: { select: { id: true, name: true } },
      indicatorLinks: {
        where: { deletedAt: null },
        select: {
          indicator: {
            select: {
              id: true,
              name: true,
              code: true,
              ownerNode: { select: { id: true, name: true, type: true } },
              results: {
                orderBy: { periodDate: 'desc' as const },
                take: 1,
                select: { light: true, attainment: true, periodRef: true, value: true },
              },
            },
          },
        },
      },
    };
  }

  /** Include padrao do objetivo OKR (com area, dono, KRs+indicador e check-ins). */
  private objectiveInclude() {
    return {
      keyResults: {
        include: {
          indicator: {
            select: {
              id: true,
              name: true,
              code: true,
              unit: true,
              results: {
                orderBy: { periodDate: 'desc' as const },
                take: 1,
                select: { value: true, periodRef: true, periodDate: true },
              },
            },
          },
        },
      },
      ownerNode: { select: { id: true, name: true, type: true } },
      ownerUser: { select: { id: true, name: true, email: true, avatarUrl: true, jobTitle: true } },
      strategicObj: { select: this.strategicObjectiveSelect() },
      actionPlans: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: 'desc' as const }],
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          origin: true,
          dueDate: true,
          progress: true,
          expectedResult: true,
          responsibleUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
          ownerNode: { select: { id: true, name: true, type: true } },
          tasks: { select: { id: true, done: true } },
        },
      },
      checkins: {
        orderBy: { createdAt: 'asc' as const },
        select: { weekRef: true, progress: true, confidence: true, createdAt: true, note: true },
      },
      _count: { select: { checkins: true } },
    };
  }

  async listCycles(companyId: string) {
    return this.prisma.oKRCycle.findMany({
      where: { companyId, active: true },
      orderBy: { startsAt: 'desc' },
      include: {
        _count: { select: { objectives: true } },
      },
    });
  }

  async createCycle(companyId: string, name: string, startsAt: Date, endsAt: Date) {
    return this.prisma.oKRCycle.create({
      data: { companyId, name, startsAt, endsAt },
    });
  }

  async updateCycle(companyId: string, cycleId: string, body: { name?: string; startsAt?: string; endsAt?: string; active?: boolean }) {
    await this.assertCycle(companyId, cycleId);
    const data: Record<string, any> = {};
    if ('name' in body) data.name = body.name;
    if ('startsAt' in body && body.startsAt) data.startsAt = new Date(body.startsAt);
    if ('endsAt' in body && body.endsAt) data.endsAt = new Date(body.endsAt);
    if ('active' in body) data.active = Boolean(body.active);
    return this.prisma.oKRCycle.update({ where: { id: cycleId }, data });
  }

  async removeCycle(companyId: string, cycleId: string) {
    await this.assertCycle(companyId, cycleId);
    return this.prisma.oKRCycle.update({ where: { id: cycleId }, data: { active: false } });
  }

  async options(companyId: string) {
    const [strategic, areas, users, indicators] = await Promise.all([
      this.prisma.strategicObjective.findMany({
        where: {
          deletedAt: null,
          active: true,
          map: { companyId, deletedAt: null, active: true },
        },
        select: this.strategicObjectiveSelect(),
        orderBy: [
          { map: { startsAt: 'desc' } },
          { perspective: { position: 'asc' } },
          { position: 'asc' },
          { name: 'asc' },
        ],
      }),
      this.prisma.orgNode.findMany({
        where: { companyId, deletedAt: null, active: true },
        select: { id: true, name: true, code: true, type: true, parentId: true },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.user.findMany({
        where: { companyId, deletedAt: null, active: true },
        select: { id: true, name: true, email: true, avatarUrl: true, jobTitle: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.indicator.findMany({
        where: { companyId, deletedAt: null, status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          code: true,
          unit: true,
          ownerNode: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      strategicObjectives: strategic.map((obj) => ({
        ...obj,
        indicators: obj.indicatorLinks.map((link) => link.indicator),
      })),
      areas,
      users,
      indicators,
    };
  }

  /** Garante que o ciclo pertence a empresa da sessao (isolamento multiempresa). */
  private async assertCycle(companyId: string, cycleId: string) {
    const cycle = await this.prisma.oKRCycle.findFirst({
      where: { id: cycleId, companyId },
      select: { id: true, startsAt: true, endsAt: true },
    });
    if (!cycle) throw new NotFoundException('Ciclo OKR nao encontrado');
    return cycle;
  }

  /** Carrega o objetivo isolado por empresa (via ciclo). */
  private async assertObjective(companyId: string, id: string) {
    const obj = await this.prisma.oKRObjective.findFirst({
      where: { id, deletedAt: null, cycle: { companyId } },
      select: { id: true, cycleId: true },
    });
    if (!obj) throw new NotFoundException('Objetivo OKR nao encontrado');
    return obj;
  }

  /** Garante que o objetivo estrategico pertence a empresa. */
  private async assertStrategicObjective(companyId: string, strategicObjId: string) {
    const ok = await this.prisma.strategicObjective.count({
      where: { id: strategicObjId, deletedAt: null, map: { companyId, deletedAt: null } },
    });
    if (!ok) throw new NotFoundException('Objetivo estrategico nao encontrado');
  }

  /** Garante que a area (OrgNode) pertence a empresa. */
  private async assertOrgNode(companyId: string, nodeId: string) {
    const ok = await this.prisma.orgNode.count({ where: { id: nodeId, companyId, deletedAt: null } });
    if (!ok) throw new NotFoundException('Area nao encontrada');
  }

  /** Garante que o usuario dono pertence a empresa. */
  private async assertUser(companyId: string, userId: string) {
    const ok = await this.prisma.user.count({ where: { id: userId, companyId, deletedAt: null } });
    if (!ok) throw new NotFoundException('Usuario nao encontrado');
  }

  /** Garante que o indicador vinculado ao KR pertence a empresa. */
  private async assertIndicator(companyId: string, indicatorId: string) {
    const ok = await this.prisma.indicator.count({ where: { id: indicatorId, companyId, deletedAt: null } });
    if (!ok) throw new NotFoundException('Indicador nao encontrado');
  }

  /** Garante que o objetivo pai pertence ao mesmo ciclo do OKR. */
  private async assertParentInCycle(companyId: string, parentId: string, cycleId: string, currentId?: string) {
    if (parentId === currentId) throw new NotFoundException('Objetivo pai invalido');
    const parent = await this.prisma.oKRObjective.findFirst({
      where: { id: parentId, cycleId, deletedAt: null, cycle: { companyId } },
      select: { id: true },
    });
    if (!parent) throw new NotFoundException('Objetivo pai nao encontrado neste ciclo');
  }

  /** Garante que o resultado-chave pertence a empresa (via objetivo -> ciclo). */
  private async assertKeyResult(companyId: string, krId: string) {
    const kr = await this.prisma.keyResult.findFirst({
      where: { id: krId, objective: { deletedAt: null, cycle: { companyId } } },
      select: { id: true },
    });
    if (!kr) throw new NotFoundException('Resultado-chave nao encontrado');
  }

  async listObjectives(me: AuthPayload, cycleId: string) {
    const cycle = await this.assertCycle(me.companyId, cycleId);
    const objs = await this.prisma.oKRObjective.findMany({
      where: { cycleId, deletedAt: null },
      include: this.objectiveInclude(),
      orderBy: { createdAt: 'asc' },
    });
    return this.applyHierarchyProgress(objs.map((o) => this.enrich(o, cycle)));
  }

  async getObjective(me: AuthPayload, id: string) {
    const obj = await this.prisma.oKRObjective.findFirst({
      where: { id, deletedAt: null, cycle: { companyId: me.companyId } },
      include: { ...this.objectiveInclude(), cycle: { select: { startsAt: true, endsAt: true } } },
    });
    if (!obj) throw new NotFoundException('Objetivo OKR nao encontrado');
    return this.enrich(obj, (obj as any).cycle);
  }

  enrich(obj: any, cycle?: { startsAt: Date; endsAt: Date } | null) {
    const krs: (KRComputed & { indicator: any; linkedValue: number | null })[] = obj.keyResults.map((kr: any) => {
      // KR ligado a indicador: o valor atual reflete o ultimo realizado do indicador.
      const linkedValue = kr.indicator?.results?.[0]?.value ?? null;
      const currentValue = kr.indicatorId != null && linkedValue != null ? linkedValue : kr.currentValue;
      const computed = { ...kr, currentValue };
      return {
        ...computed,
        indicator: kr.indicator ? { id: kr.indicator.id, name: kr.indicator.name, code: kr.indicator.code, unit: kr.indicator.unit } : null,
        linkedValue,
        progress: this.krProgress(computed),
      };
    });
    const totalWeight = krs.reduce((a, k) => a + (k.weight || 1), 0) || 1;
    const krProgress = krs.reduce((a, k) => a + (k.progress * (k.weight || 1)) / totalWeight, 0);
    const actionPlans = (obj.actionPlans ?? []).map((action: any) => {
      const tasks = action.tasks ?? [];
      const taskCount = tasks.length;
      const doneTaskCount = tasks.filter((task: any) => task.done).length;
      const taskProgress = taskCount ? doneTaskCount / taskCount : Math.max(0, Math.min(1, Number(action.progress ?? 0) / 100));
      const { tasks: _tasks, ...rest } = action;
      return { ...rest, taskCount, doneTaskCount, taskProgress };
    });
    const actionProgress = actionPlans.length
      ? actionPlans.reduce((acc: number, action: any) => acc + action.taskProgress, 0) / actionPlans.length
      : null;
    const latestCheckinProgress = obj.checkins?.length ? obj.checkins[obj.checkins.length - 1]?.progress : null;
    const baseProgress = actionProgress ?? (krs.length ? krProgress : latestCheckinProgress ?? 0);

    // Saude / ritmo: progresso esperado pela posicao no tempo do ciclo.
    let expectedProgress: number | null = null;
    if (cycle?.startsAt && cycle?.endsAt) {
      const s = new Date(cycle.startsAt).getTime();
      const e = new Date(cycle.endsAt).getTime();
      const now = Date.now();
      expectedProgress = e > s ? Math.max(0, Math.min(1, (now - s) / (e - s))) : null;
    }
    const pace = expectedProgress != null ? baseProgress - expectedProgress : null;
    const paceLabel =
      pace == null ? null : pace >= 0.05 ? 'AHEAD' : pace >= -0.1 ? 'ON_TRACK' : pace >= -0.25 ? 'BEHIND' : 'AT_RISK';

    // Cadencia de check-in.
    const weeks = (obj.checkins ?? []).map((c: any) => c.weekRef).filter(Boolean).sort();
    const lastCheckinWeek = weeks.length ? weeks[weeks.length - 1] : null;
    const currentWeek = this.weekRef(new Date());
    const finished = obj.status === ObjectiveStatus.DONE || obj.status === ObjectiveStatus.CANCELLED;
    const needsCheckin = !finished && lastCheckinWeek !== currentWeek;

    return {
      ...obj,
      strategicObj: obj.strategicObj
        ? {
            ...obj.strategicObj,
            indicators: (obj.strategicObj.indicatorLinks ?? []).map((link: any) => link.indicator),
          }
        : null,
      ownerNode: obj.ownerNode ?? null,
      ownerUser: obj.ownerUser ?? null,
      area: obj.ownerNode ?? obj.strategicObj?.ownerNode ?? null,
      keyResults: krs,
      actionPlans,
      actionPlanCount: actionPlans.length,
      taskCount: actionPlans.reduce((acc: number, action: any) => acc + action.taskCount, 0),
      doneTaskCount: actionPlans.reduce((acc: number, action: any) => acc + action.doneTaskCount, 0),
      krProgress,
      actionProgress,
      baseProgress,
      progress: baseProgress,
      progressSource: actionPlans.length ? 'ACTIONS' : krs.length ? 'KEY_RESULTS' : latestCheckinProgress != null ? 'CHECKINS' : 'EMPTY',
      expectedProgress,
      pace,
      paceLabel,
      lastCheckinWeek,
      currentWeek,
      needsCheckin,
    };
  }

  private applyHierarchyProgress(items: any[]) {
    const byId = new Map(items.map((item) => [item.id, item]));
    const childrenByParent = new Map<string, any[]>();
    for (const item of items) {
      if (!item.parentId || !byId.has(item.parentId)) continue;
      const children = childrenByParent.get(item.parentId) ?? [];
      children.push(item);
      childrenByParent.set(item.parentId, children);
    }

    const resolving = new Set<string>();
    const resolve = (item: any): number => {
      if (!item || resolving.has(item.id)) return Number(item?.baseProgress ?? item?.progress ?? 0);
      resolving.add(item.id);
      const children = childrenByParent.get(item.id) ?? [];
      if (children.length > 0) {
        const totalWeight = children.reduce((sum, child) => sum + (Number(child.weight) || 1), 0) || 1;
        item.progress = children.reduce((sum, child) => sum + (resolve(child) * (Number(child.weight) || 1)) / totalWeight, 0);
        item.progressSource = 'CHILDREN';
        this.refreshPace(item);
      } else {
        item.progress = Number(item.baseProgress ?? item.progress ?? 0);
        this.refreshPace(item);
      }
      resolving.delete(item.id);
      return item.progress;
    };

    for (const item of items) resolve(item);
    return items;
  }

  private refreshPace(item: any) {
    const pace = item.expectedProgress != null ? item.progress - item.expectedProgress : null;
    item.pace = pace;
    item.paceLabel =
      pace == null ? null : pace >= 0.05 ? 'AHEAD' : pace >= -0.1 ? 'ON_TRACK' : pace >= -0.25 ? 'BEHIND' : 'AT_RISK';
  }

  krProgress(kr: {
    startValue: number;
    currentValue: number;
    targetValue: number;
    direction: Direction;
  }): number {
    const { startValue, currentValue, targetValue, direction } = kr;
    if (direction === Direction.HIGHER_BETTER) {
      if (targetValue === startValue) return currentValue >= targetValue ? 1 : 0;
      const p = (currentValue - startValue) / (targetValue - startValue);
      return Math.max(0, Math.min(1, p));
    }
    if (direction === Direction.LOWER_BETTER) {
      if (startValue === targetValue) return currentValue <= targetValue ? 1 : 0;
      const p = (startValue - currentValue) / (startValue - targetValue);
      return Math.max(0, Math.min(1, p));
    }
    // EQUAL/RANGE: distancia relativa
    const dist = Math.abs(currentValue - targetValue);
    const base = Math.max(Math.abs(targetValue - startValue), 1);
    return Math.max(0, 1 - dist / base);
  }

  /** Semana ISO (YYYY-Www), mesmo formato usado nos check-ins. */
  private weekRef(date: Date): string {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  async createObjective(
    me: AuthPayload,
    cycleId: string,
    body: {
      name: string;
      description?: string;
      ownerName?: string;
      team?: string;
      ownerNodeId?: string;
      ownerUserId?: string;
      weight?: number;
      strategicObjId?: string;
      parentId?: string;
    },
  ) {
    await this.assertCycle(me.companyId, cycleId);
    if (body.strategicObjId) await this.assertStrategicObjective(me.companyId, body.strategicObjId);
    if (body.parentId) await this.assertParentInCycle(me.companyId, body.parentId, cycleId);
    if (body.ownerNodeId) await this.assertOrgNode(me.companyId, body.ownerNodeId);
    if (body.ownerUserId) await this.assertUser(me.companyId, body.ownerUserId);
    return this.prisma.oKRObjective.create({
      data: {
        cycleId,
        name: body.name,
        description: body.description ?? null,
        ownerName: body.ownerName ?? null,
        team: body.team ?? null,
        ownerNodeId: body.ownerNodeId ?? null,
        ownerUserId: body.ownerUserId ?? null,
        weight: body.weight ?? 1,
        strategicObjId: body.strategicObjId ?? null,
        parentId: body.parentId ?? null,
      },
    });
  }

  async updateObjective(me: AuthPayload, id: string, patch: any) {
    const current = await this.assertObjective(me.companyId, id);
    if (patch?.strategicObjId) await this.assertStrategicObjective(me.companyId, patch.strategicObjId);
    if (patch?.parentId) await this.assertParentInCycle(me.companyId, patch.parentId, current.cycleId, id);
    if (patch?.ownerNodeId) await this.assertOrgNode(me.companyId, patch.ownerNodeId);
    if (patch?.ownerUserId) await this.assertUser(me.companyId, patch.ownerUserId);
    // Whitelist explicito: evita persistir campos calculados (area, pace, etc.) que voltam do front.
    const data: Record<string, any> = {};
    for (const key of ['name', 'description', 'ownerName', 'team', 'ownerNodeId', 'ownerUserId', 'weight', 'status', 'confidence', 'strategicObjId', 'parentId'] as const) {
      if (key in (patch ?? {})) data[key] = patch[key];
    }
    return this.prisma.oKRObjective.update({ where: { id }, data });
  }

  async removeObjective(me: AuthPayload, id: string) {
    await this.assertObjective(me.companyId, id);
    return this.prisma.oKRObjective.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async addKeyResult(
    me: AuthPayload,
    objectiveId: string,
    body: {
      metric: string;
      unit?: IndicatorUnit;
      startValue: number;
      currentValue: number;
      targetValue: number;
      direction?: Direction;
      weight?: number;
      responsible?: string;
      indicatorId?: string;
    },
  ) {
    await this.assertObjective(me.companyId, objectiveId);
    if (body.indicatorId) await this.assertIndicator(me.companyId, body.indicatorId);
    return this.prisma.keyResult.create({
      data: {
        objectiveId,
        metric: body.metric,
        unit: body.unit ?? IndicatorUnit.QUANTITY,
        startValue: body.startValue,
        currentValue: body.currentValue,
        targetValue: body.targetValue,
        direction: body.direction ?? Direction.HIGHER_BETTER,
        weight: body.weight ?? 1,
        responsible: body.responsible ?? null,
        indicatorId: body.indicatorId ?? null,
      },
    });
  }

  async updateKeyResult(me: AuthPayload, id: string, patch: any) {
    await this.assertKeyResult(me.companyId, id);
    if (patch?.indicatorId) await this.assertIndicator(me.companyId, patch.indicatorId);
    const data: Record<string, any> = {};
    for (const key of ['metric', 'unit', 'startValue', 'currentValue', 'targetValue', 'direction', 'weight', 'responsible', 'indicatorId'] as const) {
      if (key in (patch ?? {})) data[key] = patch[key];
    }
    return this.prisma.keyResult.update({ where: { id }, data });
  }

  async removeKeyResult(me: AuthPayload, id: string) {
    await this.assertKeyResult(me.companyId, id);
    return this.prisma.keyResult.delete({ where: { id } });
  }

  async checkin(me: AuthPayload, objectiveId: string, body: { weekRef: string; confidence: number; progress: number; note?: string }) {
    await this.assertObjective(me.companyId, objectiveId);
    const ck = await this.prisma.oKRCheckin.create({
      data: {
        objectiveId,
        weekRef: body.weekRef,
        confidence: body.confidence,
        progress: body.progress,
        note: body.note ?? null,
      },
    });
    let status: ObjectiveStatus = ObjectiveStatus.PLANNED;
    if (body.progress >= 0.95) status = ObjectiveStatus.DONE;
    else if (body.confidence >= 0.7 && body.progress >= 0.3) status = ObjectiveStatus.ON_TRACK;
    else if (body.confidence < 0.4) status = ObjectiveStatus.OFF_TRACK;
    else status = ObjectiveStatus.AT_RISK;
    await this.prisma.oKRObjective.update({
      where: { id: objectiveId },
      data: { confidence: body.confidence, status },
    });
    return ck;
  }
}
