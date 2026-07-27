'use client';

import { AlertCircle, CheckCircle2, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  categoryStyle,
  STATUS_LABEL,
  STATUS_STYLE,
  type PublicationStatus,
} from '@/lib/communication/publications';

export function StatusBadge({ status, className }: { status: PublicationStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium', STATUS_STYLE[status], className)}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function CategoryChip({ name, color, className }: { name: string; color?: string | null; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium', className)}
      style={categoryStyle(color)}
    >
      {name}
    </span>
  );
}

/** Selos do feed: Novo, Importante e Confirmação necessária. */
export function FeedSeals({
  isNew,
  isImportant,
  needsConfirmation,
}: {
  isNew?: boolean;
  isImportant?: boolean;
  needsConfirmation?: boolean;
}) {
  if (!isNew && !isImportant && !needsConfirmation) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isNew && (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/12 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-400">
          <Sparkles className="h-3 w-3" />
          Novo
        </span>
      )}
      {isImportant && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-3 w-3" />
          Importante
        </span>
      )}
      {needsConfirmation && (
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/12 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-400">
          <CheckCircle2 className="h-3 w-3" />
          Confirmação necessária
        </span>
      )}
    </div>
  );
}

/** Capa com proporção fixa; sem imagem, mostra um placeholder discreto. */
export function CoverImage({
  url,
  alt,
  aspect = 'aspect-[16/9]',
  className,
}: {
  url?: string | null;
  alt?: string | null;
  aspect?: string;
  className?: string;
}) {
  if (!url) {
    return (
      <div className={cn('grid place-items-center bg-muted/60 text-muted-foreground', aspect, className)}>
        <ImageIcon className="h-6 w-6 opacity-50" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt ?? ''} className={cn('w-full object-cover', aspect, className)} loading="lazy" />
  );
}

export function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
