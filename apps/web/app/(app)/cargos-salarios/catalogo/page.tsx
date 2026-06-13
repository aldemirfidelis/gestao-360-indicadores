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

interface JobCatalog {
  id: string;
  code: string;
  name: string;
  summary: string | null;
  family: string | null;
  grade: string | null;
  salaryBand: string | null;
  jobType: string;
  status: string;
  currentVersion: number;
  linkedEmployees?: number;
  _count?: { positions: number; descriptions: number; salaryRanges: number; versions: number };
}

const initial = { name: '', summary: '', family: '', grade: '', salaryBand: '', jobType: 'administrativo' };

export default function CatalogoCargosPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(initial);
  const jobsQuery = useQuery<JobCatalog[]>({
    queryKey: ['compensation', 'jobs'],
    queryFn: () => api('/cargos-salarios/jobs'),
  });
  const createJob = useMutation({
    mutationFn: () => api('/cargos-salarios/jobs', { method: 'POST', json: form }),
    onSuccess: () => {
      toast.success('Cargo criado');
      setForm(initial);
      qc.invalidateQueries({ queryKey: ['compensation', 'jobs'] });
      qc.invalidateQueries({ queryKey: ['compensation', 'options'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao criar cargo'),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Catálogo de Cargos"
        description="Cadastro estrutural reutilizavel dos cargos, com versionamento e vinculos ao quadro."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Catálogo' }]}
      />
      <CompensationModuleNav />

      <SectionCard title="Novo cargo" description="O código é gerado automaticamente quando deixado em branco.">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Label>Nome do cargo</Label>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div>
            <Label>Familia</Label>
            <Input value={form.family} onChange={(event) => setForm({ ...form, family: event.target.value })} />
          </div>
          <div>
            <Label>Grade</Label>
            <Input value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })} />
          </div>
          <div>
            <Label>Faixa</Label>
            <Input value={form.salaryBand} onChange={(event) => setForm({ ...form, salaryBand: event.target.value })} />
          </div>
          <div>
            <Label>Tipo</Label>
            <NativeSelect value={form.jobType} onChange={(event) => setForm({ ...form, jobType: event.target.value })}>
              <option value="administrativo">Administrativo</option>
              <option value="operacional">Operacional</option>
              <option value="tecnico">Tecnico</option>
              <option value="especialista">Especialista</option>
              <option value="lideranca">Lideranca</option>
              <option value="gestao">Gestão</option>
              <option value="executivo">Executivo</option>
            </NativeSelect>
          </div>
          <div className="lg:col-span-5">
            <Label>Descrição resumida</Label>
            <Textarea rows={2} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} />
          </div>
          <div className="flex items-end">
            <Button onClick={() => createJob.mutate()} disabled={!form.name.trim() || createJob.isPending} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              Salvar
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Cargos cadastrados" className="mt-4" actions={<Badge variant="secondary">{jobsQuery.data?.length ?? 0} registros</Badge>}>
        {jobsQuery.isLoading && <LoadingState />}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 text-left">Código</th>
                <th className="py-2 text-left">Cargo</th>
                <th className="py-2 text-left">Familia</th>
                <th className="py-2 text-left">Grade/Faixa</th>
                <th className="py-2 text-left">Vinculos</th>
                <th className="py-2 text-left">Versao</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {(jobsQuery.data ?? []).map((job) => (
                <tr key={job.id} className="border-b border-border/60">
                  <td className="py-2 font-mono text-xs">{job.code}</td>
                  <td className="py-2">
                    <div className="font-medium">{job.name}</div>
                    <div className="max-w-md truncate text-xs text-muted-foreground">{job.summary}</div>
                  </td>
                  <td className="py-2">{job.family ?? '-'}</td>
                  <td className="py-2">{[job.grade, job.salaryBand].filter(Boolean).join(' / ') || '-'}</td>
                  <td className="py-2">{job.linkedEmployees ?? 0} pessoas · {job._count?.positions ?? 0} posicoes</td>
                  <td className="py-2">v{job.currentVersion}</td>
                  <td className="py-2"><Badge variant={job.status === 'ACTIVE' ? 'default' : 'secondary'}>{job.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
