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
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';

interface JobOption {
  id: string;
  code: string;
  name: string;
}

interface Description {
  id: string;
  version: number;
  status: string;
  mission: string | null;
  responsibilities: string | null;
  jobCatalog: JobOption;
  updatedAt: string;
}

export default function DescricoesPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ jobCatalogId: '', mission: '', responsibilities: '', technicalSkills: '', behavioralSkills: '' });
  const optionsQuery = useQuery<{ jobs: JobOption[] }>({
    queryKey: ['compensation', 'options'],
    queryFn: () => api('/cargos-salarios/options'),
  });
  const descriptionsQuery = useQuery<Description[]>({
    queryKey: ['compensation', 'descriptions'],
    queryFn: () => api('/cargos-salarios/descriptions'),
  });
  const createDescription = useMutation({
    mutationFn: () => api('/cargos-salarios/descriptions', { method: 'POST', json: form }),
    onSuccess: () => {
      toast.success('Descrição criada');
      setForm({ jobCatalogId: '', mission: '', responsibilities: '', technicalSkills: '', behavioralSkills: '' });
      qc.invalidateQueries({ queryKey: ['compensation', 'descriptions'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao criar descrição'),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Descrições de Cargos"
        description="Elaboração e versionamento das descricoes, com status de workflow controlado no backend."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Descrições' }]}
      />
      <CompensationModuleNav />

      <SectionCard title="Nova versão de descrição">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <Label>Cargo</Label>
            <NativeSelect value={form.jobCatalogId} onChange={(event) => setForm({ ...form, jobCatalogId: event.target.value })}>
              <option value="">Selecione</option>
              {(optionsQuery.data?.jobs ?? []).map((job) => (
                <option key={job.id} value={job.id}>{job.code} - {job.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>Missao do cargo</Label>
            <Textarea rows={4} value={form.mission} onChange={(event) => setForm({ ...form, mission: event.target.value })} />
          </div>
          <div>
            <Label>Principais responsabilidades</Label>
            <Textarea rows={4} value={form.responsibilities} onChange={(event) => setForm({ ...form, responsibilities: event.target.value })} />
          </div>
          <div>
            <Label>Competencias técnicas</Label>
            <Textarea rows={3} value={form.technicalSkills} onChange={(event) => setForm({ ...form, technicalSkills: event.target.value })} />
          </div>
          <div>
            <Label>Competencias comportamentais</Label>
            <Textarea rows={3} value={form.behavioralSkills} onChange={(event) => setForm({ ...form, behavioralSkills: event.target.value })} />
          </div>
          <div className="lg:col-span-2">
            <Button onClick={() => createDescription.mutate()} disabled={!form.jobCatalogId || createDescription.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Criar descrição
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Descrições cadastradas" className="mt-4">
        {descriptionsQuery.isLoading && <LoadingState />}
        <div className="space-y-3">
          {(descriptionsQuery.data ?? []).map((item) => (
            <div key={item.id} className="border border-border/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{item.jobCatalog.code} - {item.jobCatalog.name}</div>
                  <div className="text-xs text-muted-foreground">Versao {item.version}</div>
                </div>
                <Badge>{item.status}</Badge>
              </div>
              <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                <div><span className="text-muted-foreground">Missao:</span> {item.mission ?? '-'}</div>
                <div><span className="text-muted-foreground">Responsabilidades:</span> {item.responsibilities ?? '-'}</div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

