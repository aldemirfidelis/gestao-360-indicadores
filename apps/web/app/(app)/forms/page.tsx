'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardCheck, Edit, FileSpreadsheet, Filter, Plus, Send, Trash2, X } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';

type TemplateType = 'FORM' | 'CHECKLIST' | 'INSPECTION' | 'AUDIT_CHECKLIST' | 'PROCESS_CHECKLIST' | 'SURVEY' | 'OTHER';
type TemplateStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
type FieldType = 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT' | 'MULTISELECT';
type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'REVIEWED';

interface FormField {
  id: string;
  order: number;
  label: string;
  type: FieldType;
  required: boolean;
  options: string | null;
  helpText: string | null;
}

interface FormTemplate {
  id: string;
  number: number;
  code: string | null;
  title: string;
  description: string | null;
  type: TemplateType;
  status: TemplateStatus;
  version: string | null;
  orgNodeId: string | null;
  processId: string | null;
  indicatorId: string | null;
  ownerUserId: string | null;
  orgNode: { id: string; name: string; type: string } | null;
  process: { id: string; number: number; code: string | null; name: string; orgNodeId: string | null } | null;
  indicator: { id: string; name: string; code: string | null; ownerNodeId: string } | null;
  owner: { id: string; name: string; email: string } | null;
  fields: FormField[];
  fieldsCount: number;
  submissionsCount: number;
  areaId: string | null;
}

interface FormSubmission {
  id: string;
  title: string | null;
  status: SubmissionStatus;
  notes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  submittedBy: { id: string; name: string; email: string } | null;
  answers: Array<{ id: string; fieldId: string | null; fieldLabel: string; value: string | null }>;
  answersCount: number;
}

interface FormsSummary {
  total: number;
  active: number;
  draft: number;
  archived: number;
  fields: number;
  submissions: number;
  withoutFields: number;
}

interface FormsOptions {
  orgNodes: Array<{ id: string; name: string; type: string }>;
  indicators: Array<{ id: string; name: string; code: string | null; ownerNodeId: string }>;
  processes: Array<{ id: string; number: number; code: string | null; name: string; orgNodeId: string | null; indicatorId: string | null }>;
  users: Array<{ id: string; name: string; email: string; defaultNodeId: string | null }>;
  types: TemplateType[];
  statuses: TemplateStatus[];
  fieldTypes: FieldType[];
  submissionStatuses: SubmissionStatus[];
}

interface FieldForm {
  order: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string;
  helpText: string;
}

interface TemplateForm {
  title: string;
  code: string;
  description: string;
  type: TemplateType;
  status: TemplateStatus;
  version: string;
  orgNodeId: string;
  processId: string;
  indicatorId: string;
  ownerUserId: string;
  fields: FieldForm[];
}

const TYPE_LABEL: Record<TemplateType, string> = {
  FORM: 'Formulario',
  CHECKLIST: 'Checklist',
  INSPECTION: 'Inspecao',
  AUDIT_CHECKLIST: 'Checklist de auditoria',
  PROCESS_CHECKLIST: 'Checklist de processo',
  SURVEY: 'Pesquisa',
  OTHER: 'Outro',
};

const STATUS_LABEL: Record<TemplateStatus, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativo',
  ARCHIVED: 'Arquivado',
};

const FIELD_LABEL: Record<FieldType, string> = {
  TEXT: 'Texto curto',
  TEXTAREA: 'Texto longo',
  NUMBER: 'Numero',
  DATE: 'Data',
  BOOLEAN: 'Sim/Nao',
  SELECT: 'Selecao',
  MULTISELECT: 'Multipla selecao',
};

const SUBMISSION_LABEL: Record<SubmissionStatus, string> = {
  DRAFT: 'Rascunho',
  SUBMITTED: 'Enviado',
  REVIEWED: 'Revisado',
};

const STATUS_CLASS: Record<TemplateStatus, string> = {
  DRAFT: 'border-border text-muted-foreground',
  ACTIVE: 'border-status-green/30 text-status-green',
  ARCHIVED: 'border-border text-muted-foreground line-through',
};

const EMPTY_TEMPLATE: TemplateForm = {
  title: '',
  code: '',
  description: '',
  type: 'CHECKLIST',
  status: 'DRAFT',
  version: '',
  orgNodeId: '',
  processId: '',
  indicatorId: '',
  ownerUserId: '',
  fields: [{ order: '1', label: '', type: 'TEXT', required: false, options: '', helpText: '' }],
};

export default function FormsPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['forms:create']);
  const canUpdate = hasPermission(['forms:update']);
  const canDelete = hasPermission(['forms:delete']);
  const [filters, setFilters] = useState({ search: '', status: '', type: '' });
  const [templateOpen, setTemplateOpen] = useState(false);
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [editing, setEditing] = useState<FormTemplate | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(EMPTY_TEMPLATE);
  const [submissionTitle, setSubmissionTitle] = useState('');
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const listQuery = useQuery<FormTemplate[]>({ queryKey: ['forms', filters], queryFn: () => api<FormTemplate[]>(`/forms${toQueryString(filters)}`) });
  const summaryQuery = useQuery<FormsSummary>({ queryKey: ['forms', 'summary'], queryFn: () => api<FormsSummary>('/forms/summary') });
  const optionsQuery = useQuery<FormsOptions>({ queryKey: ['forms', 'options'], queryFn: () => api<FormsOptions>('/forms/options'), staleTime: 60_000 });

  const templates = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const summary = summaryQuery.data;
  const options = optionsQuery.data;
  const selected = useMemo(() => templates.find((item) => item.id === selectedId) ?? null, [templates, selectedId]);
  const submissionsQuery = useQuery<FormSubmission[]>({
    queryKey: ['forms', selectedId, 'submissions'],
    queryFn: () => api<FormSubmission[]>(`/forms/${selectedId}/submissions`),
    enabled: Boolean(selectedId),
  });

  useEffect(() => {
    const focus = searchParams.get('focus');
    if (!focus || !templates.length) return;
    const found = templates.find((item) => item.id === focus);
    if (found) setSelectedId(found.id);
  }, [templates, searchParams]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['forms'] });

  const saveTemplate = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        code: form.code || null,
        description: form.description || null,
        type: form.type,
        status: form.status,
        version: form.version || null,
        orgNodeId: form.orgNodeId || null,
        processId: form.processId || null,
        indicatorId: form.indicatorId || null,
        ownerUserId: form.ownerUserId || null,
        fields: form.fields.filter((field) => field.label.trim()).map((field, index) => ({
          order: field.order ? Number(field.order) : index + 1,
          label: field.label,
          type: field.type,
          required: field.required,
          options: field.options || null,
          helpText: field.helpText || null,
        })),
      };
      return editing
        ? api<FormTemplate>(`/forms/${editing.id}`, { method: 'PATCH', json: payload })
        : api<FormTemplate>('/forms', { method: 'POST', json: payload });
    },
    onSuccess: (saved) => {
      toast.success(editing ? 'Formulario atualizado' : 'Formulario criado');
      setTemplateOpen(false);
      setEditing(null);
      setSelectedId(saved.id);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => api(`/forms/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Formulario removido');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const submitForm = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Formulario nao selecionado');
      return api<FormSubmission>(`/forms/${selected.id}/submissions`, {
        method: 'POST',
        json: {
          title: submissionTitle || null,
          notes: submissionNotes || null,
          status: 'SUBMITTED',
          answers: selected.fields.map((field) => ({ fieldId: field.id, value: answers[field.id] ?? '' })),
        },
      });
    },
    onSuccess: () => {
      toast.success('Preenchimento registrado');
      setSubmissionOpen(false);
      setSubmissionTitle('');
      setSubmissionNotes('');
      setAnswers({});
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_TEMPLATE);
    setTemplateOpen(true);
  }

  function openEdit(item: FormTemplate) {
    setEditing(item);
    setSelectedId(item.id);
    setForm({
      title: item.title,
      code: item.code ?? '',
      description: item.description ?? '',
      type: item.type,
      status: item.status,
      version: item.version ?? '',
      orgNodeId: item.orgNodeId ?? '',
      processId: item.processId ?? '',
      indicatorId: item.indicatorId ?? '',
      ownerUserId: item.ownerUserId ?? '',
      fields: item.fields.length
        ? item.fields.map((field) => ({
            order: String(field.order),
            label: field.label,
            type: field.type,
            required: field.required,
            options: field.options ?? '',
            helpText: field.helpText ?? '',
          }))
        : EMPTY_TEMPLATE.fields,
    });
    setTemplateOpen(true);
  }

  function openSubmission(item: FormTemplate) {
    setSelectedId(item.id);
    setSubmissionTitle('');
    setSubmissionNotes('');
    setAnswers(Object.fromEntries(item.fields.map((field) => [field.id, ''])));
    setSubmissionOpen(true);
  }

  function updateField(index: number, patch: Partial<FieldForm>) {
    setForm((current) => ({ ...current, fields: current.fields.map((field, i) => (i === index ? { ...field, ...patch } : field)) }));
  }

  function addField() {
    setForm((current) => ({ ...current, fields: [...current.fields, { order: String(current.fields.length + 1), label: '', type: 'TEXT', required: false, options: '', helpText: '' }] }));
  }

  function removeField(index: number) {
    setForm((current) => ({ ...current, fields: current.fields.filter((_, i) => i !== index).map((field, i) => ({ ...field, order: String(i + 1) })) }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Formularios e Checklists"
        description="Crie templates de formulario, checklists e registros operacionais com preenchimento rastreavel."
        actions={canCreate ? <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Novo formulario</Button> : null}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard title="Templates" value={formatNumber(summary?.total)} description="Formularios cadastrados" icon={<FileSpreadsheet className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Ativos" value={formatNumber(summary?.active)} description="Disponiveis para preenchimento" icon={<ClipboardCheck className="h-4 w-4" />} tone="green" />
        <MetricCard title="Campos" value={formatNumber(summary?.fields)} description="Campos mapeados" icon={<Edit className="h-4 w-4" />} tone="purple" />
        <MetricCard title="Preenchimentos" value={formatNumber(summary?.submissions)} description={`${formatNumber(summary?.withoutFields)} sem campos`} icon={<Send className="h-4 w-4" />} tone="yellow" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-end">
          <Field label="Buscar"><Input value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Titulo, codigo, descricao ou campo" /></Field>
          <div className="grid gap-2 md:w-44">
            <Label>Status</Label>
            <NativeSelect value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">Todos</option>
              {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </NativeSelect>
          </div>
          <div className="grid gap-2 md:w-56">
            <Label>Tipo</Label>
            <NativeSelect value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
              <option value="">Todos</option>
              {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </NativeSelect>
          </div>
          <Button variant="outline" onClick={() => setFilters({ search: '', status: '', type: '' })}><X className="mr-2 h-4 w-4" /> Limpar</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {listQuery.isLoading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando formularios...</CardContent></Card> : null}
        {!listQuery.isLoading && templates.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhum formulario encontrado.</CardContent></Card> : null}
        {templates.map((item) => {
          const selectedCard = selectedId === item.id;
          return (
            <Card key={item.id} className={cn('transition-colors', selectedCard && 'border-primary/70 bg-primary/5')}>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <button type="button" className="min-w-0 text-left" onClick={() => setSelectedId(selectedCard ? null : item.id)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">#{item.number} {item.code ? `${item.code} - ` : ''}{item.title}</span>
                      <Badge variant="outline" className={STATUS_CLASS[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                      <Badge variant="secondary">{TYPE_LABEL[item.type]}</Badge>
                      {item.version ? <Badge variant="outline">v{item.version}</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description || 'Sem descricao.'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.orgNode?.name ?? item.process?.name ?? 'Formulario geral'}{item.indicator ? ` • Indicador: ${item.indicator.code ? `${item.indicator.code} - ` : ''}${item.indicator.name}` : ''}{item.owner ? ` • Dono: ${item.owner.name}` : ''}
                    </p>
                  </button>
                  <div className="flex flex-wrap gap-2">
                    {canUpdate ? <Button size="sm" variant="outline" onClick={() => openSubmission(item)} disabled={item.status !== 'ACTIVE' || item.fields.length === 0}><Send className="mr-2 h-4 w-4" /> Preencher</Button> : null}
                    {canUpdate ? <Button size="sm" variant="outline" onClick={() => openEdit(item)}><Edit className="mr-2 h-4 w-4" /> Editar</Button> : null}
                    {canDelete ? <Button size="sm" variant="outline" className="text-status-red" onClick={() => deleteTemplate.mutate(item.id)}><Trash2 className="mr-2 h-4 w-4" /> Excluir</Button> : null}
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-3">
                  <MiniStat label="Campos" value={item.fieldsCount} />
                  <MiniStat label="Preenchimentos" value={item.submissionsCount} />
                  <MiniStat label="Obrigatorios" value={item.fields.filter((field) => field.required).length} />
                </div>

                {selectedCard ? (
                  <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
                    <div className="space-y-2 rounded-lg border bg-background/60 p-3">
                      <h3 className="text-sm font-semibold">Campos</h3>
                      {item.fields.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum campo configurado.</p> : null}
                      {item.fields.map((field) => (
                        <div key={field.id} className="rounded-md border p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{field.order}. {field.label}</span>
                            <Badge variant="secondary">{FIELD_LABEL[field.type]}</Badge>
                            {field.required ? <Badge variant="outline" className="border-status-red/40 text-status-red">Obrigatorio</Badge> : null}
                          </div>
                          {field.helpText ? <p className="mt-1 text-sm text-muted-foreground">{field.helpText}</p> : null}
                          {field.options ? <p className="mt-1 text-xs text-muted-foreground">Opcoes: {field.options}</p> : null}
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2 rounded-lg border bg-background/60 p-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Preenchimentos recentes</h3>
                        <span className="text-xs text-muted-foreground">{submissionsQuery.data?.length ?? 0}</span>
                      </div>
                      {submissionsQuery.isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
                      {(submissionsQuery.data ?? []).slice(0, 5).map((submission) => (
                        <div key={submission.id} className="rounded-md border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{submission.title || 'Preenchimento'}</span>
                            <Badge variant="outline">{SUBMISSION_LABEL[submission.status]}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {submission.submittedBy?.name ?? 'Usuario'} • {formatDate(submission.submittedAt ?? submission.reviewedAt)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{submission.answersCount} resposta(s)</p>
                        </div>
                      ))}
                      {!submissionsQuery.isLoading && (submissionsQuery.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum preenchimento ainda.</p> : null}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar formulario' : 'Novo formulario'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-3 md:grid-cols-[1fr_160px_160px]">
              <Field label="Titulo"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
              <Field label="Codigo"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
              <Field label="Versao"><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></Field>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Tipo">
                <NativeSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as TemplateType })}>
                  {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Status">
                <NativeSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TemplateStatus })}>
                  {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Area">
                <NativeSelect value={form.orgNodeId} onChange={(e) => setForm({ ...form, orgNodeId: e.target.value })}>
                  <option value="">Geral</option>
                  {options?.orgNodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Dono">
                <NativeSelect value={form.ownerUserId} onChange={(e) => setForm({ ...form, ownerUserId: e.target.value })}>
                  <option value="">Sem dono</option>
                  {options?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </NativeSelect>
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Processo vinculado">
                <NativeSelect value={form.processId} onChange={(e) => setForm({ ...form, processId: e.target.value })}>
                  <option value="">Sem processo</option>
                  {options?.processes.map((process) => <option key={process.id} value={process.id}>#{process.number} {process.code ? `${process.code} - ` : ''}{process.name}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Indicador vinculado">
                <NativeSelect value={form.indicatorId} onChange={(e) => setForm({ ...form, indicatorId: e.target.value })}>
                  <option value="">Sem indicador</option>
                  {options?.indicators.map((indicator) => <option key={indicator.id} value={indicator.id}>{indicator.code ? `${indicator.code} - ` : ''}{indicator.name}</option>)}
                </NativeSelect>
              </Field>
            </div>
            <Field label="Descricao"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></Field>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Campos do formulario</h3>
                <Button type="button" variant="outline" size="sm" onClick={addField}><Plus className="mr-2 h-4 w-4" /> Campo</Button>
              </div>
              {form.fields.map((field, index) => (
                <div key={`${index}-${field.order}`} className="grid gap-3 rounded-md border p-3 md:grid-cols-[80px_1fr_180px_110px_40px]">
                  <Field label="Ordem"><Input type="number" min={1} value={field.order} onChange={(e) => updateField(index, { order: e.target.value })} /></Field>
                  <Field label="Rotulo"><Input value={field.label} onChange={(e) => updateField(index, { label: e.target.value })} /></Field>
                  <Field label="Tipo">
                    <NativeSelect value={field.type} onChange={(e) => updateField(index, { type: e.target.value as FieldType })}>
                      {Object.entries(FIELD_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </NativeSelect>
                  </Field>
                  <label className="mt-7 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={field.required} onChange={(e) => updateField(index, { required: e.target.checked })} />
                    Obrig.
                  </label>
                  <Button type="button" variant="outline" size="sm" className="mt-6 text-status-red" onClick={() => removeField(index)} disabled={form.fields.length === 1}><Trash2 className="h-4 w-4" /></Button>
                  <div className="md:col-span-2"><Field label="Opcoes (uma por linha ou separadas por ;)"><Textarea value={field.options} onChange={(e) => updateField(index, { options: e.target.value })} rows={2} /></Field></div>
                  <div className="md:col-span-3"><Field label="Ajuda"><Input value={field.helpText} onChange={(e) => updateField(index, { helpText: e.target.value })} /></Field></div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveTemplate.mutate()} disabled={!form.title.trim() || saveTemplate.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={submissionOpen} onOpenChange={setSubmissionOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Preencher {selected?.title}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label="Titulo do preenchimento"><Input value={submissionTitle} onChange={(e) => setSubmissionTitle(e.target.value)} placeholder="Ex.: Ronda 04/06" /></Field>
            {selected?.fields.map((field) => (
              <Field key={field.id} label={`${field.order}. ${field.label}${field.required ? ' *' : ''}`}>
                <AnswerInput field={field} value={answers[field.id] ?? ''} onChange={(value) => setAnswers((current) => ({ ...current, [field.id]: value }))} />
              </Field>
            ))}
            <Field label="Observacoes"><Textarea value={submissionNotes} onChange={(e) => setSubmissionNotes(e.target.value)} rows={3} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmissionOpen(false)}>Cancelar</Button>
            <Button onClick={() => submitForm.mutate()} disabled={submitForm.isPending}>Registrar preenchimento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid gap-2"><Label>{label}</Label>{children}</div>;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background/60 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{formatNumber(value)}</p>
    </div>
  );
}

function AnswerInput({ field, value, onChange }: { field: FormField; value: string; onChange: (value: string) => void }) {
  const options = splitOptions(field.options);
  if (field.type === 'TEXTAREA') return <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={field.helpText ?? undefined} />;
  if (field.type === 'NUMBER') return <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.helpText ?? undefined} />;
  if (field.type === 'DATE') return <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />;
  if (field.type === 'BOOLEAN') {
    return (
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Selecione</option>
        <option value="Sim">Sim</option>
        <option value="Nao">Nao</option>
      </NativeSelect>
    );
  }
  if (field.type === 'SELECT' && options.length) {
    return (
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Selecione</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </NativeSelect>
    );
  }
  return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.type === 'MULTISELECT' ? 'Separe valores por virgula' : field.helpText ?? undefined} />;
}

function splitOptions(value: string | null) {
  return (value ?? '').split(/\r?\n|;/).map((item) => item.trim()).filter(Boolean);
}

function toQueryString(filters: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
