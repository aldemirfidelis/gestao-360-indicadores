import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { PrizeActualsService } from './prize-actuals.service';
import { PrizeAuditService } from './prize-audit.service';
import { PrizeCompetencesService } from './prize-competences.service';
import { PrizeCalcService } from './prize-calc.service';

export interface SyncSummary {
  competenceId: string;
  periodRef: string;
  linked: number; // indicadores do premio com vinculo a indicador nativo
  synced: number; // realizados gravados/atualizados nesta execucao
  unchanged: number; // ja estavam com o mesmo valor
  missingResult: Array<{ code: string; name: string }>; // vinculados sem lancamento no periodo
  unlinked: Array<{ code: string; name: string }>; // sem vinculo (continuam manuais)
}

/**
 * Automacao do realizado: sincroniza PrizeActualResult a partir do modulo
 * NATIVO de Indicadores/Lancamentos (IndicatorResult). O lancamento e feito UMA
 * vez na plataforma (UI de Lancamentos ou API externa POST /external/v1/results)
 * e flui para o premio — sem planilha, sem redigitacao, sem divergencia.
 *
 * Tambem expoe o "autopilot" da competencia: sync -> checklist -> (opcional)
 * apuracao quando nao ha pendencias impeditivas.
 */
@Injectable()
export class PrizeSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actuals: PrizeActualsService,
    private readonly competences: PrizeCompetencesService,
    private readonly calc: PrizeCalcService,
    private readonly audit: PrizeAuditService,
  ) {}

  /** Sincroniza o realizado da competencia a partir dos indicadores nativos vinculados. */
  async syncActuals(me: AuthPayload, competenceId: string): Promise<SyncSummary> {
    const competence = await this.prisma.prizeCompetence.findFirst({ where: { id: competenceId, companyId: me.companyId } });
    if (!competence) throw new NotFoundException('Competência não encontrada');
    const periodRef = competence.label; // YYYY-MM — mesmo formato de IndicatorResult.periodRef

    const prizeIndicators = await this.prisma.prizeIndicator.findMany({
      where: { companyId: me.companyId, programId: competence.programId, deletedAt: null },
      select: { id: true, code: true, name: true, platformIndicatorId: true },
    });

    const linkedIds = prizeIndicators.filter((i) => i.platformIndicatorId).map((i) => i.platformIndicatorId as string);
    const results = linkedIds.length
      ? await this.prisma.indicatorResult.findMany({
          where: { indicatorId: { in: linkedIds }, periodRef, indicator: { companyId: me.companyId } },
          select: { indicatorId: true, value: true },
        })
      : [];
    const valueByPlatformId = new Map(results.map((r) => [r.indicatorId, r.value]));

    const existing = await this.prisma.prizeActualResult.findMany({
      where: { companyId: me.companyId, competenceId, scopeKey: '', week: 0, day: 0 },
      select: { indicatorId: true, realized: true },
    });
    const currentByPrizeId = new Map(existing.map((e) => [e.indicatorId, e.realized === null ? null : Number(e.realized)]));

    const summary: SyncSummary = { competenceId, periodRef, linked: 0, synced: 0, unchanged: 0, missingResult: [], unlinked: [] };

    for (const ind of prizeIndicators) {
      if (!ind.platformIndicatorId) {
        summary.unlinked.push({ code: ind.code, name: ind.name });
        continue;
      }
      summary.linked++;
      const value = valueByPlatformId.get(ind.platformIndicatorId);
      if (value === undefined) {
        summary.missingResult.push({ code: ind.code, name: ind.name });
        continue;
      }
      if (currentByPrizeId.get(ind.id) === value) {
        summary.unchanged++;
        continue;
      }
      // Reusa o launch oficial: respeita travas de competencia/realizado fechado,
      // resolve o parametro vigente e grava trilha de auditoria.
      await this.actuals.launch(me, competenceId, {
        indicatorId: ind.id,
        realized: value,
        comment: `Sincronizado do indicador da plataforma (período ${periodRef})`,
        justification: 'Sincronização automática (Lançamentos → Prêmio)',
      });
      summary.synced++;
    }

    await this.audit.log(me, {
      action: 'SYNC_ACTUALS',
      entityType: 'COMPETENCE',
      entityId: competenceId,
      competenceId,
      after: { synced: summary.synced, unchanged: summary.unchanged, missing: summary.missingResult.length },
    });
    return summary;
  }

  /**
   * Autopilot: executa o maximo do ciclo sem intervencao — sincroniza o realizado,
   * roda o checklist e, se nao houver pendencias impeditivas e runCalc=true,
   * dispara a apuracao. Nunca fecha competencia nem publica nada sozinho.
   */
  async autopilot(me: AuthPayload, competenceId: string, opts: { runCalc?: boolean } = {}) {
    const sync = await this.syncActuals(me, competenceId);
    const checklist = await this.competences.checklist(me.companyId, competenceId);
    let calcRun: unknown = null;
    let calcSkipped: string | null = null;
    if (opts.runCalc) {
      if (checklist.blockingPending > 0) {
        calcSkipped = `${checklist.blockingPending} pendência(s) impeditiva(s) no checklist`;
      } else {
        calcRun = await this.calc.run(me, competenceId, 'Autopilot: apuração automática pós-sincronização');
      }
    }
    return { sync, checklist, calcRun, calcSkipped };
  }
}
