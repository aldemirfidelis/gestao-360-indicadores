import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Direction, IndicatorUnit, PrizeIndicatorDirection, PrizeIndicatorKind, PrizeIndicatorSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { PrizeAuditService } from './prize-audit.service';
import { suggestRanges, SuggestedRange } from './prize-ranges.util';

// Mapeia o cadastro nativo (modulo Indicadores) para o vocabulario do premio,
// permitindo herdar nome/unidade/sentido sem redigitar.
const DIRECTION_FROM_PLATFORM: Record<Direction, PrizeIndicatorDirection> = {
  HIGHER_BETTER: 'HIGHER_BETTER',
  LOWER_BETTER: 'LOWER_BETTER',
  EQUAL_TARGET: 'TARGET',
  RANGE: 'TARGET',
};
const UNIT_LABEL: Record<IndicatorUnit, string> = {
  PERCENT: '%', CURRENCY: 'R$', QUANTITY: 'qtde', HOURS: 'h', DAYS: 'dias',
  TONS: 'ton', LITERS: 'L', INDEX: 'índice', TEXT: '', CUSTOM: '',
};

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

  /**
   * Indicadores NATIVOS da plataforma disponiveis para vinculo. Exposto sob
   * permissao do premio (nao exige indicators:view) para o seletor da tela:
   * o caminho padrao e REAPROVEITAR o catalogo unico, nao recriar indicador.
   */
  async listPlatformOptions(companyId: string) {
    const indicators = await this.prisma.indicator.findMany({
      where: { companyId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, code: true, name: true, unit: true, unitLabel: true, direction: true, externalSource: true, externalId: true },
      orderBy: { name: 'asc' },
    });
    return indicators.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      unit: i.unitLabel?.trim() || UNIT_LABEL[i.unit],
      direction: DIRECTION_FROM_PLATFORM[i.direction],
      bscNumber: i.externalSource?.toUpperCase().startsWith('BSC') ? i.externalId : null,
    }));
  }

  private async getPlatformIndicator(companyId: string, platformIndicatorId: string) {
    const native = await this.prisma.indicator.findFirst({
      where: { id: platformIndicatorId, companyId, deletedAt: null },
      select: { id: true, code: true, name: true, description: true, unit: true, unitLabel: true, direction: true, externalSource: true, externalId: true },
    });
    if (!native) throw new NotFoundException('Indicador da plataforma não encontrado');
    return native;
  }

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
    const program = await this.prisma.prizeProgram.findFirst({ where: { id: dto.programId, companyId: me.companyId, deletedAt: null } });
    if (!program) throw new NotFoundException('Programa de prêmio não encontrado');

    // Caminho padrao: vincular um indicador NATIVO e herdar o cadastro
    // (nome/unidade/sentido/descricao). Apenas a parametrizacao do premio
    // (tipo/peso/metas/zeros/faixas) vive aqui — o indicador continua unico.
    const native = dto.platformIndicatorId ? await this.getPlatformIndicator(me.companyId, dto.platformIndicatorId) : null;
    const name = dto.name?.trim() || native?.name;
    if (!name) throw new BadRequestException('Nome do indicador é obrigatório');

    const code = (dto.code ?? '').trim() || (await this.nextCode(me.companyId, dto.programId));
    const dup = await this.prisma.prizeIndicator.findFirst({ where: { programId: dto.programId, code, deletedAt: null } });
    if (dup) throw new ConflictException(`Já existe indicador com o código ${code} neste programa`);

    const indicator = await this.prisma.prizeIndicator.create({
      data: {
        companyId: me.companyId,
        programId: dto.programId,
        annexVersionId: dto.annexVersionId ?? null,
        code,
        name,
        description: dto.description ?? native?.description ?? null,
        unit: dto.unit ?? (native ? native.unitLabel?.trim() || UNIT_LABEL[native.unit] || null : null),
        kind: dto.kind ?? 'COLLECTIVE',
        direction: dto.direction ?? (native ? DIRECTION_FROM_PLATFORM[native.direction] : 'HIGHER_BETTER'),
        source: dto.source ?? (native ? 'INTERNAL_API' : 'MANUAL'),
        bscNumber: dto.bscNumber ?? (native?.externalSource?.toUpperCase().startsWith('BSC') ? native.externalId : null),
        platformIndicatorId: native?.id ?? null,
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
    if (dto.platformIndicatorId) await this.getPlatformIndicator(me.companyId, dto.platformIndicatorId);
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

  /**
   * Sugere faixas no modelo da planilha oficial (distribuição linear zero→meta,
   * faixa 0 com 0%, %pago linear). NÃO persiste — o usuário revisa e aplica.
   * zero/meta podem vir do corpo ou do parâmetro mais recente do indicador.
   */
  async suggestIndicatorRanges(
    me: AuthPayload,
    indicatorId: string,
    dto: { zero?: number | null; target?: number | null; count?: number; decimals?: number },
  ): Promise<{ direction: string; zero: number; target: number; ranges: SuggestedRange[] }> {
    const indicator = await this.get(me.companyId, indicatorId);
    if (indicator.direction === 'TARGET') {
      throw new BadRequestException('Geração automática de faixas vale para indicadores "maior melhor" ou "menor melhor"');
    }
    let zero = dto.zero ?? null;
    let target = dto.target ?? null;
    if (zero === null || target === null) {
      const param = indicator.parameters[0]; // mais recente (ordenado desc no get)
      if (param) {
        zero = zero ?? (param.zero !== null ? Number(param.zero) : null);
        target = target ?? (param.target !== null ? Number(param.target) : null);
      }
    }
    if (zero === null || target === null) {
      throw new BadRequestException('Informe Zero e Meta (ou cadastre um parâmetro de meta/zero para o indicador)');
    }
    try {
      const ranges = suggestRanges({
        zero,
        target,
        direction: indicator.direction === 'LOWER_BETTER' ? 'LOWER_BETTER' : 'HIGHER_BETTER',
        count: dto.count ?? 6,
        decimals: dto.decimals ?? 2,
      });
      return { direction: indicator.direction, zero, target, ranges };
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  /** Aplica um conjunto de faixas de uma vez (substituindo as existentes quando solicitado). */
  async applyRanges(me: AuthPayload, indicatorId: string, ranges: RangeDto[], replaceExisting: boolean) {
    const current = await this.get(me.companyId, indicatorId);
    if (!ranges?.length) throw new BadRequestException('Nenhuma faixa para aplicar');
    await this.prisma.$transaction(async (tx) => {
      if (replaceExisting) await tx.prizeIndicatorRange.deleteMany({ where: { indicatorId } });
      for (const r of ranges) {
        await tx.prizeIndicatorRange.create({
          data: {
            indicatorId,
            parameterId: r.parameterId ?? null,
            orderIndex: r.orderIndex ?? 0,
            minLimit: r.minLimit ?? null,
            maxLimit: r.maxLimit ?? null,
            achievementPercent: r.achievementPercent ?? null,
            gainPercent: r.gainPercent ?? null,
            weight: r.weight ?? null,
            behaviorAbove: r.behaviorAbove ?? null,
            behaviorBelow: r.behaviorBelow ?? null,
            cap: r.cap ?? null,
            floor: r.floor ?? null,
            cumulative: r.cumulative ?? false,
          },
        });
      }
    });
    await this.audit.log(me, {
      action: 'SET_RANGES_BULK',
      entityType: 'INDICATOR',
      entityId: indicatorId,
      before: { ranges: current.ranges.length },
      after: { ranges: ranges.length, replaced: replaceExisting },
    });
    return this.get(me.companyId, indicatorId);
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
