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

/**
 * Mapa compacto da plataforma injetado em TODA resposta do assistente,
 * para que ele sempre tenha o contexto básico de navegação mesmo quando a
 * busca por palavras-chave não encontra artigo específico.
 */
const PLATFORM_MAP = `MAPA DA PLATAFORMA GESTÃO 360 (menu lateral → o que faz):
- Meu Dia (/meu-dia): central de trabalho pós-login; agrega pendências de todos os módulos (tarefas, aprovações, documentos, reuniões, riscos, NCs, indicadores fora da meta); 8 cartões clicáveis; visões Lista/Tabela/Kanban/Calendário/Timeline; delegação por ausência; Meu Dia da Equipe para gestores.
- Tarefas (/tarefas): lista enxuta das pendências em aberto + seção Documentos (liberar/rejeitar/concluir edição).
- Gestão à Vista: Painel Executivo (/visualization, faróis por área), Árvore Organizacional (/org), Mapa Estratégico BSC (/strategy), Indicadores (/indicators, metas/resultados/farol), Desvios (/deviations, Fato-Impacto-Providência), Plano de Ação (/actions, tarefas/evidências/eficácia + ferramentas Ishikawa→5 Porquês→5W2H→PDCA), Reuniões (/meetings, pauta/decisões/ata por IA), Reunião Mensal (/monthly-results), OKRs (/okrs), Cronogramas (/projects).
- Qualidade e Compliance: Documentos GED (/documents, versões/validade/aprovação/leitura/edição online), Processos e SIPOC (/processes), Formulários e Checklists (/forms, construtor + QR Code + NC automática), Auditorias (/audits, programas/checklists/achados), Não Conformidades (/nonconformities, ciclo CAPA), Riscos (/risks, matriz 5×5 inerente/residual), Análise de Impacto (/central-impactos).
- Segurança dos Alimentos (/seguranca-alimentos): APPCC — fluxograma 3D, perigos, planos de controle/monitoramento de PCC com bloqueio de lote, compliance normativo, fornecedores/lotes/rastreabilidade/recall.
- Segurança Patrimonial (/seguranca-patrimonial): portaria — entradas/saídas, autorizações com QR Code, exigência documental com bloqueio, rondas com mapa da planta e QR por ponto, ocorrências, passagem de turno, chaves/correspondências.
- Cargos e Salários (/cargos-salarios): catálogo de cargos, descrições (DOCX), tabelas salariais/faixas, enquadramento (compa-ratio), movimentações com aprovação, ciclos de mérito, orçamento, pesquisas, simulações, Equidade Lei 14.611.
- Comunicação (/comunicacao): mural, comunicados com leitura obrigatória (prova de ciência), campanhas, enquetes, mídias, métricas, chat interno e diretório de pessoas.
- Gestão de Prêmio (/gestao-premio): remuneração variável — programas, anexos/regras versionadas, matriz área×cargo, competência mensal, base elegível, realizado, apuração com memória de cálculo, espelhos com ciência, lote da folha.
- Administração: Usuários e permissões (/users), Central de Automações (/central-automacoes, workflows), Importações CSV/XLSX (/imports), Relatórios (/reports), Períodos (/periods), Aprovações (/aprovacoes-cargo), Central de Atendimento (/central-atendimento, chamados de suporte).
- Transversais: busca global (Ctrl+K), Visão 360° de qualquer entidade, notificações/push, app instalável (PWA), Central de Ajuda com este assistente, LGPD (/lgpd e módulo Privacidade), multiempresa com planos (Essencial→Profissional→Corporativo→Enterprise).`;

type PermissionSet = Set<string> | 'ALL';

interface AssistantSource {
  title: string;
  slug?: string;
  id?: string;
  type: 'manual' | 'company_document';
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

    this.logger.log(
      `Processando ajuda inteligente para usuario: ${user.sub}, empresa: ${companyId}, modulo: ${module || 'Nenhum'}, caracteres: ${message.length}`,
    );

    const words = this.extractKeywords(message);
    const numbers = (message.match(/\d{1,8}/g) ?? []).map((n) => Number(n)).filter((n) => Number.isFinite(n));
    const permissions = await this.loadPermissions(user);

    // 1. Artigos da Central de Ajuda (base global) — com fallback para os mais lidos
    const articles = await this.searchHelpArticles(words, module);

    // 2. Documentos publicados da empresa (GED), respeitando doc:view + áreas
    const companyDocs = await this.searchCompanyDocuments(user, permissions, words, module);

    // 3. Dados ao vivo do banco (registros da empresa), respeitando permissão por módulo
    const liveSections = companyId
      ? await this.searchLiveRecords(user, companyId, permissions, words, numbers)
      : [];

    // 4. Montagem do contexto RAG
    let contextText = '';
    const sources: AssistantSource[] = [];

    if (articles.length > 0) {
      contextText += 'MANUAIS OFICIAIS DA PLATAFORMA GESTÃO 360 (Central de Ajuda):\n';
      articles.forEach((art) => {
        contextText += `---\nTítulo: ${art.title}\nConteúdo: ${art.body.slice(0, 8_000)}\n---\n`;
        sources.push({ title: art.title, slug: art.slug, type: 'manual' });
      });
    }

    if (companyDocs.length > 0) {
      contextText += 'DOCUMENTOS E PROCEDIMENTOS INTERNOS PUBLICADOS DA EMPRESA DO USUÁRIO:\n';
      companyDocs.forEach((doc) => {
        contextText += `---\nTítulo: Documento #${doc.number} (${doc.code || 'Sem código'}) - ${doc.title}\nDescrição: ${doc.description || ''}\nConteúdo: ${(doc.content || '').slice(0, 8_000)}\n---\n`;
        sources.push({
          title: doc.code ? `${doc.code} - ${doc.title}` : `DOC-${doc.number} - ${doc.title}`,
          id: doc.id,
          type: 'company_document',
        });
      });
    }

    if (liveSections.length > 0) {
      contextText += `DADOS AO VIVO DO SISTEMA (registros reais da empresa do usuário, consultados agora no banco — use-os para responder perguntas sobre registros específicos):\n${liveSections.join('\n')}\n`;
    }

    // 5. Histórico curto de conversação
    let historyText = '';
    if (history && history.length > 0) {
      historyText = 'Histórico recente da conversa:\n';
      history.slice(-8).forEach((h) => {
        const roleName = h.role === 'user' ? 'Usuário' : 'Assistente';
        historyText += `[${roleName}]: ${h.content}\n`;
      });
    }

    // 6. Prompt final
    const finalPrompt = `Você é o "Assistente Gestão 360", o especialista oficial de ajuda da plataforma Gestão 360. Você conhece profundamente todos os módulos, telas, campos e metodologias (Ishikawa, 5 Porquês, 5W2H, PDCA, APPCC, CAPA, BSC, OKR).

DIRETRIZES DE RESPOSTA (obrigatórias):
1. Responda SEMPRE em português do Brasil, de forma clara, completa e didática.
2. Quando a pergunta for "como fazer/criar/preencher algo", responda com PASSO A PASSO numerado, indicando o caminho no menu e explicando cada campo relevante (o que significa, como preencher bem, exemplos curtos). Seja detalhista — o usuário prefere resposta completa a resposta curta.
3. Quando a pergunta for sobre metodologia (ex.: como preencher um Ishikawa, o que é causa raiz), ensine a metodologia com exemplos práticos ALÉM de indicar onde fica na plataforma.
4. Use PRIORITARIAMENTE o conteúdo da base de conhecimento abaixo. Quando ela não cobrir o detalhe exato, use o MAPA DA PLATAFORMA e seu conhecimento das metodologias para orientar o usuário da melhor forma possível — nunca responda apenas "não sei". Se algo específico não estiver na base, diga o que você sabe e indique onde na plataforma o usuário confirma o restante.
5. Se a seção "DADOS AO VIVO" contiver registros, use-os para responder perguntas sobre registros específicos (um desvio, indicador, documento, NC, risco ou reunião), citando número/código, status e demais campos retornados. Se o usuário perguntou por um registro específico e ele NÃO está nos dados ao vivo, diga que não o encontrou com o acesso dele e indique a tela onde procurar.
6. NUNCA invente valores de dados (números de resultados, status, datas) que não estejam nos DADOS AO VIVO ou nos documentos. Funcionalidades: descreva apenas o que existe no mapa/manuais.
7. Se o usuário pedir para você executar uma alteração (criar tarefa, lançar resultado etc.), explique o passo a passo para ele fazer — você ainda não executa ações.
8. Perguntas totalmente fora do escopo corporativo/da plataforma: recuse educadamente.
9. Formate com títulos curtos (##), listas e **negrito** nos nomes de campos e botões.

${PLATFORM_MAP}

CONTEXTO DE NAVEGAÇÃO DO USUÁRIO:
- Módulo onde o usuário está agora: ${module || 'Nenhum'}
- URL/Rota onde o usuário está agora: ${route || 'Nenhuma'}

BASE DE CONHECIMENTO (RAG):
${contextText || 'Nenhum documento específico encontrado para os termos da pergunta — use o mapa da plataforma e a metodologia.'}

${historyText}
[Usuário]: ${message}
[Assistente]:`;

    this.logger.debug('Enviando prompt ao GeminiService...');
    const answer = await this.gemini.generateText(finalPrompt, { temperature: 0.3, maxOutputTokens: 2048 });

    return {
      answer: answer || 'Não consegui responder agora. Tente novamente em alguns instantes.',
      sources,
      conversationId: payload.conversationId || `conv_${Date.now()}`,
    };
  }

  // ==================== Palavras-chave ====================

  private extractKeywords(message: string): string[] {
    const stopwords = new Set([
      'como', 'para', 'uma', 'onde', 'esta', 'com', 'por', 'que', 'de',
      'do', 'da', 'um', 'em', 'se', 'facil', 'quais', 'mais', 'sobre',
      'tudo', 'qual', 'quem', 'novo', 'nova', 'meu', 'minha', 'the',
      'criar', 'gerar', 'fazer', 'adicionar', 'cadastrar', 'visualizar',
      'editar', 'excluir', 'dos', 'das', 'nos', 'nas', 'ver', 'abrir',
      'preciso', 'quero', 'gostaria', 'ajuda', 'favor', 'pode', 'consigo',
    ]);
    return message
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 2 && !stopwords.has(w) && !/^\d+$/.test(w));
  }

  // ==================== Permissões ====================

  /** Carrega o conjunto de chaves de permissão do usuário ('ALL' para admins). */
  private async loadPermissions(user: AuthPayload): Promise<PermissionSet> {
    if (user.role === 'SUPER_ADMIN' || user.role === 'COMPANY_ADMIN') return 'ALL';
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      include: {
        accessProfile: { include: { permissions: { include: { permission: true } } } },
        permissions: { include: { permission: true } },
      },
    });
    if (!dbUser) return new Set();
    const userKeys = dbUser.permissions.map((up) => up.permission.key);
    const profileKeys = dbUser.accessProfile?.permissions.map((pp) => pp.permission.key) ?? [];
    return new Set([...userKeys, ...profileKeys]);
  }

  private can(permissions: PermissionSet, ...keys: string[]): boolean {
    if (permissions === 'ALL') return true;
    return keys.some((key) => permissions.has(key));
  }

  // ==================== Artigos de ajuda ====================

  private async searchHelpArticles(words: string[], module?: string) {
    const select = { id: true, slug: true, title: true, summary: true, body: true } as const;
    const orHelpConditions: Prisma.HelpArticleWhereInput[] = [];
    if (module) {
      orHelpConditions.push({ title: { contains: module, mode: 'insensitive' } });
      orHelpConditions.push({ tags: { contains: module, mode: 'insensitive' } });
    }
    words.forEach((word) => {
      orHelpConditions.push({ title: { contains: word, mode: 'insensitive' } });
      orHelpConditions.push({ body: { contains: word, mode: 'insensitive' } });
      orHelpConditions.push({ tags: { contains: word, mode: 'insensitive' } });
    });

    const articles = await this.prisma.helpArticle.findMany({
      where: {
        status: 'PUBLISHED',
        OR: orHelpConditions.length > 0 ? orHelpConditions : undefined,
      },
      take: 5,
      select,
    });
    if (articles.length > 0) return articles;

    // Fallback: nenhum artigo casou com as palavras — devolve os mais lidos
    // para o modelo pelo menos conhecer o essencial da plataforma.
    return this.prisma.helpArticle.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ viewCount: 'desc' }, { updatedAt: 'desc' }],
      take: 3,
      select,
    });
  }

  // ==================== Documentos da empresa ====================

  private async searchCompanyDocuments(
    user: AuthPayload,
    permissions: PermissionSet,
    words: string[],
    module?: string,
  ) {
    const companyId = user.companyId;
    if (!companyId || !this.can(permissions, 'doc:view', 'doc:manage')) return [];

    const permittedAreas = await this.access.listAreaFilter(user.sub, 'documents', 'view');
    const orDocConditions: Prisma.DocumentWhereInput[] = [];
    if (module) {
      orDocConditions.push({ title: { contains: module, mode: 'insensitive' } });
      orDocConditions.push({ description: { contains: module, mode: 'insensitive' } });
      orDocConditions.push({ content: { contains: module, mode: 'insensitive' } });
    }
    words.forEach((word) => {
      orDocConditions.push({ title: { contains: word, mode: 'insensitive' } });
      orDocConditions.push({ description: { contains: word, mode: 'insensitive' } });
      orDocConditions.push({ content: { contains: word, mode: 'insensitive' } });
    });

    return this.prisma.document.findMany({
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
        OR: orDocConditions.length > 0 ? orDocConditions : undefined,
      },
      take: 3,
      select: { id: true, title: true, code: true, number: true, description: true, content: true },
    });
  }

  // ==================== Dados ao vivo (registros da empresa) ====================

  /**
   * Consulta registros reais da empresa relacionados às palavras-chave, cada
   * tipo condicionado à MESMA permissão de visualização usada pelo módulo de
   * origem (e ao filtro de área, quando o módulo o aplica nas listagens).
   */
  private async searchLiveRecords(
    user: AuthPayload,
    companyId: string,
    permissions: PermissionSet,
    words: string[],
    numbers: number[],
  ): Promise<string[]> {
    if (words.length === 0 && numbers.length === 0) return [];
    const sections: string[] = [];
    const like = (field: string) => words.map((w) => ({ [field]: { contains: w, mode: 'insensitive' as const } }));
    const fmtDate = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : 'sem data');

    const tasks: Array<Promise<void>> = [];

    // Indicadores (+ último resultado)
    if (this.can(permissions, 'indicators:view', 'indicators:manage')) {
      tasks.push(
        (async () => {
          const areas = await this.access.listAreaFilter(user.sub, 'indicators', 'view');
          const indicators = await this.prisma.indicator.findMany({
            where: {
              companyId,
              deletedAt: null,
              ...(areas ? { ownerNodeId: { in: areas } } : {}),
              OR: [...like('name'), ...like('code'), ...like('description')],
            },
            take: 3,
            select: {
              name: true, code: true, type: true, unitLabel: true, unit: true, periodicity: true,
              direction: true, status: true,
              ownerNode: { select: { name: true } },
              responsibleUser: { select: { name: true } },
              results: { orderBy: { periodDate: 'desc' }, take: 1, select: { periodRef: true, value: true, light: true, attainment: true } },
            },
          });
          if (indicators.length === 0) return;
          const lines = indicators.map((i) => {
            const r = i.results[0];
            const last = r
              ? `último resultado ${r.periodRef}: ${r.value} (farol ${r.light}${r.attainment != null ? `, atingimento ${Math.round(r.attainment)}%` : ''})`
              : 'sem resultados lançados';
            return `- Indicador "${i.name}"${i.code ? ` (código ${i.code})` : ''}: tipo ${i.type}, área ${i.ownerNode?.name ?? '-'}, responsável ${i.responsibleUser?.name ?? '-'}, periodicidade ${i.periodicity}, status ${i.status}; ${last}.`;
          });
          sections.push(`INDICADORES ENCONTRADOS:\n${lines.join('\n')}`);
        })(),
      );
    }

    // Desvios (por título/fato ou número sequencial)
    if (this.can(permissions, 'deviations:view', 'deviations:manage')) {
      tasks.push(
        (async () => {
          const deviations = await this.prisma.deviation.findMany({
            where: {
              companyId,
              deletedAt: null,
              OR: [
                ...like('title'),
                ...like('fact'),
                ...(numbers.length > 0 ? [{ number: { in: numbers } }] : []),
              ],
            },
            take: 3,
            orderBy: { openedAt: 'desc' },
            select: {
              number: true, title: true, severity: true, status: true, periodRef: true,
              fact: true, rootCause: true, dueDate: true,
              indicator: { select: { name: true } },
              responsibleUser: { select: { name: true } },
            },
          });
          if (deviations.length === 0) return;
          const lines = deviations.map(
            (d) =>
              `- Desvio nº ${d.number} "${d.title}" (período ${d.periodRef}): indicador ${d.indicator?.name ?? '-'}, severidade ${d.severity}, status ${d.status}, responsável ${d.responsibleUser?.name ?? '-'}, prazo ${fmtDate(d.dueDate)}; fato: ${(d.fact ?? '-').slice(0, 200)}; causa raiz: ${d.rootCause ?? 'ainda não consolidada'}.`,
          );
          sections.push(`DESVIOS ENCONTRADOS:\n${lines.join('\n')}`);
        })(),
      );
    }

    // Planos de ação
    if (this.can(permissions, 'actions:view', 'actions:manage')) {
      tasks.push(
        (async () => {
          const areas = await this.access.listAreaFilter(user.sub, 'actions', 'view');
          const actions = await this.prisma.actionPlan.findMany({
            where: {
              companyId,
              deletedAt: null,
              ...(areas ? { OR: [{ ownerNodeId: { in: areas } }, { ownerNodeId: null }] } : {}),
              AND: [{ OR: [...like('title'), ...like('description')] }],
            },
            take: 3,
            orderBy: { updatedAt: 'desc' },
            select: {
              title: true, status: true, priority: true, progress: true, dueDate: true, origin: true,
              responsibleUser: { select: { name: true } },
              indicator: { select: { name: true } },
            },
          });
          if (actions.length === 0) return;
          const lines = actions.map(
            (a) =>
              `- Plano de ação "${a.title}": status ${a.status}, prioridade ${a.priority}, progresso ${Math.round(a.progress)}%, prazo ${fmtDate(a.dueDate)}, responsável ${a.responsibleUser?.name ?? '-'}, origem ${a.origin}${a.indicator ? `, indicador ${a.indicator.name}` : ''}.`,
          );
          sections.push(`PLANOS DE AÇÃO ENCONTRADOS:\n${lines.join('\n')}`);
        })(),
      );
    }

    // Não conformidades (por título/descrição ou número)
    if (this.can(permissions, 'nc:view', 'nc:manage')) {
      tasks.push(
        (async () => {
          const ncs = await this.prisma.nonConformity.findMany({
            where: {
              companyId,
              deletedAt: null,
              OR: [
                ...like('title'),
                ...like('description'),
                ...(numbers.length > 0 ? [{ number: { in: numbers } }] : []),
              ],
            },
            take: 3,
            orderBy: { identifiedAt: 'desc' },
            select: {
              number: true, title: true, source: true, severity: true, status: true, dueDate: true,
              rootCause: true, effectivenessOk: true,
              responsibleUser: { select: { name: true } },
            },
          });
          if (ncs.length === 0) return;
          const lines = ncs.map(
            (n) =>
              `- NC nº ${n.number} "${n.title}": origem ${n.source}, severidade ${n.severity}, status ${n.status}, responsável ${n.responsibleUser?.name ?? '-'}, prazo ${fmtDate(n.dueDate)}, causa raiz: ${n.rootCause ?? 'não registrada'}${n.effectivenessOk != null ? `, eficácia ${n.effectivenessOk ? 'confirmada' : 'reprovada'}` : ''}.`,
          );
          sections.push(`NÃO CONFORMIDADES ENCONTRADAS:\n${lines.join('\n')}`);
        })(),
      );
    }

    // Riscos
    if (this.can(permissions, 'risks:view', 'risks:manage')) {
      tasks.push(
        (async () => {
          const risks = await this.prisma.riskRegister.findMany({
            where: {
              companyId,
              deletedAt: null,
              OR: [...like('title'), ...like('description')],
            },
            take: 3,
            orderBy: { updatedAt: 'desc' },
            select: {
              title: true, category: true, status: true, probability: true, impact: true,
              residualProbability: true, residualImpact: true, dueDate: true,
              responsibleUser: { select: { name: true } },
            },
          });
          if (risks.length === 0) return;
          const lines = risks.map((r) => {
            const residual =
              r.residualProbability != null && r.residualImpact != null
                ? `residual ${r.residualProbability}×${r.residualImpact}=${r.residualProbability * r.residualImpact}`
                : 'residual não avaliado';
            return `- Risco "${r.title}": categoria ${r.category}, status ${r.status}, inerente ${r.probability}×${r.impact}=${r.probability * r.impact}, ${residual}, responsável ${r.responsibleUser?.name ?? '-'}, prazo ${fmtDate(r.dueDate)}.`;
          });
          sections.push(`RISCOS ENCONTRADOS:\n${lines.join('\n')}`);
        })(),
      );
    }

    // Reuniões
    if (this.can(permissions, 'meetings:view', 'meetings:manage')) {
      tasks.push(
        (async () => {
          const meetings = await this.prisma.meeting.findMany({
            where: {
              companyId,
              deletedAt: null,
              OR: [...like('title'), ...like('objective')],
            },
            take: 3,
            orderBy: { startsAt: 'desc' },
            select: {
              title: true, kind: true, status: true, startsAt: true, format: true,
              responsibleUser: { select: { name: true } },
              indicator: { select: { name: true } },
            },
          });
          if (meetings.length === 0) return;
          const lines = meetings.map(
            (m) =>
              `- Reunião "${m.title}": tipo ${m.kind}, formato ${m.format}, status ${m.status}, data ${fmtDate(m.startsAt)}, responsável ${m.responsibleUser?.name ?? '-'}${m.indicator ? `, indicador ${m.indicator.name}` : ''}.`,
          );
          sections.push(`REUNIÕES ENCONTRADAS:\n${lines.join('\n')}`);
        })(),
      );
    }

    const results = await Promise.allSettled(tasks);
    results.forEach((r) => {
      if (r.status === 'rejected') this.logger.warn(`Busca ao vivo falhou: ${r.reason?.message ?? r.reason}`);
    });
    return sections;
  }
}
