/**
 * ETL: BSC legado (SQL Server) -> gestao-360 (Postgres).
 *
 * Pipeline:
 *   1. extractAreas/Indicators/Values  -> le do SQL Server (queries em TODO ate
 *      a introspeccao confirmar nomes de tabelas/colunas)
 *   2. transform                        -> aplica De-Para (de-para.ts)
 *   3. load (upsert idempotente)        -> grava no Postgres via Prisma
 *
 * Casamento idempotente por (companyId, externalSource, externalId): rodar de
 * novo NAO duplica. Por padrao roda em DRY-RUN (nada e gravado); defina
 * BSC_DRY_RUN=false para efetivar.
 *
 * Uso (dry-run):
 *   BSC_SQL_SERVER=localhost BSC_SQL_DATABASE=BSC BSC_SQL_USER=ro_user \
 *   BSC_SQL_PASSWORD=*** BSC_TARGET_COMPANY_ID=<uuid> \
 *   pnpm --filter @g360/api exec tsx scripts/legacy-bsc/migrate.ts
 */

import sql from 'mssql';
import { PrismaClient, Direction, TrafficLight, OrgNodeType, FeedKind } from '@prisma/client';
import { calcStatus } from '@g360/shared';
import { periodRefToDate, detectPeriodicityFromRef } from '../../src/modules/indicators/period.util';
import { sqlServerConfig, etlConfig, EtlConfig } from './config';
import { mapUnit, mapDirection, mapPeriodicity, parseDecimal, unmapped } from './de-para';

// --------------------------------------------------------------------------
// Formatos intermediarios (neutros) entre o SQL Server e o Postgres
// --------------------------------------------------------------------------

interface LegacyArea {
  externalId: string; // PK legado, ex.: "18448"
  name: string; // ex.: "AGRICOLA"
  parentExternalId?: string | null; // hierarquia entre areas, se houver
  code?: string | null;
}

interface LegacyIndicator {
  externalId: string; // ex.: "18915"
  name: string;
  areaExternalId: string; // area dona
  parentIndicatorExternalId?: string | null; // sub-indicador (10.1 sob 10)
  unitRaw?: string | null; // "r$/t", "l/h", ...
  directionRaw?: string | number | null; // cardinalidade
  periodicityRaw?: string | null; // Mensal/Semanal/Diario
  description?: string | null;
}

interface LegacyValue {
  indicatorExternalId: string;
  periodRef: string; // ja convertido p/ YYYY-MM, YYYY-Www, etc.
  target?: number | null; // Meta Inicial
  actual?: number | null; // Real Mensal
  note?: string | null;
}

// --------------------------------------------------------------------------
// 1. EXTRACAO  (preencher apos a introspeccao)
// --------------------------------------------------------------------------

const PLACEHOLDER = '__PREENCHER_APOS_INTROSPECCAO__';

function assertMapped(query: string, what: string) {
  if (query.includes(PLACEHOLDER)) {
    throw new Error(
      `Extracao de "${what}" ainda nao mapeada. Rode introspect.ts, inspecione o JSON ` +
        `gerado e substitua a query/placeholder em migrate.ts.`,
    );
  }
}

async function extractAreas(pool: sql.ConnectionPool): Promise<LegacyArea[]> {
  // TODO(introspeccao): mapear tabela de areas/grupos. Ex. hipotetico:
  //   SELECT id AS externalId, nome AS name, id_pai AS parentExternalId
  //   FROM Grupos WHERE ativo = 1
  const QUERY = PLACEHOLDER;
  assertMapped(QUERY, 'areas');
  const res = await pool.request().query<LegacyArea>(QUERY);
  return res.recordset;
}

async function extractIndicators(pool: sql.ConnectionPool): Promise<LegacyIndicator[]> {
  // TODO(introspeccao): mapear tabela de indicadores. Ex. hipotetico:
  //   SELECT id AS externalId, nome AS name, id_grupo AS areaExternalId,
  //          id_indicador_pai AS parentIndicatorExternalId, unidade AS unitRaw,
  //          cardinalidade AS directionRaw, periodicidade AS periodicityRaw
  //   FROM Indicadores
  const QUERY = PLACEHOLDER;
  assertMapped(QUERY, 'indicadores');
  const res = await pool.request().query<LegacyIndicator>(QUERY);
  return res.recordset;
}

async function extractValues(pool: sql.ConnectionPool): Promise<LegacyValue[]> {
  // TODO(introspeccao): mapear tabela de metas/realizados por periodo. Provavel
  // que ano/mes venham em colunas separadas -> montar o periodRef aqui.
  // Ex. hipotetico (mensal):
  //   SELECT id_indicador AS indicatorExternalId,
  //          CONCAT(ano, '-', RIGHT('0'+CAST(mes AS varchar),2)) AS periodRef,
  //          meta AS target, realizado AS actual, obs AS note
  //   FROM Valores
  const QUERY = PLACEHOLDER;
  assertMapped(QUERY, 'valores (metas/realizados)');
  const res = await pool.request().query<LegacyValue>(QUERY);
  return res.recordset;
}

// --------------------------------------------------------------------------
// 3. CARGA (upsert idempotente no Postgres)
// --------------------------------------------------------------------------

interface LoadStats {
  areas: number;
  indicators: number;
  treeRelations: number;
  targets: number;
  results: number;
  skipped: number;
}

async function loadAreas(
  prisma: PrismaClient,
  cfg: EtlConfig,
  areas: LegacyArea[],
  stats: LoadStats,
) {
  // 1a passada: upsert dos nos sem o pai (resolvido na 2a passada)
  for (const a of areas) {
    if (cfg.dryRun) {
      stats.areas++;
      continue;
    }
    await prisma.orgNode.upsert({
      where: {
        companyId_externalSource_externalId: {
          companyId: cfg.targetCompanyId,
          externalSource: cfg.sourceLabel,
          externalId: a.externalId,
        },
      },
      create: {
        companyId: cfg.targetCompanyId,
        name: a.name,
        code: a.code ?? null,
        type: OrgNodeType.SECTOR,
        externalId: a.externalId,
        externalSource: cfg.sourceLabel,
      },
      update: { name: a.name, code: a.code ?? null },
    });
    stats.areas++;
  }

  // 2a passada: amarra parentId pelo externalId do pai
  if (cfg.dryRun) return;
  for (const a of areas) {
    if (!a.parentExternalId) continue;
    const [node, parent] = await Promise.all([
      findOrgNode(prisma, cfg, a.externalId),
      findOrgNode(prisma, cfg, a.parentExternalId),
    ]);
    if (node && parent && node.parentId !== parent.id) {
      await prisma.orgNode.update({ where: { id: node.id }, data: { parentId: parent.id } });
    }
  }
}

async function loadIndicators(
  prisma: PrismaClient,
  cfg: EtlConfig,
  indicators: LegacyIndicator[],
  stats: LoadStats,
) {
  for (const ind of indicators) {
    const { unit, unitLabel } = mapUnit(ind.unitRaw);
    const direction = mapDirection(ind.directionRaw);
    const periodicity = mapPeriodicity(ind.periodicityRaw);

    if (cfg.dryRun) {
      stats.indicators++;
      continue;
    }

    const ownerNode = await findOrgNode(prisma, cfg, ind.areaExternalId);
    if (!ownerNode) {
      stats.skipped++;
      // eslint-disable-next-line no-console
      console.warn(`  ! indicador ${ind.externalId} sem area ${ind.areaExternalId} -> pulado`);
      continue;
    }

    await prisma.indicator.upsert({
      where: {
        companyId_externalSource_externalId: {
          companyId: cfg.targetCompanyId,
          externalSource: cfg.sourceLabel,
          externalId: ind.externalId,
        },
      },
      create: {
        companyId: cfg.targetCompanyId,
        ownerNodeId: ownerNode.id,
        name: ind.name,
        description: ind.description ?? null,
        unit,
        unitLabel,
        direction,
        periodicity,
        feedKind: FeedKind.DATABASE,
        source: cfg.sourceLabel,
        externalId: ind.externalId,
        externalSource: cfg.sourceLabel,
      },
      update: {
        name: ind.name,
        description: ind.description ?? null,
        unit,
        unitLabel,
        direction,
        periodicity,
        feedKind: FeedKind.DATABASE,
        source: cfg.sourceLabel,
      },
    });
    stats.indicators++;
  }

  // relacao pai-filho entre indicadores (sub-indicadores)
  if (cfg.dryRun) return;
  for (const ind of indicators) {
    if (!ind.parentIndicatorExternalId) continue;
    const [child, parent] = await Promise.all([
      findIndicator(prisma, cfg, ind.externalId),
      findIndicator(prisma, cfg, ind.parentIndicatorExternalId),
    ]);
    if (!child || !parent) continue;
    await prisma.indicatorTreeRelation.upsert({
      where: { parentId_childId: { parentId: parent.id, childId: child.id } },
      create: { parentId: parent.id, childId: child.id },
      update: {},
    });
    stats.treeRelations++;
  }
}

async function loadValues(
  prisma: PrismaClient,
  cfg: EtlConfig,
  values: LegacyValue[],
  stats: LoadStats,
) {
  for (const v of values) {
    const target = v.target ?? null;
    const actual = v.actual ?? null;
    if (target === null && actual === null) continue;

    if (cfg.dryRun) {
      if (target !== null) stats.targets++;
      if (actual !== null) stats.results++;
      continue;
    }

    const ind = await findIndicator(prisma, cfg, v.indicatorExternalId);
    if (!ind) {
      stats.skipped++;
      continue;
    }

    if (target !== null) {
      await prisma.indicatorTarget.upsert({
        where: { indicatorId_periodRef: { indicatorId: ind.id, periodRef: v.periodRef } },
        create: { indicatorId: ind.id, periodRef: v.periodRef, target },
        update: { target },
      });
      stats.targets++;
    }

    if (actual !== null) {
      const status = calcStatus({
        value: actual,
        target,
        direction: ind.direction as Direction,
        yellowToleranceP: ind.yellowToleranceP,
      });
      await prisma.indicatorResult.upsert({
        where: { indicatorId_periodRef: { indicatorId: ind.id, periodRef: v.periodRef } },
        create: {
          indicatorId: ind.id,
          periodRef: v.periodRef,
          periodDate: periodRefToDate(v.periodRef, detectPeriodicityFromRef(v.periodRef)),
          value: actual,
          note: v.note ?? null,
          status: 'FILLED',
          light: status.light as TrafficLight,
          attainment: status.attainment,
          deviationAbs: status.deviationAbs,
          deviationPct: status.deviationPct,
        },
        update: {
          value: actual,
          note: v.note ?? null,
          light: status.light as TrafficLight,
          attainment: status.attainment,
          deviationAbs: status.deviationAbs,
          deviationPct: status.deviationPct,
        },
      });
      stats.results++;
    }
  }
}

// --------------------------------------------------------------------------
// helpers de lookup
// --------------------------------------------------------------------------

function findOrgNode(prisma: PrismaClient, cfg: EtlConfig, externalId: string) {
  return prisma.orgNode.findUnique({
    where: {
      companyId_externalSource_externalId: {
        companyId: cfg.targetCompanyId,
        externalSource: cfg.sourceLabel,
        externalId,
      },
    },
    select: { id: true, parentId: true },
  });
}

function findIndicator(prisma: PrismaClient, cfg: EtlConfig, externalId: string) {
  return prisma.indicator.findUnique({
    where: {
      companyId_externalSource_externalId: {
        companyId: cfg.targetCompanyId,
        externalSource: cfg.sourceLabel,
        externalId,
      },
    },
    select: { id: true, direction: true, yellowToleranceP: true },
  });
}

// --------------------------------------------------------------------------
// orquestracao
// --------------------------------------------------------------------------

async function main() {
  const cfg = etlConfig();
  const prisma = new PrismaClient(
    cfg.targetDatabaseUrl
      ? { datasources: { db: { url: cfg.targetDatabaseUrl } } }
      : undefined,
  );
  const pool = await sql.connect(sqlServerConfig());
  const stats: LoadStats = {
    areas: 0,
    indicators: 0,
    treeRelations: 0,
    targets: 0,
    results: 0,
    skipped: 0,
  };

  // eslint-disable-next-line no-console
  console.log(`ETL BSC -> gestao-360  (${cfg.dryRun ? 'DRY-RUN' : 'GRAVANDO'})`);
  // eslint-disable-next-line no-console
  console.log(`  empresa destino: ${cfg.targetCompanyId}  origem: "${cfg.sourceLabel}"\n`);

  try {
    const areas = await extractAreas(pool);
    const indicators = await extractIndicators(pool);
    const values = await extractValues(pool);

    await loadAreas(prisma, cfg, areas, stats);
    await loadIndicators(prisma, cfg, indicators, stats);
    await loadValues(prisma, cfg, values, stats);

    // eslint-disable-next-line no-console
    console.log('\nResumo:', JSON.stringify(stats, null, 2));
    if (unmapped.unit.size || unmapped.direction.size || unmapped.periodicity.size) {
      // eslint-disable-next-line no-console
      console.warn('\nValores NAO mapeados (revisar de-para.ts):', {
        unit: [...unmapped.unit],
        direction: [...unmapped.direction],
        periodicity: [...unmapped.periodicity],
      });
    }
    if (cfg.dryRun) {
      // eslint-disable-next-line no-console
      console.log('\nDRY-RUN: nada foi gravado. Defina BSC_DRY_RUN=false para efetivar.');
    }
  } finally {
    await pool.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Falha no ETL:', err);
  process.exit(1);
});
