import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionStatus, DeviationStatus, TrafficLight } from '@prisma/client';
import { GeminiService } from '../ai/gemini.service';
import { AccessService } from '../access/access.service';
import { AuthPayload } from '../auth/auth.types';

// Filtro de área (null = sem restrição). Insights (e o contexto enviado à IA) jamais
// podem incluir indicadores/desvios de áreas fora do escopo do usuário.
type AreaScope = string[] | null;

export interface InsightItem {
  id: string;
  kind:
    | 'EXECUTIVE_SUMMARY'
    | 'WORSENING_TREND'
    | 'CAUSE_SUGGESTION'
    | 'ACTION_SUGGESTION'
    | 'RISK_FLAG';
  title: string;
  body: string;
  refs?: { type: string; id: string; label: string }[];
  severity?: 'info' | 'warning' | 'critical';
  source?: 'ai' | 'rules';
}

const CAUSE_LIBRARY: Record<string, string[]> = {
  default: [
    'Variabilidade do processo nao controlada',
    'Falta de procedimento padronizado',
    'Equipe sub-dimensionada para o período',
    'Demanda atipica acima do plano',
  ],
  HR: ['Clima organizacional impactado', 'Concorrencia regional por mao de obra'],
  SAFETY: ['Reciclagem de NRs em atraso', 'Equipamento de protecao individual nao padronizado'],
  PRODUCTION: ['Manutenção corretiva acima da media', 'Materia-prima fora de especificacao'],
  QUALITY: ['Calibracao de instrumentos em atraso', 'Treinamento de inspetores defasado'],
};

const ACTION_LIBRARY: Record<string, string[]> = {
  default: [
    'Abrir análise FCA com a equipe responsável',
    'Revisar procedimento operacional padrão',
    'Definir plano de comunicação semanal',
  ],
  HR: ['Programa de retencao para os 6 meses iniciais', 'Realizar pesquisa de clima focal'],
  SAFETY: ['Reforcar DSS - dialogo diário de seguranca', 'Auditoria comportamental nas frentes críticas'],
  PRODUCTION: ['Revisar plano de manutenção preventiva', 'Bloquear materia-prima fora de spec'],
  QUALITY: ['Cronograma de calibracao trimestral', 'Reciclagem dos inspetores'],
};

interface GeminiInsightsResponse {
  summary?: string;
  trends?: Array<{ indicatorId: string; title: string; body: string }>;
  causes?: Array<{ deviationId: string; title: string; body: string }>;
  actions?: Array<{ indicatorId: string; title: string; body: string }>;
}

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly access: AccessService,
  ) {}

  /** ownerNodeId-filter para spread dentro de um where de Indicator (ou aninhado). */
  private indArea(area: AreaScope) {
    return area ? { ownerNodeId: { in: area } } : {};
  }

  async generate(me: AuthPayload): Promise<InsightItem[]> {
    const area = await this.access.listAreaFilter(me.sub, 'insights', 'view');
    const companyId = me.companyId;
    const baseInsights = await this.generateRuleBased(companyId, area);
    if (!this.gemini.isEnabled) return baseInsights;

    const enriched = await this.tryGeminiEnrichment(companyId, area, baseInsights);
    return enriched ?? baseInsights;
  }

  // -------- regras deterministicas (fallback / base) --------

  private async generateRuleBased(companyId: string, area: AreaScope): Promise<InsightItem[]> {
    const out: InsightItem[] = [];
    out.push(await this.executiveSummary(companyId, area));
    out.push(...(await this.worsening(companyId, area)));
    out.push(...(await this.causeSuggestions(companyId, area)));
    out.push(...(await this.actionSuggestions(companyId, area)));
    return out.map((i) => ({ ...i, source: i.source ?? 'rules' }));
  }

  private async executiveSummary(companyId: string, area: AreaScope): Promise<InsightItem> {
    const last = await this.prisma.indicatorResult.findMany({
      where: { indicator: { companyId, deletedAt: null, ...this.indArea(area) } },
      orderBy: { periodDate: 'desc' },
      distinct: ['indicatorId'],
      select: { light: true, attainment: true },
    });
    const counts = last.reduce(
      (acc, r) => {
        acc[r.light] = (acc[r.light] ?? 0) + 1;
        return acc;
      },
      {} as Record<TrafficLight, number>,
    );
    const overdue = await this.prisma.actionPlan.count({
      where: {
        companyId,
        deletedAt: null,
        dueDate: { lt: new Date() },
        status: { notIn: [ActionStatus.DONE, ActionStatus.DONE_LATE, ActionStatus.CANCELLED] },
        ...this.indArea(area),
      },
    });
    const criticalDev = await this.prisma.deviation.count({
      where: {
        companyId,
        deletedAt: null,
        severity: 'CRITICAL',
        status: { notIn: [DeviationStatus.CLOSED, DeviationStatus.CLOSED_LATE, DeviationStatus.CANCELLED] },
        ...(area ? { indicator: { ownerNodeId: { in: area } } } : {}),
      },
    });
    const total = last.length;
    const greenRate = total ? Math.round(((counts.GREEN ?? 0) / total) * 100) : 0;
    return {
      id: 'summary',
      kind: 'EXECUTIVE_SUMMARY',
      title: 'Resumo executivo do período',
      body:
        `Do total de ${total} indicadores ativos, ${greenRate}% estão no verde, ${counts.YELLOW ?? 0} em atenção e ${counts.RED ?? 0} críticos. ` +
        `Existem ${overdue} ações atrasadas e ${criticalDev} desvios críticos abertos. ` +
        (greenRate >= 70
          ? 'O cenario geral e positivo, mantenha cadencia nas revisoes.'
          : 'Prioridade: atacar os indicadores críticos e destravar ações atrasadas nas próximas reuniões.'),
      severity: greenRate >= 70 ? 'info' : counts.RED ?? 0 > 3 ? 'critical' : 'warning',
    };
  }

  private async worsening(companyId: string, area: AreaScope): Promise<InsightItem[]> {
    const indicators = await this.prisma.indicator.findMany({
      where: { companyId, deletedAt: null, status: 'ACTIVE', ...this.indArea(area) },
      select: {
        id: true,
        name: true,
        direction: true,
        results: { orderBy: { periodDate: 'desc' }, take: 3, select: { attainment: true, periodRef: true } },
      },
    });
    const out: InsightItem[] = [];
    for (const i of indicators) {
      if (i.results.length < 3) continue;
      const [c, b, a] = i.results;
      if (a.attainment === null || b.attainment === null || c.attainment === null) continue;
      if (a.attainment > b.attainment && b.attainment > c.attainment && a.attainment - c.attainment > 0.05) {
        out.push({
          id: `worsen-${i.id}`,
          kind: 'WORSENING_TREND',
          title: `Tendência de piora: ${i.name}`,
          body: `O atingimento caiu de ${pct(a.attainment)} para ${pct(c.attainment)} nos últimos 3 períodos. Avalie causas estruturais.`,
          refs: [{ type: 'indicator', id: i.id, label: i.name }],
          severity: 'warning',
        });
      }
    }
    return out.slice(0, 5);
  }

  private async causeSuggestions(companyId: string, area: AreaScope): Promise<InsightItem[]> {
    const devs = await this.prisma.deviation.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: [DeviationStatus.OPEN, DeviationStatus.IN_ANALYSIS] },
        ...(area ? { indicator: { ownerNodeId: { in: area } } } : {}),
      },
      include: {
        indicator: { select: { id: true, name: true, type: true } },
        causes: { select: { id: true } },
      },
      take: 5,
    });
    return devs
      .filter((d) => d.causes.length < 2)
      .map((d) => {
        const lib = CAUSE_LIBRARY[d.indicator.type] ?? CAUSE_LIBRARY.default;
        return {
          id: `cause-${d.id}`,
          kind: 'CAUSE_SUGGESTION',
          title: `Sugestão de causas: desvio #${d.number}`,
          body: `Considere as seguintes hipoteses para "${d.indicator.name}":\n- ${lib.slice(0, 3).join('\n- ')}`,
          refs: [{ type: 'deviation', id: d.id, label: `#${d.number}` }],
          severity: 'info',
        } as InsightItem;
      });
  }

  private async actionSuggestions(companyId: string, area: AreaScope): Promise<InsightItem[]> {
    const reds = await this.prisma.indicatorResult.findMany({
      where: { indicator: { companyId, deletedAt: null, ...this.indArea(area) }, light: 'RED' },
      distinct: ['indicatorId'],
      orderBy: { periodDate: 'desc' },
      include: { indicator: { select: { id: true, name: true, type: true } } },
      take: 5,
    });
    return reds.map((r) => {
      const lib = ACTION_LIBRARY[r.indicator.type] ?? ACTION_LIBRARY.default;
      return {
        id: `action-${r.indicator.id}`,
        kind: 'ACTION_SUGGESTION',
        title: `Ações recomendadas: ${r.indicator.name}`,
        body: `Como o indicador esta no vermelho (${pct(r.attainment ?? 0)}), avalie:\n- ${lib.slice(0, 3).join('\n- ')}`,
        refs: [{ type: 'indicator', id: r.indicator.id, label: r.indicator.name }],
        severity: 'critical',
      } as InsightItem;
    });
  }

  // -------- enriquecimento via Gemini --------

  private async tryGeminiEnrichment(
    companyId: string,
    area: AreaScope,
    baseInsights: InsightItem[],
  ): Promise<InsightItem[] | null> {
    const context = await this.buildCompanyContext(companyId, area);
    if (context.indicators.length === 0) return null;

    const prompt = this.buildInsightsPrompt(context);
    const response = await this.gemini.generateJson<GeminiInsightsResponse>(prompt, {
      temperature: 0.4,
      maxOutputTokens: 1800,
    });
    if (!response) {
      this.logger.warn('Gemini nao retornou insights validos - usando regras.');
      return null;
    }

    const out: InsightItem[] = [];
    if (response.summary) {
      out.push({
        id: 'summary',
        kind: 'EXECUTIVE_SUMMARY',
        title: 'Resumo executivo do período',
        body: response.summary,
        severity: 'info',
        source: 'ai',
      });
    } else {
      const fallbackSummary = baseInsights.find((i) => i.kind === 'EXECUTIVE_SUMMARY');
      if (fallbackSummary) out.push(fallbackSummary);
    }

    for (const t of response.trends ?? []) {
      if (!t.indicatorId || !t.title) continue;
      out.push({
        id: `worsen-${t.indicatorId}`,
        kind: 'WORSENING_TREND',
        title: t.title,
        body: t.body ?? '',
        refs: [{ type: 'indicator', id: t.indicatorId, label: t.title }],
        severity: 'warning',
        source: 'ai',
      });
    }
    for (const c of response.causes ?? []) {
      if (!c.deviationId || !c.title) continue;
      out.push({
        id: `cause-${c.deviationId}`,
        kind: 'CAUSE_SUGGESTION',
        title: c.title,
        body: c.body ?? '',
        refs: [{ type: 'deviation', id: c.deviationId, label: c.title }],
        severity: 'info',
        source: 'ai',
      });
    }
    for (const a of response.actions ?? []) {
      if (!a.indicatorId || !a.title) continue;
      out.push({
        id: `action-${a.indicatorId}`,
        kind: 'ACTION_SUGGESTION',
        title: a.title,
        body: a.body ?? '',
        refs: [{ type: 'indicator', id: a.indicatorId, label: a.title }],
        severity: 'critical',
        source: 'ai',
      });
    }

    if (out.length === 0) return null;

    // Mantem ao menos o resumo + complementa com regras quando IA nao cobriu
    if (!out.some((i) => i.kind === 'WORSENING_TREND')) {
      out.push(...baseInsights.filter((i) => i.kind === 'WORSENING_TREND'));
    }
    if (!out.some((i) => i.kind === 'ACTION_SUGGESTION')) {
      out.push(...baseInsights.filter((i) => i.kind === 'ACTION_SUGGESTION'));
    }
    if (!out.some((i) => i.kind === 'CAUSE_SUGGESTION')) {
      out.push(...baseInsights.filter((i) => i.kind === 'CAUSE_SUGGESTION'));
    }
    return out;
  }

  private async buildCompanyContext(companyId: string, area: AreaScope) {
    const indicators = await this.prisma.indicator.findMany({
      where: { companyId, deletedAt: null, status: 'ACTIVE', ...this.indArea(area) },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        direction: true,
        unitLabel: true,
        unit: true,
        results: {
          orderBy: { periodDate: 'desc' },
          take: 6,
          select: { periodRef: true, value: true, light: true, attainment: true },
        },
      },
      take: 30,
    });

    const openDeviations = await this.prisma.deviation.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: [DeviationStatus.OPEN, DeviationStatus.IN_ANALYSIS, DeviationStatus.WAITING_ACTION] },
        ...(area ? { indicator: { ownerNodeId: { in: area } } } : {}),
      },
      select: {
        id: true,
        number: true,
        severity: true,
        status: true,
        rootCause: true,
        indicator: { select: { id: true, name: true, type: true } },
      },
      take: 10,
    });

    return { indicators, openDeviations };
  }

  private buildInsightsPrompt(ctx: Awaited<ReturnType<typeof this.buildCompanyContext>>): string {
    const indicatorsSnap = ctx.indicators.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      type: i.type,
      direction: i.direction,
      unit: i.unitLabel ?? i.unit,
      latest: i.results.map((r) => ({
        periodRef: r.periodRef,
        value: r.value,
        light: r.light,
        attainment: r.attainment,
      })),
    }));
    const deviationsSnap = ctx.openDeviations.map((d) => ({
      id: d.id,
      number: d.number,
      severity: d.severity,
      status: d.status,
      rootCause: d.rootCause,
      indicator: { id: d.indicator.id, name: d.indicator.name, type: d.indicator.type },
    }));

    return `Voce e um consultor senior de gestao de performance. Analise os indicadores abaixo
e produza insights acionaveis em portugues do Brasil. Use linguagem objetiva, foco em decisao gerencial.

Calcule tendencia observando os ultimos 3 periodos com dado (do mais recente para o mais antigo). Considere
"direction" do indicador: HIGHER_BETTER = maior e melhor, LOWER_BETTER = menor e melhor.

Responda no schema JSON:
{
  "summary": "Resumo executivo do periodo em 3-5 frases.",
  "trends": [
    { "indicatorId": "...", "title": "Tendencia de piora: <nome>", "body": "Explicacao 2-3 frases com numeros." }
  ],
  "causes": [
    { "deviationId": "...", "title": "Causas para desvio #X", "body": "3 hipoteses praticas com bullet points." }
  ],
  "actions": [
    { "indicatorId": "...", "title": "Acoes recomendadas: <nome>", "body": "3 acoes 5W2H curtas com bullet points." }
  ]
}

Regras:
- Limite trends, causes e actions a no maximo 4 itens cada.
- Inclua trends apenas para indicadores com queda real do atingimento em 3+ periodos.
- Inclua causes apenas para os desvios fornecidos.
- Inclua actions para os 3-4 indicadores em pior situacao.

INDICADORES (JSON):
${JSON.stringify(indicatorsSnap, null, 2)}

DESVIOS ABERTOS (JSON):
${JSON.stringify(deviationsSnap, null, 2)}`;
  }
}

function pct(v: number) {
  return `${Math.round(v * 1000) / 10}%`;
}
