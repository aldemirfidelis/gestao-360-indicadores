'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PortalModuleRow, PortalPageRow, PortalFeatureRow } from '@/components/portal-admin/types';

interface ScopeRule {
  id: string;
  targetType: string;
  targetCode: string;
  scopeType: string;
  scopeId: string;
  effect: 'allow' | 'deny';
  createdAt: string;
}

interface ScopeOptions {
  companies: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  orgNodes: { id: string; name: string; type: string }[];
}

const ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'COMPANY_ADMIN', label: 'Admin da Empresa' },
  { value: 'DIRECTOR', label: 'Diretor' },
  { value: 'MANAGER', label: 'Gestor' },
  { value: 'ANALYST', label: 'Analista' },
  { value: 'COLLABORATOR', label: 'Colaborador' },
  { value: 'VIEWER', label: 'Visualizador' },
];

export function ScopeTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    targetType: 'module',
    targetCode: '',
    scopeType: 'company',
    scopeId: '',
    effect: 'allow',
  });

  const rules = useQuery<ScopeRule[]>({ queryKey: ['portal', 'scope-rules'], queryFn: () => api('/admin/portal/scope'), refetchOnWindowFocus: false });
  const options = useQuery<ScopeOptions>({ queryKey: ['portal', 'scope-options'], queryFn: () => api('/admin/portal/scope/options'), refetchOnWindowFocus: false });

  // Buscar recursos para o dropdown
  const modules = useQuery<PortalModuleRow[]>({ queryKey: ['portal', 'modules'], queryFn: () => api('/admin/portal/modules'), enabled: form.targetType === 'module', staleTime: 30000 });
  const pages = useQuery<PortalPageRow[]>({ queryKey: ['portal', 'pages'], queryFn: () => api('/admin/portal/pages'), enabled: form.targetType === 'page', staleTime: 30000 });
  const features = useQuery<PortalFeatureRow[]>({ queryKey: ['portal', 'features'], queryFn: () => api('/admin/portal/features'), enabled: form.targetType === 'feature', staleTime: 30000 });

  const createMut = useMutation({
    mutationFn: (v: typeof form) => api('/admin/portal/scope', { method: 'POST', json: v }),
    onSuccess: () => {
      toast.success('Regra de escopo criada com sucesso.');
      setForm({ ...form, targetCode: '', scopeId: '' });
      qc.invalidateQueries({ queryKey: ['portal', 'scope-rules'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => api(`/admin/portal/scope/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Regra de escopo removida.');
      qc.invalidateQueries({ queryKey: ['portal', 'scope-rules'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  // Mapeamento para nomes amigáveis de Escopos
  const optData = options.data;
  const nameMap = new Map<string, string>();
  optData?.companies.forEach((c) => nameMap.set(c.id, c.name));
  optData?.branches.forEach((b) => nameMap.set(b.id, b.name));
  optData?.orgNodes.forEach((o) => nameMap.set(o.id, `${o.name} (${o.type})`));
  ROLES.forEach((r) => nameMap.set(r.value, r.label));

  // Opções de Target Code com base no tipo selecionado
  const targetCodes: { value: string; label: string }[] = [];
  if (form.targetType === 'module' && modules.data) {
    modules.data.forEach((m) => targetCodes.push({ value: m.code, label: `${m.name} (${m.code})` }));
  } else if (form.targetType === 'page' && pages.data) {
    pages.data.forEach((p) => targetCodes.push({ value: p.code, label: `${p.name} (${p.code})` }));
  } else if (form.targetType === 'feature' && features.data) {
    features.data.forEach((f) => targetCodes.push({ value: f.code, label: `${f.name} (${f.code})` }));
  }

  // Opções de Scope ID com base no tipo de escopo selecionado
  const scopeIds: { value: string; label: string }[] = [];
  if (form.scopeType === 'company' && optData?.companies) {
    optData.companies.forEach((c) => scopeIds.push({ value: c.id, label: c.name }));
  } else if (form.scopeType === 'branch' && optData?.branches) {
    optData.branches.forEach((b) => scopeIds.push({ value: b.id, label: b.name }));
  } else if (form.scopeType === 'orgnode' && optData?.orgNodes) {
    optData.orgNodes.forEach((o) => scopeIds.push({ value: o.id, label: `${o.name} [${o.type}]` }));
  } else if (form.scopeType === 'role') {
    ROLES.forEach((r) => scopeIds.push({ value: r.value, label: r.label }));
  }

  const rows = rules.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Restrinja módulos, páginas ou funcionalidades para empresas, filiais, áreas organizacionais ou perfis específicos.
        </p>
        <Button variant="ghost" size="sm" onClick={() => rules.refetch()} disabled={rules.isFetching}>
          <RefreshCcw className={cn('mr-2 h-4 w-4', rules.isFetching && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {rules.isLoading && <LoadingState label="Carregando regras de escopo..." />}

      {!rules.isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* Formulário de criação */}
          <SectionCard title="Adicionar Regra de Escopo" description="Crie restrições organizacionais ou por perfil." className="lg:col-span-1">
            <div className="space-y-3 text-sm py-2">
              <div>
                <Label htmlFor="tgt-type">Tipo de Recurso</Label>
                <select
                  id="tgt-type"
                  className="select-modern mt-1"
                  value={form.targetType}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, targetType: e.target.value, targetCode: '' })}
                >
                  <option value="module">Módulo</option>
                  <option value="page">Página</option>
                  <option value="feature">Funcionalidade</option>
                </select>
              </div>

              <div>
                <Label htmlFor="tgt-code">Recurso Específico</Label>
                <select
                  id="tgt-code"
                  className="select-modern mt-1"
                  value={form.targetCode}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, targetCode: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {targetCodes.map((tc) => (
                    <option key={tc.value} value={tc.value}>{tc.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="scope-type">Tipo de Escopo</Label>
                <select
                  id="scope-type"
                  className="select-modern mt-1"
                  value={form.scopeType}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, scopeType: e.target.value, scopeId: '' })}
                >
                  <option value="company">Empresa</option>
                  <option value="branch">Filial</option>
                  <option value="orgnode">Área / Setor</option>
                  <option value="role">Perfil (Role)</option>
                  <option value="user">Usuário Específico (ID)</option>
                </select>
              </div>

              <div>
                <Label htmlFor="scope-id">Destinatário do Escopo</Label>
                {form.scopeType === 'user' ? (
                  <Input
                    id="scope-id"
                    placeholder="Digite o UUID do Usuário"
                    className="mt-1 h-9"
                    value={form.scopeId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, scopeId: e.target.value })}
                  />
                ) : (
                  <select
                    id="scope-id"
                    className="select-modern mt-1"
                    value={form.scopeId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, scopeId: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {scopeIds.map((sc) => (
                      <option key={sc.value} value={sc.value}>{sc.label}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <Label htmlFor="scope-effect">Efeito da Regra</Label>
                <select
                  id="scope-effect"
                  className="select-modern mt-1"
                  value={form.effect}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, effect: e.target.value })}
                >
                  <option value="allow">Permitir (Allow)</option>
                  <option value="deny">Bloquear (Deny)</option>
                </select>
              </div>

              <Button
                className="w-full mt-2"
                disabled={!form.targetCode || !form.scopeId || createMut.isPending}
                onClick={() => createMut.mutate(form)}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Adicionar Regra
              </Button>
            </div>
          </SectionCard>

          {/* Tabela de regras ativas */}
          <SectionCard title="Regras de Escopo Ativas" description="Lista de restrições configuradas no portal." className="lg:col-span-2" contentClassName="p-0">
            {rows.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Nenhuma regra de escopo registrada.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th className="text-left">Recurso Afetado</th>
                      <th className="text-left">Escopo / Alvo</th>
                      <th className="text-left">Ação</th>
                      <th className="text-right">Remover</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((rule) => {
                      const resolvedName = nameMap.get(rule.scopeId) || rule.scopeId;
                      return (
                        <tr key={rule.id}>
                          <td>
                            <div className="font-medium text-sm">{rule.targetCode}</div>
                            <div className="text-[10px] text-muted-foreground uppercase font-mono">{rule.targetType}</div>
                          </td>
                          <td>
                            <div className="font-medium text-xs">{resolvedName}</div>
                            <div className="text-[10px] text-muted-foreground uppercase font-mono">{rule.scopeType}</div>
                          </td>
                          <td>
                            <Badge className={cn('text-[10px]', rule.effect === 'deny' ? 'bg-status-red/15 text-status-red border-transparent hover:bg-status-red/20' : 'bg-status-green/15 text-status-green border-transparent hover:bg-status-green/20')}>
                              {rule.effect === 'deny' ? 'Bloquear' : 'Permitir'}
                            </Badge>
                          </td>
                          <td className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              disabled={removeMut.isPending}
                              onClick={() => removeMut.mutate(rule.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
