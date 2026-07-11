/**
 * Lógica pura da Fase 4: checklists padrão de admissão/desligamento e regras
 * de validade do ASO (NR-7).
 */

export const PROCESS_KINDS = ['ONBOARDING', 'OFFBOARDING'] as const;
export const EXAM_TYPES = ['ADMISSIONAL', 'PERIODICO', 'RETORNO_TRABALHO', 'MUDANCA_RISCO', 'DEMISSIONAL'] as const;
export const EXAM_RESULTS = ['APTO', 'APTO_COM_RESTRICAO', 'INAPTO'] as const;

export interface ProcessItemTemplate {
  title: string;
  required: boolean;
  /** Tipo de documento do dossiê que satisfaz o item (badge automático na tela). */
  dossierKind?: string;
}

/** Checklist padrão de admissão (prática Convenia/Gupy Admissão). */
export const DEFAULT_ONBOARDING_ITEMS: ProcessItemTemplate[] = [
  { title: 'Documento de identidade (RG)', required: true, dossierKind: 'RG' },
  { title: 'CPF', required: true, dossierKind: 'CPF' },
  { title: 'Carteira de trabalho (CTPS)', required: true, dossierKind: 'CTPS' },
  { title: 'Comprovante de residência', required: true, dossierKind: 'COMPROVANTE_RESIDENCIA' },
  { title: 'Foto para crachá', required: false, dossierKind: 'FOTO' },
  { title: 'Contrato de trabalho assinado', required: true, dossierKind: 'CONTRATO' },
  { title: 'ASO admissional (apto)', required: true, dossierKind: 'ASO' },
  { title: 'Dados bancários informados', required: true },
  { title: 'Dependentes cadastrados (se houver)', required: false },
  { title: 'Escala de trabalho atribuída no ponto', required: true },
  { title: 'Usuário de acesso criado e vinculado', required: false },
];

/** Checklist padrão de desligamento. */
export const DEFAULT_OFFBOARDING_ITEMS: ProcessItemTemplate[] = [
  { title: 'Aviso prévio formalizado', required: true },
  { title: 'Devolução de equipamentos e crachá', required: true },
  { title: 'Exame demissional realizado', required: true, dossierKind: 'ASO' },
  { title: 'Acessos e sistemas revogados', required: true },
  { title: 'Pendências de ponto fechadas (espelho conferido)', required: true },
  { title: 'Férias e verbas conferidas com a folha', required: true },
  { title: 'Termo de rescisão assinado', required: true, dossierKind: 'CONTRATO' },
];

export function defaultItemsFor(kind: string): ProcessItemTemplate[] {
  return kind === 'OFFBOARDING' ? DEFAULT_OFFBOARDING_ITEMS : DEFAULT_ONBOARDING_ITEMS;
}

/**
 * Validade padrão do ASO quando não informada (NR-7, simplificado):
 * periódico/admissional/retorno/mudança de risco = 12 meses; demissional não vence.
 */
export function defaultExamValidity(type: string, examDate: Date): Date | null {
  if (type === 'DEMISSIONAL') return null;
  const d = new Date(examDate.getTime());
  d.setUTCMonth(d.getUTCMonth() + 12);
  return d;
}

export type ExamStatus = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'NO_EXPIRY';

/** Situação do exame: vencido, vencendo (janela em dias) ou válido. */
export function examStatus(validUntil: Date | null, today: Date, warningDays = 60): ExamStatus {
  if (!validUntil) return 'NO_EXPIRY';
  if (validUntil.getTime() < today.getTime()) return 'EXPIRED';
  const warningLimit = new Date(today.getTime() + warningDays * 86_400_000);
  if (validUntil.getTime() <= warningLimit.getTime()) return 'EXPIRING';
  return 'VALID';
}
