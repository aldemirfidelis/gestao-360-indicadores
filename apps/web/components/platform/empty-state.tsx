import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid place-items-center rounded-lg border border-dashed bg-muted/25 px-4 py-10 text-center', className)}>
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-background text-muted-foreground shadow-sm">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <div className="mt-3 text-sm font-semibold">{title}</div>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
