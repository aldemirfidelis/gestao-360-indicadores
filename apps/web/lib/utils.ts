import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number | null | undefined, opts: Intl.NumberFormatOptions = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2, ...opts }).format(value);
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export function periodRefLabel(ref: string): string {
  if (/^\d{4}-\d{2}$/.test(ref)) {
    const [y, m] = ref.split('-');
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${months[parseInt(m, 10) - 1]}/${y.slice(2)}`;
  }
  return ref;
}
