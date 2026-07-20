'use client';

import { useState } from 'react';
import { GripVertical, MapPin, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/platform/status-badge';
import { APPLICATION_STATUS, metaOf } from '@/lib/recruitment/labels';
import { cn } from '@/lib/utils';
import type { PipelineStage } from '@/components/recruitment/candidate-sheet';

export interface BoardApplication {
  id: string;
  status: string;
  appliedAt: string;
  currentStageId: string | null;
  score: number | null;
  candidate: { id: string; name: string; email: string; city: string | null; headline: string | null };
}

/**
 * Kanban do pipeline da vaga: colunas por etapa, cartão = candidato.
 * Arrastar o cartão move de etapa (só candidaturas ativas); clicar abre o painel.
 */
export function PipelineBoard({
  stages,
  applications,
  canManage,
  onOpen,
  onMove,
  selectedIds,
  onToggleSelect,
}: {
  stages: PipelineStage[];
  applications: BoardApplication[];
  canManage: boolean;
  onOpen: (applicationId: string) => void;
  onMove: (applicationId: string, toStageId: string) => void;
  /** Seleção múltipla para ações em massa (opcional — sem isso, comportamento igual ao anterior). */
  selectedIds?: Set<string>;
  onToggleSelect?: (applicationId: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  const active = applications.filter((app) => app.status === 'ACTIVE');
  const finished = applications.filter((app) => app.status !== 'ACTIVE');
  const unstaged = active.filter((app) => !app.currentStageId || !stages.some((stage) => stage.id === app.currentStageId));

  const columns: Array<{ key: string; title: string; stageId: string | null; items: BoardApplication[] }> = [
    ...(unstaged.length > 0 ? [{ key: 'none', title: 'Sem etapa', stageId: null, items: unstaged }] : []),
    ...stages.map((stage) => ({
      key: stage.id,
      title: `${stage.order}. ${stage.name}`,
      stageId: stage.id,
      items: active.filter((app) => app.currentStageId === stage.id),
    })),
  ];

  const handleDrop = (stageId: string | null) => {
    if (dragId && stageId && canManage) {
      const app = applications.find((item) => item.id === dragId);
      if (app && app.currentStageId !== stageId) onMove(dragId, stageId);
    }
    setDragId(null);
    setOverStage(null);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {columns.map((column) => (
            <div
              key={column.key}
              className={cn(
                'flex w-60 shrink-0 flex-col rounded-md border bg-muted/20',
                overStage === column.key && dragId && 'border-status-blue/60 bg-status-blue/5',
              )}
              onDragOver={(event) => {
                if (!column.stageId || !canManage) return;
                event.preventDefault();
                setOverStage(column.key);
              }}
              onDragLeave={() => setOverStage((current) => (current === column.key ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                handleDrop(column.stageId);
              }}
            >
              <div className="flex items-center justify-between border-b px-3 py-2">
                <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{column.title}</span>
                <Badge variant="outline" className="text-[9px] tabular-nums">{column.items.length}</Badge>
              </div>
              <div className="flex min-h-[80px] flex-1 flex-col gap-2 p-2">
                {column.items.length === 0 && <div className="grid flex-1 place-items-center py-4 text-[10px] text-muted-foreground/60">Vazio</div>}
                {column.items.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    draggable={canManage}
                    onDragStart={() => setDragId(app.id)}
                    onDragEnd={() => { setDragId(null); setOverStage(null); }}
                    onClick={() => onOpen(app.id)}
                    className={cn(
                      'rounded-md border bg-background p-2.5 text-left shadow-sm transition hover:border-status-blue/50 hover:shadow',
                      dragId === app.id && 'opacity-50',
                      selectedIds?.has(app.id) && 'border-status-blue bg-status-blue/5',
                      canManage && 'cursor-grab active:cursor-grabbing',
                    )}
                  >
                    <div className="flex items-start gap-1.5">
                      {onToggleSelect && (
                        <input
                          type="checkbox"
                          checked={selectedIds?.has(app.id) ?? false}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => onToggleSelect(app.id)}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        />
                      )}
                      {canManage && <GripVertical className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/50" />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold">{app.candidate.name}</div>
                        {app.candidate.headline && <div className="truncate text-[10px] text-muted-foreground">{app.candidate.headline}</div>}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                          {app.candidate.city && <span className="inline-flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{app.candidate.city}</span>}
                          {typeof app.score === 'number' && <span className="inline-flex items-center gap-0.5"><Star className="h-2.5 w-2.5" />{app.score} pts</span>}
                          <span>{daysAgo(app.appliedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {finished.length > 0 && (
        <div className="rounded-md border bg-muted/20 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Fora do processo ({finished.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {finished.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => onOpen(app.id)}
                className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs transition hover:border-status-blue/50"
              >
                <span className="font-medium">{app.candidate.name}</span>
                <StatusBadge label={metaOf(APPLICATION_STATUS, app.status).label} tone={metaOf(APPLICATION_STATUS, app.status).tone} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function daysAgo(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return '';
  if (days === 0) return 'hoje';
  if (days === 1) return 'há 1 dia';
  return `há ${days} dias`;
}
