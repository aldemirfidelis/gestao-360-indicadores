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
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 border-b bg-muted/25 p-4">
        <div className="min-w-0">
          <CardTitle className="text-sm">{title}</CardTitle>
          {description && <div className="mt-1 text-xs text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </CardHeader>
      <CardContent className={cn('p-4', contentClassName)}>{children}</CardContent>
    </Card>
  );
}
