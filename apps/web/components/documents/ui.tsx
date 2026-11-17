'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { Lock, ShieldAlert, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { CONFIDENTIALITY_HINT, CONFIDENTIALITY_LABEL, STATUS_CLASS, STATUS_LABEL, type Confidentiality, type DocOptions, type DocStatus } from './types';

export function useDocOptions(enabled = true) {
  return useQuery<DocOptions>({
    queryKey: ['documents', 'options'],
    queryFn: () => api<DocOptions>('/documents/options'),
    staleTime: 60_000,
    enabled,
  });
}

/** Atualiza tudo que depende do GED (acervo, ficha, Meu Dia). */
export function invalidateDocuments(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['documents'] });
  void qc.invalidateQueries({ queryKey: ['my-day'] });
}

export function errorMessage(error: unknown, fallback = 'Não foi possível concluir a ação.') {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function StatusBadge({ status, className }: { status: DocStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn('whitespace-nowrap font-medium', STATUS_CLASS[status], className)}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function ConfidentialityBadge({ level, hideInternal = true }: { level: Confidentiality; hideInternal?: boolean }) {
  if (level === 'INTERNAL' && hideInternal) return null;
  const Icon = level === 'CONFIDENTIAL' ? ShieldAlert : Lock;
  return (
    <Badge
      variant="outline"
      title={CONFIDENTIALITY_HINT[level]}
      className={cn('gap-1 whitespace-nowrap', level === 'CONFIDENTIAL' ? 'border-status-red/40 text-status-red' : level === 'RESTRICTED' ? 'border-status-yellow/40 text-status-yellow' : 'text-muted-foreground')}
    >
      {level !== 'INTERNAL' && <Icon className="h-3 w-3" />}
      {CONFIDENTIALITY_LABEL[level]}
    </Badge>
  );
}

export function InfoTile({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 rounded-lg border bg-muted/20 px-3 py-2', className)}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium" title={typeof value === 'string' ? value : undefined}>{value || '—'}</div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center', className)}>
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-md text-xs text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

export function Field({ label, hint, children, className, required }: { label: string; hint?: ReactNode; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label>
        {label}
        {required && <span className="ml-0.5 text-status-red">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

export interface PickOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

/** Seleção múltipla com busca (pessoas, áreas, grupos). */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Buscar e adicionar…',
  emptyText = 'Nada encontrado.',
  disabled,
  max,
  className,
}: {
  options: PickOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  max?: number;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const byValue = useMemo(() => new Map(options.map((option) => [option.value, option])), [options]);
  const normalized = query.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const available = useMemo(
    () =>
      options
        .filter((option) => !value.includes(option.value))
        .filter((option) => {
          if (!normalized) return true;
          const haystack = `${option.label} ${option.hint ?? ''}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
          return haystack.includes(normalized);
        })
        .slice(0, 60),
    [options, value, normalized],
  );
  const full = max !== undefined && value.length >= max;

  const add = (next: string) => {
    if (full) return;
    onChange([...value, next]);
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn('flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-sm', disabled && 'opacity-60')}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((item, index) => {
          const option = byValue.get(item);
          return (
            <span key={item} className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {max !== 1 && value.length > 1 && <span className="tabular-nums text-primary/60">{index + 1}.</span>}
              <span className="truncate">{option?.label ?? 'Item removido'}</span>
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remover ${option?.label ?? ''}`}
                  className="rounded hover:bg-primary/15"
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange(value.filter((current) => current !== item));
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          );
        })}
        {!disabled && !full && (
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                const first = available.find((option) => !option.disabled);
                if (first) add(first.value);
              } else if (event.key === 'Backspace' && !query && value.length) {
                onChange(value.slice(0, -1));
              } else if (event.key === 'Escape') {
                setOpen(false);
              }
            }}
            placeholder={value.length ? '' : placeholder}
            className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 outline-none placeholder:text-muted-foreground"
          />
        )}
      </div>
      {open && !disabled && !full && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
          {available.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">{emptyText}</p>
          ) : (
            available.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => add(option.value)}
                className="flex w-full flex-col items-start rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-40"
              >
                <span className="truncate">{option.label}</span>
                {option.hint && <span className="truncate text-[11px] text-muted-foreground">{option.hint}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function userOptions(users: DocOptions['users'] | undefined, exclude: Array<string | null | undefined> = []): PickOption[] {
  const blocked = new Set(exclude.filter(Boolean) as string[]);
  return (users ?? []).map((user) => ({ value: user.id, label: user.name, hint: user.email, disabled: blocked.has(user.id) }));
}

export function nodeOptions(nodes: DocOptions['allOrgNodes'] | undefined): PickOption[] {
  return (nodes ?? []).map((node) => ({ value: node.id, label: node.name, hint: node.type }));
}

export function groupOptions(groups: DocOptions['groups'] | undefined): PickOption[] {
  return (groups ?? []).map((group) => ({ value: group.id, label: group.name, hint: 'Grupo de acesso' }));
}

export function Timeline({ items, empty = 'Nenhum registro.' }: { items: Array<{ id: string; icon?: ReactNode; title: ReactNode; meta: ReactNode; body?: ReactNode }>; empty?: string }) {
  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border bg-muted/30 text-muted-foreground">{item.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{item.title}</div>
            <div className="text-xs text-muted-foreground">{item.meta}</div>
            {item.body && <div className="mt-1 whitespace-pre-wrap rounded-md bg-muted/30 px-2.5 py-1.5 text-sm">{item.body}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
