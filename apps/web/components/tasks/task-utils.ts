import type { TaskRecord } from './task-types';

export const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export const PRIORITY_CLASS: Record<string, string> = {
  LOW: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  MEDIUM: 'border-amber-200 bg-amber-50 text-amber-700',
  HIGH: 'border-orange-200 bg-orange-50 text-orange-700',
  CRITICAL: 'border-rose-300 bg-rose-50 text-rose-700',
};

export const STATUS_LABEL: Record<string, string> = {
  IDEA: 'Ideias',
  TODO: 'A Fazer',
  IN_PROGRESS: 'Executando',
  REVIEW: 'Revisão',
  DONE: 'Realizado',
};

export const STICKY_CLASS: Record<string, string> = {
  yellow: 'border-amber-200/80 bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-950/70 dark:to-yellow-950/60',
  blue: 'border-sky-200/80 bg-gradient-to-br from-sky-50 to-blue-100 dark:from-sky-950/70 dark:to-blue-950/60',
  green: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-950/70 dark:to-green-950/60',
  pink: 'border-pink-200/80 bg-gradient-to-br from-pink-50 to-rose-100 dark:from-pink-950/70 dark:to-rose-950/60',
  lilac: 'border-violet-200/80 bg-gradient-to-br from-violet-50 to-purple-100 dark:from-violet-950/70 dark:to-purple-950/60',
  peach: 'border-orange-200/80 bg-gradient-to-br from-orange-50 to-red-100 dark:from-orange-950/70 dark:to-red-950/60',
};

export const ORIGIN_OPTIONS = [
  ['INDICATOR', 'Indicadores'],
  ['NONCONFORMITY', 'Não Conformidades'],
  ['AUDIT', 'Auditorias'],
  ['DOCUMENT', 'Documentos'],
  ['FORM', 'Formulários'],
  ['CHECKLIST', 'Checklists'],
  ['RISK', 'Riscos'],
  ['ACTION_PLAN', 'Planos de Ação'],
  ['MEETING', 'Reuniões'],
  ['PROCESS', 'Processos'],
  ['COMMUNICATION', 'Comunicação'],
  ['PROJECT', 'Cronogramas'],
  ['WORKFLOW_TASK', 'Automações'],
] as const;

export function taskIsOverdue(task: TaskRecord) {
  return Boolean(task.status !== 'DONE' && task.dueDate && new Date(task.dueDate).getTime() < Date.now());
}

export function initials(name?: string | null) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function checklistProgress(task: TaskRecord) {
  const items = task.checklistItems ?? [];
  if (!items.length) return 0;
  return Math.round((items.filter((item) => item.isDone).length / items.length) * 100);
}

export function inputDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
