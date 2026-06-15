'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, GitBranch, Plus, Save } from 'lucide-react';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { SalaryStructureChart } from '@/components/compensation/salary-structure-chart';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { StatusBadge } from '@/components/platform/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/compensation/format';
import { TABLE_STATUS_LABELS, type JobOption, type SalaryTable } from '@/lib/compensation/types';
import { formatDate } from '@/lib/utils';

const MANAGE_PERMS = ['compensation:salary-table:update', 'compensation:manage', 'org:positions:manage'];
const APPROVE_PERMS = ['compensation:salary-table:approve', 'compensation:manage'];

const emptyTable = () => ({ name: '', effectiveFrom: new Date().toISOString().slice(0, 10) });
const emptyRange = () => ({ jobCatalogId: '', band: 'B', grade: '', minSalary: '', midpointSalary: '', maxSalary: '' });

export default function TabelasSalariaisPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(MANAGE_PERMS);
  const canApprove = hasPermission(APPROVE_PERMS);

  const [showCreate, setShowCreate] = useState(false);
  const [tableForm, setTableForm] = useState(emptyTable);
  const [rangeForm, setRangeForm] = useState(emptyRange);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const optionsQuery = useQuery<{ jobs: JobOption[] }>({ queryKey: ['compensation', 'options'], queryFn: () => api('/cargos-salarios/options') });
  const tablesQuery = useQuery<SalaryTable[]>({ queryKey: ['compensation', 'salary-tables'], queryFn: () => api('/cargos-salarios/salary-tables') });
  const tables = tablesQuery.data ?? [];

  useEffect(() => {
    if (!selectedId && tables.length) setSelectedId(tables[0].id);
  }, [tables, selectedId]);
  const selected = useMemo(() => tables.find((t) => t.id === selectedId) ?? null, [tables, selectedId]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['compensation', 'salary-tables'] });

  const createTable = useMutation({
    mutationFn: () => api('/cargos-salarios/salary-tables', { method: 'POST', json: { name: tableForm.name, effectiveFrom: tableForm.effectiveFrom, ranges: [] } }),
    onSuccess: (created: any) => {
      toast.success('Tabela criada');
      setTableForm(emptyTable());
      setShowCreate(false);
      invalidate();
      if (created?.id) setSelectedId(created.id);
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao criar tabela'),
  });
  const addRange = useMutation({
    mutationFn: () =>
      api(`/cargos-salarios/salary-tables/${selectedId}/ranges`, {
        method: 'POST',
        json: {
          jobCatalogId: rangeForm.jobCatalogId || undefined,
          band: rangeForm.band,
          grade: rangeForm.grade || undefined,
          minSalary: Number(rangeForm.minSalary),
          midpointSalary: Number(rangeForm.midpointSalary),
          maxSalary: Number(rangeForm.maxSalary),
        },
      }),
    onSuccess: () => {
      toast.success('Faixa adicionada');
      setRangeForm(emptyRange());
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao adicionar faixa'),
  });
  const publish = useMutation({
    mutationFn: () => api(`/cargos-salarios/salary-tables/${selectedId}/publish`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Tabela publicada');
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao publicar'),
  });
  const revise = useMutation({
    mutationFn: () => api(`/cargos-salarios/salary-tables/${selectedId}/revision`, { method: 'POST', json: { justification: 'Nova revisão' } }),
    onSuccess: (created: any) => {
      toast.success('Revisão criada (rascunho)');
      invalidate();
      if (created?.id) setSelectedId(created.id);
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao criar revisão'),
  });

  const rangeValid = rangeForm.minSalary && rangeForm.midpointSalary && rangeForm.maxSalary;
  const isPublished = selected?.status === 'PUBLISHED';

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Tabelas Salariais"
        description="Estrutura de faixas com vigência, versão e publicação. Tabela publicada não é sobrescrita — gere nova revisão."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Tabelas Salariais' }]}
      />
      <CompensationModuleNav />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Lista de tabelas */}
        <SectionCard
          title="Tabelas"
          contentClassName="p-2"
          actions={
            canManage && (
              <Button size="sm" variant="ghost" onClick={() => setShowCreate((v) => !v)}>
                <Plus className="h-4 w-4" />
              </Button>
            )
          }
        >
          {tablesQuery.isLoading ? (
            <LoadingState />
          ) : tables.length === 0 ? (
            <EmptyState title="Nenhuma tabela" description="Crie a primeira tabela salarial." />
          ) : (
            <ul className="space-y-1">
              {tables.map((table) => (
                <li key={table.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(table.id)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${selectedId === table.id ? 'bg-muted' : 'hover:bg-muted/50'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{table.name}</span>
                      <StatusBadge value={table.status} label={TABLE_STATUS_LABELS[table.status] ?? table.status} />
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {table.code} · v{table.version} · {table.ranges.length} faixas
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Detalhe da tabela selecionada */}
        <div className="space-y-4">
          {showCreate && canManage && (
            <SectionCard title="Nova tabela">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Label>Nome</Label>
                  <Input value={tableForm.name} onChange={(e) => setTableForm({ ...tableForm, name: e.target.value })} />
                </div>
                <div>
                  <Label>Vigência inicial</Label>
                  <Input type="date" value={tableForm.effectiveFrom} onChange={(e) => setTableForm({ ...tableForm, effectiveFrom: e.target.value })} />
                </div>
                <div className="sm:col-span-3">
                  <Button onClick={() => createTable.mutate()} disabled={!tableForm.name || createTable.isPending}>
                    <Save className="mr-2 h-4 w-4" /> Criar tabela
                  </Button>
                </div>
              </div>
            </SectionCard>
          )}

          {!selected ? (
            <SectionCard title="Estrutura salarial">
              <EmptyState title="Selecione uma tabela" description="Escolha uma tabela na lista para ver a estrutura de faixas." />
            </SectionCard>
          ) : (
            <>
              <SectionCard
                title={`Estrutura · ${selected.name}`}
                description={`Vigência ${formatDate(selected.effectiveFrom)} · v${selected.version} · ${selected.currency}`}
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={selected.status} label={TABLE_STATUS_LABELS[selected.status] ?? selected.status} />
                    {canApprove && !isPublished && (
                      <Button size="sm" onClick={() => publish.mutate()} disabled={publish.isPending || selected.ranges.length === 0}>
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Publicar
                      </Button>
                    )}
                    {canManage && isPublished && (
                      <Button size="sm" variant="outline" onClick={() => revise.mutate()} disabled={revise.isPending}>
                        <GitBranch className="mr-1.5 h-3.5 w-3.5" /> Nova revisão
                      </Button>
                    )}
                  </div>
                }
              >
                <SalaryStructureChart ranges={selected.ranges} currency={selected.currency} />
              </SectionCard>

              <SectionCard title="Faixas" actions={<Badge variant="secondary">{selected.ranges.length}</Badge>}>
                {selected.ranges.length === 0 ? (
                  <EmptyState title="Sem faixas" description="Adicione faixas para compor a estrutura." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="border-b text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="py-2 text-left">Faixa</th>
                          <th className="py-2 text-left">Cargo</th>
                          <th className="py-2 text-right">Mínimo</th>
                          <th className="py-2 text-right">Ponto médio</th>
                          <th className="py-2 text-right">Máximo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.ranges.map((range) => (
                          <tr key={range.id} className="border-b border-border/60">
                            <td className="py-2 font-medium">{[range.band, range.grade].filter(Boolean).join(' / ')}</td>
                            <td className="py-2 text-muted-foreground">{range.jobCatalog ? `${range.jobCatalog.code} - ${range.jobCatalog.name}` : 'Geral'}</td>
                            <td className="py-2 text-right tabular-nums">{formatMoney(range.minSalary, { currency: selected.currency })}</td>
                            <td className="py-2 text-right tabular-nums">{formatMoney(range.midpointSalary, { currency: selected.currency })}</td>
                            <td className="py-2 text-right tabular-nums">{formatMoney(range.maxSalary, { currency: selected.currency })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {canManage && !isPublished && (
                  <div className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-7">
                    <div>
                      <Label>Faixa</Label>
                      <Input value={rangeForm.band} onChange={(e) => setRangeForm({ ...rangeForm, band: e.target.value })} />
                    </div>
                    <div>
                      <Label>Grade</Label>
                      <Input value={rangeForm.grade} onChange={(e) => setRangeForm({ ...rangeForm, grade: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Cargo</Label>
                      <NativeSelect value={rangeForm.jobCatalogId} onChange={(e) => setRangeForm({ ...rangeForm, jobCatalogId: e.target.value })}>
                        <option value="">Geral</option>
                        {(optionsQuery.data?.jobs ?? []).map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.code} - {job.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div>
                      <Label>Mínimo</Label>
                      <Input type="number" value={rangeForm.minSalary} onChange={(e) => setRangeForm({ ...rangeForm, minSalary: e.target.value })} />
                    </div>
                    <div>
                      <Label>Médio</Label>
                      <Input type="number" value={rangeForm.midpointSalary} onChange={(e) => setRangeForm({ ...rangeForm, midpointSalary: e.target.value })} />
                    </div>
                    <div>
                      <Label>Máximo</Label>
                      <Input type="number" value={rangeForm.maxSalary} onChange={(e) => setRangeForm({ ...rangeForm, maxSalary: e.target.value })} />
                    </div>
                    <div className="flex items-end sm:col-span-7">
                      <Button size="sm" onClick={() => addRange.mutate()} disabled={!rangeValid || addRange.isPending}>
                        <Plus className="mr-1.5 h-4 w-4" /> Adicionar faixa
                      </Button>
                    </div>
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
