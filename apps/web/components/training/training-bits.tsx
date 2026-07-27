'use client';

import Link from 'next/link';
import { AlertTriangle, FileText, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ASSIGNMENT_STATUS,
  CERTIFICATE_STATUS,
  CLASS_STATUS,
  TONE_CLASS,
  type AssignmentStatus,
  type CertificateStatus,
  type ClassStatus,
} from '@/lib/training/types';

/**
 * Selo de situação da matriz.
 *
 * A cor nunca é o único sinal: o texto acompanha sempre, e o `title` traz a
 * descrição completa (regra 4.2 do plano — não depender só de cor).
 */
export function StatusPill({ status, className }: { status: AssignmentStatus; className?: string }) {
  const meta = ASSIGNMENT_STATUS[status] ?? ASSIGNMENT_STATUS.PENDING;
  return (
    <span
      title={meta.description}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        TONE_CLASS[meta.tone],
        className,
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

export function ClassStatusPill({ status }: { status: ClassStatus }) {
  const meta = CLASS_STATUS[status] ?? CLASS_STATUS.PLANNED;
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', TONE_CLASS[meta.tone])}>
      {meta.label}
    </span>
  );
}

export function CertificateStatusPill({ status }: { status: CertificateStatus }) {
  const meta = CERTIFICATE_STATUS[status] ?? CERTIFICATE_STATUS.PENDING_VALIDATION;
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', TONE_CLASS[meta.tone])}>
      {meta.label}
    </span>
  );
}

/** Legenda das situações — fica no rodapé das listas, não em cada linha. */
export function StatusLegend({ statuses, className }: { statuses: AssignmentStatus[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground', className)}>
      <span className="font-semibold uppercase tracking-wider">Legenda</span>
      {statuses.map((status) => {
        const meta = ASSIGNMENT_STATUS[status];
        return (
          <span key={status} className="inline-flex items-center gap-1.5" title={meta.description}>
            <span className={cn('inline-block h-2.5 w-2.5 rounded-sm border', TONE_CLASS[meta.tone])} />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Origem da exigência — responde "por que este treinamento é obrigatório".
 * Mostra o documento controlado quando existe, com link para o GED.
 */
export function RequirementOrigin({
  origin,
  className,
}: {
  origin?: {
    justification?: string | null;
    activity?: string | null;
    blocksOperation: boolean;
    document?: { id: string; code: string | null; title: string; version: number } | null;
  } | null;
  className?: string;
}) {
  if (!origin) {
    return <span className={cn('text-xs text-muted-foreground', className)}>Atribuição manual</span>;
  }
  return (
    <div className={cn('space-y-1 text-xs', className)}>
      {origin.document && (
        <Link
          href={`/documents?doc=${origin.document.id}`}
          className="inline-flex items-center gap-1.5 text-sky-600 hover:underline dark:text-sky-400"
        >
          <FileText className="h-3.5 w-3.5" />
          {origin.document.code ? `${origin.document.code} · ` : ''}
          {origin.document.title}
          <span className="text-muted-foreground">(rev. {origin.document.version})</span>
        </Link>
      )}
      {origin.activity && <div className="text-muted-foreground">Atividade: {origin.activity}</div>}
      {origin.justification && <div className="text-muted-foreground">{origin.justification}</div>}
      {origin.blocksOperation && (
        <div className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
          <Lock className="h-3.5 w-3.5" />
          Bloqueia a atividade quando pendente ou vencido
        </div>
      )}
    </div>
  );
}

/** Aviso de documento revisado após o treinamento do colaborador. */
export function OutdatedRevisionWarning({ trained, current }: { trained?: number | null; current?: number | null }) {
  if (!trained || !current || current <= trained) return null;
  return (
    <p className="inline-flex items-start gap-1.5 rounded-md border border-amber-300/60 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
      Treinado na revisão {trained}; o documento está na revisão {current}.
    </p>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  href,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: string;
}) {
  const content = (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 transition-colors',
        href && 'hover:border-primary/50 hover:bg-muted/40',
      )}
    >
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-2xl font-semibold tabular-nums', tone && TONE_CLASS[tone]?.split(' ').pop())}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
  // Card que filtra: leva direto aos registros que compõem o número.
  return href ? <Link href={href}>{content}</Link> : content;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-card/50 px-4 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}
