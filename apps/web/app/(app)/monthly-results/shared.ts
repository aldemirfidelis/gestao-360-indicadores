import { formatNumber, formatPercent, periodRefLabel } from '@/lib/utils';
import { LIGHT_LABEL, LIGHT_COLORS, LIGHT_STYLES, type UiLight } from '@/lib/farol';

// Farol: regra de cálculo e tokens de apresentação vivem em lib/farol.ts
// (fonte única, Épico 2). Aliases mantidos para os consumidores do módulo.
export type Light = UiLight;
export { LIGHT_LABEL, LIGHT_COLORS, LIGHT_STYLES };

export type MonthlyStatus = 'PREPARING' | 'READY' | 'IN_PROGRESS' | 'CLOSED' | 'REOPENED' | 'CANCELLED';

export const STATUS_STYLES: Record<string, string> = {
  PREPARING: 'border-slate-200 bg-slate-50 text-slate-700',
  READY: 'border-blue-200 bg-blue-50 text-blue-700',
  IN_PROGRESS: 'border-amber-200 bg-amber-50 text-amber-700',
  CLOSED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  REOPENED: 'border-violet-200 bg-violet-50 text-violet-700',
  CANCELLED: 'border-red-200 bg-red-50 text-red-700',
};

export type Readiness = 'NOT_STARTED' | 'IN_PROGRESS' | 'WITH_ISSUES' | 'READY_FOR_VALIDATION' | 'VALIDATED' | 'RELEASED';

export const READINESS_STYLES: Record<string, string> = {
  NOT_STARTED: 'border-slate-200 bg-slate-50 text-slate-600',
  IN_PROGRESS: 'border-blue-200 bg-blue-50 text-blue-700',
  WITH_ISSUES: 'border-amber-200 bg-amber-50 text-amber-700',
  READY_FOR_VALIDATION: 'border-violet-200 bg-violet-50 text-violet-700',
  VALIDATED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  RELEASED: 'border-emerald-300 bg-emerald-100 text-emerald-800',
};

export interface AreaOption {
  id: string;
  parentId: string | null;
  name: string;
  type: string;
  responsibleUserId?: string | null;
}

export interface UserOption {
  id: string;
  name: string;
  email: string;
  jobTitle?: string | null;
  defaultNodeId?: string | null;
}

export interface IndicatorOption {
  id: string;
  name: string;
  code: string | null;
  ownerNodeId: string;
}

export interface MonthlyOptions {
  currentPeriodRef: string;
  areaOptions: AreaOption[];
  users: UserOption[];
  indicators: IndicatorOption[];
  internalAreaScript: Array<{ block: string; plannedMinutes: number }>;
  weeklyRoutine: Array<{ level: string; focus: string[] }>;
  governance: string[];
  ai: { enabled: boolean; provider: string; model: string | null };
}

export interface CardIndicator {
  id: string;
  indicatorId: string;
  name: string;
  code: string | null;
  unit: string;
  unitLabel: string;
  area: string;
  areaId: string;
  responsible: { id: string; name: string } | null;
  target: number | null;
  current: number | null;
  accumulated: number | null;
  attainment: number | null;
  deviationPct: number | null;
  light: Light;
  trend: string;
  rootCause: string | null;
  actionTitle: string | null;
  validationIssues: string[];
  links: { indicator: string; deviation: string | null; action: string | null };
}

export interface MonthlyDashboard {
  periodRef: string;
  meetings: Array<{
    id: string;
    title: string;
    periodRef: string;
    status: MonthlyStatus;
    startsAt: string;
    endsAt: string | null;
    location: string | null;
    keyMessage: string | null;
    counts: { areas: number; decisions: number; participants: number; indicators: number };
    readiness: { total: number; ready: number; issues: number };
  }>;
  currentMeeting: { id: string; title: string; startsAt: string; status: string } | null;
  nextMeeting: { id: string; title: string; startsAt: string } | null;
  metrics: {
    meetingsInPeriod: number;
    participantAreas: number;
    indicatorsGreen: number;
    indicatorsYellow: number;
    indicatorsRed: number;
    indicatorsGray: number;
    indicatorsAtRisk: number;
    overdueActions: number;
    doneActions: number;
    openActions: number;
    pendingDecisions: number;
    openEscalations: number;
    areasWithoutUpdate: number;
    areasReady: number;
    nextMonthlyMeeting: string | null;
  };
  executivePanel: { lights: Record<Light, number>; keyMessageDraft: string; macroIndicators: CardIndicator[] };
  areas: Array<{ id: string; name: string; type: string; totalIndicators: number; green: number; yellow: number; red: number; gray: number; readiness: string }>;
  indicators: CardIndicator[];
  criticalIndicators: CardIndicator[];
  weeklyRoutine: Array<{ level: string; focus: string[] }>;
  governance: string[];
}

// ---- Meeting detail ----

export interface SnapshotIndicator {
  id: string;
  indicatorId: string;
  name: string;
  code: string | null;
  unit: string | null;
  unitLabel: string;
  source: string | null;
  area?: string;
  target: number | null;
  lowerBound: number | null;
  upperBound: number | null;
  current: number | null;
  accumulated: number | null;
  accumulatedTarget: number | null;
  accumulatedAttainment: number | null;
  attainment: number | null;
  deviationPct: number | null;
  direction?: string | null;
  light: Light;
  trend: string | null;
  managerComment: string | null;
  trendNote: string | null;
  executiveStatus: string | null;
  showInPresentation: boolean;
  isCritical: boolean;
  financialImpact: number | null;
  responsibleUserId: string | null;
  deviationId: string | null;
  actionPlanId: string | null;
  rootCause: string | null;
  actionTitle: string | null;
  linkedAction: { id: string; title: string; status: string; progress: number } | null;
  linkedDeviation: { id: string; number: number; title: string; status: string; rootCause: string | null } | null;
  validationIssues: string[];
  blockingIssues: string[];
  links: { indicator: string; deviation: string | null; action: string | null };
}

export interface MeetingArea {
  id: string;
  orgNodeId: string;
  name: string;
  type: string;
  position: number;
  readiness: Readiness;
  readinessLabel: string;
  presenter: { id: string; name: string } | null;
  areaKeyMessage: string | null;
  validatedAt: string | null;
  totalIndicators: number;
  green: number;
  yellow: number;
  red: number;
  gray: number;
  validationIssues: Array<{ indicatorId: string; indicator: string; issue: string }>;
  blockingIssues: Array<{ indicatorId: string; indicator: string; issue: string }>;
  canValidate: boolean;
  indicators: SnapshotIndicator[];
}

export interface AgendaItem {
  id: string;
  orgNodeId: string | null;
  topic: string;
  position: number;
  plannedMinutes: number;
  actualMinutes: number | null;
  presentationStatus: 'PENDING' | 'PRESENTING' | 'DISCUSSED' | 'SKIPPED';
  startedAt: string | null;
  endedAt: string | null;
  presenter: { id: string; name: string } | null;
  notes: string | null;
}

export interface DecisionEntry {
  id: string;
  kind: 'DECISION' | 'RISK' | 'ESCALATION' | 'PENDING';
  topic: string | null;
  description: string;
  orgNodeId: string | null;
  ownerName: string | null;
  owner: string | null;
  ownerUserId: string | null;
  dueDate: string | null;
  impactIfNotDecided: string | null;
  boardInvolved: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  actionPlanId: string | null;
  action: { id: string; title: string; status: string } | null;
}

export interface FollowUpEntry {
  id: string;
  level: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  title: string;
  dueDate: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  ownerUserId: string | null;
  owner: { id: string; name: string } | null;
  indicatorId: string | null;
  actionPlanId: string | null;
  action: { id: string; title: string; status: string } | null;
  notes: string | null;
}

export interface LearningEntry {
  id: string;
  learning: string;
  treatedCause: string | null;
  effectiveAction: string | null;
  replicateToNodeId: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
}

export interface StandardizationEntry {
  id: string;
  type: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
}

export interface ChecklistEntry {
  id: string;
  label: string;
  done: boolean;
  autoRule: string | null;
  severity: string | null;
}

export interface MeetingDetail {
  id: string;
  title: string;
  periodRef: string;
  cropSeason: string | null;
  cycleName: string | null;
  status: MonthlyStatus;
  statusLabel: string;
  format: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  objective: string | null;
  assumptions: string | null;
  criticalRisks: string | null;
  boardDirections: string | null;
  generalNotes: string | null;
  keyMessage: string | null;
  nextMonthlyAt: string | null;
  nextWeeklyAt: string | null;
  closedAt: string | null;
  responsible: { id: string; name: string } | null;
  secretary: { id: string; name: string } | null;
  followUp: { id: string; name: string } | null;
  participants: Array<{ id: string; userId: string; role: string; attended: boolean; user: { id: string; name: string } | null }>;
  areas: MeetingArea[];
  agendaItems: AgendaItem[];
  decisions: DecisionEntry[];
  followUps: FollowUpEntry[];
  learnings: LearningEntry[];
  standardizations: StandardizationEntry[];
  checklist: ChecklistEntry[];
  attachments: Array<{ id: string; fileName: string; fileUrl: string }>;
  summary: { lights: Record<Light, number>; totalIndicators: number; critical: number; areasReady: number; openDecisions: number };
  internalAreaScript: Array<{ block: string; plannedMinutes: number }>;
  weeklyRoutine: Array<{ level: string; focus: string[] }>;
  governance: string[];
  ai: { enabled: boolean; provider: string; model: string | null };
}

export function decisionOutputHeader(meeting: Pick<MeetingDetail, 'periodRef' | 'title'>) {
  const title = meeting.title.trim();
  if (!title) return `Saídas e Ações da Reunião Mensal ${periodRefLabel(meeting.periodRef)}`;

  const normalizedTitle = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalizedTitle.startsWith('saidas e acoes')) return title;
  if (normalizedTitle.includes('reuniao')) return `Saídas e Ações da ${title}`;
  return `Saídas e Ações da Reunião ${title}`;
}

export const ENTRY_KIND_LABEL: Record<string, string> = {
  DECISION: 'Decisão',
  RISK: 'Risco',
  ESCALATION: 'Escalonamento',
  PENDING: 'Pendência',
};

export const ITEM_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluído',
  CANCELLED: 'Cancelado',
};

export const FOLLOWUP_LEVEL_LABEL: Record<string, string> = {
  DAILY: 'Diário / turno',
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
};

export const STANDARDIZATION_TYPES: Array<{ value: string; label: string }> = [
  { value: 'POP', label: 'Atualizar POP' },
  { value: 'WORK_INSTRUCTION', label: 'Atualizar instrução de trabalho' },
  { value: 'RISK_MATRIX', label: 'Atualizar matriz de risco' },
  { value: 'CHECKLIST', label: 'Atualizar checklist' },
  { value: 'TRAINING', label: 'Criar treinamento' },
  { value: 'VISUAL_MANAGEMENT', label: 'Atualizar gestão à vista' },
  { value: 'AUDIT', label: 'Criar auditoria de verificação' },
  { value: 'BEST_PRACTICE', label: 'Replicar boa prática' },
  { value: 'LEARNING_BANK', label: 'Registrar no banco de aprendizados' },
];

export function defaultPeriodRef() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Rótulos de "quantidade" não são anexados ao valor (poluem o card) — mostra só o número.
const QUANTITY_LABELS = /^(quantidade|qtd|qtde|un|und|unid|unidade|unidades|nº|numero|número)$/i;

export function formatValue(value: number | null | undefined, unitLabel?: string | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (unitLabel === '%') return formatPercent(value > 1 ? value / 100 : value);
  const label = (unitLabel ?? '').trim();
  const showLabel = label && label !== 'personalizado' && !QUANTITY_LABELS.test(label);
  return `${formatNumber(value)}${showLabel ? ` ${label}` : ''}`;
}

export function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}
