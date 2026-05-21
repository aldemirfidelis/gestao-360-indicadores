import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionStatus, NotificationKind } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async create(
    companyId: string,
    userId: string,
    kind: NotificationKind,
    title: string,
    body?: string,
    link?: string,
  ) {
    return this.prisma.notification.create({
      data: { companyId, userId, kind, title, body: body ?? null, link: link ?? null },
    });
  }

  async markRead(id: string) {
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  /**
   * Job manual: gera alertas baseados em regras de negocio.
   * Em producao seria um cron com BullMQ. Aqui pode ser chamado on-demand.
   */
  async generateAlerts(companyId: string) {
    const created: string[] = [];

    // 1. Acoes atrasadas
    const overdueActions = await this.prisma.actionPlan.findMany({
      where: {
        companyId,
        deletedAt: null,
        dueDate: { lt: new Date() },
        status: { notIn: [ActionStatus.DONE, ActionStatus.DONE_LATE, ActionStatus.CANCELLED] },
      },
      include: { responsibleUser: { select: { id: true } } },
      take: 50,
    });
    for (const a of overdueActions) {
      if (!a.responsibleUser?.id) continue;
      const exists = await this.prisma.notification.findFirst({
        where: {
          userId: a.responsibleUser.id,
          kind: NotificationKind.ACTION_OVERDUE,
          link: `/actions/${a.id}`,
          readAt: null,
        },
      });
      if (exists) continue;
      await this.create(
        companyId,
        a.responsibleUser.id,
        NotificationKind.ACTION_OVERDUE,
        `Acao atrasada: ${a.title}`,
        `Prazo vencido em ${a.dueDate?.toLocaleDateString('pt-BR')}`,
        `/actions/${a.id}`,
      );
      created.push(a.id);
    }

    // 2. Indicadores em vermelho
    const reds = await this.prisma.indicatorResult.findMany({
      where: { indicator: { companyId, deletedAt: null }, light: 'RED' },
      distinct: ['indicatorId'],
      orderBy: { periodDate: 'desc' },
      include: { indicator: { select: { id: true, name: true, responsibleUserId: true } } },
      take: 30,
    });
    for (const r of reds) {
      const uid = r.indicator.responsibleUserId;
      if (!uid) continue;
      const exists = await this.prisma.notification.findFirst({
        where: {
          userId: uid,
          kind: NotificationKind.INDICATOR_OFF_TARGET,
          link: `/indicators/${r.indicator.id}`,
          readAt: null,
        },
      });
      if (exists) continue;
      await this.create(
        companyId,
        uid,
        NotificationKind.INDICATOR_OFF_TARGET,
        `Indicador critico: ${r.indicator.name}`,
        `Fora da meta no periodo ${r.periodRef}`,
        `/indicators/${r.indicator.id}`,
      );
      created.push(r.indicator.id);
    }

    return { generated: created.length };
  }
}
