import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CommPostStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';

/**
 * Comunicacao Interna do colaborador (Minha Vida Funcional).
 *
 * A visibilidade vem exclusivamente de CommunicationPostRecipient: quem nao e
 * destinatario nao ve a publicacao, e o filtro por companyId garante que uma
 * empresa nunca enxergue conteudo de outra.
 */
@Injectable()
export class EmployeeFeedService {
  constructor(private readonly prisma: PrismaService) {}

  private feedWhere(me: AuthPayload, includeClosed: boolean): Prisma.CommunicationPostWhereInput {
    return {
      companyId: me.companyId,
      deletedAt: null,
      showInEmployeeFeed: true,
      status: includeClosed
        ? { in: [CommPostStatus.PUBLISHED, CommPostStatus.EXPIRED] }
        : CommPostStatus.PUBLISHED,
      recipients: { some: { userId: me.sub } },
    };
  }

  /** Feed + destaques + contadores de pendencia. */
  async feed(me: AuthPayload, query: { search?: string; categoryId?: string; filter?: string; take?: string; skip?: string }) {
    const now = new Date();
    const includeClosed = query.filter === 'historico';
    const where: Prisma.CommunicationPostWhereInput = this.feedWhere(me, includeClosed);

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { subtitle: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.filter === 'nao-lidos') where.reads = { none: { userId: me.sub } };
    if (query.filter === 'confirmacao') {
      where.requiresReadConfirmation = true;
      where.reads = { none: { userId: me.sub, confirmedAt: { not: null } } };
    }

    const take = Math.min(Math.max(Number(query.take ?? 12) || 12, 1), 50);
    const skip = Math.max(Number(query.skip ?? 0) || 0, 0);

    const [rows, total, featured, pendingConfirmations, unread, categories] = await Promise.all([
      this.prisma.communicationPost.findMany({
        where,
        include: this.include(me.sub),
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take,
        skip,
      }),
      this.prisma.communicationPost.count({ where }),
      this.prisma.communicationPost.findMany({
        where: {
          ...this.feedWhere(me, false),
          isFeatured: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        include: this.include(me.sub),
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        take: 5,
      }),
      this.prisma.communicationPost.count({
        where: {
          ...this.feedWhere(me, false),
          requiresReadConfirmation: true,
          reads: { none: { userId: me.sub, confirmedAt: { not: null } } },
        },
      }),
      this.prisma.communicationPost.count({
        where: { ...this.feedWhere(me, false), reads: { none: { userId: me.sub } } },
      }),
      this.categoriesInFeed(me),
    ]);

    return {
      items: rows.map((row) => this.toCard(row)),
      featured: featured.map((row) => this.toCard(row)),
      total,
      hasMore: skip + rows.length < total,
      counters: { pendingConfirmations, unread },
      categories,
    };
  }

  /** Publicacoes com confirmacao pendente — bloco "Ver pendências" e Meu Dia. */
  async pending(me: AuthPayload) {
    const rows = await this.prisma.communicationPost.findMany({
      where: {
        ...this.feedWhere(me, false),
        requiresReadConfirmation: true,
        reads: { none: { userId: me.sub, confirmedAt: { not: null } } },
      },
      include: this.include(me.sub),
      orderBy: [{ publishedAt: 'desc' }],
      take: 50,
    });
    return { items: rows.map((row) => this.toCard(row)) };
  }

  /**
   * Detalhe da publicacao. A visualizacao so e registrada aqui — ou seja,
   * quando o colaborador realmente abre o conteudo (regra da secao 8).
   */
  async open(me: AuthPayload, id: string, context: { ip?: string | null; device?: string | null }) {
    const post = await this.prisma.communicationPost.findFirst({
      where: {
        id,
        companyId: me.companyId,
        deletedAt: null,
        showInEmployeeFeed: true,
        status: { in: [CommPostStatus.PUBLISHED, CommPostStatus.EXPIRED] },
        recipients: { some: { userId: me.sub } },
      },
      include: this.include(me.sub),
    });
    if (!post) throw new NotFoundException('Comunicado não encontrado ou não destinado a você.');

    await this.prisma.communicationPostRead.upsert({
      where: { postId_userId: { postId: id, userId: me.sub } },
      create: {
        postId: id,
        userId: me.sub,
        viewedAt: new Date(),
        channel: 'Portal web',
        device: context.device ?? null,
        ip: context.ip ?? null,
      },
      update: {},
    });

    const fresh = await this.prisma.communicationPost.findUnique({ where: { id }, include: this.include(me.sub) });
    return this.toDetail(fresh!);
  }

  /**
   * Ciencia do comunicado. Registra colaborador, data/hora, empresa, unidade,
   * IP e navegador para auditoria — e nunca aceita confirmar duas vezes.
   */
  async confirm(me: AuthPayload, id: string, context: { ip?: string | null; device?: string | null }) {
    const post = await this.prisma.communicationPost.findFirst({
      where: {
        id,
        companyId: me.companyId,
        deletedAt: null,
        showInEmployeeFeed: true,
        status: { in: [CommPostStatus.PUBLISHED, CommPostStatus.EXPIRED] },
        recipients: { some: { userId: me.sub } },
      },
      select: { id: true, requiresReadConfirmation: true },
    });
    if (!post) throw new NotFoundException('Comunicado não encontrado ou não destinado a você.');
    if (!post.requiresReadConfirmation) throw new BadRequestException('Este comunicado não exige confirmação de leitura.');

    const existing = await this.prisma.communicationPostRead.findUnique({
      where: { postId_userId: { postId: id, userId: me.sub } },
      select: { confirmedAt: true },
    });
    if (existing?.confirmedAt) throw new BadRequestException('Você já confirmou a leitura deste comunicado.');

    const now = new Date();
    await this.prisma.communicationPostRead.upsert({
      where: { postId_userId: { postId: id, userId: me.sub } },
      create: {
        postId: id,
        userId: me.sub,
        viewedAt: now,
        confirmedAt: now,
        channel: 'Portal web',
        device: context.device ?? null,
        ip: context.ip ?? null,
      },
      update: { confirmedAt: now, device: context.device ?? undefined, ip: context.ip ?? undefined },
    });

    const fresh = await this.prisma.communicationPost.findUnique({ where: { id }, include: this.include(me.sub) });
    return this.toDetail(fresh!);
  }

  // ---------------------------------------------------------------- helpers

  private include(userId: string) {
    return {
      categoryRef: { select: { id: true, name: true, color: true } },
      reads: { where: { userId }, select: { viewedAt: true, confirmedAt: true } },
      mediaLinks: { include: { media: true }, orderBy: { position: 'asc' as const } },
    } satisfies Prisma.CommunicationPostInclude;
  }

  private async categoriesInFeed(me: AuthPayload) {
    const groups = await this.prisma.communicationPost.groupBy({
      by: ['categoryId'],
      where: this.feedWhere(me, false),
      _count: { _all: true },
    });
    const ids = groups.map((group) => group.categoryId).filter((id): id is string => Boolean(id));
    if (ids.length === 0) return [];
    const categories = await this.prisma.communicationCategory.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    });
    const countById = new Map(groups.map((group) => [group.categoryId, group._count._all]));
    return categories.map((category) => ({ ...category, count: countById.get(category.id) ?? 0 }));
  }

  private toCard(post: any) {
    const read = post.reads?.[0];
    return {
      id: post.id,
      title: post.title,
      summary: post.subtitle,
      layout: post.layout,
      category: post.categoryRef?.name ?? post.category,
      categoryColor: post.categoryRef?.color ?? null,
      categoryId: post.categoryId,
      coverImageUrl: post.coverImageUrl,
      coverImageAlt: post.coverImageAlt,
      publishedAt: post.publishedAt,
      expiresAt: post.expiresAt,
      isFeatured: post.isFeatured,
      isImportant: ['HIGH', 'CRITICAL', 'URGENT'].includes(post.priority),
      requiresReadConfirmation: post.requiresReadConfirmation,
      viewedAt: read?.viewedAt ?? null,
      confirmedAt: read?.confirmedAt ?? null,
      actionLabel: post.actionLabel,
      actionUrl: post.actionUrl,
      actionNewTab: post.actionNewTab,
      status: post.status,
    };
  }

  private toDetail(post: any) {
    return {
      ...this.toCard(post),
      content: post.content,
      allowAttachmentDownload: post.allowAttachmentDownload,
      gallery: (post.mediaLinks ?? [])
        .filter((link: any) => link.role === 'GALLERY')
        .map((link: any) => ({ id: link.mediaId, url: link.media.url, alt: link.alt ?? link.media.name, name: link.media.name })),
      attachments: post.allowAttachmentDownload
        ? (post.mediaLinks ?? [])
            .filter((link: any) => link.role === 'ATTACHMENT')
            .map((link: any) => ({ id: link.mediaId, url: link.media.url, name: link.media.name, sizeBytes: link.media.sizeBytes }))
        : [],
    };
  }
}
