'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

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

export default function OrcamentoPessoalPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    periodRef: new Date().toISOString().slice(0, 7),
    orgNodeId: '',
    costCenter: '',
    plannedHeadcount: '',
    plannedPayroll: '',
    plannedBenefits: '',
    plannedCharges: '',
    status: 'ACTIVE',
  });
  const optionsQuery = useQuery<OptionData>({ queryKey: ['compensation', 'options'], queryFn: () => api('/cargos-salarios/options') });
  const budgetsQuery = useQuery<BudgetRow[]>({ queryKey: ['compensation', 'budgets'], queryFn: () => api('/cargos-salarios/budgets') });
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
      setForm({ periodRef: new Date().toISOString().slice(0, 7), orgNodeId: '', costCenter: '', plannedHeadcount: '', plannedPayroll: '', plannedBenefits: '', plannedCharges: '', status: 'ACTIVE' });
      qc.invalidateQueries({ queryKey: ['compensation', 'budgets'] });
      qc.invalidateQueries({ queryKey: ['compensation', 'overview'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao cadastrar orçamento'),
  });
  const totalPayroll = (budgetsQuery.data ?? []).reduce((sum, item) => sum + Number(item.plannedPayroll ?? 0), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Orçamento de Pessoal"
        description="Planejamento de headcount, folha, benefícios e encargos por período, área e centro de custo."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Orçamento de Pessoal' }]}
      />
      <CompensationModuleNav />

      <SectionCard title="Nova linha orcamentaria">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
          <div>
            <Label>Período</Label>
            <Input type="month" value={form.periodRef} onChange={(event) => setForm({ ...form, periodRef: event.target.value })} />
          </div>
          <div>
            <Label>Área</Label>
            <NativeSelect value={form.orgNodeId} onChange={(event) => setForm({ ...form, orgNodeId: event.target.value })}>
              <option value="">Geral</option>
              {(optionsQuery.data?.orgNodes ?? []).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label>Centro de custo</Label>
            <Input value={form.costCenter} onChange={(event) => setForm({ ...form, costCenter: event.target.value })} />
          </div>
          <div>
            <Label>Headcount</Label>
            <Input type="number" value={form.plannedHeadcount} onChange={(event) => setForm({ ...form, plannedHeadcount: event.target.value })} />
          </div>
          <div>
            <Label>Folha</Label>
            <Input type="number" value={form.plannedPayroll} onChange={(event) => setForm({ ...form, plannedPayroll: event.target.value })} />
          </div>
          <div>
            <Label>Beneficios</Label>
            <Input type="number" value={form.plannedBenefits} onChange={(event) => setForm({ ...form, plannedBenefits: event.target.value })} />
          </div>
          <div>
            <Label>Encargos</Label>
            <Input type="number" value={form.plannedCharges} onChange={(event) => setForm({ ...form, plannedCharges: event.target.value })} />
          </div>
          <div className="flex items-end lg:col-span-7">
            <Button onClick={() => createBudget.mutate()} disabled={!form.periodRef || createBudget.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Salvar orçamento
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={`Orçamentos cadastrados - folha planejada ${formatMoney(totalPayroll)}`} className="mt-4">
        {budgetsQuery.isLoading && <LoadingState />}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 text-left">Período</th>
                <th className="py-2 text-left">Área</th>
                <th className="py-2 text-left">Centro</th>
                <th className="py-2 text-right">Headcount</th>
                <th className="py-2 text-right">Folha</th>
                <th className="py-2 text-right">Beneficios</th>
                <th className="py-2 text-right">Encargos</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {(budgetsQuery.data ?? []).map((budget) => (
                <tr key={budget.id} className="border-b border-border/60">
                  <td className="py-2">{budget.periodRef}</td>
                  <td className="py-2">{optionsQuery.data?.orgNodes.find((node) => node.id === budget.orgNodeId)?.name ?? 'Geral'}</td>
                  <td className="py-2">{budget.costCenter ?? '-'}</td>
                  <td className="py-2 text-right">{formatNumber(budget.plannedHeadcount)}</td>
                  <td className="py-2 text-right">{formatMoney(budget.plannedPayroll)}</td>
                  <td className="py-2 text-right">{formatMoney(budget.plannedBenefits)}</td>
                  <td className="py-2 text-right">{formatMoney(budget.plannedCharges)}</td>
                  <td className="py-2"><Badge>{budget.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function formatMoney(value: string | number | null | undefined) {
  return formatNumber(Number(value ?? 0), { style: 'currency', currency: 'BRL' });
}
