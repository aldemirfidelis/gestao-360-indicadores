import { cn } from '@/lib/utils';

interface Props {
  value: number; // 0..100
  className?: string;
  barClassName?: string;
}

export function Progress({ value, className, barClassName }: Props) {
  return (
    <div className={cn('h-2 w-full bg-muted rounded-full overflow-hidden', className)}>
      <div
        className={cn(
          'h-full transition-all',
          value >= 100 ? 'bg-status-green' : value >= 50 ? 'bg-status-blue' : 'bg-status-yellow',
          barClassName,
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
