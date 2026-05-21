import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'green' | 'yellow' | 'red' | 'blue' | 'purple';

const toneClass: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  green: 'bg-status-green/10 text-status-green',
  yellow: 'bg-status-yellow/10 text-status-yellow',
  red: 'bg-status-red/10 text-status-red',
  blue: 'bg-status-blue/10 text-status-blue',
  purple: 'bg-status-purple/10 text-status-purple',
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
}: {
  title: string;
  value: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  trend?: { value: string; direction?: 'up' | 'down' | 'flat' };
  href?: string;
  className?: string;
}) {
  const body = (
    <Card className={cn('h-full panel-hover', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
          </div>
          {icon && <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', toneClass[tone])}>{icon}</div>}
        </div>
        <div className="mt-3 flex min-h-5 items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="truncate">{description}</span>
          {trend && (
            <span className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground">
              {trend.direction === 'down' ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
              {trend.value}
            </span>
          )}
          {href && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        </div>
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
