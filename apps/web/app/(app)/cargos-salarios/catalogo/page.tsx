'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Grid3x3, Plus, Search, Upload } from 'lucide-react';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { JobDetailDialog } from '@/components/compensation/job-detail-dialog';
import { ImportJobsDialog } from '@/components/compensation/import-jobs-dialog';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { FilterBar } from '@/components/platform/filter-bar';
import { StatusBadge } from '@/components/platform/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { jobArchitecture } from '@/lib/compensation/analytics';
import { JOB_STATUS_LABELS, type JobCatalog } from '@/lib/compensation/types';
import { cn } from '@/lib/utils';

const initial = { name: '', summary: '', family: '', grade: '', salaryBand: '', jobType: 'administrativo' };
const MANAGE_PERMS = ['compensation:jobs:create', 'compensation:manage', 'org:positions:manage'];

export default function CatalogoCargosPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(MANAGE_PERMS);
  const [form, setForm] = useState(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<JobCatalog | null>(null);
  const [showImport, setShowImport] = useState(false);

  const jobsQuery = useQuery<JobCatalog[]>({
    queryKey: ['compensation', 'jobs'],
    queryFn: () => api('/cargos-salarios/jobs'),
  });
  const createJob = useMutation({
    mutationFn: () => api('/cargos-salarios/jobs', { method: 'POST', json: form }),
    onSuccess: () => {
      toast.success('Cargo criado');
      setForm(initial);
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ['compensation', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['compensation', 'options'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao criar cargo'),
  });

  const jobs = jobsQuery.data ?? [];
  const families = useMemo(() => Array.from(new Set(jobs.map((j) => j.family).filter(Boolean))) as string[], [jobs]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return jobs.filter((job) => {
      if (familyFilter && job.family !== familyFilter) return false;
      if (statusFilter && job.status !== statusFilter) return false;
      if (term && !`${job.code} ${job.name} ${job.summary ?? ''}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [jobs, search, familyFilter, statusFilter]);
  const architecture = useMemo(() => jobArchitecture(jobs), [jobs]);

  // mantem o cargo selecionado sincronizado com os dados mais recentes
  const selectedLive = selected ? jobs.find((j) => j.id === selected.id) ?? selected : null;

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Catálogo de Cargos"
        description="Cadastro estrutural reutilizável dos cargos, com versionamento, vínculos e arquitetura de carreira."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Catálogo' }]}
      />
      <CompensationModuleNav />

      <FilterBar
        actions={
          canManage && (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
                <Upload className="mr-1.5 h-4 w-4" /> Importar CSV
              </Button>
              <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
                <Plus className="mr-1.5 h-4 w-4" /> Novo cargo
              </Button>
            </>
          )
        }
      >
        <div className="sm:col-span-2">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Código, nome ou resumo" className="pl-8" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Família</Label>
          <NativeSelect value={familyFilter} onChange={(e) => setFamilyFilter(e.target.value)}>
            <option value="">Todas</option>
            {families.map((family) => (
              <option key={family} value={family}>
                {family}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <NativeSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(JOB_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </FilterBar>

      {showCreate && canManage && (
        <SectionCard title="Novo cargo" description="O código é gerado automaticamente quando deixado em branco." className="mb-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
            <div className="lg:col-span-3">
              <Label>Nome do cargo</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Analista Administrativo Júnior" />
            </div>
            <div className="lg:col-span-3">
              <Label>Tipo (categoria funcional)</Label>
              <NativeSelect value={form.jobType} onChange={(e) => setForm({ ...form, jobType: e.target.value })}>
                <option value="administrativo">Administrativo</option>
                <option value="operacional">Operacional</option>
                <option value="tecnico">Técnico</option>
                <option value="especialista">Especialista</option>
                <option value="lideranca">Liderança</option>
                <option value="gestao">Gestão</option>
                <option value="executivo">Executivo</option>
              </NativeSelect>
            </div>
            <div className="lg:col-span-5">
              <Label>Descrição resumida</Label>
              <Textarea rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
            </div>
            <div className="flex items-end">
              <Button onClick={() => createJob.mutate()} disabled={!form.name.trim() || createJob.isPending} className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Salvar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground lg:col-span-6">A faixa (A–F) e o salário do cargo são definidos em <strong>Tabelas Salariais</strong>.</p>
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Cargos cadastrados"
        actions={<Badge variant="secondary">{filtered.length} de {jobs.length}</Badge>}
      >
        {jobsQuery.isLoading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState title="Nenhum cargo encontrado" description="Ajuste os filtros ou cadastre um novo cargo." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 text-left">Código</th>
                  <th className="py-2 text-left">Cargo</th>
                  <th className="py-2 text-left">Tipo</th>
                  <th className="py-2 text-left">Vínculos</th>
                  <th className="py-2 text-left">Versão</th>
                  <th className="py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((job) => (
                  <tr
                    key={job.id}
                    className="cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40"
                    onClick={() => setSelected(job)}
                  >
                    <td className="py-2 font-mono text-xs">{job.code}</td>
                    <td className="py-2">
                      <div className="font-medium">{job.name}</div>
                      <div className="max-w-md truncate text-xs text-muted-foreground">{job.summary}</div>
                    </td>
                    <td className="py-2 capitalize">{job.jobType ?? '-'}</td>
                    <td className="py-2">{job.linkedEmployees ?? 0} pessoas · {job._count?.positions ?? 0} posições</td>
                    <td className="py-2">v{job.currentVersion}</td>
                    <td className="py-2">
                      <StatusBadge value={job.status} label={JOB_STATUS_LABELS[job.status] ?? job.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Arquitetura de cargos"
        description="Distribuição de cargos por família e grade — base para trilhas de carreira e nivelamento."
        className="mt-4"
        actions={<Grid3x3 className="h-4 w-4 text-muted-foreground" />}
      >
        {architecture.families.length === 0 ? (
          <EmptyState title="Sem dados de arquitetura" description="Defina família e grade nos cargos para visualizar a matriz." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border bg-muted/40 p-2 text-left text-xs uppercase text-muted-foreground">Família \ Grade</th>
                  {architecture.grades.map((grade) => (
                    <th key={grade} className="border bg-muted/40 p-2 text-center text-xs uppercase text-muted-foreground">
                      {grade}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {architecture.families.map((family) => (
                  <tr key={family}>
                    <td className="border p-2 text-xs font-medium">{family}</td>
                    {architecture.grades.map((grade) => {
                      const count = architecture.counts[family]?.[grade] ?? 0;
                      return (
                        <td
                          key={grade}
                          className={cn('border p-2 text-center tabular-nums', count > 0 ? 'bg-status-blue/10 font-medium text-status-blue' : 'text-muted-foreground/40')}
                        >
                          {count || '·'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <JobDetailDialog job={selectedLive} canManage={canManage} onClose={() => setSelected(null)} />
      <ImportJobsDialog open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
