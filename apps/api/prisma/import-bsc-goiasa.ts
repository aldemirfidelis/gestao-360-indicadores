/**
 * Importa indicadores do BSC legado (usina) para a Goiasa no gestao-360.
 *
 * Fontes (planilhas locais, fora do git):
 *  - "INDICADORES PARA IMPORTACAO.xlsx" (aba Plan5): catalogo dos 196 indicadores
 *      colunas: IND_CdiIndicador | IND_DssIndicador | Setor | Cardinalidade | Area
 *  - "Ferramenta de Apuracao e Divulgacao de Resultado do Premio.xlsm" (aba Base_BSC):
 *      meta/realizado por periodo
 *      colunas: IND_CdiIndicador | IND_DssIndicador | RME_DtiAno | RME_DtiMes |
 *               RME_VlnMensal | RME_VlnAcumulado | MetaMensal | AcuMetaMensal
 *
 * O que faz (idempotente, escopado a Goiasa, marcado com externalSource='BSC'):
 *  1. Cria/atualiza as AREAS (OrgNode AREA) sob o branch GOIASA.
 *  2. Cria/atualiza os SETORES (OrgNode SECTOR) sob cada area.
 *  3. Cria/atualiza os 196 INDICADORES (ownerNode = setor; code = IND_CdiIndicador).
 *  4. Carrega METAS (IndicatorTarget) e REALIZADOS (IndicatorResult com farol via calcStatus).
 *
 * NUNCA toca em outra empresa nem em nos/indicadores sem externalSource='BSC'
 * (exceto o upsert de indicador por (companyId, code), que casa pelo codigo).
 *
 * Rodar dry-run:  npx tsx prisma/import-bsc-goiasa.ts --dry-run
 * Rodar real:     npx tsx prisma/import-bsc-goiasa.ts
 */
import * as path from 'path';
import ExcelJS from 'exceljs';
import { PrismaClient, Direction, IndicatorUnit, Prisma } from '@prisma/client';
import { calcStatus } from '@g360/shared';

const prisma = new PrismaClient();

const GOIASA_ID = 'e59c7d55-3e43-4c4e-bfef-13e046047967';
const SRC = 'BSC';
const DRY = process.argv.includes('--dry-run');

const BASE = 'D:\\Projetos\\gestao-indicadores-sqlite\\Gestao_premio\\Bases_calculo';
const IND_FILE = path.join(BASE, 'INDICADORES PARA IMPORTAÇÃO.xlsx');
const BSC_FILE = path.join(BASE, 'Ferramenta de Apuração e Divulgação de Resultado do Prêmio.xlsm');

// ----------------- helpers de leitura -----------------
function raw(row: ExcelJS.Row, c: number): unknown {
  let v: unknown = row.getCell(c).value;
  if (v && typeof v === 'object' && 'result' in (v as any)) v = (v as any).result;
  if (v && typeof v === 'object' && 'text' in (v as any)) v = (v as any).text;
  return v;
}
function str(row: ExcelJS.Row, c: number): string {
  const v = raw(row, c);
  return v === null || v === undefined ? '' : String(v).trim();
}
function num(row: ExcelJS.Row, c: number): number | null {
  const v = raw(row, c);
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function periodRef(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}
function dirFromCardinalidade(card: string): Direction {
  return /menor/i.test(card) ? Direction.LOWER_BETTER : Direction.HIGHER_BETTER;
}

// processa em lotes para nao estourar conexoes do pooler
async function inChunks<T>(items: T[], size: number, fn: (it: T) => Promise<void>, onProgress?: (done: number) => void) {
  let done = 0;
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    await Promise.all(chunk.map(fn));
    done += chunk.length;
    onProgress?.(done);
  }
}

interface IndRow {
  code: string;
  name: string;
  setor: string;
  area: string;
  direction: Direction;
}

async function main() {
  console.log(`\n=== IMPORT BSC -> Goiasa ${DRY ? '(DRY-RUN)' : '(GRAVANDO)'} ===\n`);

  // guarda dura: so Goiasa
  const company = await prisma.company.findUnique({ where: { id: GOIASA_ID }, select: { id: true, name: true } });
  if (!company) throw new Error('Empresa Goiasa nao encontrada nesta base.');
  console.log('Empresa:', company.name);

  // ---------- 1. ler catalogo de indicadores ----------
  const wbInd = new ExcelJS.Workbook();
  await wbInd.xlsx.readFile(IND_FILE);
  const wsInd = wbInd.getWorksheet('Plan5');
  if (!wsInd) throw new Error('Aba Plan5 nao encontrada no arquivo de indicadores.');
  const indRows: IndRow[] = [];
  for (let r = 2; r <= wsInd.rowCount; r++) {
    const code = str(wsInd.getRow(r), 1);
    if (!code) continue;
    indRows.push({
      code,
      name: str(wsInd.getRow(r), 2),
      setor: str(wsInd.getRow(r), 3) || 'Sem setor',
      area: str(wsInd.getRow(r), 5) || 'Sem área',
      direction: dirFromCardinalidade(str(wsInd.getRow(r), 4)),
    });
  }
  console.log('Indicadores no catalogo:', indRows.length);

  // estrutura area -> setores
  const areaSet = new Map<string, Set<string>>();
  for (const ir of indRows) {
    if (!areaSet.has(ir.area)) areaSet.set(ir.area, new Set());
    areaSet.get(ir.area)!.add(ir.setor);
  }
  const totalSetores = [...areaSet.values()].reduce((a, s) => a + s.size, 0);
  console.log(`Estrutura: ${areaSet.size} areas, ${totalSetores} setores`);

  // ---------- 2. ler Base_BSC (meta/realizado por periodo) ----------
  const codeSet = new Set(indRows.map((i) => i.code));
  const wbBsc = new ExcelJS.Workbook();
  await wbBsc.xlsx.readFile(BSC_FILE);
  const wsBsc = wbBsc.getWorksheet('Base_BSC');
  if (!wsBsc) throw new Error('Aba Base_BSC nao encontrada.');
  // code -> periodRef -> { real, meta }
  const data = new Map<string, Map<string, { real: number | null; meta: number | null }>>();
  let bscRows = 0;
  for (let r = 2; r <= wsBsc.rowCount; r++) {
    const code = str(wsBsc.getRow(r), 1);
    if (!code || !codeSet.has(code)) continue;
    const ano = num(wsBsc.getRow(r), 3);
    const mes = num(wsBsc.getRow(r), 4);
    if (!ano || !mes) continue;
    const real = num(wsBsc.getRow(r), 5);
    const meta = num(wsBsc.getRow(r), 7);
    if (real === null && meta === null) continue;
    const pref = periodRef(ano, mes);
    if (!data.has(code)) data.set(code, new Map());
    data.get(code)!.set(pref, { real, meta });
    bscRows++;
  }
  console.log(`Base_BSC: ${bscRows} pontos (periodo x indicador) para os ${data.size} codigos com dados`);

  // unidade heuristica: todos os valores <= 100 -> PERCENT, senao QUANTITY
  function unitFor(code: string): IndicatorUnit {
    const periods = data.get(code);
    if (!periods) return IndicatorUnit.INDEX;
    let max = 0;
    let any = false;
    for (const { real, meta } of periods.values()) {
      for (const v of [real, meta]) {
        if (v !== null) { any = true; max = Math.max(max, Math.abs(v)); }
      }
    }
    if (!any) return IndicatorUnit.INDEX;
    return max <= 100 ? IndicatorUnit.PERCENT : IndicatorUnit.QUANTITY;
  }

  if (DRY) {
    let targetsN = 0, resultsN = 0;
    for (const periods of data.values()) {
      for (const { real, meta } of periods.values()) {
        if (meta !== null) targetsN++;
        if (real !== null) resultsN++;
      }
    }
    console.log('\n--- DRY-RUN: seria gravado ---');
    console.log(`Areas:        ${areaSet.size}`);
    console.log(`Setores:      ${totalSetores}`);
    console.log(`Indicadores:  ${indRows.length}`);
    console.log(`Metas:        ${targetsN}`);
    console.log(`Realizados:   ${resultsN}`);
    console.log('\nAreas:', [...areaSet.keys()].join(', '));
    await prisma.$disconnect();
    return;
  }

  // ---------- branch raiz GOIASA p/ pendurar as areas ----------
  const branch = await prisma.orgNode.findFirst({
    where: { companyId: GOIASA_ID, type: 'BRANCH', name: 'GOIASA', deletedAt: null },
    select: { id: true },
  });
  const rootParentId = branch?.id ?? null;
  console.log('Pendurando areas em:', branch ? 'branch GOIASA' : '(raiz)');

  // find-or-create de OrgNode por (companyId, externalSource, externalId)
  async function upsertNode(externalId: string, name: string, type: 'AREA' | 'SECTOR', parentId: string | null, position: number): Promise<string> {
    const existing = await prisma.orgNode.findFirst({
      where: { companyId: GOIASA_ID, externalSource: SRC, externalId },
      select: { id: true },
    });
    if (existing) {
      await prisma.orgNode.update({
        where: { id: existing.id },
        data: { name, type, parentId, position, deletedAt: null },
      });
      return existing.id;
    }
    const created = await prisma.orgNode.create({
      data: { companyId: GOIASA_ID, name, type, parentId, position, externalSource: SRC, externalId },
      select: { id: true },
    });
    return created.id;
  }

  // ---------- 1+2. areas e setores ----------
  const setorId = new Map<string, string>(); // `${area}::${setor}` -> nodeId
  let aPos = 0;
  for (const [area, setores] of [...areaSet.entries()].sort()) {
    const areaId = await upsertNode(`AREA::${area}`, area, 'AREA', rootParentId, aPos++);
    let sPos = 0;
    for (const setor of [...setores].sort()) {
      const id = await upsertNode(`SECTOR::${area}::${setor}`, setor, 'SECTOR', areaId, sPos++);
      setorId.set(`${area}::${setor}`, id);
    }
  }
  console.log(`OK areas/setores: ${areaSet.size} areas, ${setorId.size} setores`);

  // ---------- 3. indicadores ----------
  const indicatorId = new Map<string, { id: string; direction: Direction }>();
  await inChunks(indRows, 15, async (ir) => {
    const ownerNodeId = setorId.get(`${ir.area}::${ir.setor}`)!;
    const up = await prisma.indicator.upsert({
      where: { companyId_code: { companyId: GOIASA_ID, code: ir.code } },
      create: {
        companyId: GOIASA_ID,
        ownerNodeId,
        name: ir.name,
        code: ir.code,
        direction: ir.direction,
        unit: unitFor(ir.code),
        periodicity: 'MONTHLY',
        feedKind: 'DATABASE',
        type: 'OPERATIONAL',
        status: 'ACTIVE',
        externalSource: SRC,
        externalId: ir.code,
      },
      update: {
        ownerNodeId,
        name: ir.name,
        direction: ir.direction,
        unit: unitFor(ir.code),
        feedKind: 'DATABASE',
        externalSource: SRC,
        externalId: ir.code,
      },
      select: { id: true },
    });
    indicatorId.set(ir.code, { id: up.id, direction: ir.direction });
  }, (d) => process.stdout.write(`\r  indicadores: ${d}/${indRows.length}`));
  console.log(`\nOK indicadores: ${indicatorId.size}`);

  // ---------- 4. metas + realizados ----------
  // monta lista plana de pontos a gravar
  type Point = { code: string; pref: string; real: number | null; meta: number | null };
  const points: Point[] = [];
  for (const [code, periods] of data.entries()) {
    for (const [pref, { real, meta }] of periods.entries()) {
      points.push({ code, pref, real, meta });
    }
  }

  let targetsDone = 0, resultsDone = 0;
  await inChunks(points, 25, async (p) => {
    const ind = indicatorId.get(p.code);
    if (!ind) return;
    const [y, m] = p.pref.split('-').map(Number);
    const periodDate = new Date(Date.UTC(y, m - 1, 1));

    if (p.meta !== null) {
      await prisma.indicatorTarget.upsert({
        where: { indicatorId_periodRef: { indicatorId: ind.id, periodRef: p.pref } },
        create: { indicatorId: ind.id, periodRef: p.pref, target: p.meta },
        update: { target: p.meta },
      });
      targetsDone++;
    }
    if (p.real !== null) {
      const st = calcStatus({ value: p.real, target: p.meta ?? undefined, direction: ind.direction });
      await prisma.indicatorResult.upsert({
        where: { indicatorId_periodRef: { indicatorId: ind.id, periodRef: p.pref } },
        create: {
          indicatorId: ind.id, periodRef: p.pref, periodDate, value: p.real,
          light: st.light, attainment: st.attainment, deviationAbs: st.deviationAbs, deviationPct: st.deviationPct,
        },
        update: {
          periodDate, value: p.real,
          light: st.light, attainment: st.attainment, deviationAbs: st.deviationAbs, deviationPct: st.deviationPct,
        },
      });
      resultsDone++;
    }
  }, (d) => process.stdout.write(`\r  metas/realizados: ${d}/${points.length}`));

  console.log(`\nOK metas: ${targetsDone} | realizados: ${resultsDone}`);
  console.log('\n=== CONCLUIDO ===');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\nERRO:', e);
  await prisma.$disconnect();
  process.exit(1);
});
