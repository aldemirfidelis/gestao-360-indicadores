'use client';

import { cn } from '@/lib/utils';

export interface TabDef {
  key: string;
  label: string;
}

/** Barra de abas horizontal, rolável, sem dependência externa. */
export function TabsBar({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="overflow-x-auto border-b">
      <div className="flex min-w-max gap-1 px-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              'whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              active === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
