// Tipos compartilhados do modulo Cargos e Salarios (frontend).
// Refletem o retorno do compensation.service.ts no backend.

export interface JobCatalog {
  id: string;
  code: string;
  name: string;
  summary: string | null;
  family: string | null;
  careerTrack: string | null;
  hierarchyLevel: string | null;
  grade: string | null;
  salaryBand: string | null;
  cbo: string | null;
  jobType: string;
  status: string;
  criticality: string | null;
  currentVersion: number;
  inactiveReason?: string | null;
  linkedEmployees?: number;
  _count?: { positions: number; descriptions: number; salaryRanges: number; versions: number };
  versions?: JobCatalogVersion[];
}

export interface JobCatalogVersion {
  id: string;
  version: number;
  changeReason: string | null;
  createdAt: string;
}

export interface JobOption {
  id: string;
  code: string;
  name: string;
}

export interface SalaryRange {
  id: string;
  band: string;
  grade: string | null;
  level: string | null;
  step: string | null;
  family: string | null;
  minSalary: string | number;
  midpointSalary: string | number;
  maxSalary: string | number;
  jobCatalog?: JobOption | null;
}

export interface SalaryTable {
  id: string;
  code: string;
  name: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  status: string;
  ranges: SalaryRange[];
}

export interface FitRow {
  employeeId: string;
  registrationId: string | null;
  employeeName: string;
  orgNode: { id: string; name: string; type: string } | null;
  job: { id: string; name: string } | null;
  grade: string | null;
  band: string | null;
  currentSalary: number | null;
  minSalary: number | null;
  midpointSalary: number | null;
  maxSalary: number | null;
  compaRatio: number | null;
  positioningPercent: number | null;
  situation: string;
  lastMovementAt: string | null;
  costCenter: string | null;
  budgetStatus: string | null;
  salaryMasked: boolean;
}

export interface SalarySurvey {
  id: string;
  source: string;
  provider: string | null;
  periodRef: string;
  region: string | null;
  segment: string | null;
  internalJobCatalogId: string | null;
  marketJobName: string;
  minSalary: string | number | null;
  medianSalary: string | number | null;
  averageSalary: string | number | null;
  percentile25: string | number | null;
  percentile50: string | number | null;
  percentile75: string | number | null;
  percentile90: string | number | null;
}

export interface CompensationCycle {
  id: string;
  name: string;
  referencePeriod: string;
  criteria: string | null;
  guidelinePercent: string | number | null;
  totalBudget: string | number | null;
  status: string;
  workflow: unknown;
  createdAt: string;
}

// Rotulos legiveis para os status e situacoes em portugues.
export const SITUATION_LABELS: Record<string, string> = {
  ABAIXO_DA_FAIXA: 'Abaixo da faixa',
  PROXIMO_AO_MINIMO: 'Proximo ao minimo',
  DENTRO_DA_FAIXA: 'Dentro da faixa',
  PROXIMO_AO_PONTO_MEDIO: 'Proximo ao ponto medio',
  ACIMA_DO_PONTO_MEDIO: 'Acima do ponto medio',
  PROXIMO_AO_TETO: 'Proximo ao teto',
  ACIMA_DA_FAIXA: 'Acima da faixa',
  SEM_TABELA: 'Sem tabela',
  PENDENTE_ANALISE: 'Pendente de analise',
};

export const DESCRIPTION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  IN_REVIEW: 'Em revisao',
  ADJUSTMENTS_REQUESTED: 'Ajustes solicitados',
  IN_APPROVAL: 'Em aprovacao',
  APPROVED: 'Aprovada',
  PUBLISHED: 'Publicada',
  REPLACED: 'Substituida',
  INACTIVE: 'Inativa',
};

// Transicoes de workflow de descricao (espelha DESCRIPTION_TRANSITIONS do backend).
export const DESCRIPTION_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['IN_REVIEW', 'INACTIVE'],
  IN_REVIEW: ['ADJUSTMENTS_REQUESTED', 'IN_APPROVAL'],
  ADJUSTMENTS_REQUESTED: ['DRAFT', 'IN_REVIEW'],
  IN_APPROVAL: ['APPROVED', 'ADJUSTMENTS_REQUESTED'],
  APPROVED: ['PUBLISHED', 'INACTIVE'],
  PUBLISHED: ['REPLACED', 'INACTIVE'],
  REPLACED: ['INACTIVE'],
  INACTIVE: ['DRAFT'],
};

export const JOB_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  DRAFT: 'Rascunho',
};

export const TABLE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  PUBLISHED: 'Publicada',
  ARCHIVED: 'Arquivada',
};

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  ADMISSAO: 'Admissão',
  PROMOCAO: 'Promoção',
  MERITO: 'Mérito',
  ENQUADRAMENTO: 'Enquadramento',
  TRANSFERENCIA_AREA: 'Transferência de área',
  ALTERACAO_CARGO: 'Alteração de cargo',
  ALTERACAO_FAIXA: 'Alteração de faixa',
  DESLIGAMENTO: 'Desligamento',
};

export const MOVEMENT_STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'Solicitada',
  PENDING_BUDGET: 'Pendente de orçamento',
  IN_APPROVAL: 'Em aprovação',
  APPROVED: 'Aprovada',
  SCHEDULED: 'Agendada',
  REJECTED: 'Rejeitada',
  APPLIED: 'Aplicada',
  CANCELLED: 'Cancelada',
};

// Tons para StatusBadge (verde/amarelo/vermelho/azul/cinza).
export function movementStatusTone(status: string): 'green' | 'yellow' | 'red' | 'blue' | 'gray' {
  if (status === 'APPLIED' || status === 'APPROVED') return 'green';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'red';
  if (status === 'REQUESTED' || status === 'PENDING_BUDGET' || status === 'IN_APPROVAL') return 'yellow';
  if (status === 'SCHEDULED') return 'blue';
  return 'gray';
}

export const SIMULATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  IN_REVIEW: 'Em análise',
  APPROVED: 'Aprovada',
  APPLIED: 'Aplicada',
  ARCHIVED: 'Arquivada',
};

export const SCENARIO_LABELS: Record<string, string> = {
  MERITO: 'Mérito',
  ENQUADRAMENTO: 'Enquadramento',
  PROMOCAO: 'Promoção',
  HEADCOUNT: 'Headcount',
  REESTRUTURACAO: 'Reestruturação',
};
