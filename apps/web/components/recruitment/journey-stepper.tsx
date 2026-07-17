'use client';

import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface JourneyStep {
  key: string;
  label: string;
  icon?: LucideIcon;
  state: 'done' | 'current' | 'todo' | 'blocked';
  hint?: string;
}

/**
 * Trilho horizontal do processo (requisição ou candidato): mostra onde o fluxo
 * está e o que vem depois. Peça central da didática do módulo de recrutamento —
 * as ações das telas devem sempre corresponder ao passo "current".
 */
export function JourneyStepper({ steps, className }: { steps: JourneyStep[]; className?: string }) {
  return (
    <ol className={cn('flex flex-wrap items-center gap-y-2', className)}>
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isLast = index === steps.length - 1;
        return (
          <li key={step.key} className="flex items-center">
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                step.state === 'done' && 'border-status-green/40 bg-status-green/10 text-status-green',
                step.state === 'current' && 'border-status-blue/50 bg-status-blue/10 text-status-blue shadow-sm',
                step.state === 'todo' && 'border-border/60 bg-muted/30 text-muted-foreground',
                step.state === 'blocked' && 'border-status-red/40 bg-status-red/10 text-status-red',
              )}
              title={step.hint}
            >
              {step.state === 'done' ? <Check className="h-3 w-3" /> : Icon ? <Icon className="h-3 w-3" /> : <span className="text-[10px] tabular-nums">{index + 1}.</span>}
              <span className="whitespace-nowrap">{step.label}</span>
            </div>
            {!isLast && <ArrowRight className="mx-1 h-3 w-3 shrink-0 text-muted-foreground/50" />}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Chamada de "próximo passo" abaixo do stepper: transforma o estado do processo
 * em uma instrução de uma linha para o usuário.
 */
export function NextStepCallout({ text, tone = 'blue', className }: { text: string; tone?: 'blue' | 'green' | 'yellow' | 'red'; className?: string }) {
  const tones = {
    blue: 'border-status-blue/30 bg-status-blue/5 text-status-blue',
    green: 'border-status-green/30 bg-status-green/5 text-status-green',
    yellow: 'border-status-yellow/30 bg-status-yellow/5 text-status-yellow',
    red: 'border-status-red/30 bg-status-red/5 text-status-red',
  } as const;
  return (
    <div className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium', tones[tone], className)}>
      <ArrowRight className="h-3.5 w-3.5 shrink-0" />
      <span>Próximo passo: {text}</span>
    </div>
  );
}
