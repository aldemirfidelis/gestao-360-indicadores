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
import { formatDate, formatNumber } from '@/lib/utils';

interface JobOption {
  id: string;
  code: string;
  name: string;
}

interface SalaryTable {
  id: string;
  code: string;
  name: string;
  currency: string;
  effectiveFrom: string;
  version: number;
  status: string;
  ranges: Array<{ id: string; band: string; minSalary: string; midpointSalary: string; maxSalary: string; jobCatalog?: JobOption | null }>;
}

export default function TabelasSalariaisPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    jobCatalogId: '',
    band: 'B',
    minSalary: '',
    midpointSalary: '',
    maxSalary: '',
  });
  const optionsQuery = useQuery<{ jobs: JobOption[] }>({ queryKey: ['compensation', 'options'], queryFn: () => api('/cargos-salarios/options') });
  const tablesQuery = useQuery<SalaryTable[]>({ queryKey: ['compensation', 'salary-tables'], queryFn: () => api('/cargos-salarios/salary-tables') });
  const createTable = useMutation({
    mutationFn: () =>
      api('/cargos-salarios/salary-tables', {
        method: 'POST',
        json: {
          name: form.name,
          effectiveFrom: form.effectiveFrom,
          ranges: [
            {
              jobCatalogId: form.jobCatalogId || undefined,
              band: form.band,
              minSalary: Number(form.minSalary),
              midpointSalary: Number(form.midpointSalary),
              maxSalary: Number(form.maxSalary),
            },
          ],
        },
      }),
    onSuccess: () => {
      toast.success('Tabela salarial criada');
      setForm({ name: '', effectiveFrom: new Date().toISOString().slice(0, 10), jobCatalogId: '', band: 'B', minSalary: '', midpointSalary: '', maxSalary: '' });
      qc.invalidateQueries({ queryKey: ['compensation', 'salary-tables'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao criar tabela'),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Tabelas Salariais"
        description="Tabelas com vigência, versão e faixas. Alterações em tabela publicada exigem nova revisão."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Tabelas Salariais' }]}
      />
      <CompensationModuleNav />

      <SectionCard title="Nova tabela com faixa inicial">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
          <div className="lg:col-span-2">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div>
            <Label>Vigência inicial</Label>
            <Input type="date" value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} />
          </div>
          <div>
            <Label>Cargo</Label>
            <NativeSelect value={form.jobCatalogId} onChange={(event) => setForm({ ...form, jobCatalogId: event.target.value })}>
              <option value="">Geral</option>
              {(optionsQuery.data?.jobs ?? []).map((job) => <option key={job.id} value={job.id}>{job.code} - {job.name}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label>Faixa</Label>
            <Input value={form.band} onChange={(event) => setForm({ ...form, band: event.target.value })} />
          </div>
          <div>
            <Label>Mínimo</Label>
            <Input type="number" value={form.minSalary} onChange={(event) => setForm({ ...form, minSalary: event.target.value })} />
          </div>
          <div>
            <Label>Ponto médio</Label>
            <Input type="number" value={form.midpointSalary} onChange={(event) => setForm({ ...form, midpointSalary: event.target.value })} />
          </div>
          <div>
            <Label>Maximo</Label>
            <Input type="number" value={form.maxSalary} onChange={(event) => setForm({ ...form, maxSalary: event.target.value })} />
          </div>
          <div className="flex items-end lg:col-span-7">
            <Button onClick={() => createTable.mutate()} disabled={!form.name || !form.minSalary || !form.midpointSalary || !form.maxSalary || createTable.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Salvar tabela
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Tabelas cadastradas" className="mt-4">
        {tablesQuery.isLoading && <LoadingState />}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 text-left">Código</th>
                <th className="py-2 text-left">Nome</th>
                <th className="py-2 text-left">Vigência</th>
                <th className="py-2 text-left">Versao</th>
                <th className="py-2 text-left">Faixas</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {(tablesQuery.data ?? []).map((table) => (
                <tr key={table.id} className="border-b border-border/60">
                  <td className="py-2 font-mono text-xs">{table.code}</td>
                  <td className="py-2 font-medium">{table.name}</td>
                  <td className="py-2">{formatDate(table.effectiveFrom)}</td>
                  <td className="py-2">v{table.version}</td>
                  <td className="py-2">
                    {table.ranges.map((range) => (
                      <div key={range.id} className="text-xs">
                        {range.band}: {formatNumber(Number(range.minSalary), { style: 'currency', currency: table.currency })} / {formatNumber(Number(range.midpointSalary), { style: 'currency', currency: table.currency })} / {formatNumber(Number(range.maxSalary), { style: 'currency', currency: table.currency })}
                      </div>
                    ))}
                  </td>
                  <td className="py-2"><Badge>{table.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

