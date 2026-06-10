import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrizeIndicatorDirection, PrizeIndicatorKind, PrizeIndicatorSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { PrizeAuditService } from './prize-audit.service';

export interface UpsertIndicatorDto {
  programId?: string;
  annexVersionId?: string | null;
  code?: string;
  name?: string;
  description?: string | null;
  unit?: string | null;
  kind?: PrizeIndicatorKind;
  direction?: PrizeIndicatorDirection;
  source?: PrizeIndicatorSource;
  bscNumber?: string | null;
  platformIndicatorId?: string | null;
  weight?: number | null;
  formula?: string | null;
  roundingRule?: string | null;
  orgNodeId?: string | null;
  positionRef?: string | null;
  costCenterRef?: string | null;
  periodicity?: string;
  status?: string;
}

export interface ParameterDto {
  competenceId?: string | null;
  year?: number | null;
  month?: number | null;
  week?: number | null;
  day?: number | null;
  scopeKey?: string | null;
  target?: number | null;
  zero?: number | null;
  weight?: number | null;
  changeReason?: string | null;
}

export interface RangeDto {
  parameterId?: string | null;
  orderIndex?: number;
  minLimit?: number | null;
  maxLimit?: number | null;
  achievementPercent?: number | null;
  gainPercent?: number | null;
  weight?: number | null;
  behaviorAbove?: string | null;
  behaviorBelow?: string | null;
  cap?: number | null;
  floor?: number | null;
  cumulative?: boolean;
}

@Injectable()
export class PrizeIndicatorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PrizeAuditService,
  ) {}

  async list(companyId: string, query: { programId?: string; annexVersionId?: string; kind?: string; q?: string } = {}) {
    return this.prisma.prizeIndicator.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(query.programId ? { programId: query.programId } : {}),
        ...(query.annexVersionId ? { annexVersionId: query.annexVersionId } : {}),
        ...(query.kind ? { kind: query.kind as PrizeIndicatorKind } : {}),
        ...(query.q
          ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { code: { contains: query.q, mode: 'insensitive' } }] }
          : {}),
      },
      orderBy: [{ name: 'asc' }],
      include: { _count: { select: { parameters: true, ranges: true } } },
    });
  }

  async get(companyId: string, id: string) {
    const indicator = await this.prisma.prizeIndicator.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        parameters: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
        ranges: { orderBy: { orderIndex: 'asc' } },
        program: { select: { id: true, code: true, name: true } },
      },
    });
    if (!indicator) throw new NotFoundException('Indicador não encontrado');
    return indicator;
  }

  async create(me: AuthPayload, dto: UpsertIndicatorDto) {
    if (!dto.programId) throw new BadRequestException('Programa é obrigatório');
    if (!dto.name?.trim()) throw new BadRequestException('Nome do indicador é obrigatório');
    const program = await this.prisma.prizeProgram.findFirst({ where: { id: dto.programId, companyId: me.companyId, deletedAt: null } });
    if (!program) throw new NotFoundException('Programa de prêmio não encontrado');

    const code = (dto.code ?? '').trim() || (await this.nextCode(me.companyId, dto.programId));
    const dup = await this.prisma.prizeIndicator.findFirst({ where: { programId: dto.programId, code, deletedAt: null } });
    if (dup) throw new ConflictException(`Já existe indicador com o código ${code} neste programa`);

    const indicator = await this.prisma.prizeIndicator.create({
      data: {
        companyId: me.companyId,
        programId: dto.programId,
        annexVersionId: dto.annexVersionId ?? null,
        code,
        name: dto.name.trim(),
        description: dto.description ?? null,
        unit: dto.unit ?? null,
        kind: dto.kind ?? 'COLLECTIVE',
        direction: dto.direction ?? 'HIGHER_BETTER',
        source: dto.source ?? 'MANUAL',
        bscNumber: dto.bscNumber ?? null,
        platformIndicatorId: dto.platformIndicatorId ?? null,
        weight: dto.weight ?? null,
        formula: dto.formula ?? null,
        roundingRule: dto.roundingRule ?? null,
        orgNodeId: dto.orgNodeId ?? null,
        positionRef: dto.positionRef ?? null,
        costCenterRef: dto.costCenterRef ?? null,
        periodicity: (dto.periodicity as any) ?? 'MONTHLY',
        status: dto.status ?? 'ACTIVE',
        createdById: me.sub,
      },
    });
    await this.audit.log(me, { action: 'CREATE', entityType: 'INDICATOR', entityId: indicator.id, after: indicator });
    return indicator;
  }

  async update(me: AuthPayload, id: string, dto: UpsertIndicatorDto) {
    const current = await this.get(me.companyId, id);
    const updated = await this.prisma.prizeIndicator.update({
      where: { id },
      data: {
        annexVersionId: dto.annexVersionId ?? undefined,
        name: dto.name?.trim() ?? undefined,
        description: dto.description ?? undefined,
        unit: dto.unit ?? undefined,
        kind: dto.kind ?? undefined,
        direction: dto.direction ?? undefined,
        source: dto.source ?? undefined,
        bscNumber: dto.bscNumber ?? undefined,
        platformIndicatorId: dto.platformIndicatorId !== undefined ? dto.platformIndicatorId : undefined,
        weight: dto.weight ?? undefined,
        formula: dto.formula ?? undefined,
        roundingRule: dto.roundingRule ?? undefined,
        orgNodeId: dto.orgNodeId ?? undefined,
        positionRef: dto.positionRef ?? undefined,
        costCenterRef: dto.costCenterRef ?? undefined,
        periodicity: (dto.periodicity as any) ?? undefined,
        status: dto.status ?? undefined,
      },
    });
    await this.audit.log(me, { action: 'UPDATE', entityType: 'INDICATOR', entityId: id, before: current, after: updated });
    return updated;
  }

  async remove(me: AuthPayload, id: string) {
    const current = await this.get(me.companyId, id);
    await this.prisma.prizeIndicator.update({ where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
    await this.audit.log(me, { action: 'DELETE', entityType: 'INDICATOR', entityId: id, before: current });
    return { ok: true };
  }

  // ---- parametros (metas/zeros variaveis) ----
  async setParameter(me: AuthPayload, indicatorId: string, dto: ParameterDto) {
    await this.get(me.companyId, indicatorId);
    const param = await this.prisma.prizeIndicatorParameter.create({
      data: {
        indicatorId,
        competenceId: dto.competenceId ?? null,
        year: dto.year ?? null,
        month: dto.month ?? null,
        week: dto.week ?? null,
        day: dto.day ?? null,
        scopeKey: dto.scopeKey ?? null,
        target: dto.target ?? null,
        zero: dto.zero ?? null,
        weight: dto.weight ?? null,
        changeReason: dto.changeReason ?? null,
        createdById: me.sub,
      },
    });
    await this.audit.log(me, { action: 'SET_PARAMETER', entityType: 'PARAMETER', entityId: param.id, after: param, justification: dto.changeReason ?? null });
    return param;
  }

  async removeParameter(me: AuthPayload, indicatorId: string, parameterId: string) {
    await this.get(me.companyId, indicatorId);
    const param = await this.prisma.prizeIndicatorParameter.findFirst({ where: { id: parameterId, indicatorId } });
    if (!param) throw new NotFoundException('Parâmetro não encontrado');
    await this.prisma.prizeIndicatorParameter.delete({ where: { id: parameterId } });
    await this.audit.log(me, { action: 'DELETE_PARAMETER', entityType: 'PARAMETER', entityId: parameterId, before: param });
    return { ok: true };
  }

  // ---- faixas ----
  async setRange(me: AuthPayload, indicatorId: string, dto: RangeDto) {
    await this.get(me.companyId, indicatorId);
    const range = await this.prisma.prizeIndicatorRange.create({
      data: {
        indicatorId,
        parameterId: dto.parameterId ?? null,
        orderIndex: dto.orderIndex ?? 0,
        minLimit: dto.minLimit ?? null,
        maxLimit: dto.maxLimit ?? null,
        achievementPercent: dto.achievementPercent ?? null,
        gainPercent: dto.gainPercent ?? null,
        weight: dto.weight ?? null,
        behaviorAbove: dto.behaviorAbove ?? null,
        behaviorBelow: dto.behaviorBelow ?? null,
        cap: dto.cap ?? null,
        floor: dto.floor ?? null,
        cumulative: dto.cumulative ?? false,
      },
    });
    await this.audit.log(me, { action: 'SET_RANGE', entityType: 'RANGE', entityId: range.id, after: range });
    return range;
  }

  async removeRange(me: AuthPayload, indicatorId: string, rangeId: string) {
    await this.get(me.companyId, indicatorId);
    const range = await this.prisma.prizeIndicatorRange.findFirst({ where: { id: rangeId, indicatorId } });
    if (!range) throw new NotFoundException('Faixa não encontrada');
    await this.prisma.prizeIndicatorRange.delete({ where: { id: rangeId } });
    await this.audit.log(me, { action: 'DELETE_RANGE', entityType: 'RANGE', entityId: rangeId, before: range });
    return { ok: true };
  }

  private async nextCode(companyId: string, programId: string) {
    const count = await this.prisma.prizeIndicator.count({ where: { programId } });
    return `IND-${String(count + 1).padStart(3, '0')}`;
  }
}
