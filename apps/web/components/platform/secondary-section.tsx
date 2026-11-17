'use client';

import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Detalhes complementares ficam acessíveis sem deslocar o trabalho principal. */
export function SecondarySection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const [visited, setVisited] = useState(false);
  return (
    <details onToggle={(event) => { if (event.currentTarget.open) setVisited(true); }} className={cn('group/secondary min-w-0 rounded-lg border border-border/70 bg-card', className)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-open/secondary:rotate-90 motion-reduce:transition-none" />
        {title}
      </summary>
      {visited && <div className="min-w-0 border-t p-4">{children}</div>}
    </details>
  );
}
