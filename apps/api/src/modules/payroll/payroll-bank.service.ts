import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AuthPayload } from '../auth/auth.types';
import { antifraudChecks, buildCnab240, parseCnab240Return, type CnabPaymentItem } from './payroll-bank.logic';

const MODULE = 'payroll';
const RECENT_DAYS = 15;

/**
 * Pagamento bancário da folha (Fase 6). Segregação de funções: quem monta o lote
 * NÃO pode aprová-lo; a exportação da remessa exige aprovação. Antifraude roda na
 * montagem. Nada é transmitido ao banco — a remessa CNAB é exportada para o
 * gerenciador do banco; o retorno é importado para conciliação.
 */
@Injectable()
export class PayrollBankService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
  ) {}

  async getConfig(companyId: string) {
    return this.prisma.payrollBankConfig.findUnique({ where: { companyId } });
  }

  async setConfig(me: AuthPayload, body: any = {}) {
    const bankCode = String(body?.bankCode ?? '').replace(/\D/g, '').slice(0, 3);
    const agency = String(body?.agency ?? '').trim();
    const account = String(body?.account ?? '').trim();
    if (!bankCode || !agency || !account) throw new BadRequestException('Informe banco, agência e conta pagadora.');
    const saved = await this.prisma.payrollBankConfig.upsert({
      where: { companyId: me.companyId },
      create: { companyId: me.companyId, bankCode, agency, account, accountDigit: text(body?.accountDigit), updatedById: me.sub },
      update: { bankCode, agency, account, accountDigit: text(body?.accountDigit), updatedById: me.sub },
    });
    await this.audit.record(me, { module: MODULE, entity: 'PayrollBankConfig', entityId: saved.id, action: 'UPDATE', message: 'Conta bancária pagadora atualizada' });
    return saved;
  }

  async listBatches(me: AuthPayload, runId?: string) {
    return this.prisma.payrollBankBatch.findMany({
      where: { companyId: me.companyId, ...(runId ? { runId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { items: { select: { id: true, name: true, netCents: true, status: true, returnCode: true } } },
    });
  }

  /** Monta o lote a partir de um processamento aprovado/fechado, com antifraude. */
  async createBatch(me: AuthPayload, runId: string, body: any = {}) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, companyId: me.companyId },
      include: { competence: true, workers: { select: { employeeId: true, netPay: true, status: true } } },
    });
    if (!run) throw new NotFoundException('Processamento não encontrado.');
    if (!['APPROVED', 'CLOSED'].includes(run.status)) throw new ConflictException('Aprove a folha antes de preparar o pagamento.');
    const periodRef = `${run.competence.year}-${String(run.competence.month).padStart(2, '0')}`;
    const paymentDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.paymentDate ?? '')) ? String(body.paymentDate) : this.defaultPaymentDate(run.competence.year, run.competence.month);

    const employeeIds = run.workers.map((w) => w.employeeId);
    const employees = await this.prisma.orgEmployee.findMany({
      where: { companyId: me.companyId, id: { in: employeeIds } },
      select: { id: true, name: true, status: true, personnelProfile: { select: { bankCode: true, bankAgency: true, bankAccount: true, bankAccountDigit: true, pixKey: true, bankUpdatedAt: true } } },
    });
    const byId = new Map(employees.map((e) => [e.id, e]));
    const now = Date.now();

    const items = run.workers
      .filter((w) => w.status === 'CALCULATED' && Number(w.netPay.toString()) > 0)
      .map((w) => {
        const emp = byId.get(w.employeeId);
        const p = emp?.personnelProfile;
        const account = p?.bankAccount ? `${p.bankAgency ?? ''}/${p.bankAccount}-${p.bankAccountDigit ?? ''}` : null;
        return {
          employeeId: w.employeeId,
          name: emp?.name ?? '—',
          bankCode: p?.bankCode ?? null,
          agency: p?.bankAgency ?? null,
          account: p?.bankAccount ?? null,
          accountDigit: p?.bankAccountDigit ?? null,
          pixKey: p?.pixKey ?? null,
          netCents: Math.round(Number(w.netPay.toString()) * 100),
          active: emp?.status === 'ACTIVE',
          accountChangedRecently: Boolean(p?.bankUpdatedAt && now - new Date(p.bankUpdatedAt).getTime() < RECENT_DAYS * 86_400_000),
          _accountKey: account,
        };
      });
    if (!items.length) throw new BadRequestException('Nenhum colaborador com líquido a pagar.');

    const alerts = antifraudChecks({
      items: items.map((i) => ({ employeeId: i.employeeId, name: i.name, account: i._accountKey, pixKey: i.pixKey, netCents: i.netCents, active: i.active, accountChangedRecently: i.accountChangedRecently })),
    });
    const totalCents = items.reduce((sum, i) => sum + i.netCents, 0);

    const created = await this.prisma.$transaction(async (tx) => {
      const batch = await tx.payrollBankBatch.create({
        data: {
          companyId: me.companyId, runId: run.id, periodRef, paymentDate: new Date(`${paymentDate}T12:00:00Z`),
          status: 'PENDING_APPROVAL', itemCount: items.length, totalCents,
          antifraud: alerts as unknown as Prisma.InputJsonValue, createdById: me.sub,
        },
      });
      await tx.payrollBankItem.createMany({
        data: items.map((i) => ({
          companyId: me.companyId, batchId: batch.id, employeeId: i.employeeId, name: i.name,
          bankCode: i.bankCode, agency: i.agency, account: i.account, accountDigit: i.accountDigit, pixKey: i.pixKey, netCents: i.netCents,
        })),
      });
      return batch;
    }, { timeout: 120_000, maxWait: 20_000 });

    await this.audit.record(me, {
      module: MODULE, entity: 'PayrollBankBatch', entityId: created.id, action: 'CREATE',
      message: `Lote de pagamento montado (${items.length} colaborador(es), ${alerts.length} alerta(s) antifraude)`,
      after: { itemCount: items.length, totalCents, alerts: alerts.length },
    });
    return { ...created, alerts };
  }

  /** Aprovação com segregação: o aprovador não pode ser quem montou o lote. */
  async approveBatch(me: AuthPayload, id: string, body: any = {}) {
    const batch = await this.batchOf(me.companyId, id);
    if (batch.status !== 'PENDING_APPROVAL') throw new ConflictException('Lote não está aguardando aprovação.');
    if (batch.createdById === me.sub) throw new ForbiddenException('Segregação de funções: o pagamento deve ser aprovado por outra pessoa.');
    const highAlerts = Array.isArray(batch.antifraud) ? (batch.antifraud as Array<{ severity: string }>).filter((a) => a.severity === 'HIGH').length : 0;
    if (highAlerts > 0 && body?.acknowledgeAlerts !== true) {
      throw new BadRequestException(`${highAlerts} alerta(s) antifraude de alta severidade — confirme (acknowledgeAlerts) para aprovar mesmo assim.`);
    }
    const updated = await this.prisma.payrollBankBatch.update({ where: { id }, data: { status: 'APPROVED', approvedById: me.sub, approvedAt: new Date() } });
    await this.audit.record(me, { module: MODULE, entity: 'PayrollBankBatch', entityId: id, action: 'APPROVE', message: 'Pagamento aprovado', after: { highAlertsAcknowledged: highAlerts } });
    return updated;
  }

  /** Gera a remessa CNAB 240 do lote aprovado. */
  async exportRemessa(me: AuthPayload, id: string) {
    const batch = await this.prisma.payrollBankBatch.findFirst({ where: { id, companyId: me.companyId }, include: { items: true } });
    if (!batch) throw new NotFoundException('Lote não encontrado.');
    if (batch.status !== 'APPROVED' && batch.status !== 'EXPORTED') throw new ConflictException('Aprove o lote antes de exportar a remessa.');
    const config = await this.getConfig(me.companyId);
    if (!config) throw new BadRequestException('Configure a conta bancária pagadora antes de exportar.');
    const company = await this.prisma.company.findUnique({ where: { id: me.companyId }, select: { name: true, cnpj: true } });

    const paymentDate = batch.paymentDate.toISOString().slice(0, 10);
    const cnabItems: CnabPaymentItem[] = batch.items.map((item) => ({
      favoredBankCode: item.bankCode ?? config.bankCode,
      favoredAgency: item.agency ?? '',
      favoredAccount: item.account ?? '',
      favoredAccountDigit: item.accountDigit ?? '',
      favoredName: item.name,
      favoredCpf: '',
      amountCents: item.netCents,
      paymentDate,
    }));
    const remessa = buildCnab240({
      company: { bankCode: config.bankCode, cnpj: company?.cnpj ?? '', name: company?.name ?? '', agency: config.agency, account: config.account, accountDigit: config.accountDigit ?? '' },
      items: cnabItems,
      fileSequence: 1,
      generatedAt: new Date(),
    });
    const hash = createHash('sha256').update(remessa.content).digest('hex');
    await this.prisma.payrollBankBatch.update({
      where: { id },
      data: { status: 'EXPORTED', remessaContent: remessa.content, remessaHash: hash, exportedById: me.sub, exportedAt: new Date() },
    });
    await this.audit.record(me, { module: MODULE, entity: 'PayrollBankBatch', entityId: id, action: 'EXPORT', message: `Remessa CNAB 240 gerada (${remessa.lines} linhas)`, after: { hash } });
    return { fileName: `REMESSA-${batch.periodRef}-${id.slice(0, 8)}.REM`, content: remessa.content, lines: remessa.lines, totalCents: remessa.totalCents };
  }

  /** Importa o retorno CNAB e concilia por valor/nome, marcando pago/rejeitado. */
  async importReturn(me: AuthPayload, id: string, body: any = {}) {
    const batch = await this.prisma.payrollBankBatch.findFirst({ where: { id, companyId: me.companyId }, include: { items: true } });
    if (!batch) throw new NotFoundException('Lote não encontrado.');
    const content = String(body?.content ?? '');
    if (!content.trim()) throw new BadRequestException('Envie o conteúdo do retorno CNAB.');
    const parsed = parseCnab240Return(content);

    const remaining = [...batch.items];
    let paid = 0;
    let rejected = 0;
    for (const ret of parsed) {
      // Concilia pelo valor + nome (best-effort).
      const idx = remaining.findIndex((item) => item.netCents === ret.amountCents && normalize(item.name).startsWith(normalize(ret.favoredName).slice(0, 10)));
      const match = idx >= 0 ? remaining.splice(idx, 1)[0] : null;
      if (!match) continue;
      await this.prisma.payrollBankItem.update({ where: { id: match.id }, data: { status: ret.paid ? 'PAID' : 'REJECTED', returnCode: ret.occurrenceCode || null } });
      if (ret.paid) paid += 1; else rejected += 1;
    }
    const status = rejected === 0 && remaining.length === 0 ? 'RECONCILED' : 'RETURNED';
    await this.prisma.payrollBankBatch.update({ where: { id }, data: { status, returnContent: content.slice(0, 200_000) } });
    await this.audit.record(me, { module: MODULE, entity: 'PayrollBankBatch', entityId: id, action: 'RETURN', message: `Retorno conciliado: ${paid} pago(s), ${rejected} rejeitado(s)`, after: { paid, rejected, unmatched: remaining.length } });
    return { paid, rejected, unmatched: remaining.length, status };
  }

  private defaultPaymentDate(year: number, month: number): string {
    const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
    return `${next.y}-${String(next.m).padStart(2, '0')}-05`;
  }

  private async batchOf(companyId: string, id: string) {
    const batch = await this.prisma.payrollBankBatch.findFirst({ where: { id, companyId } });
    if (!batch) throw new NotFoundException('Lote não encontrado.');
    return batch;
  }
}

function text(value: unknown): string | null {
  const t = String(value ?? '').trim();
  return t || null;
}
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
}
