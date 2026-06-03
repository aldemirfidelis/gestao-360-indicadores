import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRoleEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';

const DEFAULT_HELP = [
  {
    slug: 'primeiros-passos',
    title: 'Primeiros passos',
    description: 'Orientacoes para entrar no sistema, navegar e encontrar informacoes.',
    icon: 'Compass',
    position: 1,
    articles: [
      {
        slug: 'visao-geral-do-sistema',
        title: 'Visao geral do sistema',
        summary: 'Entenda onde ficam indicadores, planos de acao, reunioes e comunicacao.',
        tags: ['inicio', 'navegacao'],
        body:
          'Use o menu lateral para alternar entre visualizacoes, lancamentos, gestao, relatorios e comunicacao. As permissoes do seu perfil definem quais areas aparecem. A busca e os filtros de cada tela ajudam a reduzir a lista antes de abrir um registro.',
      },
      {
        slug: 'como-usar-a-comunicacao',
        title: 'Como usar Comunicacao e Pessoas',
        summary: 'Converse com a equipe, veja presenca online e abra perfis corporativos.',
        tags: ['comunicacao', 'mensagens', 'pessoas'],
        body:
          'A tela Comunicacao concentra conversas internas. Em Pessoas voce encontra usuarios da empresa, inicia conversas e consulta perfil, cargo, area e contatos. Conversas podem ser fixadas, silenciadas e receber anexos quando for necessario manter contexto junto da mensagem.',
      },
    ],
  },
  {
    slug: 'planos-de-acao',
    title: 'Planos de acao',
    description: 'Fluxo de tarefas, evidencias, eficacia e aprovacao.',
    icon: 'CheckSquare',
    position: 2,
    articles: [
      {
        slug: 'ciclo-do-plano-de-acao',
        title: 'Ciclo do Plano de Acao',
        summary: 'Acompanhe abertura, execucao, eficacia e fechamento.',
        tags: ['acoes', 'eficacia'],
        body:
          'Um plano de acao nasce de um desvio, reuniao ou decisao preventiva. As tarefas ficam na execucao com responsavel, prazo, evidencias e historico. Ao finalizar a execucao, a eficacia deve ser avaliada para decidir se o plano pode ser finalizado ou reaberto.',
      },
      {
        slug: 'evidencias-em-tarefas',
        title: 'Evidencias em tarefas',
        summary: 'Anexe arquivos na tarefa para comprovar a acao realizada.',
        tags: ['tarefas', 'evidencias'],
        body:
          'Cada tarefa pode receber evidencia. Use o icone de clipe no card de execucao para anexar o arquivo. Depois do envio, o status de evidencia anexada ajuda a identificar rapidamente quais tarefas ja possuem comprovacao.',
      },
    ],
  },
  {
    slug: 'administracao',
    title: 'Administracao',
    description: 'Recursos do Super Admin, integracoes e parametros.',
    icon: 'ShieldCheck',
    position: 3,
    articles: [
      {
        slug: 'central-do-portal',
        title: 'Central do Portal',
        summary: 'Controle modulos, paginas, recursos, manutencao, integracoes e escopos.',
        tags: ['super-admin', 'portal'],
        body:
          'A Central do Portal fica em Configuracoes Avancadas e e restrita ao Super Admin. Ela permite controlar o que aparece para os usuarios, registrar manutencoes, revisar integracoes, consultar diagnosticos e auditar alteracoes administrativas.',
      },
      {
        slug: 'integracoes-suportadas',
        title: 'Integracoes suportadas',
        summary: 'Veja quais conectores internos estao ativos no ambiente.',
        tags: ['integracoes', 'admin'],
        body:
          'As integracoes disponiveis neste ambiente priorizam e-mail, banco de dados, armazenamento, comunicacao interna e Central de Ajuda. Conectores Google e Microsoft nao fazem parte desta fase.',
      },
    ],
  },
];

@Injectable()
export class HelpService {
  constructor(private readonly prisma: PrismaService) {}

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

  private async ensureDefaults() {
    const count = await this.prisma.helpCategory.count();
    if (count > 0) return;
    for (const category of DEFAULT_HELP) {
      await this.prisma.helpCategory.create({
        data: {
          slug: category.slug,
          title: category.title,
          description: category.description,
          icon: category.icon,
          position: category.position,
          articles: {
            create: category.articles.map((article) => ({
              slug: article.slug,
              title: article.title,
              summary: article.summary,
              body: article.body,
              tags: JSON.stringify(article.tags),
              status: 'PUBLISHED',
            })),
          },
        },
      });
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
