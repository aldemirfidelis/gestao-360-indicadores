import { formatNumber } from '@/lib/utils';

/**
 * Formata um valor monetario respeitando a moeda da tabela e o mascaramento
 * de salario (quando o usuario nao possui permissao para ver valores individuais).
 */
export function formatMoney(
  value: number | string | null | undefined,
  options: { currency?: string; masked?: boolean } = {},
): string {
  if (options.masked) return 'Restrito';
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return '-';
  return formatNumber(num, { style: 'currency', currency: options.currency ?? 'BRL' });
}

/** Converte string/number do backend (Decimal serializado) para number. */
export function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'string' ? Number(value) : value;
  return Number.isNaN(num) ? null : num;
}

/** Decodifica um conteúdo base64 (ex.: .docx vindo da API) e dispara o download no navegador. */
export function downloadBase64(filename: string, contentType: string, base64: string): void {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Gera e dispara o download de um CSV no navegador. */
export function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>): void {
  const escape = (cell: string | number | null | undefined) => {
    const text = cell === null || cell === undefined ? '' : String(cell);
    return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = rows.map((row) => row.map(escape).join(';')).join('\n');
  // BOM para o Excel reconhecer UTF-8 (acentos).
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
