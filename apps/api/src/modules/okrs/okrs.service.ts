import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Direction, IndicatorUnit, ObjectiveStatus } from '@prisma/client';

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

  async listObjectives(cycleId: string) {
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

  async getObjective(id: string) {
    const obj = await this.prisma.oKRObjective.findFirst({
      where: { id, deletedAt: null },
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

  async updateObjective(id: string, patch: any) {
    return this.prisma.oKRObjective.update({ where: { id }, data: patch });
  }

  async removeObjective(id: string) {
    return this.prisma.oKRObjective.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async addKeyResult(
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

  async updateKeyResult(id: string, patch: any) {
    return this.prisma.keyResult.update({ where: { id }, data: patch });
  }

  async removeKeyResult(id: string) {
    return this.prisma.keyResult.delete({ where: { id } });
  }

  async checkin(objectiveId: string, body: { weekRef: string; confidence: number; progress: number; note?: string }) {
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
