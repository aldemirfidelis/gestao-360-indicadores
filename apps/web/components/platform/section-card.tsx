import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-col gap-3 space-y-0 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <CardTitle className="text-[13px] font-semibold uppercase tracking-[0.06em]">{title}</CardTitle>
          {description && <div className="mt-1 text-xs text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </CardHeader>
      <CardContent className={cn('p-4', contentClassName)}>{children}</CardContent>
    </Card>
  );
}
