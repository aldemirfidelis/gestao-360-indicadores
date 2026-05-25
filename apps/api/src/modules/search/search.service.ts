import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async global(companyId: string, q: string, limit = 8) {
    const term = q.trim();
    if (term.length < 2) return [];
    const contains = { contains: term, mode: 'insensitive' as const };

    const [indicators, orgNodes, actions, deviations, meetings, users, objectives] = await Promise.all([
      this.prisma.indicator.findMany({
        where: {
          companyId,
          deletedAt: null,
          OR: [{ name: contains }, { code: contains }, { description: contains }],
        },
        select: {
          id: true,
          name: true,
          code: true,
          ownerNode: { select: { name: true } },
          results: { orderBy: { periodDate: 'desc' }, take: 1, select: { light: true } },
        },
        take: limit,
      }),
      this.prisma.orgNode.findMany({
        where: { companyId, deletedAt: null, OR: [{ name: contains }, { code: contains }, { description: contains }] },
        select: { id: true, name: true, type: true },
        take: limit,
      }),
      this.prisma.actionPlan.findMany({
        where: { companyId, deletedAt: null, OR: [{ title: contains }, { description: contains }] },
        select: { id: true, title: true, status: true, dueDate: true, responsibleUser: { select: { name: true } } },
        take: limit,
      }),
      this.prisma.deviation.findMany({
        where: { companyId, deletedAt: null, OR: [{ title: contains }, { fact: contains }, { rootCause: contains }] },
        select: { id: true, number: true, title: true, status: true, severity: true, indicator: { select: { name: true } } },
        take: limit,
      }),
      this.prisma.meeting.findMany({
        where: { companyId, deletedAt: null, OR: [{ title: contains }, { notes: contains }, { location: contains }] },
        select: { id: true, title: true, startsAt: true, kind: true },
        take: limit,
      }),
      this.prisma.user.findMany({
        where: { companyId, deletedAt: null, OR: [{ name: contains }, { email: contains }, { jobTitle: contains }] },
        select: { id: true, name: true, email: true, jobTitle: true, active: true },
        take: limit,
      }),
      this.prisma.strategicObjective.findMany({
        where: {
          deletedAt: null,
          map: { companyId, deletedAt: null },
          OR: [{ name: contains }, { description: contains }, { responsible: contains }],
        },
        select: { id: true, name: true, status: true, map: { select: { id: true, name: true } } },
        take: limit,
      }),
    ]);

    return [
      ...indicators.map((i) => ({
        id: i.id,
        type: 'indicator',
        label: i.name,
        description: `${i.code ?? 'Sem código'} - ${i.ownerNode.name}`,
        href: `/indicators/${i.id}`,
        status: i.results[0]?.light ?? 'GRAY',
      })),
      ...orgNodes.map((n) => ({
        id: n.id,
        type: 'org',
        label: n.name,
        description: n.type,
        href: '/org',
        status: 'ACTIVE',
      })),
      ...actions.map((a) => ({
        id: a.id,
        type: 'action',
        label: a.title,
        description: a.responsibleUser?.name ?? 'Sem responsável',
        href: `/actions/${a.id}`,
        status: a.status,
      })),
      ...deviations.map((d) => ({
        id: d.id,
        type: 'deviation',
        label: `#${d.number} ${d.title}`,
        description: d.indicator.name,
        href: `/deviations/${d.id}`,
        status: d.status,
      })),
      ...meetings.map((m) => ({
        id: m.id,
        type: 'meeting',
        label: m.title,
        description: m.kind,
        href: `/meetings/${m.id}`,
        status: m.startsAt > new Date() ? 'SCHEDULED' : 'DONE',
      })),
      ...users.map((u) => ({
        id: u.id,
        type: 'user',
        label: u.name,
        description: u.jobTitle ?? u.email,
        href: '/users',
        status: u.active ? 'ACTIVE' : 'INACTIVE',
      })),
      ...objectives.map((o) => ({
        id: o.id,
        type: 'objective',
        label: o.name,
        description: o.map.name,
        href: `/strategy/${o.map.id}`,
        status: o.status,
      })),
    ].slice(0, limit * 4);
  }
}
