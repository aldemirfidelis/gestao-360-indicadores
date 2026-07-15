export const OCCUPATIONAL_REQUEST_STATUSES = ['REQUESTED', 'SCHEDULED', 'COMPLETED', 'CANCELLED'] as const;
export const OCCUPATIONAL_APPOINTMENT_STATUSES = ['SCHEDULED', 'COMPLETED', 'MISSED', 'CANCELLED'] as const;
export const ASO_RESULTS = ['APTO', 'APTO_COM_RESTRICAO', 'INAPTO'] as const;

export type AsoResult = typeof ASO_RESULTS[number];

export function canRequestAso(preAdmissionStatus: string): boolean {
  return ['READY_FOR_ASO', 'ASO_BLOCKED'].includes(preAdmissionStatus);
}

export function canScheduleAso(requestStatus: string): boolean {
  return ['REQUESTED', 'SCHEDULED'].includes(requestStatus);
}

export function canRecordAso(requestStatus: string): boolean {
  return ['REQUESTED', 'SCHEDULED'].includes(requestStatus);
}

export function isAsoCleared(result: string): boolean {
  return ['APTO', 'APTO_COM_RESTRICAO'].includes(result);
}

export function preAdmissionStatusAfterAso(result: string): 'ASO_CLEARED' | 'ASO_BLOCKED' {
  return isAsoCleared(result) ? 'ASO_CLEARED' : 'ASO_BLOCKED';
}

export function normalizeAsoResult(value: unknown): AsoResult | null {
  const result = String(value ?? '').trim().toUpperCase();
  return ASO_RESULTS.includes(result as AsoResult) ? result as AsoResult : null;
}

export interface RecruiterSafeAsoRecord {
  id: string;
  result: string;
  examDate: Date | string;
  validUntil?: Date | string | null;
  reportedAt?: Date | string | null;
}

export function redactAsoForRecruitment<T extends Record<string, any> | null | undefined>(record: T): RecruiterSafeAsoRecord | null {
  if (!record) return null;
  return {
    id: String(record.id),
    result: String(record.result),
    examDate: record.examDate,
    validUntil: record.validUntil ?? null,
    reportedAt: record.reportedAt ?? null,
  };
}
