import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrizeAdjustmentStatus, PrizeExceptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { PrizeAuditService } from './prize-audit.service';

/**
 * Configuracoes e governanca dos insumos do calculo: regras de moderador
 * (parametrizaveis), ajustes manuais, excecoes e transitoriedade — todos com
 * trilha de auditoria e, quando aplicavel, fluxo de aprovacao (segregacao).
 */
@Injectable()
export class PrizeCalcConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PrizeAuditService,
  ) {}

  // ---- Moderadores ----
  listModerators(companyId: string, programId?: string) {
    return this.prisma.prizeModeratorRule.findMany({
      where: { companyId, ...(programId ? { OR: [{ programId }, { programId: null }] } : {}) },
      orderBy: [{ eventType: 'asc' }, { priority: 'asc' }],
    });
  }

  async upsertModerator(me: AuthPayload, id: string | null, dto: any) {
    if (!dto.name?.trim() || !dto.eventType?.trim()) throw new BadRequestException('Nome e tipo de evento são obrigatórios');
    const data = {
      name: dto.name.trim(), eventType: dto.eventType.trim(), criterion: dto.criterion ?? null,
      reductionPercent: dto.reductionPercent ?? null, reductionValue: dto.reductionValue ?? null, cap: dto.cap ?? null,
      cumulative: dto.cumulative ?? true, priority: dto.priority ?? 0, requiresApproval: dto.requiresApproval ?? false,
      active: dto.active ?? true, programId: dto.programId ?? null, notes: dto.notes ?? null,
    };
    if (id) {
      const cur = await this.prisma.prizeModeratorRule.findFirst({ where: { id, companyId: me.companyId } });
      if (!cur) throw new NotFoundException('Regra não encontrada');
      const r = await this.prisma.prizeModeratorRule.update({ where: { id }, data });
      await this.audit.log(me, { action: 'UPDATE', entityType: 'MODERATOR_RULE', entityId: id, after: r });
      return r;
    }
    const r = await this.prisma.prizeModeratorRule.create({ data: { ...data, companyId: me.companyId, createdById: me.sub } });
    await this.audit.log(me, { action: 'CREATE', entityType: 'MODERATOR_RULE', entityId: r.id, after: r });
    return r;
  }

  /**
   * Carrega as regras de moderador do MODELO OFICIAL (planilhas Bases_calculo,
   * fórmula AE do VBA CALCULO): falta 34%/dia, suspensão 34%/dia, medida
   * disciplinar 50%/ocorrência (advertência verbal não conta — não a lance
   * como evento), acidente com afastamento 50%/ocorrência e atestado 20%/dia
   * com a 1ª ocorrência abonada. São criadas como regras NORMAIS, editáveis —
   * nada fica fixo em código. Não duplica tipos que já tenham regra ativa.
   */
  async seedDefaultModerators(me: AuthPayload) {
    const DEFAULTS = [
      { name: 'Falta (modelo oficial)', eventType: 'FALTA', criterion: 'PER_DAY', reductionPercent: 34, notes: 'Planilha CALCULO: 34% por dia de falta (justificada ou não)' },
      { name: 'Suspensão (modelo oficial)', eventType: 'SUSPENSAO', criterion: 'PER_DAY', reductionPercent: 34, notes: 'Planilha CALCULO: 34% por dia de suspensão' },
      { name: 'Medida disciplinar (modelo oficial)', eventType: 'MEDIDA_DISCIPLINAR', criterion: 'PER_OCCURRENCE', reductionPercent: 50, notes: 'Planilha CALCULO: 50% por medida (advertência verbal não conta)' },
      { name: 'Acidente com afastamento (modelo oficial)', eventType: 'ACIDENTE', criterion: 'PER_OCCURRENCE', reductionPercent: 50, notes: 'Planilha CALCULO: 50% por acidente do tipo "com afastamento"' },
      { name: 'Atestado (modelo oficial)', eventType: 'ATESTADO', criterion: 'PER_DAY_AFTER_FIRST', reductionPercent: 20, notes: 'Planilha CALCULO/DatasAtestados: 20% por dia de atestado, com o 1º atestado (mais antigo) abonado' },
    ];
    const existing = await this.prisma.prizeModeratorRule.findMany({ where: { companyId: me.companyId, active: true }, select: { eventType: true } });
    const existingTypes = new Set(existing.map((e) => e.eventType));
    let created = 0;
    for (const d of DEFAULTS) {
      if (existingTypes.has(d.eventType)) continue;
      const r = await this.prisma.prizeModeratorRule.create({
        data: { ...d, companyId: me.companyId, cumulative: true, priority: 0, requiresApproval: false, active: true, createdById: me.sub },
      });
      await this.audit.log(me, { action: 'CREATE', entityType: 'MODERATOR_RULE', entityId: r.id, after: r, justification: 'Seed do modelo oficial (planilhas Bases_calculo)' });
      created++;
    }
    return { created, skipped: DEFAULTS.length - created };
  }

  async removeModerator(me: AuthPayload, id: string) {
    const cur = await this.prisma.prizeModeratorRule.findFirst({ where: { id, companyId: me.companyId } });
    if (!cur) throw new NotFoundException('Regra não encontrada');
    await this.prisma.prizeModeratorRule.delete({ where: { id } });
    await this.audit.log(me, { action: 'DELETE', entityType: 'MODERATOR_RULE', entityId: id, before: cur });
    return { ok: true };
  }

  // ---- Ajustes manuais ----
  listAdjustments(companyId: string, competenceId: string) {
    return this.prisma.prizeManualAdjustment.findMany({ where: { companyId, competenceId }, orderBy: { createdAt: 'desc' } });
  }

  async createAdjustment(me: AuthPayload, competenceId: string, dto: any) {
    if (!dto.registration?.trim() || !dto.field?.trim()) throw new BadRequestException('Matrícula e campo são obrigatórios');
    if (!dto.reason?.trim()) throw new BadRequestException('Justificativa é obrigatória');
    const adj = await this.prisma.prizeManualAdjustment.create({
      data: {
        companyId: me.companyId, competenceId, registration: dto.registration.trim(), field: dto.field.trim(),
        previousValue: dto.previousValue ?? null, newValue: dto.newValue ?? null, amount: dto.amount ?? null,
        reason: dto.reason.trim(), evidenceRef: dto.evidenceRef ?? null, status: 'REQUESTED', requestedById: me.sub,
      },
    });
    await this.audit.log(me, { action: 'REQUEST', entityType: 'ADJUSTMENT', entityId: adj.id, competenceId, after: adj, justification: dto.reason });
    return adj;
  }

  /** Segregacao: quem solicita nao aprova o proprio ajuste. */
  async decideAdjustment(me: AuthPayload, id: string, decision: 'APPROVE' | 'REJECT', comment?: string) {
    const adj = await this.prisma.prizeManualAdjustment.findFirst({ where: { id, companyId: me.companyId } });
    if (!adj) throw new NotFoundException('Ajuste não encontrado');
    if (adj.requestedById && adj.requestedById === me.sub) throw new BadRequestException('Quem solicita não pode aprovar o próprio ajuste (segregação de função)');
    const status: PrizeAdjustmentStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const updated = await this.prisma.prizeManualAdjustment.update({ where: { id }, data: { status, decidedById: me.sub, decidedAt: new Date(), comment: comment ?? null } });
    await this.audit.log(me, { action: decision, entityType: 'ADJUSTMENT', entityId: id, competenceId: adj.competenceId, before: { status: adj.status }, after: { status }, justification: comment ?? null });
    return updated;
  }

  // ---- Excecoes ----
  listExceptions(companyId: string, competenceId: string) {
    return this.prisma.prizeException.findMany({ where: { companyId, competenceId }, orderBy: { createdAt: 'desc' } });
  }

  async createException(me: AuthPayload, competenceId: string, dto: any) {
    if (!dto.type?.trim()) throw new BadRequestException('Tipo de exceção é obrigatório');
    if (!dto.reason?.trim()) throw new BadRequestException('Justificativa é obrigatória');
    const exc = await this.prisma.prizeException.create({
      data: {
        companyId: me.companyId, competenceId, registration: dto.registration ?? null, type: dto.type, scope: dto.scope ?? 'ALL',
        avgMonths: dto.avgMonths ?? 6, gratificationValue: dto.gratificationValue ?? null, reason: dto.reason.trim(),
        evidenceRef: dto.evidenceRef ?? null, status: 'REQUESTED', requestedById: me.sub,
      },
    });
    await this.audit.log(me, { action: 'REQUEST', entityType: 'EXCEPTION', entityId: exc.id, competenceId, after: exc, justification: dto.reason });
    return exc;
  }

  async decideException(me: AuthPayload, id: string, decision: 'APPROVE' | 'REJECT', comment?: string) {
    const exc = await this.prisma.prizeException.findFirst({ where: { id, companyId: me.companyId } });
    if (!exc) throw new NotFoundException('Exceção não encontrada');
    const status: PrizeExceptionStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const updated = await this.prisma.prizeException.update({ where: { id }, data: { status, decidedById: me.sub, decidedAt: new Date() } });
    await this.audit.log(me, { action: decision, entityType: 'EXCEPTION', entityId: id, competenceId: exc.competenceId, before: { status: exc.status }, after: { status }, justification: comment ?? null });
    return updated;
  }

  // ---- Transitoriedade ----
  listAllocations(companyId: string, competenceId: string) {
    return this.prisma.prizeTemporaryAllocation.findMany({ where: { companyId, competenceId }, orderBy: { createdAt: 'desc' } });
  }

  async createAllocation(me: AuthPayload, competenceId: string, dto: any) {
    if (!dto.registration?.trim()) throw new BadRequestException('Matrícula é obrigatória');
    const alloc = await this.prisma.prizeTemporaryAllocation.create({
      data: {
        companyId: me.companyId, competenceId, registration: dto.registration.trim(), originArea: dto.originArea ?? null,
        originPosition: dto.originPosition ?? null, destArea: dto.destArea ?? null, destPosition: dto.destPosition ?? null,
        costCenterRef: dto.costCenterRef ?? null, startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null, days: dto.days ?? 0, ruleApplied: dto.ruleApplied ?? 'APPLY_DEST',
        hasRight: dto.hasRight ?? true, reason: dto.reason ?? null, evidenceRef: dto.evidenceRef ?? null, createdById: me.sub,
      },
    });
    await this.audit.log(me, { action: 'CREATE', entityType: 'ALLOCATION', entityId: alloc.id, competenceId, after: alloc });
    return alloc;
  }
}
