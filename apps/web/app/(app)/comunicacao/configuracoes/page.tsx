'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { CategoryChip } from '@/components/communication/publication-bits';
import type { PublicationCategory } from '@/lib/communication/publications';

interface SettingsResponse {
  settings: { approvalRequired: boolean; defaultEmployeeFeed: boolean };
  categories: PublicationCategory[];
}

export default function ComunicacaoConfiguracoesPage() {
  const qc = useQueryClient();
  const [newCategory, setNewCategory] = useState('');
  const [newColor, setNewColor] = useState('#0ea5e9');

  const data = useQuery<SettingsResponse>({
    queryKey: ['communication-settings'],
    queryFn: () => api('/communication/settings'),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['communication-settings'] });
    void qc.invalidateQueries({ queryKey: ['communication-categories'] });
  };

  const updateSettings = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/communication/settings', { method: 'PATCH', json: body }),
    onSuccess: () => {
      toast.success('Configuração salva.');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createCategory = useMutation({
    mutationFn: () => api('/communication/settings/categories', { method: 'POST', json: { name: newCategory, color: newColor } }),
    onSuccess: () => {
      toast.success('Categoria criada.');
      setNewCategory('');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleCategory = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api(`/communication/settings/categories/${id}`, { method: 'PATCH', json: { active } }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const removeCategory = useMutation({
    mutationFn: (id: string) => api(`/communication/settings/categories/${id}`, { method: 'DELETE' }),
    onSuccess: (result: any) => {
      toast.success(result?.deactivated ? 'Categoria em uso — foi desativada.' : 'Categoria excluída.');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Comunicação"
        tone="admin"
        title="Configurações"
        description="Categorias de publicação e fluxo de aprovação da empresa."
        breadcrumbs={[{ label: 'Comunicação', href: '/comunicacao' }, { label: 'Configurações' }]}
      />

      {data.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <h3 className="text-sm font-semibold">Fluxo de aprovação</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Quando habilitado, toda publicação passa por um aprovador antes de ir ao ar.
                </p>
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-md border p-3 hover:bg-muted/40">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={data.data?.settings.approvalRequired ?? false}
                  onChange={(event) => updateSettings.mutate({ approvalRequired: event.target.checked })}
                />
                <span>
                  <span className="block text-sm">Exigir aprovação antes de publicar</span>
                  <span className="block text-[11px] text-muted-foreground">
                    O autor cria, envia para aprovação e o aprovador publica ou devolve com observação.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-md border p-3 hover:bg-muted/40">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={data.data?.settings.defaultEmployeeFeed ?? true}
                  onChange={(event) => updateSettings.mutate({ defaultEmployeeFeed: event.target.checked })}
                />
                <span>
                  <span className="block text-sm">Exibir na Comunicação Interna por padrão</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Publicações novas já nascem marcadas para o feed do colaborador.
                  </span>
                </span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <h3 className="text-sm font-semibold">Categorias</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Usadas para classificar e filtrar as publicações no feed.
                </p>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">Nova categoria</Label>
                  <Input
                    value={newCategory}
                    onChange={(event) => setNewCategory(event.target.value)}
                    placeholder="Ex.: Sustentabilidade"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cor</Label>
                  <input
                    type="color"
                    value={newColor}
                    onChange={(event) => setNewColor(event.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                    aria-label="Cor da categoria"
                  />
                </div>
                <Button onClick={() => createCategory.mutate()} disabled={!newCategory.trim() || createCategory.isPending}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="divide-y rounded-md border">
                {(data.data?.categories ?? []).map((category) => (
                  <div key={category.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <CategoryChip name={category.name} color={category.color} />
                    <div className="flex items-center gap-2">
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={category.active}
                          onChange={(event) => toggleCategory.mutate({ id: category.id, active: event.target.checked })}
                        />
                        Ativa
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => removeCategory.mutate(category.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {(data.data?.categories ?? []).length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
