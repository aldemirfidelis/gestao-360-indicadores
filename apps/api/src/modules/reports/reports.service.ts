import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Array.from(
    rows.reduce<Set<string>>((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set()),
  );
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('\n') || s.includes('"')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(',')];
  rows.forEach((r) => lines.push(headers.map((h) => escape(r[h])).join(',')));
  return lines.join('\n');
}

const ownerNodeReportSelect = {
  select: {
    name: true,
    type: true,
    parent: {
      select: {
        name: true,
        type: true,
        parent: {
          select: {
            name: true,
            type: true,
            parent: {
              select: {
                name: true,
                type: true,
              },
            },
          },
        },
      },
    },
  },
} as const;

const ROOT_NODE_TYPES = new Set(['COMPANY', 'BRANCH', 'DIRECTORATE']);

function areaLabels(ownerNode: any) {
  const path = [];
  let node = ownerNode;
  while (node) {
    path.unshift(node);
    node = node.parent;
  }
  const areaPath = path.filter((item) => !ROOT_NODE_TYPES.has(item.type));
  const macro = areaPath[0]?.name ?? ownerNode?.name ?? '';
  const micro = areaPath[areaPath.length - 1]?.name ?? macro;
  return { macro, micro };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async indicatorsCsv(companyId: string) {
    const items = await this.prisma.indicator.findMany({
      where: { companyId, deletedAt: null },
      include: {
        ownerNode: ownerNodeReportSelect,
        responsibleUser: { select: { name: true } },
        results: { orderBy: { periodDate: 'desc' }, take: 1 },
      },
      orderBy: { name: 'asc' },
    });
    const rows = items.map((i) => {
      const area = areaLabels(i.ownerNode);
      return {
        code: i.code ?? '',
        name: i.name,
        type: i.type,
        unit: i.unit,
        periodicity: i.periodicity,
        direction: i.direction,
        areaMacro: area.macro,
        areaMicro: area.micro,
        owner: i.ownerNode.name,
        responsible: i.responsibleUser?.name ?? '',
        status: i.status,
        lastPeriod: i.results[0]?.periodRef ?? '',
        lastValue: i.results[0]?.value ?? '',
        lastLight: i.results[0]?.light ?? '',
        lastAttainment: i.results[0]?.attainment ?? '',
      };
    });
    return toCsv(rows);
  }

  async resultsCsv(companyId: string, periodFrom?: string, periodTo?: string) {
    const results = await this.prisma.indicatorResult.findMany({
      where: {
        indicator: { companyId, deletedAt: null },
        ...(periodFrom ? { periodRef: { gte: periodFrom } } : {}),
        ...(periodTo ? { periodRef: { lte: periodTo } } : {}),
      },
      include: {
        indicator: { select: { code: true, name: true, ownerNode: ownerNodeReportSelect } },
      },
      orderBy: [{ periodDate: 'desc' }],
    });
    const rows = results.map((r) => {
      const area = areaLabels(r.indicator.ownerNode);
      return {
        periodRef: r.periodRef,
        code: r.indicator.code ?? '',
        indicator: r.indicator.name,
        areaMacro: area.macro,
        areaMicro: area.micro,
        area: r.indicator.ownerNode.name,
        value: r.value,
        attainment: r.attainment,
        deviationPct: r.deviationPct,
        light: r.light,
        status: r.status,
      };
    });
    return toCsv(rows);
  }

  async actionsCsv(companyId: string) {
    const items = await this.prisma.actionPlan.findMany({
      where: { companyId, deletedAt: null },
      include: {
        responsibleUser: { select: { name: true } },
        ownerNode: ownerNodeReportSelect,
        indicator: { select: { code: true, name: true } },
        strategicObjective: { select: { name: true, perspective: { select: { name: true } } } },
        deviation: { select: { number: true, title: true, method: true } },
        meeting: { select: { title: true } },
        _count: { select: { evidences: true, comments: true, analysisSessions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const rows = items.map((a) => {
      const area = a.ownerNode ? areaLabels(a.ownerNode) : { macro: '', micro: '' };
      return {
        title: a.title,
        origin: a.origin,
        strategicObjective: a.strategicObjective?.name ?? '',
        perspective: a.strategicObjective?.perspective?.name ?? '',
        indicatorCode: a.indicator?.code ?? '',
        indicator: a.indicator?.name ?? '',
        deviation: a.deviation ? `#${a.deviation.number} ${a.deviation.title}` : '',
        meeting: a.meeting?.title ?? '',
        analysisTool: a.analysisTool ?? a.deviation?.method ?? '',
        rootCause: a.rootCause ?? '',
        priority: a.priority,
        criticality: a.criticality,
        status: a.status,
        effectivenessStatus: a.effectivenessStatus,
        responsible: a.responsibleUser?.name ?? '',
        areaMacro: area.macro,
        areaMicro: area.micro,
        area: a.ownerNode?.name ?? '',
        startDate: a.startDate?.toISOString().slice(0, 10) ?? '',
        dueDate: a.dueDate?.toISOString().slice(0, 10) ?? '',
        completedAt: a.completedAt?.toISOString().slice(0, 10) ?? '',
        progress: a.progress,
        evidences: a._count.evidences,
        comments: a._count.comments,
        analyses: a._count.analysisSessions,
      };
    });
    return toCsv(rows);
  }

  async deviationsCsv(companyId: string) {
    const items = await this.prisma.deviation.findMany({
      where: { companyId, deletedAt: null },
      include: {
        indicator: { select: { code: true, name: true } },
        responsibleUser: { select: { name: true } },
      },
      orderBy: { number: 'asc' },
    });
    const rows = items.map((d) => ({
      number: d.number,
      title: d.title,
      indicatorCode: d.indicator.code ?? '',
      indicator: d.indicator.name,
      periodRef: d.periodRef,
      severity: d.severity,
      status: d.status,
      responsible: d.responsibleUser?.name ?? '',
      openedAt: d.openedAt.toISOString().slice(0, 10),
      dueDate: d.dueDate?.toISOString().slice(0, 10) ?? '',
      closedAt: d.closedAt?.toISOString().slice(0, 10) ?? '',
    }));
    return toCsv(rows);
  }
}
