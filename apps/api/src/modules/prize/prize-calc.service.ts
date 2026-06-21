import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { PrizeAuditService } from './prize-audit.service';
import { commercialDaysFromAdmission, computePrize, deriveEntitledDays, EngineIndicator, EngineInput, PRIZE_ENGINE_VERSION } from './prize-calc-engine';
import { selectRangesForParameter } from './prize-evaluation';
import { computeV2Individual, evaluateV2Cell } from './prize-v2-engine';
import { matchInherited, normalizeRuleKey, pickInheritedParam } from './prize-rule-matrix.util';

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

    const [snapshot, indicators, actuals, events, moderatorRules, adjustments, exceptions, allocations, effectiveVersions, program] = await Promise.all([
      this.prisma.prizeEmployeeSnapshot.findMany({ where: { companyId: me.companyId, competenceId, current: true } }),
      this.prisma.prizeIndicator.findMany({ where: { companyId: me.companyId, programId: competence.programId, deletedAt: null }, include: { ranges: true } }),
      this.prisma.prizeActualResult.findMany({ where: { companyId: me.companyId, competenceId } }),
      this.prisma.prizeEmployeeEvent.findMany({ where: { companyId: me.companyId, competenceId } }),
      this.prisma.prizeModeratorRule.findMany({ where: { companyId: me.companyId, active: true, OR: [{ programId: null }, { programId: competence.programId }] } }),
      this.prisma.prizeManualAdjustment.findMany({ where: { companyId: me.companyId, competenceId, status: 'APPROVED' } }),
      this.prisma.prizeException.findMany({ where: { companyId: me.companyId, competenceId, status: 'APPROVED' } }),
      this.prisma.prizeTemporaryAllocation.findMany({ where: { companyId: me.companyId, competenceId } }),
      this.prisma.prizeAnnexVersion.findMany({ where: { status: 'EFFECTIVE', annex: { companyId: me.companyId, programId: competence.programId } }, include: { annex: true } }),
      this.prisma.prizeProgram.findFirst({ where: { id: competence.programId, companyId: me.companyId } }),
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
    const allocByReg = new Map<string, typeof allocations>();
    for (const al of allocations) { const arr = allocByReg.get(al.registration) ?? []; arr.push(al); allocByReg.set(al.registration, arr); }

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
          // Faixas vigentes da competencia: as vinculadas ao parametro do
          // realizado (indicador com metas/faixas mensais) ou as globais.
          const ranges = selectRangesForParameter(i.ranges, act?.parameterId);
          return {
            indicatorId: i.id, code: i.code, name: i.name, kind: i.kind as any, direction: i.direction as any, weight: num(i.weight),
            realized: act ? num(act.realized) : null,
            target: null, zero: null,
            ranges: ranges.map((r) => ({ orderIndex: r.orderIndex, minLimit: num(r.minLimit), maxLimit: num(r.maxLimit), achievementPercent: num(r.achievementPercent), gainPercent: num(r.gainPercent) })),
          };
        });
        // metas/zeros do parametro vinculado ao realizado
        for (const ind of engInds) {
          const act = actualByIndicator.get(ind.indicatorId);
          if (act?.parameterId) {
            const p = await this.prisma.prizeIndicatorParameter.findFirst({
              where: { id: act.parameterId, indicator: { companyId: me.companyId } },
            });
            ind.target = p ? num(p.target) : null;
            ind.zero = p ? num(p.zero) : null;
          }
        }

        const exc = (excByReg.get(emp.registration) ?? [])[0];
        let historicalAverage: number | null = null;
        if (exc?.type === 'IMPOSSIBILITY') historicalAverage = await this.historicalAverage(me.companyId, competence.programId, emp.registration, exc.avgMonths ?? 6, competenceId);

        // Dias de direito (regra da planilha): usa o valor importado quando
        // existe; senao deriva = base 30 comercial (ajustada pela admissao no
        // mes) − dias de eventos de ausencia. Atestado nao reduz dias (modera).
        const empEvents = (eventsByReg.get(emp.registration) ?? []).map((e) => ({
          type: e.type,
          days: e.days ?? null,
          date: e.date ? e.date.toISOString().slice(0, 10) : null,
        }));
        const entitledDays = emp.workedDays ?? deriveEntitledDays(
          commercialDaysFromAdmission(emp.admissionDate, competence.year, competence.month),
          empEvents,
        );

        const input: EngineInput = {
          registration: emp.registration, name: emp.name,
          baseSalary: num(emp.baseSalary), salaryPercent: num(annexVersion?.salaryPercent), gainPotential: num(annexVersion?.gainPotential),
          workedDays: entitledDays,
          indicators: engInds,
          events: empEvents,
          moderatorRules: moderatorRules.map((r) => ({ name: r.name, eventType: r.eventType, criterion: r.criterion, reductionPercent: num(r.reductionPercent), reductionValue: num(r.reductionValue), cap: num(r.cap), cumulative: r.cumulative, priority: r.priority })),
          adjustments: (adjByReg.get(emp.registration) ?? []).map((a) => ({ field: a.field, amount: num(a.amount) })),
          exception: exc ? { type: exc.type as any, avgMonths: exc.avgMonths, gratificationValue: num(exc.gratificationValue) } : null,
          allocations: (allocByReg.get(emp.registration) ?? []).map((a) => ({ destArea: a.destArea, destPosition: a.destPosition, days: a.days, ruleApplied: a.ruleApplied, hasRight: a.hasRight })),
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

  async runV2(me: AuthPayload, competenceId: string, reason?: string) {
    const competence = await this.prisma.prizeCompetence.findFirst({ where: { id: competenceId, companyId: me.companyId } });
    if (!competence) throw new NotFoundException('Competencia nao encontrada');

    const [
      snapshot,
      effectiveVersions,
      catalogActuals,
      aliases,
      events,
      moderatorRules,
      adjustments,
      program,
    ] = await Promise.all([
      this.prisma.prizeEmployeeSnapshot.findMany({ where: { companyId: me.companyId, competenceId, current: true } }),
      this.prisma.prizeAnnexVersion.findMany({
        where: { status: 'EFFECTIVE', annex: { companyId: me.companyId, programId: competence.programId } },
        include: {
          annex: true,
          ruleGroups: {
            where: { active: true, deletedAt: null },
            include: {
              indicators: {
                where: { active: true, deletedAt: null },
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                include: {
                  catalog: true,
                  parameters: {
                    where: { year: competence.year, month: competence.month },
                    include: { bands: { orderBy: { orderIndex: 'asc' } } },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.prizeCatalogActualResult.findMany({ where: { companyId: me.companyId, competenceId } }),
      this.prisma.prizeRuleAlias.findMany({ where: { companyId: me.companyId, active: true } }),
      this.prisma.prizeEmployeeEvent.findMany({ where: { companyId: me.companyId, competenceId } }),
      this.prisma.prizeModeratorRule.findMany({ where: { companyId: me.companyId, active: true, OR: [{ programId: null }, { programId: competence.programId }] } }),
      this.prisma.prizeManualAdjustment.findMany({ where: { companyId: me.companyId, competenceId, status: 'APPROVED' } }),
      this.prisma.prizeProgram.findFirst({ where: { id: competence.programId } }),
    ]);

    if (snapshot.length === 0) throw new BadRequestException('Importe a base elegivel (Apdata) antes de apurar');

    const groups = effectiveVersions.flatMap((version) =>
      version.ruleGroups.map((group) => ({ ...group, annexVersionId: version.id, annex: version.annex })),
    );
    if (groups.length === 0) {
      throw new BadRequestException('Cadastre regras v2 em matriz para pelo menos um anexo vigente antes de rodar a apuracao do setor');
    }

    // Fallback hibrido: quando a combinacao nao tem parametro v2 para o mes,
    // herda zero/meta/faixas do indicador v1 (PrizeIndicator) casado por
    // platformIndicatorId/nome.
    const ruleCatalogs = new Map<string, { platformIndicatorId: string | null; name: string }>();
    for (const g of groups) for (const ri of g.indicators) if (ri.catalog) ruleCatalogs.set(ri.catalogId, { platformIndicatorId: ri.catalog.platformIndicatorId, name: ri.catalog.name });
    const cats = [...ruleCatalogs.values()];
    const v1PlatformIds = cats.map((c) => c.platformIndicatorId).filter((v): v is string => !!v);
    const v1Names = cats.map((c) => c.name).filter(Boolean);
    const v1Indicators = ruleCatalogs.size
      ? await this.prisma.prizeIndicator.findMany({
          where: {
            companyId: me.companyId,
            deletedAt: null,
            OR: [
              ...(v1PlatformIds.length ? [{ platformIndicatorId: { in: v1PlatformIds } }] : []),
              ...(v1Names.length ? [{ name: { in: v1Names } }] : []),
            ],
          },
          include: { parameters: true, ranges: { orderBy: { orderIndex: 'asc' } } },
        })
      : [];
    const inheritedByCatalog = new Map<string, (typeof v1Indicators)[number]>();
    for (const [catalogId, cat] of ruleCatalogs) {
      const m = matchInherited(cat, v1Indicators);
      if (m) inheritedByCatalog.set(catalogId, m);
    }

    const lastRun = await this.prisma.prizeCalculationRun.aggregate({ where: { competenceId }, _max: { version: true } });
    const version = (lastRun._max.version ?? 0) + 1;
    await this.prisma.prizeCalculationRun.updateMany({
      where: { competenceId, status: { in: ['SUCCESS', 'PARTIAL', 'ERROR'] } },
      data: { status: 'SUPERSEDED' },
    });
    const run = await this.prisma.prizeCalculationRun.create({
      data: {
        companyId: me.companyId,
        competenceId,
        version,
        status: 'RUNNING',
        engineVersion: `${PRIZE_ENGINE_VERSION}-v2`,
        params: { roundingRule: program?.roundingRule ?? 'HALF_UP_2', periodDays: 30, model: 'MATRIX_RULES' },
        startedAt: new Date(),
        createdById: me.sub,
        reason: reason ?? null,
      },
    });

    const actualByCatalog = new Map(catalogActuals.map((actual) => [actual.catalogId, actual]));
    const cellRows: Prisma.PrizeCellResultCreateManyInput[] = [];
    type CellEntry = { groupId: string; possibleSalaryPercent: number; achievedSalaryPercent: number; groupName: string };
    const cellIndex = new Map<string, Array<CellEntry>>();
    // Indice por ID do catalogo (areaRefId::cargoRefId) — casamento deterministico.
    const cellIndexById = new Map<string, Array<CellEntry>>();
    let pendingCells = 0;

    for (const group of groups) {
      const areaRefs = group.areaRefs.length ? group.areaRefs : ['*'];
      const positionRefs = group.positionRefs.length ? group.positionRefs : ['*'];
      const possibleSalaryPercent = num(group.salaryPercent) ?? 0;
      const output = evaluateV2Cell({
        possibleSalaryPercent,
        indicators: group.indicators.map((indicator) => {
          const parameter = indicator.parameters[0] ?? null;
          const actual = actualByCatalog.get(indicator.catalogId);
          // Sem parametro v2 na combinacao -> herda do indicador v1.
          const inherited = parameter ? null : inheritedByCatalog.get(indicator.catalogId);
          const inhParam = inherited ? pickInheritedParam(inherited.parameters, competence.year, competence.month, indicator.type === 'FIXED') : null;
          const bands = parameter
            ? (parameter.bands ?? []).map((band) => ({ orderIndex: band.orderIndex, minLimit: num(band.minLimit), maxLimit: num(band.maxLimit), achievementPercent: num(band.achievementPercent), gainPercent: num(band.gainPercent) }))
            : (inherited?.ranges ?? []).map((r) => ({ orderIndex: r.orderIndex, minLimit: num(r.minLimit), maxLimit: num(r.maxLimit), achievementPercent: num(r.achievementPercent), gainPercent: num(r.gainPercent) }));
          return {
            code: indicator.catalog.code,
            name: indicator.catalog.name,
            direction: indicator.catalog.direction as any,
            weight: num(indicator.weight) ?? 0,
            realized: actual ? num(actual.realized) : null,
            zero: parameter ? num(parameter.zero) : (inhParam ? num(inhParam.zero) : null),
            target: parameter ? num(parameter.target) : (inhParam ? num(inhParam.target) : null),
            bands,
          };
        }),
      });
      if (output.pending) pendingCells += areaRefs.length * positionRefs.length;
      for (const areaRef of areaRefs) {
        for (const positionRef of positionRefs) {
          const normalizedAreaKey = normalizeRuleKey(areaRef);
          const normalizedPositionKey = normalizeRuleKey(positionRef);
          const key = this.cellKey(normalizedAreaKey, normalizedPositionKey);
          const indexed = cellIndex.get(key) ?? [];
          indexed.push({
            groupId: group.id,
            possibleSalaryPercent: output.possibleSalaryPercent,
            achievedSalaryPercent: output.achievedSalaryPercent,
            groupName: group.name,
          });
          cellIndex.set(key, indexed);
          cellRows.push({
            companyId: me.companyId,
            runId: run.id,
            competenceId,
            groupId: group.id,
            annexVersionId: group.annexVersionId,
            areaRef,
            positionRef,
            normalizedAreaKey,
            normalizedPositionKey,
            possibleSalaryPercent: output.possibleSalaryPercent,
            achievedSalaryPercent: output.achievedSalaryPercent,
            weightedGainPercent: output.weightedGainPercent,
            status: output.pending ? 'PENDING_INPUT' : 'CALCULATED',
            details: output as unknown as Prisma.InputJsonValue,
          });
        }
      }
      // Indexa a celula por ID do catalogo (todas as combinacoes area×cargo de IDs do grupo).
      const idEntry: CellEntry = { groupId: group.id, possibleSalaryPercent: output.possibleSalaryPercent, achievedSalaryPercent: output.achievedSalaryPercent, groupName: group.name };
      for (const aid of group.areaRefIds) {
        for (const cid of group.cargoRefIds) {
          const k = `${aid}::${cid}`;
          const arr = cellIndexById.get(k) ?? [];
          arr.push(idEntry);
          cellIndexById.set(k, arr);
        }
      }
    }

    if (cellRows.length === 0) {
      await this.prisma.prizeCalculationRun.update({
        where: { id: run.id },
        data: { status: 'ERROR', errorsCount: 1, finishedAt: new Date(), params: { reason: 'NO_CELLS' } },
      });
      throw new BadRequestException('As regras v2 nao geraram nenhuma celula area x cargo');
    }
    await this.prisma.prizeCellResult.createMany({ data: cellRows });

    if (pendingCells > 0) {
      const finished = await this.prisma.prizeCalculationRun.update({
        where: { id: run.id },
        data: { status: 'ERROR', errorsCount: pendingCells, finishedAt: new Date() },
      });
      await this.audit.log(me, { action: 'CALC_RUN_V2_BLOCKED', entityType: 'CALC_RUN', entityId: run.id, competenceId, after: { pendingCells } });
      return { ...finished, pendingCells, blockedReason: 'Existem celulas com realizado, zero, meta ou faixas pendentes' };
    }

    const unmatchedRows: Prisma.PrizeUnmatchedEmployeeCreateManyInput[] = [];
    let ambiguousCount = 0;
    const employeeMatch = new Map<string, { groupId: string; possibleSalaryPercent: number; achievedSalaryPercent: number; groupName: string }>();
    for (const emp of snapshot) {
      if (emp.blocked || !emp.eligible) continue;
      const matchedByGroup = new Map<string, CellEntry>();
      // 1) PREFERE casamento por ID do catalogo (deterministico): a "area" da
      //    combinacao casa com a area OU o setor do colaborador (mesmo ID), + cargo.
      if (emp.cargoRefId) {
        for (const aid of [emp.areaRefId, emp.sectorRefId]) {
          if (!aid) continue;
          for (const cell of cellIndexById.get(`${aid}::${emp.cargoRefId}`) ?? []) matchedByGroup.set(cell.groupId, cell);
        }
      }
      // 2) Fallback por NOME (area/setor/centro de custo + de-para) quando nao ha ID
      //    no colaborador ou na combinacao. Ex.: base antiga sem catalogo linkado.
      let areaCandidates: string[] = [];
      let normalizedPositionKey = '';
      if (matchedByGroup.size === 0) {
        normalizedPositionKey = this.resolveRuleKey(emp.positionRef, 'POSITION', aliases);
        areaCandidates = Array.from(new Set(
          [
            this.resolveRuleKey(emp.areaRef, 'AREA', aliases),
            this.resolveRuleKey(emp.sectorRef, 'AREA', aliases),
            this.resolveRuleKey(emp.costCenterRef, 'AREA', aliases),
          ].filter(Boolean),
        ));
        for (const ak of areaCandidates) {
          for (const cell of cellIndex.get(this.cellKey(ak, normalizedPositionKey)) ?? []) matchedByGroup.set(cell.groupId, cell);
        }
      }
      const matches = [...matchedByGroup.values()];
      if (matches.length === 1) {
        employeeMatch.set(emp.registration, matches[0]);
      } else {
        const ambiguous = matches.length > 1;
        if (ambiguous) ambiguousCount++;
        unmatchedRows.push({
          companyId: me.companyId,
          runId: run.id,
          competenceId,
          registration: emp.registration,
          name: emp.name,
          areaRef: emp.areaRef,
          positionRef: emp.positionRef,
          normalizedAreaKey: areaCandidates[0] ?? normalizeRuleKey(emp.areaRef),
          normalizedPositionKey: normalizedPositionKey || normalizeRuleKey(emp.positionRef),
          reason: ambiguous ? 'Mais de uma combinacao area-cargo aplicavel' : 'Sem combinacao area-cargo aplicavel (fora do escopo da regua)',
        });
      }
    }

    // Persiste os nao-casados como worklist (aba "Nao casados"). Os "fora do
    // escopo" (0 combinacoes) sao informativos: a apuracao por setor roda so
    // para quem tem regra e os demais ficam listados para configuracao futura.
    if (unmatchedRows.length > 0) {
      await this.prisma.prizeUnmatchedEmployee.createMany({ data: unmatchedRows });
    }
    // Bloqueio APENAS por ambiguidade (config errada: 2+ combinacoes para a
    // mesma pessoa). "Fora do escopo" nao bloqueia — apura quem tem regra.
    if (ambiguousCount > 0) {
      const finished = await this.prisma.prizeCalculationRun.update({
        where: { id: run.id },
        data: { status: 'ERROR', totalEmployees: snapshot.length, errorsCount: ambiguousCount, finishedAt: new Date() },
      });
      await this.audit.log(me, { action: 'CALC_RUN_V2_BLOCKED', entityType: 'CALC_RUN', entityId: run.id, competenceId, after: { ambiguous: ambiguousCount, unmatched: unmatchedRows.length } });
      return { ...finished, ambiguous: ambiguousCount, unmatched: unmatchedRows.length, blockedReason: `${ambiguousCount} colaborador(es) com mais de uma combinacao aplicavel (ambiguidade). Ajuste as combinacoes para que cada colaborador caia em apenas uma.` };
    }
    const outOfScope = unmatchedRows.length; // 0 combinacoes — fora do escopo desta regua

    const roundingRule = program?.roundingRule ?? 'HALF_UP_2';
    const eventsByReg = new Map<string, typeof events>();
    for (const e of events) { const arr = eventsByReg.get(e.registration) ?? []; arr.push(e); eventsByReg.set(e.registration, arr); }
    const adjByReg = new Map<string, typeof adjustments>();
    for (const a of adjustments) { const arr = adjByReg.get(a.registration) ?? []; arr.push(a); adjByReg.set(a.registration, arr); }

    let totalGross = 0, totalRed = 0, totalFinal = 0, errors = 0;
    for (const emp of snapshot) {
      const match = employeeMatch.get(emp.registration);
      if (!match) continue; // apura so quem casou em exatamente uma combinacao
      try {
        const empEvents = (eventsByReg.get(emp.registration) ?? []).map((e) => ({
          type: e.type,
          days: e.days ?? null,
          date: e.date ? e.date.toISOString().slice(0, 10) : null,
        }));
        const entitledDays = emp.workedDays ?? deriveEntitledDays(
          commercialDaysFromAdmission(emp.admissionDate, competence.year, competence.month),
          empEvents,
        );
        // match garante elegivel e nao bloqueado (os demais caem no continue acima).
        const blockedReason = emp.blocked || !emp.eligible ? 'Colaborador bloqueado/nao elegivel' : null;

        const out = computeV2Individual({
          registration: emp.registration,
          name: emp.name,
          baseSalary: num(emp.baseSalary),
          possibleSalaryPercent: match.possibleSalaryPercent,
          achievedSalaryPercent: match.achievedSalaryPercent,
          entitledDays,
          events: empEvents,
          moderatorRules: moderatorRules.map((r) => ({ name: r.name, eventType: r.eventType, criterion: r.criterion, reductionPercent: num(r.reductionPercent), reductionValue: num(r.reductionValue), cap: num(r.cap), cumulative: r.cumulative, priority: r.priority })),
          adjustments: (adjByReg.get(emp.registration) ?? []).map((a) => ({ field: a.field, amount: num(a.amount) })),
          roundingRule,
          blockedReason,
        });

        const hash = this.hash(`${run.id}:${emp.registration}:${out.finalValue}:${out.grossValue}`);
        const result = await this.prisma.prizeCalculationResult.create({
          data: {
            companyId: me.companyId,
            runId: run.id,
            competenceId,
            registration: emp.registration,
            name: emp.name,
            baseSalary: emp.baseSalary,
            potential: out.possible,
            weightedGain: out.weightedGain,
            proportionality: Math.round((entitledDays / 30) * 10000) / 10000,
            grossValue: out.grossValue,
            totalReductions: out.totalReductions,
            adjustments: out.adjustments,
            gratification: out.gratification,
            finalValue: out.finalValue,
            blocked: out.blocked,
            blockReason: out.blockReason ?? null,
            exceptionType: out.exceptionType ?? null,
            hash,
          },
        });
        if (out.lines.length) {
          await this.prisma.prizeCalculationLine.createMany({
            data: out.lines.map((l) => ({ resultId: result.id, step: l.step, code: l.code, label: l.label, detail: l.detail ?? null, value: l.value ?? null, data: (l as any).data ?? undefined })),
          });
        }
        totalGross += out.grossValue; totalRed += out.totalReductions; totalFinal += out.finalValue;
      } catch {
        errors++;
      }
    }

    const apurados = employeeMatch.size;
    const finished = await this.prisma.prizeCalculationRun.update({
      where: { id: run.id },
      data: { status: errors > 0 ? 'PARTIAL' : 'SUCCESS', totalEmployees: apurados, totalGross, totalReductions: totalRed, totalFinal, errorsCount: errors, finishedAt: new Date() },
    });
    await this.audit.log(me, { action: 'CALC_RUN_V2', entityType: 'CALC_RUN', entityId: run.id, competenceId, after: { version, totalFinal, apurados, outOfScope, cells: cellRows.length } });
    return { ...finished, apurados, outOfScope };
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
      where: { companyId, competenceId, status: { in: ['SUCCESS', 'PARTIAL', 'ERROR'] } },
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

  private resolveRuleKey(value: string | null, kind: 'AREA' | 'POSITION', aliases: Array<any>) {
    const normalized = normalizeRuleKey(value);
    const alias = aliases.find((a) => a.kind === kind && a.normalizedKey === normalized);
    if (!alias) return normalized;
    return normalizeRuleKey(alias.canonicalRef ?? alias.canonicalName ?? value);
  }

  private cellKey(areaKey: string, positionKey: string) {
    return `${areaKey}::${positionKey}`;
  }
}
