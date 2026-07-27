'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Eye, Images, Megaphone, Plus, ClipboardCheck } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { CategoryChip, CoverImage, StatusBadge } from '@/components/communication/publication-bits';
import type { Publication, PublicationOverview } from '@/lib/communication/publications';

export default function ComunicacaoPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['communication:create', 'communication:manage']);

  const overview = useQuery<PublicationOverview>({
    queryKey: ['communication-overview'],
    queryFn: () => api('/communication/publications/overview'),
  });
  const data = overview.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comunicação"
        tone="view"
        title="Comunicação Interna"
        description="Crie, programe e acompanhe as comunicações enviadas aos colaboradores."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/comunicacao/midias">
                <Images className="mr-2 h-4 w-4" />
                Biblioteca de mídias
              </Link>
            </Button>
            {canCreate && (
              <Button asChild>
                <Link href="/comunicacao/publicacoes/nova">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova publicação
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Publicações ativas" value={data?.metrics.active} icon={Megaphone} loading={overview.isLoading} />
        <Metric label="Publicações programadas" value={data?.metrics.scheduled} icon={CalendarClock} loading={overview.isLoading} />
        <Metric label="Visualizações no mês" value={data?.metrics.viewsThisMonth} icon={Eye} loading={overview.isLoading} />
        <Metric
          label="Confirmações pendentes"
          value={data?.metrics.pendingConfirmations}
          icon={ClipboardCheck}
          loading={overview.isLoading}
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Publicações recentes</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/comunicacao/publicacoes">Ver todas</Link>
          </Button>
        </div>
        {overview.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (data?.recent.length ?? 0) === 0 ? (
          <EmptyBlock
            message="Nenhuma publicação divulgada ainda."
            actionLabel={canCreate ? 'Criar primeira publicação' : undefined}
            href="/comunicacao/publicacoes/nova"
          />
        ) : (
          <RecentTable posts={data!.recent} />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Publicações programadas</h2>
        {overview.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (data?.scheduledPosts.length ?? 0) === 0 ? (
          <EmptyBlock
            message="Nenhuma publicação programada."
            actionLabel={canCreate ? 'Programar publicação' : undefined}
            href="/comunicacao/publicacoes/nova?agendar=1"
          />
        ) : (
          <div className="divide-y rounded-lg border bg-card">
            {data!.scheduledPosts.map((post) => (
              <Link
                key={post.id}
                href={`/comunicacao/publicacoes/${post.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{post.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {post.category} · {post.audienceLabel}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {formatDate(post.publishAt)}
                  </span>
                  <StatusBadge status={post.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value?: number;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-1.5 h-7 w-12" />
          ) : (
            <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value ?? 0}</p>
          )}
        </div>
        <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

function RecentTable({ posts }: { posts: Publication[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">Publicação</th>
            <th className="px-4 py-2.5 text-left font-medium">Categoria</th>
            <th className="px-4 py-2.5 text-left font-medium">Público</th>
            <th className="px-4 py-2.5 text-left font-medium">Publicada em</th>
            <th className="px-4 py-2.5 text-left font-medium">Status</th>
            <th className="px-4 py-2.5 text-right font-medium">Visualizações</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {posts.map((post) => (
            <tr key={post.id} className="transition-colors hover:bg-muted/40">
              <td className="px-4 py-2.5">
                <Link href={`/comunicacao/publicacoes/${post.id}`} className="flex items-center gap-3">
                  <CoverImage
                    url={post.coverImageUrl}
                    alt={post.coverImageAlt}
                    aspect="aspect-[16/9]"
                    className="h-10 w-16 shrink-0 rounded"
                  />
                  <span className="min-w-0 font-medium hover:underline">{post.title}</span>
                </Link>
              </td>
              <td className="px-4 py-2.5">
                <CategoryChip name={post.category} color={post.categoryColor} />
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{post.audienceLabel}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{formatDate(post.publishedAt)}</td>
              <td className="px-4 py-2.5">
                <StatusBadge status={post.status} />
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {post.views}
                <span className="text-muted-foreground"> / {post.audienceTotal}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyBlock({ message, actionLabel, href }: { message: string; actionLabel?: string; href: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-card/50 px-4 py-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {actionLabel && (
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href={href}>
            <Plus className="mr-2 h-4 w-4" />
            {actionLabel}
          </Link>
        </Button>
      )}
    </div>
  );
}
