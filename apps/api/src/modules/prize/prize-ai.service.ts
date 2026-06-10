import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GeminiService } from '../ai/gemini.service';
import { PrizeReportsService } from './prize-reports.service';

/**
 * IA assistiva do premio. SEMPRE como recomendacao — nunca altera valores, regras
 * ou status. Usa o GeminiService quando configurado; senao, retorna um resumo
 * deterministico (rule-based) para o recurso funcionar sem chave de IA.
 */
@Injectable()
export class PrizeAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly reports: PrizeReportsService,
  ) {}

  async explainMemory(companyId: string, resultId: string) {
    const result = await this.prisma.prizeCalculationResult.findFirst({
      where: { id: resultId, companyId },
      include: { lines: { orderBy: [{ step: 'asc' }, { createdAt: 'asc' }] } },
    });
    if (!result) throw new NotFoundException('Resultado não encontrado');

    const memo = result.lines.map((l) => `- ${l.label}${l.detail ? ` (${l.detail})` : ''}: ${l.value ?? ''}`).join('\n');
    const prompt = `Você é um analista de remuneração. Explique, em português claro e objetivo (máx. 6 linhas), por que ${result.name} recebeu R$ ${result.finalValue ?? 0} de prêmio, a partir da memória de cálculo abaixo. Não invente números; baseie-se apenas nos dados. Marque que é uma explicação assistida.\n\nMemória de cálculo:\n${memo}`;

    const ai = await this.gemini.generateText(prompt, { temperature: 0.2 });
    const text = ai ?? this.fallbackMemory(result);
    return { source: ai ? 'IA' : 'REGRAS', recommendation: true, text };
  }

  async summarizeCompetence(companyId: string, competenceId: string) {
    const [op, apur] = await Promise.all([
      this.reports.operational(companyId, competenceId),
      this.reports.apuracao(companyId, competenceId),
    ]);
    const pend = op.items.filter((i) => i.value > 0).map((i) => `${i.label}: ${i.value}`).join('; ');
    const prompt = `Você é um analista de remuneração. Gere um resumo executivo (máx. 8 linhas) da competência do prêmio, destacando pendências e o panorama da apuração. Não invente dados. Identifique como recomendação assistida.\n\nApuração: ${apur.rows.length} colaboradores, prêmio final total R$ ${apur.totals.final.toFixed(2)}, ${apur.totals.blocked} bloqueado(s).\nPendências: ${pend || 'nenhuma'}.`;

    const ai = await this.gemini.generateText(prompt, { temperature: 0.3 });
    const text = ai ?? this.fallbackSummary(apur, op, pend);
    return { source: ai ? 'IA' : 'REGRAS', recommendation: true, text, pendencies: op.items.filter((i) => i.value > 0) };
  }

  private fallbackMemory(result: any): string {
    const p = (v: any) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    return [
      `Explicação assistida (gerada por regras): ${result.name} (${result.registration}).`,
      `Prêmio bruto ${p(result.grossValue)}, reduções ${p(result.totalReductions)}, ajustes ${p(result.adjustments)}.`,
      result.exceptionType ? `Exceção aplicada: ${result.exceptionType}.` : '',
      result.blocked ? `Pagamento bloqueado: ${result.blockReason ?? '—'}.` : `Prêmio final ${p(result.finalValue)}.`,
      'Recomendação: confira a memória de cálculo detalhada para validação.',
    ].filter(Boolean).join(' ');
  }

  private fallbackSummary(apur: any, op: any, pend: string): string {
    return [
      `Resumo assistido (gerado por regras).`,
      `Apuração com ${apur.rows.length} colaborador(es); prêmio final total R$ ${apur.totals.final.toFixed(2)}; ${apur.totals.blocked} bloqueado(s).`,
      pend ? `Pendências: ${pend}.` : 'Sem pendências operacionais detectadas.',
      'Recomendação: trate as pendências impeditivas antes do fechamento/folha.',
    ].join(' ');
  }
}
