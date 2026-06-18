import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PrizeActualStatus,
  PrizeIndicatorDirection,
  PrizeIndicatorKind,
  PrizeIndicatorSource,
  PrizeRuleAliasKind,
  PrizeRuleIndicatorType,
  PrizeRuleValidityKind,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { PrizeAuditService } from './prize-audit.service';
import { suggestRanges } from './prize-ranges.util';
import { matchInherited, normalizeRuleKey, uniqueNormalized } from './prize-rule-matrix.util';
import { PrizeCatalogService } from './prize-catalog.service';

export interface UpsertCatalogDto {
  code?: string;
  bscNumber?: string | null;
  name?: string;
  description?: string | null;
  unit?: string | null;
  direction?: PrizeIndicatorDirection;
  source?: PrizeIndicatorSource;
  platformIndicatorId?: string | null;
  active?: boolean;
}

export interface UpsertRuleGroupDto {
  annexVersionId?: string;
  name?: string;
  areaRefs?: string[];
  positionRefs?: string[];
  // IDs do catalogo (PrizeOrgRef/PrizeCargoRef) escolhidos no picker. Quando
  // informados, os nomes (areaRefs/positionRefs) sao derivados do catalogo e o
  // matching da apuracao passa a ser por ID.
  areaRefIds?: string[];
  cargoRefIds?: string[];
  salaryPercent?: number;
  notes?: string | null;
  active?: boolean;
}

export interface UpsertRuleIndicatorDto {
  catalogId?: string;
  weight?: number;
  kind?: PrizeIndicatorKind;
  type?: PrizeRuleIndicatorType;
  validityKind?: PrizeRuleValidityKind;
  startMonth?: number;
  monthsCount?: number;
  sortOrder?: number;
  active?: boolean;
}

export interface RuleParameterDto {
  year?: number;
  month?: number;
  zero?: number | null;
  target?: number | null;
  changeReason?: string | null;
}

export interface RuleBandDto {
  orderIndex?: number;
  minLimit?: number | null;
  maxLimit?: number | null;
  achievementPercent?: number | null;
  gainPercent?: number | null;
}

export interface CatalogActualDto {
  catalogId: string;
  realized?: number | null;
  accumulated?: number | null;
  source?: PrizeIndicatorSource;
  status?: PrizeActualStatus;
  comment?: string | null;
  justification?: string | null;
}

export interface RuleAliasDto {
  kind: PrizeRuleAliasKind;
  sourceValue: string;
  canonicalRef?: string | null;
  canonicalName?: string | null;
  notes?: string | null;
  active?: boolean;
}

@Injectable()
export class PrizeRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PrizeAuditService,
    private readonly catalog: PrizeCatalogService,
  ) {}

  async listCatalog(companyId: string, query: { q?: string; active?: string } = {}) {
    return this.prisma.prizeIndicatorCatalog.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(query.active ? { active: query.active === 'true' } : {}),
        ...(query.q
          ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { code: { contains: query.q, mode: 'insensitive' } }, { bscNumber: { contains: query.q, mode: 'insensitive' } }] }
          : {}),
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { ruleIndicators: true, actuals: true } } },
    });
  }

  async createCatalog(me: AuthPayload, dto: UpsertCatalogDto) {
    if (!dto.name?.trim()) throw new BadRequestException('Nome do indicador e obrigatorio');
    const code = (dto.code ?? '').trim() || (dto.bscNumber ? `BSC-${dto.bscNumber}` : await this.nextCatalogCode(me.companyId));
    await this.assertCatalogCode(me.companyId, code);
    if (dto.bscNumber) await this.assertBscNumber(me.companyId, dto.bscNumber);
    const catalog = await this.prisma.prizeIndicatorCatalog.create({
      data: {
        companyId: me.companyId,
        code,
        bscNumber: dto.bscNumber ?? null,
        name: dto.name.trim(),
        description: dto.description ?? null,
        unit: dto.unit ?? null,
        direction: dto.direction ?? 'HIGHER_BETTER',
        source: dto.source ?? 'MANUAL',
        platformIndicatorId: dto.platformIndicatorId ?? null,
        active: dto.active ?? true,
        createdById: me.sub,
      },
    });
    await this.audit.log(me, { action: 'CREATE', entityType: 'RULE_CATALOG', entityId: catalog.id, after: catalog });
    return catalog;
  }

  async updateCatalog(me: AuthPayload, id: string, dto: UpsertCatalogDto) {
    const current = await this.getCatalog(me.companyId, id);
    if (dto.code?.trim() && dto.code.trim() !== current.code) await this.assertCatalogCode(me.companyId, dto.code.trim());
    if (dto.bscNumber && dto.bscNumber !== current.bscNumber) await this.assertBscNumber(me.companyId, dto.bscNumber);
    const updated = await this.prisma.prizeIndicatorCatalog.update({
      where: { id },
      data: {
        code: dto.code?.trim() ?? undefined,
        bscNumber: dto.bscNumber !== undefined ? dto.bscNumber : undefined,
        name: dto.name?.trim() ?? undefined,
        description: dto.description ?? undefined,
        unit: dto.unit ?? undefined,
        direction: dto.direction ?? undefined,
        source: dto.source ?? undefined,
        platformIndicatorId: dto.platformIndicatorId !== undefined ? dto.platformIndicatorId : undefined,
        active: dto.active ?? undefined,
      },
    });
    await this.audit.log(me, { action: 'UPDATE', entityType: 'RULE_CATALOG', entityId: id, before: current, after: updated });
    return updated;
  }

  async listGroups(companyId: string, query: { annexVersionId?: string; programId?: string } = {}) {
    const groups = await this.prisma.prizeRuleGroup.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(query.annexVersionId ? { annexVersionId: query.annexVersionId } : {}),
        ...(query.programId ? { annexVersion: { annex: { programId: query.programId } } } : {}),
      },
      include: {
        annexVersion: { include: { annex: { select: { id: true, code: true, name: true, programId: true } } } },
        indicators: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: { catalog: true, parameters: { orderBy: [{ year: 'desc' }, { month: 'desc' }], include: { bands: { orderBy: { orderIndex: 'asc' } } } } },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
    return this.attachInheritedDefaults(companyId, groups);
  }

  /**
   * Anexa a cada indicador da combinacao os parametros/faixas HERDADOS do
   * indicador v1 (PrizeIndicator, tela "Indicadores e faixas"), casados por
   * platformIndicatorId/BSC/nome. Modelo hibrido: o default vem do indicador;
   * o que estiver em PrizeRuleParameter (v2) sobrescreve por combinacao.
   */
  private async attachInheritedDefaults<T extends { indicators: any[] }>(companyId: string, groups: T[]): Promise<T[]> {
    const catalogs = new Map<string, { platformIndicatorId: string | null; bscNumber: string | null; name: string }>();
    for (const g of groups) for (const ri of g.indicators) {
      if (ri.catalog) catalogs.set(ri.catalogId, { platformIndicatorId: ri.catalog.platformIndicatorId, bscNumber: ri.catalog.bscNumber, name: ri.catalog.name });
    }
    if (catalogs.size === 0) return groups;
    const cats = [...catalogs.values()];
    const platformIds = cats.map((c) => c.platformIndicatorId).filter((v): v is string => !!v);
    const bscNumbers = cats.map((c) => c.bscNumber).filter((v): v is string => !!v);
    const names = cats.map((c) => c.name).filter(Boolean);

    const v1 = await this.prisma.prizeIndicator.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [
          ...(platformIds.length ? [{ platformIndicatorId: { in: platformIds } }] : []),
          ...(bscNumbers.length ? [{ bscNumber: { in: bscNumbers } }] : []),
          ...(names.length ? [{ name: { in: names } }] : []),
        ],
      },
      include: { parameters: true, ranges: { orderBy: { orderIndex: 'asc' } } },
    });
    if (v1.length === 0) return groups;

    for (const g of groups) {
      for (const ri of g.indicators) {
        if (!ri.catalog) { ri.inherited = null; continue; }
        const match = matchInherited({ platformIndicatorId: ri.catalog.platformIndicatorId, bscNumber: ri.catalog.bscNumber, name: ri.catalog.name }, v1);
        ri.inherited = match
          ? {
              sourceId: match.id,
              params: match.parameters.map((p) => ({ year: p.year, month: p.month, zero: p.zero, target: p.target })),
              ranges: match.ranges.map((r) => ({ orderIndex: r.orderIndex, minLimit: r.minLimit, maxLimit: r.maxLimit, achievementPercent: r.achievementPercent, gainPercent: r.gainPercent })),
            }
          : null;
      }
    }
    return groups;
  }

  /** Resolve nomes/IDs da combinacao: se vierem IDs do catalogo, deriva os nomes
   *  do PrizeOrgRef/PrizeCargoRef; senao, usa os nomes do dto (back-compat). */
  private async resolveGroupRefs(companyId: string, dto: UpsertRuleGroupDto, userId?: string | null) {
    const areaIds = new Set((dto.areaRefIds ?? []).filter(Boolean));
    const cargoIds = new Set((dto.cargoRefIds ?? []).filter(Boolean));
    // Nomes livres digitados (sem ID) sao garantidos no catalogo (cria se novo),
    // entao a combinacao sempre acaba referenciando IDs.
    const areaNames = this.cleanRefs(dto.areaRefs ?? []);
    const cargoNames = this.cleanRefs(dto.positionRefs ?? []);
    if (areaNames.length) {
      const map = await this.catalog.ensureOrgRefs(companyId, areaNames.map((name) => ({ name, kind: 'AREA' as const })), userId);
      for (const id of map.values()) areaIds.add(id);
    }
    if (cargoNames.length) {
      const map = await this.catalog.ensureCargoRefs(companyId, cargoNames, userId);
      for (const id of map.values()) cargoIds.add(id);
    }
    const orgs = areaIds.size ? await this.prisma.prizeOrgRef.findMany({ where: { companyId, id: { in: [...areaIds] }, deletedAt: null }, select: { id: true, name: true } }) : [];
    const cargos = cargoIds.size ? await this.prisma.prizeCargoRef.findMany({ where: { companyId, id: { in: [...cargoIds] }, deletedAt: null }, select: { id: true, name: true } }) : [];
    return { areaRefs: orgs.map((o) => o.name), positionRefs: cargos.map((c) => c.name), areaRefIds: orgs.map((o) => o.id), cargoRefIds: cargos.map((c) => c.id) };
  }

  async createGroup(me: AuthPayload, dto: UpsertRuleGroupDto) {
    if (!dto.annexVersionId) throw new BadRequestException('Versao do anexo e obrigatoria');
    if (!dto.name?.trim()) throw new BadRequestException('Nome da combinacao e obrigatorio');
    if (dto.salaryPercent === undefined || dto.salaryPercent === null) throw new BadRequestException('Salario possivel % e obrigatorio');
    await this.assertAnnexVersion(me.companyId, dto.annexVersionId);
    const { areaRefs, positionRefs, areaRefIds, cargoRefIds } = await this.resolveGroupRefs(me.companyId, dto, me.sub);
    if (!areaRefs.length) throw new BadRequestException('Informe pelo menos uma area para a combinacao');
    if (!positionRefs.length) throw new BadRequestException('Informe pelo menos um cargo para a combinacao');
    const group = await this.prisma.prizeRuleGroup.create({
      data: {
        companyId: me.companyId,
        annexVersionId: dto.annexVersionId,
        name: dto.name.trim(),
        areaRefs,
        positionRefs,
        normalizedAreaKeys: uniqueNormalized(areaRefs),
        normalizedPositionKeys: uniqueNormalized(positionRefs),
        areaRefIds,
        cargoRefIds,
        salaryPercent: dto.salaryPercent,
        notes: dto.notes ?? null,
        active: dto.active ?? true,
        createdById: me.sub,
      },
    });
    await this.audit.log(me, { action: 'CREATE', entityType: 'RULE_GROUP', entityId: group.id, after: group });
    return group;
  }

  async updateGroup(me: AuthPayload, id: string, dto: UpsertRuleGroupDto) {
    const current = await this.getGroup(me.companyId, id);
    const refsProvided = dto.areaRefs !== undefined || dto.positionRefs !== undefined || dto.areaRefIds !== undefined || dto.cargoRefIds !== undefined;
    const resolved = refsProvided ? await this.resolveGroupRefs(me.companyId, dto, me.sub) : null;
    if (resolved) {
      if (resolved.areaRefs.length === 0) throw new BadRequestException('Informe pelo menos uma area para a combinacao');
      if (resolved.positionRefs.length === 0) throw new BadRequestException('Informe pelo menos um cargo para a combinacao');
    }
    const updated = await this.prisma.prizeRuleGroup.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? undefined,
        areaRefs: resolved ? resolved.areaRefs : undefined,
        positionRefs: resolved ? resolved.positionRefs : undefined,
        normalizedAreaKeys: resolved ? uniqueNormalized(resolved.areaRefs) : undefined,
        normalizedPositionKeys: resolved ? uniqueNormalized(resolved.positionRefs) : undefined,
        areaRefIds: resolved ? resolved.areaRefIds : undefined,
        cargoRefIds: resolved ? resolved.cargoRefIds : undefined,
        salaryPercent: dto.salaryPercent ?? undefined,
        notes: dto.notes ?? undefined,
        active: dto.active ?? undefined,
      },
    });
    await this.audit.log(me, { action: 'UPDATE', entityType: 'RULE_GROUP', entityId: id, before: current, after: updated });
    return updated;
  }

  async removeGroup(me: AuthPayload, id: string) {
    const current = await this.getGroup(me.companyId, id);
    await this.prisma.prizeRuleGroup.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    await this.audit.log(me, { action: 'DELETE', entityType: 'RULE_GROUP', entityId: id, before: current });
    return { ok: true };
  }

  async addRuleIndicator(me: AuthPayload, groupId: string, dto: UpsertRuleIndicatorDto) {
    const group = await this.getGroup(me.companyId, groupId);
    if (!dto.catalogId) throw new BadRequestException('Indicador de catalogo e obrigatorio');
    if (dto.weight === undefined || dto.weight === null) throw new BadRequestException('Peso % no grupo e obrigatorio');
    await this.getCatalog(me.companyId, dto.catalogId);
    const indicator = await this.prisma.prizeRuleIndicator.create({
      data: {
        companyId: me.companyId,
        groupId: group.id,
        catalogId: dto.catalogId,
        weight: dto.weight,
        kind: dto.kind ?? 'COLLECTIVE',
        type: dto.type ?? 'VARIABLE',
        validityKind: dto.validityKind ?? 'CALENDAR_YEAR',
        startMonth: dto.startMonth ?? 1,
        monthsCount: dto.monthsCount ?? 12,
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true,
        createdById: me.sub,
      },
      include: { catalog: true },
    });
    await this.audit.log(me, { action: 'CREATE', entityType: 'RULE_INDICATOR', entityId: indicator.id, after: indicator });
    return indicator;
  }

  async updateRuleIndicator(me: AuthPayload, id: string, dto: UpsertRuleIndicatorDto) {
    const current = await this.getRuleIndicator(me.companyId, id);
    if (dto.catalogId) await this.getCatalog(me.companyId, dto.catalogId);
    const updated = await this.prisma.prizeRuleIndicator.update({
      where: { id },
      data: {
        catalogId: dto.catalogId ?? undefined,
        weight: dto.weight ?? undefined,
        kind: dto.kind ?? undefined,
        type: dto.type ?? undefined,
        validityKind: dto.validityKind ?? undefined,
        startMonth: dto.startMonth ?? undefined,
        monthsCount: dto.monthsCount ?? undefined,
        sortOrder: dto.sortOrder ?? undefined,
        active: dto.active ?? undefined,
      },
    });
    await this.audit.log(me, { action: 'UPDATE', entityType: 'RULE_INDICATOR', entityId: id, before: current, after: updated });
    return updated;
  }

  async removeRuleIndicator(me: AuthPayload, id: string) {
    const current = await this.getRuleIndicator(me.companyId, id);
    await this.prisma.prizeRuleIndicator.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    await this.audit.log(me, { action: 'DELETE', entityType: 'RULE_INDICATOR', entityId: id, before: current });
    return { ok: true };
  }

  async setParameter(me: AuthPayload, ruleIndicatorId: string, dto: RuleParameterDto) {
    await this.getRuleIndicator(me.companyId, ruleIndicatorId);
    if (!dto.year || !dto.month || dto.month < 1 || dto.month > 12) throw new BadRequestException('Ano e mes validos sao obrigatorios');
    const parameter = await this.prisma.prizeRuleParameter.upsert({
      where: { ruleIndicatorId_year_month: { ruleIndicatorId, year: dto.year, month: dto.month } },
      update: {
        zero: dto.zero ?? null,
        target: dto.target ?? null,
        changeReason: dto.changeReason ?? null,
      },
      create: {
        companyId: me.companyId,
        ruleIndicatorId,
        year: dto.year,
        month: dto.month,
        zero: dto.zero ?? null,
        target: dto.target ?? null,
        changeReason: dto.changeReason ?? null,
        createdById: me.sub,
      },
    });
    await this.audit.log(me, { action: 'SET_PARAMETER', entityType: 'RULE_PARAMETER', entityId: parameter.id, after: parameter, justification: dto.changeReason ?? null });
    return parameter;
  }

  async suggestBands(companyId: string, parameterId: string, dto: { count?: number; decimals?: number }) {
    const parameter = await this.getParameter(companyId, parameterId);
    const zero = parameter.zero === null ? null : Number(parameter.zero);
    const target = parameter.target === null ? null : Number(parameter.target);
    if (zero === null || target === null) throw new BadRequestException('Parametro precisa ter Zero e Meta');
    const direction = parameter.ruleIndicator.catalog.direction === 'LOWER_BETTER' ? 'LOWER_BETTER' : 'HIGHER_BETTER';
    try {
      return {
        zero,
        target,
        direction,
        bands: suggestRanges({ zero, target, direction, count: dto.count ?? 6, decimals: dto.decimals ?? 2 }),
      };
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  async replaceBands(me: AuthPayload, parameterId: string, bands: RuleBandDto[]) {
    await this.getParameter(me.companyId, parameterId);
    if (!bands.length) throw new BadRequestException('Nenhuma faixa informada');
    await this.prisma.$transaction(async (tx) => {
      await tx.prizeRuleBand.deleteMany({ where: { parameterId } });
      await tx.prizeRuleBand.createMany({
        data: bands.map((band) => ({
          companyId: me.companyId,
          parameterId,
          orderIndex: band.orderIndex ?? 0,
          minLimit: band.minLimit ?? null,
          maxLimit: band.maxLimit ?? null,
          achievementPercent: band.achievementPercent ?? null,
          gainPercent: band.gainPercent ?? null,
        })),
      });
    });
    await this.audit.log(me, { action: 'SET_RANGES_BULK', entityType: 'RULE_PARAMETER', entityId: parameterId, after: { bands: bands.length, replaced: true } });
    return this.getParameter(me.companyId, parameterId);
  }

  async listCatalogActuals(companyId: string, competenceId: string) {
    await this.assertCompetence(companyId, competenceId);
    return this.prisma.prizeCatalogActualResult.findMany({
      where: { companyId, competenceId },
      include: { catalog: true },
      orderBy: { catalog: { name: 'asc' } },
    });
  }

  async launchCatalogActual(me: AuthPayload, competenceId: string, dto: CatalogActualDto) {
    const competence = await this.assertCompetence(me.companyId, competenceId);
    await this.getCatalog(me.companyId, dto.catalogId);
    const actual = await this.prisma.prizeCatalogActualResult.upsert({
      where: { competenceId_catalogId: { competenceId, catalogId: dto.catalogId } },
      update: {
        realized: dto.realized ?? null,
        accumulated: dto.accumulated ?? null,
        source: dto.source ?? 'MANUAL',
        status: dto.status ?? 'PENDING',
        comment: dto.comment ?? null,
        justification: dto.justification ?? null,
        responsibleUserId: me.sub,
      },
      create: {
        companyId: me.companyId,
        competenceId,
        catalogId: dto.catalogId,
        year: competence.year,
        month: competence.month,
        realized: dto.realized ?? null,
        accumulated: dto.accumulated ?? null,
        source: dto.source ?? 'MANUAL',
        status: dto.status ?? 'PENDING',
        comment: dto.comment ?? null,
        justification: dto.justification ?? null,
        responsibleUserId: me.sub,
        createdById: me.sub,
      },
      include: { catalog: true },
    });
    await this.audit.log(me, { action: 'SET_ACTUAL', entityType: 'CATALOG_ACTUAL', entityId: actual.id, competenceId, after: actual, justification: dto.justification ?? null });
    return actual;
  }

  async listCellResults(companyId: string, competenceId: string) {
    await this.assertCompetence(companyId, competenceId);
    const run = await this.prisma.prizeCalculationRun.findFirst({
      where: { companyId, competenceId, engineVersion: { contains: 'v2' }, status: { in: ['SUCCESS', 'PARTIAL', 'ERROR'] } },
      orderBy: { version: 'desc' },
    });
    if (!run) return { run: null, cells: [] };
    const cells = await this.prisma.prizeCellResult.findMany({
      where: { runId: run.id },
      include: { group: { select: { id: true, name: true, areaRefs: true, positionRefs: true } } },
      orderBy: [{ areaRef: 'asc' }, { positionRef: 'asc' }],
    });
    return { run, cells };
  }

  async listUnmatched(companyId: string, competenceId: string) {
    await this.assertCompetence(companyId, competenceId);
    const run = await this.prisma.prizeCalculationRun.findFirst({
      where: { companyId, competenceId, engineVersion: { contains: 'v2' }, status: { in: ['SUCCESS', 'PARTIAL', 'ERROR'] } },
      orderBy: { version: 'desc' },
    });
    if (!run) return { run: null, unmatched: [] };
    const unmatched = await this.prisma.prizeUnmatchedEmployee.findMany({
      where: { runId: run.id },
      orderBy: [{ areaRef: 'asc' }, { positionRef: 'asc' }, { name: 'asc' }],
    });
    return { run, unmatched };
  }

  async upsertAlias(me: AuthPayload, dto: RuleAliasDto) {
    if (!dto.sourceValue?.trim()) throw new BadRequestException('Valor de origem e obrigatorio');
    const normalizedKey = normalizeRuleKey(dto.sourceValue);
    if (!normalizedKey) throw new BadRequestException('Valor de origem invalido');
    const alias = await this.prisma.prizeRuleAlias.upsert({
      where: { companyId_kind_normalizedKey: { companyId: me.companyId, kind: dto.kind, normalizedKey } },
      update: {
        sourceValue: dto.sourceValue.trim(),
        canonicalRef: dto.canonicalRef ?? null,
        canonicalName: dto.canonicalName ?? null,
        notes: dto.notes ?? null,
        active: dto.active ?? true,
      },
      create: {
        companyId: me.companyId,
        kind: dto.kind,
        sourceValue: dto.sourceValue.trim(),
        normalizedKey,
        canonicalRef: dto.canonicalRef ?? null,
        canonicalName: dto.canonicalName ?? null,
        notes: dto.notes ?? null,
        active: dto.active ?? true,
        createdById: me.sub,
      },
    });
    await this.audit.log(me, { action: 'UPSERT', entityType: 'RULE_ALIAS', entityId: alias.id, after: alias });
    return alias;
  }

  async listAliases(companyId: string, kind?: PrizeRuleAliasKind) {
    return this.prisma.prizeRuleAlias.findMany({
      where: { companyId, ...(kind ? { kind } : {}) },
      orderBy: [{ kind: 'asc' }, { sourceValue: 'asc' }],
    });
  }

  private cleanRefs(values: string[]) {
    return Array.from(new Set(values.map((v) => v?.trim()).filter(Boolean)));
  }

  private async getCatalog(companyId: string, id: string) {
    const catalog = await this.prisma.prizeIndicatorCatalog.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!catalog) throw new NotFoundException('Indicador de catalogo nao encontrado');
    return catalog;
  }

  private async getGroup(companyId: string, id: string) {
    const group = await this.prisma.prizeRuleGroup.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!group) throw new NotFoundException('Combinacao nao encontrada');
    return group;
  }

  private async getRuleIndicator(companyId: string, id: string) {
    const ruleIndicator = await this.prisma.prizeRuleIndicator.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!ruleIndicator) throw new NotFoundException('Indicador da combinacao nao encontrado');
    return ruleIndicator;
  }

  private async getParameter(companyId: string, id: string) {
    const parameter = await this.prisma.prizeRuleParameter.findFirst({
      where: { id, companyId },
      include: { ruleIndicator: { include: { catalog: true } }, bands: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!parameter) throw new NotFoundException('Parametro nao encontrado');
    return parameter;
  }

  private async assertAnnexVersion(companyId: string, annexVersionId: string) {
    const version = await this.prisma.prizeAnnexVersion.findFirst({ where: { id: annexVersionId, annex: { companyId } } });
    if (!version) throw new NotFoundException('Versao do anexo nao encontrada');
    return version;
  }

  private async assertCompetence(companyId: string, competenceId: string) {
    const competence = await this.prisma.prizeCompetence.findFirst({ where: { id: competenceId, companyId } });
    if (!competence) throw new NotFoundException('Competencia nao encontrada');
    return competence;
  }

  private async nextCatalogCode(companyId: string) {
    const count = await this.prisma.prizeIndicatorCatalog.count({ where: { companyId } });
    return `CAT-${String(count + 1).padStart(4, '0')}`;
  }

  private async assertCatalogCode(companyId: string, code: string) {
    const existing = await this.prisma.prizeIndicatorCatalog.findFirst({ where: { companyId, code, deletedAt: null } });
    if (existing) throw new ConflictException(`Ja existe indicador de catalogo com o codigo ${code}`);
  }

  private async assertBscNumber(companyId: string, bscNumber: string) {
    const existing = await this.prisma.prizeIndicatorCatalog.findFirst({ where: { companyId, bscNumber, deletedAt: null } });
    if (existing) throw new ConflictException(`Ja existe indicador de catalogo com o numero BSC ${bscNumber}`);
  }
}
