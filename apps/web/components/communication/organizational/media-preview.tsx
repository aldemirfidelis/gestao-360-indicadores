'use client';

// Extraido de app/(app)/comunicacao/page.tsx (decomposicao Fase 4).
// Arquivo proprio para evitar ciclo entre create-post-form e campaigns-media.
import { FileText, Film, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isImageMedia, isPlayableVideoUrl, isVideoMedia, type MediaItem } from './shared';

export function MediaPreview({ item, className }: { item: MediaItem; className?: string }) {
  const url = item.url ?? '';
  if (url && isVideoMedia(item) && isPlayableVideoUrl(url)) {
    return (
      <video className={cn('w-full rounded-md border bg-black object-contain', className)} controls preload="metadata">
        <source src={url} />
      </video>
    );
  }
  if (url && isImageMedia(item)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={item.name} className={cn('w-full rounded-md border object-cover', className)} />;
  }
  const Icon = isVideoMedia(item) ? Film : isImageMedia(item) ? ImageIcon : FileText;
  return (
    <div className={cn('grid w-full place-items-center rounded-md border bg-muted text-muted-foreground', className)}>
      <Icon className="h-6 w-6" />
    </div>
  );
}
