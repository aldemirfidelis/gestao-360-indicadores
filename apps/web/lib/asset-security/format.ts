/** Formatação e utilidades do módulo Segurança Patrimonial. */

/** Data + hora no padrão pt-BR (ex.: 15/06/2026 14:32). */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** Apenas a hora (ex.: 14:32). */
export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d);
}

/** Minutos decorridos entre duas datas (default: até agora). */
export function dwellMinutes(from: string | Date | null | undefined, to?: string | Date | null): number | null {
  if (!from) return null;
  const start = from instanceof Date ? from : new Date(from);
  if (Number.isNaN(start.getTime())) return null;
  const end = to ? (to instanceof Date ? to : new Date(to)) : new Date();
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
}

/** Formata uma duração em minutos como "2h 15min" / "45min". */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '—';
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

/** Gera e dispara o download de um CSV (separador ';', BOM UTF-8 para o Excel). */
export function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>): void {
  const escape = (cell: string | number | null | undefined) => {
    const text = cell === null || cell === undefined ? '' : String(cell);
    return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = rows.map((row) => row.map(escape).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
