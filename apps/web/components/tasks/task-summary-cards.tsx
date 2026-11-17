'use client';

import { MetricCard } from '@/components/platform/metric-card';
import type { TaskSummary } from './task-types';

export function TaskSummaryCards({ summary }: { summary: TaskSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard compact title="Tarefas" value={summary.total} description={`${summary.mine} minhas · ${summary.automatic} automáticas`} />
      <MetricCard compact title="Atrasadas" value={summary.overdue} tone={summary.overdue > 0 ? 'red' : 'neutral'} />
      <MetricCard compact title="Executando" value={summary.executing} description={`${summary.review} em revisão`} />
      <MetricCard compact title="Progresso geral" value={`${summary.progress}%`} description={`${summary.done} realizadas`} />
    </div>
  );
}
