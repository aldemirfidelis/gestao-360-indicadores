/**
 * Lógica pura do prontuário do colaborador: validação/máscara de CPF e
 * parse flexível de datas (ISO e BR) usado no cadastro e na importação.
 */

export function onlyDigits(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

/** Valida CPF pelo dígito verificador (aceita com ou sem máscara). */
export function isValidCpf(value: unknown): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const factor of [10, 11]) {
    let sum = 0;
    for (let i = 0; i < factor - 1; i++) sum += Number(cpf[i]) * (factor - i);
    const digit = ((sum * 10) % 11) % 10;
    if (digit !== Number(cpf[factor - 1])) return false;
  }
  return true;
}

/** Normaliza CPF para 11 dígitos; null se vazio; lança se inválido é decidido no serviço. */
export function normalizeCpf(value: unknown): string | null {
  const digits = onlyDigits(value);
  return digits.length ? digits : null;
}

/** Máscara LGPD para listagens: 123.•••.•••-45. */
export function maskCpf(cpf: string | null | undefined): string | null {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return null;
  return `${digits.slice(0, 3)}.•••.•••-${digits.slice(9)}`;
}

/** Data em ISO (YYYY-MM-DD) ou BR (DD/MM/YYYY) → Date ao meio-dia UTC (estável p/ fuso). */
export function parseFlexibleDate(value: unknown): Date | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  let iso: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) iso = text.slice(0, 10);
  else if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) iso = `${text.slice(6, 10)}-${text.slice(3, 5)}-${text.slice(0, 2)}`;
  if (!iso) {
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const date = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
  return date;
}

export const CONTRACT_TYPES = ['CLT', 'PJ', 'ESTAGIO', 'APRENDIZ', 'TEMPORARIO', 'AUTONOMO'] as const;
export const WORK_REGIMES = ['PRESENCIAL', 'HIBRIDO', 'REMOTO'] as const;
export const DEPENDENT_RELATIONSHIPS = ['FILHO', 'CONJUGE', 'PAI', 'MAE', 'OUTRO'] as const;
export const DOSSIER_KINDS = [
  'CPF',
  'RG',
  'CTPS',
  'COMPROVANTE_RESIDENCIA',
  'CONTRATO',
  'ASO',
  'CERTIFICADO',
  'FOTO',
  'OUTRO',
] as const;
export const EVENT_TYPES = [
  'ADMISSAO',
  'PROMOCAO',
  'MUDANCA_CARGO',
  'TRANSFERENCIA',
  'MUDANCA_STATUS',
  'DESLIGAMENTO',
  'OBSERVACAO',
  'OUTRO',
] as const;
