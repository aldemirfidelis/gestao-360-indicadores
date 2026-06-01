import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  tone?: 'neutral' | 'launch' | 'view' | 'admin';
}

const toneClass: Record<NonNullable<Props['tone']>, string> = {
  neutral: 'text-muted-foreground',
  launch: 'text-status-blue',
  view: 'text-status-green',
  admin: 'text-status-purple',
};

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  breadcrumbs,
  tone = 'neutral',
}: Props) {
  return (
    <div className="mb-4 border-b border-border/60 pb-3">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
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
        </div>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className={cn('mb-1.5 text-[11px] font-medium uppercase tracking-[0.12em]', toneClass[tone])}>
              {eyebrow}
            </div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">{title}</h1>
          {description && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
