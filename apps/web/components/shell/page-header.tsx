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
  neutral: 'bg-primary/10 text-primary',
  launch: 'bg-status-blue/10 text-status-blue',
  view: 'bg-status-green/10 text-status-green',
  admin: 'bg-status-purple/10 text-status-purple',
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
    <div className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((b, index) => (
            <span key={`${b.label}-${index}`} className="inline-flex items-center gap-1">
              {b.href ? (
                <Link href={b.href} className="hover:text-foreground">
                  {b.label}
                </Link>
              ) : (
                <span>{b.label}</span>
              )}
              {index < breadcrumbs.length - 1 && <ChevronRight className="h-3 w-3" />}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className={cn('mb-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide', toneClass[tone])}>
              {eyebrow}
            </div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
          {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
