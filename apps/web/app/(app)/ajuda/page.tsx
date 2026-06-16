'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Eye, Loader2, Search, ThumbsDown, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { EmptyState } from '@/components/platform/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

interface HelpArticleSummary {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  tags: string[];
  updatedAt: string;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
}

interface HelpCategory {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
  articles: HelpArticleSummary[];
}

interface HelpSummary {
  categories: HelpCategory[];
  popular: HelpArticleSummary[];
}

interface HelpArticle extends HelpArticleSummary {
  body: string;
  category: { id: string; slug: string; title: string; icon: string | null } | null;
}

export default function HelpCenterPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('todos');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const search = query.trim();

  const summary = useQuery<HelpSummary>({
    queryKey: ['help', search],
    queryFn: () => api(`/help${search ? `?q=${encodeURIComponent(search)}` : ''}`),
  });

  const categories = useMemo(() => summary.data?.categories ?? [], [summary.data?.categories]);
  const allArticles = useMemo(() => categories.flatMap((category) => category.articles), [categories]);
  const visibleArticles = activeCategory === 'todos'
    ? allArticles
    : categories.find((category) => category.slug === activeCategory)?.articles ?? [];
  const selected = selectedSlug ?? visibleArticles[0]?.slug ?? summary.data?.popular[0]?.slug ?? null;

  const article = useQuery<HelpArticle>({
    queryKey: ['help', 'article', selected],
    queryFn: () => api(`/help/articles/${selected}`),
    enabled: !!selected,
  });

  const feedback = useMutation({
    mutationFn: (helpful: boolean) =>
      api(`/help/articles/${selected}/feedback`, {
        method: 'POST',
        json: { helpful },
      }),
    onSuccess: () => {
      toast.success('Retorno registrado.');
      qc.invalidateQueries({ queryKey: ['help'] });
      if (selected) qc.invalidateQueries({ queryKey: ['help', 'article', selected] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível registrar o retorno'),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Central de Ajuda"
        description="Artigos, fluxos e respostas para usar o Gestão 360 no dia a dia."
        eyebrow="Suporte"
      />

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <SectionCard title="Base de Conhecimento" description="Busque por processo, tela ou palavra-chave.">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar artigo..." className="pl-9" />
            </div>

            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="todos">Todos</TabsTrigger>
                {categories.map((category) => (
                  <TabsTrigger key={category.slug} value={category.slug}>
                    {category.title}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value={activeCategory} className="mt-3">
                {summary.isLoading && (
                  <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando artigos...
                  </div>
                )}
                {!summary.isLoading && visibleArticles.length === 0 && (
                  <EmptyState title="Nada encontrado" description="Tente outra busca ou categoria." className="border-0 bg-transparent" />
                )}
                <div className="space-y-2">
                  {visibleArticles.map((item) => (
                    <button
                      key={item.slug}
                      type="button"
                      onClick={() => setSelectedSlug(item.slug)}
                      className={cn(
                        'w-full rounded-md border px-3 py-2 text-left transition hover:bg-muted/50',
                        selected === item.slug && 'border-foreground bg-foreground/[0.04]',
                      )}
                    >
                      <span className="block text-sm font-medium">{item.title}</span>
                      {item.summary && <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{item.summary}</span>}
                      <span className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Eye className="h-3 w-3" /> {item.viewCount}
                      </span>
                    </button>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </SectionCard>

        <SectionCard
          title={article.data?.title ?? 'Artigo'}
          description={article.data?.category?.title ?? 'Central de Ajuda'}
          actions={
            article.data ? (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <BookOpen className="h-4 w-4" />
                {formatDate(article.data.updatedAt)}
              </div>
            ) : null
          }
        >
          {article.isLoading && (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Abrindo artigo...
            </div>
          )}
          {!article.isLoading && !article.data && (
            <EmptyState title="Selecione um artigo" description="Os detalhes aparecem aqui." className="border-0 bg-transparent" />
          )}
          {article.data && (
            <article className="space-y-4">
              {article.data.summary && <p className="text-sm text-muted-foreground">{article.data.summary}</p>}
              <div className="flex flex-wrap gap-1">
                {article.data.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
              <div className="whitespace-pre-wrap rounded-md border bg-muted/20 p-4 text-sm leading-6 text-foreground">
                {article.data.body}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                <div className="text-xs text-muted-foreground">
                  {article.data.helpfulCount} marcaram como útil · {article.data.notHelpfulCount} marcaram como não útil
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => feedback.mutate(true)} disabled={feedback.isPending}>
                    <ThumbsUp className="mr-2 h-4 w-4" /> Útil
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => feedback.mutate(false)} disabled={feedback.isPending}>
                    <ThumbsDown className="mr-2 h-4 w-4" /> Não útil
                  </Button>
                </div>
              </div>
            </article>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
