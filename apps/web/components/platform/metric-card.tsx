import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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

const toneBar: Record<Tone, string> = {
  neutral: 'bg-foreground/15',
  green: 'bg-status-green',
  yellow: 'bg-status-yellow',
  red: 'bg-status-red',
  blue: 'bg-status-blue',
  purple: 'bg-status-purple',
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
  const body = (
    <Card className={cn('group relative h-full overflow-hidden panel-hover', className)}>
      <span className={cn('absolute left-0 top-0 h-full w-[2px]', toneBar[tone])} />
      <CardContent className={cn(compact ? 'p-3' : 'p-4')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {icon && <span className={cn('shrink-0', toneClass[tone])}>{icon}</span>}
              <p className={cn('font-medium uppercase tracking-[0.1em] text-muted-foreground', compact ? 'text-[10px]' : 'text-[11px]')}>{title}</p>
            </div>
            <div className={cn('font-semibold leading-none tracking-tight tabular-nums', compact ? 'mt-2 text-[22px]' : 'mt-3 text-[26px]')}>{value}</div>
          </div>
          {href && <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
        </div>
        {(description || trend) && (
          <div className={cn('flex items-center justify-between gap-3 text-xs text-muted-foreground', compact ? 'mt-2 min-h-4' : 'mt-3 min-h-5')}>
            <span className="truncate">{description}</span>
            {trend && (
              <span className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground">
                {trend.direction === 'down' ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                {trend.value}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (!href) return body;

  return (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  );
}
