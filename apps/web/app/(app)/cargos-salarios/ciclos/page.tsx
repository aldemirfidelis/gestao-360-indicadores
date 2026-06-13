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
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/utils';

interface MeritCycle {
  id: string;
  name: string;
  referencePeriod: string;
  criteria: string | null;
  guidelinePercent: string | number | null;
  totalBudget: string | number | null;
  status: string;
  createdAt: string;
}

export default function CiclosMeritoPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    referencePeriod: String(new Date().getFullYear()),
    guidelinePercent: '5',
    totalBudget: '',
    status: 'DRAFT',
    criteria: '',
  });
  const cyclesQuery = useQuery<MeritCycle[]>({ queryKey: ['compensation', 'cycles'], queryFn: () => api('/cargos-salarios/cycles') });
  const createCycle = useMutation({
    mutationFn: () =>
      api('/cargos-salarios/cycles', {
        method: 'POST',
        json: {
          ...form,
          guidelinePercent: form.guidelinePercent ? Number(form.guidelinePercent) : undefined,
          totalBudget: form.totalBudget ? Number(form.totalBudget) : undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Ciclo de mérito cadastrado');
      setForm({ name: '', referencePeriod: String(new Date().getFullYear()), guidelinePercent: '5', totalBudget: '', status: 'DRAFT', criteria: '' });
      qc.invalidateQueries({ queryKey: ['compensation', 'cycles'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao cadastrar ciclo'),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Ciclos de Mérito"
        description="Planejamento de campanhas de mérito com diretriz, orçamento, critérios e status de execução."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Ciclos de Mérito' }]}
      />
      <CompensationModuleNav />

      <SectionCard title="Novo ciclo">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div>
            <Label>Período</Label>
            <Input value={form.referencePeriod} onChange={(event) => setForm({ ...form, referencePeriod: event.target.value })} />
          </div>
          <div>
            <Label>Diretriz (%)</Label>
            <Input type="number" value={form.guidelinePercent} onChange={(event) => setForm({ ...form, guidelinePercent: event.target.value })} />
          </div>
          <div>
            <Label>Orçamento total</Label>
            <Input type="number" value={form.totalBudget} onChange={(event) => setForm({ ...form, totalBudget: event.target.value })} />
          </div>
          <div>
            <Label>Status</Label>
            <NativeSelect value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="DRAFT">Rascunho</option>
              <option value="OPEN">Aberto</option>
              <option value="IN_APPROVAL">Em aprovação</option>
              <option value="APPROVED">Aprovado</option>
              <option value="CLOSED">Encerrado</option>
            </NativeSelect>
          </div>
          <div className="lg:col-span-4">
            <Label>Criterios e elegibilidade</Label>
            <Textarea rows={3} value={form.criteria} onChange={(event) => setForm({ ...form, criteria: event.target.value })} />
          </div>
          <div className="flex items-end">
            <Button onClick={() => createCycle.mutate()} disabled={!form.name || !form.referencePeriod || createCycle.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Salvar ciclo
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Ciclos cadastrados" className="mt-4">
        {cyclesQuery.isLoading && <LoadingState />}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 text-left">Ciclo</th>
                <th className="py-2 text-left">Período</th>
                <th className="py-2 text-right">Diretriz</th>
                <th className="py-2 text-right">Orçamento</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-left">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {(cyclesQuery.data ?? []).map((cycle) => (
                <tr key={cycle.id} className="border-b border-border/60">
                  <td className="py-2 font-medium">{cycle.name}</td>
                  <td className="py-2">{cycle.referencePeriod}</td>
                  <td className="py-2 text-right">{formatPercent(cycle.guidelinePercent)}</td>
                  <td className="py-2 text-right">{formatMoney(cycle.totalBudget)}</td>
                  <td className="py-2"><Badge>{cycle.status}</Badge></td>
                  <td className="py-2">{formatDate(cycle.createdAt)}</td>
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

function formatPercent(value: string | number | null) {
  if (value === null || value === undefined) return '-';
  return `${formatNumber(Number(value) * 100, { maximumFractionDigits: 2 })}%`;
}
