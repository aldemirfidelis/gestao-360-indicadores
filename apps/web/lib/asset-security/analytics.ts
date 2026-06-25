/**
 * Análises compostas no cliente para o painel de Segurança Patrimonial.
 * Funções puras (testáveis) sobre os dados já entregues pelos endpoints
 * existentes — sem qualquer dependência de migração de banco.
 */
import { INCIDENT_SEVERITY_LABELS } from './labels';
import type { AnyRecord, SecurityMovement } from './types';

function dayKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function shortDay(key: string): string {
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
}

/** Fluxo de entradas × saídas por dia nos últimos `days` dias. */
export function movementFlowByDay(movements: SecurityMovement[], days = 14): Array<{ name: string; entradas: number; saidas: number }> {
  const buckets = new Map<string, { entradas: number; saidas: number }>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), { entradas: 0, saidas: 0 });
  }
  for (const mv of movements) {
    const ek = dayKey(mv.entryAt);
    if (ek && buckets.has(ek)) buckets.get(ek)!.entradas += 1;
    const xk = dayKey(mv.exitAt);
    if (xk && buckets.has(xk)) buckets.get(xk)!.saidas += 1;
  }
  return Array.from(buckets.entries()).map(([key, v]) => ({ name: shortDay(key), ...v }));
}

const SEVERITY_COLORS: Record<string, string> = {
  LOW: '#2563eb',
  MEDIUM: '#ca8a04',
  HIGH: '#ea580c',
  CRITICAL: '#dc2626',
  EMERGENCY: '#991b1b',
};

/** Contagem de ocorrências por severidade (ordem fixa do menor ao maior). */
export function incidentsBySeverity(incidents: AnyRecord[]): Array<{ name: string; value: number; fill: string }> {
  const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY'];
  const counts = new Map<string, number>();
  for (const it of incidents) {
    const sev = String(it.severity ?? 'LOW');
    counts.set(sev, (counts.get(sev) ?? 0) + 1);
  }
  return order
    .filter((sev) => (counts.get(sev) ?? 0) > 0)
    .map((sev) => ({ name: INCIDENT_SEVERITY_LABELS[sev] ?? sev, value: counts.get(sev) ?? 0, fill: SEVERITY_COLORS[sev] ?? '#64748b' }));
}

/** Tempo médio de permanência (min) das movimentações encerradas. */
export function averageDwellMinutes(movements: SecurityMovement[]): number | null {
  const closed = movements.filter((m) => m.exitAt && m.entryAt);
  if (!closed.length) return null;
  const total = closed.reduce((acc, m) => {
    const explicit = typeof m.durationMinutes === 'number' ? m.durationMinutes : null;
    if (explicit !== null) return acc + explicit;
    const start = new Date(m.entryAt as string).getTime();
    const end = new Date(m.exitAt as string).getTime();
    return acc + Math.max(0, Math.round((end - start) / 60_000));
  }, 0);
  return Math.round(total / closed.length);
}


export interface ComplianceBar {
  label: string;
  ok: number;
  total: number;
  /** 0–100 */
  percent: number;
}

/** Conformidade de rondas (no prazo vs. atrasadas/não realizadas). */
export function roundsCompliance(executions: AnyRecord[]): ComplianceBar {
  const total = executions.length;
  const ok = executions.filter((r) => ['DONE'].includes(String(r.status))).length;
  return { label: 'Rondas no prazo', ok, total, percent: total ? Math.round((ok / total) * 100) : 100 };
}

/**
 * Conformidade documental a partir do `summary`: usa os totais de cadastros
 * (pessoas + empresas + veículos) e o nº de documentos inválidos/vencidos.
 * Como o summary não traz o total de cadastros, recebemos o total à parte.
 */
export function documentCompliance(invalidDocuments: number, totalRecords: number): ComplianceBar {
  const ok = Math.max(0, totalRecords - invalidDocuments);
  return {
    label: 'Documentos regulares',
    ok,
    total: totalRecords,
    percent: totalRecords ? Math.round((ok / totalRecords) * 100) : 100,
  };
}
