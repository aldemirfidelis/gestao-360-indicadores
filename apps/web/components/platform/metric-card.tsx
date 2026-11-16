import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'green' | 'yellow' | 'red' | 'blue' | 'purple';

const toneClass: Record<Tone, string> = {
  neutral: 'text-muted-foreground',
  green: 'text-status-green',
  yellow: 'text-status-yellow',
  red: 'text-status-red',
  blue: 'text-status-blue',
  purple: 'text-status-purple',
};

const toneBackground: Record<Tone, string> = {
  neutral: 'bg-muted',
  green: 'bg-status-green/10',
  yellow: 'bg-status-yellow/10',
  red: 'bg-status-red/10',
  blue: 'bg-status-blue/10',
  purple: 'bg-status-purple/10',
};

export function MetricCard({
  title,
  value,
  description,
  icon,
  tone = 'neutral',
  trend,
  href,
  className,
  compact = false,
}: {
  title: string;
  value: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  trend?: { value: string; direction?: 'up' | 'down' | 'flat' };
  href?: string;
  className?: string;
  compact?: boolean;
}) {
  const longValue = typeof value === 'string' && value.length > 9;
  const body = (
    <div className={cn('group relative flex h-full min-w-0 flex-col rounded-xl border border-border/70 bg-card/90 shadow-sm', compact ? 'p-3.5' : 'p-4', href && 'transition-colors hover:border-primary/25 hover:bg-card', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        {icon && <span aria-hidden="true" className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', toneClass[tone], toneBackground[tone])}>{icon}</span>}
        <div className={cn('min-w-0 max-w-full break-words font-semibold leading-tight tracking-tight tabular-nums', longValue ? 'shrink-0 text-base sm:text-lg' : compact ? 'text-2xl' : 'text-[28px]', icon && 'ml-auto text-right')}>{value}</div>
        {href && <ArrowUpRight aria-hidden="true" className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />}
      </div>
      <p className="mt-3 text-xs font-medium leading-relaxed text-muted-foreground">{title}</p>
      {(description || trend) && (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-1 text-[11px] leading-relaxed text-muted-foreground">
          <span>{description}</span>
          {trend && (
            <span className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground">
              {trend.direction === 'down' ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
              {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (!href) return body;

  return (
    <Link href={href} className="block h-full min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      {body}
    </Link>
  );
}
