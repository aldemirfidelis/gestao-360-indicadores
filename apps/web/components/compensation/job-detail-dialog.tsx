'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, History, Power, RotateCcw, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/platform/status-badge';
import { EmptyState } from '@/components/platform/empty-state';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  DESCRIPTION_STATUS_LABELS,
  JOB_STATUS_LABELS,
  type JobCatalog,
} from '@/lib/compensation/types';

const JOB_TYPES = ['administrativo', 'operacional', 'técnico', 'especialista', 'lideranca', 'gestão', 'executivo'];

const editableFields = (job: JobCatalog) => ({
  name: job.name,
  summary: job.summary ?? '',
  family: job.family ?? '',
  careerTrack: job.careerTrack ?? '',
  hierarchyLevel: job.hierarchyLevel ?? '',
  grade: job.grade ?? '',
  salaryBand: job.salaryBand ?? '',
  cbo: job.cbo ?? '',
  criticality: job.criticality ?? '',
  jobType: job.jobType ?? 'administrativo',
});

export function JobDetailDialog({
  job,
  canManage,
  onClose,
}: {
  job: JobCatalog | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(() => (job ? editableFields(job) : null));
  const [inactivating, setInactivating] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    setForm(job ? editableFields(job) : null);
    setInactivating(false);
    setReason('');
  }, [job]);

  const descriptionsQuery = useQuery({
    queryKey: ['compensation', 'descriptions', { jobCatalogId: job?.id }],
    queryFn: () => api(`/cargos-salarios/descriptions?jobCatalogId=${job!.id}`),
    enabled: !!job,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['compensation', 'jobs'] });
    qc.invalidateQueries({ queryKey: ['compensation', 'options'] });
  };

  const update = useMutation({
    mutationFn: () => api(`/cargos-salarios/jobs/${job!.id}`, { method: 'PATCH', json: form }),
    onSuccess: () => {
      toast.success('Cargo atualizado');
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao atualizar'),
  });
  const duplicate = useMutation({
    mutationFn: () => api(`/cargos-salarios/jobs/${job!.id}/duplicate`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Cargo duplicado');
      invalidate();
      onClose();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao duplicar'),
  });
  const version = useMutation({
    mutationFn: (changeReason: string) => api(`/cargos-salarios/jobs/${job!.id}/version`, { method: 'POST', json: { reason: changeReason } }),
    onSuccess: () => {
      toast.success('Nova versão registrada');
      invalidate();
      onClose();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao versionar'),
  });
  const inactivate = useMutation({
    mutationFn: () => api(`/cargos-salarios/jobs/${job!.id}/inactivate`, { method: 'PATCH', json: { reason } }),
    onSuccess: () => {
      toast.success('Cargo inativado');
      invalidate();
      onClose();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao inativar'),
  });
  const reactivate = useMutation({
    mutationFn: () => api(`/cargos-salarios/jobs/${job!.id}/reactivate`, { method: 'PATCH' }),
    onSuccess: () => {
      toast.success('Cargo reativado');
      invalidate();
      onClose();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao reativar'),
  });

  if (!job || !form) return null;
  const isActive = job.status === 'ACTIVE';
  const descriptions = (descriptionsQuery.data as any[]) ?? [];

  return (
    <Dialog open={!!job} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{job.code}</span>
            {job.name}
            <StatusBadge value={job.status} label={JOB_STATUS_LABELS[job.status] ?? job.status} className="ml-1" />
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dados">
          <TabsList>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="versoes">Versões ({job._count?.versions ?? job.currentVersion})</TabsTrigger>
            <TabsTrigger value="descricoes">Descrições ({job._count?.descriptions ?? 0})</TabsTrigger>
            <TabsTrigger value="vinculos">Vínculos</TabsTrigger>
          </TabsList>

          <TabsContent value="dados">
            <fieldset disabled={!canManage} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Família</Label>
                <Input value={form.family} onChange={(e) => setForm({ ...form, family: e.target.value })} />
              </div>
              <div>
                <Label>Trilha de carreira</Label>
                <Input value={form.careerTrack} onChange={(e) => setForm({ ...form, careerTrack: e.target.value })} />
              </div>
              <div>
                <Label>Nível hierarquico</Label>
                <Input value={form.hierarchyLevel} onChange={(e) => setForm({ ...form, hierarchyLevel: e.target.value })} />
              </div>
              <div>
                <Label>Grade</Label>
                <Input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
              </div>
              <div>
                <Label>Faixa</Label>
                <Input value={form.salaryBand} onChange={(e) => setForm({ ...form, salaryBand: e.target.value })} />
              </div>
              <div>
                <Label>CBO</Label>
                <Input value={form.cbo} onChange={(e) => setForm({ ...form, cbo: e.target.value })} />
              </div>
              <div>
                <Label>Tipo</Label>
                <NativeSelect value={form.jobType} onChange={(e) => setForm({ ...form, jobType: e.target.value })}>
                  {JOB_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label>Criticidade</Label>
                <NativeSelect value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value })}>
                  <option value="">Não definida</option>
                  <option value="LOW">Baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                  <option value="CRITICAL">Crítica</option>
                </NativeSelect>
              </div>
              <div className="sm:col-span-2">
                <Label>Descrição resumida</Label>
                <Textarea rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
              </div>
            </fieldset>
            {job.status === 'INACTIVE' && job.inactiveReason && (
              <p className="mt-3 rounded-md bg-status-red/10 px-3 py-2 text-xs text-status-red">Inativado: {job.inactiveReason}</p>
            )}
          </TabsContent>

          <TabsContent value="versoes">
            {(job.versions ?? []).length === 0 ? (
              <EmptyState title="Sem versões registradas" />
            ) : (
              <ul className="space-y-2">
                {(job.versions ?? []).map((v) => (
                  <li key={v.id} className="flex items-center justify-between border-b border-border/60 pb-2 text-sm">
                    <span className="flex items-center gap-2">
                      <History className="h-3.5 w-3.5 text-muted-foreground" /> v{v.version}
                      <span className="text-muted-foreground">{v.changeReason ?? 'Sem motivo'}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDate(v.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="descricoes">
            {descriptions.length === 0 ? (
              <EmptyState title="Nenhuma descrição para este cargo" />
            ) : (
              <ul className="space-y-2">
                {descriptions.map((d) => (
                  <li key={d.id} className="flex items-center justify-between border-b border-border/60 pb-2 text-sm">
                    <span>Versão {d.version}</span>
                    <StatusBadge value={d.status} label={DESCRIPTION_STATUS_LABELS[d.status] ?? d.status} />
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="vinculos">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Stat label="Colaboradores" value={job.linkedEmployees ?? 0} />
              <Stat label="Posições" value={job._count?.positions ?? 0} />
              <Stat label="Faixas salariais" value={job._count?.salaryRanges ?? 0} />
              <Stat label="Descrições" value={job._count?.descriptions ?? 0} />
            </div>
          </TabsContent>
        </Tabs>

        {canManage && (
          <div className="mt-2 border-t pt-4">
            {inactivating ? (
              <div className="space-y-2">
                <Label>Justificativa para inativar</Label>
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setInactivating(false)}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" size="sm" disabled={!reason.trim() || inactivate.isPending} onClick={() => inactivate.mutate()}>
                    Confirmar inativação
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => duplicate.mutate()} disabled={duplicate.isPending}>
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Duplicar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => version.mutate('Nova versão')} disabled={version.isPending}>
                    <History className="mr-1.5 h-3.5 w-3.5" /> Nova versão
                  </Button>
                  {isActive ? (
                    <Button variant="outline" size="sm" className="text-status-red" onClick={() => setInactivating(true)}>
                      <Power className="mr-1.5 h-3.5 w-3.5" /> Inativar
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => reactivate.mutate()} disabled={reactivate.isPending}>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reativar
                    </Button>
                  )}
                </div>
                <Button size="sm" onClick={() => update.mutate()} disabled={update.isPending}>
                  <Save className="mr-1.5 h-3.5 w-3.5" /> Salvar alterações
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3 text-center">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
