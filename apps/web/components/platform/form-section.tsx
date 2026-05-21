import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-lg border bg-card', className)}>
      <div className="border-b bg-muted/25 px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 mt-5 flex flex-col-reverse gap-2 border-t bg-background/92 px-1 py-4 backdrop-blur sm:flex-row sm:justify-end">
      {children}
    </div>
  );
}
