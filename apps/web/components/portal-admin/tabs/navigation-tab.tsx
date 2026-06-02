'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, EyeOff, Save, RefreshCcw, Undo2 } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { navSections, settingsNavItem, type NavSection, type NavItem } from '@/components/shell/navigation';
import { useState } from 'react';

interface NavOverride {
  id: string;
  itemKey: string;
  kind: string;
  hidden: boolean;
  order: number | null;
  labelOverride: string | null;
  iconOverride: string | null;
  groupOverride: string | null;
}

export function NavigationTab() {
  const qc = useQueryClient();
  const [editingLabels, setEditingLabels] = useState<Record<string, string>>({});

  const overrides = useQuery<NavOverride[]>({
    queryKey: ['portal', 'navigation'],
    queryFn: () => api('/admin/portal/navigation'),
    refetchOnWindowFocus: false,
  });

  const upsertMut = useMutation({
    mutationFn: (v: { itemKey: string; hidden?: boolean; labelOverride?: string | null; order?: number | null }) =>
      api('/admin/portal/navigation', { method: 'PUT', json: v }),
    onSuccess: () => {
      toast.success('Alteração salva com sucesso.');
      qc.invalidateQueries({ queryKey: ['portal', 'navigation'] });
      qc.invalidateQueries({ queryKey: ['portal', 'config'] }); // Atualiza sidebar e shell
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (itemKey: string) =>
      api(`/admin/portal/navigation/${encodeURIComponent(itemKey)}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Personalizações removidas.');
      qc.invalidateQueries({ queryKey: ['portal', 'navigation'] });
      qc.invalidateQueries({ queryKey: ['portal', 'config'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const rows = overrides.data ?? [];
  const overridesMap = new Map<string, NavOverride>();
  rows.forEach((r) => overridesMap.set(r.itemKey, r));

  function handleSaveLabel(key: string, originalLabel: string) {
    const val = editingLabels[key];
    if (val === undefined) return;
    const finalVal = val.trim() === originalLabel || val.trim() === '' ? null : val.trim();
    upsertMut.mutate({ itemKey: key, labelOverride: finalVal });
  }

  function handleToggleHidden(key: string, currentHidden: boolean) {
    upsertMut.mutate({ itemKey: key, hidden: !currentHidden });
  }

  function handleOrderChange(key: string, val: string) {
    const num = parseInt(val, 10);
    upsertMut.mutate({ itemKey: key, order: isNaN(num) ? null : num });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Gerencie o menu lateral do Gestão 360. As alterações se aplicam de imediato no painel de navegação.
        </p>
        <Button variant="ghost" size="sm" onClick={() => overrides.refetch()} disabled={overrides.isFetching}>
          <RefreshCcw className={cn('mr-2 h-4 w-4', overrides.isFetching && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {overrides.isLoading && <LoadingState label="Carregando overrides do menu..." />}

      {!overrides.isLoading && (
        <div className="space-y-6">
          {navSections.map((sect) => {
            const sectOverride = overridesMap.get(sect.heading);
            const isSectHidden = sectOverride?.hidden ?? false;
            const sectOrder = sectOverride?.order ?? null;

            return (
              <SectionCard
                key={sect.heading}
                title={`${sect.heading} ${isSectHidden ? '(Oculto)' : ''}`}
                description={sect.description}
                className={cn(isSectHidden && 'opacity-60 bg-muted/10')}
                actions={
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Ordem:</span>
                    <Input
                      type="number"
                      className="w-16 h-7 text-xs"
                      defaultValue={sectOrder ?? ''}
                      placeholder="Std"
                      onBlur={(e) => handleOrderChange(sect.heading, e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleHidden(sect.heading, isSectHidden)}
                      title={isSectHidden ? 'Exibir Seção' : 'Ocultar Seção'}
                    >
                      {isSectHidden ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-primary" />}
                    </Button>
                    {sectOverride && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMut.mutate(sect.heading)}
                        title="Restaurar padrão"
                      >
                        <Undo2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                }
              >
                <div className="overflow-x-auto">
                  <table className="table-modern">
                    <thead>
                      <tr>
                        <th className="text-left w-1/3">Item do Menu</th>
                        <th className="text-left w-1/4">Link (Href)</th>
                        <th className="text-left w-1/6">Ordem</th>
                        <th className="text-left">Rótulo Exibido</th>
                        <th className="text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sect.items.map((item) => {
                        const itemOverride = overridesMap.get(item.href);
                        const isHidden = itemOverride?.hidden ?? false;
                        const itemOrder = itemOverride?.order ?? null;
                        const labelValue = editingLabels[item.href] ?? itemOverride?.labelOverride ?? item.label;

                        return (
                          <tr key={item.href} className={cn(isHidden && 'opacity-50 line-through bg-muted/5')}>
                            <td>
                              <div className="flex items-center gap-2">
                                <item.icon className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium text-sm">{item.label}</span>
                              </div>
                            </td>
                            <td className="font-mono text-xs text-muted-foreground">{item.href}</td>
                            <td>
                              <Input
                                type="number"
                                className="w-16 h-7 text-xs"
                                defaultValue={itemOrder ?? ''}
                                placeholder="Std"
                                onBlur={(e) => handleOrderChange(item.href, e.target.value)}
                              />
                            </td>
                            <td>
                              <div className="flex items-center gap-1">
                                <Input
                                  className="h-8 text-xs max-w-[200px]"
                                  value={labelValue}
                                  onChange={(e) => setEditingLabels({ ...editingLabels, [item.href]: e.target.value })}
                                />
                                {editingLabels[item.href] !== undefined && editingLabels[item.href] !== (itemOverride?.labelOverride ?? item.label) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSaveLabel(item.href, item.label)}
                                    title="Salvar rótulo"
                                  >
                                    <Save className="h-3.5 w-3.5 text-primary" />
                                  </Button>
                                )}
                              </div>
                            </td>
                            <td className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleHidden(item.href, isHidden)}
                                  title={isHidden ? 'Exibir' : 'Ocultar'}
                                >
                                  {isHidden ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-primary" />}
                                </Button>
                                {itemOverride && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeMut.mutate(item.href)}
                                    title="Restaurar padrão"
                                  >
                                    <Undo2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            );
          })}

          {/* Item avulso: Configurações */}
          {(() => {
            const confOverride = overridesMap.get(settingsNavItem.href);
            const isConfHidden = confOverride?.hidden ?? false;
            const confOrder = confOverride?.order ?? null;
            const confLabel = editingLabels[settingsNavItem.href] ?? confOverride?.labelOverride ?? settingsNavItem.label;

            return (
              <SectionCard
                title="Itens Globais / Sistema"
                description="Item de rodapé do menu lateral."
                className={cn(isConfHidden && 'opacity-60 bg-muted/10')}
              >
                <div className="overflow-x-auto">
                  <table className="table-modern">
                    <thead>
                      <tr>
                        <th className="text-left w-1/3">Item do Menu</th>
                        <th className="text-left w-1/4">Link (Href)</th>
                        <th className="text-left w-1/6">Ordem</th>
                        <th className="text-left">Rótulo Exibido</th>
                        <th className="text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className={cn(isConfHidden && 'opacity-50 line-through bg-muted/5')}>
                        <td>
                          <div className="flex items-center gap-2">
                            <settingsNavItem.icon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{settingsNavItem.label}</span>
                          </div>
                        </td>
                        <td className="font-mono text-xs text-muted-foreground">{settingsNavItem.href}</td>
                        <td>
                          <Input
                            type="number"
                            className="w-16 h-7 text-xs"
                            defaultValue={confOrder ?? ''}
                            placeholder="Std"
                            onBlur={(e) => handleOrderChange(settingsNavItem.href, e.target.value)}
                          />
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <Input
                              className="h-8 text-xs max-w-[200px]"
                              value={confLabel}
                              onChange={(e) => setEditingLabels({ ...editingLabels, [settingsNavItem.href]: e.target.value })}
                            />
                            {editingLabels[settingsNavItem.href] !== undefined && editingLabels[settingsNavItem.href] !== (confOverride?.labelOverride ?? settingsNavItem.label) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSaveLabel(settingsNavItem.href, settingsNavItem.label)}
                                title="Salvar rótulo"
                              >
                                <Save className="h-3.5 w-3.5 text-primary" />
                              </Button>
                            )}
                          </div>
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleHidden(settingsNavItem.href, isConfHidden)}
                              title={isConfHidden ? 'Exibir' : 'Ocultar'}
                            >
                              {isConfHidden ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-primary" />}
                            </Button>
                            {confOverride && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeMut.mutate(settingsNavItem.href)}
                                title="Restaurar padrão"
                              >
                                <Undo2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            );
          })()}
        </div>
      )}
    </div>
  );
}
