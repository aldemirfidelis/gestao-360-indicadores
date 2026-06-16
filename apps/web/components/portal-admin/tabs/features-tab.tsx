'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Edit3, Plus, Power, RefreshCcw, Trash2 } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PORTAL_STATUS_TONE, type PortalFeatureRow, type PortalFeatureFlagRow } from '@/components/portal-admin/types';

const ROLES = [
  { value: 'SUPER_ADMIN', label: 'superadministrador' },
  { value: 'COMPANY_ADMIN', label: 'Admin da Empresa' },
  { value: 'DIRECTOR', label: 'Diretor' },
  { value: 'MANAGER', label: 'Gestor' },
  { value: 'ANALYST', label: 'Analista' },
  { value: 'COLLABORATOR', label: 'Colaborador' },
  { value: 'VIEWER', label: 'Visualizador' },
];

export function FeaturesTab() {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<'catalog' | 'flags'>('catalog');

  // --- Catálogo de Funcionalidades ---
  const [editingFeat, setEditingFeat] = useState<PortalFeatureRow | null>(null);
  const [featForm, setFeatForm] = useState<{
    description: string;
    flagKey: string;
    allowedRoles: string[];
  } | null>(null);

  const features = useQuery<PortalFeatureRow[]>({
    queryKey: ['portal', 'features'],
    queryFn: () => api('/admin/portal/features'),
    refetchOnWindowFocus: false,
    enabled: subTab === 'catalog',
  });

  const featStatusMut = useMutation({
    mutationFn: (v: { code: string; status: string }) =>
      api(`/admin/portal/features/${v.code}/status`, { method: 'POST', json: { status: v.status } }),
    onSuccess: () => {
      toast.success('Status da funcionalidade atualizado.');
      qc.invalidateQueries({ queryKey: ['portal', 'features'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const featUpdateMut = useMutation({
    mutationFn: (v: { code: string; data: any }) =>
      api(`/admin/portal/features/${v.code}`, { method: 'PUT', json: v.data }),
    onSuccess: () => {
      toast.success('Funcionalidade configurada com sucesso.');
      setEditingFeat(null);
      setFeatForm(null);
      qc.invalidateQueries({ queryKey: ['portal', 'features'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  function startEditFeat(feat: PortalFeatureRow) {
    setEditingFeat(feat);
    let allowed: string[] = [];
    try {
      allowed = typeof feat.allowedRoles === 'string' ? JSON.parse(feat.allowedRoles) : (feat.allowedRoles || []);
    } catch {
      allowed = [];
    }
    setFeatForm({
      description: feat.description || '',
      flagKey: feat.flagKey || '',
      allowedRoles: allowed,
    });
  }

  // --- Feature Flags ---
  const [editingFlag, setEditingFlag] = useState<PortalFeatureFlagRow | null>(null);
  const [isCreatingFlag, setIsCreatingFlag] = useState(false);
  const [flagForm, setFlagForm] = useState<{
    key: string;
    name: string;
    description: string;
    enabled: boolean;
    rolloutPercentage: number | '';
    allowedRoles: string[];
    environment: string;
    experimental: boolean;
    scheduledOnAt: string;
    scheduledOffAt: string;
  } | null>(null);

  const flags = useQuery<PortalFeatureFlagRow[]>({
    queryKey: ['portal', 'flags'],
    queryFn: () => api('/admin/portal/flags'),
    refetchOnWindowFocus: false,
    enabled: subTab === 'flags',
  });

  const flagUpsertMut = useMutation({
    mutationFn: (v: typeof flagForm) => api('/admin/portal/flags', { method: 'PUT', json: v }),
    onSuccess: () => {
      toast.success('Feature Flag salva com sucesso.');
      setEditingFlag(null);
      setIsCreatingFlag(false);
      setFlagForm(null);
      qc.invalidateQueries({ queryKey: ['portal', 'flags'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const flagDeleteMut = useMutation({
    mutationFn: (key: string) => api(`/admin/portal/flags/${key}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Feature Flag excluída.');
      qc.invalidateQueries({ queryKey: ['portal', 'flags'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  function startCreateFlag() {
    setIsCreatingFlag(true);
    setFlagForm({
      key: '',
      name: '',
      description: '',
      enabled: false,
      rolloutPercentage: '',
      allowedRoles: [],
      environment: '',
      experimental: false,
      scheduledOnAt: '',
      scheduledOffAt: '',
    });
  }

  function startEditFlag(flag: PortalFeatureFlagRow) {
    setEditingFlag(flag);
    let allowed: string[] = [];
    try {
      allowed = typeof flag.allowedRoles === 'string' ? JSON.parse(flag.allowedRoles) : (flag.allowedRoles || []);
    } catch {
      allowed = [];
    }
    setFlagForm({
      key: flag.key,
      name: flag.name || '',
      description: flag.description || '',
      enabled: flag.enabled,
      rolloutPercentage: flag.rolloutPercentage ?? '',
      allowedRoles: allowed,
      environment: flag.environment || '',
      experimental: flag.experimental,
      scheduledOnAt: flag.scheduledOnAt ? new Date(flag.scheduledOnAt).toISOString().slice(0, 16) : '',
      scheduledOffAt: flag.scheduledOffAt ? new Date(flag.scheduledOffAt).toISOString().slice(0, 16) : '',
    });
  }

  function handleRoleToggle(role: string, type: 'feat' | 'flag') {
    if (type === 'feat' && featForm) {
      const exists = featForm.allowedRoles.includes(role);
      const updated = exists ? featForm.allowedRoles.filter((r) => r !== role) : [...featForm.allowedRoles, role];
      setFeatForm({ ...featForm, allowedRoles: updated });
    } else if (type === 'flag' && flagForm) {
      const exists = flagForm.allowedRoles.includes(role);
      const updated = exists ? flagForm.allowedRoles.filter((r) => r !== role) : [...flagForm.allowedRoles, role];
      setFlagForm({ ...flagForm, allowedRoles: updated });
    }
  }

  return (
    <div className="space-y-4">
      {/* Sub-abas de navegação interna */}
      <div className="flex border-b border-muted">
        <button
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            subTab === 'catalog' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setSubTab('catalog')}
        >
          Catálogo de Funções
        </button>
        <button
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            subTab === 'flags' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setSubTab('flags')}
        >
          Feature Flags (Chaves de Ativação)
        </button>
      </div>

      {subTab === 'catalog' && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Catálogo de granularidade fina do sistema.</p>
            <Button variant="ghost" size="sm" onClick={() => features.refetch()} disabled={features.isFetching}>
              <RefreshCcw className={cn('mr-2 h-4 w-4', features.isFetching && 'animate-spin')} />
              Atualizar
            </Button>
          </div>

          {features.isLoading && <LoadingState label="Lendo funcionalidades..." />}

          {features.data && features.data.length > 0 && (
            <SectionCard title="Funcionalidades" description="Configuração de restrições por perfil e vínculos a feature flags." contentClassName="p-0">
              <div className="overflow-x-auto">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th className="text-left">Funcionalidade</th>
                      <th className="text-left">Módulo</th>
                      <th className="text-left">Flag Associada</th>
                      <th className="text-left">Restrição</th>
                      <th className="text-left">Status</th>
                      <th className="text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {features.data.map((f) => {
                      let rolesArr: string[] = [];
                      try {
                        rolesArr = typeof f.allowedRoles === 'string' ? JSON.parse(f.allowedRoles) : (f.allowedRoles || []);
                      } catch {
                        rolesArr = [];
                      }
                      return (
                        <tr key={f.code}>
                          <td>
                            <div className="font-medium text-sm">{f.name}</div>
                            {f.description && <div className="text-xs text-muted-foreground">{f.description}</div>}
                            <div className="font-mono text-[9px] text-muted-foreground">{f.code}</div>
                          </td>
                          <td>
                            <Badge variant="secondary" className="font-mono text-xs">{f.moduleCode || 'global'}</Badge>
                          </td>
                          <td>
                            {f.flagKey ? (
                              <Badge variant="outline" className="font-mono text-status-blue border-status-blue/40">🚩 {f.flagKey}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td>
                            {rolesArr.length === 0 ? (
                              <span className="text-xs text-muted-foreground">Público (Todos perfis)</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {rolesArr.map((r) => (
                                  <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                                ))}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={cn('pill', PORTAL_STATUS_TONE[f.status] ?? 'pill-gray')}>{f.status}</span>
                          </td>
                          <td className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => startEditFeat(f)}>
                                <Edit3 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Ativar"
                                disabled={f.status === 'ACTIVE'}
                                onClick={() => featStatusMut.mutate({ code: f.code, status: 'ACTIVE' })}
                              >
                                <Power className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                title="Desativar"
                                disabled={f.status === 'INACTIVE'}
                                onClick={() => featStatusMut.mutate({ code: f.code, status: 'INACTIVE' })}
                              >
                                <Power className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {editingFeat && featForm && (
            <Dialog open onOpenChange={(o) => !o && setEditingFeat(null)}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Configurar Funcionalidade</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2 text-sm">
                  <div className="grid gap-1">
                    <Label>Descrição / Finalidade</Label>
                    <Input
                      value={featForm.description}
                      onChange={(e) => setFeatForm({ ...featForm, description: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label>Feature Flag Vinculada (Chave)</Label>
                    <Input
                      placeholder="enable_feature_x"
                      value={featForm.flagKey}
                      onChange={(e) => setFeatForm({ ...featForm, flagKey: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Restringir Acesso aos Perfis (Vazio = Livre)</Label>
                    <div className="grid grid-cols-2 gap-2 border rounded-md p-3 bg-muted/20">
                      {ROLES.map((r) => (
                        <label key={r.value} className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={featForm.allowedRoles.includes(r.value)}
                            onChange={() => handleRoleToggle(r.value, 'feat')}
                            className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                          />
                          <span className="text-xs">{r.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setEditingFeat(null)}>Cancelar</Button>
                  <Button
                    disabled={featUpdateMut.isPending}
                    onClick={() => featUpdateMut.mutate({
                      code: editingFeat.code,
                      data: featForm
                    })}
                  >
                    Salvar Configurações
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </>
      )}

      {subTab === 'flags' && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Gerencie as Feature Flags ativas no ambiente.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={startCreateFlag}><Plus className="h-4 w-4 mr-1.5" />Nova Flag</Button>
              <Button variant="ghost" size="sm" onClick={() => flags.refetch()} disabled={flags.isFetching}>
                <RefreshCcw className={cn('mr-2 h-4 w-4', flags.isFetching && 'animate-spin')} />
                Atualizar
              </Button>
            </div>
          </div>

          {flags.isLoading && <LoadingState label="Lendo feature flags..." />}

          {flags.data && flags.data.length > 0 && (
            <SectionCard title="Feature Flags" description="Flags dinâmicas de liberação gradual e experimental." contentClassName="p-0">
              <div className="overflow-x-auto">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th className="text-left">Chave / Nome</th>
                      <th className="text-left">Status</th>
                      <th className="text-left">Rollout</th>
                      <th className="text-left">Ambiente</th>
                      <th className="text-left">Perfis Liberados</th>
                      <th className="text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flags.data.map((flag) => {
                      let rolesArr: string[] = [];
                      try {
                        rolesArr = typeof flag.allowedRoles === 'string' ? JSON.parse(flag.allowedRoles) : (flag.allowedRoles || []);
                      } catch {
                        rolesArr = [];
                      }
                      return (
                        <tr key={flag.key}>
                          <td>
                            <div className="font-mono text-sm font-semibold text-status-blue">🚩 {flag.key}</div>
                            <div className="font-medium text-xs">{flag.name}</div>
                            {flag.description && <div className="text-xs text-muted-foreground mt-0.5">{flag.description}</div>}
                          </td>
                          <td>
                            <span className={cn('pill', flag.enabled ? 'pill-green' : 'pill-gray')}>
                              {flag.enabled ? 'Ativa' : 'Inativa'}
                            </span>
                            {flag.experimental && (
                              <Badge className="ml-1.5 bg-status-blue/15 text-status-blue border-transparent hover:bg-status-blue/20">Experimental</Badge>
                            )}
                          </td>
                          <td>{flag.rolloutPercentage !== null && flag.rolloutPercentage !== undefined ? `${flag.rolloutPercentage}%` : 'Global'}</td>
                          <td>{flag.environment ? <Badge variant="outline">{flag.environment}</Badge> : <span className="text-xs text-muted-foreground">Todos</span>}</td>
                          <td>
                            {rolesArr.length === 0 ? (
                              <span className="text-xs text-muted-foreground">Todos os perfis</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {rolesArr.map((r) => (
                                  <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => startEditFlag(flag)}>
                                <Edit3 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                title="Excluir Flag"
                                onClick={() => {
                                  if (confirm(`Deseja excluir a flag "${flag.key}"?`)) {
                                    flagDeleteMut.mutate(flag.key);
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {(editingFlag || isCreatingFlag) && flagForm && (
            <Dialog open onOpenChange={(o) => { if (!o) { setEditingFlag(null); setIsCreatingFlag(false); } }}>
              <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{isCreatingFlag ? 'Criar Feature Flag' : `Configurar Flag: ${editingFlag?.key}`}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2 text-sm">
                  <div className="grid gap-1">
                    <Label>Chave Única (Flag Key)</Label>
                    <Input
                      disabled={!isCreatingFlag}
                      placeholder="enable_new_feature"
                      value={flagForm.key}
                      onChange={(e) => setFlagForm({ ...flagForm, key: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label>Nome</Label>
                    <Input
                      value={flagForm.name}
                      onChange={(e) => setFlagForm({ ...flagForm, name: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label>Descrição</Label>
                    <Input
                      value={flagForm.description}
                      onChange={(e) => setFlagForm({ ...flagForm, description: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center justify-between border rounded p-2.5 bg-muted/10">
                    <div>
                      <Label className="font-semibold">Ativa (Habilitar Geral)</Label>
                      <p className="text-[11px] text-muted-foreground">Liga/desliga a feature flag globalmente.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={flagForm.enabled}
                      onChange={(e) => setFlagForm({ ...flagForm, enabled: e.target.checked })}
                      className="rounded border-gray-300 text-primary focus:ring-primary h-5 w-5 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between border rounded p-2.5 bg-muted/10">
                    <div>
                      <Label className="font-semibold">Experimental</Label>
                      <p className="text-[11px] text-muted-foreground">Marca esta flag como experimental (indicação azul).</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={flagForm.experimental}
                      onChange={(e) => setFlagForm({ ...flagForm, experimental: e.target.checked })}
                      className="rounded border-gray-300 text-primary focus:ring-primary h-5 w-5 cursor-pointer"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label>Rollout Gradual (%)</Label>
                    <Input
                      type="number"
                      placeholder="Vazio = 100% (Todos)"
                      min="0"
                      max="100"
                      value={flagForm.rolloutPercentage}
                      onChange={(e) => setFlagForm({ ...flagForm, rolloutPercentage: e.target.value === '' ? '' : parseInt(e.target.value, 10) })}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label>Ambiente Específico</Label>
                    <Input
                      placeholder="Ex: production, development"
                      value={flagForm.environment}
                      onChange={(e) => setFlagForm({ ...flagForm, environment: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1">
                      <Label>Agendar Ativação (De)</Label>
                      <Input
                        type="datetime-local"
                        value={flagForm.scheduledOnAt}
                        onChange={(e) => setFlagForm({ ...flagForm, scheduledOnAt: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label>Agendar Desativação (Até)</Label>
                      <Input
                        type="datetime-local"
                        value={flagForm.scheduledOffAt}
                        onChange={(e) => setFlagForm({ ...flagForm, scheduledOffAt: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Restringir a Perfis Específicos (Vazio = Todos)</Label>
                    <div className="grid grid-cols-2 gap-2 border rounded-md p-3 bg-muted/20">
                      {ROLES.map((r) => (
                        <label key={r.value} className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={flagForm.allowedRoles.includes(r.value)}
                            onChange={() => handleRoleToggle(r.value, 'flag')}
                            className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                          />
                          <span className="text-xs">{r.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => { setEditingFlag(null); setIsCreatingFlag(false); }}>Cancelar</Button>
                  <Button
                    disabled={flagUpsertMut.isPending}
                    onClick={() => {
                      if (!flagForm.key) {
                        toast.error('Informe a chave da flag.');
                        return;
                      }
                      flagUpsertMut.mutate(flagForm);
                    }}
                  >
                    Salvar Flag
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </>
      )}
    </div>
  );
}
