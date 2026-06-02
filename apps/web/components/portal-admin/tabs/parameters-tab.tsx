'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Edit3, Plus, RefreshCcw } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AppSettingRow {
  id: string;
  key: string;
  value: string;
  valueType: string | null;
  createdAt: string;
}

export function ParametersTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AppSettingRow | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    key: '',
    value: '',
    valueType: 'text',
  });

  const query = useQuery<AppSettingRow[]>({
    queryKey: ['portal', 'parameters'],
    queryFn: () => api('/admin/portal/parameters'),
    refetchOnWindowFocus: false,
  });

  const setMut = useMutation({
    mutationFn: (v: typeof form) => api('/admin/portal/parameters', { method: 'PUT', json: v }),
    onSuccess: () => {
      toast.success('Parâmetro salvo com sucesso.');
      setEditing(null);
      setIsCreating(false);
      setForm({ key: '', value: '', valueType: 'text' });
      qc.invalidateQueries({ queryKey: ['portal', 'parameters'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  function startEdit(p: AppSettingRow) {
    setEditing(p);
    setForm({
      key: p.key,
      value: p.value,
      valueType: p.valueType || 'text',
    });
  }

  function startCreate() {
    setIsCreating(true);
    setForm({
      key: '',
      value: '',
      valueType: 'text',
    });
  }

  const rows = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Configure as preferências gerais e comportamentos operacionais do Gestão 360.
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={startCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo Parâmetro
          </Button>
          <Button variant="ghost" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCcw className={cn('mr-2 h-4 w-4', query.isFetching && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </div>

      {query.isLoading && <LoadingState label="Lendo parâmetros..." />}

      {!query.isLoading && rows.length === 0 && (
        <SectionCard title="Nenhum parâmetro cadastrado" description="Crie novos parâmetros dinâmicos usando o botão acima.">
          <Button onClick={startCreate}>Cadastrar Primeiro Parâmetro</Button>
        </SectionCard>
      )}

      {rows.length > 0 && (
        <SectionCard title="Configurações Gerais do Sistema" description="Parâmetros de controle e personalização." contentClassName="p-0">
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th className="text-left w-1/3">Chave (Key)</th>
                  <th className="text-left">Valor Atual</th>
                  <th className="text-left">Tipo</th>
                  <th className="text-right">Editar</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="font-mono text-sm font-semibold">{p.key}</div>
                    </td>
                    <td>
                      <span className="font-mono text-xs">{p.value}</span>
                    </td>
                    <td>
                      <span className="capitalize text-xs font-medium">{p.valueType || 'text'}</span>
                    </td>
                    <td className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>
                        <Edit3 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {(editing || isCreating) && (
        <Dialog open onOpenChange={(o) => { if (!o) { setEditing(null); setIsCreating(false); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{isCreating ? 'Novo Parâmetro' : `Editar Parâmetro: ${editing?.key}`}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2 text-sm">
              <div className="grid gap-1">
                <Label htmlFor="param-key">Chave de Identificação</Label>
                <Input
                  id="param-key"
                  disabled={!isCreating}
                  placeholder="Ex: portal_system_name"
                  value={form.key}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, key: e.target.value })}
                />
              </div>

              <div className="grid gap-1">
                <Label htmlFor="param-type">Tipo de Dado</Label>
                <select
                  id="param-type"
                  className="select-modern mt-1"
                  value={form.valueType}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, valueType: e.target.value })}
                >
                  <option value="text">Texto (Text)</option>
                  <option value="number">Número (Number)</option>
                  <option value="boolean">Booleano (True/False)</option>
                  <option value="json">JSON String</option>
                </select>
              </div>

              <div className="grid gap-1">
                <Label htmlFor="param-val">Valor do Parâmetro</Label>
                {form.valueType === 'boolean' ? (
                  <select
                    id="param-val"
                    className="select-modern mt-1"
                    value={form.value}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, value: e.target.value })}
                  >
                    <option value="true">True (Verdadeiro)</option>
                    <option value="false">False (Falso)</option>
                  </select>
                ) : (
                  <Input
                    id="param-val"
                    className="mt-1"
                    value={form.value}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, value: e.target.value })}
                  />
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setEditing(null); setIsCreating(false); }}>Cancelar</Button>
              <Button
                disabled={!form.key || setMut.isPending}
                onClick={() => setMut.mutate(form)}
              >
                Salvar Parâmetro
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
