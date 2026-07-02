'use client';

import { useMemo, useState } from 'react';
import { ReasonDialog, type ReasonDialogState } from '@/components/platform/reason-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ArrowRight, FileDown, Pencil, Plus, Printer, Send } from 'lucide-react';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { DescriptionEditorDialog, type DescriptionRecord } from '@/components/compensation/description-editor-dialog';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { FilterBar } from '@/components/platform/filter-bar';
import { StatusBadge } from '@/components/platform/status-badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { DESCRIPTION_STATUS_LABELS, DESCRIPTION_TRANSITIONS, type JobOption } from '@/lib/compensation/types';
import { printDescription } from '@/lib/compensation/print-description';
import { downloadBase64 } from '@/lib/compensation/format';

const MANAGE_PERMS = ['compensation:descriptions:update', 'compensation:manage', 'org:positions:manage'];
const APPROVE_PERMS = ['compensation:descriptions:approve', 'compensation:manage'];
const APPROVAL_TRANSITIONS = new Set(['APPROVED', 'PUBLISHED']);

export default function DescricoesPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(MANAGE_PERMS);
  const canApprove = hasPermission(APPROVE_PERMS);

  const [statusFilter, setStatusFilter] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [editor, setEditor] = useState<{ mode: 'new' | 'edit'; record: DescriptionRecord | null } | null>(null);
  const [reasonDialog, setReasonDialog] = useState<ReasonDialogState | null>(null);

  const optionsQuery = useQuery<{ jobs: JobOption[] }>({ queryKey: ['compensation', 'options'], queryFn: () => api('/cargos-salarios/options') });
  const descriptionsQuery = useQuery<DescriptionRecord[]>({
    queryKey: ['compensation', 'descriptions'],
    queryFn: () => api('/cargos-salarios/descriptions'),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      api(`/cargos-salarios/descriptions/${id}/status`, { method: 'PATCH', json: { status, reason } }),
    onSuccess: () => {
      toast.success('Status atualizado');
      qc.invalidateQueries({ queryKey: ['compensation', 'descriptions'] });
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao mudar status'),
  });

  const all = descriptionsQuery.data ?? [];
  const filtered = useMemo(
    () =>
      all.filter((d) => {
        if (statusFilter && d.status !== statusFilter) return false;
        if (jobFilter && (d.jobCatalog?.id ?? d.jobCatalogId) !== jobFilter) return false;
        return true;
      }),
    [all, statusFilter, jobFilter],
  );

  async function exportDocx(record: DescriptionRecord) {
    try {
      const res = await api<{ filename: string; contentType: string; base64: string }>(`/cargos-salarios/descriptions/${record.id}/docx`);
      downloadBase64(res.filename, res.contentType, res.base64);
    } catch (error: any) {
      toast.error(error?.message ?? 'Falha ao gerar DOCX');
    }
  }

  async function sendToGed(record: DescriptionRecord) {
    try {
      const res = await api<{ documentId: string; code: string | null }>(`/cargos-salarios/descriptions/${record.id}/document`, { method: 'POST' });
      toast.success(`Documento ${res.code ?? ''} criado no GED. Edite pela web por lá.`);
      router.push('/documents');
    } catch (error: any) {
      toast.error(error?.message ?? 'Falha ao enviar ao GED');
    }
  }

  function canDoTransition(target: string) {
    return APPROVAL_TRANSITIONS.has(target) ? canApprove : canManage;
  }

  function handleTransition(record: DescriptionRecord, target: string) {
    if (target === 'ADJUSTMENTS_REQUESTED') {
      setReasonDialog({
        title: 'Solicitar ajustes na descrição',
        label: 'Descreva os ajustes solicitados',
        confirmLabel: 'Solicitar ajustes',
        onConfirm: (reason) => changeStatus.mutate({ id: record.id, status: target, reason }),
      });
      return;
    }
    changeStatus.mutate({ id: record.id, status: target, reason: undefined });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Descrições de Cargos"
        description="Elaboração e versionamento das descrições com fluxo de trabalho de revisão, aprovação e publicação."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Descrições' }]}
      />
      <CompensationModuleNav />

      <FilterBar
        actions={
          canManage && (
            <Button size="sm" onClick={() => setEditor({ mode: 'new', record: null })}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova descrição
            </Button>
          )
        }
      >
        <div>
          <Label className="text-xs">Cargo</Label>
          <NativeSelect value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
            <option value="">Todos</option>
            {(optionsQuery.data?.jobs ?? []).map((job) => (
              <option key={job.id} value={job.id}>
                {job.code} - {job.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <NativeSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(DESCRIPTION_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </FilterBar>

      <SectionCard title="Descrições cadastradas">
        {descriptionsQuery.isLoading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState title="Nenhuma descrição" description="Crie a primeira descrição de cargo ou ajuste os filtros." />
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const transitions = DESCRIPTION_TRANSITIONS[item.status] ?? [];
              return (
                <div key={item.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {item.jobCatalog ? `${item.jobCatalog.code} - ${item.jobCatalog.name}` : 'Cargo'}
                      </div>
                      <div className="text-xs text-muted-foreground">Versão {item.version}</div>
                    </div>
                    <StatusBadge value={item.status} label={DESCRIPTION_STATUS_LABELS[item.status] ?? item.status} />
                  </div>

                  <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                    <div className="line-clamp-2">
                      <span className="text-muted-foreground">Missão:</span> {item.mission || '-'}
                    </div>
                    <div className="line-clamp-2">
                      <span className="text-muted-foreground">Responsabilidades:</span> {item.responsibilities || '-'}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                    <Button variant="ghost" size="sm" onClick={() => printDescription(item)}>
                      <Printer className="mr-1.5 h-3.5 w-3.5" /> Imprimir
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => exportDocx(item)}>
                      <FileDown className="mr-1.5 h-3.5 w-3.5" /> Word
                    </Button>
                    {canManage && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setEditor({ mode: 'edit', record: item })}>
                          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => sendToGed(item)} title="Cria um documento controlado no GED, editável pela web (Collabora)">
                          <Send className="mr-1.5 h-3.5 w-3.5" /> Enviar ao GED
                        </Button>
                      </>
                    )}
                    <div className="ml-auto flex flex-wrap gap-2">
                      {transitions.map((target) => (
                        <Button
                          key={target}
                          variant="outline"
                          size="sm"
                          disabled={!canDoTransition(target) || changeStatus.isPending}
                          onClick={() => handleTransition(item, target)}
                        >
                          <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                          {DESCRIPTION_STATUS_LABELS[target] ?? target}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <DescriptionEditorDialog
        open={!!editor}
        mode={editor?.mode ?? 'new'}
        record={editor?.record ?? null}
        jobs={optionsQuery.data?.jobs ?? []}
        canManage={canManage}
        onClose={() => setEditor(null)}
      />
      <ReasonDialog state={reasonDialog} onClose={() => setReasonDialog(null)} />
    </div>
  );
}
