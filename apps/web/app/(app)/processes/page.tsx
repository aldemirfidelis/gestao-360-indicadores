'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Edit, Filter, ListChecks, Network, Plus, Trash2, X } from 'lucide-react';
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
import { cn, formatNumber } from '@/lib/utils';

type ProcessType = 'CORE' | 'SUPPORT' | 'MANAGEMENT';
type ProcessStatus = 'DRAFT' | 'ACTIVE' | 'UNDER_REVIEW' | 'ARCHIVED';

interface ProcessStep {
  id: string;
  order: number;
  name: string;
  description: string | null;
  responsible: string | null;
}

interface ProcessItem {
  id: string;
  number: number;
  code: string | null;
  name: string;
  description: string | null;
  objective: string | null;
  type: ProcessType;
  status: ProcessStatus;
  version: string | null;
  suppliers: string | null;
  inputs: string | null;
  outputs: string | null;
  customers: string | null;
  orgNodeId: string | null;
  indicatorId: string | null;
  ownerUserId: string | null;
  orgNode: { id: string; name: string; type: string } | null;
  indicator: { id: string; name: string; code: string | null; ownerNodeId: string } | null;
  owner: { id: string; name: string; email: string } | null;
  steps: ProcessStep[];
  stepsCount: number;
  areaId: string | null;
}

interface ProcessSummary {
  total: number;
  active: number;
  draft: number;
  underReview: number;
  mappedSteps: number;
  withoutSteps: number;
  byStatus: Record<ProcessStatus, number>;
  byType: Record<ProcessType, number>;
}

interface ProcessOptions {
  orgNodes: Array<{ id: string; name: string; type: string }>;
  indicators: Array<{ id: string; name: string; code: string | null; ownerNodeId: string }>;
  users: Array<{ id: string; name: string; email: string; defaultNodeId: string | null }>;
  statuses: ProcessStatus[];
  types: ProcessType[];
}

interface ProcessForm {
  name: string;
  code: string;
  description: string;
  objective: string;
  type: ProcessType;
  status: ProcessStatus;
  version: string;
  orgNodeId: string;
  indicatorId: string;
  ownerUserId: string;
  suppliers: string;
  inputs: string;
  outputs: string;
  customers: string;
}

interface StepForm {
  id: string;
  order: string;
  name: string;
  description: string;
  responsible: string;
}

const TYPE_LABEL: Record<ProcessType, string> = {
  CORE: 'Finalistico',
  SUPPORT: 'Apoio',
  MANAGEMENT: 'Gerencial',
};

const STATUS_LABEL: Record<ProcessStatus, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativo',
  UNDER_REVIEW: 'Em revisao',
  ARCHIVED: 'Arquivado',
};

const STATUS_CLASS: Record<ProcessStatus, string> = {
  DRAFT: 'border-border text-muted-foreground',
  ACTIVE: 'border-status-green/30 text-status-green',
  UNDER_REVIEW: 'border-status-yellow/40 text-status-yellow',
  ARCHIVED: 'border-border text-muted-foreground line-through',
};

const EMPTY_FORM: ProcessForm = {
  name: '',
  code: '',
  description: '',
  objective: '',
  type: 'CORE',
  status: 'DRAFT',
  version: '',
  orgNodeId: '',
  indicatorId: '',
  ownerUserId: '',
  suppliers: '',
  inputs: '',
  outputs: '',
  customers: '',
};

const EMPTY_STEP: StepForm = { id: '', order: '', name: '', description: '', responsible: '' };

export default function ProcessesPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['processes:create']);
  const canUpdate = hasPermission(['processes:update']);
  const canDelete = hasPermission(['processes:delete']);
  const [filters, setFilters] = useState({ search: '', status: '', type: '' });
  const [processOpen, setProcessOpen] = useState(false);
  const [stepOpen, setStepOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessItem | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stepProcessId, setStepProcessId] = useState<string | null>(null);
  const [form, setForm] = useState<ProcessForm>(EMPTY_FORM);
  const [stepForm, setStepForm] = useState<StepForm>(EMPTY_STEP);

  const listQuery = useQuery<ProcessItem[]>({ queryKey: ['processes', filters], queryFn: () => api<ProcessItem[]>(`/processes${toQueryString(filters)}`) });
  const summaryQuery = useQuery<ProcessSummary>({ queryKey: ['processes', 'summary'], queryFn: () => api<ProcessSummary>('/processes/summary') });
  const optionsQuery = useQuery<ProcessOptions>({ queryKey: ['processes', 'options'], queryFn: () => api<ProcessOptions>('/processes/options'), staleTime: 60_000 });

  const processes = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const summary = summaryQuery.data;
  const options = optionsQuery.data;

  useEffect(() => {
    const focus = searchParams.get('focus');
    if (!focus || !processes.length) return;
    const found = processes.find((item) => item.id === focus);
    if (found) setSelectedId(found.id);
  }, [processes, searchParams]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['processes'] });

  const saveProcess = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        code: form.code || null,
        description: form.description || null,
        objective: form.objective || null,
        type: form.type,
        status: form.status,
        version: form.version || null,
        orgNodeId: form.orgNodeId || null,
        indicatorId: form.indicatorId || null,
        ownerUserId: form.ownerUserId || null,
        suppliers: form.suppliers || null,
        inputs: form.inputs || null,
        outputs: form.outputs || null,
        customers: form.customers || null,
      };
      return editing
        ? api<ProcessItem>(`/processes/${editing.id}`, { method: 'PATCH', json: payload })
        : api<ProcessItem>('/processes', { method: 'POST', json: payload });
    },
    onSuccess: (saved) => {
      toast.success(editing ? 'Processo atualizado' : 'Processo criado');
      setProcessOpen(false);
      setEditing(null);
      setSelectedId(saved.id);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteProcess = useMutation({
    mutationFn: (id: string) => api(`/processes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Processo removido');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveStep = useMutation({
    mutationFn: () => {
      if (!stepProcessId && !stepForm.id) throw new Error('Processo nao selecionado');
      const payload = {
        order: stepForm.order ? Number(stepForm.order) : undefined,
        name: stepForm.name,
        description: stepForm.description || null,
        responsible: stepForm.responsible || null,
      };
      return stepForm.id
        ? api<ProcessStep>(`/processes/steps/${stepForm.id}`, { method: 'PATCH', json: payload })
        : api<ProcessStep>(`/processes/${stepProcessId}/steps`, { method: 'POST', json: payload });
    },
    onSuccess: () => {
      toast.success(stepForm.id ? 'Etapa atualizada' : 'Etapa criada');
      setStepOpen(false);
      setStepForm(EMPTY_STEP);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteStep = useMutation({
    mutationFn: (id: string) => api(`/processes/steps/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Etapa removida');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setProcessOpen(true);
  }

  function openEdit(item: ProcessItem) {
    setEditing(item);
    setSelectedId(item.id);
    setForm({
      name: item.name,
      code: item.code ?? '',
      description: item.description ?? '',
      objective: item.objective ?? '',
      type: item.type,
      status: item.status,
      version: item.version ?? '',
      orgNodeId: item.orgNodeId ?? '',
      indicatorId: item.indicatorId ?? '',
      ownerUserId: item.ownerUserId ?? '',
      suppliers: item.suppliers ?? '',
      inputs: item.inputs ?? '',
      outputs: item.outputs ?? '',
      customers: item.customers ?? '',
    });
    setProcessOpen(true);
  }

  function openStep(processId: string, step?: ProcessStep) {
    setStepProcessId(processId);
    setStepForm(
      step
        ? { id: step.id, order: String(step.order), name: step.name, description: step.description ?? '', responsible: step.responsible ?? '' }
        : EMPTY_STEP,
    );
    setStepOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Processos e SIPOC"
        description="Mapeie processos, entradas, saidas, clientes, fornecedores e etapas operacionais."
        actions={canCreate ? <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Novo processo</Button> : null}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard title="Processos" value={formatNumber(summary?.total)} description="Mapeamentos registrados" icon={<Network className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Ativos" value={formatNumber(summary?.active)} description="Processos vigentes" icon={<ListChecks className="h-4 w-4" />} tone="green" />
        <MetricCard title="Em revisao" value={formatNumber(summary?.underReview)} description="Ajustes pendentes" icon={<Edit className="h-4 w-4" />} tone="yellow" />
        <MetricCard title="Sem etapas" value={formatNumber(summary?.withoutSteps)} description={`${formatNumber(summary?.mappedSteps)} etapas mapeadas`} icon={<Filter className="h-4 w-4" />} tone="red" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-end">
          <div className="grid flex-1 gap-2">
            <Label>Buscar</Label>
            <Input value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Nome, codigo, objetivo ou etapa" />
          </div>
          <div className="grid gap-2 md:w-44">
            <Label>Status</Label>
            <NativeSelect value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">Todos</option>
              {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </NativeSelect>
          </div>
          <div className="grid gap-2 md:w-44">
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
        {listQuery.isLoading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando processos...</CardContent></Card> : null}
        {!listQuery.isLoading && processes.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhum processo encontrado.</CardContent></Card> : null}
        {processes.map((item) => {
          const selected = selectedId === item.id;
          return (
            <Card key={item.id} className={cn('transition-colors', selected && 'border-primary/70 bg-primary/5')}>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <button type="button" onClick={() => setSelectedId(selected ? null : item.id)} className="min-w-0 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">#{item.number} {item.code ? `${item.code} - ` : ''}{item.name}</span>
                      <Badge variant="outline" className={STATUS_CLASS[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                      <Badge variant="secondary">{TYPE_LABEL[item.type]}</Badge>
                      {item.version ? <Badge variant="outline">v{item.version}</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.objective || item.description || 'Sem objetivo descrito.'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.orgNode?.name ?? 'Processo geral'}{item.indicator ? ` • Indicador: ${item.indicator.code ? `${item.indicator.code} - ` : ''}${item.indicator.name}` : ''}{item.owner ? ` • Dono: ${item.owner.name}` : ''}
                    </p>
                  </button>
                  <div className="flex flex-wrap gap-2">
                    {canUpdate ? <Button size="sm" variant="outline" onClick={() => openStep(item.id)}><Plus className="mr-2 h-4 w-4" /> Etapa</Button> : null}
                    {canUpdate ? <Button size="sm" variant="outline" onClick={() => openEdit(item)}><Edit className="mr-2 h-4 w-4" /> Editar</Button> : null}
                    {canDelete ? <Button size="sm" variant="outline" className="text-status-red" onClick={() => deleteProcess.mutate(item.id)}><Trash2 className="mr-2 h-4 w-4" /> Excluir</Button> : null}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <SipocBlock title="Fornecedores" value={item.suppliers} />
                  <SipocBlock title="Entradas" value={item.inputs} />
                  <SipocBlock title="Saidas" value={item.outputs} />
                  <SipocBlock title="Clientes" value={item.customers} />
                </div>

                {selected ? (
                  <div className="space-y-2 rounded-lg border bg-background/60 p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Etapas do fluxo</h3>
                      <span className="text-xs text-muted-foreground">{item.stepsCount} etapa(s)</span>
                    </div>
                    {item.steps.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma etapa mapeada.</p> : null}
                    <div className="grid gap-2">
                      {item.steps.map((step) => (
                        <div key={step.id} className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <p className="font-medium">{step.order}. {step.name}</p>
                            {step.description ? <p className="text-sm text-muted-foreground">{step.description}</p> : null}
                            {step.responsible ? <p className="text-xs text-muted-foreground">Responsavel: {step.responsible}</p> : null}
                          </div>
                          {canUpdate ? (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => openStep(item.id, step)}><Edit className="h-4 w-4" /></Button>
                              <Button size="sm" variant="outline" className="text-status-red" onClick={() => deleteStep.mutate(step.id)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={processOpen} onOpenChange={setProcessOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar processo' : 'Novo processo'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-3 md:grid-cols-[1fr_160px_160px]">
              <Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Codigo"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
              <Field label="Versao"><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></Field>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Tipo">
                <NativeSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ProcessType })}>
                  {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Status">
                <NativeSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProcessStatus })}>
                  {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
              <Field label="Area / processo">
                <NativeSelect value={form.orgNodeId} onChange={(e) => setForm({ ...form, orgNodeId: e.target.value })}>
                  <option value="">Geral</option>
                  {options?.orgNodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Indicador vinculado">
                <NativeSelect value={form.indicatorId} onChange={(e) => setForm({ ...form, indicatorId: e.target.value })}>
                  <option value="">Sem indicador</option>
                  {options?.indicators.map((indicator) => <option key={indicator.id} value={indicator.id}>{indicator.code ? `${indicator.code} - ` : ''}{indicator.name}</option>)}
                </NativeSelect>
              </Field>
            </div>
            <Field label="Objetivo"><Textarea value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} rows={2} /></Field>
            <Field label="Descricao"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Fornecedores"><Textarea value={form.suppliers} onChange={(e) => setForm({ ...form, suppliers: e.target.value })} rows={4} /></Field>
              <Field label="Entradas"><Textarea value={form.inputs} onChange={(e) => setForm({ ...form, inputs: e.target.value })} rows={4} /></Field>
              <Field label="Saidas"><Textarea value={form.outputs} onChange={(e) => setForm({ ...form, outputs: e.target.value })} rows={4} /></Field>
              <Field label="Clientes"><Textarea value={form.customers} onChange={(e) => setForm({ ...form, customers: e.target.value })} rows={4} /></Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveProcess.mutate()} disabled={!form.name.trim() || saveProcess.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stepOpen} onOpenChange={setStepOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{stepForm.id ? 'Editar etapa' : 'Nova etapa'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-3 md:grid-cols-[100px_1fr]">
              <Field label="Ordem"><Input type="number" min={1} value={stepForm.order} onChange={(e) => setStepForm({ ...stepForm, order: e.target.value })} /></Field>
              <Field label="Nome"><Input value={stepForm.name} onChange={(e) => setStepForm({ ...stepForm, name: e.target.value })} /></Field>
            </div>
            <Field label="Responsavel"><Input value={stepForm.responsible} onChange={(e) => setStepForm({ ...stepForm, responsible: e.target.value })} /></Field>
            <Field label="Descricao"><Textarea value={stepForm.description} onChange={(e) => setStepForm({ ...stepForm, description: e.target.value })} rows={3} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStepOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveStep.mutate()} disabled={!stepForm.name.trim() || saveStep.isPending}>Salvar etapa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid gap-2"><Label>{label}</Label>{children}</div>;
}

function SipocBlock({ title, value }: { title: string; value: string | null }) {
  const items = splitLines(value);
  return (
    <div className="rounded-lg border bg-background/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {items.length ? (
        <ul className="mt-2 space-y-1 text-sm">
          {items.slice(0, 5).map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
          {items.length > 5 ? <li className="text-xs text-muted-foreground">+{items.length - 5} item(ns)</li> : null}
        </ul>
      ) : <p className="mt-2 text-sm text-muted-foreground">Nao informado</p>}
    </div>
  );
}

function splitLines(value: string | null) {
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
