import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ResultsService } from '../results/results.service';
import type { AuthPayload } from '../auth/auth.types';
import { averageConformity, competenceOf, competenceRange } from './form-indicator.logic';

/**
 * Lança o resultado das inspeções no indicador correspondente.
 *
 * O indicador certo NÃO sai de (área, setor): um setor pode ter vários
 * indicadores. Quem resolve é o vínculo explícito `Indicator.formTemplateId` —
 * o par (setor, formulário) aponta para um indicador só. Ex.: setor "Colheita
 * Mecanizada" + formulário "ISSMA" → "CONF. ISSMA Colheita Mecanizada".
 *
 * A cada preenchimento concluído o mês inteiro é RECALCULADO, não incrementado:
 * o valor é a média das inspeções do período, e recalcular mantém o número
 * correto mesmo se uma inspeção antiga for corrigida ou excluída.
 */
@Injectable()
export class FormIndicatorService {
  private readonly logger = new Logger(FormIndicatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly results: ResultsService,
  ) {}

  /**
   * Recalcula e grava a média do mês do preenchimento.
   * Devolve o que foi lançado, ou `null` quando não há indicador vinculado.
   */
  async syncFromSubmission(
    me: AuthPayload,
    submission: { id: string; templateId: string; orgNodeId: string | null; completedAt: Date | null; score: number | null },
  ) {
    if (!submission.orgNodeId || !submission.templateId) return null;
    const competence = competenceOf(submission.completedAt ?? new Date());
    if (!competence) return null;

    const indicator = await this.prisma.indicator.findFirst({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ownerNodeId: submission.orgNodeId,
        formTemplateId: submission.templateId,
      },
      select: { id: true, name: true },
    });
    if (!indicator) return null;

    const range = competenceRange(competence);
    if (!range) return null;

    // Todas as inspeções daquele formulário, naquele setor, naquele mês —
    // inclusive as de outras frentes de serviço, que é o que forma a média.
    const submissions = await this.prisma.formSubmission.findMany({
      where: {
        companyId: me.companyId,
        templateId: submission.templateId,
        orgNodeId: submission.orgNodeId,
        deletedAt: null,
        completedAt: { gte: range.start, lte: range.end },
        score: { not: null },
      },
      select: { id: true, score: true },
    });

    const value = averageConformity(submissions.map((item) => item.score));
    if (value === null) return null;

    // Lançamento de AUTOMAÇÃO, não do usuário: quem preenche a inspeção em campo
    // costuma não ter permissão de escrita na área do indicador, e exigir isso
    // faria a média simplesmente não sair. A empresa continua isolada (o
    // indicador foi carregado dentro dela) e o ator fica registrado.
    await this.results.upsertSystem(
      me.companyId,
      {
        indicatorId: indicator.id,
        periodRef: competence,
        value,
        note: `Média de ${submissions.length} inspeção(ões) do período, calculada automaticamente pelo formulário.`,
      },
      me.sub,
    );

    this.logger.log(`Indicador ${indicator.name} (${competence}) = ${value}% a partir de ${submissions.length} inspeção(ões).`);
    return { indicatorId: indicator.id, indicatorName: indicator.name, competence, value, count: submissions.length };
  }
}
