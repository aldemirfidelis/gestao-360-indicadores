import Link from 'next/link';
import { CalendarClock, Flag, UserRound } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/platform/status-badge';
import { cn, formatDate } from '@/lib/utils';

export interface ActionPlanCardData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  origin: string;
  dueDate: string | null;
  progress: number;
  responsibleUser: { id: string; name: string } | null;
  ownerNode: { id: string; name: string } | null;
}

const priorityLabel: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

const priorityTone: Record<string, string> = {
  LOW: 'border-l-status-gray',
  MEDIUM: 'border-l-status-blue',
  HIGH: 'border-l-status-yellow',
  CRITICAL: 'border-l-status-red',
};

export function ActionPlanCard({ action, href = true }: { action: ActionPlanCardData; href?: boolean }) {
  const isOverdue =
    action.dueDate &&
    new Date(action.dueDate) < new Date() &&
    action.status !== 'DONE' &&
    action.status !== 'DONE_LATE' &&
    action.status !== 'CANCELLED' &&
    action.status !== 'EFFECTIVE';

  const body = (
    <article className={cn('panel panel-hover h-full border-l-4 p-4', priorityTone[action.priority])}>
      <div className="flex items-start justify-between gap-3">
        <StatusBadge value={action.status} label={statusLabel(action.status)} />
        <span className={cn('text-xs font-semibold', isOverdue && 'text-status-red')}>{action.progress}%</span>
      </div>
      <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug">{action.title}</h3>
      {action.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{action.description}</p>}
      <Progress value={action.progress} className="mt-3 h-1.5" />
      <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <UserRound className="h-3.5 w-3.5" />
          <span className="truncate">{action.responsibleUser?.name ?? 'Sem responsável'}</span>
        </div>
        <div className={cn('flex items-center gap-2', isOverdue && 'font-medium text-status-red')}>
          <CalendarClock className="h-3.5 w-3.5" />
          <span>{formatDate(action.dueDate)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Flag className="h-3.5 w-3.5" />
          <span>{priorityLabel[action.priority] ?? action.priority} - {action.ownerNode?.name ?? action.origin}</span>
        </div>
      </div>
    </article>
  );

  if (!href) return body;

  return (
    <Link href={`/actions/${action.id}`} className="block h-full">
      {body}
    </Link>
  );
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    DRAFT: 'Rascunho',
    NOT_STARTED: 'Não iniciada',
    UNDER_ANALYSIS: 'Em análise',
    IN_PROGRESS: 'Em andamento',
    WAITING_THIRD: 'Aguardando',
    WAITING_EVIDENCE: 'Aguardando evidencia',
    WAITING_VALIDATION: 'Aguardando validação',
    PAUSED: 'Pausada',
    DONE: 'Concluida',
    DONE_LATE: 'Concluida tarde',
    CANCELLED: 'Cancelada',
    REOPENED: 'Reaberta',
    INEFFECTIVE: 'Ineficaz',
    EFFECTIVE: 'Eficaz',
  };
  return map[status] ?? status;
}
