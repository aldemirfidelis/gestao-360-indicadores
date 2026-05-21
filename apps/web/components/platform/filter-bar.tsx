import type { ReactNode } from 'react';
import { Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FilterBar({
  children,
  actions,
  className,
}: {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 rounded-lg border bg-card p-3 shadow-sm', className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="hidden h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground sm:grid">
            <Filter className="h-4 w-4" />
          </div>
          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
