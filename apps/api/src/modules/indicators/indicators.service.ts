import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IndicatorCreateInput, IndicatorTargetUpsertInput } from '@g360/shared';
import { calcStatus } from '@g360/shared';
import { Direction, TrafficLight } from '@prisma/client';
import { lastNPeriodRefs, periodRefToDate } from './period.util';

export interface IndicatorFilter {
  companyId: string;
  ownerNodeId?: string;
  type?: string;
  status?: string;
  search?: string;
  light?: TrafficLight;
}

@Injectable()
export class IndicatorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(f: IndicatorFilter) {
    const items = await this.prisma.indicator.findMany({
      where: {
        companyId: f.companyId,
        deletedAt: null,
        ...(f.ownerNodeId ? { ownerNodeId: f.ownerNodeId } : {}),
        ...(f.type ? { type: f.type as any } : {}),
        ...(f.status ? { status: f.status as any } : {}),
        ...(f.search
          ? {
              OR: [
                { name: { contains: f.search, mode: 'insensitive' } },
                { code: { contains: f.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        ownerNode: { select: { id: true, name: true, type: true } },
        responsibleUser: { select: { id: true, name: true } },
      },
      orderBy: [{ name: 'asc' }],
    });

    // pega ultimo resultado de cada indicador
    const lastResults = await this.prisma.indicatorResult.findMany({
      where: { indicatorId: { in: items.map((i) => i.id) } },
      orderBy: { periodDate: 'desc' },
      distinct: ['indicatorId'],
    });
    const lastByIndicator = new Map(lastResults.map((r) => [r.indicatorId, r]));

    const filtered = items.map((i) => {
      const last = lastByIndicator.get(i.id);
      return {
        ...i,
        last: last
          ? {
              periodRef: last.periodRef,
              value: last.value,
              light: last.light,
              attainment: last.attainment,
              deviationPct: last.deviationPct,
            }
          : null,
      };
    });

    return f.light ? filtered.filter((x) => x.last?.light === f.light) : filtered;
  }

  async getById(id: string) {
    const indicator = await this.prisma.indicator.findFirst({
      where: { id, deletedAt: null },
      include: {
        ownerNode: true,
        responsibleUser: true,
        feederUser: true,
        targets: { orderBy: { periodRef: 'asc' } },
        results: { orderBy: { periodDate: 'asc' } },
      },
    });
    if (!indicator) throw new NotFoundException('Indicador nao encontrado');
    return indicator;
  }

  async create(input: IndicatorCreateInput) {
    return this.prisma.indicator.create({ data: { ...input } });
  }

  async update(id: string, input: Partial<IndicatorCreateInput>) {
    return this.prisma.indicator.update({ where: { id }, data: { ...input } });
  }

  async remove(id: string) {
    return this.prisma.indicator.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
  }

  // --- targets ---

  async upsertTarget(input: IndicatorTargetUpsertInput) {
    const t = await this.prisma.indicatorTarget.upsert({
      where: {
        indicatorId_periodRef: {
          indicatorId: input.indicatorId,
          periodRef: input.periodRef,
        },
      },
      create: {
        indicatorId: input.indicatorId,
        periodRef: input.periodRef,
        target: input.target,
        lowerBound: input.lowerBound ?? null,
        upperBound: input.upperBound ?? null,
        weight: input.weight ?? 1,
      },
      update: {
        target: input.target,
        lowerBound: input.lowerBound ?? null,
        upperBound: input.upperBound ?? null,
        weight: input.weight ?? 1,
      },
    });
    // Recalcula um result existente, se houver
    await this.recalcResultStatus(input.indicatorId, input.periodRef);
    return t;
  }

  async listTargets(indicatorId: string) {
    return this.prisma.indicatorTarget.findMany({
      where: { indicatorId },
      orderBy: { periodRef: 'asc' },
    });
  }

  /**
   * Aplica recomputo de status, atingimento e desvios. Util quando meta muda.
   */
  async recalcResultStatus(indicatorId: string, periodRef: string) {
    const result = await this.prisma.indicatorResult.findUnique({
      where: { indicatorId_periodRef: { indicatorId, periodRef } },
    });
    if (!result) return;
    const indicator = await this.prisma.indicator.findUnique({
      where: { id: indicatorId },
      select: { direction: true, yellowToleranceP: true },
    });
    const target = await this.prisma.indicatorTarget.findUnique({
      where: { indicatorId_periodRef: { indicatorId, periodRef } },
    });
    const status = calcStatus({
      value: result.value,
      target: target?.target ?? null,
      direction: indicator?.direction as Direction,
      lowerBound: target?.lowerBound ?? null,
      upperBound: target?.upperBound ?? null,
      yellowToleranceP: indicator?.yellowToleranceP ?? 10,
    });
    await this.prisma.indicatorResult.update({
      where: { id: result.id },
      data: {
        light: status.light as TrafficLight,
        attainment: status.attainment,
        deviationAbs: status.deviationAbs,
        deviationPct: status.deviationPct,
      },
    });
  }

  // --- relacoes (arvore de indicadores) ---

  async listChildren(parentId: string) {
    return this.prisma.indicatorTreeRelation.findMany({
      where: { parentId },
      include: { child: { select: { id: true, name: true, code: true } } },
    });
  }

  async addRelation(parentId: string, childId: string, kind: string, weight: number) {
    if (parentId === childId) throw new Error('Indicador nao pode se relacionar com ele mesmo');
    return this.prisma.indicatorTreeRelation.upsert({
      where: { parentId_childId: { parentId, childId } },
      create: { parentId, childId, kind: kind as any, weight },
      update: { kind: kind as any, weight },
    });
  }

  async removeRelation(parentId: string, childId: string) {
    return this.prisma.indicatorTreeRelation.deleteMany({ where: { parentId, childId } });
  }

  /**
   * Retorna grafo completo da arvore de indicadores (nodes + edges).
   * Inclui o ultimo light de cada indicador.
   */
  async treeGraph(companyId: string) {
    const indicators = await this.prisma.indicator.findMany({
      where: { companyId, deletedAt: null, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        ownerNode: { select: { name: true } },
        results: { orderBy: { periodDate: 'desc' }, take: 1, select: { light: true, attainment: true } },
      },
    });
    const ids = indicators.map((i) => i.id);
    const relations = await this.prisma.indicatorTreeRelation.findMany({
      where: { parentId: { in: ids } },
    });
    return {
      nodes: indicators.map((i) => ({
        id: i.id,
        label: i.name,
        code: i.code,
        type: i.type,
        owner: i.ownerNode.name,
        light: i.results[0]?.light ?? 'GRAY',
        attainment: i.results[0]?.attainment ?? null,
      })),
      edges: relations.map((r) => ({
        id: r.id,
        from: r.parentId,
        to: r.childId,
        kind: r.kind,
        weight: r.weight,
      })),
    };
  }

  /**
   * Simulacao: dado um indicador "fonte", encontra todos os descendentes
   * ate profundidade max, com o peso acumulado da influencia.
   */
  async simulateImpact(sourceId: string, maxDepth = 4) {
    const all = await this.prisma.indicatorTreeRelation.findMany();
    const map = new Map<string, typeof all>();
    all.forEach((r) => {
      if (!map.has(r.parentId)) map.set(r.parentId, []);
      map.get(r.parentId)!.push(r);
    });
    const impacted: Array<{ indicatorId: string; depth: number; accumulatedWeight: number; kind: string }> = [];
    const seen = new Set<string>([sourceId]);
    type Q = { id: string; depth: number; weight: number; kind: string };
    const queue: Q[] = (map.get(sourceId) ?? []).map((r) => ({
      id: r.childId,
      depth: 1,
      weight: r.weight,
      kind: r.kind,
    }));
    while (queue.length) {
      const n = queue.shift()!;
      if (seen.has(n.id) || n.depth > maxDepth) continue;
      seen.add(n.id);
      impacted.push({ indicatorId: n.id, depth: n.depth, accumulatedWeight: n.weight, kind: n.kind });
      for (const r of map.get(n.id) ?? []) {
        queue.push({ id: r.childId, depth: n.depth + 1, weight: n.weight * r.weight, kind: r.kind });
      }
    }
    const ids = impacted.map((i) => i.indicatorId);
    const indicators = await this.prisma.indicator.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, code: true, results: { orderBy: { periodDate: 'desc' }, take: 1, select: { light: true } } },
    });
    const byId = new Map(indicators.map((i) => [i.id, i]));
    return impacted.map((i) => ({
      ...i,
      name: byId.get(i.indicatorId)?.name ?? '?',
      code: byId.get(i.indicatorId)?.code ?? null,
      light: byId.get(i.indicatorId)?.results[0]?.light ?? 'GRAY',
    }));
  }

  // --- series historicas ---

  async series(indicatorId: string, points = 12) {
    const indicator = await this.prisma.indicator.findUnique({
      where: { id: indicatorId },
      select: { periodicity: true },
    });
    if (!indicator) throw new NotFoundException('Indicador nao encontrado');
    const refs = lastNPeriodRefs(indicator.periodicity, points);
    const [targets, results] = await Promise.all([
      this.prisma.indicatorTarget.findMany({
        where: { indicatorId, periodRef: { in: refs } },
      }),
      this.prisma.indicatorResult.findMany({
        where: { indicatorId, periodRef: { in: refs } },
      }),
    ]);
    const tMap = new Map(targets.map((t) => [t.periodRef, t]));
    const rMap = new Map(results.map((r) => [r.periodRef, r]));
    return refs.map((ref) => ({
      periodRef: ref,
      periodDate: periodRefToDate(ref, indicator.periodicity),
      target: tMap.get(ref)?.target ?? null,
      value: rMap.get(ref)?.value ?? null,
      light: rMap.get(ref)?.light ?? 'GRAY',
      attainment: rMap.get(ref)?.attainment ?? null,
    }));
  }
}
