import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
  type TimekeepingSummary,
  type WorkerCalcResult,
} from './payroll-calc.logic';

const MODULE = 'payroll';

/** Estados em que o processamento ainda aceita importar/recalcular. */
const EDITABLE_STATUSES = ['DRAFT', 'CALCULATED', 'WITH_ISSUES', 'REOPENED'];

/** Rubricas internas semeadas por empresa (versão 1 imutável). */
const DEFAULT_RUBRIC_DEFS: Array<{ code: string; name: string; nature: string }> = [
  { code: '1000', name: 'Salário base', nature: 'PROVENTO' },
  { code: '1101', name: 'Horas extras 50%', nature: 'PROVENTO' },
  { code: '1102', name: 'Horas extras 100%', nature: 'PROVENTO' },
  { code: '1103', name: 'Adicional noturno 20%', nature: 'PROVENTO' },
  { code: '5010', name: 'Faltas e ausências', nature: 'DESCONTO' },
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
    if (kind !== 'MENSAL') throw new BadRequestException('Fase 1 suporta apenas o processamento MENSAL (demais tipos na Fase 3).');
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
    const run = await this.runOf(me.companyId, id);
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

    const [tables, salaries, settings, dependents, profiles, rubricVersionByCode] = await Promise.all([
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
        select: { employeeId: true, contractType: true },
      }),
      this.ensureRubricVersions(me.companyId),
    ]);
    const salaryByEmployee = new Map<string, string>();
    for (const snapshot of salaries) {
      if (!salaryByEmployee.has(snapshot.employeeId)) salaryByEmployee.set(snapshot.employeeId, snapshot.currentSalary.toString());
    }
    const settingsByEmployee = new Map(settings.map((setting) => [setting.employeeId, setting]));
    const dependentsByEmployee = new Map(dependents.map((group) => [group.employeeId, group._count._all]));
    const contractByEmployee = new Map(profiles.map((profile) => [profile.employeeId, profile.contractType]));

    const issues: string[] = [];
    const results: Array<{ snapshot: (typeof snapshots)[number]; calc: WorkerCalcResult | null; workerIssues: string[]; salaryCents: number }> = [];
    for (const snapshot of snapshots) {
      const workerIssues: string[] = [];
      const events = snapshot.data as unknown as TimekeepingSummary & { noTimeClock?: boolean };
      if (events.noTimeClock) workerIssues.push('Colaborador sem vínculo de ponto (prontuário sem usuário) — horas zeradas.');
      const salaryDecimal = salaryByEmployee.get(snapshot.employeeId);
      if (!salaryDecimal) {
        workerIssues.push('Sem salário vigente em Cargos e Salários (CompensationSalarySnapshot) — cálculo bloqueado.');
        results.push({ snapshot, calc: null, workerIssues, salaryCents: 0 });
        issues.push(...workerIssues);
        continue;
      }
      const salaryCents = decimalToCents(salaryDecimal);
      const setting = settingsByEmployee.get(snapshot.employeeId);
      const calc = computeMonthlyWorker({
        salaryCents,
        monthlyHours: setting?.monthlyHours ?? 220,
        contractType: contractByEmployee.get(snapshot.employeeId) ?? null,
        irDependents: setting?.irDependentsOverride ?? dependentsByEmployee.get(snapshot.employeeId) ?? 0,
        timekeeping: events,
        tables,
      });
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
          legalRefs: { INSS: tables.inss.versionId, IRRF: tables.irrf.versionId, FGTS: tables.fgts.versionId },
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

  private assertEditable(status: string) {
    if (!EDITABLE_STATUSES.includes(status)) {
      throw new ConflictException(`Processamento em ${status} não aceita alterações (reabra com justificativa se necessário).`);
    }
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
