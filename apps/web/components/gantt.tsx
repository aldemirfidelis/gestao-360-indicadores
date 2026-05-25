'use client';

import { useMemo } from 'react';
import { differenceInDays, eachMonthOfInterval, format, max, min } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface GanttTask {
  id: string;
  name: string;
  startDate: string | Date | null;
  endDate: string | Date | null;
  progress: number;
  responsible?: string | null;
  dependencyId?: string | null;
}

interface Props {
  tasks: GanttTask[];
  rowHeight?: number;
  labelWidth?: number;
}

/**
 * Gantt SVG simples mas funcional. Calcula range a partir das tarefas
 * e desenha barras com progresso e ligacoes de dependência.
 */
export function Gantt({ tasks, rowHeight = 38, labelWidth = 220 }: Props) {
  const valid = useMemo(
    () => tasks.filter((t) => t.startDate && t.endDate).map((t) => ({
      ...t,
      _start: new Date(t.startDate as string),
      _end: new Date(t.endDate as string),
    })),
    [tasks],
  );

  if (valid.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Nenhuma tarefa com datas para exibir no Gantt.
      </p>
    );
  }

  const minDate = min(valid.map((t) => t._start));
  const maxDate = max(valid.map((t) => t._end));
  const totalDays = Math.max(1, differenceInDays(maxDate, minDate) + 1);
  const months = eachMonthOfInterval({ start: minDate, end: maxDate });

  const dayPx = 8;
  const chartWidth = totalDays * dayPx;
  const height = (valid.length + 1) * rowHeight;
  const totalWidth = labelWidth + chartWidth + 20;

  const taskY = (i: number) => (i + 1) * rowHeight + rowHeight / 2;
  const dateX = (date: Date) => labelWidth + differenceInDays(date, minDate) * dayPx;
  const today = new Date();
  const todayInRange = today >= minDate && today <= maxDate;

  return (
    <div className="overflow-x-auto">
      <svg width={totalWidth} height={height} className="text-xs">
        {/* eixo de meses */}
        {months.map((m, i) => {
          const x = dateX(m);
          return (
            <g key={i}>
              <line
                x1={x}
                y1={0}
                x2={x}
                y2={height}
                stroke="hsl(var(--border))"
                strokeDasharray="3 3"
              />
              <text x={x + 4} y={rowHeight - 8} fill="hsl(var(--muted-foreground))" fontSize="11">
                {format(m, 'MMM/yy', { locale: ptBR })}
              </text>
            </g>
          );
        })}

        {/* hoje */}
        {todayInRange && (
          <g>
            <line
              x1={dateX(today)}
              y1={rowHeight - 4}
              x2={dateX(today)}
              y2={height}
              stroke="hsl(var(--status-blue))"
              strokeWidth={1.5}
            />
            <text x={dateX(today) + 4} y={rowHeight - 12} fill="hsl(var(--status-blue))" fontSize="10">
              hoje
            </text>
          </g>
        )}

        {/* dependências */}
        {valid.map((t, i) => {
          if (!t.dependencyId) return null;
          const depIdx = valid.findIndex((x) => x.id === t.dependencyId);
          if (depIdx < 0) return null;
          const dep = valid[depIdx];
          const x1 = dateX(dep._end);
          const y1 = taskY(depIdx);
          const x2 = dateX(t._start);
          const y2 = taskY(i);
          return (
            <path
              key={`dep-${t.id}`}
              d={`M${x1},${y1} L${x1 + 8},${y1} L${x1 + 8},${y2} L${x2},${y2}`}
              fill="none"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.2}
              markerEnd="url(#arrow)"
            />
          );
        })}

        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="hsl(var(--muted-foreground))" />
          </marker>
        </defs>

        {/* barras */}
        {valid.map((t, i) => {
          const x = dateX(t._start);
          const w = Math.max(dayPx, (differenceInDays(t._end, t._start) + 1) * dayPx);
          const barH = 18;
          const y = taskY(i) - barH / 2;
          const progressW = (w * Math.max(0, Math.min(100, t.progress))) / 100;
          return (
            <g key={t.id}>
              {/* nome */}
              <text
                x={labelWidth - 10}
                y={taskY(i) + 4}
                textAnchor="end"
                fill="hsl(var(--foreground))"
                fontSize="12"
              >
                {truncate(t.name, 28)}
              </text>
              {/* barra base */}
              <rect x={x} y={y} width={w} height={barH} rx={4} fill="hsl(var(--secondary))" />
              {/* progresso */}
              <rect
                x={x}
                y={y}
                width={progressW}
                height={barH}
                rx={4}
                fill={t.progress >= 100 ? 'hsl(var(--status-green))' : 'hsl(var(--status-blue))'}
              />
              {/* texto */}
              <text x={x + w + 6} y={taskY(i) + 4} fill="hsl(var(--muted-foreground))" fontSize="10">
                {t.responsible ?? ''} - {t.progress}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
