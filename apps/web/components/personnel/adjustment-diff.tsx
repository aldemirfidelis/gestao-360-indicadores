'use client';

import { cn } from '@/lib/utils';
import { punchRoleLabel } from '@/lib/personnel/time-clock-shared';

/**
 * Comparação "registrado hoje" x "solicitado" de um ajuste de ponto.
 *
 * O aprovador precisa enxergar EXATAMENTE qual horário muda. Por isso cada
 * marcação é classificada e colorida:
 *  - verde  = batida registrada pelo colaborador e mantida como está;
 *  - vermelho = alteração pedida (horário trocado, incluído ou removido);
 *  - âmbar  = marcação que já veio de um ajuste manual anterior.
 */
export type PunchDiffKind = 'kept' | 'changed' | 'added' | 'removed' | 'manual';

export interface PunchDiffItem {
  time: string;
  kind: PunchDiffKind;
  /** Horário que ocupava a posição antes (quando kind = 'changed'). */
  previous?: string;
}

/** Compara posição a posição: é assim que a aprovação aplica os horários. */
export function diffPunchTimes(current: string[], proposed: string[], sources: string[] = []): PunchDiffItem[] {
  const total = Math.max(current.length, proposed.length);
  const items: PunchDiffItem[] = [];
  for (let index = 0; index < total; index += 1) {
    const before = current[index];
    const after = proposed[index];
    if (before && after && before === after) {
      items.push({ time: after, kind: sources[index] === 'MANUAL' ? 'manual' : 'kept' });
    } else if (before && after) {
      items.push({ time: after, kind: 'changed', previous: before });
    } else if (!before && after) {
      items.push({ time: after, kind: 'added' });
    } else if (before && !after) {
      items.push({ time: before, kind: 'removed' });
    }
  }
  return items;
}

const KIND_CLASS: Record<PunchDiffKind, string> = {
  kept: 'border-status-green/50 bg-status-green/10 text-status-green',
  changed: 'border-status-red/50 bg-status-red/10 text-status-red',
  added: 'border-status-red/50 bg-status-red/10 text-status-red',
  removed: 'border-status-red/50 bg-status-red/10 text-status-red line-through',
  manual: 'border-status-yellow/50 bg-status-yellow/10 text-status-yellow',
};

const KIND_TITLE: Record<PunchDiffKind, string> = {
  kept: 'Batida registrada pelo colaborador — permanece igual',
  changed: 'Horário alterado nesta solicitação',
  added: 'Marcação nova incluída nesta solicitação',
  removed: 'Marcação existente que será removida',
  manual: 'Marcação originada de um ajuste manual anterior',
};

export function PunchDiff({
  current,
  proposed,
  sources,
  autoLunch,
  className,
}: {
  current: string[];
  proposed: string[];
  sources?: string[];
  autoLunch?: boolean;
  className?: string;
}) {
  const items = diffPunchTimes(current, proposed, sources);
  const hasChange = items.some((item) => item.kind !== 'kept' && item.kind !== 'manual');

  return (
    <div className={cn('space-y-2', className)}>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Registrado hoje</div>
          {current.length === 0 ? (
            <span className="text-[11px] italic text-muted-foreground">Nenhuma marcação no dia</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {current.map((time, index) => (
                <span
                  key={`atual-${index}-${time}`}
                  title={sources?.[index] === 'MANUAL' ? KIND_TITLE.manual : KIND_TITLE.kept}
                  className={cn(
                    'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                    sources?.[index] === 'MANUAL' ? KIND_CLASS.manual : KIND_CLASS.kept,
                  )}
                >
                  <span className="mr-1 opacity-70">{punchRoleLabel(index, autoLunch)}</span>
                  {time}
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Solicitado</div>
          <div className="flex flex-wrap gap-1">
            {items.map((item, index) => (
              <span
                key={`novo-${index}-${item.time}`}
                title={KIND_TITLE[item.kind]}
                className={cn(
                  'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                  KIND_CLASS[item.kind],
                )}
              >
                <span className="mr-1 opacity-70">{punchRoleLabel(index, autoLunch)}</span>
                {item.previous && <span className="mr-1 line-through opacity-60">{item.previous}</span>}
                {item.time}
              </span>
            ))}
          </div>
        </div>
      </div>

      {!hasChange && (
        <p className="text-[11px] text-muted-foreground">
          Os horários solicitados são iguais aos registrados — confira o motivo antes de decidir.
        </p>
      )}
    </div>
  );
}

/** Legenda das cores. Fica no rodapé da lista, não em cada cartão. */
export function PunchDiffLegend({ className }: { className?: string }) {
  const items: Array<{ kind: PunchDiffKind; label: string }> = [
    { kind: 'kept', label: 'Batida correta do colaborador' },
    { kind: 'changed', label: 'Horário alterado no pedido' },
    { kind: 'added', label: 'Marcação incluída' },
    { kind: 'removed', label: 'Marcação removida' },
    { kind: 'manual', label: 'Ajuste manual anterior' },
  ];
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-muted-foreground', className)}>
      <span className="font-semibold uppercase tracking-wider">Legenda</span>
      {items.map((item) => (
        <span key={item.kind} className="inline-flex items-center gap-1.5">
          <span className={cn('inline-block h-2.5 w-2.5 rounded-sm border', KIND_CLASS[item.kind])} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
