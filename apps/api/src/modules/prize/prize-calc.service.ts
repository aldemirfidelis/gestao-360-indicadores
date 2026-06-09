import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { PrizeAuditService } from './prize-audit.service';
import { computePrize, EngineIndicator, EngineInput, PRIZE_ENGINE_VERSION } from './prize-calc-engine';

function num(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/**
 * Orquestra a apuracao: carrega snapshot elegivel, anexo vigente, indicadores,
 * realizado, eventos, regras de moderador, ajustes/excecoes aprovados; roda o
 * motor PURO por colaborador e persiste run/result/line (memoria de calculo).
 * Reprocesso e versionado (run anterior -> SUPERSEDED), nunca sobrescreve.
 */
@Injectable()
export class PrizeCalcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PrizeAuditService,
  ) {}

  async run(me: AuthPayload, competenceId: string, reason?: string) {
    const competence = await this.prisma.prizeCompetence.findFirst({ where: { id: competenceId, companyId: me.companyId } });
    if (!competence) throw new NotFoundException('Competência não encontrada');

    const [snapshot, indicators, actuals, events, moderatorRules, adjustments, exceptions, effectiveVersions, program] = await Promise.all([
      this.prisma.prizeEmployeeSnapshot.findMany({ where: { companyId: me.companyId, competenceId, current: true } }),
      this.prisma.prizeIndicator.findMany({ where: { companyId: me.companyId, programId: competence.programId, deletedAt: null }, include: { ranges: true } }),
      this.prisma.prizeActualResult.findMany({ where: { companyId: me.companyId, competenceId } }),
      this.prisma.prizeEmployeeEvent.findMany({ where: { companyId: me.companyId, competenceId } }),
      this.prisma.prizeModeratorRule.findMany({ where: { companyId: me.companyId, active: true, OR: [{ programId: null }, { programId: competence.programId }] } }),
      this.prisma.prizeManualAdjustment.findMany({ where: { companyId: me.companyId, competenceId, status: 'APPROVED' } }),
      this.prisma.prizeException.findMany({ where: { companyId: me.companyId, competenceId, status: 'APPROVED' } }),
      this.prisma.prizeAnnexVersion.findMany({ where: { status: 'EFFECTIVE', annex: { companyId: me.companyId, programId: competence.programId } }, include: { annex: true } }),
      this.prisma.prizeProgram.findFirst({ where: { id: competence.programId } }),
    ]);

    if (snapshot.length === 0) throw new BadRequestException('Importe a base elegível (Apdata) antes de apurar');

    const roundingRule = program?.roundingRule ?? 'HALF_UP_2';
    const actualByIndicator = new Map(actuals.map((a) => [a.indicatorId, a]));
    const eventsByReg = new Map<string, typeof events>();
    for (const e of events) { const arr = eventsByReg.get(e.registration) ?? []; arr.push(e); eventsByReg.set(e.registration, arr); }
    const adjByReg = new Map<string, typeof adjustments>();
    for (const a of adjustments) { const arr = adjByReg.get(a.registration) ?? []; arr.push(a); adjByReg.set(a.registration, arr); }
    const excByReg = new Map<string, typeof exceptions>();
    for (const x of exceptions) { if (!x.registration) continue; const arr = excByReg.get(x.registration) ?? []; arr.push(x); excByReg.set(x.registration, arr); }

    // versao do run
    const lastRun = await this.prisma.prizeCalculationRun.aggregate({ where: { competenceId }, _max: { version: true } });
    const version = (lastRun._max.version ?? 0) + 1;
    await this.prisma.prizeCalculationRun.updateMany({ where: { competenceId, status: 'SUCCESS' }, data: { status: 'SUPERSEDED' } });

    const run = await this.prisma.prizeCalculationRun.create({
      data: {
        companyId: me.companyId, competenceId, version, status: 'RUNNING', engineVersion: PRIZE_ENGINE_VERSION,
        params: { roundingRule, periodDays: 30 }, startedAt: new Date(), createdById: me.sub, reason: reason ?? null,
      },
    });

    let totalGross = 0, totalRed = 0, totalFinal = 0, errors = 0;

    for (const emp of snapshot) {
      try {
        const annexVersion = this.matchAnnex(effectiveVersions, emp);
        const applicableInds = indicators.filter((i) => !i.annexVersionId || i.annexVersionId === annexVersion?.id);
        const engInds: EngineIndicator[] = applicableInds.map((i) => {
          const act = actualByIndicator.get(i.id);
          return {
            indicatorId: i.id, code: i.code, name: i.name, kind: i.kind as any, weight: num(i.weight),
            realized: act ? num(act.realized) : null,
            target: act?.parameterId ? null : null, zero: null,
            ranges: i.ranges.map((r) => ({ orderIndex: r.orderIndex, minLimit: num(r.minLimit), maxLimit: num(r.maxLimit), achievementPercent: num(r.achievementPercent), gainPercent: num(r.gainPercent) })),
          };
        });
        // metas/zeros do parametro vinculado ao realizado
        for (const ind of engInds) {
          const act = actualByIndicator.get(ind.indicatorId);
          if (act?.parameterId) {
            const p = await this.prisma.prizeIndicatorParameter.findUnique({ where: { id: act.parameterId } });
            ind.target = p ? num(p.target) : null;
            ind.zero = p ? num(p.zero) : null;
          }
        }

        const exc = (excByReg.get(emp.registration) ?? [])[0];
        let historicalAverage: number | null = null;
        if (exc?.type === 'IMPOSSIBILITY') historicalAverage = await this.historicalAverage(me.companyId, competence.programId, emp.registration, exc.avgMonths ?? 6, competenceId);

        const input: EngineInput = {
          registration: emp.registration, name: emp.name,
          baseSalary: num(emp.baseSalary), salaryPercent: num(annexVersion?.salaryPercent), gainPotential: num(annexVersion?.gainPotential),
          workedDays: emp.workedDays ?? null,
          indicators: engInds,
          events: (eventsByReg.get(emp.registration) ?? []).map((e) => ({ type: e.type, days: e.days ?? null })),
          moderatorRules: moderatorRules.map((r) => ({ name: r.name, eventType: r.eventType, criterion: r.criterion, reductionPercent: num(r.reductionPercent), reductionValue: num(r.reductionValue), cap: num(r.cap), cumulative: r.cumulative, priority: r.priority })),
          adjustments: (adjByReg.get(emp.registration) ?? []).map((a) => ({ field: a.field, amount: num(a.amount) })),
          exception: exc ? { type: exc.type as any, avgMonths: exc.avgMonths, gratificationValue: num(exc.gratificationValue) } : null,
          historicalAverage,
          blockedByService: (!annexVersion ? { reason: 'Sem anexo vigente para o contexto' } : emp.blocked || !emp.eligible ? { reason: 'Colaborador bloqueado/não elegível' } : null),
          config: { periodDays: 30, roundingRule, cap: null, floor: null },
        };

        const out = computePrize(input);
        const hash = this.hash(`${run.id}:${emp.registration}:${out.finalValue}:${out.grossValue}`);
        const result = await this.prisma.prizeCalculationResult.create({
          data: {
            companyId: me.companyId, runId: run.id, competenceId, registration: emp.registration, name: emp.name,
            baseSalary: emp.baseSalary, potential: out.potential, weightedGain: out.weightedGain, proportionality: out.proportionality,
            grossValue: out.grossValue, totalReductions: out.totalReductions, adjustments: out.adjustments, gratification: out.gratification,
            finalValue: out.finalValue, blocked: out.blocked, blockReason: out.blockReason ?? null, exceptionType: out.exceptionType ?? null, hash,
          },
        });
        if (out.lines.length) {
          await this.prisma.prizeCalculationLine.createMany({
            data: out.lines.map((l) => ({ resultId: result.id, step: l.step, code: l.code, label: l.label, detail: l.detail ?? null, value: l.value ?? null, data: (l.data as Prisma.InputJsonValue) ?? undefined })),
          });
        }
        totalGross += out.grossValue; totalRed += out.totalReductions; totalFinal += out.finalValue;
      } catch {
        errors++;
      }
    }

    const finished = await this.prisma.prizeCalculationRun.update({
      where: { id: run.id },
      data: { status: errors > 0 ? 'PARTIAL' : 'SUCCESS', totalEmployees: snapshot.length, totalGross, totalReductions: totalRed, totalFinal, errorsCount: errors, finishedAt: new Date() },
    });
    await this.audit.log(me, { action: 'CALC_RUN', entityType: 'CALC_RUN', entityId: run.id, competenceId, after: { version, totalFinal, employees: snapshot.length } });
    return finished;
  }

  async reprocess(me: AuthPayload, competenceId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Justificativa é obrigatória para reprocessar');
    return this.run(me, competenceId, reason);
  }

  /** Conferencia/aprovacao da apuracao (workflow formal sobre a competencia). */
  async conference(me: AuthPayload, competenceId: string, action: 'SUBMIT_REVIEW' | 'APPROVE' | 'REJECT', comment?: string) {
    const competence = await this.prisma.prizeCompetence.findFirst({ where: { id: competenceId, companyId: me.companyId } });
    if (!competence) throw new NotFoundException('Competência não encontrada');
    const run = await this.prisma.prizeCalculationRun.findFirst({
      where: { companyId: me.companyId, competenceId, status: { in: ['SUCCESS', 'PARTIAL'] } },
      orderBy: { version: 'desc' },
    });
    if (!run) throw new BadRequestException('Rode a apuração antes da conferência');

    if (action === 'SUBMIT_REVIEW') {
      const updated = await this.prisma.prizeCompetence.update({ where: { id: competenceId }, data: { status: 'IN_REVIEW' } });
      await this.audit.log(me, { action: 'SUBMIT_REVIEW', entityType: 'CALC_RUN', entityId: run.id, competenceId, after: { status: 'IN_REVIEW' } });
      return updated;
    }
    if (action === 'REJECT') {
      if (!comment?.trim()) throw new BadRequestException('Comentário é obrigatório ao reprovar a apuração');
      const updated = await this.prisma.prizeCompetence.update({ where: { id: competenceId }, data: { status: 'CLOSED_FOR_CALC' } });
      await this.audit.log(me, { action: 'REJECT', entityType: 'CALC_RUN', entityId: run.id, competenceId, after: { status: 'CLOSED_FOR_CALC' }, justification: comment });
      return updated;
    }
    // APPROVE — segregacao: quem rodou a apuracao nao aprova a propria
    if (run.createdById && run.createdById === me.sub) {
      throw new BadRequestException('Quem executou a apuração não pode aprová-la (segregação de função)');
    }
    const updated = await this.prisma.prizeCompetence.update({ where: { id: competenceId }, data: { status: 'APPROVED' } });
    await this.audit.log(me, { action: 'APPROVE', entityType: 'CALC_RUN', entityId: run.id, competenceId, after: { status: 'APPROVED' }, justification: comment ?? null });
    return updated;
  }

  async results(companyId: string, competenceId: string) {
    const competence = await this.prisma.prizeCompetence.findFirst({ where: { id: competenceId, companyId }, select: { status: true } });
    const run = await this.prisma.prizeCalculationRun.findFirst({
      where: { companyId, competenceId, status: { in: ['SUCCESS', 'PARTIAL'] } },
      orderBy: { version: 'desc' },
    });
    if (!run) return { run: null, results: [], competenceStatus: competence?.status ?? null };
    const results = await this.prisma.prizeCalculationResult.findMany({ where: { runId: run.id }, orderBy: { name: 'asc' } });
    return { run, results, competenceStatus: competence?.status ?? null };
  }

  async memory(companyId: string, resultId: string) {
    const result = await this.prisma.prizeCalculationResult.findFirst({ where: { id: resultId, companyId }, include: { lines: { orderBy: [{ step: 'asc' }, { createdAt: 'asc' }] } } });
    if (!result) throw new NotFoundException('Resultado não encontrado');
    return result;
  }

  // ---- helpers ----
  private matchAnnex(versions: Array<any>, emp: { positionRef: string | null; areaRef: string | null; costCenterRef: string | null }) {
    return (
      versions.find((v) => v.annex.positionRef && v.annex.positionRef === emp.positionRef) ??
      versions.find((v) => v.annex.orgNodeId && v.annex.orgNodeId === emp.areaRef) ??
      versions.find((v) => !v.annex.positionRef && !v.annex.orgNodeId) ??
      null
    );
  }

  private async historicalAverage(companyId: string, programId: string, registration: string, months: number, currentCompetenceId: string) {
    const prev = await this.prisma.prizeCalculationResult.findMany({
      where: { companyId, registration, competenceId: { not: currentCompetenceId }, run: { competenceId: { not: currentCompetenceId } } },
      orderBy: { createdAt: 'desc' },
      take: months,
      select: { finalValue: true },
    });
    if (!prev.length) return null;
    const vals = prev.map((p) => Number(p.finalValue ?? 0));
    return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100;
  }

  private hash(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return `c${(h >>> 0).toString(16)}`;
  }
}
