'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Archive,
  Copy,
  Eye,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Search,
  Send,
  Square,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/platform/confirm-dialog';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { CategoryChip, CoverImage, StatusBadge } from '@/components/communication/publication-bits';
import type { Publication, PublicationCategory, PublicationStatus } from '@/lib/communication/publications';
import { STATUS_LABEL } from '@/lib/communication/publications';

const STATUS_FILTERS: PublicationStatus[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'SCHEDULED',
  'PUBLISHED',
  'EXPIRED',
  'ARCHIVED',
];

export default function PublicacoesPage() {
  const qc = useQueryClient();
  const { hasPermission, user } = useAuth();
  const canCreate = hasPermission(['communication:create', 'communication:manage']);
  const canPublish = hasPermission(['communication:publish', 'communication:manage']);
  const canDelete = hasPermission(['communication:delete', 'communication:manage']);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [authorId, setAuthorId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [confirmDelete, setConfirmDelete] = useState<Publication | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (status) params.set('status', status);
    if (categoryId) params.set('categoryId', categoryId);
    if (authorId) params.set('authorId', authorId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.toString();
  }, [search, status, categoryId, authorId, from, to]);

  const list = useQuery<{ total: number; items: Publication[] }>({
    queryKey: ['communication-publications', query],
    queryFn: () => api(`/communication/publications${query ? `?${query}` : ''}`),
  });
  const categories = useQuery<PublicationCategory[]>({
    queryKey: ['communication-categories'],
    queryFn: () => api('/communication/settings/categories'),
  });

  const authors = useMemo(() => {
    const map = new Map<string, string>();
    for (const post of list.data?.items ?? []) map.set(post.authorId, post.authorName);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [list.data]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['communication-publications'] });
    void qc.invalidateQueries({ queryKey: ['communication-overview'] });
  };

  const changeStatus = useMutation({
    mutationFn: ({ id, next, publishAt }: { id: string; next: PublicationStatus; publishAt?: string }) =>
      api(`/communication/publications/${id}/status`, { method: 'POST', json: { status: next, publishAt } }),
    onSuccess: (_data, variables) => {
      toast.success(`Publicação ${STATUS_LABEL[variables.next].toLowerCase()}.`);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const duplicate = useMutation({
    mutationFn: (id: string) => api<Publication>(`/communication/publications/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Publicação duplicada como rascunho.');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/communication/publications/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Publicação excluída.');
      setConfirmDelete(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const items = list.data?.items ?? [];
  const hasFilters = Boolean(search || status || categoryId || authorId || from || to);

  function actionsFor(post: Publication) {
    const actions: Array<{ key: string; label: string; icon: React.ComponentType<{ className?: string }>; run: () => void }> = [];
    const mine = post.authorId === user?.id;
    if (mine || hasPermission(['communication:update:any', 'communication:manage'])) {
      actions.push({ key: 'edit', label: 'Editar', icon: Pencil, run: () => undefined });
    }
    if (canCreate) actions.push({ key: 'duplicate', label: 'Duplicar', icon: Copy, run: () => duplicate.mutate(post.id) });
    if (canPublish) {
      if (post.status !== 'PUBLISHED' && post.status !== 'ARCHIVED') {
        actions.push({
          key: 'publish',
          label: 'Publicar agora',
          icon: Send,
          run: () => changeStatus.mutate({ id: post.id, next: 'PUBLISHED' }),
        });
      }
      if (post.status === 'PUBLISHED') {
        actions.push({
          key: 'close',
          label: 'Encerrar',
          icon: Square,
          run: () => changeStatus.mutate({ id: post.id, next: 'EXPIRED' }),
        });
      }
      if (post.status !== 'ARCHIVED') {
        actions.push({
          key: 'archive',
          label: 'Arquivar',
          icon: Archive,
          run: () => changeStatus.mutate({ id: post.id, next: 'ARCHIVED' }),
        });
      }
    }
    if (canDelete) actions.push({ key: 'delete', label: 'Excluir', icon: Trash2, run: () => setConfirmDelete(post) });
    return actions;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Comunicação"
        tone="view"
        title="Publicações"
        description="Todas as comunicações da empresa: rascunhos, programadas, publicadas, encerradas e arquivadas."
        breadcrumbs={[{ label: 'Comunicação', href: '/comunicacao' }, { label: 'Publicações' }]}
        actions={
          canCreate && (
            <Button asChild>
              <Link href="/comunicacao/publicacoes/nova">
                <Plus className="mr-2 h-4 w-4" />
                Nova publicação
              </Link>
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por título..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <NativeSelect value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos os status</option>
            {STATUS_FILTERS.map((item) => (
              <option key={item} value={item}>
                {STATUS_LABEL[item]}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Todas as categorias</option>
            {(categories.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect value={authorId} onChange={(event) => setAuthorId(event.target.value)}>
            <option value="">Todos os autores</option>
            {authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.name}
              </option>
            ))}
          </NativeSelect>
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Data inicial" />
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Data final" />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {list.isLoading ? 'Carregando...' : `${list.data?.total ?? 0} publicação(ões)`}
        </p>
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-7" onClick={() => setView('list')}>
            <List className="mr-1.5 h-3.5 w-3.5" />
            Lista
          </Button>
          <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="sm" className="h-7" onClick={() => setView('grid')}>
            <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
            Grade
          </Button>
        </div>
      </div>

      {list.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card/50 px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {hasFilters ? 'Nenhuma publicação encontrada com esses filtros.' : 'Nenhuma publicação criada ainda.'}
          </p>
          {!hasFilters && canCreate && (
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/comunicacao/publicacoes/nova">
                <Plus className="mr-2 h-4 w-4" />
                Criar publicação
              </Link>
            </Button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((post) => (
            <GridCard key={post.id} post={post} actions={actionsFor(post)} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Publicação</th>
                <th className="px-4 py-2.5 text-left font-medium">Categoria</th>
                <th className="px-4 py-2.5 text-left font-medium">Público</th>
                <th className="px-4 py-2.5 text-left font-medium">Autor</th>
                <th className="px-4 py-2.5 text-left font-medium">Data</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Leituras</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((post) => (
                <tr key={post.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <CoverImage url={post.coverImageUrl} alt={post.coverImageAlt} className="h-10 w-16 shrink-0 rounded" />
                      <div className="min-w-0">
                        <Link href={`/comunicacao/publicacoes/${post.id}`} className="font-medium hover:underline">
                          {post.title}
                        </Link>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          {post.isFeatured && <span className="text-amber-600 dark:text-amber-400">Destaque</span>}
                          {post.requiresReadConfirmation && <span>Confirmação obrigatória</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <CategoryChip name={post.category} color={post.categoryColor} />
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{post.audienceLabel}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{post.authorName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {formatDate(post.publishedAt ?? post.publishAt ?? post.createdAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={post.status} />
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {post.views}
                    {post.requiresReadConfirmation && (
                      <span className="text-muted-foreground"> · {post.confirmations} ✓</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <RowActions post={post} actions={actionsFor(post)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Excluir publicação"
        description={`"${confirmDelete?.title ?? ''}" será removida da Comunicação Interna e do histórico visível. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={async () => {
          if (confirmDelete) await remove.mutateAsync(confirmDelete.id);
        }}
      />
    </div>
  );
}

type RowAction = { key: string; label: string; icon: React.ComponentType<{ className?: string }>; run: () => void };

function RowActions({ post, actions }: { post: Publication; actions: RowAction[] }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button asChild variant="ghost" size="sm" className="h-7 px-2" title="Visualizar">
        <Link href={`/comunicacao/publicacoes/${post.id}`}>
          <Eye className="h-3.5 w-3.5" />
        </Link>
      </Button>
      {actions.map((action) =>
        action.key === 'edit' ? (
          <Button asChild key={action.key} variant="ghost" size="sm" className="h-7 px-2" title={action.label}>
            <Link href={`/comunicacao/publicacoes/${post.id}/editar`}>
              <action.icon className="h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : (
          <Button
            key={action.key}
            variant="ghost"
            size="sm"
            className={cn('h-7 px-2', action.key === 'delete' && 'text-destructive hover:text-destructive')}
            title={action.label}
            onClick={action.run}
          >
            <action.icon className="h-3.5 w-3.5" />
          </Button>
        ),
      )}
    </div>
  );
}

function GridCard({ post, actions }: { post: Publication; actions: RowAction[] }) {
  return (
    <Card className="overflow-hidden">
      <Link href={`/comunicacao/publicacoes/${post.id}`}>
        <CoverImage url={post.coverImageUrl} alt={post.coverImageAlt} />
      </Link>
      <CardContent className="space-y-2.5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryChip name={post.category} color={post.categoryColor} />
          <StatusBadge status={post.status} />
          {post.isFeatured && (
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Destaque</span>
          )}
        </div>
        <Link href={`/comunicacao/publicacoes/${post.id}`} className="block font-medium leading-snug hover:underline">
          {post.title}
        </Link>
        {post.summary && <p className="line-clamp-2 text-sm text-muted-foreground">{post.summary}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{post.audienceLabel}</span>
          <span>·</span>
          <span>{post.authorName}</span>
          <span>·</span>
          <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
        </div>
        <div className="flex items-center justify-between border-t pt-2.5 text-xs">
          <span className="tabular-nums text-muted-foreground">
            {post.views} visualização(ões)
            {post.requiresReadConfirmation && ` · ${post.confirmations} confirmada(s)`}
          </span>
          <RowActions post={post} actions={actions} />
        </div>
      </CardContent>
    </Card>
  );
}
