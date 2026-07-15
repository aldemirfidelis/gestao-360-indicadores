import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AuthPayload } from '../auth/auth.types';
import {
  accountingCsv,
  computeAccountingEntries,
  DEFAULT_ACCOUNTS,
  type AccountCategory,
  type AccountRef,
} from './payroll-accounting.logic';

const MODULE = 'payroll';

@Injectable()
export class PayrollAccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
  ) {}

  /** Plano de contas efetivo: padrões sobrescritos pela config da empresa. */
  async getAccounts(companyId: string): Promise<Record<AccountCategory, AccountRef>> {
    const config = await this.prisma.payrollAccountingConfig.findUnique({ where: { companyId } });
    const overrides = (config?.accounts as Record<string, AccountRef> | undefined) ?? {};
    return { ...DEFAULT_ACCOUNTS, ...overrides } as Record<AccountCategory, AccountRef>;
  }

  async getConfig(me: AuthPayload) {
    return { accounts: await this.getAccounts(me.companyId), isDefault: !(await this.prisma.payrollAccountingConfig.findUnique({ where: { companyId: me.companyId } })) };
  }

  async setConfig(me: AuthPayload, body: any = {}) {
    if (!body?.accounts || typeof body.accounts !== 'object') throw new BadRequestException('Envie o mapa de contas.');
    const saved = await this.prisma.payrollAccountingConfig.upsert({
      where: { companyId: me.companyId },
      create: { companyId: me.companyId, accounts: body.accounts as Prisma.InputJsonValue, updatedById: me.sub },
      update: { accounts: body.accounts as Prisma.InputJsonValue, updatedById: me.sub },
    });
    await this.audit.record(me, { module: MODULE, entity: 'PayrollAccountingConfig', entityId: saved.id, action: 'UPDATE', message: 'Plano de contas da folha atualizado' });
    return this.getConfig(me);
  }

  /** Contabilização de um processamento: partidas balanceadas + CSV. */
  async generateForRun(me: AuthPayload, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, companyId: me.companyId },
      include: { competence: true, workers: { where: { status: 'CALCULATED' }, select: { totalEarnings: true, totalDeductions: true, netPay: true, inssValue: true, irrfValue: true, fgtsValue: true } } },
    });
    if (!run) throw new NotFoundException('Processamento não encontrado.');
    if (!run.workers.length) throw new BadRequestException('Sem colaboradores calculados.');
    const periodRef = `${run.competence.year}-${String(run.competence.month).padStart(2, '0')}`;
    const cents = (v: { toString(): string }) => Math.round(Number(v.toString()) * 100);

    let earnings = 0, deductions = 0, net = 0, inss = 0, irrf = 0, fgts = 0;
    for (const w of run.workers) {
      earnings += cents(w.totalEarnings);
      deductions += cents(w.totalDeductions);
      net += cents(w.netPay);
      inss += cents(w.inssValue);
      irrf += cents(w.irrfValue);
      fgts += cents(w.fgtsValue);
    }
    const accounts = await this.getAccounts(me.companyId);
    const result = computeAccountingEntries(
      { earningsCents: earnings, inssCents: inss, irrfCents: irrf, otherDeductionsCents: Math.max(0, deductions - inss - irrf), netCents: net, fgtsCents: fgts },
      accounts,
    );
    const csv = accountingCsv(result, periodRef);
    await this.audit.record(me, {
      module: MODULE, entity: 'PayrollRun', entityId: runId, action: 'ACCOUNTING',
      message: `Contabilização gerada para ${periodRef} (${result.balanced ? 'balanceada' : 'DIVERGENTE'})`,
      after: { totalDebit: result.totalDebitCents, totalCredit: result.totalCreditCents, balanced: result.balanced },
    });
    return { periodRef, ...result, csv, fileName: `Contabilizacao-${periodRef}.csv` };
  }
}
