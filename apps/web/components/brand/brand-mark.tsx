import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative grid place-items-center overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-sm',
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-x-0 bottom-0 h-1 bg-teal-400" />
      <svg viewBox="0 0 48 48" className="relative h-[68%] w-[68%]" focusable="false">
        <path
          d="M24 7.5a16.5 16.5 0 1 0 13.2 26.4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="4"
        />
        <path
          d="M24 7.5a16.5 16.5 0 0 1 15.7 11.4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="4"
          opacity="0.72"
        />
        <path
          d="M33.5 16.4h7.2V9.2"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
        <circle cx="24" cy="24" r="4.8" fill="currentColor" />
      </svg>
    </div>
  );
}

export function BrandLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <BrandMark className="h-10 w-10 shrink-0" />
      {!compact && (
        <div className="min-w-0 leading-tight">
          <div className="text-sm font-semibold">Gestão 360</div>
          <div className="text-xs text-muted-foreground">Suíte corporativa de gestão</div>
        </div>
      )}
    </div>
  );
}
