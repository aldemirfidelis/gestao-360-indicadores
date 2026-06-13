'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

interface JobOption {
  id: string;
  code: string;
  name: string;
}

interface SurveyRow {
  id: string;
  source: string;
  provider: string | null;
  periodRef: string;
  region: string | null;
  segment: string | null;
  internalJobCatalogId: string | null;
  marketJobName: string;
  minSalary: string | number | null;
  medianSalary: string | number | null;
  averageSalary: string | number | null;
  notes: string | null;
}

export default function PesquisasSalariaisPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    source: 'Pesquisa interna',
    provider: '',
    periodRef: new Date().toISOString().slice(0, 7),
    region: '',
    segment: '',
    internalJobCatalogId: '',
    marketJobName: '',
    minSalary: '',
    medianSalary: '',
    averageSalary: '',
    notes: '',
  });
  const optionsQuery = useQuery<{ jobs: JobOption[] }>({ queryKey: ['compensation', 'options'], queryFn: () => api('/cargos-salarios/options') });
  const surveysQuery = useQuery<SurveyRow[]>({ queryKey: ['compensation', 'salary-surveys'], queryFn: () => api('/cargos-salarios/salary-surveys') });
  const createSurvey = useMutation({
    mutationFn: () =>
      api('/cargos-salarios/salary-surveys', {
        method: 'POST',
        json: numericPayload(form),
      }),
    onSuccess: () => {
      toast.success('Pesquisa salarial cadastrada');
      setForm({ source: 'Pesquisa interna', provider: '', periodRef: new Date().toISOString().slice(0, 7), region: '', segment: '', internalJobCatalogId: '', marketJobName: '', minSalary: '', medianSalary: '', averageSalary: '', notes: '' });
      qc.invalidateQueries({ queryKey: ['compensation', 'salary-surveys'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao cadastrar pesquisa'),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Pesquisas Salariais"
        description="Cadastro de referências de mercado por fonte, período, região, segmento e cargo."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Pesquisas Salariais' }]}
      />
      <CompensationModuleNav />

      <SectionCard title="Nova referência de mercado">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
          <div>
            <Label>Fonte</Label>
            <Input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} />
          </div>
          <div>
            <Label>Fornecedor</Label>
            <Input value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} />
          </div>
          <div>
            <Label>Período</Label>
            <Input type="month" value={form.periodRef} onChange={(event) => setForm({ ...form, periodRef: event.target.value })} />
          </div>
          <div>
            <Label>Região</Label>
            <Input value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} />
          </div>
          <div>
            <Label>Segmento</Label>
            <Input value={form.segment} onChange={(event) => setForm({ ...form, segment: event.target.value })} />
          </div>
          <div>
            <Label>Cargo interno</Label>
            <NativeSelect value={form.internalJobCatalogId} onChange={(event) => setForm({ ...form, internalJobCatalogId: event.target.value })}>
              <option value="">Sem vinculo</option>
              {(optionsQuery.data?.jobs ?? []).map((job) => <option key={job.id} value={job.id}>{job.code} - {job.name}</option>)}
            </NativeSelect>
          </div>
          <div className="lg:col-span-2">
            <Label>Cargo de mercado</Label>
            <Input value={form.marketJobName} onChange={(event) => setForm({ ...form, marketJobName: event.target.value })} />
          </div>
          <div>
            <Label>Mínimo</Label>
            <Input type="number" value={form.minSalary} onChange={(event) => setForm({ ...form, minSalary: event.target.value })} />
          </div>
          <div>
            <Label>Médiana</Label>
            <Input type="number" value={form.medianSalary} onChange={(event) => setForm({ ...form, medianSalary: event.target.value })} />
          </div>
          <div>
            <Label>Média</Label>
            <Input type="number" value={form.averageSalary} onChange={(event) => setForm({ ...form, averageSalary: event.target.value })} />
          </div>
          <div className="lg:col-span-6">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </div>
          <div className="lg:col-span-6">
            <Button onClick={() => createSurvey.mutate()} disabled={!form.source || !form.periodRef || !form.marketJobName || createSurvey.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Salvar pesquisa
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Referências cadastradas" className="mt-4">
        {surveysQuery.isLoading && <LoadingState />}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 text-left">Período</th>
                <th className="py-2 text-left">Fonte</th>
                <th className="py-2 text-left">Cargo mercado</th>
                <th className="py-2 text-left">Cargo interno</th>
                <th className="py-2 text-left">Região</th>
                <th className="py-2 text-right">Mínimo</th>
                <th className="py-2 text-right">Médiana</th>
                <th className="py-2 text-right">Média</th>
              </tr>
            </thead>
            <tbody>
              {(surveysQuery.data ?? []).map((survey) => (
                <tr key={survey.id} className="border-b border-border/60">
                  <td className="py-2">{survey.periodRef}</td>
                  <td className="py-2">{survey.source}</td>
                  <td className="py-2 font-medium">{survey.marketJobName}</td>
                  <td className="py-2">{optionsQuery.data?.jobs.find((job) => job.id === survey.internalJobCatalogId)?.name ?? '-'}</td>
                  <td className="py-2">{survey.region ?? '-'}</td>
                  <td className="py-2 text-right">{formatMoney(survey.minSalary)}</td>
                  <td className="py-2 text-right">{formatMoney(survey.medianSalary)}</td>
                  <td className="py-2 text-right">{formatMoney(survey.averageSalary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function numericPayload(form: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(form).map(([key, value]) => {
      if (['minSalary', 'medianSalary', 'averageSalary'].includes(key)) return [key, value ? Number(value) : undefined];
      return [key, value || undefined];
    }),
  );
}

function formatMoney(value: string | number | null) {
  if (value === null || value === undefined) return '-';
  return formatNumber(Number(value), { style: 'currency', currency: 'BRL' });
}
