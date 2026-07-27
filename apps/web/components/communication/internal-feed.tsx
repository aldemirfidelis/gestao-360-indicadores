'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BellRing,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Megaphone,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { CategoryChip, CoverImage, FeedSeals } from '@/components/communication/publication-bits';
import type { FeedCard, FeedDetail, FeedResponse } from '@/lib/communication/publications';

const PAGE_SIZE = 12;

type FeedFilter = '' | 'nao-lidos' | 'confirmacao' | 'historico';

/**
 * Comunicação Interna do colaborador: banner de destaques + feed institucional.
 * Sem curtidas, comentários ou qualquer recurso de rede social — o objetivo é
 * comunicação corporativa.
 */
export function InternalCommunicationFeed() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const requestedPost = searchParams.get('post');

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [filter, setFilter] = useState<FeedFilter>('');
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(requestedPost);

  useEffect(() => {
    if (requestedPost) setOpenId(requestedPost);
  }, [requestedPost]);

  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (categoryId) params.set('categoryId', categoryId);
  if (filter) params.set('filter', filter);
  params.set('take', String(PAGE_SIZE));
  params.set('skip', String(page * PAGE_SIZE));

  const feed = useQuery<FeedResponse>({
    queryKey: ['communication-feed', params.toString()],
    queryFn: () => api(`/communication/feed?${params.toString()}`),
  });

  const data = feed.data;
  const pending = data?.counters.pendingConfirmations ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Comunicação Interna</h2>
          <p className="text-sm text-muted-foreground">Comunicados, campanhas e informações importantes da empresa.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar comunicado..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </div>
      </div>

      {pending > 0 && filter !== 'confirmacao' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-violet-300/60 bg-violet-500/8 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-sm text-violet-800 dark:text-violet-300">
            <BellRing className="h-4 w-4" />
            Você possui {pending} comunicado(s) aguardando confirmação.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setFilter('confirmacao');
              setPage(0);
            }}
          >
            Ver pendências
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            ['', 'Tudo'],
            ['nao-lidos', 'Não lidos'],
            ['confirmacao', 'Confirmação pendente'],
            ['historico', 'Histórico'],
          ] as const
        ).map(([value, label]) => (
          <FilterChip
            key={value || 'all'}
            active={filter === value}
            onClick={() => {
              setFilter(value);
              setPage(0);
            }}
          >
            {label}
          </FilterChip>
        ))}
        {(data?.categories ?? []).length > 0 && <span className="mx-1 h-4 w-px bg-border" />}
        {(data?.categories ?? []).map((category) => (
          <FilterChip
            key={category.id}
            active={categoryId === category.id}
            onClick={() => {
              setCategoryId(categoryId === category.id ? '' : category.id);
              setPage(0);
            }}
          >
            {category.name}
          </FilterChip>
        ))}
      </div>

      {feed.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <>
          {(data?.featured.length ?? 0) > 0 && filter === '' && !categoryId && !search && (
            <FeaturedCarousel items={data!.featured} onOpen={setOpenId} />
          )}

          {(data?.items.length ?? 0) === 0 ? (
            <div className="rounded-lg border border-dashed bg-card/50 px-4 py-16 text-center">
              <Megaphone className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                {filter === 'confirmacao'
                  ? 'Nenhum comunicado aguardando sua confirmação.'
                  : filter === 'nao-lidos'
                    ? 'Você está em dia: nenhum comunicado não lido.'
                    : 'Nenhum comunicado publicado para você por enquanto.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data!.items.map((item) => (
                <FeedCardView key={item.id} item={item} onOpen={setOpenId} />
              ))}
            </div>
          )}

          {(page > 0 || data?.hasMore) && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Anteriores
              </Button>
              <Button variant="outline" size="sm" disabled={!data?.hasMore} onClick={() => setPage((value) => value + 1)}>
                Mais comunicados
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <PublicationDialog
        id={openId}
        onClose={() => setOpenId(null)}
        onChanged={() => void qc.invalidateQueries({ queryKey: ['communication-feed'] })}
      />
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs transition-colors',
        active ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

/** Carrossel simples e acessível: setas, sem animação automática. */
function FeaturedCarousel({ items, onOpen }: { items: FeedCard[]; onOpen: (id: string) => void }) {
  const [index, setIndex] = useState(0);
  const current = items[Math.min(index, items.length - 1)]!;

  return (
    <section aria-label="Destaques" className="overflow-hidden rounded-xl border bg-card">
      <div className="relative">
        <button type="button" onClick={() => onOpen(current.id)} className="block w-full text-left">
          <CoverImage url={current.coverImageUrl} alt={current.coverImageAlt} aspect="aspect-[21/9]" />
        </button>
        {items.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Destaque anterior"
              onClick={() => setIndex((value) => (value - 1 + items.length) % items.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 shadow-sm transition-colors hover:bg-background"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Próximo destaque"
              onClick={() => setIndex((value) => (value + 1) % items.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 shadow-sm transition-colors hover:bg-background"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      <div className="space-y-2 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryChip name={current.category} color={current.categoryColor} />
          <FeedSeals
            isNew={!current.viewedAt}
            isImportant={current.isImportant}
            needsConfirmation={current.requiresReadConfirmation && !current.confirmedAt}
          />
        </div>
        <h3 className="text-lg font-semibold leading-snug">{current.title}</h3>
        {current.summary && <p className="text-sm text-muted-foreground">{current.summary}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" onClick={() => onOpen(current.id)}>
            Ver comunicado
          </Button>
          {current.actionUrl && current.actionLabel && (
            <Button asChild size="sm" variant="outline">
              <a href={current.actionUrl} target={current.actionNewTab ? '_blank' : undefined} rel="noreferrer">
                {current.actionLabel}
              </a>
            </Button>
          )}
          {items.length > 1 && (
            <span className="ml-auto flex items-center gap-1.5" aria-hidden>
              {items.map((item, position) => (
                <span
                  key={item.id}
                  className={cn('h-1.5 w-1.5 rounded-full', position === index ? 'bg-primary' : 'bg-border')}
                />
              ))}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function FeedCardView({ item, onOpen }: { item: FeedCard; onOpen: (id: string) => void }) {
  const aspect = item.layout === 'FEED_CARD' ? 'aspect-[4/5]' : item.layout === 'BANNER_WIDE' ? 'aspect-[16/9]' : 'aspect-square';
  return (
    <Card className="flex flex-col overflow-hidden">
      {item.layout !== 'TEXT_ONLY' && (
        <button type="button" onClick={() => onOpen(item.id)} className="block w-full text-left">
          <CoverImage url={item.coverImageUrl} alt={item.coverImageAlt} aspect={aspect} />
        </button>
      )}
      <CardContent className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoryChip name={item.category} color={item.categoryColor} />
        </div>
        <FeedSeals
          isNew={!item.viewedAt}
          isImportant={item.isImportant}
          needsConfirmation={item.requiresReadConfirmation && !item.confirmedAt}
        />
        <button type="button" onClick={() => onOpen(item.id)} className="text-left font-semibold leading-snug hover:underline">
          {item.title}
        </button>
        {item.summary && <p className="line-clamp-3 text-sm text-muted-foreground">{item.summary}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
          <span>{formatDate(item.publishedAt)}</span>
          {item.confirmedAt && (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Ciência registrada
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" className="w-full" onClick={() => onOpen(item.id)}>
          Ver comunicado
        </Button>
      </CardContent>
    </Card>
  );
}

/** Abrir o diálogo é o que registra a visualização (regra de negócio). */
function PublicationDialog({
  id,
  onClose,
  onChanged,
}: {
  id: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const detail = useQuery<FeedDetail>({
    queryKey: ['communication-feed-detail', id],
    queryFn: () => api(`/communication/feed/${id}/open`, { method: 'POST' }),
    enabled: Boolean(id),
    staleTime: 0,
  });

  useEffect(() => {
    if (detail.isSuccess) onChanged();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.isSuccess, detail.data?.id]);

  const confirm = useMutation({
    mutationFn: () => api<FeedDetail>(`/communication/feed/${id}/confirm`, { method: 'POST' }),
    onSuccess: (updated) => {
      toast.success('Ciência registrada.');
      qc.setQueryData(['communication-feed-detail', id], updated);
      onChanged();
      void qc.invalidateQueries({ queryKey: ['my-day'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const post = detail.data;

  return (
    <Dialog open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6 text-left">{post?.title ?? 'Comunicado'}</DialogTitle>
        </DialogHeader>

        {detail.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !post ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Comunicado não disponível.</p>
        ) : (
          <div className="space-y-4">
            {post.layout !== 'TEXT_ONLY' && post.coverImageUrl && (
              <CoverImage url={post.coverImageUrl} alt={post.coverImageAlt} aspect="aspect-[16/9]" className="rounded-lg" />
            )}

            <div className="flex flex-wrap items-center gap-2">
              <CategoryChip name={post.category} color={post.categoryColor} />
              <span className="text-xs text-muted-foreground">{formatDate(post.publishedAt)}</span>
              <FeedSeals isImportant={post.isImportant} needsConfirmation={post.requiresReadConfirmation && !post.confirmedAt} />
            </div>

            {post.summary && <p className="text-muted-foreground">{post.summary}</p>}
            <div className="whitespace-pre-line text-sm leading-relaxed">{post.content}</div>

            {post.gallery.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {post.gallery.map((image) => (
                  <CoverImage key={image.id} url={image.url} alt={image.alt} aspect="aspect-square" className="rounded-md" />
                ))}
              </div>
            )}

            {post.attachments.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase text-muted-foreground">Anexos</p>
                {post.attachments.map((file) => (
                  <a
                    key={file.id}
                    href={file.url ?? '#'}
                    download={file.name}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {file.name}
                  </a>
                ))}
              </div>
            )}

            {post.actionUrl && (
              <Button asChild variant="outline">
                <a href={post.actionUrl} target={post.actionNewTab ? '_blank' : undefined} rel="noreferrer">
                  {post.actionLabel ?? 'Saiba mais'}
                </a>
              </Button>
            )}

            {post.requiresReadConfirmation && (
              <div className="rounded-lg border bg-muted/40 p-4">
                {post.confirmedAt ? (
                  <p className="inline-flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Ciência registrada em {formatDate(post.confirmedAt)}.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm">Confirmo que li e estou ciente deste comunicado.</p>
                    <Button onClick={() => confirm.mutate()} disabled={confirm.isPending}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {confirm.isPending ? 'Registrando...' : 'Confirmar leitura'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
