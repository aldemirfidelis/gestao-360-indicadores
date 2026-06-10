/* eslint-disable no-console */
import {
  Direction,
  FeedKind,
  IndicatorStatus,
  IndicatorType,
  IndicatorUnit,
  OrgNodeType,
  Prisma,
  PrismaClient,
  PrizeIndicatorDirection,
} from '@prisma/client';

const prisma = new PrismaClient();

const SOURCE = 'PRIZE_SEED_0561';
const PROGRAM_CODE = 'PREMIO_ESTRADAS_0561';
const ANNEX_CODE = '0561';
const YEAR = Number(argValue('year') ?? process.env.SEED_PRIZE_YEAR ?? 2026);
const COMPANY_QUERY = argValue('company') ?? process.env.SEED_COMPANY ?? 'Goiasa';
const DRY_RUN = process.argv.includes('--dry-run');

const POSITIONS = [
  'Coordenador Agroindustrial Pl',
  'Coordenador de Area',
  'Coordenador de Area Jr',
];

const MONTHLY_32131 = [
  { month: 1, zero: 20.760975609756098, target: 19 },
  { month: 2, zero: 14.205, target: 13 },
  { month: 3, zero: 19.668, target: 18 },
  { month: 4, zero: 16.244, target: 15 },
  { month: 5, zero: 19.493, target: 18 },
  { month: 6, zero: 17.327, target: 16 },
  { month: 7, zero: 22.74, target: 21 },
  { month: 8, zero: 23.824, target: 22 },
  { month: 9, zero: 14.078, target: 13 },
  { month: 10, zero: 19.493, target: 18 },
  { month: 11, zero: 19.493, target: 18 },
  { month: 12, zero: 15.161, target: 14 },
];

const INDICATORS = [
  {
    code: '22780',
    name: '% CONF ISSMA - ESTRADAS',
    unit: IndicatorUnit.PERCENT,
    unitLabel: '%',
    direction: Direction.HIGHER_BETTER,
    prizeDirection: 'HIGHER_BETTER' as PrizeIndicatorDirection,
    weight: 50,
    fixedZero: 95,
    fixedTarget: 100,
    description: 'Conformidade ISSMA das atividades do setor de estradas.',
  },
  {
    code: '32131',
    name: 'Chamado Problema',
    unit: IndicatorUnit.QUANTITY,
    unitLabel: 'Qtd',
    direction: Direction.LOWER_BETTER,
    prizeDirection: 'LOWER_BETTER' as PrizeIndicatorDirection,
    weight: 50,
    description: 'Quantidade de chamados/problemas do setor de estradas.',
  },
];

const MODERATOR_DEFAULTS = [
  { name: 'Falta (modelo oficial)', eventType: 'FALTA', criterion: 'PER_DAY', reductionPercent: 34, notes: 'Bases_calculo: 34% por dia de falta.' },
  { name: 'Suspensao (modelo oficial)', eventType: 'SUSPENSAO', criterion: 'PER_DAY', reductionPercent: 34, notes: 'Bases_calculo: 34% por dia de suspensao.' },
  { name: 'Medida disciplinar (modelo oficial)', eventType: 'MEDIDA_DISCIPLINAR', criterion: 'PER_OCCURRENCE', reductionPercent: 50, notes: 'Bases_calculo: 50% por ocorrencia.' },
  { name: 'Acidente com afastamento (modelo oficial)', eventType: 'ACIDENTE', criterion: 'PER_OCCURRENCE', reductionPercent: 50, notes: 'Bases_calculo: 50% por ocorrencia.' },
  { name: 'Atestado (modelo oficial)', eventType: 'ATESTADO', criterion: 'PER_DAY_AFTER_FIRST', reductionPercent: 20, notes: 'Bases_calculo: 20% por dia, com a primeira ocorrencia abonada.' },
];

type Tx = Prisma.TransactionClient;

interface SuggestedRange {
  orderIndex: number;
  minLimit: number | null;
  maxLimit: number | null;
  achievementPercent: number;
  gainPercent: number;
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function suggestRanges(input: {
  zero: number;
  target: number;
  direction: 'HIGHER_BETTER' | 'LOWER_BETTER';
  count: number;
  decimals: number;
}): SuggestedRange[] {
  const { zero, target, direction, count, decimals } = input;
  const gap = 10 ** -decimals;
  const steps = count - 1;
  const percent = (index: number) => round((index / steps) * 100, 4);

  if (!Number.isInteger(count) || count < 2 || count > 6) throw new Error('Quantidade de faixas deve estar entre 2 e 6.');
  if (direction === 'HIGHER_BETTER' && target <= zero) throw new Error('Meta deve ser maior que zero para indicador maior-melhor.');
  if (direction === 'LOWER_BETTER' && target >= zero) throw new Error('Meta deve ser menor que zero para indicador menor-melhor.');

  if (direction === 'HIGHER_BETTER') {
    const ranges: SuggestedRange[] = [
      { orderIndex: 0, minLimit: 0, maxLimit: round(zero, decimals), achievementPercent: 0, gainPercent: 0 },
    ];
    const stepSize = (target - zero) / steps;
    for (let index = 1; index <= steps; index++) {
      const minLimit = index === 1 ? round(zero + gap, decimals) : round((ranges[index - 1].maxLimit as number) + gap, decimals);
      const maxLimit = index === steps ? round(target, decimals) : round(minLimit + stepSize - gap, decimals);
      ranges.push({ orderIndex: index, minLimit, maxLimit, achievementPercent: percent(index), gainPercent: percent(index) });
    }
    return ranges;
  }

  const ranges: SuggestedRange[] = new Array(count);
  const stepSize = (zero - target) / steps;
  ranges[0] = { orderIndex: 0, minLimit: round(zero, decimals), maxLimit: null, achievementPercent: 0, gainPercent: 0 };
  for (let index = steps; index >= 1; index--) {
    const minLimit = index === steps ? round(target, decimals) : round((ranges[index + 1].maxLimit as number) + gap, decimals);
    const maxLimit = index === 1 ? round(zero - gap, decimals) : round(minLimit + stepSize - gap, decimals);
    ranges[index] = { orderIndex: index, minLimit, maxLimit, achievementPercent: percent(index), gainPercent: percent(index) };
  }
  return ranges;
}

function argValue(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function norm(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function startOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
}

function endOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}

async function resolveCompany() {
  const companies = await prisma.company.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: COMPANY_QUERY, mode: 'insensitive' } },
        { tradeName: { contains: COMPANY_QUERY, mode: 'insensitive' } },
      ],
    },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, tradeName: true },
  });

  if (companies.length === 0) {
    throw new Error(`Empresa nao encontrada para busca "${COMPANY_QUERY}". Use --company=Nome.`);
  }

  const exact = companies.find((c) => [c.name, c.tradeName].some((v) => norm(v) === norm(COMPANY_QUERY)));
  if (!exact && companies.length > 1) {
    const names = companies.map((c) => `${c.name}${c.tradeName ? ` (${c.tradeName})` : ''}`).join(', ');
    throw new Error(`Busca "${COMPANY_QUERY}" retornou mais de uma empresa: ${names}. Use --company=NomeExato.`);
  }
  return exact ?? companies[0];
}

async function resolveActor(companyId: string) {
  return prisma.user.findFirst({
    where: {
      companyId,
      deletedAt: null,
      active: true,
      status: 'ACTIVE',
      role: { in: ['SUPER_ADMIN', 'COMPANY_ADMIN'] },
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, email: true },
  });
}

async function ensureOrgNode(
  tx: Tx,
  input: {
    companyId: string;
    name: string;
    code: string;
    type: OrgNodeType;
    parentId?: string | null;
    externalId: string;
    description: string;
    position: number;
  },
) {
  const existing = await tx.orgNode.findFirst({
    where: {
      companyId: input.companyId,
      deletedAt: null,
      OR: [
        { externalSource: SOURCE, externalId: input.externalId },
        { code: input.code, type: input.type },
        { name: input.name, type: input.type },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  const data = {
    name: input.name,
    code: input.code,
    type: input.type,
    parentId: input.parentId ?? null,
    description: input.description,
    active: true,
    position: input.position,
    externalSource: SOURCE,
    externalId: input.externalId,
  };

  if (existing) return tx.orgNode.update({ where: { id: existing.id }, data });
  return tx.orgNode.create({ data: { companyId: input.companyId, ...data } });
}

async function ensureResponsibilities(tx: Tx, companyId: string, sectorId: string, actorId: string | null) {
  const title = 'Responsabilidades - Estradas';
  const items = [
    'Garantir a conservacao e a disponibilidade das estradas agricolas.',
    'Acompanhar a conformidade ISSMA das atividades executadas em estradas.',
    'Monitorar chamados/problemas e coordenar tratativas com as equipes responsaveis.',
    'Manter evidencias e indicadores mensais usados na Gestao de Premio.',
  ];

  const existing = await tx.organizationalUnitActivity.findFirst({
    where: { companyId, organizationalUnitId: sectorId, title, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  const activity = existing
    ? await tx.organizationalUnitActivity.update({
        where: { id: existing.id },
        data: {
          description: 'Responsabilidades operacionais vinculadas ao Anexo 0561.',
          orderIndex: 1,
          isActive: true,
          updatedById: actorId,
        },
      })
    : await tx.organizationalUnitActivity.create({
        data: {
          companyId,
          organizationalUnitId: sectorId,
          title,
          description: 'Responsabilidades operacionais vinculadas ao Anexo 0561.',
          orderIndex: 1,
          isActive: true,
          createdById: actorId,
          updatedById: actorId,
        },
      });

  await tx.organizationalUnitActivityItem.deleteMany({ where: { activityId: activity.id } });
  await tx.organizationalUnitActivityItem.createMany({
    data: items.map((description, index) => ({
      activityId: activity.id,
      description,
      orderIndex: index + 1,
      isActive: true,
      createdById: actorId,
      updatedById: actorId,
    })),
  });
  return activity;
}

async function ensureNativeIndicator(
  tx: Tx,
  companyId: string,
  ownerNodeId: string,
  actorId: string | null,
  seed: (typeof INDICATORS)[number],
) {
  const existing = await tx.indicator.findFirst({
    where: { companyId, code: seed.code },
    orderBy: { createdAt: 'asc' },
  });

  const data = {
    ownerNodeId,
    name: seed.name,
    code: seed.code,
    description: seed.description,
    type: IndicatorType.OPERATIONAL,
    category: 'Gestao de Premio - Estradas',
    unit: seed.unit,
    unitLabel: seed.unitLabel,
    periodicity: 'MONTHLY' as const,
    direction: seed.direction,
    source: 'Bases_calculo Anexo 0561',
    feedKind: FeedKind.MANUAL,
    status: IndicatorStatus.ACTIVE,
    weight: 1,
    externalSource: SOURCE,
    externalId: seed.code,
    deletedAt: null,
  };

  void actorId;

  if (existing) return tx.indicator.update({ where: { id: existing.id }, data });
  return tx.indicator.create({ data: { companyId, ...data } });
}

async function ensureProgram(tx: Tx, companyId: string, orgNodeId: string, actorId: string | null) {
  const existing = await tx.prizeProgram.findFirst({ where: { companyId, code: PROGRAM_CODE }, orderBy: { createdAt: 'asc' } });
  const data = {
    orgNodeId,
    name: 'Premio Estradas',
    description: 'Programa criado a partir das Bases_calculo, Anexo 0561.',
    programType: 'GOIASA_PREMIO',
    periodicity: 'MONTHLY' as const,
    currency: 'BRL',
    validFrom: startOfMonth(YEAR, 1),
    validTo: endOfMonth(YEAR, 12),
    status: 'ACTIVE' as const,
    roundingRule: 'HALF_UP_2',
    closeDay: 5,
    approvalDeadlineDay: 10,
    payrollDeadlineDay: 20,
    defaultRubric: 'PREMIO_ESTRADAS',
    notes: 'Seed idempotente do Anexo 0561.',
    deletedAt: null,
  };

  const program = existing
    ? await tx.prizeProgram.update({ where: { id: existing.id }, data })
    : await tx.prizeProgram.create({ data: { companyId, code: PROGRAM_CODE, createdById: actorId, ...data } });

  await tx.prizeProgramVersion.upsert({
    where: { programId_version: { programId: program.id, version: 1 } },
    update: {
      snapshot: program as unknown as Prisma.InputJsonValue,
      note: 'Snapshot do seed do Anexo 0561',
      createdById: actorId,
    },
    create: {
      programId: program.id,
      version: 1,
      snapshot: program as unknown as Prisma.InputJsonValue,
      note: 'Snapshot do seed do Anexo 0561',
      createdById: actorId,
    },
  });

  return program;
}

async function ensureCompetences(tx: Tx, companyId: string, programId: string, actorId: string | null) {
  const competences = [];
  for (let month = 1; month <= 12; month++) {
    const label = `${YEAR}-${String(month).padStart(2, '0')}`;
    const existing = await tx.prizeCompetence.findFirst({ where: { programId, year: YEAR, month } });
    const data = {
      companyId,
      programId,
      year: YEAR,
      month,
      label,
      startDate: startOfMonth(YEAR, month),
      endDate: endOfMonth(YEAR, month),
      status: 'FILLING' as const,
      notes: 'Competencia criada pelo seed do Anexo 0561.',
      createdById: actorId,
    };
    competences.push(
      existing
        ? await tx.prizeCompetence.update({
            where: { id: existing.id },
            data: {
              label,
              startDate: data.startDate,
              endDate: data.endDate,
              status: 'FILLING',
              notes: data.notes,
            },
          })
        : await tx.prizeCompetence.create({ data }),
    );
  }
  return competences;
}

async function ensureAnnexAndVersion(tx: Tx, companyId: string, programId: string, orgNodeId: string, actorId: string | null) {
  const existing = await tx.prizeAnnex.findFirst({ where: { companyId, code: ANNEX_CODE }, orderBy: { createdAt: 'asc' } });
  const annexData = {
    programId,
    name: 'Premio Estradas - Anexo - 0561',
    orgNodeId,
    positionRef: POSITIONS.join(' | '),
    costCenterRef: null,
    notes: 'AREA: Goiasa - Estradas. Fonte: Bases_calculo / aba 0561.',
    deletedAt: null,
  };

  const annex = existing
    ? await tx.prizeAnnex.update({ where: { id: existing.id }, data: annexData })
    : await tx.prizeAnnex.create({ data: { companyId, code: ANNEX_CODE, createdById: actorId, ...annexData } });

  const currentVersion = annex.currentVersionId
    ? await tx.prizeAnnexVersion.findUnique({ where: { id: annex.currentVersionId } })
    : null;
  const versionOne = await tx.prizeAnnexVersion.findFirst({ where: { annexId: annex.id, version: 1 } });
  const baseVersion = currentVersion ?? versionOne;

  const versionData = {
    effectiveFrom: startOfMonth(YEAR, 1),
    effectiveTo: endOfMonth(YEAR, 12),
    salaryPercent: new Prisma.Decimal(8.33),
    gainPotential: null,
    gainChance: new Prisma.Decimal(8.33),
    formula: {
      source: 'Bases_calculo',
      sheet: '0561',
      weightMode: 'PERCENT_OF_POTENTIAL',
      rangeMode: 'PARAMETER_SCOPED',
    } as Prisma.InputJsonValue,
    rules: {
      area: 'Goiasa - Estradas',
      positions: POSITIONS,
      salaryPercent: 8.33,
    } as Prisma.InputJsonValue,
    criteria: {
      indicators: INDICATORS.map((i) => ({ code: i.code, name: i.name, weight: i.weight })),
    } as Prisma.InputJsonValue,
    changeReason: 'Carga inicial idempotente do Anexo 0561',
    status: 'EFFECTIVE' as const,
  };

  const version = baseVersion
    ? await tx.prizeAnnexVersion.update({ where: { id: baseVersion.id }, data: versionData })
    : await tx.prizeAnnexVersion.create({
        data: { annexId: annex.id, version: 1, createdById: actorId, ...versionData },
      });

  await tx.prizeAnnexVersion.updateMany({
    where: { annexId: annex.id, status: 'EFFECTIVE', id: { not: version.id } },
    data: { status: 'SUPERSEDED', supersededAt: new Date(), supersededByVersionId: version.id },
  });
  await tx.prizeAnnex.update({ where: { id: annex.id }, data: { currentVersionId: version.id } });

  return { annex, version };
}

async function ensurePrizeIndicator(
  tx: Tx,
  companyId: string,
  programId: string,
  annexVersionId: string,
  orgNodeId: string,
  actorId: string | null,
  seed: (typeof INDICATORS)[number],
  platformIndicatorId: string,
) {
  const existing = await tx.prizeIndicator.findFirst({ where: { programId, code: seed.code }, orderBy: { createdAt: 'asc' } });
  const data = {
    companyId,
    programId,
    annexVersionId,
    name: seed.name,
    description: seed.description,
    unit: seed.unitLabel,
    kind: 'COLLECTIVE' as const,
    direction: seed.prizeDirection,
    source: 'INTERNAL_API' as const,
    bscNumber: seed.code,
    platformIndicatorId,
    weight: new Prisma.Decimal(seed.weight),
    formula: null,
    roundingRule: 'HALF_UP_2',
    orgNodeId,
    positionRef: POSITIONS.join(' | '),
    costCenterRef: null,
    periodicity: 'MONTHLY' as const,
    status: 'ACTIVE',
    deletedAt: null,
  };

  if (existing) return tx.prizeIndicator.update({ where: { id: existing.id }, data });
  return tx.prizeIndicator.create({ data: { code: seed.code, createdById: actorId, ...data } });
}

async function ensureParameterAndRanges(
  tx: Tx,
  indicatorId: string,
  competenceId: string,
  actorId: string | null,
  month: number,
  direction: PrizeIndicatorDirection,
  zero: number,
  target: number,
) {
  const existingParams = await tx.prizeIndicatorParameter.findMany({
    where: { indicatorId, competenceId },
    orderBy: { createdAt: 'asc' },
  });
  const extras = existingParams.slice(1);
  if (extras.length) {
    const extraIds = extras.map((p) => p.id);
    await tx.prizeIndicatorRange.deleteMany({ where: { parameterId: { in: extraIds } } });
    await tx.prizeIndicatorParameter.deleteMany({ where: { id: { in: extraIds } } });
  }

  const paramData = {
    competenceId,
    year: YEAR,
    month,
    week: null,
    day: null,
    scopeKey: null,
    target: new Prisma.Decimal(target),
    zero: new Prisma.Decimal(zero),
    weight: null,
    changeReason: 'Carga do Anexo 0561',
  };
  const parameter = existingParams[0]
    ? await tx.prizeIndicatorParameter.update({ where: { id: existingParams[0].id }, data: paramData })
    : await tx.prizeIndicatorParameter.create({ data: { indicatorId, createdById: actorId, ...paramData } });

  await tx.prizeIndicatorRange.deleteMany({
    where: {
      indicatorId,
      OR: [{ parameterId: parameter.id }, { parameterId: null }],
    },
  });

  const ranges = suggestRanges({
    zero,
    target,
    direction: direction === 'LOWER_BETTER' ? 'LOWER_BETTER' : 'HIGHER_BETTER',
    count: 6,
    decimals: 2,
  });

  await tx.prizeIndicatorRange.createMany({
    data: ranges.map((range) => ({
      indicatorId,
      parameterId: parameter.id,
      orderIndex: range.orderIndex,
      minLimit: range.minLimit === null ? null : new Prisma.Decimal(range.minLimit),
      maxLimit: range.maxLimit === null ? null : new Prisma.Decimal(range.maxLimit),
      achievementPercent: new Prisma.Decimal(range.achievementPercent),
      gainPercent: new Prisma.Decimal(range.gainPercent),
      cumulative: false,
    })),
  });

  return parameter;
}

async function ensureModerators(tx: Tx, companyId: string, actorId: string | null) {
  const existing = await tx.prizeModeratorRule.findMany({
    where: { companyId, active: true },
    select: { eventType: true },
  });
  const existingTypes = new Set(existing.map((rule) => rule.eventType));
  let created = 0;

  for (const rule of MODERATOR_DEFAULTS) {
    if (existingTypes.has(rule.eventType)) continue;
    await tx.prizeModeratorRule.create({
      data: {
        companyId,
        programId: null,
        name: rule.name,
        eventType: rule.eventType,
        criterion: rule.criterion,
        reductionPercent: new Prisma.Decimal(rule.reductionPercent),
        reductionValue: null,
        cap: null,
        cumulative: true,
        priority: 0,
        requiresApproval: false,
        active: true,
        notes: rule.notes,
        createdById: actorId,
      },
    });
    existingTypes.add(rule.eventType);
    created++;
  }

  return { created, skipped: MODERATOR_DEFAULTS.length - created };
}

async function main() {
  if (!Number.isInteger(YEAR) || YEAR < 2000 || YEAR > 2100) throw new Error(`Ano invalido: ${YEAR}`);

  const company = await resolveCompany();
  const actor = await resolveActor(company.id);
  console.log(`[seed-prize-0561] empresa: ${company.name}${company.tradeName ? ` (${company.tradeName})` : ''}`);
  console.log(`[seed-prize-0561] ator auditoria: ${actor?.email ?? 'sem usuario admin encontrado'}`);

  if (DRY_RUN) {
    console.log('[seed-prize-0561] dry-run: nenhuma escrita sera feita');
    return;
  }

  const summary = await prisma.$transaction(
    async (tx) => {
      const area = await ensureOrgNode(tx, {
        companyId: company.id,
        name: 'Area Agricola',
        code: 'AREA-AGRICOLA',
        type: OrgNodeType.AREA,
        externalId: 'AREA_AGRICOLA',
        description: 'Area agricola vinculada aos premios operacionais da Goiasa.',
        position: 10,
      });
      const sector = await ensureOrgNode(tx, {
        companyId: company.id,
        name: 'Goiasa - Estradas',
        code: 'SETOR-ESTRADAS',
        type: OrgNodeType.SECTOR,
        parentId: area.id,
        externalId: 'SETOR_ESTRADAS',
        description: 'Setor de estradas contemplado no Anexo 0561 da Gestao de Premio.',
        position: 20,
      });
      await ensureResponsibilities(tx, company.id, sector.id, actor?.id ?? null);

      const nativeByCode = new Map<string, string>();
      for (const seed of INDICATORS) {
        const native = await ensureNativeIndicator(tx, company.id, sector.id, actor?.id ?? null, seed);
        nativeByCode.set(seed.code, native.id);
      }

      const program = await ensureProgram(tx, company.id, sector.id, actor?.id ?? null);
      const competences = await ensureCompetences(tx, company.id, program.id, actor?.id ?? null);
      const { annex, version } = await ensureAnnexAndVersion(tx, company.id, program.id, sector.id, actor?.id ?? null);

      const prizeIndicators = [];
      for (const seed of INDICATORS) {
        const platformIndicatorId = nativeByCode.get(seed.code);
        if (!platformIndicatorId) throw new Error(`Indicador nativo nao criado: ${seed.code}`);
        const prizeIndicator = await ensurePrizeIndicator(
          tx,
          company.id,
          program.id,
          version.id,
          sector.id,
          actor?.id ?? null,
          seed,
          platformIndicatorId,
        );
        prizeIndicators.push(prizeIndicator);

        for (const competence of competences) {
          const monthly =
            seed.code === '32131'
              ? MONTHLY_32131.find((item) => item.month === competence.month)
              : { month: competence.month, zero: seed.fixedZero!, target: seed.fixedTarget! };
          if (!monthly) throw new Error(`Mes sem parametro para ${seed.code}: ${competence.month}`);
          await ensureParameterAndRanges(
            tx,
            prizeIndicator.id,
            competence.id,
            actor?.id ?? null,
            competence.month,
            seed.prizeDirection,
            monthly.zero,
            monthly.target,
          );
        }
      }

      const moderators = await ensureModerators(tx, company.id, actor?.id ?? null);

      await tx.prizeAuditLog.create({
        data: {
          companyId: company.id,
          userId: actor?.id ?? null,
          userEmail: actor?.email ?? null,
          action: 'SEED_0561',
          entityType: 'ANNEX',
          entityId: annex.id,
          after: {
            programCode: program.code,
            annexCode: annex.code,
            annexVersionId: version.id,
            year: YEAR,
            indicators: prizeIndicators.map((i) => i.code),
            competences: competences.length,
            moderators,
          } as Prisma.InputJsonValue,
          justification: 'Carga idempotente do Anexo 0561 - Estradas',
        },
      });

      return {
        areaId: area.id,
        sectorId: sector.id,
        programId: program.id,
        annexId: annex.id,
        annexVersionId: version.id,
        competences: competences.length,
        indicators: prizeIndicators.length,
        parameters: competences.length * prizeIndicators.length,
        ranges: competences.length * prizeIndicators.length * 6,
        moderators,
      };
    },
    { maxWait: 10_000, timeout: 120_000 },
  );

  console.log('[seed-prize-0561] OK', summary);
}

main()
  .catch((error) => {
    console.error('[seed-prize-0561] ERRO', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
