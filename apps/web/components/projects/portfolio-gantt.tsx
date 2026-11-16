'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PMO_LABEL, formatDay, type PmoStatus } from './types';

export interface PortfolioGanttItem {
  id: string;
  name: string;
  code?: string | null;
  startsAt: string | null;
  endsAt: string | null;
  progressOverall: number;
  pmoStatus: PmoStatus;
}

const TRACK: Record<PmoStatus, string> = {
  ON_TRACK: 'bg-sky-300 dark:bg-sky-900',
  AT_RISK: 'bg-amber-300 dark:bg-amber-900',
  CRITICAL: 'bg-rose-300 dark:bg-rose-900',
  FINALIZED: 'bg-slate-300 dark:bg-slate-700',
};

const FILL: Record<PmoStatus, string> = {
  ON_TRACK: 'bg-sky-500',
  AT_RISK: 'bg-amber-500',
  CRITICAL: 'bg-rose-500',
  FINALIZED: 'bg-slate-500',
};

/** Datas do portfólio são dias de calendário gravados em UTC. */
function dayTime(value: string): number {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function buildTimeline(projects: PortfolioGanttItem[]) {
  const dated = projects.filter((project): project is PortfolioGanttItem & { startsAt: string; endsAt: string } => Boolean(project.startsAt && project.endsAt));
  if (!dated.length) return null;
  const start = Math.min(...dated.map((project) => dayTime(project.startsAt)));
  const end = Math.max(...dated.map((project) => dayTime(project.endsAt)));
  const total = Math.max(1, end - start);
  const rows = dated.map((project) => {
    const itemStart = dayTime(project.startsAt);
    const itemEnd = Math.max(itemStart, dayTime(project.endsAt));
    const left = ((itemStart - start) / total) * 100;
    const width = Math.max(1, ((itemEnd - itemStart) / total) * 100);
    return { project, left, width: Math.min(100 - left, width) };
  });
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    start,
    end,
    rows,
    todayPct: today >= start && today <= end ? ((today - start) / total) * 100 : null,
    undated: projects.length - dated.length,
  };
}

/** Gantt do portfólio: uma barra por projeto, preenchida pelo avanço e colorida pela situação PMO. */
export function PortfolioGantt({ projects }: { projects: PortfolioGanttItem[] }) {
  const timeline = buildTimeline(projects);
  if (!timeline) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
        Informe as datas de início e fim dos projetos para gerar o Gantt.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border bg-muted/20 p-3">
        <div className="min-w-[620px] space-y-2">
          <div className="grid grid-cols-[190px,1fr] items-center gap-3 text-[10px] font-semibold text-muted-foreground">
            <span>Projeto</span>
            <div className="flex justify-between">
              <span>{formatDay(new Date(timeline.start).toISOString())}</span>
              <span>{formatDay(new Date(timeline.end).toISOString())}</span>
            </div>
          </div>
          {timeline.rows.map(({ project, left, width }) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="grid grid-cols-[190px,1fr] items-center gap-3 rounded-md px-1 py-1.5 hover:bg-muted/50"
            >
              <span className="truncate text-xs font-medium" title={project.name}>
                {project.code ? <span className="mr-1 text-muted-foreground">{project.code}</span> : null}
                {project.name}
              </span>
              <div className="relative h-6 rounded bg-muted">
                <div
                  className={cn('absolute top-1 h-4 min-w-2 overflow-hidden rounded', TRACK[project.pmoStatus])}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${formatDay(project.startsAt)} a ${formatDay(project.endsAt)} · ${project.progressOverall}% concluído · ${PMO_LABEL[project.pmoStatus]}`}
                >
                  <div className={cn('h-full', FILL[project.pmoStatus])} style={{ width: `${Math.min(100, Math.max(0, project.progressOverall))}%` }} />
                </div>
                {timeline.todayPct !== null && (
                  <div className="absolute inset-y-0 w-px bg-foreground/60" style={{ left: `${timeline.todayPct}%` }} title="Hoje" />
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {(['ON_TRACK', 'AT_RISK', 'CRITICAL', 'FINALIZED'] as PmoStatus[]).map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span className={cn('h-2.5 w-2.5 rounded-sm', FILL[status])} /> {PMO_LABEL[status]}
          </span>
        ))}
        <span>A parte escura da barra é o avanço; a linha vertical marca hoje.</span>
        {timeline.undated > 0 && <span>{timeline.undated} projeto(s) sem datas ficam fora do Gantt.</span>}
      </div>
    </div>
  );
}
