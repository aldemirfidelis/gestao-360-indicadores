import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AuthPayload } from '../auth/auth.types';
import { PersonnelService } from '../personnel/personnel.service';
import { aggregatePayrollEvents, type PayrollEvents } from '../personnel/payroll.logic';
import { PayrollLegalTablesService } from './legal-tables.service';
import {
  centsToDecimalString,
  computeMonthlyWorker,
  decimalToCents,
  roundDiv,
  centsLabel,
  computeVacationWorker,
  computeThirteenthWorker,
  computeTermination,
  type TimekeepingSummary,
  type WorkerCalcResult,
} from './payroll-calc.logic';

const MODULE = 'payroll';

/** Estados em que o processamento ainda aceita importar/recalcular. */
const EDITABLE_STATUSES = ['DRAFT', 'CALCULATED', 'WITH_ISSUES', 'REOPENED'];

/** Rubricas internas semeadas por empresa (versão 1 imutável). */
const DEFAULT_RUBRIC_DEFS: Array<{ code: string; name: string; nature: string }> = [
  { code: '1000', name: 'Salário base', nature: 'PROVENTO' },
  { code: '1010', name: 'Adiantamento salarial', nature: 'PROVENTO' },
  { code: '1020', name: 'Férias gozadas', nature: 'PROVENTO' },
  { code: '1021', name: '1/3 constitucional de férias', nature: 'PROVENTO' },
  { code: '1022', name: 'Abono pecuniário', nature: 'PROVENTO' },
  { code: '1023', name: '1/3 constitucional sobre abono', nature: 'PROVENTO' },
  { code: '1030', name: '13º salário 1ª parcela', nature: 'PROVENTO' },
  { code: '1031', name: '13º salário integral', nature: 'PROVENTO' },
  { code: '1101', name: 'Horas extras 50%', nature: 'PROVENTO' },
  { code: '1102', name: 'Horas extras 100%', nature: 'PROVENTO' },
  { code: '1103', name: 'Adicional noturno 20%', nature: 'PROVENTO' },
  { code: '5010', name: 'Faltas e ausências', nature: 'DESCONTO' },
  { code: '5020', name: 'Desconto de adiantamento', nature: 'DESCONTO' },
  { code: '5030', name: 'Desconto 1ª parcela de 13º', nature: 'DESCONTO' },
  { code: '5050', name: 'Desconto empréstimo consignado', nature: 'DESCONTO' },
  { code: '5060', name: 'Desconto pensão alimentícia', nature: 'DESCONTO' },
  { code: '5100', name: 'Desconto vale transporte', nature: 'DESCONTO' },
  { code: '5110', name: 'Desconto vale alimentação', nature: 'DESCONTO' },
  { code: '5120', name: 'Desconto assistência médica', nature: 'DESCONTO' },
  { code: '5501', name: 'INSS', nature: 'DESCONTO' },
  { code: '5502', name: 'IRRF', nature: 'DESCONTO' },
  { code: '9003', name: 'FGTS (encargo do empregador)', nature: 'INFORMATIVA' },
];

@Injectable()
export class PayrollRunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
    private readonly personnel: PersonnelService,
    private readonly legalTables: PayrollLegalTablesService,
  ) {}

  // ------------------------------ competências ------------------------------

  async listCompetences(me: AuthPayload) {
    return this.prisma.payrollCompetence.findMany({
      where: { companyId: me.companyId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: { runs: { select: { id: true, kind: true, status: true, updatedAt: true }, orderBy: { createdAt: 'desc' } } },
    });
  }

  async createCompetence(me: AuthPayload, body: any = {}) {
    const year = Number(body?.year);
    const month = Number(body?.month);
    if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('Ano/mês inválidos.');
    }
    const exists = await this.prisma.payrollCompetence.findUnique({
      where: { companyId_year_month: { companyId: me.companyId, year, month } },
    });
    if (exists) throw new ConflictException('Competência já existe.');
    const created = await this.prisma.payrollCompetence.create({
      data: { companyId: me.companyId, year, month, createdById: me.sub, notes: String(body?.notes ?? '').trim() || null },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollCompetence',
      entityId: created.id,
      action: 'CREATE',
      message: `Competência de folha ${year}-${String(month).padStart(2, '0')} criada`,
    });
    return created;
  }

  // ------------------------------ processamentos ------------------------------

  async createRun(me: AuthPayload, body: any = {}) {
    const competence = await this.competenceOf(me.companyId, String(body?.competenceId ?? ''));
    if (competence.status === 'CLOSED') throw new ConflictException('Competência fechada.');
    const kind = String(body?.kind ?? 'MENSAL');
    const allowedKinds = ['MENSAL', 'ADIANTAMENTO', 'FERIAS', 'DECIMO_TERCEIRO_1', 'DECIMO_TERCEIRO_2', 'RESCISAO'];
    if (!allowedKinds.includes(kind)) {
      throw new BadRequestException(`Suportados apenas os processamentos: ${allowedKinds.join(', ')}.`);
    }
    const run = await this.prisma.payrollRun.create({
      data: { companyId: me.companyId, competenceId: competence.id, kind, createdById: me.sub },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollRun',
      entityId: run.id,
      action: 'CREATE',
      message: `Processamento ${kind} criado para ${competence.year}-${String(competence.month).padStart(2, '0')}`,
    });
    return run;
  }

  async getRun(me: AuthPayload, id: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, companyId: me.companyId },
      include: { competence: true },
    });
    if (!run) throw new NotFoundException('Processamento não encontrado.');
    const [workers, snapshotCount] = await Promise.all([
      this.prisma.payrollRunWorker.findMany({
        where: { runId: id },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      }),
      this.prisma.payrollTimekeepingSnapshot.count({ where: { runId: id } }),
    ]);
    const employees = await this.prisma.orgEmployee.findMany({
      where: { id: { in: workers.map((worker) => worker.employeeId) } },
      select: { id: true, name: true, registrationId: true, job: { select: { name: true } } },
    });
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
    return {
      ...run,
      snapshotCount,
      workers: workers
        .map((worker) => ({ ...worker, employee: employeeById.get(worker.employeeId) ?? null }))
        .sort((a, b) => (a.employee?.name ?? '').localeCompare(b.employee?.name ?? '', 'pt-BR')),
    };
  }

  /**
   * Importa e CONGELA o resumo do ponto por colaborador (snapshot com hash).
   * Mudanças posteriores no ponto não alteram a folha — exigem nova importação.
   */
  async importTimekeeping(me: AuthPayload, runId: string) {
    const run = await this.runOf(me.companyId, runId);
    this.assertEditable(run.status);
    const competence = await this.competenceOf(me.companyId, run.competenceId);
    const ref = `${competence.year}-${String(competence.month).padStart(2, '0')}`;

    const employees = await this.prisma.orgEmployee.findMany({
      where: { companyId: me.companyId, status: 'ACTIVE' },
      select: { id: true, name: true, personnelProfile: { select: { userId: true } } },
      orderBy: { name: 'asc' },
    });
    if (!employees.length) throw new BadRequestException('Nenhum colaborador ativo na base da empresa.');

    const snapshots: Array<{ employeeId: string; userId: string | null; data: object; hash: string }> = [];
    for (const employee of employees) {
      const userId = employee.personnelProfile?.userId ?? null;
      let events: PayrollEvents & { noTimeClock?: boolean };
      if (userId) {
        const days = await this.personnel.payrollDaysForUser(me.companyId, userId, ref);
        events = aggregatePayrollEvents(days);
      } else {
        events = { normalMinutes: 0, he50Minutes: 0, he100Minutes: 0, nightMinutes: 0, absentMinutes: 0, holidayWorkedMinutes: 0, balanceMinutes: 0, workedDays: 0, absentDays: 0, noTimeClock: true };
      }
      snapshots.push({
        employeeId: employee.id,
        userId,
        data: events as object,
        hash: createHash('sha256').update(`${ref}:${employee.id}:${JSON.stringify(events)}`).digest('hex'),
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payrollTimekeepingSnapshot.deleteMany({ where: { runId } });
      await tx.payrollTimekeepingSnapshot.createMany({
        data: snapshots.map((snapshot) => ({ companyId: me.companyId, runId, ...snapshot, data: snapshot.data as object })),
      });
      await tx.payrollRun.update({ where: { id: runId }, data: { status: 'DRAFT' } });
    }, { timeout: 120_000, maxWait: 20_000 });

    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollRun',
      entityId: runId,
      action: 'TIMEKEEPING_IMPORTED',
      message: `Ponto congelado para ${snapshots.length} colaborador(es) em ${ref}`,
      after: { employees: snapshots.length },
    });
    return { imported: snapshots.length, withoutTimeClock: snapshots.filter((snapshot) => (snapshot.data as { noTimeClock?: boolean }).noTimeClock).length };
  }

  /** Calcula a folha do processamento a partir dos snapshots congelados. */
  async calculate(me: AuthPayload, runId: string) {
    const run = await this.runOf(me.companyId, runId);
    this.assertEditable(run.status);
    const competence = await this.competenceOf(me.companyId, run.competenceId);
    const lastDay = new Date(Date.UTC(competence.year, competence.month, 0)).getUTCDate();
    const endKey = `${competence.year}-${String(competence.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const snapshots = await this.prisma.payrollTimekeepingSnapshot.findMany({ where: { runId } });
    if (!snapshots.length) throw new BadRequestException('Importe o ponto antes de calcular.');
    const employeeIds = snapshots.map((snapshot) => snapshot.employeeId);

    const [
      tables,
      salaries,
      settings,
      dependents,
      profiles,
      rubricVersionByCode,
      benefitEnrollments,
      loans,
      pensions,
      vacationRequests,
      thirteenth1stWorkers,
    ] = await Promise.all([
      this.legalTables.tablesFor(me.companyId, endKey),
      this.prisma.compensationSalarySnapshot.findMany({
        where: { companyId: me.companyId, employeeId: { in: employeeIds }, effectiveFrom: { lte: new Date(`${endKey}T23:59:59Z`) } },
        orderBy: { effectiveFrom: 'desc' },
        select: { employeeId: true, currentSalary: true },
      }),
      this.prisma.payrollWorkerSettings.findMany({ where: { companyId: me.companyId, employeeId: { in: employeeIds } } }),
      this.prisma.employeeDependent.groupBy({
        by: ['employeeId'],
        where: { companyId: me.companyId, employeeId: { in: employeeIds }, isIrDependent: true },
        _count: { _all: true },
      }),
      this.prisma.personnelEmployeeProfile.findMany({
        where: { companyId: me.companyId, employeeId: { in: employeeIds } },
        select: { employeeId: true, contractType: true, admissionDate: true },
      }),
      this.ensureRubricVersions(me.companyId),
      this.prisma.payrollBenefitEnrollment.findMany({
        where: { companyId: me.companyId, employeeId: { in: employeeIds }, active: true },
        include: { benefit: true },
      }),
      this.prisma.payrollLoan.findMany({
        where: { companyId: me.companyId, employeeId: { in: employeeIds }, status: 'ACTIVE' },
      }),
      this.prisma.payrollPension.findMany({
        where: { companyId: me.companyId, employeeId: { in: employeeIds }, active: true },
      }),
      // Fonte canônica de férias: VacationRequest do Serviço Pessoal (sem
      // cadastro paralelo). A folha só CONSOME o que foi aprovado no DP.
      this.prisma.vacationRequest.findMany({
        where: {
          companyId: me.companyId,
          employeeId: { in: employeeIds },
          status: { in: ['APPROVED', 'DONE'] },
        },
      }),
      run.kind === 'DECIMO_TERCEIRO_2'
        ? this.prisma.payrollRunWorker.findMany({
            where: {
              companyId: me.companyId,
              employeeId: { in: employeeIds },
              run: { kind: 'DECIMO_TERCEIRO_1', status: { in: ['APPROVED', 'CLOSED'] } },
            },
            select: { employeeId: true, netPay: true },
          })
        : Promise.resolve([]),
    ]);
    const salaryByEmployee = new Map<string, string>();
    for (const snapshot of salaries) {
      if (!salaryByEmployee.has(snapshot.employeeId)) salaryByEmployee.set(snapshot.employeeId, snapshot.currentSalary.toString());
    }
    const settingsByEmployee = new Map(settings.map((setting) => [setting.employeeId, setting]));
    const dependentsByEmployee = new Map(dependents.map((group) => [group.employeeId, group._count._all]));
    const contractByEmployee = new Map(profiles.map((profile) => [profile.employeeId, profile.contractType]));
    const admissionByEmployee = new Map(profiles.map((profile) => [profile.employeeId, profile.admissionDate]));

    // Registros de rescisão (só quando a run é RESCISAO): fornecem tipo, aviso e
    // parâmetros informados (saldo de FGTS, férias vencidas) via resultsJson.
    const terminationByEmployee = new Map<string, any>();
    if (run.kind === 'RESCISAO') {
      const terminations = await this.prisma.payrollTermination.findMany({
        where: { companyId: me.companyId, employeeId: { in: employeeIds } },
      });
      for (const termination of terminations) terminationByEmployee.set(termination.employeeId, termination);
    }

    const benefitsByEmployee = new Map<string, any[]>();
    for (const b of benefitEnrollments) {
      const list = benefitsByEmployee.get(b.employeeId) || [];
      // customValue na adesão sempre é um valor fixo em R$ e substitui a regra
      // do benefício; sem ele, vale o tipo do benefício (fixo ou % do salário —
      // para PERCENTUAL_SALARIO o campo value guarda o percentual, e
      // decimalToCents("6.00") = 600 já equivale aos basis points).
      const custom = b.customValue ? decimalToCents(b.customValue.toString()) : null;
      list.push({
        name: b.benefit.name,
        kind: b.benefit.kind,
        type: custom !== null ? 'VALOR_FIXO' : b.benefit.type,
        valueCents: custom ?? decimalToCents(b.benefit.value.toString()),
        rateBp: custom !== null ? undefined : decimalToCents(b.benefit.value.toString()),
        copayRateBp: b.benefit.copayRateBp ?? 0,
      });
      benefitsByEmployee.set(b.employeeId, list);
    }

    const loansByEmployee = new Map<string, any[]>();
    for (const l of loans) {
      const list = loansByEmployee.get(l.employeeId) || [];
      list.push({ bankName: l.bankName, contractId: l.contractId, amountCents: decimalToCents(l.installmentAmount.toString()) });
      loansByEmployee.set(l.employeeId, list);
    }

    const pensionsByEmployee = new Map<string, any[]>();
    for (const p of pensions) {
      const list = pensionsByEmployee.get(p.employeeId) || [];
      list.push({ dependentId: p.dependentId, percentage: Number(p.percentage), baseType: p.baseType });
      pensionsByEmployee.set(p.employeeId, list);
    }

    const vacationRequestByEmployee = new Map<string, { takenDays: number; sellDays: number }>();
    for (const req of vacationRequests) {
      const reqStart = new Date(req.startDate);
      const reqMonth = reqStart.getUTCMonth() + 1;
      const reqYear = reqStart.getUTCFullYear();
      if (reqMonth === competence.month && reqYear === competence.year) {
        vacationRequestByEmployee.set(req.employeeId, { takenDays: req.days, sellDays: req.sellDays });
      }
    }

    const thirteenth1stPaidByEmployee = new Map<string, number>();
    for (const w of thirteenth1stWorkers) {
      thirteenth1stPaidByEmployee.set(w.employeeId, decimalToCents(w.netPay.toString()));
    }

    // Se a run for MENSAL, buscar se há adiantamento para descontar
    const advancePaidByEmployee = new Map<string, number>();
    if (run.kind === 'MENSAL') {
      const advanceRun = await this.prisma.payrollRun.findFirst({
        where: {
          companyId: me.companyId,
          competenceId: run.competenceId,
          kind: 'ADIANTAMENTO',
          status: { in: ['APPROVED', 'CLOSED'] },
        },
        include: { workers: { select: { employeeId: true, netPay: true } } },
      });
      if (advanceRun) {
        for (const w of advanceRun.workers) {
          advancePaidByEmployee.set(w.employeeId, decimalToCents(w.netPay.toString()));
        }
      }
    }

    const issues: string[] = [];
    const results: Array<{ snapshot: (typeof snapshots)[number]; calc: WorkerCalcResult | null; workerIssues: string[]; salaryCents: number }> = [];
    for (const snapshot of snapshots) {
      const workerIssues: string[] = [];
      const events = snapshot.data as unknown as TimekeepingSummary & { noTimeClock?: boolean };
      if (run.kind === 'MENSAL' && events.noTimeClock) {
        workerIssues.push('Colaborador sem vínculo de ponto (prontuário sem usuário) — horas zeradas.');
      }
      const salaryDecimal = salaryByEmployee.get(snapshot.employeeId);
      if (!salaryDecimal) {
        workerIssues.push('Sem salário vigente em Cargos e Salários (CompensationSalarySnapshot) — cálculo bloqueado.');
        results.push({ snapshot, calc: null, workerIssues, salaryCents: 0 });
        issues.push(...workerIssues);
        continue;
      }
      const salaryCents = decimalToCents(salaryDecimal);
      const setting = settingsByEmployee.get(snapshot.employeeId);

      let calc: WorkerCalcResult;
      if (run.kind === 'ADIANTAMENTO') {
        const advancePercentage = setting?.advancePercentage ?? 40;
        const advanceCents = roundDiv(salaryCents * advancePercentage, 100);

        calc = {
          items: [
            {
              rubricCode: '1010',
              rubricName: 'Adiantamento salarial',
              nature: 'PROVENTO',
              reference: `${advancePercentage}%`,
              amountCents: advanceCents,
              origin: 'MOTOR',
            },
          ],
          totals: {
            earningsCents: advanceCents,
            deductionsCents: 0,
            netCents: advanceCents,
            inssBaseCents: 0,
            inssCents: 0,
            irrfBaseCents: 0,
            irrfCents: 0,
            fgtsBaseCents: 0,
            fgtsCents: 0,
          },
          memory: [
            {
              step: 'Adiantamento salarial',
              formula: 'salário base × percentual de adiantamento (half-up)',
              inputs: { salario: centsLabel(salaryCents), percentual: `${advancePercentage}%` },
              resultCents: advanceCents,
            },
            {
              step: 'Líquido',
              formula: 'total de proventos',
              inputs: { proventos: centsLabel(advanceCents) },
              resultCents: advanceCents,
            },
          ],
        };
      } else if (run.kind === 'FERIAS') {
        const req = vacationRequestByEmployee.get(snapshot.employeeId);
        if (!req) {
          workerIssues.push('Sem programação de férias cadastrada ou aprovada nesta competência.');
          results.push({ snapshot, calc: null, workerIssues, salaryCents: 0 });
          issues.push(...workerIssues);
          continue;
        }
        calc = computeVacationWorker({
          salaryCents,
          takenDays: req.takenDays,
          sellDays: req.sellDays,
          contractType: contractByEmployee.get(snapshot.employeeId) ?? null,
          tables,
        });
      } else if (run.kind === 'DECIMO_TERCEIRO_1') {
        const avos = 12;
        calc = computeThirteenthWorker({
          salaryCents,
          avos,
          parcela: 1,
          contractType: contractByEmployee.get(snapshot.employeeId) ?? null,
          tables,
        });
      } else if (run.kind === 'DECIMO_TERCEIRO_2') {
        const avos = 12;
        const paid1st = thirteenth1stPaidByEmployee.get(snapshot.employeeId) ?? 0;
        calc = computeThirteenthWorker({
          salaryCents,
          avos,
          parcela: 2,
          advancePaidCents: paid1st,
          contractType: contractByEmployee.get(snapshot.employeeId) ?? null,
          tables,
        });
      } else if (run.kind === 'RESCISAO') {
        const termination = terminationByEmployee.get(snapshot.employeeId);
        const admissionDate = admissionByEmployee.get(snapshot.employeeId) ?? null;
        if (!termination) {
          workerIssues.push('Sem registro de rescisão cadastrado (aba Rescisões) para este colaborador.');
          results.push({ snapshot, calc: null, workerIssues, salaryCents: 0 });
          issues.push(...workerIssues);
          continue;
        }
        if (!admissionDate) {
          workerIssues.push('Colaborador sem data de admissão no prontuário — necessária para os avos da rescisão.');
          results.push({ snapshot, calc: null, workerIssues, salaryCents: 0 });
          issues.push(...workerIssues);
          continue;
        }
        const params = (termination.resultsJson ?? {}) as { fgtsBalanceCents?: number; expiredVacationAvos?: number };
        const term = computeTermination({
          salaryCents,
          admissionDate: new Date(admissionDate),
          terminationDate: new Date(termination.terminationDate),
          kind: termination.kind,
          noticeType: termination.noticeType,
          contractType: contractByEmployee.get(snapshot.employeeId) ?? null,
          irDependents: setting?.irDependentsOverride ?? dependentsByEmployee.get(snapshot.employeeId) ?? 0,
          tables,
          fgtsBalanceCents: params.fgtsBalanceCents,
          expiredVacationAvos: params.expiredVacationAvos,
        });
        calc = { items: term.items, totals: term.totals, memory: term.memory };
        if (term.issues.length) workerIssues.push(...term.issues);
      } else {
        const advancePaidCents = advancePaidByEmployee.get(snapshot.employeeId) ?? 0;
        const employeeBenefits = benefitsByEmployee.get(snapshot.employeeId) ?? [];
        const employeeLoans = loansByEmployee.get(snapshot.employeeId) ?? [];
        const employeePensions = pensionsByEmployee.get(snapshot.employeeId) ?? [];

        calc = computeMonthlyWorker({
          salaryCents,
          monthlyHours: setting?.monthlyHours ?? 220,
          contractType: contractByEmployee.get(snapshot.employeeId) ?? null,
          irDependents: setting?.irDependentsOverride ?? dependentsByEmployee.get(snapshot.employeeId) ?? 0,
          timekeeping: events,
          tables,
          advancePaidCents,
          benefits: employeeBenefits,
          loans: employeeLoans,
          pensions: employeePensions,
        });
      }
      results.push({ snapshot, calc, workerIssues, salaryCents });
      issues.push(...workerIssues);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payrollRunWorker.deleteMany({ where: { runId } });
      for (const result of results) {
        const calc = result.calc;
        const worker = await tx.payrollRunWorker.create({
          data: {
            companyId: me.companyId,
            runId,
            employeeId: result.snapshot.employeeId,
            userId: result.snapshot.userId,
            status: result.workerIssues.length || !calc ? 'WITH_ISSUES' : 'CALCULATED',
            baseSalary: centsToDecimalString(result.salaryCents),
            totalEarnings: centsToDecimalString(calc?.totals.earningsCents ?? 0),
            totalDeductions: centsToDecimalString(calc?.totals.deductionsCents ?? 0),
            netPay: centsToDecimalString(calc?.totals.netCents ?? 0),
            inssBase: centsToDecimalString(calc?.totals.inssBaseCents ?? 0),
            inssValue: centsToDecimalString(calc?.totals.inssCents ?? 0),
            irrfBase: centsToDecimalString(calc?.totals.irrfBaseCents ?? 0),
            irrfValue: centsToDecimalString(calc?.totals.irrfCents ?? 0),
            fgtsBase: centsToDecimalString(calc?.totals.fgtsBaseCents ?? 0),
            fgtsValue: centsToDecimalString(calc?.totals.fgtsCents ?? 0),
            memory: (calc?.memory ?? [{ step: 'Bloqueado', formula: 'cálculo não executado', inputs: {}, resultCents: 0 }]) as object,
            issues: result.workerIssues.length ? result.workerIssues : undefined,
          },
        });
        if (calc) {
          await tx.payrollRunItem.createMany({
            data: calc.items.map((item, index) => ({
              companyId: me.companyId,
              runWorkerId: worker.id,
              rubricCode: item.rubricCode,
              rubricName: item.rubricName,
              rubricVersionId: rubricVersionByCode.get(item.rubricCode) ?? null,
              nature: item.nature,
              reference: item.reference,
              amount: centsToDecimalString(item.amountCents),
              origin: item.origin,
              sortOrder: index,
            })),
          });
        }
      }
      const calculated = results.filter((result) => result.calc);
      const totals = {
        workers: results.length,
        withIssues: results.filter((result) => result.workerIssues.length || !result.calc).length,
        gross: centsToDecimalString(calculated.reduce((sum, result) => sum + (result.calc?.totals.earningsCents ?? 0), 0)),
        deductions: centsToDecimalString(calculated.reduce((sum, result) => sum + (result.calc?.totals.deductionsCents ?? 0), 0)),
        net: centsToDecimalString(calculated.reduce((sum, result) => sum + (result.calc?.totals.netCents ?? 0), 0)),
        inss: centsToDecimalString(calculated.reduce((sum, result) => sum + (result.calc?.totals.inssCents ?? 0), 0)),
        irrf: centsToDecimalString(calculated.reduce((sum, result) => sum + (result.calc?.totals.irrfCents ?? 0), 0)),
        fgts: centsToDecimalString(calculated.reduce((sum, result) => sum + (result.calc?.totals.fgtsCents ?? 0), 0)),
      };
      await tx.payrollRun.update({
        where: { id: runId },
        data: {
          status: issues.length ? 'WITH_ISSUES' : 'CALCULATED',
          calculatedAt: new Date(),
          calculatedById: me.sub,
          legalRefs: run.kind === 'MENSAL' ? { INSS: tables.inss.versionId, IRRF: tables.irrf.versionId, FGTS: tables.fgts.versionId } : undefined,
          issues: issues.length ? issues.slice(0, 100) : undefined,
          totals,
        },
      });
    }, { timeout: 120_000, maxWait: 20_000 });

    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollRun',
      entityId: runId,
      action: 'CALCULATED',
      message: `Folha calculada: ${results.length} colaborador(es), ${issues.length} pendência(s)`,
      after: { workers: results.length, issues: issues.length },
    });
    return this.getRun(me, runId);
  }

  /** Aprovação humana obrigatória (folha:approve). Nada é pago/transmitido aqui. */
  async approve(me: AuthPayload, runId: string) {
    const run = await this.runOf(me.companyId, runId);
    if (run.status !== 'CALCULATED') {
      throw new ConflictException(run.status === 'WITH_ISSUES' ? 'Resolva as pendências e recalcule antes de aprovar.' : 'Só é possível aprovar um processamento CALCULATED.');
    }
    const sameUser = run.calculatedById === me.sub;
    const updated = await this.prisma.payrollRun.update({
      where: { id: runId },
      data: { status: 'APPROVED', approvedById: me.sub, approvedAt: new Date() },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollRun',
      entityId: runId,
      action: 'APPROVED',
      message: sameUser
        ? 'Folha aprovada pelo MESMO usuário que calculou — recomenda-se segregação de funções'
        : 'Folha aprovada',
      after: { sameUserAsCalculation: sameUser },
    });
    return updated;
  }

  async close(me: AuthPayload, runId: string) {
    const run = await this.runOf(me.companyId, runId);
    if (run.status !== 'APPROVED') throw new ConflictException('Só é possível fechar um processamento APPROVED.');
    const updated = await this.prisma.payrollRun.update({
      where: { id: runId },
      data: { status: 'CLOSED', closedById: me.sub, closedAt: new Date() },
    });
    await this.audit.record(me, { module: MODULE, entity: 'PayrollRun', entityId: runId, action: 'CLOSED', message: 'Folha fechada' });
    return updated;
  }

  /** Reabertura exige justificativa e permissão própria; tudo auditado. */
  async reopen(me: AuthPayload, runId: string, body: any = {}) {
    const note = String(body?.note ?? '').trim();
    if (note.length < 5) throw new BadRequestException('Justificativa é obrigatória para reabrir.');
    const run = await this.runOf(me.companyId, runId);
    if (!['APPROVED', 'CLOSED'].includes(run.status)) throw new ConflictException('Só processamentos aprovados/fechados podem ser reabertos.');
    const updated = await this.prisma.payrollRun.update({
      where: { id: runId },
      data: { status: 'REOPENED', reopenNote: note, version: { increment: 1 } },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollRun',
      entityId: runId,
      action: 'REOPENED',
      message: `Folha reaberta: ${note}`,
      before: { status: run.status },
      after: { status: 'REOPENED', version: updated.version },
    });
    return updated;
  }

  async workerMemory(me: AuthPayload, workerId: string) {
    const worker = await this.prisma.payrollRunWorker.findFirst({
      where: { id: workerId, companyId: me.companyId },
      include: { items: { orderBy: { sortOrder: 'asc' } }, run: { select: { id: true, status: true, legalRefs: true } } },
    });
    if (!worker) throw new NotFoundException('Colaborador do processamento não encontrado.');
    const employee = await this.prisma.orgEmployee.findFirst({
      where: { id: worker.employeeId, companyId: me.companyId },
      select: { name: true, registrationId: true },
    });
    return { ...worker, employee };
  }

  async listRubrics(me: AuthPayload) {
    await this.ensureRubricVersions(me.companyId);
    return this.prisma.payrollRubricDef.findMany({
      where: { companyId: me.companyId },
      orderBy: { code: 'asc' },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
  }

  // ------------------------------ portal do colaborador ------------------------------

  async listMyPayslips(me: AuthPayload) {
    const employee = await this.prisma.orgEmployee.findFirst({
      where: { companyId: me.companyId, personnelProfile: { userId: me.sub } },
      select: { id: true },
    });
    if (!employee) return [];
    return this.prisma.payrollRunWorker.findMany({
      where: {
        companyId: me.companyId,
        employeeId: employee.id,
        run: { status: 'CLOSED' },
      },
      include: {
        run: {
          select: {
            kind: true,
            competence: {
              select: { year: true, month: true },
            },
          },
        },
      },
      orderBy: { run: { competence: { year: 'desc' } } },
    });
  }

  async getMyPayslipMemory(me: AuthPayload, workerId: string) {
    const worker = await this.prisma.payrollRunWorker.findFirst({
      where: {
        id: workerId,
        companyId: me.companyId,
        run: { status: 'CLOSED' },
      },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        run: { select: { id: true, status: true, legalRefs: true, competence: { select: { year: true, month: true } } } },
      },
    });
    if (!worker) throw new NotFoundException('Holerite não encontrado.');
    const employee = await this.prisma.orgEmployee.findFirst({
      where: { id: worker.employeeId, companyId: me.companyId, personnelProfile: { userId: me.sub } },
      select: { name: true, registrationId: true },
    });
    if (!employee) throw new NotFoundException('Holerite não encontrado.');
    return { ...worker, employee };
  }

  /**
   * Informe de rendimentos anual do próprio colaborador: agrega os
   * processamentos FECHADOS do ano (tributável, IRRF, INSS, 13º), para
   * conferência. ⚠️ Não substitui o comprovante oficial da Receita.
   */
  async myIncomeReport(me: AuthPayload, year: number) {
    const employee = await this.prisma.orgEmployee.findFirst({
      where: { companyId: me.companyId, personnelProfile: { userId: me.sub } },
      select: { id: true, name: true, personnelProfile: { select: { cpf: true } } },
    });
    if (!employee) return { year, employee: null, months: [], totals: null };
    return this.incomeReportFor(me.companyId, employee.id, employee.name, employee.personnelProfile?.cpf ?? null, year);
  }

  /** Informe de rendimentos de um colaborador (visão do DP/folha). */
  async incomeReport(me: AuthPayload, employeeId: string, year: number) {
    const employee = await this.prisma.orgEmployee.findFirst({
      where: { id: employeeId, companyId: me.companyId },
      select: { name: true, personnelProfile: { select: { cpf: true } } },
    });
    if (!employee) throw new NotFoundException('Colaborador não encontrado.');
    return this.incomeReportFor(me.companyId, employeeId, employee.name, employee.personnelProfile?.cpf ?? null, year);
  }

  private async incomeReportFor(companyId: string, employeeId: string, name: string, cpf: string | null, year: number) {
    const workers = await this.prisma.payrollRunWorker.findMany({
      where: {
        companyId,
        employeeId,
        status: 'CALCULATED',
        run: { status: 'CLOSED', competence: { year } },
      },
      select: {
        totalEarnings: true, netPay: true, inssValue: true, irrfValue: true, irrfBase: true, fgtsValue: true,
        run: { select: { kind: true, competence: { select: { month: true } } } },
      },
    });
    const num = (v: { toString(): string }) => Number(v.toString());
    const months = workers
      .map((w) => ({
        month: w.run.competence.month,
        kind: w.run.kind,
        earnings: num(w.totalEarnings),
        inss: num(w.inssValue),
        irrf: num(w.irrfValue),
        irrfBase: num(w.irrfBase),
        net: num(w.netPay),
        fgts: num(w.fgtsValue),
      }))
      .sort((a, b) => a.month - b.month);
    const totals = months.reduce(
      (acc, m) => ({
        earnings: acc.earnings + m.earnings,
        inss: acc.inss + m.inss,
        irrf: acc.irrf + m.irrf,
        fgts: acc.fgts + m.fgts,
        taxable: acc.taxable + m.irrfBase,
      }),
      { earnings: 0, inss: 0, irrf: 0, fgts: 0, taxable: 0 },
    );
    return { year, employee: { id: employeeId, name, cpf }, months, totals };
  }

  // ------------------------------ helpers ------------------------------

  /** Semeia as rubricas internas (versão 1) e devolve code → versionId vigente. */
  private async ensureRubricVersions(companyId: string): Promise<Map<string, string>> {
    const existing = await this.prisma.payrollRubricDef.findMany({
      where: { companyId },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    const byCode = new Map(existing.map((rubric) => [rubric.code, rubric]));
    for (const seed of DEFAULT_RUBRIC_DEFS) {
      if (byCode.has(seed.code)) continue;
      const created = await this.prisma.payrollRubricDef.create({
        data: {
          companyId,
          code: seed.code,
          name: seed.name,
          nature: seed.nature,
          versions: { create: { version: 1, effectiveFrom: '2025-01-01', spec: { engine: 'MOTOR_F1', description: seed.name } } },
        },
        include: { versions: true },
      });
      byCode.set(seed.code, created as (typeof existing)[number]);
    }
    const map = new Map<string, string>();
    for (const [code, rubric] of byCode) {
      const version = rubric.versions[0];
      if (version) map.set(code, version.id);
    }
    return map;
  }

  // ============================== Férias (consome o Serviço Pessoal) ==============================

  /**
   * Férias aprovadas na fonte canônica (VacationRequest do Serviço Pessoal) que
   * caem em uma competência de folha, para conferência antes de calcular. NÃO há
   * cadastro de férias aqui — a solicitação/aprovação vive no módulo de DP.
   */
  async listVacations(me: AuthPayload) {
    const requests = await this.prisma.vacationRequest.findMany({
      where: { companyId: me.companyId, status: { in: ['APPROVED', 'DONE'] } },
      orderBy: { startDate: 'desc' },
      take: 200,
      include: { employee: { select: { id: true, name: true, registrationId: true } } },
    });
    return requests.map((req) => ({
      id: req.id,
      employee: req.employee,
      startDate: req.startDate,
      endDate: req.endDate,
      days: req.days,
      sellDays: req.sellDays,
      advanceThirteenth: req.advanceThirteenth,
      periodRef: req.periodRef,
      status: req.status,
      competence: `${new Date(req.startDate).getUTCFullYear()}-${String(new Date(req.startDate).getUTCMonth() + 1).padStart(2, '0')}`,
    }));
  }

  /**
   * Ajusta os insumos de folha (abono pecuniário / antecipação de 13º) de uma
   * férias JÁ aprovada no Serviço Pessoal. Não cria férias — isso é feito no
   * fluxo canônico de DP (com saldo, sobreposição e aprovação em 2 níveis).
   */
  async setVacationPayrollInputs(me: AuthPayload, body: any) {
    const request = await this.prisma.vacationRequest.findFirst({
      where: { id: String(body?.vacationRequestId ?? ''), companyId: me.companyId },
    });
    if (!request) throw new NotFoundException('Férias não encontradas no Serviço Pessoal.');
    const sellDays = Math.max(0, Math.min(Number(body?.sellDays ?? 0) || 0, 10)); // abono: até 1/3 (10 dias)
    const updated = await this.prisma.vacationRequest.update({
      where: { id: request.id },
      data: { sellDays, advanceThirteenth: !!body?.advanceThirteenth },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'VacationRequest',
      entityId: request.id,
      action: 'UPDATE',
      message: `Insumos de folha das férias ajustados: ${sellDays} dia(s) de abono`,
      after: { sellDays, advanceThirteenth: !!body?.advanceThirteenth },
    });
    return updated;
  }

  // ============================== Rescisões (Fase 3) ==============================

  async listTerminations(me: AuthPayload) {
    return this.prisma.payrollTermination.findMany({
      where: { companyId: me.companyId },
    });
  }

  /**
   * Roda o motor real de rescisão (computeTermination) com os insumos vigentes
   * do colaborador. Usado tanto na prévia (sem persistir) quanto no registro.
   */
  async previewTermination(me: AuthPayload, body: any) {
    const employeeId = String(body?.employeeId ?? '');
    await this.assertEmployee(me.companyId, employeeId);
    const terminationDate = new Date(String(body?.terminationDate ?? ''));
    if (Number.isNaN(terminationDate.getTime())) throw new BadRequestException('Data de rescisão inválida.');
    const dateKey = terminationDate.toISOString().slice(0, 10);

    const [tables, salarySnapshot, profile, dependents] = await Promise.all([
      this.legalTables.tablesFor(me.companyId, dateKey),
      this.prisma.compensationSalarySnapshot.findFirst({
        where: { companyId: me.companyId, employeeId, effectiveFrom: { lte: terminationDate } },
        orderBy: { effectiveFrom: 'desc' },
        select: { currentSalary: true },
      }),
      this.prisma.personnelEmployeeProfile.findFirst({
        where: { companyId: me.companyId, employeeId },
        select: { contractType: true, admissionDate: true },
      }),
      this.prisma.employeeDependent.count({
        where: { companyId: me.companyId, employeeId, isIrDependent: true },
      }),
    ]);
    if (!salarySnapshot) {
      throw new BadRequestException('Sem salário vigente em Cargos e Salários (CompensationSalarySnapshot) — cálculo bloqueado.');
    }
    if (!profile?.admissionDate) {
      throw new BadRequestException('Colaborador sem data de admissão no prontuário do Serviço Pessoal — cálculo bloqueado.');
    }

    const salaryCents = decimalToCents(salarySnapshot.currentSalary.toString());
    const fgtsBalanceCents = Math.max(0, Math.round(Number(body?.fgtsBalance ?? 0) * 100)) || undefined;
    const expiredVacationAvos = Math.max(0, Math.min(12, Number(body?.expiredVacationAvos ?? 0) || 0));

    const calc = computeTermination({
      salaryCents,
      admissionDate: profile.admissionDate,
      terminationDate,
      kind: String(body?.kind ?? 'DISPENSA_SEM_JUSTA_CAUSA'),
      noticeType: String(body?.noticeType ?? 'INDENIZADO'),
      contractType: profile.contractType ?? null,
      irDependents: dependents,
      tables,
      fgtsBalanceCents,
      expiredVacationAvos,
    });
    return { salaryCents, admissionDate: profile.admissionDate, ...calc };
  }

  async createTermination(me: AuthPayload, body: any) {
    // O resultado persistido é SEMPRE o do motor real — o frontend não manda
    // valores calculados (a prévia antiga enviava números simulados fixos).
    const calc = await this.previewTermination(me, body);
    const created = await this.prisma.payrollTermination.create({
      data: {
        companyId: me.companyId,
        employeeId: body.employeeId,
        terminationDate: new Date(body.terminationDate),
        kind: body.kind,
        noticeType: body.noticeType,
        noticeDays: body.noticeDays ?? 30,
        status: 'DRAFT',
        resultsJson: {
          engine: 'computeTermination',
          grossValue: calc.totals.earningsCents,
          deductionsValue: calc.totals.deductionsCents,
          netValue: calc.totals.netCents,
          fgtsFineCents: calc.informative.fgtsFineCents,
          items: calc.items,
          issues: calc.issues,
        } as unknown as Prisma.InputJsonValue,
        calculatedById: me.sub,
      },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollTermination',
      entityId: created.id,
      action: 'CREATE',
      message: `Rescisão registrada (${body.kind}) para colaborador`,
      after: { employeeId: body.employeeId, kind: body.kind, terminationDate: body.terminationDate, netValueCents: calc.totals.netCents },
    });
    return created;
  }

  // ============================== Benefícios e Descontos (Fase 3) ==============================

  async listBenefits(me: AuthPayload) {
    return this.prisma.payrollBenefit.findMany({
      where: { companyId: me.companyId },
      include: { enrollments: true },
    });
  }

  async createBenefit(me: AuthPayload, body: any) {
    const created = await this.prisma.payrollBenefit.create({
      data: {
        companyId: me.companyId,
        name: body.name,
        provider: body.provider,
        kind: body.kind,
        type: body.type ?? 'VALOR_FIXO',
        value: body.value,
        copayRateBp: body.copayRateBp ?? 0,
        active: true,
      },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollBenefit',
      entityId: created.id,
      action: 'CREATE',
      message: `Benefício "${body.name}" (${body.kind}) cadastrado`,
    });
    return created;
  }

  async enrollBenefit(me: AuthPayload, body: any) {
    await this.assertEmployee(me.companyId, String(body?.employeeId ?? ''));
    // O benefício também precisa ser da mesma empresa (evita vincular a benefício de outro tenant).
    const benefit = await this.prisma.payrollBenefit.findFirst({ where: { id: String(body?.benefitId ?? ''), companyId: me.companyId }, select: { id: true } });
    if (!benefit) throw new NotFoundException('Benefício não encontrado nesta empresa.');
    const saved = await this.prisma.payrollBenefitEnrollment.upsert({
      where: {
        employeeId_benefitId: {
          employeeId: body.employeeId,
          benefitId: body.benefitId,
        },
      },
      create: {
        companyId: me.companyId,
        employeeId: body.employeeId,
        benefitId: body.benefitId,
        customValue: body.customValue,
        active: true,
      },
      update: {
        customValue: body.customValue,
        active: body.active ?? true,
      },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollBenefitEnrollment',
      entityId: saved.id,
      action: 'UPDATE',
      message: 'Adesão de benefício atualizada',
      after: { employeeId: body.employeeId, benefitId: body.benefitId },
    });
    return saved;
  }

  async listLoans(me: AuthPayload) {
    return this.prisma.payrollLoan.findMany({
      where: { companyId: me.companyId },
    });
  }

  async createLoan(me: AuthPayload, body: any) {
    await this.assertEmployee(me.companyId, String(body?.employeeId ?? ''));
    const created = await this.prisma.payrollLoan.create({
      data: {
        companyId: me.companyId,
        employeeId: body.employeeId,
        bankName: body.bankName,
        contractId: body.contractId,
        totalAmount: body.totalAmount,
        installmentAmount: body.installmentAmount,
        totalInstallments: body.totalInstallments,
        paidInstallments: 0,
        status: 'ACTIVE',
      },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollLoan',
      entityId: created.id,
      action: 'CREATE',
      message: `Consignado ${body.bankName} (contrato ${body.contractId}) cadastrado`,
      after: { employeeId: body.employeeId, contractId: body.contractId },
    });
    return created;
  }

  async listPensions(me: AuthPayload) {
    return this.prisma.payrollPension.findMany({
      where: { companyId: me.companyId },
    });
  }

  async createPension(me: AuthPayload, body: any) {
    await this.assertEmployee(me.companyId, String(body?.employeeId ?? ''));
    const created = await this.prisma.payrollPension.create({
      data: {
        companyId: me.companyId,
        employeeId: body.employeeId,
        dependentId: body.dependentId,
        percentage: body.percentage,
        baseType: body.baseType ?? 'NET',
        active: true,
      },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollPension',
      entityId: created.id,
      action: 'CREATE',
      message: `Pensão alimentícia (${body.percentage}% base ${body.baseType ?? 'NET'}) cadastrada`,
      after: { employeeId: body.employeeId, dependentId: body.dependentId },
    });
    return created;
  }

  private assertEditable(status: string) {
    if (!EDITABLE_STATUSES.includes(status)) {
      throw new ConflictException(`Processamento em ${status} não aceita alterações (reabra com justificativa se necessário).`);
    }
  }

  /** Garante que o colaborador pertence à empresa do usuário (isolamento multiempresa). */
  private async assertEmployee(companyId: string, employeeId: string) {
    const employee = await this.prisma.orgEmployee.findFirst({ where: { id: employeeId, companyId }, select: { id: true } });
    if (!employee) throw new NotFoundException('Colaborador não encontrado nesta empresa.');
    return employee.id;
  }

  private async competenceOf(companyId: string, id: string) {
    const competence = await this.prisma.payrollCompetence.findFirst({ where: { id, companyId } });
    if (!competence) throw new NotFoundException('Competência não encontrada.');
    return competence;
  }

  private async runOf(companyId: string, id: string) {
    const run = await this.prisma.payrollRun.findFirst({ where: { id, companyId } });
    if (!run) throw new NotFoundException('Processamento não encontrado.');
    return run;
  }
}
