/**
 * Importa o BSC para a Goiasa na PRODUCAO, lendo o payload JSON autocontido
 * (gerado por tmp-gen-payload.ts). Roda DENTRO do container api:
 *   docker compose -f docker-compose.droplet.yml exec -T api npx tsx prisma/import-bsc-prod.ts --dry-run
 *   docker compose -f docker-compose.droplet.yml exec -T api npx tsx prisma/import-bsc-prod.ts
 *
 * DEDUP: areas e setores ja existentes (casados por nome SEM acento/caixa) sao
 * REUSADOS — inclusive setores aninhados fundo na subarvore da area. So cria o
 * que nao existe. Nada e deletado. Indicadores upsert por (companyId, code).
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry-run');
const SRC = 'BSC';

type Direction = 'HIGHER_BETTER' | 'LOWER_BETTER';
type Light = 'GREEN' | 'YELLOW' | 'RED' | 'GRAY';

interface Payload {
  company: string;
  areas: string[];
  indicators: { code: string; name: string; area: string; setor: string; direction: Direction; unit: string }[];
  points: { code: string; periodRef: string; real: number | null; meta: number | null }[];
}

// calcStatus embutido (espelha packages/shared/src/status.ts p/ HIGHER/LOWER)
function calcStatus(value: number | null, target: number | null | undefined, direction: Direction, tolP = 10) {
  if (value == null || target == null) return { light: 'GRAY' as Light, attainment: null, deviationAbs: null, deviationPct: null };
  const deviationAbs = value - target;
  const deviationPct = target !== 0 ? (deviationAbs / Math.abs(target)) * 100 : null;
  let attainment: number | null;
  let light: Light;
  if (direction === 'LOWER_BETTER') {
    attainment = target !== 0 ? Math.max(0, 2 - value / target) : value <= 0 ? 1 : 0;
    if (value <= target) light = 'GREEN';
    else if (deviationPct !== null && deviationPct <= tolP) light = 'YELLOW';
    else light = 'RED';
  } else {
    attainment = target !== 0 ? value / target : value >= 0 ? 1 : 0;
    if (value >= target) light = 'GREEN';
    else if (deviationPct !== null && deviationPct >= -tolP) light = 'YELLOW';
    else light = 'RED';
  }
  return { light, attainment, deviationAbs, deviationPct };
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

async function inChunks<T>(items: T[], size: number, fn: (it: T) => Promise<void>, onProgress?: (n: number) => void) {
  let done = 0;
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
    done = Math.min(items.length, i + size);
    onProgress?.(done);
  }
}

interface Node { id: string; name: string; parentId: string | null; type: string; }

async function main() {
  console.log(`\n=== IMPORT BSC -> Goiasa (PROD) ${DRY ? '[DRY-RUN]' : '[GRAVANDO]'} ===\n`);
  const payload: Payload = JSON.parse(fs.readFileSync(path.join(__dirname, 'bsc-payload.json'), 'utf8'));

  // empresa (guarda dura: precisa conter "goiasa")
  const company = await prisma.company.findFirst({
    where: { name: { contains: 'oiasa' } },
    select: { id: true, name: true },
  });
  if (!company || !/goiasa/i.test(company.name)) throw new Error('Empresa Goiasa nao encontrada.');
  const companyId = company.id;
  console.log('Empresa:', company.name, companyId);

  // carrega arvore atual
  let nodes: Node[] = await prisma.orgNode.findMany({
    where: { companyId, deletedAt: null },
    select: { id: true, name: true, parentId: true, type: true },
  });
  console.log('Nos existentes:', nodes.length);

  const childrenOf = (id: string) => nodes.filter((n) => n.parentId === id);
  function descendants(rootId: string): Node[] {
    const out: Node[] = [];
    const stack = [...childrenOf(rootId)];
    while (stack.length) {
      const n = stack.pop()!;
      out.push(n);
      stack.push(...childrenOf(n.id));
    }
    return out;
  }

  const branch = nodes.find((n) => n.type === 'BRANCH' && norm(n.name) === 'goiasa') ?? nodes.find((n) => n.parentId === null);
  const rootParentId = branch?.id ?? null;

  // ---------- resolve AREAS ----------
  const areaId = new Map<string, string>(); // area -> nodeId
  const areasReused: string[] = [];
  const areasCreated: string[] = [];
  let aPos = nodes.length;
  for (const area of payload.areas) {
    const hit = nodes.find((n) => norm(n.name) === norm(area));
    if (hit) {
      areaId.set(area, hit.id);
      areasReused.push(`${area} -> reusa "${hit.name}" [${hit.type}]`);
    } else if (DRY) {
      areaId.set(area, `DRY-AREA-${area}`);
      areasCreated.push(area);
    } else {
      const created = await prisma.orgNode.create({
        data: { companyId, name: area, type: 'AREA', parentId: rootParentId, position: aPos++, externalSource: SRC, externalId: `AREA::${area}` },
        select: { id: true, name: true, parentId: true, type: true },
      });
      nodes.push(created);
      areaId.set(area, created.id);
      areasCreated.push(area);
    }
  }

  // ---------- resolve SETORES (por area, busca na subarvore) ----------
  const setorId = new Map<string, string>(); // `${area}::${setor}` -> nodeId
  let setoresReused = 0, setoresCreated = 0;
  const createdSetorSamples: string[] = [];
  // pares unicos area::setor
  const pairs = [...new Set(payload.indicators.map((i) => `${i.area}::${i.setor}`))];
  for (const pair of pairs) {
    const [area, setor] = pair.split('::');
    const aId = areaId.get(area)!;
    // descendentes reais (so quando a area ja existe de verdade)
    const subtree = aId.startsWith('DRY-AREA-') ? [] : descendants(aId);
    const hit = subtree.find((n) => norm(n.name) === norm(setor));
    if (hit) {
      setorId.set(pair, hit.id);
      setoresReused++;
    } else if (DRY) {
      setorId.set(pair, `DRY-SET-${pair}`);
      setoresCreated++;
      if (createdSetorSamples.length < 12) createdSetorSamples.push(`${area} > ${setor}`);
    } else {
      const created = await prisma.orgNode.create({
        data: { companyId, name: setor, type: 'SECTOR', parentId: aId, position: 0, externalSource: SRC, externalId: `SECTOR::${pair}` },
        select: { id: true, name: true, parentId: true, type: true },
      });
      nodes.push(created); // p/ proximos lookups acharem
      setorId.set(pair, created.id);
      setoresCreated++;
    }
  }

  // ---------- INDICADORES ----------
  const existingCodes = new Set(
    (await prisma.indicator.findMany({ where: { companyId, code: { in: payload.indicators.map((i) => i.code) } }, select: { code: true } }))
      .map((i) => i.code),
  );
  const indWillUpdate = payload.indicators.filter((i) => existingCodes.has(i.code)).length;
  const indWillCreate = payload.indicators.length - indWillUpdate;

  // ---------- contagem de metas/realizados ----------
  const metas = payload.points.filter((p) => p.meta != null).length;
  const reals = payload.points.filter((p) => p.real != null).length;

  if (DRY) {
    console.log('\n--- PLANO (dry-run) ---');
    console.log(`AREAS: ${areasReused.length} reusar, ${areasCreated.length} criar`);
    areasReused.forEach((s) => console.log('  [reusa] ' + s));
    areasCreated.forEach((s) => console.log('  [cria ] ' + s));
    console.log(`\nSETORES: ${setoresReused} reusar, ${setoresCreated} criar`);
    console.log('  amostra criar:', createdSetorSamples.join(' | '));
    console.log(`\nINDICADORES: ${payload.indicators.length} (criar ${indWillCreate}, atualizar ${indWillUpdate})`);
    console.log(`METAS: ${metas} | REALIZADOS: ${reals}`);
    await prisma.$disconnect();
    return;
  }

  console.log(`AREAS: ${areasReused.length} reusadas, ${areasCreated.length} criadas`);
  console.log(`SETORES: ${setoresReused} reusados, ${setoresCreated} criados`);

  const indId = new Map<string, { id: string; direction: Direction }>();
  await inChunks(payload.indicators, 12, async (ir) => {
    const ownerNodeId = setorId.get(`${ir.area}::${ir.setor}`)!;
    const up = await prisma.indicator.upsert({
      where: { companyId_code: { companyId, code: ir.code } },
      create: {
        companyId, ownerNodeId, name: ir.name, code: ir.code, direction: ir.direction as any,
        unit: ir.unit as any, periodicity: 'MONTHLY', feedKind: 'DATABASE', type: 'OPERATIONAL',
        status: 'ACTIVE', externalSource: SRC, externalId: ir.code,
      },
      update: { ownerNodeId, name: ir.name, direction: ir.direction as any, unit: ir.unit as any, feedKind: 'DATABASE', externalSource: SRC, externalId: ir.code },
      select: { id: true },
    });
    indId.set(ir.code, { id: up.id, direction: ir.direction });
  }, (n) => process.stdout.write(`\r  indicadores: ${n}/${payload.indicators.length}`));
  console.log(`\nOK indicadores: ${indId.size}`);

  let tDone = 0, rDone = 0;
  await inChunks(payload.points, 25, async (p) => {
    const ind = indId.get(p.code);
    if (!ind) return;
    const [y, m] = p.periodRef.split('-').map(Number);
    const periodDate = new Date(Date.UTC(y, m - 1, 1));
    if (p.meta != null) {
      await prisma.indicatorTarget.upsert({
        where: { indicatorId_periodRef: { indicatorId: ind.id, periodRef: p.periodRef } },
        create: { indicatorId: ind.id, periodRef: p.periodRef, target: p.meta },
        update: { target: p.meta },
      });
      tDone++;
    }
    if (p.real != null) {
      const st = calcStatus(p.real, p.meta ?? undefined, ind.direction);
      await prisma.indicatorResult.upsert({
        where: { indicatorId_periodRef: { indicatorId: ind.id, periodRef: p.periodRef } },
        create: { indicatorId: ind.id, periodRef: p.periodRef, periodDate, value: p.real, light: st.light as any, attainment: st.attainment, deviationAbs: st.deviationAbs, deviationPct: st.deviationPct },
        update: { periodDate, value: p.real, light: st.light as any, attainment: st.attainment, deviationAbs: st.deviationAbs, deviationPct: st.deviationPct },
      });
      rDone++;
    }
  }, (n) => process.stdout.write(`\r  metas/realizados: ${n}/${payload.points.length}`));
  console.log(`\nOK metas: ${tDone} | realizados: ${rDone}`);
  console.log('\n=== CONCLUIDO ===');
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error('\nERRO:', e); await prisma.$disconnect(); process.exit(1); });
