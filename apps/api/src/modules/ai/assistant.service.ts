import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GeminiService } from './gemini.service';
import { AuthPayload } from '../auth/auth.types';
import { AccessService } from '../access/access.service';

export interface HelpMessage {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

export interface HelpRequest {
  message: string;
  module?: string;
  route?: string;
  conversationId?: string;
  history?: HelpMessage[];
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly access: AccessService,
  ) {}

  async getHelpResponse(payload: HelpRequest, user: AuthPayload) {
    const { message, module, route, history } = payload;
    const companyId = user.companyId;

    this.logger.log(`Processando ajuda inteligente para usuario: ${user.sub}, empresa: ${companyId}, modulo: ${module || 'Nenhum'}, caracteres: ${message.length}`);

    // 1. Extração de palavras-chave para RAG
    const stopwords = new Set([
      'como', 'para', 'uma', 'onde', 'esta', 'com', 'por', 'que', 'de',
      'do', 'da', 'um', 'em', 'se', 'facil', 'quais', 'mais', 'sobre',
      'tudo', 'qual', 'quais', 'quem', 'novo', 'nova', 'meu', 'minha',
      'criar', 'gerar', 'fazer', 'adicionar', 'cadastrar', 'visualizar',
      'editar', 'excluir', 'como faço', 'como criar', 'como cadastrar'
    ]);

    const words = message
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/[^\w\s]/g, '') // remove pontuação
      .split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length > 2 && !stopwords.has(w));

    // 2. Busca nos artigos de manuais globais (HelpArticle)
    const orHelpConditions: Prisma.HelpArticleWhereInput[] = [];
    if (module) {
      orHelpConditions.push({ title: { contains: module, mode: 'insensitive' } });
      orHelpConditions.push({ tags: { contains: module, mode: 'insensitive' } });
    }
    words.forEach(word => {
      orHelpConditions.push({ title: { contains: word, mode: 'insensitive' } });
      orHelpConditions.push({ body: { contains: word, mode: 'insensitive' } });
      orHelpConditions.push({ tags: { contains: word, mode: 'insensitive' } });
    });

    const articles = await this.prisma.helpArticle.findMany({
      where: {
        status: 'PUBLISHED',
        OR: orHelpConditions.length > 0 ? orHelpConditions : undefined
      },
      take: 4,
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        body: true
      }
    });

    // 3. Busca nos documentos internos da empresa (GED Document), respeitando permissão doc:view
    const companyDocs = [];
    let canViewCompanyDocs = false;

    if (user.role === 'SUPER_ADMIN' || user.role === 'COMPANY_ADMIN') {
      canViewCompanyDocs = true;
    } else {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.sub },
        include: {
          accessProfile: {
            include: {
              permissions: {
                include: { permission: true }
              }
            }
          },
          permissions: {
            include: { permission: true }
          }
        }
      });

      if (dbUser) {
        const userKeys = dbUser.permissions.map(up => up.permission.key);
        const profileKeys = dbUser.accessProfile?.permissions.map(pp => pp.permission.key) ?? [];
        const allKeys = new Set([...userKeys, ...profileKeys]);

        canViewCompanyDocs = allKeys.has('doc:view') || allKeys.has('doc:manage');
      }
    }

    if (canViewCompanyDocs && companyId) {
      const permittedAreas = await this.access.listAreaFilter(user.sub, 'documents', 'view');
      const orDocConditions: Prisma.DocumentWhereInput[] = [];
      if (module) {
        orDocConditions.push({ title: { contains: module, mode: 'insensitive' } });
        orDocConditions.push({ description: { contains: module, mode: 'insensitive' } });
        orDocConditions.push({ content: { contains: module, mode: 'insensitive' } });
      }
      words.forEach(word => {
        orDocConditions.push({ title: { contains: word, mode: 'insensitive' } });
        orDocConditions.push({ description: { contains: word, mode: 'insensitive' } });
        orDocConditions.push({ content: { contains: word, mode: 'insensitive' } });
      });

      const docs = await this.prisma.document.findMany({
        where: {
          companyId,
          status: 'PUBLISHED',
          deletedAt: null,
          ...(permittedAreas
            ? {
                AND: [{
                  OR: [
                    { orgNodeId: null, indicatorId: null },
                    { orgNodeId: { in: permittedAreas } },
                    { indicator: { ownerNodeId: { in: permittedAreas } } },
                  ],
                }],
              }
            : {}),
          OR: orDocConditions.length > 0 ? orDocConditions : undefined
        },
        take: 3,
        select: {
          id: true,
          title: true,
          code: true,
          number: true,
          description: true,
          content: true
        }
      });
      companyDocs.push(...docs);
    }

    // 4. Montar contexto de RAG
    let contextText = '';
    const sources: Array<{ title: string; slug?: string; id?: string; type: 'manual' | 'company_document' }> = [];

    if (articles.length > 0) {
      contextText += 'MANUAIS E DOCUMENTOS DE AJUDA DA PLATAFORMA GESTÃO 360:\n';
      articles.forEach(art => {
        contextText += `---
Título: ${art.title}
Conteúdo: ${art.body.slice(0, 8_000)}
--- \n`;
        sources.push({
          title: art.title,
          slug: art.slug,
          type: 'manual'
        });
      });
    }

    if (companyDocs.length > 0) {
      contextText += 'DOCUMENTOS E PROCEDIMENTOS INTERNOS DA EMPRESA DO USUÁRIO:\n';
      companyDocs.forEach(doc => {
        contextText += `---
Título: Documento #${doc.number} (${doc.code || 'Sem código'}) - ${doc.title}
Descrição: ${doc.description || ''}
Conteúdo: ${(doc.content || '').slice(0, 8_000)}
--- \n`;
        sources.push({
          title: doc.code ? `${doc.code} - ${doc.title}` : `DOC-${doc.number} - ${doc.title}`,
          id: doc.id,
          type: 'company_document'
        });
      });
    }

    // 5. Formatar histórico curto de conversação
    let historyText = '';
    if (history && history.length > 0) {
      historyText = 'Histórico recente da conversa:\n';
      // Pegar no máximo as últimas 8 mensagens para não estourar contexto
      history.slice(-8).forEach(h => {
        const roleName = h.role === 'user' ? 'Usuário' : 'Assistente';
        historyText += `[${roleName}]: ${h.content}\n`;
      });
    }

    // 6. Criar prompt final do sistema
    const finalPrompt = `Você é o "Assistente Gestão 360" (ou "G360 Bot"), o robô de ajuda oficial da plataforma Gestão 360.
Sua missão é auxiliar os usuários da plataforma tirando dúvidas sobre o uso dos módulos, configurações e fluxos internos de trabalho.

Diretrizes obrigatórias de resposta:
1. Responda em PORTUGUÊS de forma clara, amigável, didática e direta. Se necessário, explique no formato de passo a passo ordenado.
2. Baseie sua resposta PRINCIPALMENTE no contexto RAG fornecido abaixo.
3. Se o RAG não contiver as informações necessárias para responder de forma correta, diga educadamente:
   "Não encontrei essa informação na documentação disponível. Você pode tentar reformular a pergunta ou procurar o suporte."
4. NUNCA invente botões, menus, telas ou funcionalidades que não existam na plataforma Gestão 360.
5. Se o usuário pedir para você executar alguma alteração no sistema (como criar uma tarefa, indicador ou plano de ação), responda orientando-o como fazer manualmente de acordo com a base de conhecimento e diga que futuramente você poderá ajudá-lo a fazer isso automaticamente.
6. Nunca responda a perguntas sobre tópicos completamente fora do escopo corporativo e da plataforma Gestão 360.

CONTO DE NAVEGAÇÃO DO USUÁRIO:
- Módulo onde o usuário está agora: ${module || 'Nenhum'}
- URL/Rota onde o usuário está agora: ${route || 'Nenhuma'}

CONTEÚDO DA BASE DE CONHECIMENTO RETORNADO POR RAG:
${contextText || 'Nenhum documento relevante encontrado.'}

${historyText}
[Usuário]: ${message}
[Assistente]:`;

    this.logger.debug(`Enviando prompt ao GeminiService...`);
    const answer = await this.gemini.generateText(finalPrompt, { temperature: 0.3 });

    return {
      answer: answer || 'Não consegui responder agora. Tente novamente em alguns instantes.',
      sources,
      conversationId: payload.conversationId || `conv_${Date.now()}`
    };
  }
}
