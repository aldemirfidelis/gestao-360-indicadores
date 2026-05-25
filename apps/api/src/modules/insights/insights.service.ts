import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionStatus, DeviationStatus, TrafficLight } from '@prisma/client';

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

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(companyId: string): Promise<InsightItem[]> {
    const out: InsightItem[] = [];

    // 1) Resumo executivo
    const summary = await this.executiveSummary(companyId);
    out.push(summary);

    // 2) Indicadores em tendência de piora
    const worsening = await this.worsening(companyId);
    out.push(...worsening);

    // 3) Sugestões de causa para desvios abertos
    const causes = await this.causeSuggestions(companyId);
    out.push(...causes);

    // 4) Sugestões de ação para indicadores vermelhos
    const actions = await this.actionSuggestions(companyId);
    out.push(...actions);

    return out;
  }

  private async executiveSummary(companyId: string): Promise<InsightItem> {
    const last = await this.prisma.indicatorResult.findMany({
      where: { indicator: { companyId, deletedAt: null } },
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
      },
    });
    const criticalDev = await this.prisma.deviation.count({
      where: { companyId, deletedAt: null, severity: 'CRITICAL', status: { notIn: [DeviationStatus.CLOSED, DeviationStatus.CLOSED_LATE, DeviationStatus.CANCELLED] } },
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

  private async worsening(companyId: string): Promise<InsightItem[]> {
    const indicators = await this.prisma.indicator.findMany({
      where: { companyId, deletedAt: null, status: 'ACTIVE' },
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
      const [c, b, a] = i.results; // c=mais recente, a=mais antigo
      if (a.attainment === null || b.attainment === null || c.attainment === null) continue;
      // tendência de piora se 3 valores em declinio
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

  private async causeSuggestions(companyId: string): Promise<InsightItem[]> {
    const devs = await this.prisma.deviation.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: [DeviationStatus.OPEN, DeviationStatus.IN_ANALYSIS] },
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

  private async actionSuggestions(companyId: string): Promise<InsightItem[]> {
    const reds = await this.prisma.indicatorResult.findMany({
      where: { indicator: { companyId, deletedAt: null }, light: 'RED' },
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
}

function pct(v: number) {
  return `${Math.round(v * 1000) / 10}%`;
}
