'use client';

import { Hammer } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';

/**
 * Placeholder honesto para submenus ainda não implementados.
 * NÃO simula funcionalidade — deixa claro o que está previsto e em qual fase.
 */
export function PhasePlaceholder({ title, phase, items }: { title: string; phase: string; items: string[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">Tela prevista no roadmap desta funcionalidade.</p>
      </div>
      <SectionCard title={`Em desenvolvimento — ${phase}`} description="Esta área ainda não está ativa para evitar botões sem funcionamento real.">
        <div className="flex items-start gap-3 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
          <Hammer className="mt-0.5 h-5 w-5 shrink-0 opacity-70" />
          <div>
            <p className="mb-2">Quando ativa, esta tela permitirá:</p>
            <ul className="list-inside list-disc space-y-1">
              {items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
