import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ObjectiveStatus, PerspectiveKind, TrafficLight } from '@prisma/client';

@Injectable()
export class StrategyService {
  constructor(private readonly prisma: PrismaService) {}

  async listMaps(companyId: string) {
    return this.prisma.strategicMap.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { startsAt: 'desc' },
    });
  }

  async getMap(id: string) {
    const map = await this.prisma.strategicMap.findFirst({
      where: { id, deletedAt: null },
      include: {
        perspectives: { orderBy: { position: 'asc' } },
        objectives: {
          where: { deletedAt: null },
          include: {
            perspective: true,
            indicators: {
              select: { id: true, name: true, code: true, results: { orderBy: { periodDate: 'desc' }, take: 1, select: { light: true, attainment: true } } },
            },
            outRelations: { include: { to: { select: { id: true, name: true } } } },
            inRelations: { include: { from: { select: { id: true, name: true } } } },
          },
          orderBy: { position: 'asc' },
        },
      },
    });
    if (!map) throw new NotFoundException('Mapa nao encontrado');

    const enriched = {
      ...map,
      objectives: map.objectives.map((obj) => {
        const lights = obj.indicators
          .map((i) => i.results[0]?.light)
          .filter((l): l is TrafficLight => !!l);
        const attainments = obj.indicators
          .map((i) => i.results[0]?.attainment)
          .filter((v): v is number => v !== null && v !== undefined);
        const avg = attainments.length > 0 ? attainments.reduce((a, b) => a + b, 0) / attainments.length : null;
        let aggregateLight: TrafficLight = TrafficLight.GRAY;
        if (lights.length > 0) {
          if (lights.some((l) => l === TrafficLight.RED)) aggregateLight = TrafficLight.RED;
          else if (lights.some((l) => l === TrafficLight.YELLOW)) aggregateLight = TrafficLight.YELLOW;
          else aggregateLight = TrafficLight.GREEN;
        }
        return { ...obj, aggregateLight, aggregateAttainment: avg };
      }),
    };
    return enriched;
  }

  async createMap(companyId: string, name: string, startsAt: Date, endsAt: Date) {
    return this.prisma.strategicMap.create({
      data: { companyId, name, startsAt, endsAt },
    });
  }

  async addPerspective(mapId: string, kind: PerspectiveKind, name: string, color?: string) {
    const count = await this.prisma.perspective.count({ where: { mapId } });
    return this.prisma.perspective.create({
      data: { mapId, kind, name, color: color ?? null, position: count },
    });
  }

  async addObjective(
    mapId: string,
    perspectiveId: string,
    name: string,
    description?: string,
    weight = 1,
  ) {
    const count = await this.prisma.strategicObjective.count({ where: { mapId } });
    return this.prisma.strategicObjective.create({
      data: { mapId, perspectiveId, name, description: description ?? null, weight, position: count },
    });
  }

  async updateObjective(id: string, patch: { name?: string; description?: string; status?: ObjectiveStatus; weight?: number; priority?: number }) {
    return this.prisma.strategicObjective.update({ where: { id }, data: patch });
  }

  async removeObjective(id: string) {
    return this.prisma.strategicObjective.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async addRelation(fromId: string, toId: string, weight = 1) {
    if (fromId === toId) throw new NotFoundException('Objetivo origem e destino devem ser diferentes');
    return this.prisma.objectiveRelation.upsert({
      where: { fromId_toId: { fromId, toId } },
      create: { fromId, toId, weight },
      update: { weight },
    });
  }

  async removeRelation(id: string) {
    return this.prisma.objectiveRelation.delete({ where: { id } });
  }

  async attachIndicator(objectiveId: string, indicatorId: string) {
    return this.prisma.indicator.update({
      where: { id: indicatorId },
      data: { strategicObjectiveId: objectiveId },
    });
  }

  async detachIndicator(indicatorId: string) {
    return this.prisma.indicator.update({
      where: { id: indicatorId },
      data: { strategicObjectiveId: null },
    });
  }
}
