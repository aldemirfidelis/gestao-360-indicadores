export const OFFER_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED'] as const;
export const PRE_ADMISSION_STATUSES = ['OPEN', 'IN_DOCUMENTS', 'READY_FOR_ASO', 'IN_ASO', 'ASO_CLEARED', 'ASO_BLOCKED', 'COMPLETED', 'CANCELLED'] as const;
export const PRE_ADMISSION_DOC_STATUSES = ['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WAIVED'] as const;

export interface SalaryBandInput {
  salaryAmountCents: number;
  salaryMinCents?: number | null;
  salaryMaxCents?: number | null;
}

export interface SalaryBandResult {
  within: boolean;
  approvalRequired: boolean;
  reason: string | null;
}

export function evaluateSalaryBand(input: SalaryBandInput): SalaryBandResult {
  const amount = Math.round(Number(input.salaryAmountCents));
  const min = input.salaryMinCents == null ? null : Math.round(Number(input.salaryMinCents));
  const max = input.salaryMaxCents == null ? null : Math.round(Number(input.salaryMaxCents));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { within: false, approvalRequired: true, reason: 'Valor da proposta invalido.' };
  }
  if (min !== null && Number.isFinite(min) && amount < min) {
    return { within: false, approvalRequired: true, reason: 'Valor abaixo da faixa salarial aprovada.' };
  }
  if (max !== null && Number.isFinite(max) && amount > max) {
    return { within: false, approvalRequired: true, reason: 'Valor acima da faixa salarial aprovada.' };
  }
  return { within: true, approvalRequired: false, reason: null };
}

export function canSendOffer(status: string, approvalRequired: boolean): boolean {
  if (approvalRequired) return status === 'APPROVED';
  return ['DRAFT', 'APPROVED'].includes(status);
}

export function canCandidateDecideOffer(status: string, expiresAt?: Date | string | null, now = new Date()): boolean {
  if (status !== 'SENT') return false;
  if (!expiresAt) return true;
  const expires = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return Number.isFinite(expires.getTime()) && expires >= now;
}

export function preAdmissionIsReady(documents: Array<{ required?: boolean | null; status: string }>): boolean {
  return documents.every((doc) => !doc.required || ['APPROVED', 'WAIVED'].includes(doc.status));
}

export const DEFAULT_PRE_ADMISSION_DOCUMENTS = [
  { kind: 'IDENTITY', title: 'Documento de identidade', required: true },
  { kind: 'CPF', title: 'CPF', required: true },
  { kind: 'PROOF_OF_ADDRESS', title: 'Comprovante de endereco', required: true },
  { kind: 'BANK', title: 'Dados bancarios', required: true },
  { kind: 'EDUCATION', title: 'Comprovante de escolaridade', required: false },
];
