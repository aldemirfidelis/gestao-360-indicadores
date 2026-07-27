'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Archive, FileText, Plus, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/training/training-bits';
import {
  MODALITY_LABEL,
  REQUIREMENT_TARGET_LABEL,
  VALIDITY_KIND_LABEL,
  hoursLabel,
  validityLabel,
  type RequirementItem,
  type TrainingItem,
  type TrainingModality,
  type ValidityKind,
} from '@/lib/training/types';

interface OrgOption { id: string; name: string }

function TreinamentosContent() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['training:create', 'training:manage']);
  const canRequire = hasPermission(['training:requirements', 'training:manage']);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [openForm, setOpenForm] = useState(searchParams.get('novo') === '1');
  const [requirementFor, setRequirementFor] = useState<TrainingItem | null>(null);

  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (status) params.set('status', status);

  const trainings = useQuery<TrainingItem[]>({
    queryKey: ['training-catalog', params.toString()],
    queryFn: () => api(`/training/catalog/trainings?${params.toString()}`),
  });
  const requirements = useQuery<RequirementItem[]>({
    queryKey: ['training-requirements'],
    queryFn: () => api('/training/catalog/requirements'),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['training-catalog'] });
    void qc.invalidateQueries({ queryKey: ['training-requirements'] });
    void qc.invalidateQueries({ queryKey: ['training-overview'] });
    void qc.invalidateQueries({ queryKey: ['training-assignments'] });
  };

  const archive = useMutation({
    mutationFn: (id: string) => api(`/training/catalog/trainings/${id}`, { method: 'DELETE' }),
    onSuccess: (result: any) => {
      toast.success(result?.deactivated ? 'Treinamento inativado (possui histórico).' : 'Treinamento excluído.');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeRequirement = useMutation({
    mutationFn: (id: string) => api(`/training/catalog/requirements/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Exigência removida. A matriz foi recalculada.');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const items = trainings.data ?? [];

  return (
    <>
      <Tabs defaultValue="catalogo" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="catalogo">Treinamentos</TabsTrigger>
            <TabsTrigger value="exigencias">Exigências da matriz</TabsTrigger>
          </TabsList>
          {canCreate && (
            <Button onClick={() => setOpenForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo treinamento
            </Button>
          )}
        </div>

        <TabsContent value="catalogo" className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-3">
              <div className="relative md:col-span-2">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" placeholder="Buscar por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Todas as situações</option>
                <option value="ACTIVE">Ativos</option>
                <option value="INACTIVE">Inativos</option>
                <option value="DRAFT">Rascunho</option>
              </NativeSelect>
            </CardContent>
          </Card>

          {trainings.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : items.length === 0 ? (
            <EmptyState
              title="Nenhum treinamento cadastrado."
              description="Cadastre os treinamentos e depois vincule as exigências aos cargos e áreas."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Treinamento</th>
                    <th className="px-4 py-2.5 text-left font-medium">Modalidade</th>
                    <th className="px-4 py-2.5 text-left font-medium">Carga</th>
                    <th className="px-4 py-2.5 text-left font-medium">Validade</th>
                    <th className="px-4 py-2.5 text-left font-medium">Documento (GED)</th>
                    <th className="px-4 py-2.5 text-right font-medium">Uso</th>
                    <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((training) => (
                    <tr key={training.id} className={cn('transition-colors hover:bg-muted/40', training.status !== 'ACTIVE' && 'opacity-60')}>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{training.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {training.code}
                          {training.category ? ` · ${training.category.name}` : ''}
                          {training.status !== 'ACTIVE' ? ' · inativo' : ''}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{MODALITY_LABEL[training.modality]}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{hoursLabel(training.workloadMinutes)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{validityLabel(training.validityKind, training.validityValue)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {training.document ? (
                          <span className="inline-flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5" />
                            {training.document.code ?? training.document.title}
                            <span className="text-[11px]">rev. {training.document.version}</span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {training.requirements} exig. · {training.assignments} pess.
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {canRequire && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setRequirementFor(training)}>
                              Exigir
                            </Button>
                          )}
                          {canCreate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-destructive hover:text-destructive"
                              title={training.assignments > 0 ? 'Possui histórico: será inativado' : 'Excluir'}
                              onClick={() => archive.mutate(training.id)}
                            >
                              {training.assignments > 0 ? <Archive className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="exigencias" className="space-y-4">
          {requirements.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (requirements.data ?? []).length === 0 ? (
            <EmptyState
              title="Nenhuma exigência cadastrada."
              description="A exigência é o que transforma um treinamento em pendência do colaborador. Use o botão Exigir na aba Treinamentos."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Treinamento</th>
                    <th className="px-4 py-2.5 text-left font-medium">Aplica-se a</th>
                    <th className="px-4 py-2.5 text-left font-medium">Prazos</th>
                    <th className="px-4 py-2.5 text-left font-medium">Justificativa</th>
                    <th className="px-4 py-2.5 text-right font-medium">Pessoas</th>
                    <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(requirements.data ?? []).map((requirement) => (
                    <tr key={requirement.id} className="align-top transition-colors hover:bg-muted/40">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{requirement.training.name}</div>
                        <div className="text-[11px] text-muted-foreground">{requirement.training.code}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div>{requirement.targetLabel}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {REQUIREMENT_TARGET_LABEL[requirement.target]}
                          {!requirement.mandatory && ' · recomendado'}
                          {requirement.blocksOperation && ' · bloqueia atividade'}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[11px] text-muted-foreground">
                        {requirement.admissionDeadlineDays ? <div>Admissão: {requirement.admissionDeadlineDays} dias</div> : null}
                        {requirement.movementDeadlineDays ? <div>Movimentação: {requirement.movementDeadlineDays} dias</div> : null}
                        {requirement.validityKind ? <div>Validade: {validityLabel(requirement.validityKind, requirement.validityValue)}</div> : null}
                        {!requirement.admissionDeadlineDays && !requirement.movementDeadlineDays && !requirement.validityKind && '—'}
                      </td>
                      <td className="max-w-[240px] px-4 py-2.5 text-[11px] text-muted-foreground">
                        {requirement.activity && <div>Atividade: {requirement.activity}</div>}
                        {requirement.justification ?? (requirement.activity ? '' : '—')}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{requirement.assignments}</td>
                      <td className="px-4 py-2.5 text-right">
                        {canRequire && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => removeRequirement.mutate(requirement.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <TrainingFormDialog open={openForm} onOpenChange={setOpenForm} onSaved={invalidate} />
      <RequirementDialog training={requirementFor} onClose={() => setRequirementFor(null)} onSaved={invalidate} />
    </>
  );
}

export default function TreinamentosPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Treinamento e Desenvolvimento"
        tone="view"
        title="Treinamentos"
        description="Catálogo de treinamentos e as exigências que geram a matriz por cargo, área ou colaborador."
        breadcrumbs={[{ label: 'Treinamento', href: '/treinamento' }, { label: 'Treinamentos' }]}
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <TreinamentosContent />
      </Suspense>
    </div>
  );
}

// ---------------------------------------------------------------- diálogos

function TrainingFormDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    description: '',
    categoryId: '',
    modality: 'PRESENCIAL' as TrainingModality,
    workloadMinutes: 60,
    validityKind: 'NONE' as ValidityKind,
    validityValue: '',
    dueSoonDays: 30,
    deadlineDays: '',
    documentId: '',
    requiresAttendance: true,
    requiresAssessment: false,
    minimumScore: '',
    requiresCertificate: false,
    requiresEffectiveness: false,
  });

  const categories = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['training-categories'],
    queryFn: () => api('/training/catalog/categories'),
    enabled: open,
  });
  const documents = useQuery<{ items: Array<{ id: string; code?: string | null; title: string; version: number }> }>({
    queryKey: ['training-documents-picker'],
    queryFn: () => api('/documents?status=PUBLISHED&take=200'),
    enabled: open,
  });

  const save = useMutation({
    mutationFn: () =>
      api('/training/catalog/trainings', {
        method: 'POST',
        json: {
          ...form,
          validityValue: form.validityValue || null,
          deadlineDays: form.deadlineDays || null,
          minimumScore: form.minimumScore || null,
          categoryId: form.categoryId || null,
          documentId: form.documentId || null,
        },
      }),
    onSuccess: () => {
      toast.success('Treinamento cadastrado.');
      void qc.invalidateQueries({ queryKey: ['training-catalog'] });
      onSaved();
      onOpenChange(false);
      setForm((current) => ({ ...current, name: '', description: '' }));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const docs = (documents.data as any)?.items ?? (Array.isArray(documents.data) ? documents.data : []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo treinamento</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Descrição" className="sm:col-span-2">
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Categoria">
            <NativeSelect value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Sem categoria</option>
              {(categories.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Modalidade">
            <NativeSelect value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value as TrainingModality })}>
              {(Object.keys(MODALITY_LABEL) as TrainingModality[]).map((key) => (
                <option key={key} value={key}>{MODALITY_LABEL[key]}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Carga horária (minutos)">
            <Input type="number" min={1} value={form.workloadMinutes} onChange={(e) => setForm({ ...form, workloadMinutes: Number(e.target.value) })} />
          </Field>
          <Field label="Prazo para realizar (dias)" hint="Contado a partir da criação da exigência.">
            <Input type="number" min={0} value={form.deadlineDays} onChange={(e) => setForm({ ...form, deadlineDays: e.target.value })} />
          </Field>
          <Field label="Tipo de validade">
            <NativeSelect value={form.validityKind} onChange={(e) => setForm({ ...form, validityKind: e.target.value as ValidityKind })}>
              {(Object.keys(VALIDITY_KIND_LABEL) as ValidityKind[]).map((key) => (
                <option key={key} value={key}>{VALIDITY_KIND_LABEL[key]}</option>
              ))}
            </NativeSelect>
          </Field>
          {['DAYS', 'MONTHS', 'YEARS'].includes(form.validityKind) && (
            <Field label="Validade">
              <Input type="number" min={1} value={form.validityValue} onChange={(e) => setForm({ ...form, validityValue: e.target.value })} />
            </Field>
          )}
          <Field label="Avisar quantos dias antes do vencimento">
            <Input type="number" min={0} value={form.dueSoonDays} onChange={(e) => setForm({ ...form, dueSoonDays: Number(e.target.value) })} />
          </Field>
          <Field label="Documento do GED" hint="O treinamento aponta para o documento controlado; o arquivo não é copiado." className="sm:col-span-2">
            <NativeSelect value={form.documentId} onChange={(e) => setForm({ ...form, documentId: e.target.value })}>
              <option value="">Sem documento vinculado</option>
              {docs.map((doc: any) => (
                <option key={doc.id} value={doc.id}>
                  {doc.code ? `${doc.code} · ` : ''}{doc.title} (rev. {doc.version})
                </option>
              ))}
            </NativeSelect>
          </Field>

          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
            <Toggle checked={form.requiresAttendance} onChange={(v) => setForm({ ...form, requiresAttendance: v })} label="Exige presença" />
            <Toggle checked={form.requiresAssessment} onChange={(v) => setForm({ ...form, requiresAssessment: v })} label="Exige avaliação" />
            <Toggle checked={form.requiresCertificate} onChange={(v) => setForm({ ...form, requiresCertificate: v })} label="Exige certificado" />
            <Toggle checked={form.requiresEffectiveness} onChange={(v) => setForm({ ...form, requiresEffectiveness: v })} label="Exige avaliação de eficácia" />
          </div>
          {form.requiresAssessment && (
            <Field label="Nota mínima (0 a 100)">
              <Input type="number" min={0} max={100} value={form.minimumScore} onChange={(e) => setForm({ ...form, minimumScore: e.target.value })} />
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>
            {save.isPending ? 'Salvando...' : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequirementDialog({
  training,
  onClose,
  onSaved,
}: {
  training: TrainingItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [target, setTarget] = useState<'ALL_COMPANY' | 'ORG_NODE' | 'JOB' | 'EMPLOYEE'>('JOB');
  const [targetId, setTargetId] = useState('');
  const [mandatory, setMandatory] = useState(true);
  const [blocksOperation, setBlocksOperation] = useState(false);
  const [admissionDeadlineDays, setAdmissionDeadlineDays] = useState('');
  const [movementDeadlineDays, setMovementDeadlineDays] = useState('');
  const [activity, setActivity] = useState('');
  const [justification, setJustification] = useState('');

  const jobs = useQuery<OrgOption[]>({
    queryKey: ['training-jobs'],
    queryFn: () => api('/compensation/jobs'),
    enabled: Boolean(training) && target === 'JOB',
  });
  const nodes = useQuery<OrgOption[]>({
    queryKey: ['training-orgnodes'],
    queryFn: () => api('/orgnodes'),
    enabled: Boolean(training) && target === 'ORG_NODE',
  });

  const save = useMutation({
    mutationFn: () =>
      api('/training/catalog/requirements', {
        method: 'POST',
        json: {
          trainingId: training?.id,
          target,
          targetId: target === 'ALL_COMPANY' ? null : targetId,
          mandatory,
          blocksOperation,
          admissionDeadlineDays: admissionDeadlineDays || null,
          movementDeadlineDays: movementDeadlineDays || null,
          activity: activity || null,
          justification: justification || null,
        },
      }),
    onSuccess: () => {
      toast.success('Exigência criada. A matriz foi recalculada para os colaboradores alcançados.');
      onSaved();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const options = target === 'JOB' ? jobs.data ?? [] : target === 'ORG_NODE' ? nodes.data ?? [] : [];

  return (
    <Dialog open={Boolean(training)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Exigir {training?.name ? `“${training.name}”` : 'treinamento'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Aplica-se a">
            <NativeSelect
              value={target}
              onChange={(e) => {
                setTarget(e.target.value as typeof target);
                setTargetId('');
              }}
            >
              <option value="JOB">Cargo</option>
              <option value="ORG_NODE">Área / setor (alcança os subordinados)</option>
              <option value="ALL_COMPANY">Toda a empresa</option>
            </NativeSelect>
          </Field>
          {target !== 'ALL_COMPANY' && (
            <Field label={target === 'JOB' ? 'Cargo' : 'Área'}>
              <NativeSelect value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                <option value="">Selecione...</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Prazo após admissão (dias)">
              <Input type="number" min={0} value={admissionDeadlineDays} onChange={(e) => setAdmissionDeadlineDays(e.target.value)} />
            </Field>
            <Field label="Prazo após movimentação (dias)">
              <Input type="number" min={0} value={movementDeadlineDays} onChange={(e) => setMovementDeadlineDays(e.target.value)} />
            </Field>
          </div>
          <Field label="Atividade relacionada" hint="Usado na consulta de quem está autorizado a executar.">
            <Input value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Ex.: Operação de empilhadeira" />
          </Field>
          <Field label="Justificativa da exigência">
            <Textarea rows={2} value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Ex.: NR-11 item 11.1.3" />
          </Field>
          <Toggle checked={mandatory} onChange={setMandatory} label="Obrigatório" />
          <Toggle
            checked={blocksOperation}
            onChange={setBlocksOperation}
            label="Bloqueia a atividade quando pendente ou vencido"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || (target !== 'ALL_COMPANY' && !targetId)}
          >
            {save.isPending ? 'Salvando...' : 'Criar exigência'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-sm hover:bg-muted/40">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
