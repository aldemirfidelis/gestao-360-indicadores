'use client';

import { AlertTriangle, CircleCheck, Loader2 } from 'lucide-react';

export type AutoSaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Status do salvamento automático das ferramentas de análise (Ishikawa, PDCA). */
export function AutoSaveStatus({ state, lastSavedAt, onRetry }: { state: AutoSaveState; lastSavedAt: string | null; onRetry: () => void }) {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
        <AlertTriangle className="h-3.5 w-3.5" /> Falha ao salvar
        <button type="button" className="underline underline-offset-2" onClick={onRetry}>Tentar de novo</button>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <CircleCheck className="h-3.5 w-3.5 text-emerald-600" />
      {state === 'saved' && lastSavedAt ? `Salvo às ${lastSavedAt}` : 'Salvamento automático'}
    </span>
  );
}
