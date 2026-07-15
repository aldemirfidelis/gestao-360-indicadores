export const RECRUIT_ADMISSION_STATUSES = ['AUTHORIZED', 'EMPLOYEE_CREATED', 'ONBOARDING_STARTED', 'ESOCIAL_PENDING', 'ESOCIAL_GENERATED', 'COMPLETED', 'CANCELLED'] as const;
export const RECRUIT_ADMISSION_ESOCIAL_STATUSES = ['NOT_GENERATED', 'PENDING', 'GENERATED', 'SKIPPED', 'ERROR'] as const;
export const PROBATION_REVIEW_DAYS = [45, 90] as const;

export interface AdmissionReadinessInput {
  applicationStatus: string;
  offerStatus?: string | null;
  preAdmissionStatus?: string | null;
  asoResult?: string | null;
}

export interface AdmissionReadinessResult {
  ready: boolean;
  blocks: string[];
}

export function evaluateAdmissionReadiness(input: AdmissionReadinessInput): AdmissionReadinessResult {
  const blocks: string[] = [];
  if (input.applicationStatus !== 'ACTIVE') blocks.push('Candidatura precisa estar ativa.');
  if (input.offerStatus !== 'ACCEPTED') blocks.push('Proposta precisa estar aceita.');
  if (input.preAdmissionStatus !== 'ASO_CLEARED') blocks.push('Pre-admissao precisa estar liberada pelo ASO.');
  if (input.asoResult && !['APTO', 'APTO_COM_RESTRICAO'].includes(input.asoResult)) blocks.push('ASO nao liberou a admissao.');
  return { ready: blocks.length === 0, blocks };
}

export function probationReviewDueDates(admissionDate: Date, cycles: readonly number[] = PROBATION_REVIEW_DAYS): Array<{ cycleDay: number; dueAt: Date }> {
  return cycles.map((cycleDay) => {
    const dueAt = new Date(admissionDate.getTime());
    dueAt.setUTCDate(dueAt.getUTCDate() + cycleDay);
    return { cycleDay, dueAt };
  });
}

export function normalizeCpfRequired(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length === 11 ? digits : null;
}
