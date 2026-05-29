import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative grid place-items-center overflow-hidden bg-foreground text-background',
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" className="relative h-[70%] w-[70%]" focusable="false">
        <path
          d="M24 7.5a16.5 16.5 0 1 0 13.2 26.4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="3.5"
        />
        <path
          d="M24 7.5a16.5 16.5 0 0 1 15.7 11.4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="3.5"
          opacity="0.5"
        />
        <circle cx="24" cy="24" r="4" fill="currentColor" />
      </svg>
    </div>
  );
}

export function BrandLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <BrandMark className="h-8 w-8 shrink-0" />
      {!compact && (
        <div className="min-w-0 leading-tight">
          <div className="text-sm font-semibold tracking-tight">Gestão 360</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Suíte de gestão</div>
        </div>
      )}
    </div>
  );
}
