'use client';

import {
  Activity,
  Bot,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Gauge,
  ScanSearch,
  UserRound,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { TaskSummary } from './task-types';

const ITEMS = [
  { key: 'total', label: 'Total de tarefas', icon: ClipboardList, tone: 'text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-200' },
  { key: 'mine', label: 'Minhas tarefas', icon: UserRound, tone: 'text-blue-700 bg-blue-100 dark:bg-blue-950 dark:text-blue-200' },
  { key: 'automatic', label: 'Automáticas', icon: Bot, tone: 'text-violet-700 bg-violet-100 dark:bg-violet-950 dark:text-violet-200' },
  { key: 'overdue', label: 'Atrasadas', icon: Clock3, tone: 'text-rose-700 bg-rose-100 dark:bg-rose-950 dark:text-rose-200' },
  { key: 'executing', label: 'Executando', icon: Activity, tone: 'text-sky-700 bg-sky-100 dark:bg-sky-950 dark:text-sky-200' },
  { key: 'review', label: 'Em revisão', icon: ScanSearch, tone: 'text-pink-700 bg-pink-100 dark:bg-pink-950 dark:text-pink-200' },
  { key: 'done', label: 'Realizadas', icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-200' },
] as const;

export function TaskSummaryCards({ summary }: { summary: TaskSummary }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-8">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.key} className="rounded-xl border border-border/70 bg-card p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className={cn('grid h-8 w-8 place-items-center rounded-lg', item.tone)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xl font-semibold tracking-tight">{summary[item.key]}</span>
            </div>
            <p className="mt-2 truncate text-[11px] font-medium text-muted-foreground">{item.label}</p>
          </div>
        );
      })}
      <div className="rounded-xl border border-border/70 bg-card p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-200">
            <Gauge className="h-4 w-4" />
          </div>
          <span className="text-xl font-semibold tracking-tight">{summary.progress}%</span>
        </div>
        <Progress value={summary.progress} className="mt-2.5 h-1.5" />
        <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">Progresso geral</p>
      </div>
    </div>
  );
}
