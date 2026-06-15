'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Save } from 'lucide-react';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { FilterBar } from '@/components/platform/filter-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/compensation/format';
import type { JobOption, SalarySurvey } from '@/lib/compensation/types';

const MANAGE_PERMS = ['compensation:manage', 'org:positions:manage'];
const NUMERIC_FIELDS = ['minSalary', 'medianSalary', 'averageSalary', 'percentile25', 'percentile50', 'percentile75', 'percentile90'];

const emptyForm = () => ({
  source: 'Pesquisa interna',
  provider: '',
  periodRef: new Date().toISOString().slice(0, 7),
  region: '',
  segment: '',
  internalJobCatalogId: '',
  marketJobName: '',
  minSalary: '',
  percentile25: '',
  percentile50: '',
  percentile75: '',
  percentile90: '',
  medianSalary: '',
  averageSalary: '',
  notes: '',
});

export default function PesquisasSalariaisPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(MANAGE_PERMS);
  const [form, setForm] = useState(emptyForm);
  const [showCreate, setShowCreate] = useState(false);
  const [jobFilter, setJobFilter] = useState('');

  const optionsQuery = useQuery<{ jobs: JobOption[] }>({ queryKey: ['compensation', 'options'], queryFn: () => api('/cargos-salarios/options') });
  const surveysQuery = useQuery<SalarySurvey[]>({ queryKey: ['compensation', 'salary-surveys'], queryFn: () => api('/cargos-salarios/salary-surveys') });

  const createSurvey = useMutation({
    mutationFn: () => api('/cargos-salarios/salary-surveys', { method: 'POST', json: numericPayload(form) }),
    onSuccess: () => {
      toast.success('Pesquisa salarial cadastrada');
      setForm(emptyForm());
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ['compensation', 'salary-surveys'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao cadastrar pesquisa'),
  });

  const jobName = (id: string | null) => optionsQuery.data?.jobs.find((j) => j.id === id)?.name ?? null;
  const all = surveysQuery.data ?? [];
  const surveys = useMemo(() => all.filter((s) => !jobFilter || s.internalJobCatalogId === jobFilter), [all, jobFilter]);
  const linkedCount = all.filter((s) => s.internalJobCatalogId).length;

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Pesquisas Salariais"
        description="Referências de mercado por fonte, período e percentis (P25/P50/P75/P90). Pesquisas vinculadas a um cargo alimentam o posicionamento de mercado no Enquadramento."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Pesquisas Salariais' }]}
      />
      <CompensationModuleNav />

      <FilterBar
        actions={
          canManage && (
            <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova pesquisa
            </Button>
          )
        }
      >
        <div>
          <Label className="text-xs">Cargo interno</Label>
          <NativeSelect value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
            <option value="">Todos</option>
            {(optionsQuery.data?.jobs ?? []).map((job) => (
              <option key={job.id} value={job.id}>{job.code} - {job.name}</option>
            ))}
          </NativeSelect>
        </div>
      </FilterBar>

      {showCreate && canManage && (
        <SectionCard title="Nova referência de mercado" className="mb-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
            <div>
              <Label>Fonte</Label>
              <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
            </div>
            <div>
              <Label>Fornecedor</Label>
              <Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
            </div>
            <div>
              <Label>Período</Label>
              <Input type="month" value={form.periodRef} onChange={(e) => setForm({ ...form, periodRef: e.target.value })} />
            </div>
            <div>
              <Label>Região</Label>
              <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
            </div>
            <div>
              <Label>Segmento</Label>
              <Input value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} />
            </div>
            <div>
              <Label>Cargo interno</Label>
              <NativeSelect value={form.internalJobCatalogId} onChange={(e) => setForm({ ...form, internalJobCatalogId: e.target.value })}>
                <option value="">Sem vínculo</option>
                {(optionsQuery.data?.jobs ?? []).map((job) => (
                  <option key={job.id} value={job.id}>{job.code} - {job.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="lg:col-span-2">
              <Label>Cargo de mercado</Label>
              <Input value={form.marketJobName} onChange={(e) => setForm({ ...form, marketJobName: e.target.value })} />
            </div>
            <div>
              <Label>Mínimo</Label>
              <Input type="number" value={form.minSalary} onChange={(e) => setForm({ ...form, minSalary: e.target.value })} />
            </div>
            <div>
              <Label>P25</Label>
              <Input type="number" value={form.percentile25} onChange={(e) => setForm({ ...form, percentile25: e.target.value })} />
            </div>
            <div>
              <Label>P50 (mediana)</Label>
              <Input type="number" value={form.percentile50} onChange={(e) => setForm({ ...form, percentile50: e.target.value })} />
            </div>
            <div>
              <Label>P75</Label>
              <Input type="number" value={form.percentile75} onChange={(e) => setForm({ ...form, percentile75: e.target.value })} />
            </div>
            <div>
              <Label>P90</Label>
              <Input type="number" value={form.percentile90} onChange={(e) => setForm({ ...form, percentile90: e.target.value })} />
            </div>
            <div>
              <Label>Média</Label>
              <Input type="number" value={form.averageSalary} onChange={(e) => setForm({ ...form, averageSalary: e.target.value })} />
            </div>
            <div className="lg:col-span-6">
              <Label>Observações</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="lg:col-span-6">
              <Button onClick={() => createSurvey.mutate()} disabled={!form.source || !form.periodRef || !form.marketJobName || createSurvey.isPending}>
                <Save className="mr-2 h-4 w-4" /> Salvar pesquisa
              </Button>
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Referências cadastradas"
        actions={<Badge variant="secondary">{linkedCount} vinculadas a cargo</Badge>}
      >
        {surveysQuery.isLoading ? (
          <LoadingState />
        ) : surveys.length === 0 ? (
          <EmptyState title="Nenhuma pesquisa" description="Cadastre referências de mercado com percentis para comparar com seus cargos." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 text-left">Período</th>
                  <th className="py-2 text-left">Fonte</th>
                  <th className="py-2 text-left">Cargo mercado</th>
                  <th className="py-2 text-left">Cargo interno</th>
                  <th className="py-2 text-right">P25</th>
                  <th className="py-2 text-right">P50</th>
                  <th className="py-2 text-right">P75</th>
                  <th className="py-2 text-right">P90</th>
                </tr>
              </thead>
              <tbody>
                {surveys.map((survey) => (
                  <tr key={survey.id} className="border-b border-border/60">
                    <td className="py-2">{survey.periodRef}</td>
                    <td className="py-2">{survey.source}</td>
                    <td className="py-2 font-medium">{survey.marketJobName}</td>
                    <td className="py-2">
                      {survey.internalJobCatalogId ? (
                        jobName(survey.internalJobCatalogId) ?? '-'
                      ) : (
                        <span className="text-muted-foreground">Sem vínculo</span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(survey.percentile25)}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(survey.percentile50 ?? survey.medianSalary)}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(survey.percentile75)}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(survey.percentile90)}</td>
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

function numericPayload(form: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(form).map(([key, value]) => {
      if (NUMERIC_FIELDS.includes(key)) return [key, value ? Number(value) : undefined];
      return [key, value || undefined];
    }),
  );
}
