'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BookOpen, Plus, Save } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

interface HelpArticle {
  id: string;
  categoryId: string | null;
  slug: string;
  title: string;
  summary: string | null;
  body: string;
  tags: string[];
  status: 'PUBLISHED' | 'DRAFT';
  updatedAt: string;
}

interface HelpCategory {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  articles: HelpArticle[];
}

interface HelpAdminResponse {
  categories: HelpCategory[];
}

const emptyForm = {
  id: '',
  categoryId: '',
  slug: '',
  title: '',
  summary: '',
  body: '',
  tags: '',
  status: 'PUBLISHED' as 'PUBLISHED' | 'DRAFT',
};

export function HelpTab() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>('');
  const [form, setForm] = useState(emptyForm);

  const query = useQuery<HelpAdminResponse>({
    queryKey: ['admin', 'help'],
    queryFn: () => api('/admin/help'),
    refetchOnWindowFocus: false,
  });

  const categories = query.data?.categories ?? [];
  const articles = useMemo(() => categories.flatMap((category) => category.articles.map((article) => ({ ...article, categoryTitle: category.title }))), [categories]);
  const selected = articles.find((article) => article.id === selectedId);

  useEffect(() => {
    if (!selected) return;
    setForm({
      id: selected.id,
      categoryId: selected.categoryId ?? '',
      slug: selected.slug,
      title: selected.title,
      summary: selected.summary ?? '',
      body: selected.body,
      tags: selected.tags.join(', '),
      status: selected.status,
    });
  }, [selected]);

  const save = useMutation({
    mutationFn: () =>
      api(`/admin/help/articles${form.id ? `/${form.id}` : ''}`, {
        method: form.id ? 'PUT' : 'POST',
        json: {
          categoryId: form.categoryId || null,
          slug: form.slug || undefined,
          title: form.title,
          summary: form.summary || null,
          body: form.body,
          tags: form.tags,
          status: form.status,
        },
      }),
    onSuccess: () => {
      toast.success('Artigo salvo.');
      qc.invalidateQueries({ queryKey: ['admin', 'help'] });
      qc.invalidateQueries({ queryKey: ['help'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const startNew = () => {
    setSelectedId('');
    setForm({ ...emptyForm, categoryId: categories[0]?.id ?? '' });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <SectionCard
        title="Artigos"
        description="Conteúdo exibido na Central de Ajuda."
        actions={
          <Button size="sm" onClick={startNew}>
            <Plus className="mr-2 h-4 w-4" /> Novo
          </Button>
        }
      >
        {query.isLoading && <LoadingState label="Lendo artigos..." />}
        {!query.isLoading && articles.length === 0 && (
          <div className="py-10 text-center text-xs text-muted-foreground">Nenhum artigo cadastrado.</div>
        )}
        <div className="space-y-2">
          {articles.map((article) => (
            <button
              key={article.id}
              type="button"
              onClick={() => setSelectedId(article.id)}
              className={cn(
                'w-full rounded-md border px-3 py-2 text-left text-sm transition hover:bg-muted/40',
                selectedId === article.id && 'border-primary/40 bg-primary/5',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{article.title}</span>
                <Badge variant={article.status === 'PUBLISHED' ? 'secondary' : 'outline'}>
                  {article.status === 'PUBLISHED' ? 'Publicado' : 'Rascunho'}
                </Badge>
              </span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">{article.categoryTitle}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title={form.id ? 'Editar artigo' : 'Novo artigo'}
        description="Alterações salvas aqui aparecem na Central de Ajuda."
        actions={
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim() || !form.body.trim()}>
            <Save className="mr-2 h-4 w-4" /> Salvar
          </Button>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Slug</Label>
            <Input value={form.slug} onChange={(e) => setForm((current) => ({ ...current, slug: e.target.value }))} placeholder="gerado pelo título" />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <NativeSelect value={form.categoryId} onChange={(e) => setForm((current) => ({ ...current, categoryId: e.target.value }))}>
              <option value="">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.title}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <NativeSelect value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value as 'PUBLISHED' | 'DRAFT' }))}>
              <option value="PUBLISHED">Publicado</option>
              <option value="DRAFT">Rascunho</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Resumo</Label>
            <Input value={form.summary} onChange={(e) => setForm((current) => ({ ...current, summary: e.target.value }))} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Tags</Label>
            <Input value={form.tags} onChange={(e) => setForm((current) => ({ ...current, tags: e.target.value }))} placeholder="separadas por virgula" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Conteúdo</Label>
            <Textarea value={form.body} onChange={(e) => setForm((current) => ({ ...current, body: e.target.value }))} rows={12} />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          Artigos publicados ficam disponíveis em /ajuda para usuários autenticados.
        </div>
      </SectionCard>
    </div>
  );
}
