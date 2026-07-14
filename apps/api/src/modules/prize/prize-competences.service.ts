import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrizeCompetenceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { PrizeAuditService } from './prize-audit.service';
import { PrizeEligibleService } from './prize-eligible.service';

export interface UpsertCompetenceDto {
  programId?: string;
  year?: number;
  month?: number;
  startDate?: string | null;
  endDate?: string | null;
  launchDeadline?: string | null;
  validationDeadline?: string | null;
  approvalDeadline?: string | null;
  payrollDate?: string | null;
  paymentDate?: string | null;
  responsibles?: unknown;
  notes?: string | null;
}

const STATUS_ORDER: PrizeCompetenceStatus[] = [
  'PLANNED',
  'OPEN',
  'FILLING',
  'IN_VALIDATION',
  'PRE_CLOSE',
  'CLOSED_FOR_CALC',
  'IN_CALCULATION',
  'IN_REVIEW',
  'IN_APPROVAL',
  'APPROVED',
  'SENT_TO_PAYROLL',
  'PAYSLIPS_PUBLISHED',
  'CLOSED',
];

// A partir deste status o realizado/calculo ficam travados (fechamento efetivo).
const LOCKED_FROM: PrizeCompetenceStatus = 'CLOSED_FOR_CALC';

export interface ChecklistItem {
  key: string;
  label: string;
  status: 'OK' | 'PENDING' | 'NOT_APPLICABLE';
  blocking: boolean;
  detail?: string;
}

@Injectable()
export class PrizeCompetencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PrizeAuditService,
    private readonly eligible: PrizeEligibleService,
  ) {}

  async list(companyId: string, query: { programId?: string; status?: string; year?: number } = {}) {
    return this.prisma.prizeCompetence.findMany({
      where: {
        companyId,
        ...(query.programId ? { programId: query.programId } : {}),
        ...(query.status ? { status: query.status as PrizeCompetenceStatus } : {}),
        ...(query.year ? { year: Number(query.year) } : {}),
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: { program: { select: { id: true, code: true, name: true } } },
    });
  }

  async get(companyId: string, id: string) {
    const competence = await this.prisma.prizeCompetence.findFirst({
      where: { id, companyId },
      include: { program: { select: { id: true, code: true, name: true } } },
    });
    if (!competence) throw new NotFoundException('Competência não encontrada');
    return competence;
  }

  private async assertProgram(companyId: string, programId: string) {
    const program = await this.prisma.prizeProgram.findFirst({ where: { id: programId, companyId, deletedAt: null } });
    if (!program) throw new NotFoundException('Programa de prêmio não encontrado');
    return program;
  }

  async create(me: AuthPayload, dto: UpsertCompetenceDto) {
    if (!dto.programId) throw new BadRequestException('Programa é obrigatório');
    if (!dto.year || !dto.month || dto.month < 1 || dto.month > 12) {
      throw new BadRequestException('Ano e mês válidos são obrigatórios');
    }
    await this.assertProgram(me.companyId, dto.programId);
    const exists = await this.prisma.prizeCompetence.findFirst({
      where: { programId: dto.programId, year: dto.year, month: dto.month },
    });
    if (exists) throw new ConflictException('Já existe competência para este programa neste mês/ano');

    const label = `${dto.year}-${String(dto.month).padStart(2, '0')}`;
    const competence = await this.prisma.prizeCompetence.create({
      data: {
        companyId: me.companyId,
        programId: dto.programId,
        year: dto.year,
        month: dto.month,
        label,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        launchDeadline: dto.launchDeadline ? new Date(dto.launchDeadline) : null,
        validationDeadline: dto.validationDeadline ? new Date(dto.validationDeadline) : null,
        approvalDeadline: dto.approvalDeadline ? new Date(dto.approvalDeadline) : null,
        payrollDate: dto.payrollDate ? new Date(dto.payrollDate) : null,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : null,
        status: 'PLANNED',
        responsibles: (dto.responsibles as any) ?? undefined,
        notes: dto.notes ?? null,
        createdById: me.sub,
      },
    });
    await this.audit.log(me, { action: 'CREATE', entityType: 'COMPETENCE', entityId: competence.id, competenceId: competence.id, after: competence });
    // Integração 360: semeia a base elegível a partir da base interna de
    // colaboradores (Serviço Pessoal). Best-effort — base vazia não impede a
    // criação, e um import Apdata/arquivo posterior vira o próximo lote.
    try {
      await this.eligible.importFromInternal(me, competence.id);
    } catch {
      // sem base interna (ou sem permissão de escrita) — segue sem semear
    }
    return competence;
  }

  async update(me: AuthPayload, id: string, dto: UpsertCompetenceDto) {
    const current = await this.get(me.companyId, id);
    if (STATUS_ORDER.indexOf(current.status) >= STATUS_ORDER.indexOf(LOCKED_FROM)) {
      throw new ForbiddenException('Competência fechada para cálculo. Reabra antes de editar.');
    }
    const updated = await this.prisma.prizeCompetence.update({
      where: { id },
      data: {
        startDate: dto.startDate !== undefined ? (dto.startDate ? new Date(dto.startDate) : null) : undefined,
        endDate: dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : undefined,
        launchDeadline: dto.launchDeadline !== undefined ? (dto.launchDeadline ? new Date(dto.launchDeadline) : null) : undefined,
        validationDeadline: dto.validationDeadline !== undefined ? (dto.validationDeadline ? new Date(dto.validationDeadline) : null) : undefined,
        approvalDeadline: dto.approvalDeadline !== undefined ? (dto.approvalDeadline ? new Date(dto.approvalDeadline) : null) : undefined,
        payrollDate: dto.payrollDate !== undefined ? (dto.payrollDate ? new Date(dto.payrollDate) : null) : undefined,
        paymentDate: dto.paymentDate !== undefined ? (dto.paymentDate ? new Date(dto.paymentDate) : null) : undefined,
        responsibles: (dto.responsibles as any) ?? undefined,
        notes: dto.notes ?? undefined,
      },
    });
    await this.audit.log(me, { action: 'UPDATE', entityType: 'COMPETENCE', entityId: id, competenceId: id, before: current, after: updated });
    return updated;
  }

  async transition(me: AuthPayload, id: string, target: PrizeCompetenceStatus) {
    const current = await this.get(me.companyId, id);
    if (!STATUS_ORDER.includes(target)) throw new BadRequestException('Status inválido');
    // Avançar para CLOSED_FOR_CALC ou além exige checklist sem pendências bloqueantes.
    if (STATUS_ORDER.indexOf(target) >= STATUS_ORDER.indexOf(LOCKED_FROM) && current.status !== target) {
      const checklist = await this.buildChecklist(me.companyId, current.programId, id);
      const blocking = checklist.filter((c) => c.blocking && c.status === 'PENDING');
      if (blocking.length > 0) {
        throw new ConflictException(`Existem ${blocking.length} pendência(s) impeditiva(s) para fechar a competência`);
      }
    }
    const updated = await this.prisma.prizeCompetence.update({ where: { id }, data: { status: target } });
    await this.audit.log(me, { action: 'TRANSITION', entityType: 'COMPETENCE', entityId: id, competenceId: id, before: { status: current.status }, after: { status: target } });
    return updated;
  }

  async checklist(companyId: string, id: string) {
    const competence = await this.get(companyId, id);
    const items = await this.buildChecklist(companyId, competence.programId, id);
    return {
      competenceId: id,
      blockingPending: items.filter((i) => i.blocking && i.status === 'PENDING').length,
      warnings: items.filter((i) => !i.blocking && i.status === 'PENDING').length,
      items,
    };
  }

  async close(me: AuthPayload, id: string) {
    const competence = await this.get(me.companyId, id);
    const items = await this.buildChecklist(me.companyId, competence.programId, id);
    const blocking = items.filter((c) => c.blocking && c.status === 'PENDING');
    if (blocking.length > 0) {
      throw new ConflictException(`Não é possível fechar: ${blocking.length} pendência(s) impeditiva(s)`);
    }
    const updated = await this.prisma.prizeCompetence.update({
      where: { id },
      data: { status: 'CLOSED_FOR_CALC', closedAt: new Date(), closedById: me.sub, checklist: items as any },
    });
    await this.audit.log(me, { action: 'CLOSE', entityType: 'COMPETENCE', entityId: id, competenceId: id, after: { status: 'CLOSED_FOR_CALC' } });
    return updated;
  }

  async reopen(me: AuthPayload, id: string, justification: string) {
    const competence = await this.get(me.companyId, id);
    if (STATUS_ORDER.indexOf(competence.status) < STATUS_ORDER.indexOf(LOCKED_FROM)) {
      throw new BadRequestException('Competência não está fechada');
    }
    if (!justification?.trim()) throw new BadRequestException('Justificativa é obrigatória para reabertura');
    const updated = await this.prisma.prizeCompetence.update({
      where: { id },
      data: { status: 'FILLING', closedAt: null, closedById: null },
    });
    await this.audit.log(me, {
      action: 'REOPEN',
      entityType: 'COMPETENCE',
      entityId: id,
      competenceId: id,
      before: { status: competence.status },
      after: { status: 'FILLING' },
      justification,
    });
    return updated;
  }

  /**
   * Checklist de fechamento (secao 12.2). Itens de fases futuras (realizado,
   * Apdata, moderadores, ajustes) entram como PENDING nao-bloqueante ate serem
   * implementados, garantindo visibilidade sem travar a operacao na Fase 1.
   */
  private async buildChecklist(companyId: string, programId: string, competenceId: string): Promise<ChecklistItem[]> {
    const [effectiveAnnex, indicators] = await Promise.all([
      this.prisma.prizeAnnexVersion.count({ where: { annex: { programId, companyId }, status: 'EFFECTIVE' } }),
      this.prisma.prizeIndicator.findMany({ where: { programId, companyId, deletedAt: null }, select: { id: true } }),
    ]);
    const indicatorIds = indicators.map((i) => i.id);
    const [paramsCount, rangesCount, actualsWithValue] = await Promise.all([
      indicatorIds.length
        ? this.prisma.prizeIndicatorParameter.count({
            where: { indicatorId: { in: indicatorIds }, OR: [{ competenceId }, { competenceId: null }] },
          })
        : Promise.resolve(0),
      indicatorIds.length ? this.prisma.prizeIndicatorRange.count({ where: { indicatorId: { in: indicatorIds } } }) : Promise.resolve(0),
      this.prisma.prizeActualResult.findMany({
        where: { competenceId, realized: { not: null } },
        select: { indicatorId: true },
        distinct: ['indicatorId'],
      }),
    ]);
    const indicatorsWithActual = actualsWithValue.length;
    const actualsComplete = indicators.length > 0 && indicatorsWithActual >= indicators.length;

    const items: ChecklistItem[] = [
      { key: 'effective_annex', label: 'Anexo vigente para o programa', status: effectiveAnnex > 0 ? 'OK' : 'PENDING', blocking: true },
      { key: 'indicators', label: 'Indicadores cadastrados', status: indicators.length > 0 ? 'OK' : 'PENDING', blocking: true },
      { key: 'targets', label: 'Metas e zeros preenchidos', status: paramsCount > 0 ? 'OK' : 'PENDING', blocking: true, detail: `${paramsCount} parâmetro(s)` },
      { key: 'ranges', label: 'Faixas configuradas', status: rangesCount > 0 ? 'OK' : 'PENDING', blocking: true, detail: `${rangesCount} faixa(s)` },
      { key: 'actuals', label: 'Realizados completos', status: actualsComplete ? 'OK' : 'PENDING', blocking: true, detail: `${indicatorsWithActual}/${indicators.length} indicador(es) com realizado` },
      // Itens das proximas fases (visiveis, nao bloqueantes ate serem implementados)
      { key: 'eligible_base', label: 'Base elegível importada (Apdata)', status: 'PENDING', blocking: false, detail: 'Disponível na fase de Integração Apdata' },
      { key: 'events', label: 'Eventos e moderadores conciliados', status: 'PENDING', blocking: false, detail: 'Disponível na fase de Apuração' },
      { key: 'adjustments', label: 'Ajustes manuais e exceções aprovados', status: 'PENDING', blocking: false, detail: 'Disponível na fase de Ajustes/Exceções' },
    ];
    return items;
  }
}
