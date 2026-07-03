import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma, UserRoleEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { HELP_CATALOG } from './help-content.data';

@Injectable()
export class HelpService implements OnModuleInit {
  private readonly logger = new Logger(HelpService.name);
  private catalogSynced = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Sincroniza o catálogo em background no boot para o Assistente (RAG)
    // já ter a base completa mesmo antes do primeiro acesso à Central de Ajuda.
    void this.ensureDefaults();
  }

  async summary(query?: string) {
    await this.ensureDefaults();
    const where = this.articleWhere(query);
    const categories = await this.prisma.helpCategory.findMany({
      where: { published: true },
      orderBy: [{ position: 'asc' }, { title: 'asc' }],
      include: {
        articles: {
          where,
          orderBy: [{ updatedAt: 'desc' }],
          select: this.articleSummarySelect,
        },
      },
    });
    const popular = await this.prisma.helpArticle.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ viewCount: 'desc' }, { updatedAt: 'desc' }],
      take: 6,
      select: this.articleSummarySelect,
    });
    return {
      categories: categories.map((category) => ({
        ...category,
        articles: category.articles.map(serializeArticleSummary),
      })),
      popular: popular.map(serializeArticleSummary),
    };
  }

  async article(slug: string) {
    await this.ensureDefaults();
    const article = await this.prisma.helpArticle.findUnique({
      where: { slug },
      include: { category: { select: { id: true, slug: true, title: true, icon: true } } },
    });
    if (!article || article.status !== 'PUBLISHED') throw new NotFoundException('Artigo de ajuda nao encontrado.');
    const updated = await this.prisma.helpArticle.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
      include: { category: { select: { id: true, slug: true, title: true, icon: true } } },
    });
    return serializeArticle(updated);
  }

  async feedback(slug: string, userId: string, input: { helpful?: boolean; comment?: string | null }) {
    const article = await this.prisma.helpArticle.findUnique({ where: { slug }, select: { id: true } });
    if (!article) throw new NotFoundException('Artigo de ajuda nao encontrado.');
    const helpful = !!input.helpful;
    await this.prisma.$transaction([
      this.prisma.helpFeedback.create({
        data: { articleId: article.id, userId, helpful, comment: input.comment?.trim() || null },
      }),
      this.prisma.helpArticle.update({
        where: { id: article.id },
        data: helpful ? { helpfulCount: { increment: 1 } } : { notHelpfulCount: { increment: 1 } },
      }),
    ]);
    return { ok: true };
  }

  async adminContent() {
    await this.ensureDefaults();
    const categories = await this.prisma.helpCategory.findMany({
      orderBy: [{ position: 'asc' }, { title: 'asc' }],
      include: { articles: { orderBy: [{ updatedAt: 'desc' }] } },
    });
    return {
      categories: categories.map((category) => ({
        ...category,
        articles: category.articles.map(serializeArticle),
      })),
    };
  }

  async upsertCategory(input: Record<string, unknown>, user: AuthPayload) {
    this.requireSuperAdmin(user);
    const title = requiredString(input.title, 'Titulo da categoria');
    const slug = slugify(optionalString(input.slug) || title);
    const data = {
      slug,
      title,
      description: optionalString(input.description),
      icon: optionalString(input.icon),
      position: Number(input.position ?? 0),
      published: input.published !== false,
    };
    if (optionalString(input.id)) {
      return this.prisma.helpCategory.update({ where: { id: String(input.id) }, data });
    }
    return this.prisma.helpCategory.create({ data });
  }

  async upsertArticle(input: Record<string, unknown>, user: AuthPayload) {
    this.requireSuperAdmin(user);
    const title = requiredString(input.title, 'Titulo do artigo');
    const body = requiredString(input.body, 'Conteudo do artigo');
    const slug = slugify(optionalString(input.slug) || title);
    const tags = normalizeJsonArray(input.tags);
    const data: Prisma.HelpArticleUncheckedCreateInput = {
      categoryId: optionalString(input.categoryId),
      slug,
      title,
      summary: optionalString(input.summary),
      body,
      tags: JSON.stringify(tags),
      roleVisibility: JSON.stringify(normalizeJsonArray(input.roleVisibility)),
      status: optionalString(input.status) || 'PUBLISHED',
      flowKey: optionalString(input.flowKey),
      updatedBy: user.sub,
    };
    if (optionalString(input.id)) {
      return this.prisma.helpArticle.update({ where: { id: String(input.id) }, data });
    }
    return this.prisma.helpArticle.create({ data });
  }

  async setArticleStatus(id: string, status: string, user: AuthPayload) {
    this.requireSuperAdmin(user);
    return this.prisma.helpArticle.update({
      where: { id },
      data: { status: status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED', updatedBy: user.sub },
    });
  }

  /**
   * Sincroniza o catálogo oficial (help-content.data.ts) com o banco.
   * Idempotente: roda uma vez por boot; upsert por slug preservando
   * contadores (views/feedback) e sem tocar em conteúdo criado pelo admin
   * com slugs próprios.
   */
  private async ensureDefaults() {
    if (this.catalogSynced) return;
    try {
      const catalogArticleSlugs = new Set<string>();
      for (const category of HELP_CATALOG) {
        const categoryData = {
          title: category.title,
          description: category.description,
          icon: category.icon,
          position: category.position,
          published: true,
        };
        const savedCategory = await this.prisma.helpCategory.upsert({
          where: { slug: category.slug },
          update: categoryData,
          create: { slug: category.slug, ...categoryData },
        });
        for (const article of category.articles) {
          catalogArticleSlugs.add(article.slug);
          const tags = JSON.stringify(article.tags);
          const existing = await this.prisma.helpArticle.findUnique({
            where: { slug: article.slug },
            select: { id: true, categoryId: true, title: true, summary: true, body: true, tags: true, status: true },
          });
          if (!existing) {
            await this.prisma.helpArticle.create({
              data: {
                categoryId: savedCategory.id,
                slug: article.slug,
                title: article.title,
                summary: article.summary,
                body: article.body,
                tags,
                status: 'PUBLISHED',
              },
            });
            continue;
          }
          const unchanged =
            existing.categoryId === savedCategory.id &&
            existing.title === article.title &&
            existing.summary === article.summary &&
            existing.body === article.body &&
            existing.tags === tags &&
            existing.status === 'PUBLISHED';
          if (unchanged) continue;
          await this.prisma.helpArticle.update({
            where: { id: existing.id },
            data: {
              categoryId: savedCategory.id,
              title: article.title,
              summary: article.summary,
              body: article.body,
              tags,
              status: 'PUBLISHED',
              version: { increment: 1 },
            },
          });
        }
      }
      // Despublica categorias antigas do catálogo que ficaram vazias
      // (artigos movidos para outra categoria); não toca nas com conteúdo.
      const catalogCategorySlugs = HELP_CATALOG.map((category) => category.slug);
      await this.prisma.helpCategory.updateMany({
        where: { slug: { notIn: catalogCategorySlugs }, published: true, articles: { none: {} } },
        data: { published: false },
      });
      this.catalogSynced = true;
      this.logger.log(
        `Catálogo da Central de Ajuda sincronizado (${HELP_CATALOG.length} categorias, ${catalogArticleSlugs.size} artigos).`,
      );
    } catch (err: any) {
      this.logger.error(`Falha ao sincronizar catálogo de ajuda: ${err?.message ?? err}`);
    }
  }

  private articleWhere(query?: string): Prisma.HelpArticleWhereInput {
    const where: Prisma.HelpArticleWhereInput = { status: 'PUBLISHED' };
    const term = query?.trim();
    if (!term) return where;
    return {
      ...where,
      OR: [
        { title: { contains: term, mode: 'insensitive' } },
        { summary: { contains: term, mode: 'insensitive' } },
        { body: { contains: term, mode: 'insensitive' } },
        { tags: { contains: term, mode: 'insensitive' } },
      ],
    };
  }

  private articleSummarySelect = {
    id: true,
    slug: true,
    title: true,
    summary: true,
    tags: true,
    flowKey: true,
    updatedAt: true,
    viewCount: true,
    helpfulCount: true,
    notHelpfulCount: true,
  } satisfies Prisma.HelpArticleSelect;

  private requireSuperAdmin(user: AuthPayload) {
    if (user.role !== UserRoleEnum.SUPER_ADMIN) throw new NotFoundException('Recurso nao encontrado.');
  }
}

function serializeArticleSummary(article: {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  tags: string;
  flowKey: string | null;
  updatedAt: Date;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
}) {
  return { ...article, tags: parseJsonArray(article.tags) };
}

function serializeArticle(article: Prisma.HelpArticleGetPayload<Record<string, never>> & {
  category?: { id: string; slug: string; title: string; icon: string | null } | null;
}) {
  return {
    ...article,
    tags: parseJsonArray(article.tags),
    roleVisibility: parseJsonArray(article.roleVisibility),
  };
}

function parseJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function normalizeJsonArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

function requiredString(value: unknown, label: string) {
  const text = optionalString(value);
  if (!text) throw new NotFoundException(`${label} nao informado.`);
  return text;
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
