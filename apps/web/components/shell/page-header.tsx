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
        'relative isolate mb-5 min-w-0 rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/[0.045] text-card-foreground shadow-sm',
        compact ? 'p-4' : 'p-5 sm:p-6',
        className,
      )}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
        <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      </div>
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
      <div className="flex min-w-0 flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className={cn('mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]', toneClass[tone])}>
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              {eyebrow}
            </div>
          )}
          <h1 className="break-words text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
          {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 xl:max-w-[50%]">{actions}</div>}
      </div>
      {children && <div className="mt-5 min-w-0">{children}</div>}
      {summary && <div data-page-summary className="mt-5 min-w-0 border-t border-border/60 pt-5">{summary}</div>}
    </header>
  );
}
