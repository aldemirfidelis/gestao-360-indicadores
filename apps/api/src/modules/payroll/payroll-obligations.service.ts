import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AuthPayload } from '../auth/auth.types';
import {
  buildQualifCadRows,
  dueDateFor,
  OBLIGATION_TEMPLATES,
  parseQualifCadReturn,
  qualifCadCsv,
} from './payroll-obligations.logic';

const MODULE = 'payroll';
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const STATUSES = ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'PAID', 'DONE', 'NA'];

/**
 * Central de Obrigações Trabalhistas ASSISTIDAS (Fase 5). Organiza prazos,
 * checklists e comprovantes; NÃO transmite nem paga — isso é feito pela empresa
 * nos portais oficiais. Marca uma guia como paga só quando há comprovante.
 */
@Injectable()
export class PayrollObligationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
  ) {}

  async list(me: AuthPayload, periodRef?: string) {
    return this.prisma.payrollObligation.findMany({
      where: { companyId: me.companyId, ...(periodRef && PERIOD_RE.test(periodRef) ? { periodRef } : {}) },
      orderBy: [{ periodRef: 'desc' }, { dueDate: 'asc' }],
      take: 300,
    });
  }

  /** Gera (idempotente) o conjunto padrão de obrigações da competência com prazos. */
  async generateForCompetence(me: AuthPayload, periodRef: string) {
    if (!PERIOD_RE.test(periodRef)) throw new BadRequestException('Competência inválida (YYYY-MM).');
    let created = 0;
    for (const template of OBLIGATION_TEMPLATES) {
      const exists = await this.prisma.payrollObligation.findUnique({
        where: { companyId_kind_periodRef: { companyId: me.companyId, kind: template.kind, periodRef } },
      });
      if (exists) continue;
      const due = dueDateFor(periodRef, template.dueDay);
      await this.prisma.payrollObligation.create({
        data: {
          companyId: me.companyId,
          kind: template.kind,
          periodRef,
          title: template.title,
          dueDate: due ? new Date(`${due}T12:00:00Z`) : null,
          officialUrl: template.officialUrl,
          checklist: template.checklist.map((label) => ({ label, done: false })) as unknown as Prisma.InputJsonValue,
          createdById: me.sub,
        },
      });
      created += 1;
    }
    await this.audit.record(me, {
      module: MODULE, entity: 'PayrollObligation', action: 'GENERATE',
      message: `Obrigações da competência ${periodRef} geradas (${created} nova(s))`,
      after: { periodRef, created },
    });
    return { created, periodRef, obligations: await this.list(me, periodRef) };
  }

  async update(me: AuthPayload, id: string, body: any = {}) {
    const obligation = await this.obligationOf(me.companyId, id);
    const data: Prisma.PayrollObligationUpdateInput = {};
    if ('status' in body) {
      const status = String(body.status);
      if (!STATUSES.includes(status)) throw new BadRequestException('Status inválido.');
      // "Paga" exige comprovante anexado — não marcar como pago sem prova.
      const hasProof = Array.isArray(obligation.attachments) && (obligation.attachments as unknown[]).length > 0;
      if ((status === 'PAID' || status === 'DONE') && obligation.kind !== 'DET' && !hasProof && !body.force) {
        throw new BadRequestException('Anexe o comprovante antes de marcar como pago/concluído.');
      }
      data.status = status;
    }
    if ('checklist' in body && Array.isArray(body.checklist)) data.checklist = body.checklist;
    if ('amountCents' in body) data.amountCents = body.amountCents == null ? null : Math.round(Number(body.amountCents));
    if ('protocol' in body) data.protocol = text(body.protocol);
    if ('notes' in body) data.notes = text(body.notes);
    if ('responsibleId' in body) data.responsibleId = text(body.responsibleId);
    if ('dueDate' in body) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    const updated = await this.prisma.payrollObligation.update({ where: { id }, data });
    await this.audit.record(me, {
      module: MODULE, entity: 'PayrollObligation', entityId: id, action: 'UPDATE',
      message: `Obrigação ${obligation.kind} (${obligation.periodRef}) atualizada`,
      after: { status: data.status, protocol: data.protocol },
    });
    return updated;
  }

  /** Registra o comprovante (metadados) de uma obrigação. */
  async addAttachment(me: AuthPayload, id: string, body: any = {}) {
    const obligation = await this.obligationOf(me.companyId, id);
    const name = text(body?.name);
    if (!name) throw new BadRequestException('Informe o nome do comprovante.');
    const attachments = [
      ...(Array.isArray(obligation.attachments) ? (obligation.attachments as unknown[]) : []),
      { name, note: text(body?.note), storageKey: text(body?.storageKey), uploadedAt: new Date().toISOString() },
    ];
    const updated = await this.prisma.payrollObligation.update({ where: { id }, data: { attachments: attachments as unknown as Prisma.InputJsonValue } });
    await this.audit.record(me, {
      module: MODULE, entity: 'PayrollObligation', entityId: id, action: 'ATTACH',
      message: `Comprovante anexado à obrigação ${obligation.kind}`,
      after: { name },
    });
    return updated;
  }

  // ------------------------------ Qualificação Cadastral ------------------------------

  /** Gera o arquivo CSV do lote de Qualificação Cadastral dos colaboradores ativos. */
  async generateQualifCad(me: AuthPayload, periodRef: string) {
    if (!PERIOD_RE.test(periodRef)) throw new BadRequestException('Competência inválida (YYYY-MM).');
    const employees = await this.prisma.orgEmployee.findMany({
      where: { companyId: me.companyId, status: 'ACTIVE' },
      select: { name: true, personnelProfile: { select: { cpf: true, pisPasep: true, birthDate: true } } },
      orderBy: { name: 'asc' },
    });
    const { rows, issues } = buildQualifCadRows(
      employees.map((e) => ({
        name: e.name,
        cpf: e.personnelProfile?.cpf ?? null,
        nis: e.personnelProfile?.pisPasep ?? null,
        birthDate: e.personnelProfile?.birthDate ? e.personnelProfile.birthDate.toISOString().slice(0, 10) : null,
      })),
    );
    const csv = qualifCadCsv(rows);
    const obligation = await this.prisma.payrollObligation.upsert({
      where: { companyId_kind_periodRef: { companyId: me.companyId, kind: 'QUALIF_CADASTRAL', periodRef } },
      create: {
        companyId: me.companyId, kind: 'QUALIF_CADASTRAL', periodRef,
        title: 'Qualificação Cadastral — lote', status: 'IN_PROGRESS',
        officialUrl: 'https://consultacadastral.inss.gov.br/',
        resultJson: { generatedRows: rows.length, issues } as unknown as Prisma.InputJsonValue,
        createdById: me.sub,
      },
      update: { resultJson: { generatedRows: rows.length, issues } as unknown as Prisma.InputJsonValue, status: 'IN_PROGRESS' },
    });
    await this.audit.record(me, {
      module: MODULE, entity: 'PayrollObligation', entityId: obligation.id, action: 'GENERATE',
      message: `Lote de Qualificação Cadastral gerado (${rows.length} colaborador(es))`,
      after: { rows: rows.length, issues: issues.length },
    });
    return { fileName: `QualificacaoCadastral-${periodRef}.csv`, content: csv, rows: rows.length, issues, obligationId: obligation.id };
  }

  /** Importa o retorno da Qualificação Cadastral e registra as divergências. */
  async importQualifCadReturn(me: AuthPayload, id: string, body: any = {}) {
    const obligation = await this.obligationOf(me.companyId, id);
    const csv = String(body?.content ?? '');
    if (!csv.trim()) throw new BadRequestException('Envie o conteúdo do retorno.');
    const parsed = parseQualifCadReturn(csv);
    const divergent = parsed.filter((r) => r.status === 'DIVERGENTE');
    const updated = await this.prisma.payrollObligation.update({
      where: { id },
      data: {
        status: divergent.length ? 'IN_PROGRESS' : 'DONE',
        resultJson: {
          ...(obligation.resultJson as object | null),
          checked: parsed.length,
          divergent: divergent.length,
          divergences: divergent.slice(0, 500),
        } as unknown as Prisma.InputJsonValue,
      },
    });
    await this.audit.record(me, {
      module: MODULE, entity: 'PayrollObligation', entityId: id, action: 'IMPORT',
      message: `Retorno da Qualificação Cadastral: ${divergent.length} divergência(s) em ${parsed.length}`,
      after: { checked: parsed.length, divergent: divergent.length },
    });
    return { checked: parsed.length, divergent: divergent.length, obligation: updated };
  }

  /** Conta obrigações vencidas e ainda em aberto (para alertas/scheduler). */
  async countOverdue(companyId: string): Promise<number> {
    return this.prisma.payrollObligation.count({
      where: { companyId, dueDate: { lt: new Date() }, status: { in: ['PENDING', 'IN_PROGRESS', 'SUBMITTED'] } },
    });
  }

  private async obligationOf(companyId: string, id: string) {
    const obligation = await this.prisma.payrollObligation.findFirst({ where: { id, companyId } });
    if (!obligation) throw new NotFoundException('Obrigação não encontrada.');
    return obligation;
  }
}

function text(value: unknown): string | null {
  const t = String(value ?? '').trim();
  return t || null;
}
