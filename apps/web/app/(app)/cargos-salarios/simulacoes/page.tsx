'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Save } from 'lucide-react';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/utils';

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

export default function SimulacoesPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    scenarioType: 'MERITO',
    monthlyImpact: '',
    annualImpact: '',
    affectedCount: '',
    assumptions: '',
    results: '',
  });
  const simulationsQuery = useQuery<Simulation[]>({ queryKey: ['compensation', 'simulations'], queryFn: () => api('/cargos-salarios/simulations') });
  const createSimulation = useMutation({
    mutationFn: () =>
      api('/cargos-salarios/simulations', {
        method: 'POST',
        json: {
          name: form.name,
          scenarioType: form.scenarioType,
          monthlyImpact: form.monthlyImpact ? Number(form.monthlyImpact) : undefined,
          annualImpact: form.annualImpact ? Number(form.annualImpact) : undefined,
          affectedCount: form.affectedCount ? Number(form.affectedCount) : 0,
          assumptions: form.assumptions ? { description: form.assumptions } : undefined,
          results: form.results ? { expectedResult: form.results } : undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Simulação cadastrada');
      setForm({ name: '', scenarioType: 'MERITO', monthlyImpact: '', annualImpact: '', affectedCount: '', assumptions: '', results: '' });
      qc.invalidateQueries({ queryKey: ['compensation', 'simulations'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao cadastrar simulação'),
  });
  const approveSimulation = useMutation({
    mutationFn: (id: string) => api(`/cargos-salarios/simulations/${id}/approve`, { method: 'PATCH', json: {} }),
    onSuccess: () => {
      toast.success('Simulação aprovada');
      qc.invalidateQueries({ queryKey: ['compensation', 'simulations'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao aprovar simulação'),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Simulações"
        description="Cenarios de impacto para mérito, enquadramento, promocao, headcount e reestruturação."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Simulações' }]}
      />
      <CompensationModuleNav />

      <SectionCard title="Nova simulação">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div>
            <Label>Cenario</Label>
            <NativeSelect value={form.scenarioType} onChange={(event) => setForm({ ...form, scenarioType: event.target.value })}>
              <option value="MERITO">Mérito</option>
              <option value="ENQUADRAMENTO">Enquadramento</option>
              <option value="PROMOCAO">Promocao</option>
              <option value="HEADCOUNT">Headcount</option>
              <option value="REESTRUTURACAO">Reestruturação</option>
            </NativeSelect>
          </div>
          <div>
            <Label>Impacto mensal</Label>
            <Input type="number" value={form.monthlyImpact} onChange={(event) => setForm({ ...form, monthlyImpact: event.target.value })} />
          </div>
          <div>
            <Label>Pessoas afetadas</Label>
            <Input type="number" value={form.affectedCount} onChange={(event) => setForm({ ...form, affectedCount: event.target.value })} />
          </div>
          <div className="lg:col-span-2">
            <Label>Premissas</Label>
            <Textarea rows={3} value={form.assumptions} onChange={(event) => setForm({ ...form, assumptions: event.target.value })} />
          </div>
          <div className="lg:col-span-3">
            <Label>Resultado esperado</Label>
            <Textarea rows={3} value={form.results} onChange={(event) => setForm({ ...form, results: event.target.value })} />
          </div>
          <div className="lg:col-span-5">
            <Button onClick={() => createSimulation.mutate()} disabled={!form.name || !form.scenarioType || createSimulation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Salvar simulação
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Simulações cadastradas" className="mt-4">
        {simulationsQuery.isLoading && <LoadingState />}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 text-left">Nome</th>
                <th className="py-2 text-left">Cenario</th>
                <th className="py-2 text-right">Pessoas</th>
                <th className="py-2 text-right">Impacto mensal</th>
                <th className="py-2 text-right">Impacto anual</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {(simulationsQuery.data ?? []).map((simulation) => (
                <tr key={simulation.id} className="border-b border-border/60">
                  <td className="py-2 font-medium">{simulation.name}</td>
                  <td className="py-2">{simulation.scenarioType}</td>
                  <td className="py-2 text-right">{formatNumber(simulation.affectedCount)}</td>
                  <td className="py-2 text-right">{formatMoney(simulation.monthlyImpact)}</td>
                  <td className="py-2 text-right">{formatMoney(simulation.annualImpact)}</td>
                  <td className="py-2"><Badge>{simulation.status}</Badge></td>
                  <td className="py-2 text-right">
                    {simulation.status !== 'APPROVED' && (
                      <Button size="sm" variant="outline" onClick={() => approveSimulation.mutate(simulation.id)} disabled={approveSimulation.isPending}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Aprovar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function formatMoney(value: string | number | null) {
  if (value === null || value === undefined) return '-';
  return formatNumber(Number(value), { style: 'currency', currency: 'BRL' });
}
