'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Save } from 'lucide-react';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { MeritMatrix } from '@/components/compensation/merit-matrix';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { StatusBadge } from '@/components/platform/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { DEFAULT_MERIT_MATRIX } from '@/lib/compensation/analytics';
import type { CompensationCycle, FitRow } from '@/lib/compensation/types';
import { formatDate, formatNumber } from '@/lib/utils';

const MANAGE_PERMS = ['compensation:cycles:manage', 'compensation:manage', 'org:positions:manage'];
const CYCLE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Aberto',
  IN_APPROVAL: 'Em aprovação',
  APPROVED: 'Aprovado',
  CLOSED: 'Encerrado',
};

const emptyForm = () => ({
  name: '',
  referencePeriod: String(new Date().getFullYear()),
  guidelinePercent: '5',
  totalBudget: '',
  status: 'DRAFT',
  criteria: '',
});

function readMatrix(workflow: unknown): number[][] {
  const wf = workflow as { meritMatrix?: number[][] } | null;
  return Array.isArray(wf?.meritMatrix) ? wf!.meritMatrix! : DEFAULT_MERIT_MATRIX.map((r) => [...r]);
}

export default function CiclosMeritoPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(MANAGE_PERMS);

  const [form, setForm] = useState(emptyForm);
  const [matrix, setMatrix] = useState<number[][]>(DEFAULT_MERIT_MATRIX.map((r) => [...r]));
  // Incrementado apenas ao carregar a matriz de um ciclo, para remontar o editor sem
  // perder foco durante a edicao normal das celulas.
  const [reloadKey, setReloadKey] = useState(0);
  // Ciclo carregado para edicao (null = criando um novo).
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);

  const cyclesQuery = useQuery<CompensationCycle[]>({ queryKey: ['compensation', 'cycles'], queryFn: () => api('/cargos-salarios/cycles') });
  const fitQuery = useQuery<FitRow[]>({ queryKey: ['compensation', 'enquadramento', ''], queryFn: () => api('/cargos-salarios/enquadramento') });
  const rows = fitQuery.data ?? [];

  const createCycle = useMutation({
    mutationFn: () =>
      api('/cargos-salarios/cycles', {
        method: 'POST',
        json: {
          name: form.name,
          referencePeriod: form.referencePeriod,
          status: form.status,
          criteria: form.criteria || undefined,
          guidelinePercent: form.guidelinePercent ? Number(form.guidelinePercent) : undefined,
          totalBudget: form.totalBudget ? Number(form.totalBudget) : undefined,
          workflow: { meritMatrix: matrix },
        },
      }),
    onSuccess: () => {
      toast.success('Ciclo de mérito salvo com a matriz');
      resetForm();
      qc.invalidateQueries({ queryKey: ['compensation', 'cycles'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao salvar ciclo'),
  });
  const updateCycleMutation = useMutation({
    mutationFn: () =>
      api(`/cargos-salarios/cycles/${selectedCycleId}`, {
        method: 'PATCH',
        json: {
          name: form.name,
          referencePeriod: form.referencePeriod,
          status: form.status,
          criteria: form.criteria || null,
          guidelinePercent: form.guidelinePercent ? Number(form.guidelinePercent) : null,
          totalBudget: form.totalBudget ? Number(form.totalBudget) : null,
          workflow: { meritMatrix: matrix },
        },
      }),
    onSuccess: () => {
      toast.success('Ciclo atualizado');
      qc.invalidateQueries({ queryKey: ['compensation', 'cycles'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao atualizar ciclo'),
  });

  function resetForm() {
    setForm(emptyForm());
    setMatrix(DEFAULT_MERIT_MATRIX.map((r) => [...r]));
    setSelectedCycleId(null);
    setReloadKey((k) => k + 1);
  }

  function loadCycle(cycle: CompensationCycle) {
    setForm({
      name: cycle.name,
      referencePeriod: cycle.referencePeriod,
      guidelinePercent: cycle.guidelinePercent != null ? String(Number(cycle.guidelinePercent) * 100) : '5',
      totalBudget: cycle.totalBudget != null ? String(cycle.totalBudget) : '',
      status: cycle.status,
      criteria: cycle.criteria ?? '',
    });
    setMatrix(readMatrix(cycle.workflow));
    setSelectedCycleId(cycle.id);
    setReloadKey((k) => k + 1);
    toast.info('Ciclo carregado para edição.');
  }

  const guidelineRatio = form.guidelinePercent ? Number(form.guidelinePercent) / 100 : null;
  const budgetNumber = form.totalBudget ? Number(form.totalBudget) : null;
  const cycles = cyclesQuery.data ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Ciclos de Mérito"
        description="Planeje campanhas de mérito com diretriz, orçamento e matriz desempenho × compa-ratio, simulando o impacto sobre o quadro."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Ciclos de Mérito' }]}
      />
      <CompensationModuleNav />

      {canManage && (
        <SectionCard
          title={selectedCycleId ? 'Editar ciclo' : 'Novo ciclo'}
          actions={
            selectedCycleId && (
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <Plus className="mr-1.5 h-4 w-4" /> Novo ciclo
              </Button>
            )
          }
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Período</Label>
              <Input value={form.referencePeriod} onChange={(e) => setForm({ ...form, referencePeriod: e.target.value })} />
            </div>
            <div>
              <Label>Diretriz (%)</Label>
              <Input type="number" value={form.guidelinePercent} onChange={(e) => setForm({ ...form, guidelinePercent: e.target.value })} />
            </div>
            <div>
              <Label>Orçamento total</Label>
              <Input type="number" value={form.totalBudget} onChange={(e) => setForm({ ...form, totalBudget: e.target.value })} />
            </div>
            <div className="lg:col-span-4">
              <Label>Critérios e elegibilidade</Label>
              <Textarea rows={2} value={form.criteria} onChange={(e) => setForm({ ...form, criteria: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <NativeSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.entries(CYCLE_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Matriz de mérito e simulação"
        description="Defina o % de aumento por desempenho × faixa de compa-ratio. A simulação aplica a matriz sobre o quadro atual do enquadramento."
        className="mt-4"
      >
        {fitQuery.isLoading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <EmptyState title="Sem população para simular" description="Cadastre colaboradores e retratos salariais para simular o impacto da matriz." />
        ) : (
          <MeritMatrix
            key={reloadKey}
            rows={rows}
            guidelinePercent={guidelineRatio}
            totalBudget={budgetNumber}
            initialMatrix={matrix}
            onChange={setMatrix}
          />
        )}
        {canManage && (
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-4">
            {selectedCycleId && (
              <Button variant="outline" onClick={() => createCycle.mutate()} disabled={!form.name || !form.referencePeriod || createCycle.isPending}>
                <Save className="mr-2 h-4 w-4" /> Salvar como novo
              </Button>
            )}
            <Button
              onClick={() => (selectedCycleId ? updateCycleMutation.mutate() : createCycle.mutate())}
              disabled={!form.name || !form.referencePeriod || createCycle.isPending || updateCycleMutation.isPending}
            >
              <Save className="mr-2 h-4 w-4" /> {selectedCycleId ? 'Atualizar ciclo' : 'Salvar ciclo com a matriz'}
            </Button>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Ciclos cadastrados" className="mt-4">
        {cyclesQuery.isLoading ? (
          <LoadingState />
        ) : cycles.length === 0 ? (
          <EmptyState title="Nenhum ciclo cadastrado" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 text-left">Ciclo</th>
                  <th className="py-2 text-left">Período</th>
                  <th className="py-2 text-right">Diretriz</th>
                  <th className="py-2 text-right">Orçamento</th>
                  <th className="py-2 text-left">Status</th>
                  <th className="py-2 text-left">Criado em</th>
                  <th className="py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {cycles.map((cycle) => (
                  <tr key={cycle.id} className="border-b border-border/60">
                    <td className="py-2 font-medium">{cycle.name}</td>
                    <td className="py-2">{cycle.referencePeriod}</td>
                    <td className="py-2 text-right tabular-nums">{cycle.guidelinePercent == null ? '-' : `${formatNumber(Number(cycle.guidelinePercent) * 100, { maximumFractionDigits: 2 })}%`}</td>
                    <td className="py-2 text-right tabular-nums">{cycle.totalBudget == null ? '-' : formatNumber(Number(cycle.totalBudget), { style: 'currency', currency: 'BRL' })}</td>
                    <td className="py-2">
                      <StatusBadge value={cycle.status} label={CYCLE_STATUS_LABELS[cycle.status] ?? cycle.status} />
                    </td>
                    <td className="py-2">{formatDate(cycle.createdAt)}</td>
                    <td className="py-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => loadCycle(cycle)}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
