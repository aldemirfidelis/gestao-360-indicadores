// Tipos e rótulos do módulo de Treinamento e Desenvolvimento.
// Nenhum código do banco aparece na interface: tudo passa pelos mapas abaixo.

export type AssignmentStatus =
  | 'NOT_STARTED'
  | 'PENDING'
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'AWAITING_ASSESSMENT'
  | 'AWAITING_EFFECTIVENESS'
  | 'AWAITING_VALIDATION'
  | 'VALID'
  | 'DUE_SOON'
  | 'EXPIRED'
  | 'FAILED'
  | 'ABSENT'
  | 'WAIVED'
  | 'NOT_APPLICABLE'
  | 'SUPERSEDED';

export type TrainingModality =
  | 'PRESENCIAL'
  | 'ONLINE'
  | 'HIBRIDO'
  | 'LEITURA_ORIENTADA'
  | 'DIALOGO_SEGURANCA'
  | 'INTEGRACAO'
  | 'PRATICO'
  | 'EXTERNO'
  | 'RECICLAGEM'
  | 'CIENCIA';

export type ClassStatus = 'PLANNED' | 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type AttendanceStatus = 'INVITED' | 'CONFIRMED' | 'PRESENT' | 'ABSENT' | 'EXCUSED';
export type CertificateStatus = 'PENDING_VALIDATION' | 'VALID' | 'REJECTED' | 'EXPIRED';
export type ValidityKind = 'NONE' | 'DAYS' | 'MONTHS' | 'YEARS' | 'FROM_DOCUMENT';
export type RequirementTarget = 'ALL_COMPANY' | 'ORG_NODE' | 'JOB' | 'EMPLOYEE';

export interface TrainingDocumentRef {
  id: string;
  code: string | null;
  title: string;
  version: number;
}

export interface TrainingItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  category?: { id: string; name: string; color?: string | null } | null;
  modality: TrainingModality;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  workloadMinutes: number;
  validityKind: ValidityKind;
  validityValue?: number | null;
  dueSoonDays: number;
  deadlineDays?: number | null;
  document?: TrainingDocumentRef | null;
  documentVersion?: number | null;
  requiresAssessment: boolean;
  minimumScore?: number | null;
  requiresAttendance: boolean;
  requiresEffectiveness: boolean;
  requiresCertificate: boolean;
  allowsOnline: boolean;
  plannedCostCents?: number | null;
  defaultInstructor?: { id: string; name: string } | null;
  requirements: number;
  assignments: number;
  classes: number;
}

export interface RequirementItem {
  id: string;
  trainingId: string;
  training: { id: string; code: string; name: string; modality: TrainingModality };
  target: RequirementTarget;
  targetId?: string | null;
  targetLabel: string;
  mandatory: boolean;
  admissionDeadlineDays?: number | null;
  movementDeadlineDays?: number | null;
  validityKind?: ValidityKind | null;
  validityValue?: number | null;
  originDocument?: TrainingDocumentRef | null;
  activity?: string | null;
  justification?: string | null;
  blocksOperation: boolean;
  active: boolean;
  assignments: number;
}

export interface AssignmentItem {
  id: string;
  employeeId: string;
  employee: {
    id: string;
    name: string;
    registrationId?: string | null;
    job?: { id: string; name: string } | null;
    orgNode?: { id: string; name: string } | null;
  };
  training: { id: string; code: string; name: string; modality: TrainingModality; workloadMinutes: number };
  status: AssignmentStatus;
  mandatory: boolean;
  dueAt?: string | null;
  completedAt?: string | null;
  validUntil?: string | null;
  score?: number | null;
  result: 'PENDING' | 'APPROVED' | 'FAILED' | 'NOT_APPLICABLE';
  class?: { id: string; startsAt: string; status: ClassStatus } | null;
  origin?: {
    requirementId: string;
    target: RequirementTarget;
    justification?: string | null;
    activity?: string | null;
    blocksOperation: boolean;
    document?: TrainingDocumentRef | null;
  } | null;
}

export interface TrainingOverview {
  metrics: {
    complianceRate: number | null;
    employeesTotal: number;
    employeesWithPending: number;
    employeesCompliant: number;
    pending: number;
    expired: number;
    dueSoon: number;
    completedThisMonth: number;
    workloadHoursThisMonth: number;
    classesPlanned: number;
    certificatesPending: number;
    approvalRate: number | null;
  };
  byArea: Array<{ areaId: string | null; area: string; pending: number }>;
  byTraining: Array<{ trainingId: string; code: string; name: string; pending: number }>;
}

export interface ClassItem {
  id: string;
  code?: string | null;
  training: { id: string; code: string; name: string; workloadMinutes: number; requiresAttendance: boolean };
  instructor?: { id: string; name: string } | null;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  capacity?: number | null;
  status: ClassStatus;
  participantCount: number;
}

export interface ClassParticipant {
  id: string;
  employeeId: string;
  name: string;
  registrationId?: string | null;
  job?: string | null;
  area?: string | null;
  attendance: AttendanceStatus;
  score?: number | null;
  result: 'PENDING' | 'APPROVED' | 'FAILED' | 'NOT_APPLICABLE';
  absenceReason?: string | null;
  waitlisted: boolean;
  assignmentId?: string | null;
}

export interface ClassDetail extends ClassItem {
  document?: TrainingDocumentRef | null;
  requiresAssessment: boolean;
  minimumScore?: number | null;
  requiresCertificate: boolean;
  participants: ClassParticipant[];
  evidences: Array<{ id: string; kind: string; fileName?: string | null; note?: string | null; createdAt: string }>;
}

// ---------------------------------------------------------------- rótulos

export const ASSIGNMENT_STATUS: Record<AssignmentStatus, { label: string; tone: string; description: string }> = {
  NOT_STARTED: { label: 'Não iniciado', tone: 'slate', description: 'Exigência criada, ainda sem programação' },
  PENDING: { label: 'Pendente', tone: 'amber', description: 'Aguardando programação ou realização' },
  SCHEDULED: { label: 'Programado', tone: 'sky', description: 'Incluído em uma turma' },
  CONFIRMED: { label: 'Confirmado', tone: 'sky', description: 'Participação confirmada pelo colaborador' },
  IN_PROGRESS: { label: 'Em andamento', tone: 'sky', description: 'Treinamento em execução' },
  AWAITING_ASSESSMENT: { label: 'Aguardando avaliação', tone: 'violet', description: 'Falta aplicar ou corrigir a avaliação' },
  AWAITING_EFFECTIVENESS: { label: 'Aguardando eficácia', tone: 'violet', description: 'Realizado; falta avaliar a eficácia' },
  AWAITING_VALIDATION: { label: 'Aguardando validação', tone: 'violet', description: 'Certificado enviado, em análise' },
  VALID: { label: 'Válido', tone: 'emerald', description: 'Realizado e dentro da validade' },
  DUE_SOON: { label: 'Próximo do vencimento', tone: 'amber', description: 'Vence dentro do prazo de antecedência' },
  EXPIRED: { label: 'Vencido', tone: 'red', description: 'Fora da validade — exige reciclagem' },
  FAILED: { label: 'Reprovado', tone: 'red', description: 'Não atingiu a nota mínima' },
  ABSENT: { label: 'Ausente', tone: 'red', description: 'Não compareceu à turma' },
  WAIVED: { label: 'Dispensado', tone: 'slate', description: 'Dispensado com justificativa' },
  NOT_APPLICABLE: { label: 'Não aplicável', tone: 'slate', description: 'Exigência encerrada para este colaborador' },
  SUPERSEDED: { label: 'Substituído', tone: 'slate', description: 'Substituído por outro registro' },
};

export const MODALITY_LABEL: Record<TrainingModality, string> = {
  PRESENCIAL: 'Presencial',
  ONLINE: 'Online',
  HIBRIDO: 'Híbrido',
  LEITURA_ORIENTADA: 'Leitura orientada',
  DIALOGO_SEGURANCA: 'Diálogo de segurança',
  INTEGRACAO: 'Integração',
  PRATICO: 'Treinamento prático',
  EXTERNO: 'Treinamento externo',
  RECICLAGEM: 'Reciclagem',
  CIENCIA: 'Confirmação de ciência',
};

export const CLASS_STATUS: Record<ClassStatus, { label: string; tone: string }> = {
  PLANNED: { label: 'Planejada', tone: 'slate' },
  OPEN: { label: 'Aberta', tone: 'sky' },
  IN_PROGRESS: { label: 'Em andamento', tone: 'amber' },
  DONE: { label: 'Concluída', tone: 'emerald' },
  CANCELLED: { label: 'Cancelada', tone: 'red' },
};

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  INVITED: 'Convocado',
  CONFIRMED: 'Confirmado',
  PRESENT: 'Presente',
  ABSENT: 'Ausente',
  EXCUSED: 'Ausência justificada',
};

export const CERTIFICATE_STATUS: Record<CertificateStatus, { label: string; tone: string }> = {
  PENDING_VALIDATION: { label: 'Aguardando validação', tone: 'amber' },
  VALID: { label: 'Válido', tone: 'emerald' },
  REJECTED: { label: 'Recusado', tone: 'red' },
  EXPIRED: { label: 'Vencido', tone: 'red' },
};

export const VALIDITY_KIND_LABEL: Record<ValidityKind, string> = {
  NONE: 'Sem vencimento',
  DAYS: 'Dias',
  MONTHS: 'Meses',
  YEARS: 'Anos',
  FROM_DOCUMENT: 'Definida pelo documento',
};

export const REQUIREMENT_TARGET_LABEL: Record<RequirementTarget, string> = {
  ALL_COMPANY: 'Toda a empresa',
  ORG_NODE: 'Área / setor',
  JOB: 'Cargo',
  EMPLOYEE: 'Colaborador',
};

/** Situações abertas — as que aparecem em Pendências. */
export const OPEN_STATUSES: AssignmentStatus[] = [
  'NOT_STARTED',
  'PENDING',
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'AWAITING_ASSESSMENT',
  'AWAITING_VALIDATION',
  'EXPIRED',
  'FAILED',
  'ABSENT',
  'DUE_SOON',
];

export const TONE_CLASS: Record<string, string> = {
  emerald: 'border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  amber: 'border-amber-300/60 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  red: 'border-rose-300/60 bg-rose-500/10 text-rose-700 dark:text-rose-400',
  sky: 'border-sky-300/60 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  violet: 'border-violet-300/60 bg-violet-500/10 text-violet-700 dark:text-violet-400',
  slate: 'border-slate-300/60 bg-slate-500/10 text-slate-600 dark:text-slate-300',
};

export function hoursLabel(minutes?: number | null) {
  if (!minutes) return '—';
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

export function percentLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value * 100)}%`;
}

export function validityLabel(kind: ValidityKind, value?: number | null) {
  if (kind === 'NONE') return 'Sem vencimento';
  if (kind === 'FROM_DOCUMENT') return 'Segue o documento';
  if (!value) return '—';
  const unit = kind === 'DAYS' ? 'dia' : kind === 'MONTHS' ? 'mês' : 'ano';
  const plural = value > 1 ? (kind === 'MONTHS' ? 'meses' : `${unit}s`) : unit;
  return `${value} ${plural}`;
}
