import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LoadingState({ label = 'Carregando...', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('grid min-h-40 place-items-center rounded-lg border bg-card text-sm text-muted-foreground', className)}>
      <div className="inline-flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </div>
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}
