'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Plus, Save } from 'lucide-react';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { FilterBar } from '@/components/platform/filter-bar';
import { MetricCard } from '@/components/platform/metric-card';
import { StatusBadge } from '@/components/platform/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/compensation/format';
import { SCENARIO_LABELS, SIMULATION_STATUS_LABELS } from '@/lib/compensation/types';
import { formatNumber } from '@/lib/utils';

const MANAGE_PERMS = ['compensation:manage', 'org:positions:manage'];

interface Simulation {
  id: string;
  name: string;
  scenarioType: string;
  status: string;
  monthlyImpact: string | number | null;
  annualImpact: string | number | null;
  affectedCount: number;
  createdAt: string;
}

const emptyForm = () => ({ name: '', scenarioType: 'MERITO', monthlyImpact: '', affectedCount: '', assumptions: '', results: '' });

export default function SimulacoesPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(MANAGE_PERMS);
  const [form, setForm] = useState(emptyForm);
  const [showCreate, setShowCreate] = useState(false);
  const [scenarioFilter, setScenarioFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const simulationsQuery = useQuery<Simulation[]>({ queryKey: ['compensation', 'simulations'], queryFn: () => api('/cargos-salarios/simulations') });

  const createSimulation = useMutation({
    mutationFn: () =>
      api('/cargos-salarios/simulations', {
        method: 'POST',
        json: {
          name: form.name,
          scenarioType: form.scenarioType,
          monthlyImpact: form.monthlyImpact ? Number(form.monthlyImpact) : undefined,
          affectedCount: form.affectedCount ? Number(form.affectedCount) : 0,
          assumptions: form.assumptions ? { description: form.assumptions } : undefined,
          results: form.results ? { expectedResult: form.results } : undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Simulação cadastrada');
      setForm(emptyForm());
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ['compensation', 'simulations'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao cadastrar simulação'),
  });
  const approveSimulation = useMutation({
    mutationFn: (id: string) => api(`/cargos-salarios/simulations/${id}/approve`, { method: 'PATCH', json: {} }),
    onSuccess: () => {
      toast.success('Simulação aprovada');
      qc.invalidateQueries({ queryKey: ['compensation', 'simulations'] });
      qc.invalidateQueries({ queryKey: ['compensation', 'approvals'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao aprovar simulação'),
  });

  const all = simulationsQuery.data ?? [];
  const simulations = useMemo(
    () => all.filter((s) => (!scenarioFilter || s.scenarioType === scenarioFilter) && (!statusFilter || s.status === statusFilter)),
    [all, scenarioFilter, statusFilter],
  );
  const kpis = useMemo(() => {
    const approved = all.filter((s) => s.status === 'APPROVED').length;
    const annual = all.reduce((sum, s) => sum + Number(s.annualImpact ?? 0), 0);
    const affected = all.reduce((sum, s) => sum + (s.affectedCount ?? 0), 0);
    return { total: all.length, approved, annual, affected };
  }, [all]);

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Simulações"
        description="Cenários de impacto para mérito, enquadramento, promoção, headcount e reestruturação."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Simulações' }]}
      />
      <CompensationModuleNav />

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard title="Cenários" value={formatNumber(kpis.total)} tone="blue" />
        <MetricCard title="Aprovados" value={formatNumber(kpis.approved)} tone="green" />
        <MetricCard title="Pessoas afetadas" value={formatNumber(kpis.affected)} tone="yellow" />
        <MetricCard title="Impacto anual somado" value={formatMoney(kpis.annual)} tone="purple" />
      </div>

      <FilterBar
        actions={
          canManage && (
            <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova simulação
            </Button>
          )
        }
      >
        <div>
          <Label className="text-xs">Cenário</Label>
          <NativeSelect value={scenarioFilter} onChange={(e) => setScenarioFilter(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(SCENARIO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <NativeSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(SIMULATION_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </NativeSelect>
        </div>
      </FilterBar>

      {showCreate && canManage && (
        <SectionCard title="Nova simulação" className="mb-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Cenário</Label>
              <NativeSelect value={form.scenarioType} onChange={(e) => setForm({ ...form, scenarioType: e.target.value })}>
                {Object.entries(SCENARIO_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Impacto mensal</Label>
              <Input type="number" value={form.monthlyImpact} onChange={(e) => setForm({ ...form, monthlyImpact: e.target.value })} />
            </div>
            <div>
              <Label>Pessoas afetadas</Label>
              <Input type="number" value={form.affectedCount} onChange={(e) => setForm({ ...form, affectedCount: e.target.value })} />
            </div>
            <div className="lg:col-span-2">
              <Label>Premissas</Label>
              <Textarea rows={3} value={form.assumptions} onChange={(e) => setForm({ ...form, assumptions: e.target.value })} />
            </div>
            <div className="lg:col-span-3">
              <Label>Resultado esperado</Label>
              <Textarea rows={3} value={form.results} onChange={(e) => setForm({ ...form, results: e.target.value })} />
            </div>
            <div className="lg:col-span-5">
              <Button onClick={() => createSimulation.mutate()} disabled={!form.name || !form.scenarioType || createSimulation.isPending}>
                <Save className="mr-2 h-4 w-4" /> Salvar simulação
              </Button>
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Simulações cadastradas">
        {simulationsQuery.isLoading ? (
          <LoadingState />
        ) : simulations.length === 0 ? (
          <EmptyState title="Nenhuma simulação" description="Crie cenários para estimar impacto financeiro de decisões de remuneração." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 text-left">Nome</th>
                  <th className="py-2 text-left">Cenário</th>
                  <th className="py-2 text-right">Pessoas</th>
                  <th className="py-2 text-right">Impacto mensal</th>
                  <th className="py-2 text-right">Impacto anual</th>
                  <th className="py-2 text-left">Status</th>
                  <th className="py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {simulations.map((s) => (
                  <tr key={s.id} className="border-b border-border/60">
                    <td className="py-2 font-medium">{s.name}</td>
                    <td className="py-2">{SCENARIO_LABELS[s.scenarioType] ?? s.scenarioType}</td>
                    <td className="py-2 text-right tabular-nums">{formatNumber(s.affectedCount)}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(s.monthlyImpact)}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(s.annualImpact)}</td>
                    <td className="py-2">
                      <StatusBadge value={s.status} tone={s.status === 'APPROVED' ? 'green' : 'gray'} label={SIMULATION_STATUS_LABELS[s.status] ?? s.status} />
                    </td>
                    <td className="py-2 text-right">
                      {s.status !== 'APPROVED' && canManage && (
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => approveSimulation.mutate(s.id)} disabled={approveSimulation.isPending}>
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Aprovar
                        </Button>
                      )}
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
