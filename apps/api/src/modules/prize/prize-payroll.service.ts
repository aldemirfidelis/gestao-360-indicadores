import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { PrizeAuditService } from './prize-audit.service';
import { buildPayrollItems, payrollToCsv, reconcileReturn, ReturnRow } from './prize-payroll.util';

/**
 * Integracao de saida para a folha: gera lote (rubrica/verba) a partir da
 * apuracao, exporta arquivo, registra envio/protocolo e concilia o retorno.
 */
@Injectable()
export class PrizePayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PrizeAuditService,
  ) {}

  private async getCompetence(companyId: string, competenceId: string) {
    const c = await this.prisma.prizeCompetence.findFirst({ where: { id: competenceId, companyId } });
    if (!c) throw new NotFoundException('Competência não encontrada');
    return c;
  }

  async generate(me: AuthPayload, competenceId: string, rubric?: string) {
    const competence = await this.getCompetence(me.companyId, competenceId);
    const run = await this.prisma.prizeCalculationRun.findFirst({
      where: { companyId: me.companyId, competenceId, status: { in: ['SUCCESS', 'PARTIAL'] } },
      orderBy: { version: 'desc' },
    });
    if (!run) throw new BadRequestException('Rode a apuração antes de gerar o lote da folha');
    const results = await this.prisma.prizeCalculationResult.findMany({ where: { runId: run.id } });
    if (!results.length) throw new BadRequestException('Apuração sem resultados');

    const program = await this.prisma.prizeProgram.findFirst({ where: { id: competence.programId } });
    const usedRubric = rubric ?? program?.defaultRubric ?? null;
    const drafts = buildPayrollItems(
      results.map((r) => ({ id: r.id, registration: r.registration, name: r.name, finalValue: r.finalValue ? Number(r.finalValue) : null, blocked: r.blocked, blockReason: r.blockReason })),
      usedRubric,
    );
    const payable = drafts.filter((d) => d.status === 'PENDING');
    const totalValue = payable.reduce((s, d) => s + d.value, 0);
    const count = await this.prisma.prizePayrollBatch.count({ where: { companyId: me.companyId, competenceId } });
    const code = `FOLHA-${competence.label}-${String(count + 1).padStart(2, '0')}`;

    const batch = await this.prisma.prizePayrollBatch.create({
      data: {
        companyId: me.companyId, competenceId, runId: run.id, code, rubric: usedRubric, status: 'GENERATED',
        totalItems: drafts.length, totalValue, generatedAt: new Date(), createdById: me.sub,
        items: { create: drafts.map((d) => ({ companyId: me.companyId, registration: d.registration, name: d.name, rubric: d.rubric, value: d.value, status: d.status, blockReason: d.blockReason, calcResultId: d.calcResultId })) },
      },
    });
    await this.audit.log(me, { action: 'GENERATE', entityType: 'PAYROLL_BATCH', entityId: batch.id, competenceId, after: { code, totalValue, items: drafts.length } });
    return batch;
  }

  list(companyId: string, competenceId?: string) {
    return this.prisma.prizePayrollBatch.findMany({
      where: { companyId, ...(competenceId ? { competenceId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { items: true } } },
    });
  }

  async get(companyId: string, batchId: string) {
    const batch = await this.prisma.prizePayrollBatch.findFirst({
      where: { id: batchId, companyId },
      include: { items: { orderBy: { name: 'asc' } } },
    });
    if (!batch) throw new NotFoundException('Lote não encontrado');
    return batch;
  }

  async exportCsv(companyId: string, batchId: string) {
    const batch = await this.get(companyId, batchId);
    const competence = await this.prisma.prizeCompetence.findFirst({ where: { id: batch.competenceId } });
    const csv = payrollToCsv(batch.items.map((i) => ({ registration: i.registration, name: i.name, rubric: i.rubric, value: Number(i.value), status: i.status })), competence?.label ?? '');
    return { filename: `${batch.code}.csv`, csv };
  }

  async markSent(me: AuthPayload, batchId: string, protocol?: string) {
    const batch = await this.get(me.companyId, batchId);
    if (batch.status === 'CANCELLED') throw new BadRequestException('Lote cancelado');
    const updated = await this.prisma.prizePayrollBatch.update({
      where: { id: batchId },
      data: { status: 'SENT', protocol: protocol ?? null, sentAt: new Date() },
    });
    await this.prisma.prizePayrollBatchItem.updateMany({ where: { batchId, status: 'PENDING' }, data: { status: 'SENT' } });
    await this.prisma.prizeCompetence.update({ where: { id: batch.competenceId }, data: { status: 'SENT_TO_PAYROLL' } }).catch(() => undefined);
    await this.audit.log(me, { action: 'SENT', entityType: 'PAYROLL_BATCH', entityId: batchId, competenceId: batch.competenceId, after: { protocol } });
    return updated;
  }

  async importReturn(me: AuthPayload, batchId: string, rows: ReturnRow[]) {
    const batch = await this.get(me.companyId, batchId);
    if (!rows?.length) throw new BadRequestException('Retorno vazio');
    const recon = reconcileReturn(batch.items, rows);
    const byReg = new Map(batch.items.map((i) => [i.registration, i]));
    for (const row of rows) {
      const item = byReg.get(row.registration);
      if (!item) continue;
      const st = (row.status ?? '').toUpperCase();
      const rejected = st === 'REJECTED' || st === 'REJEITADO' || !!row.returnCode;
      await this.prisma.prizePayrollBatchItem.update({
        where: { id: item.id },
        data: { status: rejected ? 'REJECTED' : 'ACCEPTED', returnCode: row.returnCode ?? null, returnMessage: row.returnMessage ?? null },
      });
    }
    const updated = await this.prisma.prizePayrollBatch.update({
      where: { id: batchId },
      data: { status: 'RETURNED', returnedAt: new Date(), rejectedCount: recon.rejected },
    });
    await this.audit.log(me, { action: 'RETURN', entityType: 'PAYROLL_BATCH', entityId: batchId, competenceId: batch.competenceId, after: recon });
    return { batch: updated, reconciliation: recon };
  }

  async cancel(me: AuthPayload, batchId: string) {
    const batch = await this.get(me.companyId, batchId);
    const updated = await this.prisma.prizePayrollBatch.update({ where: { id: batchId }, data: { status: 'CANCELLED' } });
    await this.audit.log(me, { action: 'CANCEL', entityType: 'PAYROLL_BATCH', entityId: batchId, competenceId: batch.competenceId });
    return updated;
  }
}
