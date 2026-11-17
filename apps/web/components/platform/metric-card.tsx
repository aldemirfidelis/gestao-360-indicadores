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
    <div data-metric className={cn('group relative flex h-full min-w-0 flex-col rounded-lg border border-border/60 bg-card', compact ? 'p-3' : 'p-3.5', href && 'transition-colors hover:border-primary/25 hover:bg-muted/30', className)}>
      <div className="flex items-start gap-1.5 text-xs font-medium leading-relaxed text-muted-foreground">
        {icon && <span aria-hidden="true" className={cn('mt-0.5 shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5', toneClass[tone])}>{icon}</span>}
        <p className="min-w-0 flex-1">{title}</p>
        {href && <ArrowUpRight aria-hidden="true" className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />}
      </div>
      <div className={cn('mt-1 min-w-0 max-w-full break-words font-semibold leading-tight tracking-tight tabular-nums', longValue ? 'text-base sm:text-lg' : 'text-2xl')}>{value}</div>
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
