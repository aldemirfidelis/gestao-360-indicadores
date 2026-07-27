import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CommAudienceKind,
  CommPostLayout,
  CommPostStatus,
  NotificationKind,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { AuditWriterService } from '../../../common/audit/audit-writer.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { swallow } from '../../../common/logging/swallow';
import { buildTransport, resolveSmtpConfig, smtpFrom } from '../../../common/smtp';
import { CommunicationAudienceService, type AudienceSelection } from './audience.service';
import { CommunicationSettingsService } from './communication-settings.service';

/** Rota da area do colaborador — usada em notificacoes e QR code. */
export const EMPLOYEE_FEED_PATH = '/servico-pessoal/comunicacao-interna';

const LAYOUTS = Object.values(CommPostLayout);

/** Status expostos na nova interface (o enum tem valores legados). */
const VISIBLE_STATUSES: CommPostStatus[] = [
  CommPostStatus.DRAFT,
  CommPostStatus.PENDING_APPROVAL,
  CommPostStatus.REJECTED,
  CommPostStatus.SCHEDULED,
  CommPostStatus.PUBLISHED,
  CommPostStatus.EXPIRED,
  CommPostStatus.ARCHIVED,
];

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  PENDING_APPROVAL: 'Aguardando aprovação',
  APPROVED: 'Aprovada',
  REJECTED: 'Devolvida',
  SCHEDULED: 'Programada',
  PUBLISHED: 'Publicada',
  EXPIRED: 'Encerrada',
  ARCHIVED: 'Arquivada',
  CANCELLED: 'Cancelada',
};

export interface PublicationInput {
  title?: string;
  summary?: string;
  content?: string;
  categoryId?: string | null;
  layout?: CommPostLayout;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  galleryMediaIds?: string[];
  attachmentMediaIds?: string[];
  audience?: AudienceSelection[];
  publishAt?: string | null;
  expiresAt?: string | null;
  isFeatured?: boolean;
  isPinned?: boolean;
  requiresReadConfirmation?: boolean;
  notifyInApp?: boolean;
  notifyEmail?: boolean;
  allowAttachmentDownload?: boolean;
  showInEmployeeFeed?: boolean;
  actionLabel?: string | null;
  actionUrl?: string | null;
  actionNewTab?: boolean;
  isImportant?: boolean;
}

/** Colunas simples aceitas tanto no create quanto no update da publicacao. */
type PublicationScalars = Partial<
  Omit<
    Prisma.CommunicationPostUncheckedCreateInput,
    | 'id'
    | 'companyId'
    | 'authorId'
    | 'audience'
    | 'channels'
    | 'history'
    | 'audienceRules'
    | 'mediaLinks'
    | 'recipients'
    | 'reads'
    | 'reactions'
    | 'comments'
    | 'pollResponses'
  >
>;

const DETAIL_INCLUDE = {
  categoryRef: { select: { id: true, name: true, color: true } },
  audienceRules: true,
  mediaLinks: { include: { media: true }, orderBy: { position: 'asc' as const } },
} satisfies Prisma.CommunicationPostInclude;

@Injectable()
export class PublicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audience: CommunicationAudienceService,
    private readonly settings: CommunicationSettingsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditWriterService,
  ) {}

  // =========================================================================
  // Visao geral
  // =========================================================================

  /**
   * Indicadores reais da tela inicial: publicacoes ativas, programadas,
   * visualizacoes do mes e confirmacoes pendentes. Sem card decorativo.
   */
  async overview(me: AuthPayload) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const base = { companyId: me.companyId, deletedAt: null } as const;

    const [active, scheduled, viewsThisMonth, pendingConfirmations, recent, upcoming, settings] = await Promise.all([
      this.prisma.communicationPost.count({ where: { ...base, status: CommPostStatus.PUBLISHED } }),
      this.prisma.communicationPost.count({ where: { ...base, status: CommPostStatus.SCHEDULED } }),
      this.prisma.communicationPostRead.count({
        where: { viewedAt: { gte: monthStart }, post: { ...base } },
      }),
      this.pendingConfirmationCount(me.companyId),
      this.prisma.communicationPost.findMany({
        where: { ...base, status: { in: [CommPostStatus.PUBLISHED, CommPostStatus.EXPIRED] } },
        include: DETAIL_INCLUDE,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      }),
      this.prisma.communicationPost.findMany({
        where: { ...base, status: CommPostStatus.SCHEDULED },
        include: DETAIL_INCLUDE,
        orderBy: { publishAt: 'asc' },
        take: 8,
      }),
      this.settings.settings(me.companyId),
    ]);

    const [recentRows, upcomingRows] = await Promise.all([
      this.withCounters(recent),
      this.withCounters(upcoming),
    ]);

    return {
      metrics: { active, scheduled, viewsThisMonth, pendingConfirmations },
      recent: recentRows,
      scheduledPosts: upcomingRows,
      settings: { approvalRequired: settings.approvalRequired },
    };
  }

  // =========================================================================
  // Listagem e detalhe
  // =========================================================================

  async list(
    me: AuthPayload,
    query: {
      search?: string;
      status?: string;
      categoryId?: string;
      authorId?: string;
      from?: string;
      to?: string;
      audienceRefId?: string;
      take?: string;
      skip?: string;
    },
  ) {
    const where: Prisma.CommunicationPostWhereInput = { companyId: me.companyId, deletedAt: null };
    if (query.search?.trim()) where.title = { contains: query.search.trim(), mode: 'insensitive' };
    if (query.status && VISIBLE_STATUSES.includes(query.status as CommPostStatus)) {
      where.status = query.status as CommPostStatus;
    } else {
      where.status = { in: VISIBLE_STATUSES };
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.authorId) where.authorId = query.authorId;
    if (query.audienceRefId) {
      where.audienceRules = {
        some: query.audienceRefId === 'ALL' ? { kind: CommAudienceKind.ALL } : { refId: query.audienceRefId },
      };
    }
    const from = this.toDate(query.from);
    const to = this.toDate(query.to);
    if (from || to) {
      where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    }

    const take = Math.min(Math.max(Number(query.take ?? 50) || 50, 1), 200);
    const skip = Math.max(Number(query.skip ?? 0) || 0, 0);
    const [rows, total] = await Promise.all([
      this.prisma.communicationPost.findMany({
        where,
        include: DETAIL_INCLUDE,
        orderBy: [{ createdAt: 'desc' }],
        take,
        skip,
      }),
      this.prisma.communicationPost.count({ where }),
    ]);
    return { total, items: await this.withCounters(rows) };
  }

  async detail(me: AuthPayload, id: string) {
    const post = await this.prisma.communicationPost.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: DETAIL_INCLUDE,
    });
    if (!post) throw new NotFoundException('Publicação não encontrada.');
    const [row] = await this.withCounters([post]);
    const names = await this.userNames([post.authorId, post.approverId, post.publishedById]);
    return {
      ...row!,
      authorName: names.get(post.authorId) ?? 'Usuário',
      approverName: post.approverId ? names.get(post.approverId) ?? null : null,
      history: Array.isArray(post.history) ? post.history : [],
      approvalComment: post.approvalComment,
    };
  }

  // =========================================================================
  // Escrita
  // =========================================================================

  async create(me: AuthPayload, body: PublicationInput) {
    const settings = await this.settings.settings(me.companyId);
    // O destino padrão (feed do colaborador) é uma configuração da empresa.
    const data = await this.buildData(
      me,
      { showInEmployeeFeed: settings.defaultEmployeeFeed, ...body },
      null,
    );
    const now = new Date();

    const created = await this.prisma.communicationPost.create({
      data: {
        ...data.scalars,
        title: this.required(body.title, 'Informe o título da publicação.'),
        content: this.required(body.content, 'Informe o conteúdo da publicação.'),
        companyId: me.companyId,
        authorId: me.sub,
        status: CommPostStatus.DRAFT,
        audience: data.legacyAudience,
        channels: data.channels,
        history: [{ at: now.toISOString(), by: me.name ?? me.sub, action: 'Criada' }] as unknown as Prisma.InputJsonValue,
        qrCodeValue: `${EMPLOYEE_FEED_PATH}?post=`,
        audienceRules: { create: data.audienceRules },
        mediaLinks: { create: data.mediaLinks },
      },
      select: { id: true },
    });
    await this.prisma.communicationPost.update({
      where: { id: created.id },
      data: { qrCodeValue: `${EMPLOYEE_FEED_PATH}?post=${created.id}` },
    });
    await this.audit.record(me, {
      action: 'CREATE',
      module: 'Comunicação',
      entity: 'CommunicationPost',
      entityId: created.id,
      message: data.scalars.title,
      after: { title: data.scalars.title, approvalRequired: settings.approvalRequired },
    });
    return this.detail(me, created.id);
  }

  async update(me: AuthPayload, id: string, body: PublicationInput) {
    const post = await this.assertEditable(me, id);
    const data = await this.buildData(me, body, post);

    await this.prisma.$transaction(async (tx) => {
      if (body.audience !== undefined) {
        await tx.communicationPostAudience.deleteMany({ where: { postId: id } });
        if (data.audienceRules.length > 0) {
          await tx.communicationPostAudience.createMany({
            data: data.audienceRules.map((rule) => ({ ...rule, postId: id })),
            skipDuplicates: true,
          });
        }
      }
      if (body.galleryMediaIds !== undefined || body.attachmentMediaIds !== undefined) {
        await tx.communicationPostMedia.deleteMany({ where: { postId: id } });
        if (data.mediaLinks.length > 0) {
          await tx.communicationPostMedia.createMany({
            data: data.mediaLinks.map((link) => ({ ...link, postId: id })),
            skipDuplicates: true,
          });
        }
      }
      await tx.communicationPost.update({
        where: { id },
        data: {
          ...data.scalars,
          audience: data.legacyAudience,
          channels: data.channels,
          updatedById: me.sub,
          // Publicação devolvida pelo aprovador volta a rascunho ao ser ajustada.
          ...(post.status === CommPostStatus.REJECTED ? { status: CommPostStatus.DRAFT, approvalComment: null } : {}),
          version: post.status === CommPostStatus.PUBLISHED ? { increment: 1 } : undefined,
          history: this.appendHistory(post.history, me, 'Editada'),
        },
      });
    });

    // Publicacao ativa: o publico pode ter mudado, reflete nos destinatarios.
    if (post.status === CommPostStatus.PUBLISHED && body.audience !== undefined) {
      await this.materializeRecipients(me.companyId, id);
    }

    await this.audit.record(me, {
      action: 'UPDATE',
      module: 'Comunicação',
      entity: 'CommunicationPost',
      entityId: id,
      message: data.scalars.title ?? post.title,
      before: { title: post.title, status: post.status },
      after: { title: data.scalars.title ?? post.title },
    });
    return this.detail(me, id);
  }

  /** Duplicar sempre gera um rascunho novo, sem leituras nem destinatarios. */
  async duplicate(me: AuthPayload, id: string) {
    const post = await this.prisma.communicationPost.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: { audienceRules: true, mediaLinks: true },
    });
    if (!post) throw new NotFoundException('Publicação não encontrada.');

    const created = await this.prisma.communicationPost.create({
      data: {
        companyId: me.companyId,
        authorId: me.sub,
        title: `${post.title} (cópia)`,
        subtitle: post.subtitle,
        content: post.content,
        categoryId: post.categoryId,
        category: post.category,
        layout: post.layout,
        priority: post.priority,
        status: CommPostStatus.DRAFT,
        audience: post.audience as Prisma.InputJsonValue,
        channels: post.channels as Prisma.InputJsonValue,
        coverImageUrl: post.coverImageUrl,
        coverImageAlt: post.coverImageAlt,
        actionUrl: post.actionUrl,
        actionLabel: post.actionLabel,
        actionNewTab: post.actionNewTab,
        requiresReadConfirmation: post.requiresReadConfirmation,
        allowAttachmentDownload: post.allowAttachmentDownload,
        showInEmployeeFeed: post.showInEmployeeFeed,
        notifyInApp: post.notifyInApp,
        notifyEmail: post.notifyEmail,
        isFeatured: post.isFeatured,
        isPinned: post.isPinned,
        isMandatory: post.isMandatory,
        expiresAt: null,
        publishAt: null,
        history: [{ at: new Date().toISOString(), by: me.name ?? me.sub, action: 'Duplicada', note: post.title }] as unknown as Prisma.InputJsonValue,
        audienceRules: { create: post.audienceRules.map((rule) => ({ kind: rule.kind, refId: rule.refId })) },
        mediaLinks: { create: post.mediaLinks.map((link) => ({ mediaId: link.mediaId, role: link.role, position: link.position, alt: link.alt })) },
      },
      select: { id: true },
    });
    await this.prisma.communicationPost.update({
      where: { id: created.id },
      data: { qrCodeValue: `${EMPLOYEE_FEED_PATH}?post=${created.id}` },
    });
    await this.audit.record(me, { action: 'DUPLICATE', module: 'Comunicação', entity: 'CommunicationPost', entityId: created.id, message: post.title });
    return this.detail(me, created.id);
  }

  /**
   * Transicoes de status. Publicar materializa os destinatarios e dispara as
   * notificacoes; agendar apenas guarda a data (o sweep publica na hora certa).
   */
  async changeStatus(
    me: AuthPayload,
    id: string,
    body: { status?: CommPostStatus; comment?: string; publishAt?: string | null },
  ) {
    const post = await this.prisma.communicationPost.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!post) throw new NotFoundException('Publicação não encontrada.');
    const target = body.status;
    if (!target || !VISIBLE_STATUSES.includes(target)) throw new BadRequestException('Status inválido.');

    const settings = await this.settings.settings(me.companyId);
    const now = new Date();
    const data: Prisma.CommunicationPostUpdateInput = { status: target, updatedById: me.sub };

    if (target === CommPostStatus.PENDING_APPROVAL) {
      if (!settings.approvalRequired) throw new BadRequestException('O fluxo de aprovação não está habilitado para esta empresa.');
      await this.assertReady(post);
    }

    if (target === CommPostStatus.PUBLISHED || target === CommPostStatus.SCHEDULED) {
      await this.assertReady(post);
      if (settings.approvalRequired && post.status === CommPostStatus.PENDING_APPROVAL) {
        throw new BadRequestException('Esta publicação ainda aguarda aprovação.');
      }
      if (settings.approvalRequired && post.status === CommPostStatus.DRAFT) {
        throw new BadRequestException('Envie a publicação para aprovação antes de publicar.');
      }
    }

    if (target === CommPostStatus.SCHEDULED) {
      const publishAt = this.toDate(body.publishAt ?? this.iso(post.publishAt));
      if (!publishAt) throw new BadRequestException('Informe a data e a hora do agendamento.');
      if (publishAt.getTime() <= now.getTime()) throw new BadRequestException('O agendamento precisa ser no futuro.');
      data.publishAt = publishAt;
    }

    if (target === CommPostStatus.PUBLISHED) {
      data.publishedAt = post.publishedAt ?? now;
      data.publishedById = post.publishedById ?? me.sub;
      data.publishAt = post.publishAt ?? now;
    }

    if (target === CommPostStatus.ARCHIVED) data.archivedAt = now;
    if (target === CommPostStatus.EXPIRED && !post.expiresAt) data.expiresAt = now;
    if (target === CommPostStatus.REJECTED) {
      if (!body.comment?.trim()) throw new BadRequestException('Informe o motivo da devolução.');
      data.approverId = me.sub;
      data.approvalComment = body.comment.trim();
    }
    if (target === CommPostStatus.PUBLISHED && settings.approvalRequired) data.approverId = post.approverId ?? me.sub;

    data.history = this.appendHistory(post.history, me, STATUS_LABEL[target] ?? target, body.comment);
    await this.prisma.communicationPost.update({ where: { id }, data });

    if (target === CommPostStatus.PUBLISHED) {
      await this.materializeRecipients(me.companyId, id);
      await this.notifyRecipients(me.companyId, id);
    }
    if (target === CommPostStatus.ARCHIVED || target === CommPostStatus.EXPIRED) {
      // Sai do banner de destaque assim que encerra/arquiva.
      await this.prisma.communicationPost.update({ where: { id }, data: { isFeatured: false, isPinned: false } });
    }

    await this.audit.record(me, {
      action: `STATUS_${target}`,
      module: 'Comunicação',
      entity: 'CommunicationPost',
      entityId: id,
      message: post.title,
      before: { status: post.status },
      after: { status: target },
    });
    return this.detail(me, id);
  }

  async remove(me: AuthPayload, id: string) {
    const post = await this.prisma.communicationPost.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!post) throw new NotFoundException('Publicação não encontrada.');
    await this.prisma.communicationPost.update({ where: { id }, data: { deletedAt: new Date(), updatedById: me.sub } });
    await this.audit.record(me, { action: 'DELETE', module: 'Comunicação', entity: 'CommunicationPost', entityId: id, message: post.title });
    return { deleted: true };
  }

  // =========================================================================
  // Metricas
  // =========================================================================

  /** Metricas da publicacao + quem visualizou, quem falta e quem confirmou. */
  async metrics(me: AuthPayload, id: string) {
    const post = await this.prisma.communicationPost.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      select: { id: true, title: true, requiresReadConfirmation: true, publishedAt: true },
    });
    if (!post) throw new NotFoundException('Publicação não encontrada.');

    const [recipients, reads] = await Promise.all([
      this.prisma.communicationPostRecipient.findMany({ where: { postId: id }, select: { userId: true } }),
      this.prisma.communicationPostRead.findMany({
        where: { postId: id },
        select: { userId: true, viewedAt: true, confirmedAt: true },
      }),
    ]);

    const recipientIds = recipients.map((r) => r.userId);
    const readBy = new Map(reads.map((read) => [read.userId, read]));
    const users = await this.prisma.user.findMany({
      where: { id: { in: Array.from(new Set([...recipientIds, ...reads.map((r) => r.userId)])) } },
      select: { id: true, name: true, email: true, defaultNode: { select: { name: true } } },
    });
    const userById = new Map(users.map((user) => [user.id, user]));

    const people = recipientIds.map((userId) => {
      const user = userById.get(userId);
      const read = readBy.get(userId);
      return {
        userId,
        name: user?.name ?? 'Usuário',
        email: user?.email ?? '',
        area: user?.defaultNode?.name ?? null,
        viewedAt: read?.viewedAt ?? null,
        confirmedAt: read?.confirmedAt ?? null,
      };
    });

    const total = people.length;
    const viewed = people.filter((person) => person.viewedAt).length;
    const confirmed = people.filter((person) => person.confirmedAt).length;

    return {
      post: { id: post.id, title: post.title, requiresReadConfirmation: post.requiresReadConfirmation, publishedAt: post.publishedAt },
      summary: {
        audienceTotal: total,
        reached: total,
        views: viewed,
        notViewed: Math.max(0, total - viewed),
        confirmations: confirmed,
        pendingConfirmations: post.requiresReadConfirmation ? Math.max(0, total - confirmed) : 0,
        readRate: total ? viewed / total : 0,
        confirmationRate: post.requiresReadConfirmation && total ? confirmed / total : 0,
      },
      people: people.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  /** CSV das pessoas da publicacao (abre no Excel; separador ponto e virgula). */
  async exportMetricsCsv(me: AuthPayload, id: string): Promise<{ fileName: string; csv: string }> {
    const data = await this.metrics(me, id);
    const header = ['Colaborador', 'E-mail', 'Área', 'Visualizou', 'Data da visualização', 'Confirmou', 'Data da confirmação'];
    const lines = data.people.map((person) =>
      [
        person.name,
        person.email,
        person.area ?? '',
        person.viewedAt ? 'Sim' : 'Não',
        person.viewedAt ? new Date(person.viewedAt).toLocaleString('pt-BR') : '',
        person.confirmedAt ? 'Sim' : 'Não',
        person.confirmedAt ? new Date(person.confirmedAt).toLocaleString('pt-BR') : '',
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(';'),
    );
    const csv = ['﻿' + header.join(';'), ...lines].join('\r\n');
    const slug = data.post.title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 40);
    return { fileName: `comunicacao-${slug || 'publicacao'}.csv`, csv };
  }

  // =========================================================================
  // Agendamento automatico (MaintenanceScheduler)
  // =========================================================================

  /**
   * Varredura periodica: publica o que venceu o agendamento e encerra o que
   * passou da data de encerramento (tirando do destaque).
   */
  async publicationSweep(companyId: string): Promise<{ published: number; expired: number }> {
    const now = new Date();
    const due = await this.prisma.communicationPost.findMany({
      where: { companyId, deletedAt: null, status: CommPostStatus.SCHEDULED, publishAt: { not: null, lte: now } },
      select: { id: true, title: true, history: true },
      take: 100,
    });

    for (const post of due) {
      const history = Array.isArray(post.history) ? post.history : [];
      await this.prisma.communicationPost.update({
        where: { id: post.id },
        data: {
          status: CommPostStatus.PUBLISHED,
          publishedAt: now,
          history: [
            ...history,
            { at: now.toISOString(), by: 'sistema', action: 'Publicada', note: 'Publicação automática do agendamento' },
          ] as unknown as Prisma.InputJsonValue,
        },
      });
      await this.materializeRecipients(companyId, post.id);
      await this.notifyRecipients(companyId, post.id);
    }

    const expiring = await this.prisma.communicationPost.findMany({
      where: { companyId, deletedAt: null, status: CommPostStatus.PUBLISHED, expiresAt: { not: null, lte: now } },
      select: { id: true },
      take: 200,
    });
    if (expiring.length > 0) {
      await this.prisma.communicationPost.updateMany({
        where: { id: { in: expiring.map((post) => post.id) } },
        data: { status: CommPostStatus.EXPIRED, isFeatured: false, isPinned: false },
      });
    }

    return { published: due.length, expired: expiring.length };
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  /** Snapshot de quem recebe — base do feed e das metricas. */
  private async materializeRecipients(companyId: string, postId: string) {
    const rules = await this.prisma.communicationPostAudience.findMany({ where: { postId } });
    const userIds = await this.audience.resolveUserIds(
      companyId,
      rules.map((rule) => ({ kind: rule.kind, refId: rule.refId })),
    );
    await this.prisma.$transaction([
      this.prisma.communicationPostRecipient.deleteMany({ where: { postId, userId: { notIn: userIds.length ? userIds : ['-'] } } }),
      this.prisma.communicationPostRecipient.createMany({
        data: userIds.map((userId) => ({ postId, userId })),
        skipDuplicates: true,
      }),
    ]);
    return userIds.length;
  }

  /** Notificacao interna (sempre que marcada) e e-mail (so quando marcado). */
  private async notifyRecipients(companyId: string, postId: string) {
    const post = await this.prisma.communicationPost.findUnique({
      where: { id: postId },
      select: { id: true, title: true, subtitle: true, content: true, notifyInApp: true, notifyEmail: true },
    });
    if (!post) return;

    const recipients = await this.prisma.communicationPostRecipient.findMany({
      where: { postId },
      select: { userId: true },
      take: 5000,
    });
    if (recipients.length === 0) return;
    const summary = post.subtitle?.trim() || post.content.replace(/<[^>]*>/g, ' ').slice(0, 140);
    const link = `${EMPLOYEE_FEED_PATH}?post=${post.id}`;

    if (post.notifyInApp) {
      for (const recipient of recipients) {
        await this.notifications
          .create(companyId, recipient.userId, NotificationKind.MESSAGE, `Novo comunicado: ${post.title}`, summary, link)
          .catch(swallow(undefined, 'publications.notifyRecipients', 'debug'));
      }
    }

    if (post.notifyEmail) {
      await this.sendEmailNotice(companyId, recipients.map((r) => r.userId), post.title, summary).catch(
        swallow(undefined, 'publications.notifyEmail', 'warn'),
      );
    }
  }

  private async sendEmailNotice(companyId: string, userIds: string[], title: string, summary: string) {
    const cfg = await resolveSmtpConfig(this.prisma);
    if (!cfg?.host) return;
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, deletedAt: null, active: true },
      select: { email: true },
      take: 1000,
    });
    const emails = users.map((user) => user.email).filter(Boolean);
    if (emails.length === 0) return;
    const transport = buildTransport(cfg);
    for (const email of emails) {
      await transport
        .sendMail({
          from: smtpFrom(cfg),
          to: email,
          subject: `Comunicado interno: ${title}`,
          text: `${title}\n\n${summary}\n\nAcesse o Gestão 360 em Minha Vida Funcional > Comunicação Interna para ler o comunicado completo.`,
        })
        .catch(swallow(undefined, 'publications.sendEmailNotice', 'debug'));
    }
  }

  private async pendingConfirmationCount(companyId: string) {
    const posts = await this.prisma.communicationPost.findMany({
      where: { companyId, deletedAt: null, status: CommPostStatus.PUBLISHED, requiresReadConfirmation: true },
      select: {
        _count: { select: { recipients: true } },
        reads: { where: { confirmedAt: { not: null } }, select: { id: true } },
      },
    });
    return posts.reduce((sum, post) => sum + Math.max(0, post._count.recipients - post.reads.length), 0);
  }

  /** Contadores de audiencia/visualizacao/confirmacao das listagens. */
  private async withCounters(posts: Array<Prisma.CommunicationPostGetPayload<{ include: typeof DETAIL_INCLUDE }>>) {
    if (posts.length === 0) return [];
    const ids = posts.map((post) => post.id);
    // Os rótulos de público são resolvidos em lote (uma consulta por tipo de
    // referência), e não por publicação — evita N+1 nas listagens.
    const [recipients, reads, authors, audienceLabels] = await Promise.all([
      this.prisma.communicationPostRecipient.groupBy({ by: ['postId'], where: { postId: { in: ids } }, _count: { _all: true } }),
      this.prisma.communicationPostRead.findMany({ where: { postId: { in: ids } }, select: { postId: true, confirmedAt: true } }),
      this.userNames(posts.map((post) => post.authorId)),
      this.audience.describeMany(
        posts[0]!.companyId,
        posts.map((post) => ({
          id: post.id,
          rules: post.audienceRules.map((rule) => ({ kind: rule.kind, refId: rule.refId })),
        })),
      ),
    ]);
    const audienceByPost = new Map(recipients.map((row) => [row.postId, row._count._all]));
    const viewsByPost = new Map<string, number>();
    const confirmsByPost = new Map<string, number>();
    for (const read of reads) {
      viewsByPost.set(read.postId, (viewsByPost.get(read.postId) ?? 0) + 1);
      if (read.confirmedAt) confirmsByPost.set(read.postId, (confirmsByPost.get(read.postId) ?? 0) + 1);
    }

    return posts.map((post) => {
      const audienceTotal = audienceByPost.get(post.id) ?? 0;
      const views = viewsByPost.get(post.id) ?? 0;
      const confirmations = confirmsByPost.get(post.id) ?? 0;
      return {
        id: post.id,
        title: post.title,
        summary: post.subtitle,
        content: post.content,
        status: post.status,
        statusLabel: STATUS_LABEL[post.status] ?? post.status,
        layout: post.layout,
        categoryId: post.categoryId,
        category: post.categoryRef?.name ?? post.category,
        categoryColor: post.categoryRef?.color ?? null,
        coverImageUrl: post.coverImageUrl,
        coverImageAlt: post.coverImageAlt,
        authorId: post.authorId,
        authorName: authors.get(post.authorId) ?? 'Usuário',
        publishAt: post.publishAt,
        publishedAt: post.publishedAt,
        expiresAt: post.expiresAt,
        createdAt: post.createdAt,
        isFeatured: post.isFeatured,
        isPinned: post.isPinned,
        isImportant: post.priority === 'HIGH' || post.priority === 'CRITICAL' || post.priority === 'URGENT',
        requiresReadConfirmation: post.requiresReadConfirmation,
        showInEmployeeFeed: post.showInEmployeeFeed,
        notifyInApp: post.notifyInApp,
        notifyEmail: post.notifyEmail,
        allowAttachmentDownload: post.allowAttachmentDownload,
        actionLabel: post.actionLabel,
        actionUrl: post.actionUrl,
        actionNewTab: post.actionNewTab,
        audience: post.audienceRules.map((rule) => ({ kind: rule.kind, refId: rule.refId })),
        audienceLabel: audienceLabels.get(post.id) ?? 'Sem público definido',
        audienceTotal,
        views,
        confirmations,
        gallery: post.mediaLinks
          .filter((link) => link.role === 'GALLERY')
          .map((link) => ({ id: link.mediaId, url: link.media.url, alt: link.alt, name: link.media.name })),
        attachments: post.mediaLinks
          .filter((link) => link.role === 'ATTACHMENT')
          .map((link) => ({ id: link.mediaId, url: link.media.url, name: link.media.name, sizeBytes: link.media.sizeBytes })),
      };
    });
  }

  /** Monta colunas + relacoes a partir do payload da tela. */
  private async buildData(me: AuthPayload, body: PublicationInput, current: { title: string } | null) {
    const title = body.title !== undefined ? this.required(body.title, 'Informe o título da publicação.') : current?.title;
    const audienceRules = this.audience.normalize(body.audience ?? []);

    let categoryName: string | undefined;
    if (body.categoryId !== undefined) {
      if (body.categoryId) {
        const category = await this.prisma.communicationCategory.findFirst({
          where: { id: body.categoryId, companyId: me.companyId, deletedAt: null },
          select: { name: true },
        });
        if (!category) throw new BadRequestException('Categoria inválida.');
        categoryName = category.name;
      } else {
        categoryName = 'Institucional';
      }
    }

    const layout = body.layout && LAYOUTS.includes(body.layout) ? body.layout : undefined;
    const galleryIds = Array.isArray(body.galleryMediaIds) ? body.galleryMediaIds.filter(Boolean) : [];
    const attachmentIds = Array.isArray(body.attachmentMediaIds) ? body.attachmentMediaIds.filter(Boolean) : [];
    const allMediaIds = Array.from(new Set([...galleryIds, ...attachmentIds]));
    if (allMediaIds.length > 0) {
      const found = await this.prisma.communicationMedia.count({
        where: { id: { in: allMediaIds }, companyId: me.companyId, deletedAt: null },
      });
      if (found !== allMediaIds.length) throw new BadRequestException('Alguma mídia selecionada não existe na biblioteca.');
    }

    const scalars: PublicationScalars = {
      ...(title !== undefined ? { title } : {}),
      ...(body.summary !== undefined ? { subtitle: this.clean(body.summary) } : {}),
      ...(body.content !== undefined ? { content: this.required(body.content, 'Informe o conteúdo da publicação.') } : {}),
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId || null, category: categoryName! } : {}),
      ...(layout ? { layout } : {}),
      ...(body.coverImageUrl !== undefined ? { coverImageUrl: this.clean(body.coverImageUrl) } : {}),
      ...(body.coverImageAlt !== undefined ? { coverImageAlt: this.clean(body.coverImageAlt) } : {}),
      ...(body.publishAt !== undefined ? { publishAt: this.toDate(body.publishAt) } : {}),
      ...(body.expiresAt !== undefined ? { expiresAt: this.toDate(body.expiresAt) } : {}),
      ...(body.isFeatured !== undefined ? { isFeatured: Boolean(body.isFeatured) } : {}),
      ...(body.isPinned !== undefined ? { isPinned: Boolean(body.isPinned) } : {}),
      ...(body.requiresReadConfirmation !== undefined
        ? { requiresReadConfirmation: Boolean(body.requiresReadConfirmation), isMandatory: Boolean(body.requiresReadConfirmation) }
        : {}),
      ...(body.notifyInApp !== undefined ? { notifyInApp: Boolean(body.notifyInApp) } : {}),
      ...(body.notifyEmail !== undefined ? { notifyEmail: Boolean(body.notifyEmail) } : {}),
      ...(body.allowAttachmentDownload !== undefined ? { allowAttachmentDownload: Boolean(body.allowAttachmentDownload) } : {}),
      ...(body.showInEmployeeFeed !== undefined ? { showInEmployeeFeed: Boolean(body.showInEmployeeFeed) } : {}),
      ...(body.actionLabel !== undefined ? { actionLabel: this.clean(body.actionLabel) } : {}),
      ...(body.actionUrl !== undefined ? { actionUrl: this.cleanUrl(body.actionUrl) } : {}),
      ...(body.actionNewTab !== undefined ? { actionNewTab: Boolean(body.actionNewTab) } : {}),
      ...(body.isImportant !== undefined ? { priority: body.isImportant ? 'HIGH' : 'NORMAL' } : {}),
      // Campos do modulo antigo que nao existem mais na interface.
      allowComments: false,
      allowReactions: false,
    };

    if (scalars.actionUrl && !scalars.actionLabel && body.actionLabel === undefined) {
      scalars.actionLabel = 'Saiba mais';
    }

    return {
      scalars,
      audienceRules: audienceRules.map((rule) => ({ kind: rule.kind, refId: rule.refId ?? null })),
      mediaLinks: [
        ...galleryIds.map((mediaId, index) => ({ mediaId, role: 'GALLERY' as const, position: index, alt: null })),
        ...attachmentIds.map((mediaId, index) => ({ mediaId, role: 'ATTACHMENT' as const, position: index, alt: null })),
      ],
      // `audience`/`channels` continuam preenchidos para nao quebrar registros
      // historicos que ainda leem esses Json.
      legacyAudience: {
        scope: audienceRules.some((rule) => rule.kind === 'ALL') ? 'ALL_COMPANY' : 'USERS',
        description: 'Definido em CommunicationPostAudience',
      } as unknown as Prisma.InputJsonValue,
      channels: {
        platform: body.showInEmployeeFeed !== false,
        myDay: Boolean(body.requiresReadConfirmation),
        email: Boolean(body.notifyEmail),
      } as unknown as Prisma.InputJsonValue,
    };
  }

  private async assertEditable(me: AuthPayload, id: string) {
    const post = await this.prisma.communicationPost.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!post) throw new NotFoundException('Publicação não encontrada.');
    if (post.authorId === me.sub) return post;
    if (!(await this.canEditAny(me))) {
      throw new ForbiddenException('Você só pode editar as publicações que criou.');
    }
    return post;
  }

  /** `communication:update:any` (ou manage/admin) libera editar publicação de terceiros. */
  async canEditAny(me: AuthPayload): Promise<boolean> {
    if (me.role === 'SUPER_ADMIN' || me.role === 'COMPANY_ADMIN') return true;
    const user = await this.prisma.user.findUnique({
      where: { id: me.sub },
      select: {
        permissions: { select: { permission: { select: { key: true } } } },
        accessProfile: { select: { permissions: { select: { permission: { select: { key: true } } } } } },
      },
    });
    const keys = new Set<string>();
    user?.permissions.forEach((item) => keys.add(item.permission.key));
    user?.accessProfile?.permissions.forEach((item) => keys.add(item.permission.key));
    return keys.has('communication:update:any') || keys.has('communication:manage');
  }

  /** Regras minimas para sair do rascunho. */
  private async assertReady(post: { id: string; title: string; content: string }) {
    const audienceCount = await this.prisma.communicationPostAudience.count({ where: { postId: post.id } });
    if (audienceCount === 0) throw new BadRequestException('Defina o público antes de publicar ou agendar.');
    if (!post.title?.trim()) throw new BadRequestException('Informe o título da publicação.');
    if (!post.content?.trim()) throw new BadRequestException('Informe o conteúdo da publicação.');
  }

  private async userNames(ids: Array<string | null | undefined>) {
    const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
    if (unique.length === 0) return new Map<string, string>();
    const users = await this.prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
    return new Map(users.map((user) => [user.id, user.name]));
  }

  private appendHistory(history: unknown, me: AuthPayload, action: string, note?: string | null) {
    const list = Array.isArray(history) ? history : [];
    return [...list.slice(-49), { at: new Date().toISOString(), by: me.name ?? me.sub, action, note: note ?? null }] as unknown as Prisma.InputJsonValue;
  }

  private iso(value: Date | null | undefined) {
    return value ? value.toISOString() : null;
  }

  private clean(value: unknown) {
    const text = String(value ?? '').trim();
    return text || null;
  }

  /** Aceita apenas http(s) e caminhos internos no botao de acao. */
  private cleanUrl(value: unknown) {
    const text = this.clean(value);
    if (!text) return null;
    if (/^https?:\/\//i.test(text) || text.startsWith('/')) return text;
    throw new BadRequestException('O link do botão precisa começar com http://, https:// ou /.');
  }

  private toDate(value: unknown): Date | null {
    const text = this.clean(value);
    if (!text) return null;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Data inválida.');
    return date;
  }

  private required(value: unknown, message: string) {
    const text = this.clean(value);
    if (!text) throw new BadRequestException(message);
    return text;
  }
}
