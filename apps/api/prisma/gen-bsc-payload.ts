/**
 * Gera prisma/bsc-payload.json autocontido (areas, indicadores, metas/realizados)
 * a partir das duas planilhas locais, para importar na PRODUCAO de dentro do
 * container (que nao tem as planilhas nem acesso ao caminho local).
 *
 * Uso:  npx tsx prisma/gen-bsc-payload.ts
 * Depois copie o JSON + prisma/import-bsc-prod.ts para o container e rode la.
 */
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';

const BASE = 'D:\\Projetos\\gestao-indicadores-sqlite\\Gestao_premio\\Bases_calculo';
const IND_FILE = path.join(BASE, 'INDICADORES PARA IMPORTAÇÃO.xlsx');
const BSC_FILE = path.join(BASE, 'Ferramenta de Apuração e Divulgação de Resultado do Prêmio.xlsm');
const OUT = path.join(__dirname, 'bsc-payload.json');

function raw(row: ExcelJS.Row, c: number): unknown {
  let v: unknown = row.getCell(c).value;
  if (v && typeof v === 'object' && 'result' in (v as any)) v = (v as any).result;
  if (v && typeof v === 'object' && 'text' in (v as any)) v = (v as any).text;
  return v;
}
const str = (row: ExcelJS.Row, c: number) => { const v = raw(row, c); return v == null ? '' : String(v).trim(); };
function num(row: ExcelJS.Row, c: number): number | null {
  const v = raw(row, c);
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const wbInd = new ExcelJS.Workbook();
  await wbInd.xlsx.readFile(IND_FILE);
  const wsInd = wbInd.getWorksheet('Plan5')!;
  type Ind = { code: string; name: string; area: string; setor: string; direction: 'HIGHER_BETTER' | 'LOWER_BETTER'; unit: string };
  const inds: Ind[] = [];
  for (let r = 2; r <= wsInd.rowCount; r++) {
    const code = str(wsInd.getRow(r), 1);
    if (!code) continue;
    inds.push({
      code, name: str(wsInd.getRow(r), 2),
      setor: str(wsInd.getRow(r), 3) || 'Sem setor',
      area: str(wsInd.getRow(r), 5) || 'Sem área',
      direction: /menor/i.test(str(wsInd.getRow(r), 4)) ? 'LOWER_BETTER' : 'HIGHER_BETTER',
      unit: 'INDEX',
    });
  }
  const codeSet = new Set(inds.map((i) => i.code));

  const wbBsc = new ExcelJS.Workbook();
  await wbBsc.xlsx.readFile(BSC_FILE);
  const wsBsc = wbBsc.getWorksheet('Base_BSC')!;
  const points: { code: string; periodRef: string; real: number | null; meta: number | null }[] = [];
  const maxByCode = new Map<string, number>();
  for (let r = 2; r <= wsBsc.rowCount; r++) {
    const code = str(wsBsc.getRow(r), 1);
    if (!code || !codeSet.has(code)) continue;
    const ano = num(wsBsc.getRow(r), 3), mes = num(wsBsc.getRow(r), 4);
    if (!ano || !mes) continue;
    const real = num(wsBsc.getRow(r), 5), meta = num(wsBsc.getRow(r), 7);
    if (real == null && meta == null) continue;
    points.push({ code, periodRef: `${ano}-${String(mes).padStart(2, '0')}`, real, meta });
    for (const v of [real, meta]) if (v != null) maxByCode.set(code, Math.max(maxByCode.get(code) ?? 0, Math.abs(v)));
  }
  for (const i of inds) {
    const mx = maxByCode.get(i.code);
    i.unit = mx == null ? 'INDEX' : mx <= 100 ? 'PERCENT' : 'QUANTITY';
  }

  const areas = [...new Set(inds.map((i) => i.area))].sort();
  fs.writeFileSync(OUT, JSON.stringify({ company: 'Goiasa', areas, indicators: inds, points }));
  console.log('Payload gravado em', OUT);
  console.log(`areas=${areas.length} indicadores=${inds.length} points=${points.length}  (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
