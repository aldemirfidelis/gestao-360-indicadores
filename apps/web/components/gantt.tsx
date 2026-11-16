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

export interface GanttMilestone {
  id: string;
  name: string;
  dueDate: string | Date;
  done: boolean;
}

interface Props {
  tasks: GanttTask[];
  /** Marcos aparecem como losangos, abaixo das tarefas. */
  milestones?: GanttMilestone[];
  rowHeight?: number;
  labelWidth?: number;
}

/** Datas do cronograma são dias de calendário gravados em UTC; lê o dia sem deslocar o fuso. */
function calendarDay(value: string | Date): Date {
  const date = new Date(value);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Gantt SVG simples mas funcional. Calcula range a partir das tarefas e dos marcos
 * e desenha barras com progresso, ligações de dependência e losangos de marco.
 */
export function Gantt({ tasks, milestones = [], rowHeight = 38, labelWidth = 220 }: Props) {
  const valid = useMemo(
    () => tasks.filter((t) => t.startDate && t.endDate).map((t) => ({
      ...t,
      _start: calendarDay(t.startDate as string | Date),
      _end: calendarDay(t.endDate as string | Date),
    })),
    [tasks],
  );
  const marks = useMemo(
    () => milestones.filter((m) => m.dueDate).map((m) => ({ ...m, _due: calendarDay(m.dueDate) })),
    [milestones],
  );

  if (valid.length === 0 && marks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Nenhuma tarefa com datas nem marco para exibir no Gantt.
      </p>
    );
  }

  const minDate = min([...valid.map((t) => t._start), ...marks.map((m) => m._due)]);
  const maxDate = max([...valid.map((t) => t._end), ...marks.map((m) => m._due)]);
  const totalDays = Math.max(1, differenceInDays(maxDate, minDate) + 1);
  const months = eachMonthOfInterval({ start: minDate, end: maxDate });

  const dayPx = 8;
  const chartWidth = totalDays * dayPx;
  const rows = valid.length + marks.length;
  const height = (rows + 1) * rowHeight;
  const totalWidth = labelWidth + chartWidth + 160;

  const rowY = (i: number) => (i + 1) * rowHeight + rowHeight / 2;
  const dateX = (date: Date) => labelWidth + differenceInDays(date, minDate) * dayPx;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayInRange = today >= minDate && today <= maxDate;

  return (
    <div className="overflow-x-auto">
      <svg width={totalWidth} height={height} className="text-xs" role="img" aria-label="Gráfico de Gantt do cronograma">
        {/* eixo de meses */}
        {months.map((m, i) => {
          const x = Math.max(labelWidth, dateX(m));
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
            <text x={dateX(today) + 4} y={12} fill="hsl(var(--status-blue))" fontSize="10">
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
          const x1 = dateX(dep._end) + dayPx;
          const y1 = rowY(depIdx);
          const x2 = dateX(t._start);
          const y2 = rowY(i);
          return (
            <path
              key={`dep-${t.id}`}
              d={`M${x1},${y1} L${x1 + 8},${y1} L${x1 + 8},${y2} L${x2},${y2}`}
              fill="none"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.2}
              markerEnd="url(#gantt-arrow)"
            />
          );
        })}

        <defs>
          <marker id="gantt-arrow" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="hsl(var(--muted-foreground))" />
          </marker>
        </defs>

        {/* barras */}
        {valid.map((t, i) => {
          const x = dateX(t._start);
          const w = Math.max(dayPx, (differenceInDays(t._end, t._start) + 1) * dayPx);
          const barH = 18;
          const y = rowY(i) - barH / 2;
          const progressW = (w * Math.max(0, Math.min(100, t.progress))) / 100;
          const late = t.progress < 100 && t._end < today;
          return (
            <g key={t.id}>
              <title>{`${t.name}: ${format(t._start, 'dd/MM/yyyy')} a ${format(t._end, 'dd/MM/yyyy')} · ${t.progress}%`}</title>
              {/* nome */}
              <text
                x={labelWidth - 10}
                y={rowY(i) + 4}
                textAnchor="end"
                fill="hsl(var(--foreground))"
                fontSize="12"
              >
                {truncate(t.name, 28)}
              </text>
              {/* barra base */}
              <rect x={x} y={y} width={w} height={barH} rx={4} fill="hsl(var(--secondary))" stroke={late ? 'hsl(var(--status-red))' : 'none'} />
              {/* progresso */}
              <rect
                x={x}
                y={y}
                width={progressW}
                height={barH}
                rx={4}
                fill={t.progress >= 100 ? 'hsl(var(--status-green))' : late ? 'hsl(var(--status-red))' : 'hsl(var(--status-blue))'}
              />
              {/* texto */}
              <text x={x + w + 6} y={rowY(i) + 4} fill="hsl(var(--muted-foreground))" fontSize="10">
                {t.responsible ? `${truncate(t.responsible, 18)} - ` : ''}{t.progress}%
              </text>
            </g>
          );
        })}

        {/* marcos */}
        {marks.map((m, i) => {
          const row = valid.length + i;
          const cx = dateX(m._due) + dayPx / 2;
          const cy = rowY(row);
          const size = 7;
          const late = !m.done && m._due < today;
          const color = m.done ? 'hsl(var(--status-green))' : late ? 'hsl(var(--status-red))' : 'hsl(var(--status-purple))';
          return (
            <g key={m.id}>
              <title>{`Marco ${m.name}: ${format(m._due, 'dd/MM/yyyy')}${m.done ? ' · concluído' : late ? ' · vencido' : ''}`}</title>
              <text x={labelWidth - 10} y={cy + 4} textAnchor="end" fill="hsl(var(--foreground))" fontSize="12">
                {truncate(m.name, 28)}
              </text>
              <path d={`M${cx},${cy - size} L${cx + size},${cy} L${cx},${cy + size} L${cx - size},${cy} z`} fill={color} />
              <text x={cx + size + 6} y={cy + 4} fill="hsl(var(--muted-foreground))" fontSize="10">
                {format(m._due, 'dd/MM')}{m.done ? ' - concluído' : ''}
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
