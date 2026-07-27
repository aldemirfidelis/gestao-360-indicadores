'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Archive, Copy, Download, Pencil, Send, Square, Undo2 } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/components/auth/auth-provider';
import { api, getAccessToken } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { CategoryChip, CoverImage, StatusBadge } from '@/components/communication/publication-bits';
import type { Publication, PublicationMetrics, PublicationStatus } from '@/lib/communication/publications';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';

export default function PublicacaoDetalhePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission, user } = useAuth();
  const [peopleFilter, setPeopleFilter] = useState<'all' | 'viewed' | 'not-viewed' | 'confirmed' | 'pending'>('all');
  const [peopleSearch, setPeopleSearch] = useState('');

  const publication = useQuery<Publication>({
    queryKey: ['communication-publication', id],
    queryFn: () => api(`/communication/publications/${id}`),
    enabled: Boolean(id),
  });
  const canSeeMetrics = hasPermission(['communication:reports', 'communication:manage']);
  const metrics = useQuery<PublicationMetrics>({
    queryKey: ['communication-publication-metrics', id],
    queryFn: () => api(`/communication/publications/${id}/metrics`),
    enabled: Boolean(id) && canSeeMetrics,
  });

  const post = publication.data;
  const canPublish = hasPermission(['communication:publish', 'communication:manage']);
  const canApprove = hasPermission(['communication:approve', 'communication:manage']);
  const canEdit =
    post && (post.authorId === user?.id || hasPermission(['communication:update:any', 'communication:manage']));

  const changeStatus = useMutation({
    mutationFn: ({ next, comment }: { next: PublicationStatus; comment?: string }) =>
      api(`/communication/publications/${id}/status`, { method: 'POST', json: { status: next, comment } }),
    onSuccess: () => {
      toast.success('Status atualizado.');
      void qc.invalidateQueries({ queryKey: ['communication-publication', id] });
      void qc.invalidateQueries({ queryKey: ['communication-publications'] });
      void qc.invalidateQueries({ queryKey: ['communication-overview'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const duplicate = useMutation({
    mutationFn: () => api<Publication>(`/communication/publications/${id}/duplicate`, { method: 'POST' }),
    onSuccess: (created) => {
      toast.success('Publicação duplicada como rascunho.');
      router.push(`/comunicacao/publicacoes/${created.id}/editar`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function exportCsv() {
    try {
      const response = await fetch(`${API_URL}/communication/publications/${id}/metrics.csv`, {
        headers: { authorization: `Bearer ${getAccessToken() ?? ''}` },
      });
      if (!response.ok) throw new Error('Não foi possível exportar.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `comunicacao-${post?.title ?? 'publicacao'}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error?.message ?? 'Falha ao exportar.');
    }
  }

  if (publication.isLoading) return <Skeleton className="h-96 w-full" />;
  if (!post) return <p className="py-16 text-center text-sm text-muted-foreground">Publicação não encontrada.</p>;

  const people = (metrics.data?.people ?? []).filter((person) => {
    if (peopleSearch && !person.name.toLowerCase().includes(peopleSearch.toLowerCase())) return false;
    if (peopleFilter === 'viewed') return Boolean(person.viewedAt);
    if (peopleFilter === 'not-viewed') return !person.viewedAt;
    if (peopleFilter === 'confirmed') return Boolean(person.confirmedAt);
    if (peopleFilter === 'pending') return !person.confirmedAt;
    return true;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Comunicação"
        tone="view"
        title={post.title}
        description={post.summary ?? undefined}
        breadcrumbs={[
          { label: 'Comunicação', href: '/comunicacao' },
          { label: 'Publicações', href: '/comunicacao/publicacoes' },
          { label: post.title },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <Button asChild variant="outline">
                <Link href={`/comunicacao/publicacoes/${post.id}/editar`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Link>
              </Button>
            )}
            <Button variant="outline" onClick={() => duplicate.mutate()} disabled={duplicate.isPending}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicar
            </Button>
            {post.status === 'PENDING_APPROVAL' && canApprove && (
              <>
                <Button variant="outline" onClick={() => changeStatus.mutate({ next: 'REJECTED', comment: 'Devolvida para ajustes.' })}>
                  <Undo2 className="mr-2 h-4 w-4" />
                  Devolver
                </Button>
                <Button onClick={() => changeStatus.mutate({ next: 'PUBLISHED' })}>
                  <Send className="mr-2 h-4 w-4" />
                  Aprovar e publicar
                </Button>
              </>
            )}
            {canPublish && post.status !== 'PUBLISHED' && post.status !== 'ARCHIVED' && post.status !== 'PENDING_APPROVAL' && (
              <Button onClick={() => changeStatus.mutate({ next: 'PUBLISHED' })}>
                <Send className="mr-2 h-4 w-4" />
                Publicar agora
              </Button>
            )}
            {canPublish && post.status === 'PUBLISHED' && (
              <Button variant="outline" onClick={() => changeStatus.mutate({ next: 'EXPIRED' })}>
                <Square className="mr-2 h-4 w-4" />
                Encerrar
              </Button>
            )}
            {canPublish && post.status !== 'ARCHIVED' && (
              <Button variant="outline" onClick={() => changeStatus.mutate({ next: 'ARCHIVED' })}>
                <Archive className="mr-2 h-4 w-4" />
                Arquivar
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={post.status} />
        <CategoryChip name={post.category} color={post.categoryColor} />
        <span className="text-xs text-muted-foreground">
          {post.authorName} · criada em {formatDate(post.createdAt)}
          {post.publishedAt && ` · publicada em ${formatDate(post.publishedAt)}`}
          {post.expiresAt && ` · encerra em ${formatDate(post.expiresAt)}`}
        </span>
      </div>

      {post.status === 'REJECTED' && post.approvalComment && (
        <div className="rounded-md border border-rose-300/60 bg-rose-500/8 px-4 py-3 text-sm text-rose-800 dark:text-rose-300">
          <strong>Devolvida:</strong> {post.approvalComment}
        </div>
      )}

      <Tabs defaultValue="conteudo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
          {canSeeMetrics && <TabsTrigger value="metricas">Métricas</TabsTrigger>}
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="conteudo">
          <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
            <Card className="overflow-hidden">
              {post.layout !== 'TEXT_ONLY' && post.coverImageUrl && (
                <CoverImage url={post.coverImageUrl} alt={post.coverImageAlt} aspect="aspect-[16/9]" />
              )}
              <CardContent className="space-y-4 p-5">
                <h2 className="text-xl font-semibold">{post.title}</h2>
                {post.summary && <p className="text-muted-foreground">{post.summary}</p>}
                <div className="whitespace-pre-line text-sm leading-relaxed">{post.content}</div>
                {post.gallery.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {post.gallery.map((item) => (
                      <CoverImage key={item.id} url={item.url} alt={item.alt} aspect="aspect-square" className="rounded-md" />
                    ))}
                  </div>
                )}
                {post.attachments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Anexos</p>
                    {post.attachments.map((item) => (
                      <a
                        key={item.id}
                        href={item.url ?? '#'}
                        download={item.name}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {item.name}
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
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-4 text-sm">
                <Info label="Público" value={post.audienceLabel} />
                <Info label="Destinatários" value={`${post.audienceTotal} pessoa(s)`} />
                <Info label="Formato" value={post.layout} />
                <Info label="Comunicação Interna" value={post.showInEmployeeFeed ? 'Exibida no feed' : 'Não exibida'} />
                <Info label="Destaque" value={post.isFeatured ? 'Sim' : 'Não'} />
                <Info
                  label="Confirmação de leitura"
                  value={post.requiresReadConfirmation ? 'Obrigatória' : 'Não exigida'}
                />
                <Info label="Notificação interna" value={post.notifyInApp ? 'Enviada' : 'Não enviada'} />
                <Info label="Aviso por e-mail" value={post.notifyEmail ? 'Enviado' : 'Não enviado'} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {canSeeMetrics && (
          <TabsContent value="metricas" className="space-y-4">
            {metrics.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricTile label="Público total" value={metrics.data?.summary.audienceTotal ?? 0} />
                  <MetricTile label="Visualizações" value={metrics.data?.summary.views ?? 0} />
                  <MetricTile label="Não visualizaram" value={metrics.data?.summary.notViewed ?? 0} />
                  <MetricTile
                    label="Taxa de leitura"
                    value={`${((metrics.data?.summary.readRate ?? 0) * 100).toFixed(0)}%`}
                  />
                  {post.requiresReadConfirmation && (
                    <>
                      <MetricTile label="Confirmações" value={metrics.data?.summary.confirmations ?? 0} />
                      <MetricTile label="Confirmações pendentes" value={metrics.data?.summary.pendingConfirmations ?? 0} />
                      <MetricTile
                        label="Taxa de confirmação"
                        value={`${((metrics.data?.summary.confirmationRate ?? 0) * 100).toFixed(0)}%`}
                      />
                    </>
                  )}
                </div>

                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            ['all', 'Todos'],
                            ['viewed', 'Visualizaram'],
                            ['not-viewed', 'Não visualizaram'],
                            ...(post.requiresReadConfirmation
                              ? ([
                                  ['confirmed', 'Confirmaram'],
                                  ['pending', 'Não confirmaram'],
                                ] as const)
                              : []),
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setPeopleFilter(value as typeof peopleFilter)}
                            className={cn(
                              'rounded-full border px-3 py-1 text-xs transition-colors',
                              peopleFilter === value
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-muted',
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          className="h-8 w-48"
                          placeholder="Buscar pessoa..."
                          value={peopleSearch}
                          onChange={(event) => setPeopleSearch(event.target.value)}
                        />
                        {hasPermission(['communication:export', 'communication:manage']) && (
                          <Button variant="outline" size="sm" onClick={() => void exportCsv()}>
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            Exportar
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="max-h-[420px] overflow-auto rounded-md border">
                      <table className="w-full min-w-[560px] text-sm">
                        <thead className="sticky top-0 border-b bg-muted/60 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Colaborador</th>
                            <th className="px-3 py-2 text-left font-medium">Área</th>
                            <th className="px-3 py-2 text-left font-medium">Visualizou</th>
                            {post.requiresReadConfirmation && (
                              <th className="px-3 py-2 text-left font-medium">Confirmou</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {people.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                                Nenhuma pessoa neste filtro.
                              </td>
                            </tr>
                          ) : (
                            people.map((person) => (
                              <tr key={person.userId}>
                                <td className="px-3 py-2">{person.name}</td>
                                <td className="px-3 py-2 text-muted-foreground">{person.area ?? '—'}</td>
                                <td className="px-3 py-2 text-muted-foreground">
                                  {person.viewedAt ? formatDate(person.viewedAt) : '—'}
                                </td>
                                {post.requiresReadConfirmation && (
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {person.confirmedAt ? formatDate(person.confirmedAt) : '—'}
                                  </td>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        )}

        <TabsContent value="historico">
          <Card>
            <CardContent className="p-4">
              {(post.history ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sem alterações registradas.</p>
              ) : (
                <ol className="space-y-2.5">
                  {[...(post.history ?? [])].reverse().map((entry, index) => (
                    <li key={`${entry.at}-${index}`} className="flex flex-wrap items-baseline gap-2 text-sm">
                      <span className="w-36 shrink-0 text-xs text-muted-foreground">{formatDate(entry.at)}</span>
                      <span className="font-medium">{entry.action}</span>
                      <span className="text-muted-foreground">por {entry.by}</span>
                      {entry.note && <span className="text-muted-foreground">— {entry.note}</span>}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
