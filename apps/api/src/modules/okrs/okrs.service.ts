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

  async listCycles(companyId: string) {
    return this.prisma.oKRCycle.findMany({
      where: { companyId },
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

  /** Garante que o ciclo pertence à empresa da sessão (isolamento multiempresa). */
  private async assertCycle(companyId: string, cycleId: string) {
    const cycle = await this.prisma.oKRCycle.findFirst({ where: { id: cycleId, companyId }, select: { id: true } });
    if (!cycle) throw new NotFoundException('Ciclo OKR nao encontrado');
  }

  /** Carrega o objetivo isolado por empresa (via ciclo). */
  private async assertObjective(companyId: string, id: string) {
    const obj = await this.prisma.oKRObjective.findFirst({
      where: { id, deletedAt: null, cycle: { companyId } },
      select: { id: true },
    });
    if (!obj) throw new NotFoundException('Objetivo OKR nao encontrado');
    return obj;
  }

  /** Garante que o resultado-chave pertence à empresa (via objetivo → ciclo). */
  private async assertKeyResult(companyId: string, krId: string) {
    const kr = await this.prisma.keyResult.findFirst({
      where: { id: krId, objective: { deletedAt: null, cycle: { companyId } } },
      select: { id: true },
    });
    if (!kr) throw new NotFoundException('Resultado-chave nao encontrado');
  }

  async listObjectives(me: AuthPayload, cycleId: string) {
    await this.assertCycle(me.companyId, cycleId);
    const objs = await this.prisma.oKRObjective.findMany({
      where: { cycleId, deletedAt: null },
      include: {
        keyResults: true,
        strategicObj: { select: { id: true, name: true } },
        checkins: {
          orderBy: { createdAt: 'asc' },
          select: { weekRef: true, progress: true, confidence: true, createdAt: true },
        },
        _count: { select: { checkins: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return objs.map((o) => this.enrich(o));
  }

  async getObjective(me: AuthPayload, id: string) {
    const obj = await this.prisma.oKRObjective.findFirst({
      where: { id, deletedAt: null, cycle: { companyId: me.companyId } },
      include: {
        keyResults: true,
        checkins: { orderBy: { createdAt: 'desc' }, take: 20 },
        strategicObj: true,
      },
    });
    if (!obj) throw new NotFoundException('Objetivo OKR nao encontrado');
    return this.enrich(obj);
  }

  enrich(obj: any) {
    const krs: KRComputed[] = obj.keyResults.map((kr: any) => ({
      ...kr,
      progress: this.krProgress(kr),
    }));
    const totalWeight = krs.reduce((a, k) => a + (k.weight || 1), 0) || 1;
    const overall = krs.reduce((a, k) => a + (k.progress * (k.weight || 1)) / totalWeight, 0);
    return { ...obj, keyResults: krs, progress: overall };
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
    // EQUAL/RANGE: distância relativa
    const dist = Math.abs(currentValue - targetValue);
    const base = Math.max(Math.abs(targetValue - startValue), 1);
    return Math.max(0, 1 - dist / base);
  }

  async createObjective(
    me: AuthPayload,
    cycleId: string,
    body: {
      name: string;
      description?: string;
      ownerName?: string;
      team?: string;
      weight?: number;
      strategicObjId?: string;
      parentId?: string;
    },
  ) {
    await this.assertCycle(me.companyId, cycleId);
    // Vínculos opcionais precisam pertencer à mesma empresa.
    if (body.strategicObjId) {
      const ok = await this.prisma.strategicObjective.count({
        where: { id: body.strategicObjId, map: { companyId: me.companyId, deletedAt: null } },
      });
      if (!ok) throw new NotFoundException('Objetivo estratégico nao encontrado');
    }
    if (body.parentId) await this.assertObjective(me.companyId, body.parentId);
    return this.prisma.oKRObjective.create({
      data: {
        cycleId,
        name: body.name,
        description: body.description ?? null,
        ownerName: body.ownerName ?? null,
        team: body.team ?? null,
        weight: body.weight ?? 1,
        strategicObjId: body.strategicObjId ?? null,
        parentId: body.parentId ?? null,
      },
    });
  }

  async updateObjective(me: AuthPayload, id: string, patch: any) {
    await this.assertObjective(me.companyId, id);
    // Não permite remanejar de ciclo/empresa via PATCH.
    const { id: _i, cycleId: _c, ...safe } = patch ?? {};
    return this.prisma.oKRObjective.update({ where: { id }, data: safe });
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
    },
  ) {
    await this.assertObjective(me.companyId, objectiveId);
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
      },
    });
  }

  async updateKeyResult(me: AuthPayload, id: string, patch: any) {
    await this.assertKeyResult(me.companyId, id);
    const { id: _i, objectiveId: _o, ...safe } = patch ?? {};
    return this.prisma.keyResult.update({ where: { id }, data: safe });
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
    // Atualiza objetivo
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
