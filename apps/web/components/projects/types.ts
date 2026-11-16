import type { ProjectCurve as ProjectCurveData } from '@g360/shared';

export type ProjectStatus = 'PLANNED' | 'IN_PROGRESS' | 'ON_HOLD' | 'DONE' | 'CANCELLED';
export type ProjectPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type PmoStatus = 'ON_TRACK' | 'AT_RISK' | 'CRITICAL' | 'FINALIZED';
export type ProjectHealth = 'GREEN' | 'YELLOW' | 'RED';
export type ProjectCostKind = 'PLANNED' | 'ACTUAL';
export type ProjectRiskKind = 'RISK' | 'ISSUE';
export type ProjectRiskStatus = 'OPEN' | 'MITIGATING' | 'RESOLVED' | 'ACCEPTED';

export interface PersonOption {
  id: string;
  name: string;
  jobTitle: string | null;
}

export interface IndicatorOption {
  id: string;
  name: string;
  code: string | null;
  unit: string;
  unitLabel: string | null;
  direction: 'HIGHER_BETTER' | 'LOWER_BETTER';
  ownerNodeId?: string;
}

export interface ProjectOptions {
  people: PersonOption[];
  indicators: IndicatorOption[];
  categories: string[];
}

export interface ProjectFinance {
  budget: number | null;
  plannedCost: number;
  actualCost: number;
  balance: number | null;
  consumedPct: number | null;
  overBudget: boolean;
}

/** Campos comuns à lista e ao detalhe. */
export interface ProjectBase {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  category: string | null;
  sponsor: string | null;
  startsAt: string | null;
  endsAt: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
  responsible: string | null;
  managerId: string | null;
  manager: { id: string; name: string; jobTitle?: string | null } | null;
  budget: number | null;
  objective: string | null;
  justification: string | null;
  scope: string | null;
  outOfScope: string | null;
  assumptions: string | null;
  benefits: string | null;
  lessonsLearned: string | null;
  indicatorId: string | null;
  progressOverall: number;
  expectedProgress: number | null;
  scheduleVariance: number | null;
  pmoStatus: PmoStatus;
  milestonesDone: number;
  milestonesOverdue: number;
  tasksOverdue: number;
  finance: ProjectFinance;
  openRisks: number;
  openIssues: number;
  latestHealth: ProjectHealth | null;
}

export interface ProjectSummary extends ProjectBase {
  indicator: {
    id: string;
    name: string;
    code: string | null;
    unit: string;
    unitLabel: string | null;
    direction: 'HIGHER_BETTER' | 'LOWER_BETTER';
    results: { value: number; light: string; attainment: number | null; periodRef: string }[];
  } | null;
  _count: { tasks: number; milestones: number };
}

/** Resumo consolidado de `GET /projects/portfolio` (mesmos filtros da lista). */
export interface PortfolioSummary {
  totalProjects: number;
  activeProjects: number;
  statusCounts: Record<ProjectStatus, number>;
  priorityCounts: Record<ProjectPriority, number>;
  budgetTotal: number;
  activeBudget: number;
  actualCost: number;
  plannedCost: number;
  overBudget: number;
  avgProgress: number;
  milestonesTotal: number;
  milestonesDone: number;
  milestonesOverdue: number;
  tasksTotal: number;
  tasksOverdue: number;
  openRisks: number;
  openIssues: number;
  behindSchedule: number;
  criticalProjects: Array<{
    id: string;
    code: string | null;
    name: string;
    status: ProjectStatus;
    pmoStatus: PmoStatus;
    responsible: string | null;
    endsAt: string | null;
    progressOverall: number;
    expectedProgress: number | null;
    scheduleVariance: number | null;
    milestonesOverdue: number;
    tasksOverdue: number;
    indicator: { id: string; name: string; code: string | null } | null;
  }>;
}

export interface ProjectMilestone {
  id: string;
  name: string;
  description: string | null;
  dueDate: string;
  done: boolean;
  completedAt: string | null;
}

export interface ProjectTask {
  id: string;
  name: string;
  description: string | null;
  phase: string | null;
  startDate: string | null;
  endDate: string | null;
  progress: number;
  responsible: string | null;
  assigneeId: string | null;
  assignee: { id: string; name: string } | null;
  dependencyId: string | null;
  dependency: { id: string; name: string } | null;
  completedAt: string | null;
  position: number;
}

export interface ProjectMember {
  id: string;
  userId: string | null;
  user: { id: string; name: string; jobTitle: string | null } | null;
  name: string;
  role: string | null;
  allocation: number | null;
}

export interface ProjectCost {
  id: string;
  kind: ProjectCostKind;
  description: string;
  category: string | null;
  amount: number;
  date: string;
  notes: string | null;
}

export interface ProjectRisk {
  id: string;
  kind: ProjectRiskKind;
  title: string;
  description: string | null;
  probability: number;
  impact: number;
  response: string | null;
  ownerId: string | null;
  ownerName: string | null;
  dueDate: string | null;
  status: ProjectRiskStatus;
  resolvedAt: string | null;
  createdAt: string;
}

export interface ProjectUpdate {
  id: string;
  authorName: string;
  health: ProjectHealth;
  reportDate: string;
  summary: string;
  achievements: string | null;
  nextSteps: string | null;
  blockers: string | null;
  progress: number;
  createdAt: string;
}

export interface LinkedIndicator {
  id: string;
  name: string;
  code: string | null;
  unit: string;
  unitLabel: string | null;
  direction: 'HIGHER_BETTER' | 'LOWER_BETTER';
  ownerNode: { id: string; name: string } | null;
  results: { id: string; periodRef: string; value: number; light: string; attainment: number | null }[];
}

export interface ProjectDetail extends ProjectBase {
  indicator: LinkedIndicator | null;
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  members: ProjectMember[];
  costs: ProjectCost[];
  projectRisks: ProjectRisk[];
  updates: ProjectUpdate[];
  curve: ProjectCurveData;
}

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNED: 'Planejado',
  IN_PROGRESS: 'Em andamento',
  ON_HOLD: 'Pausado',
  DONE: 'Concluído',
  CANCELLED: 'Cancelado',
};

export const STATUS_PILL: Record<ProjectStatus, string> = {
  PLANNED: 'pill-gray',
  IN_PROGRESS: 'pill-blue',
  ON_HOLD: 'pill-yellow',
  DONE: 'pill-green',
  CANCELLED: 'pill-gray',
};

export const STATUS_ORDER: ProjectStatus[] = ['PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'DONE', 'CANCELLED'];

export const PRIORITY_LABEL: Record<ProjectPriority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export const PRIORITY_PILL: Record<ProjectPriority, string> = {
  LOW: 'pill-gray',
  MEDIUM: 'pill-blue',
  HIGH: 'pill-yellow',
  CRITICAL: 'pill-red',
};

export const PRIORITY_ORDER: ProjectPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const PMO_LABEL: Record<PmoStatus, string> = {
  ON_TRACK: 'No prazo',
  AT_RISK: 'Em risco',
  CRITICAL: 'Crítico',
  FINALIZED: 'Finalizado',
};

export const PMO_CLASS: Record<PmoStatus, string> = {
  ON_TRACK: 'pill-green',
  AT_RISK: 'pill-yellow',
  CRITICAL: 'pill-red',
  FINALIZED: 'pill-gray',
};

export const HEALTH_LABEL: Record<ProjectHealth, string> = {
  GREEN: 'No controle',
  YELLOW: 'Atenção',
  RED: 'Crítico',
};

export const HEALTH_PILL: Record<ProjectHealth, string> = {
  GREEN: 'pill-green',
  YELLOW: 'pill-yellow',
  RED: 'pill-red',
};

export const RISK_KIND_LABEL: Record<ProjectRiskKind, string> = {
  RISK: 'Risco',
  ISSUE: 'Impedimento',
};

export const RISK_STATUS_LABEL: Record<ProjectRiskStatus, string> = {
  OPEN: 'Aberto',
  MITIGATING: 'Em tratamento',
  RESOLVED: 'Resolvido',
  ACCEPTED: 'Aceito',
};

export const RISK_STATUS_PILL: Record<ProjectRiskStatus, string> = {
  OPEN: 'pill-red',
  MITIGATING: 'pill-yellow',
  RESOLVED: 'pill-green',
  ACCEPTED: 'pill-gray',
};

export const COST_KIND_LABEL: Record<ProjectCostKind, string> = {
  PLANNED: 'Previsto',
  ACTUAL: 'Realizado',
};

/** Datas do projeto são dias de calendário gravados em UTC: formatar em UTC evita voltar um dia. */
const dayFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

export function formatDay(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? dayFormatter.format(date) : '—';
}

/** Valor para <input type="date"> a partir da data ISO da API. */
export function toDateInput(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

/** Dia de hoje (calendário local do usuário) no formato AAAA-MM-DD. */
export function todayInput(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Um prazo só vence depois que o dia termina. */
export function isOverdue(value: string | null | undefined): boolean {
  return Boolean(value) && toDateInput(value) < todayInput();
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/** Converte o valor de um campo numérico; vazio ou inválido vira null. */
export function parseAmount(text: string): number | null {
  if (!text.trim()) return null;
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function taskStatusLabel(progress: number): string {
  if (progress >= 100) return 'Concluída';
  if (progress > 0) return 'Em andamento';
  return 'A fazer';
}

export function riskScore(risk: Pick<ProjectRisk, 'probability' | 'impact'>): number {
  return risk.probability * risk.impact;
}

export function riskLevel(score: number): { label: string; pill: string } {
  if (score >= 15) return { label: 'Alto', pill: 'pill-red' };
  if (score >= 8) return { label: 'Médio', pill: 'pill-yellow' };
  return { label: 'Baixo', pill: 'pill-green' };
}

export function isOpenRisk(status: ProjectRiskStatus): boolean {
  return status === 'OPEN' || status === 'MITIGATING';
}
