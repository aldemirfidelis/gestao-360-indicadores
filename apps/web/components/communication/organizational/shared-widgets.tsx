'use client';

// Extraido de app/(app)/comunicacao/page.tsx (decomposicao Fase 4).
import type React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { PRIORITY_LABEL, PRIORITY_STYLE, type Priority } from './shared';

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function MultiCheck({ title, items, selected, onToggle }: { title: string; items: Array<{ id: string; label: string }>; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div>
      <Label>{title}</Label>
      <div className="mt-2 grid max-h-56 grid-cols-1 gap-2 overflow-auto rounded-md border p-3 md:grid-cols-2">
        {items.map((item) => (
          <label key={item.id} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted">
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} className="h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words">{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge variant="outline" className={cn('shrink-0', PRIORITY_STYLE[priority])}>{PRIORITY_LABEL[priority]}</Badge>;
}

export function SmallFact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-medium">{value}</p>
    </div>
  );
}

