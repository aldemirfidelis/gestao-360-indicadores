import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { DocumentStatus, NotificationKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { AuthPayload } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkItemEventBus } from '../my-day/work-item-event-bus';
import { PUBLISHED_LIKE } from './document-content.service';
import { label } from './document-workflow.service';

const DEFAULT_READ_DAYS = 7;

function ids(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))];
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

/**
 * Distribuição controlada e leitura obrigatória.
 *
 * O documento define o público-alvo (pessoas, áreas com seus setores e grupos
 * de acesso). Ao publicar uma revisão com leitura obrigatória, cada pessoa
 * recebe uma leitura pendente com prazo no Meu Dia; a confirmação fica
 * registrada por revisão. Novas pessoas que entram na área recebem a leitura
 * na rotina diária.
 */
@Injectable()
export class DocumentDistributionService {
  private readonly logger = new Logger(DocumentDistributionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    private readonly workItems: WorkItemEventBus,
  ) {}

  async targets(companyId: string, documentId: string) {
    const rows = await this.prisma.documentDistribution.findMany({ where: { companyId, documentId, versionId: null } });
    return {
      userIds: rows.map((row) => row.userId).filter(Boolean) as string[],
      orgNodeIds: rows.map((row) => row.orgNodeId).filter(Boolean) as string[],
      groupIds: rows.map((row) => row.groupId).filter(Boolean) as string[],
    };
  }

  /** Pessoas ativas do público-alvo (áreas incluem os setores abaixo delas). */
  async resolveUsers(companyId: string, documentId: string): Promise<string[]> {
    const targets = await this.targets(companyId, documentId);
    const now = new Date();
    const areaIds = targets.orgNodeIds.length ? await this.access.expandWithDescendants(companyId, targets.orgNodeIds) : [];
    const [byArea, byAssignment, byGroup] = await Promise.all([
      areaIds.length ? this.prisma.user.findMany({ where: { companyId, defaultNodeId: { in: areaIds } }, select: { id: true } }) : [],
      areaIds.length
        ? this.prisma.userAreaAssignment.findMany({
            where: { companyId, orgNodeId: { in: areaIds }, AND: [{ OR: [{ validFrom: null }, { validFrom: { lte: now } }] }, { OR: [{ validUntil: null }, { validUntil: { gte: now } }] }] },
            select: { userId: true },
          })
        : [],
      targets.groupIds.length
        ? this.prisma.documentAccessGroupUser.findMany({
            where: { groupId: { in: (await this.prisma.documentAccessGroup.findMany({ where: { id: { in: targets.groupIds }, companyId, active: true, deletedAt: null }, select: { id: true } })).map((group) => group.id) } },
            select: { userId: true },
          })
        : [],
    ]);
    const candidates = [...new Set([...targets.userIds, ...byArea.map((row) => row.id), ...byAssignment.map((row) => row.userId), ...byGroup.map((row) => row.userId)])];
    if (!candidates.length) return [];
    const active = await this.prisma.user.findMany({ where: { id: { in: candidates }, companyId, deletedAt: null, active: true, status: 'ACTIVE' }, select: { id: true } });
    return active.map((user) => user.id);
  }

  /** Grava o público-alvo e a regra de leitura; se já publicado, distribui na hora. */
  async setDistribution(me: AuthPayload, doc: any, body: any) {
    const userIds = ids(body?.userIds);
    const orgNodeIds = ids(body?.orgNodeIds);
    const groupIds = ids(body?.groupIds);
    const readRequired = Boolean(body?.readRequired);
    const days = body?.readDueDays === null || body?.readDueDays === '' || body?.readDueDays === undefined ? null : Number(body.readDueDays);
    if (days !== null && (!Number.isFinite(days) || days < 1 || days > 180)) throw new BadRequestException('Prazo de leitura deve ficar entre 1 e 180 dias.');
    if (readRequired && !userIds.length && !orgNodeIds.length && !groupIds.length) {
      throw new BadRequestException('Escolha quem deve ler: pessoas, áreas ou grupos.');
    }
    const [users, nodes, groups] = await Promise.all([
      userIds.length ? this.prisma.user.count({ where: { id: { in: userIds }, companyId: me.companyId, deletedAt: null } }) : 0,
      orgNodeIds.length ? this.prisma.orgNode.count({ where: { id: { in: orgNodeIds }, companyId: me.companyId, deletedAt: null } }) : 0,
      groupIds.length ? this.prisma.documentAccessGroup.count({ where: { id: { in: groupIds }, companyId: me.companyId, deletedAt: null } }) : 0,
    ]);
    if (users !== userIds.length || nodes !== orgNodeIds.length || groups !== groupIds.length) {
      throw new BadRequestException('Há pessoas, áreas ou grupos que não pertencem a esta empresa.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.documentDistribution.deleteMany({ where: { companyId: me.companyId, documentId: doc.id, versionId: null } });
      const rows: Prisma.DocumentDistributionCreateManyInput[] = [
        ...userIds.map((userId) => ({ companyId: me.companyId, documentId: doc.id, userId, createdById: me.sub })),
        ...orgNodeIds.map((orgNodeId) => ({ companyId: me.companyId, documentId: doc.id, orgNodeId, createdById: me.sub })),
        ...groupIds.map((groupId) => ({ companyId: me.companyId, documentId: doc.id, groupId, createdById: me.sub })),
      ];
      if (rows.length) await tx.documentDistribution.createMany({ data: rows });
      await tx.document.update({ where: { id: doc.id }, data: { readRequired, readDueDays: days } });
      await tx.documentAuditLog.create({
        data: {
          companyId: me.companyId,
          documentId: doc.id,
          userId: me.sub,
          action: 'DISTRIBUTION_UPDATED',
          afterValue: { readRequired, readDueDays: days, userIds, orgNodeIds, groupIds } as Prisma.InputJsonValue,
          reason: 'Distribuição e leitura obrigatória',
        },
      });
    });
    const created = readRequired && PUBLISHED_LIKE.includes(doc.status) ? await this.syncAssignments(me.companyId, doc.id) : 0;
    return { readRequired, readDueDays: days, assigned: created };
  }

  /** Revisão vigente (última publicada) do documento. */
  async currentPublishedVersion(companyId: string, documentId: string) {
    return this.prisma.documentVersion.findFirst({
      where: { companyId, documentId, deletedAt: null, publicationDate: { not: null }, status: { in: [...PUBLISHED_LIKE] } },
      orderBy: { revisionNumber: 'desc' },
    });
  }

  /** Cria as leituras pendentes que faltam para a revisão vigente. */
  async syncAssignments(companyId: string, documentId: string, options: { notify?: boolean } = {}): Promise<number> {
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, companyId, deletedAt: null } });
    if (!doc || !doc.readRequired || !PUBLISHED_LIKE.includes(doc.status)) return 0;
    const version = await this.currentPublishedVersion(companyId, documentId);
    if (!version) return 0;
    const users = await this.resolveUsers(companyId, documentId);
    if (!users.length) return 0;
    const existing = await this.prisma.documentReadConfirmation.findMany({ where: { companyId, documentId, versionId: version.id, userId: { in: users } }, select: { userId: true } });
    const known = new Set(existing.map((row) => row.userId));
    const missing = users.filter((userId) => !known.has(userId));
    if (!missing.length) return 0;
    const base = version.publicationDate && version.publicationDate > addDays(new Date(), -1) ? version.publicationDate : new Date();
    const dueAt = addDays(base, doc.readDueDays ?? DEFAULT_READ_DAYS);
    await this.prisma.documentReadConfirmation.createMany({
      data: missing.map((userId) => ({ companyId, documentId, versionId: version.id, userId, status: 'PENDING', dueAt })),
    });
    if (options.notify !== false) {
      for (const userId of missing) {
        try {
          await this.notifications.create(
            companyId,
            userId,
            NotificationKind.MESSAGE,
            `Leitura obrigatória: ${label(doc)}`.slice(0, 180),
            `Leia "${doc.title}" (${version.versionLabel}) e confirme até ${dueAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
            `/documents/${doc.id}/leitor`,
          );
        } catch (error) {
          this.logger.warn(`Aviso de leitura não enviado: ${(error as Error).message}`);
        }
      }
    }
    this.workItems.markDirty(companyId, missing, 'document-read-assigned');
    return missing.length;
  }

  /** Confirmação de leitura da revisão vigente pelo próprio usuário. */
  async confirm(me: AuthPayload, doc: any, context: { ip?: string; userAgent?: string } = {}) {
    if (!PUBLISHED_LIKE.includes(doc.status)) throw new ConflictException('Só é possível confirmar a leitura de um documento vigente.');
    const version = await this.currentPublishedVersion(me.companyId, doc.id);
    if (!version) throw new ConflictException('Este documento ainda não tem revisão publicada.');
    const now = new Date();
    const existing = await this.prisma.documentReadConfirmation.findFirst({
      where: { companyId: me.companyId, documentId: doc.id, versionId: version.id, userId: me.sub },
      orderBy: { readAt: 'desc' },
    });
    const row = existing
      ? existing.status === 'CONFIRMED'
        ? existing
        : await this.prisma.documentReadConfirmation.update({ where: { id: existing.id }, data: { status: 'CONFIRMED', confirmedAt: now, readAt: now } })
      : await this.prisma.documentReadConfirmation.create({
          data: { companyId: me.companyId, documentId: doc.id, versionId: version.id, userId: me.sub, status: 'CONFIRMED', confirmedAt: now, readAt: now },
        });
    if (row !== existing) {
      await this.prisma.documentAuditLog.create({
        data: {
          companyId: me.companyId,
          documentId: doc.id,
          versionId: version.id,
          userId: me.sub,
          action: 'READ_CONFIRMED',
          afterValue: { versionLabel: version.versionLabel } as Prisma.InputJsonValue,
          reason: 'Leitura confirmada',
          ip: context.ip ?? null,
          userAgent: context.userAgent?.slice(0, 500) ?? null,
        },
      });
      this.workItems.markDirty(me.companyId, [me.sub], 'document-read-confirmed');
    }
    return { id: row.id, versionId: version.id, versionLabel: version.versionLabel, confirmedAt: row.confirmedAt };
  }

  /** Situação da distribuição da revisão vigente: quem leu, quem falta e atrasos. */
  async summary(companyId: string, doc: any, viewerId?: string) {
    const [targets, version] = await Promise.all([this.targets(companyId, doc.id), this.currentPublishedVersion(companyId, doc.id)]);
    const rows = version
      ? await this.prisma.documentReadConfirmation.findMany({ where: { companyId, documentId: doc.id, versionId: version.id }, orderBy: [{ status: 'asc' }, { confirmedAt: 'desc' }], take: 2000 })
      : [];
    const userIds = [...new Set([...rows.map((row) => row.userId), ...targets.userIds])];
    const [users, nodes, groups] = await Promise.all([
      userIds.length ? this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, defaultNodeId: true } }) : [],
      targets.orgNodeIds.length ? this.prisma.orgNode.findMany({ where: { id: { in: targets.orgNodeIds } }, select: { id: true, name: true } }) : [],
      targets.groupIds.length ? this.prisma.documentAccessGroup.findMany({ where: { id: { in: targets.groupIds } }, select: { id: true, name: true } }) : [],
    ]);
    const byId = new Map(users.map((user) => [user.id, user]));
    const now = new Date();
    const confirmed = rows.filter((row) => row.status === 'CONFIRMED' || row.status === 'READ');
    const pending = rows.filter((row) => row.status === 'PENDING');
    const mine = viewerId ? rows.find((row) => row.userId === viewerId) ?? null : null;
    return {
      readRequired: doc.readRequired,
      readDueDays: doc.readDueDays ?? DEFAULT_READ_DAYS,
      targets: {
        users: targets.userIds.map((id) => byId.get(id) ?? { id, name: 'Usuário', email: '' }),
        orgNodes: nodes,
        groups,
      },
      versionId: version?.id ?? null,
      versionLabel: version?.versionLabel ?? null,
      total: rows.length,
      confirmed: confirmed.length,
      pending: pending.length,
      overdue: pending.filter((row) => row.dueAt && row.dueAt < now).length,
      adhesion: rows.length ? Math.round((confirmed.length / rows.length) * 100) : null,
      confirmedUsers: confirmed.slice(0, 500).map((row) => ({ id: row.userId, name: byId.get(row.userId)?.name ?? 'Usuário', confirmedAt: row.confirmedAt ?? row.readAt })),
      pendingUsers: pending.slice(0, 500).map((row) => ({ id: row.userId, name: byId.get(row.userId)?.name ?? 'Usuário', dueAt: row.dueAt, overdue: Boolean(row.dueAt && row.dueAt < now) })),
      mine: mine ? { status: mine.status, dueAt: mine.dueAt, confirmedAt: mine.confirmedAt } : null,
    };
  }

  /** Leituras pendentes do usuário (Meu Dia e caixa do GED). */
  async pendingFor(companyId: string, userId: string) {
    return this.prisma.documentReadConfirmation.findMany({
      where: { companyId, userId, status: 'PENDING', document: { deletedAt: null, status: { in: [...PUBLISHED_LIKE] } } },
      include: { document: { select: { id: true, code: true, number: true, title: true, status: true, orgNodeId: true, createdAt: true, updatedAt: true } } },
      orderBy: { dueAt: 'asc' },
      take: 300,
    });
  }

  /** Lembretes de leitura e resumo de atrasos ao responsável (rotina diária). */
  async reminders(companyId: string) {
    const now = new Date();
    const yesterday = addDays(now, -1);
    const rows = await this.prisma.documentReadConfirmation.findMany({
      where: {
        companyId,
        status: 'PENDING',
        dueAt: { lte: addDays(now, 1) },
        OR: [{ remindedAt: null }, { remindedAt: { lt: yesterday } }],
        document: { deletedAt: null, status: { in: [...PUBLISHED_LIKE] } },
      },
      include: { document: { select: { id: true, code: true, number: true, title: true, ownerUserId: true, createdById: true } } },
      take: 1000,
    });
    const overdueByDoc = new Map<string, { doc: (typeof rows)[number]['document']; count: number }>();
    for (const row of rows) {
      const overdue = Boolean(row.dueAt && row.dueAt < now);
      try {
        await this.notifications.create(
          companyId,
          row.userId,
          NotificationKind.MESSAGE,
          `${overdue ? 'Leitura atrasada' : 'Leitura vence amanhã'}: ${label(row.document)}`.slice(0, 180),
          `Confirme a leitura de "${row.document.title}".`,
          `/documents/${row.document.id}/leitor`,
        );
      } catch (error) {
        this.logger.warn(`Lembrete de leitura não enviado: ${(error as Error).message}`);
      }
      if (overdue) {
        const entry = overdueByDoc.get(row.documentId) ?? { doc: row.document, count: 0 };
        entry.count++;
        overdueByDoc.set(row.documentId, entry);
      }
    }
    if (rows.length) await this.prisma.documentReadConfirmation.updateMany({ where: { id: { in: rows.map((row) => row.id) } }, data: { remindedAt: now } });
    for (const { doc, count } of overdueByDoc.values()) {
      const owner = doc.ownerUserId ?? doc.createdById;
      if (!owner) continue;
      try {
        await this.notifications.create(companyId, owner, NotificationKind.MESSAGE, `Leituras atrasadas: ${label(doc)}`.slice(0, 180), `${count} pessoa(s) ainda não confirmaram a leitura de "${doc.title}".`, `/documents/${doc.id}`);
      } catch {
        // aviso ao responsável é best-effort
      }
    }
    return rows.length;
  }

  /** Recalcula as leituras de todos os documentos com leitura obrigatória. */
  async syncAll(companyId: string): Promise<number> {
    const docs = await this.prisma.document.findMany({ where: { companyId, deletedAt: null, readRequired: true, status: { in: [...PUBLISHED_LIKE] } }, select: { id: true }, take: 2000 });
    let created = 0;
    for (const doc of docs) created += await this.syncAssignments(companyId, doc.id);
    return created;
  }

  /** Adesão por documento (painel de leituras do GED). */
  async adhesion(companyId: string, documentIds: string[]) {
    if (!documentIds.length) return [];
    const rows = await this.prisma.documentReadConfirmation.groupBy({
      by: ['documentId', 'status'],
      where: { companyId, documentId: { in: documentIds }, status: { in: ['PENDING', 'CONFIRMED'] }, document: { status: { in: [...PUBLISHED_LIKE] } } },
      _count: { _all: true },
    });
    const map = new Map<string, { confirmed: number; pending: number }>();
    for (const row of rows) {
      const entry = map.get(row.documentId) ?? { confirmed: 0, pending: 0 };
      if (row.status === 'CONFIRMED') entry.confirmed += row._count._all;
      else entry.pending += row._count._all;
      map.set(row.documentId, entry);
    }
    return [...map.entries()].map(([documentId, value]) => ({
      documentId,
      ...value,
      adhesion: value.confirmed + value.pending ? Math.round((value.confirmed / (value.confirmed + value.pending)) * 100) : null,
    }));
  }
}

export const READ_STATUS = { PENDING: 'PENDING', CONFIRMED: 'CONFIRMED' } as const;
export const DISTRIBUTION_STATUSES = [DocumentStatus.PUBLISHED];
