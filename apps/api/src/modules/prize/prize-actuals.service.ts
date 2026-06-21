import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrizeActualStatus, PrizeCompetenceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { PrizeAuditService } from './prize-audit.service';

export interface LaunchActualDto {
  indicatorId: string;
  scopeKey?: string;
  week?: number;
  day?: number;
  realized?: number | null;
  accumulated?: number | null;
  comment?: string | null;
  justification?: string | null;
}

// Competencia travada para edicao do realizado a partir destes status.
const LOCKED_COMPETENCE: PrizeCompetenceStatus[] = [
  'CLOSED_FOR_CALC', 'IN_CALCULATION', 'IN_REVIEW', 'IN_APPROVAL', 'APPROVED', 'SENT_TO_PAYROLL', 'PAYSLIPS_PUBLISHED', 'CLOSED',
];
// Status do realizado que travam edicao direta (exige reabertura/correcao).
const ACTUAL_LOCKED: PrizeActualStatus[] = ['CLOSED'];

@Injectable()
export class PrizeActualsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PrizeAuditService,
  ) {}

  private async getCompetence(companyId: string, competenceId: string) {
    const competence = await this.prisma.prizeCompetence.findFirst({ where: { id: competenceId, companyId } });
    if (!competence) throw new NotFoundException('Competência não encontrada');
    return competence;
  }

  private assertCompetenceOpen(status: PrizeCompetenceStatus) {
    if (LOCKED_COMPETENCE.includes(status)) {
      throw new ForbiddenException('Competência fechada. Reabra a competência para lançar/alterar o realizado.');
    }
  }

  async listByCompetence(companyId: string, competenceId: string) {
    await this.getCompetence(companyId, competenceId);
    return this.prisma.prizeActualResult.findMany({
      where: { companyId, competenceId },
      include: { indicator: { select: { id: true, code: true, name: true, unit: true, kind: true } }, _count: { select: { evidences: true } } },
      orderBy: [{ indicator: { name: 'asc' } }, { scopeKey: 'asc' }],
    });
  }

  async launch(me: AuthPayload, competenceId: string, dto: LaunchActualDto) {
    const competence = await this.getCompetence(me.companyId, competenceId);
    this.assertCompetenceOpen(competence.status);

    const indicator = await this.prisma.prizeIndicator.findFirst({
      where: { id: dto.indicatorId, companyId: me.companyId, deletedAt: null },
    });
    if (!indicator) throw new NotFoundException('Indicador não encontrado');
    if (indicator.status !== 'ACTIVE') throw new BadRequestException('Indicador inativo não aceita lançamento');

    const scopeKey = dto.scopeKey ?? '';
    const week = dto.week ?? 0;
    const day = dto.day ?? 0;

    const existing = await this.prisma.prizeActualResult.findFirst({
      where: { companyId: me.companyId, competenceId, indicatorId: dto.indicatorId, scopeKey, week, day },
    });

    // Edicao manual de um realizado ja validado/pendente exige justificativa.
    if (existing && ['PENDING', 'IN_VALIDATION', 'PRE_CLOSE', 'CORRECTED'].includes(existing.status) && !dto.justification?.trim()) {
      throw new BadRequestException('Alteração de realizado em validação exige justificativa');
    }
    if (existing && ACTUAL_LOCKED.includes(existing.status)) {
      throw new ForbiddenException('Realizado fechado. Reabra antes de alterar.');
    }

    // Parametro vigente (meta/zero) para vincular ao realizado.
    const param = await this.resolveParameter(dto.indicatorId, competence.year, competence.month, competenceId, scopeKey);

    const data = {
      companyId: me.companyId,
      competenceId,
      indicatorId: dto.indicatorId,
      parameterId: param?.id ?? null,
      scopeKey,
      year: competence.year,
      month: competence.month,
      week,
      day,
      realized: dto.realized ?? null,
      accumulated: dto.accumulated ?? null,
      comment: dto.comment ?? null,
      justification: dto.justification ?? null,
      responsibleUserId: me.sub,
      status: 'PENDING' as PrizeActualStatus,
    };

    const result = existing
      ? await this.prisma.prizeActualResult.update({ where: { id: existing.id }, data: { ...data, status: existing.status === 'IN_FILLING' ? 'PENDING' : existing.status } })
      : await this.prisma.prizeActualResult.create({ data });

    await this.audit.log(me, {
      action: existing ? 'UPDATE' : 'CREATE',
      entityType: 'ACTUAL',
      entityId: result.id,
      competenceId,
      before: existing ?? undefined,
      after: result,
      justification: dto.justification ?? null,
    });
    return result;
  }

  async saveGrid(me: AuthPayload, competenceId: string, rows: LaunchActualDto[]) {
    const out = [];
    for (const row of rows) {
      out.push(await this.launch(me, competenceId, row));
    }
    return { saved: out.length, items: out };
  }

  async transition(me: AuthPayload, actualId: string, status: PrizeActualStatus) {
    const actual = await this.getActual(me.companyId, actualId);
    const competence = await this.getCompetence(me.companyId, actual.competenceId);
    this.assertCompetenceOpen(competence.status);
    const updated = await this.prisma.prizeActualResult.update({ where: { id: actualId }, data: { status } });
    await this.audit.log(me, { action: 'TRANSITION', entityType: 'ACTUAL', entityId: actualId, competenceId: actual.competenceId, before: { status: actual.status }, after: { status } });
    return updated;
  }

  /** Fecha o realizado de toda a competencia (trava de fechamento do realizado). */
  async closeForCompetence(me: AuthPayload, competenceId: string) {
    const competence = await this.getCompetence(me.companyId, competenceId);
    this.assertCompetenceOpen(competence.status);
    const res = await this.prisma.prizeActualResult.updateMany({
      where: { companyId: me.companyId, competenceId, status: { notIn: ['CLOSED'] } },
      data: { status: 'CLOSED', closedAt: new Date(), closedById: me.sub },
    });
    await this.audit.log(me, { action: 'CLOSE_ACTUALS', entityType: 'COMPETENCE', entityId: competenceId, competenceId, after: { closed: res.count } });
    return { closed: res.count };
  }

  /** Reabre um realizado fechado: exige justificativa e alcada (prize:actuals:close). */
  async reopen(me: AuthPayload, actualId: string, justification: string) {
    const actual = await this.getActual(me.companyId, actualId);
    if (!ACTUAL_LOCKED.includes(actual.status)) throw new BadRequestException('Realizado não está fechado');
    if (!justification?.trim()) throw new BadRequestException('Justificativa é obrigatória para reabrir');
    const updated = await this.prisma.prizeActualResult.update({
      where: { id: actualId },
      data: { status: 'REOPENED', closedAt: null, closedById: null },
    });
    await this.audit.log(me, { action: 'REOPEN', entityType: 'ACTUAL', entityId: actualId, competenceId: actual.competenceId, before: { status: actual.status }, after: { status: 'REOPENED' }, justification });
    return updated;
  }

  async addEvidence(me: AuthPayload, actualId: string, dto: { fileName: string; fileUrl?: string; note?: string }) {
    const actual = await this.getActual(me.companyId, actualId);
    if (!dto.fileName?.trim()) throw new BadRequestException('Nome do arquivo é obrigatório');
    const ev = await this.prisma.prizeActualEvidence.create({
      data: { actualResultId: actual.id, fileName: dto.fileName.trim(), fileUrl: dto.fileUrl ?? null, note: dto.note ?? null, uploadedById: me.sub },
    });
    await this.audit.log(me, { action: 'ADD_EVIDENCE', entityType: 'ACTUAL', entityId: actualId, competenceId: actual.competenceId, after: ev });
    return ev;
  }

  async removeEvidence(me: AuthPayload, actualId: string, evidenceId: string) {
    const actual = await this.getActual(me.companyId, actualId);
    const ev = await this.prisma.prizeActualEvidence.findFirst({ where: { id: evidenceId, actualResultId: actual.id } });
    if (!ev) throw new NotFoundException('Evidência não encontrada');
    await this.prisma.prizeActualEvidence.delete({ where: { id: evidenceId } });
    return { ok: true };
  }

  // ---- helpers ----
  private async getActual(companyId: string, actualId: string) {
    const actual = await this.prisma.prizeActualResult.findFirst({ where: { id: actualId, companyId }, include: { evidences: true } });
    if (!actual) throw new NotFoundException('Lançamento de realizado não encontrado');
    return actual;
  }

  /** Resolve o parametro mais especifico: competencia > (ano+mes) > ano. */
  async resolveParameter(indicatorId: string, year: number, month: number, competenceId: string, scopeKey: string) {
    const params = await this.prisma.prizeIndicatorParameter.findMany({
      where: {
        indicatorId,
        OR: [
          { competenceId },
          { year, month },
          { year, month: null },
        ],
      },
    });
    const scoped = params.filter((p) => !p.scopeKey || p.scopeKey === scopeKey);
    const pool = scoped.length ? scoped : params;
    return (
      pool.find((p) => p.competenceId === competenceId) ??
      pool.find((p) => p.year === year && p.month === month) ??
      pool.find((p) => p.year === year && p.month === null) ??
      null
    );
  }
}
