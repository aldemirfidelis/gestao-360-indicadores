'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus, Save } from 'lucide-react';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { FilterBar } from '@/components/platform/filter-bar';
import { MetricCard } from '@/components/platform/metric-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/compensation/format';
import { formatNumber } from '@/lib/utils';

const MANAGE_PERMS = ['compensation:budget:update', 'compensation:manage', 'org:positions:manage'];

interface OptionData {
  orgNodes: Array<{ id: string; name: string; type: string }>;
}
interface BudgetRow {
  id: string;
  periodRef: string;
  orgNodeId: string | null;
  costCenter: string | null;
  plannedHeadcount: number;
  plannedPayroll: string | number;
  plannedBenefits: string | number;
  plannedCharges: string | number;
  status: string;
}
interface Overview {
  salaryMasked: boolean;
  cards: Record<string, number | null>;
}

const emptyForm = () => ({
  periodRef: new Date().toISOString().slice(0, 7),
  orgNodeId: '',
  costCenter: '',
  plannedHeadcount: '',
  plannedPayroll: '',
  plannedBenefits: '',
  plannedCharges: '',
  status: 'ACTIVE',
});

export default function OrcamentoPessoalPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(MANAGE_PERMS);
  const [form, setForm] = useState(emptyForm);
  const [showCreate, setShowCreate] = useState(false);
  const [periodFilter, setPeriodFilter] = useState('');

  const optionsQuery = useQuery<OptionData>({ queryKey: ['compensation', 'options'], queryFn: () => api('/cargos-salarios/options') });
  const budgetsQuery = useQuery<BudgetRow[]>({ queryKey: ['compensation', 'budgets'], queryFn: () => api('/cargos-salarios/budgets') });
  const overviewQuery = useQuery<Overview>({ queryKey: ['compensation', 'overview', ''], queryFn: () => api('/cargos-salarios/overview') });

  const createBudget = useMutation({
    mutationFn: () =>
      api('/cargos-salarios/budgets', {
        method: 'POST',
        json: {
          ...form,
          plannedHeadcount: form.plannedHeadcount ? Number(form.plannedHeadcount) : 0,
          plannedPayroll: form.plannedPayroll ? Number(form.plannedPayroll) : 0,
          plannedBenefits: form.plannedBenefits ? Number(form.plannedBenefits) : 0,
          plannedCharges: form.plannedCharges ? Number(form.plannedCharges) : 0,
          orgNodeId: form.orgNodeId || undefined,
          costCenter: form.costCenter || undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Orçamento cadastrado');
      setForm(emptyForm());
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ['compensation', 'budgets'] });
      qc.invalidateQueries({ queryKey: ['compensation', 'overview'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao cadastrar orçamento'),
  });

  const all = budgetsQuery.data ?? [];
  const nodeName = (id: string | null) => optionsQuery.data?.orgNodes.find((n) => n.id === id)?.name ?? 'Geral';
  const periods = useMemo(() => Array.from(new Set(all.map((b) => b.periodRef))).sort().reverse(), [all]);
  const budgets = useMemo(() => all.filter((b) => !periodFilter || b.periodRef === periodFilter), [all, periodFilter]);

  const totals = useMemo(() => {
    return budgets.reduce(
      (acc, b) => ({
        headcount: acc.headcount + Number(b.plannedHeadcount ?? 0),
        payroll: acc.payroll + Number(b.plannedPayroll ?? 0),
        benefits: acc.benefits + Number(b.plannedBenefits ?? 0),
        charges: acc.charges + Number(b.plannedCharges ?? 0),
      }),
      { headcount: 0, payroll: 0, benefits: 0, charges: 0 },
    );
  }, [budgets]);
  const totalCost = totals.payroll + totals.benefits + totals.charges;

  const byArea = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of budgets) {
      const key = nodeName(b.orgNodeId);
      map.set(key, (map.get(key) ?? 0) + Number(b.plannedPayroll ?? 0));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets, optionsQuery.data]);

  const masked = overviewQuery.data?.salaryMasked ?? false;
  const realized = overviewQuery.data?.cards.realizedCost ?? null;
  const planned = overviewQuery.data?.cards.plannedBudget ?? null;
  const variation = overviewQuery.data?.cards.budgetVariation ?? null;

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Orçamento de Pessoal"
        description="Planejamento de headcount, folha, benefícios e encargos por período, área e centro de custo — com comparação ao realizado."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Orçamento de Pessoal' }]}
      />
      <CompensationModuleNav />

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard title="Headcount planejado" value={formatNumber(totals.headcount)} tone="blue" />
        <MetricCard title="Folha planejada" value={formatMoney(totals.payroll)} description="Sem benefícios/encargos" tone="purple" />
        <MetricCard title="Custo total planejado" value={formatMoney(totalCost)} description="Folha + benefícios + encargos" tone="green" />
        <MetricCard
          title="Planejado x realizado"
          value={masked ? 'Restrito' : formatMoney(variation)}
          description={masked ? 'Sem permissão' : `Realizado ${formatMoney(realized)} de ${formatMoney(planned)}`}
          tone={variation != null && variation < 0 ? 'red' : 'yellow'}
        />
      </div>

      <FilterBar
        actions={
          canManage && (
            <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova linha
            </Button>
          )
        }
      >
        <div>
          <Label className="text-xs">Período</Label>
          <NativeSelect value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}>
            <option value="">Todos</option>
            {periods.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </NativeSelect>
        </div>
      </FilterBar>

      {showCreate && canManage && (
        <SectionCard title="Nova linha orçamentária" className="mb-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
            <div>
              <Label>Período</Label>
              <Input type="month" value={form.periodRef} onChange={(e) => setForm({ ...form, periodRef: e.target.value })} />
            </div>
            <div>
              <Label>Área</Label>
              <NativeSelect value={form.orgNodeId} onChange={(e) => setForm({ ...form, orgNodeId: e.target.value })}>
                <option value="">Geral</option>
                {(optionsQuery.data?.orgNodes ?? []).map((node) => (
                  <option key={node.id} value={node.id}>{node.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Centro de custo</Label>
              <Input value={form.costCenter} onChange={(e) => setForm({ ...form, costCenter: e.target.value })} />
            </div>
            <div>
              <Label>Headcount</Label>
              <Input type="number" value={form.plannedHeadcount} onChange={(e) => setForm({ ...form, plannedHeadcount: e.target.value })} />
            </div>
            <div>
              <Label>Folha</Label>
              <Input type="number" value={form.plannedPayroll} onChange={(e) => setForm({ ...form, plannedPayroll: e.target.value })} />
            </div>
            <div>
              <Label>Benefícios</Label>
              <Input type="number" value={form.plannedBenefits} onChange={(e) => setForm({ ...form, plannedBenefits: e.target.value })} />
            </div>
            <div>
              <Label>Encargos</Label>
              <Input type="number" value={form.plannedCharges} onChange={(e) => setForm({ ...form, plannedCharges: e.target.value })} />
            </div>
            <div className="flex items-end lg:col-span-7">
              <Button onClick={() => createBudget.mutate()} disabled={!form.periodRef || createBudget.isPending}>
                <Save className="mr-2 h-4 w-4" /> Salvar orçamento
              </Button>
            </div>
          </div>
        </SectionCard>
      )}

      {byArea.length > 0 && (
        <SectionCard title="Folha planejada por área" className="mb-4" contentClassName="p-3">
          <ResponsiveContainer width="100%" height={Math.max(220, byArea.length * 32 + 40)}>
            <BarChart data={byArea} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => formatNumber(v, { notation: 'compact' })} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatMoney(v)} />
              <Bar dataKey="value" name="Folha planejada" fill="#7c3aed" />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      )}

      <SectionCard title="Orçamentos cadastrados">
        {budgetsQuery.isLoading ? (
          <LoadingState />
        ) : budgets.length === 0 ? (
          <EmptyState title="Nenhum orçamento" description="Cadastre linhas orçamentárias por período e área." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 text-left">Período</th>
                  <th className="py-2 text-left">Área</th>
                  <th className="py-2 text-left">Centro</th>
                  <th className="py-2 text-right">Headcount</th>
                  <th className="py-2 text-right">Folha</th>
                  <th className="py-2 text-right">Benefícios</th>
                  <th className="py-2 text-right">Encargos</th>
                  <th className="py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((b) => (
                  <tr key={b.id} className="border-b border-border/60">
                    <td className="py-2">{b.periodRef}</td>
                    <td className="py-2">{nodeName(b.orgNodeId)}</td>
                    <td className="py-2">{b.costCenter ?? '-'}</td>
                    <td className="py-2 text-right tabular-nums">{formatNumber(b.plannedHeadcount)}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(b.plannedPayroll)}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(b.plannedBenefits)}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(b.plannedCharges)}</td>
                    <td className="py-2 text-muted-foreground">{b.status}</td>
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
