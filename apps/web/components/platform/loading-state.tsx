import { cn } from '@/lib/utils';
import { LoadingLogo } from '@/components/brand/loading-logo';

export function LoadingState({ label = 'Carregando...', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('grid min-h-40 place-items-center border border-border/60 bg-card text-sm text-muted-foreground p-6 rounded-lg', className)}>
      <div className="flex flex-col items-center gap-3">
        <LoadingLogo size="md" />
        <span className="font-sans font-medium text-xs tracking-wider text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
