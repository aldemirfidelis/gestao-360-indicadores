import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  summary?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
  className?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  tone?: 'neutral' | 'launch' | 'view' | 'admin';
}

const toneClass: Record<NonNullable<Props['tone']>, string> = {
  neutral: 'text-primary',
  launch: 'text-status-blue',
  view: 'text-status-green',
  admin: 'text-status-purple',
};

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  summary,
  children,
  compact = false,
  className,
  breadcrumbs,
  tone = 'neutral',
}: Props) {
  return (
    <header
      data-page-header
      className={cn(
        'mb-4 min-w-0 rounded-xl border border-border/70 bg-card text-card-foreground',
        compact ? 'p-4' : 'p-4 sm:p-5',
        className,
      )}
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Caminho da página" className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((b, index) => (
            <span key={`${b.label}-${index}`} className="inline-flex items-center gap-1">
              {b.href ? (
                <Link href={b.href} className="transition-colors hover:text-foreground">
                  {b.label}
                </Link>
              ) : (
                <span>{b.label}</span>
              )}
              {index < breadcrumbs.length - 1 && <ChevronRight className="h-3 w-3 opacity-50" />}
            </span>
          ))}
        </nav>
      )}
      <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className={cn('mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]', toneClass[tone])}>
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              {eyebrow}
            </div>
          )}
          <h1 className="break-words text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 xl:max-w-[50%]">{actions}</div>}
      </div>
      {children && <div className="mt-4 min-w-0">{children}</div>}
      {summary && <div data-page-summary className="mt-4 min-w-0 border-t border-border/60 pt-3 [&_[data-metric]]:border-0 [&_[data-metric]]:bg-transparent [&_[data-metric]]:p-0 [&_[data-metric]]:shadow-none">{summary}</div>}
    </header>
  );
}
