/**
 * Utilitarios puros da integracao com a folha (Fase 5) — sem banco, testaveis.
 */
export interface CalcResultLike {
  id: string;
  registration: string;
  name: string;
  finalValue: number | null;
  blocked: boolean;
  blockReason?: string | null;
}
export interface PayrollItemDraft {
  registration: string;
  name: string;
  rubric: string | null;
  value: number;
  status: 'PENDING' | 'BLOCKED';
  blockReason: string | null;
  calcResultId: string;
}

/** Monta os itens da folha a partir dos resultados da apuracao. */
export function buildPayrollItems(results: CalcResultLike[], rubric: string | null): PayrollItemDraft[] {
  return results.map((r) => {
    const value = Number(r.finalValue ?? 0);
    const blocked = r.blocked || value <= 0;
    return {
      registration: r.registration,
      name: r.name,
      rubric: rubric ?? null,
      value: blocked ? 0 : value,
      status: blocked ? 'BLOCKED' : 'PENDING',
      blockReason: blocked ? (r.blockReason ?? 'Sem valor a pagar') : null,
      calcResultId: r.id,
    };
  });
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serializa os itens em CSV (separador ';' — padrao BR). */
export function payrollToCsv(items: Array<{ registration: string; name: string; rubric: string | null; value: number; status: string }>, competenceLabel: string): string {
  const header = ['competencia', 'matricula', 'nome', 'rubrica', 'valor', 'status'];
  const lines = [header.join(';')];
  for (const it of items) {
    if (it.status === 'BLOCKED') continue; // arquivo da folha leva apenas pagaveis
    lines.push([competenceLabel, it.registration, it.name, it.rubric ?? '', it.value.toFixed(2).replace('.', ','), 'A_PAGAR'].map(csvCell).join(';'));
  }
  return lines.join('\n');
}

export interface ReturnRow { registration: string; status?: string; returnCode?: string; returnMessage?: string }

/** Concilia o retorno da folha contra os itens do lote. */
export function reconcileReturn(
  items: Array<{ registration: string }>,
  rows: ReturnRow[],
): { matched: number; rejected: number; notFound: string[] } {
  const byReg = new Set(items.map((i) => i.registration));
  let matched = 0;
  let rejected = 0;
  const notFound: string[] = [];
  for (const row of rows) {
    if (!byReg.has(row.registration)) { notFound.push(row.registration); continue; }
    matched++;
    const st = (row.status ?? '').toUpperCase();
    if (st === 'REJECTED' || st === 'REJEITADO' || row.returnCode) rejected++;
  }
  return { matched, rejected, notFound };
}
