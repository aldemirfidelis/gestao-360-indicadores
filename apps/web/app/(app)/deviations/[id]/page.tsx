'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn, formatDate, periodRefLabel } from '@/lib/utils';

interface Deviation {
  id: string;
  number: number;
  title: string;
  periodRef: string;
  severity: string;
  status: string;
  method: string;
  fact: string | null;
  rootCause: string | null;
  impact: string | null;
  openedAt: string;
  dueDate: string | null;
  closedAt: string | null;
  indicator: { id: string; name: string; code: string | null };
  responsibleUser: { id: string; name: string } | null;
  causes: { id: string; category: string | null; description: string; weight: number }[];
  analyses: { id: string; method: string; content: string; createdAt: string }[];
  actions: { id: string; title: string; status: string; responsibleUser: { id: string; name: string } | null }[];
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  active?: boolean;
}

const SEVERITY_LABEL: Record<string, string> = {
  LOW: 'Leve',
  MODERATE: 'Moderado',
  CRITICAL: 'Crítico',
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Aberto',
  IN_ANALYSIS: 'Em análise',
  WAITING_ACTION: 'Aguardando ação',
  IN_PROGRESS: 'Em execução',
  CLOSED: 'Concluído',
  CLOSED_LATE: 'Concluído fora do prazo',
  CANCELLED: 'Cancelado',
};

const METHOD_LABEL: Record<string, string> = {
  FCA: 'FCA',
  FIVE_WHYS: '5 Porques',
  ISHIKAWA: 'Ishikawa (6M)',
  PARETO: 'Pareto',
  CAPA: 'CAPA',
  SIMPLE: 'Análise simples',
};

const CAUSE_CATEGORIES = ['Método', 'Máquina', 'Mão de obra', 'Material', 'Medida', 'Meio ambiente'];
const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export default function DeviationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const query = useQuery<Deviation>({
    queryKey: ['deviation', id],
    queryFn: () => api<Deviation>(`/deviations/${id}`),
  });

  const usersQuery = useQuery<UserOption[]>({
    queryKey: ['users', 'deviation-action-picker'],
    queryFn: () => api<UserOption[]>('/users'),
  });

  const [newCause, setNewCause] = useState({ category: 'Método', description: '' });
  const [newAnalysis, setNewAnalysis] = useState({ method: 'FIVE_WHYS', content: '' });
  const [actionOpen, setActionOpen] = useState(false);
  const [actionForm, setActionForm] = useState({
    title: '',
    description: '',
    priority: 'HIGH',
    dueDate: '',
    responsibleUserId: '',
    estimatedCost: '',
  });

  const update = useMutation({
    mutationFn: (patch: any) => api(`/deviations/${id}`, { method: 'PATCH', json: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deviation', id] }),
  });

  const addCause = useMutation({
    mutationFn: () => api(`/deviations/${id}/causes`, { method: 'POST', json: newCause }),
    onSuccess: () => {
      setNewCause({ category: 'Método', description: '' });
      qc.invalidateQueries({ queryKey: ['deviation', id] });
    },
  });

  const removeCause = useMutation({
    mutationFn: (causeId: string) => api(`/deviations/causes/${causeId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deviation', id] }),
  });

  const addAnalysis = useMutation({
    mutationFn: () => api(`/deviations/${id}/analyses`, { method: 'POST', json: newAnalysis }),
    onSuccess: () => {
      setNewAnalysis({ method: newAnalysis.method, content: '' });
      qc.invalidateQueries({ queryKey: ['deviation', id] });
    },
  });

  const createAction = useMutation({
    mutationFn: () =>
      api<{ id: string }>(`/deviations/${id}/actions`, {
        method: 'POST',
        json: {
          title: actionForm.title,
          description: actionForm.description || undefined,
          priority: actionForm.priority,
          dueDate: actionForm.dueDate || undefined,
          responsibleUserId: actionForm.responsibleUserId || undefined,
          estimatedCost: actionForm.estimatedCost ? Number(actionForm.estimatedCost) : undefined,
        },
      }),
    onSuccess: (action) => {
      toast.success('Plano de ação criado e enviado para o Kanban');
      setActionOpen(false);
      setActionForm({
        title: '',
        description: '',
        priority: 'HIGH',
        dueDate: '',
        responsibleUserId: '',
        estimatedCost: '',
      });
      qc.invalidateQueries({ queryKey: ['deviation', id] });
      qc.invalidateQueries({ queryKey: ['actions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      router.push(`/actions/${action.id}`);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível criar a ação'),
  });

  const close = useMutation({
    mutationFn: () => api(`/deviations/${id}/close`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Desvio concluído');
      qc.invalidateQueries({ queryKey: ['deviation', id] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível fechar'),
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!query.data) return null;
  const d = query.data;

  const openActions = d.actions.filter((a) => a.status !== 'DONE' && a.status !== 'DONE_LATE');
  const users = (usersQuery.data ?? []).filter((u) => u.active !== false);
  const openActionDialog = () => {
    setActionForm({
      title: d.rootCause ? `Tratar causa raiz: ${d.rootCause.slice(0, 80)}` : `Tratar desvio #${d.number} - ${d.title}`,
      description: [
        d.fact ? `Fato observado: ${d.fact}` : null,
        d.rootCause ? `Causa raiz: ${d.rootCause}` : null,
        d.impact ? `Impacto: ${d.impact}` : null,
        d.causes.length ? `Causas identificadas (Ishikawa):\n${formatCausesForAction(d.causes)}` : null,
        d.analyses.length ? `Análises registradas:\n${formatAnalysesForAction(d.analyses)}` : null,
      ].filter(Boolean).join('\n\n'),
      priority: d.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      dueDate: d.dueDate ? d.dueDate.slice(0, 10) : '',
      responsibleUserId: d.responsibleUser?.id ?? '',
      estimatedCost: '',
    });
    setActionOpen(true);
  };

  return (
    <div>
      <Link href="/deviations" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Desvios
      </Link>

      <PageHeader
        title={`#${d.number} - ${d.title}`}
        description={`Indicador: ${d.indicator.name} - Período ${periodRefLabel(d.periodRef)}`}
        actions={
          d.status !== 'CLOSED' &&
          d.status !== 'CLOSED_LATE' && (
            <Button onClick={() => close.mutate()} disabled={close.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {openActions.length > 0 ? `Fechar (${openActions.length} ação(ões) abertas)` : 'Fechar desvio'}
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="text-xs uppercase text-muted-foreground">Severidade</div>
            <NativeSelect
              value={d.severity}
              onChange={(e) => update.mutate({ severity: e.target.value })}
              className="h-9"
            >
              {Object.entries(SEVERITY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </NativeSelect>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="text-xs uppercase text-muted-foreground">Status</div>
            <NativeSelect
              value={d.status}
              onChange={(e) => update.mutate({ status: e.target.value })}
              className="h-9"
              disabled={d.status === 'CLOSED' || d.status === 'CLOSED_LATE'}
            >
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </NativeSelect>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="text-xs uppercase text-muted-foreground">Método de análise</div>
            <NativeSelect
              value={d.method}
              onChange={(e) => update.mutate({ method: e.target.value })}
              className="h-9"
            >
              {Object.entries(METHOD_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </NativeSelect>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Fato observado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              defaultValue={d.fact ?? ''}
              placeholder="Descreva objetivamente o que aconteceu (números, datas, evidências)..."
              onBlur={(e) => {
                if (e.target.value !== (d.fact ?? '')) {
                  update.mutate({ fact: e.target.value });
                }
              }}
            />
            <div>
              <Label>Causa raiz consolidada</Label>
              <Textarea
                defaultValue={d.rootCause ?? ''}
                placeholder="Após análise das causas, qual é a causa raiz?"
                onBlur={(e) => {
                  if (e.target.value !== (d.rootCause ?? '')) {
                    update.mutate({ rootCause: e.target.value });
                  }
                }}
              />
            </div>
            <div>
              <Label>Impacto</Label>
              <Textarea
                defaultValue={d.impact ?? ''}
                placeholder="Impacto financeiro, operacional, reputacional..."
                onBlur={(e) => {
                  if (e.target.value !== (d.impact ?? '')) {
                    update.mutate({ impact: e.target.value });
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Causas identificadas (Ishikawa 6M)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-[160px,1fr,auto] gap-2 mb-3">
              <NativeSelect
                value={newCause.category}
                onChange={(e) => setNewCause({ ...newCause, category: e.target.value })}
              >
                {CAUSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </NativeSelect>
              <Input
                placeholder="Causa..."
                value={newCause.description}
                onChange={(e) => setNewCause({ ...newCause, description: e.target.value })}
              />
              <Button onClick={() => addCause.mutate()} disabled={!newCause.description}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <IshikawaDiagram
              causes={d.causes}
              effectLabel={`Desvio #${d.number}`}
              onRemove={(causeId) => removeCause.mutate(causeId)}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Análises detalhadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-[180px,1fr,auto] gap-2 mb-3">
            <NativeSelect
              value={newAnalysis.method}
              onChange={(e) => setNewAnalysis({ ...newAnalysis, method: e.target.value })}
            >
              {Object.entries(METHOD_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </NativeSelect>
            <Textarea
              rows={2}
              placeholder="Conteúdo da análise (ex.: 5 Porques pergunta-resposta, hipóteses Ishikawa, etc.)"
              value={newAnalysis.content}
              onChange={(e) => setNewAnalysis({ ...newAnalysis, content: e.target.value })}
            />
            <Button onClick={() => addAnalysis.mutate()} disabled={!newAnalysis.content}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {d.analyses.map((a) => (
              <div key={a.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <Badge variant="secondary" className="text-[10px]">{METHOD_LABEL[a.method] ?? a.method}</Badge>
                  <span>{formatDate(a.createdAt)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{a.content}</p>
              </div>
            ))}
            {d.analyses.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">Nenhuma análise registrada.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Ações vinculadas ({d.actions.length})</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Transforme a análise de causa em plano de ação acompanhável no Kanban.
            </p>
          </div>
          <Button onClick={openActionDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Criar plano de ação
          </Button>
        </CardHeader>
        <CardContent>
          {d.actions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma ação vinculada. Use o botão acima para criar uma ação já conectada a este desvio.
            </p>
          )}
          <div className="space-y-2">
            {d.actions.map((a) => (
              <Link
                key={a.id}
                href={`/actions/${a.id}`}
                className="flex items-center justify-between rounded-md border p-3 hover:border-primary/40"
              >
                <div>
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.responsibleUser?.name ?? 'Sem responsável'}
                  </div>
                </div>
                <Badge variant={a.status === 'DONE' || a.status === 'DONE_LATE' ? 'default' : 'secondary'}>
                  {a.status}
                </Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Criar plano de ação para o desvio</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={actionForm.title}
                onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })}
                placeholder="Ex.: Corrigir causa raiz do indicador"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                rows={5}
                value={actionForm.description}
                onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
                placeholder="Contexto da causa, evidência e orientação da ação..."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <NativeSelect
                  value={actionForm.priority}
                  onChange={(e) => setActionForm({ ...actionForm, priority: e.target.value })}
                >
                  {Object.entries(PRIORITY_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label>Prazo</Label>
                <Input
                  type="date"
                  value={actionForm.dueDate}
                  onChange={(e) => setActionForm({ ...actionForm, dueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Custo estimado</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={actionForm.estimatedCost}
                  onChange={(e) => setActionForm({ ...actionForm, estimatedCost: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <NativeSelect
                value={actionForm.responsibleUserId}
                onChange={(e) => setActionForm({ ...actionForm, responsibleUserId: e.target.value })}
              >
                <option value="">Sem responsável definido</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createAction.mutate()}
              disabled={!actionForm.title.trim() || createAction.isPending}
            >
              {createAction.isPending ? 'Criando...' : 'Enviar para Planos de Ação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IshikawaDiagram({
  causes,
  effectLabel,
  onRemove,
}: {
  causes: Deviation['causes'];
  effectLabel: string;
  onRemove: (causeId: string) => void;
}) {
  const grouped = groupCausesByCategory(causes);
  const categories = Array.from(new Set([...CAUSE_CATEGORIES, ...Array.from(grouped.keys()).filter((category) => !CAUSE_CATEGORIES.includes(category))]));
  const top = categories.slice(0, Math.ceil(categories.length / 2));
  const bottom = categories.slice(Math.ceil(categories.length / 2));

  return (
    <div className="overflow-x-auto rounded-xl border bg-muted/20 p-4">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-3 gap-4 pb-8">
          {top.map((category, index) => (
            <FishboneBranch
              key={category}
              category={category}
              causes={grouped.get(category) ?? []}
              side="top"
              slant={index % 2 === 0 ? 'left' : 'right'}
              onRemove={onRemove}
            />
          ))}
        </div>

        <div className="relative flex items-center gap-3 py-2">
          <div className="h-px flex-1 bg-border" />
          <div className="relative z-10 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-sm">
            Efeito: {effectLabel}
          </div>
          <div className="h-px w-10 bg-border" />
          <div className="h-0 w-0 border-y-[10px] border-l-[18px] border-y-transparent border-l-border" />
        </div>

        <div className="grid grid-cols-3 gap-4 pt-8">
          {bottom.map((category, index) => (
            <FishboneBranch
              key={category}
              category={category}
              causes={grouped.get(category) ?? []}
              side="bottom"
              slant={index % 2 === 0 ? 'right' : 'left'}
              onRemove={onRemove}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FishboneBranch({
  category,
  causes,
  side,
  slant,
  onRemove,
}: {
  category: string;
  causes: Deviation['causes'];
  side: 'top' | 'bottom';
  slant: 'left' | 'right';
  onRemove: (causeId: string) => void;
}) {
  const connectorRotation = side === 'top'
    ? slant === 'left' ? '-rotate-[28deg]' : 'rotate-[28deg]'
    : slant === 'left' ? 'rotate-[28deg]' : '-rotate-[28deg]';

  return (
    <div className="relative rounded-lg border bg-card p-3 shadow-sm">
      <span
        className={cn(
          'absolute left-1/2 hidden h-10 w-px origin-center bg-border lg:block',
          side === 'top' ? '-bottom-10' : '-top-10',
          connectorRotation,
        )}
      />
      <div className="mb-2 flex items-center justify-between gap-2">
        <Badge variant="outline" className="text-[10px]">{category}</Badge>
        <span className="text-[10px] font-medium text-muted-foreground">{causes.length}</span>
      </div>
      <div className="space-y-2">
        {causes.length === 0 ? (
          <p className="rounded-md border border-dashed px-2 py-2 text-xs text-muted-foreground">Sem causa registrada.</p>
        ) : (
          causes.map((cause) => (
            <div key={cause.id} className="flex items-start gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs">
              <span className="min-w-0 flex-1 leading-relaxed text-foreground">{cause.description}</span>
              <button
                type="button"
                onClick={() => onRemove(cause.id)}
                className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                aria-label={`Remover causa ${cause.description}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function groupCausesByCategory(causes: Deviation['causes']) {
  const grouped = new Map<string, Deviation['causes']>();
  for (const cause of causes) {
    const category = normalizeCauseCategory(cause.category);
    grouped.set(category, [...(grouped.get(category) ?? []), cause]);
  }
  return grouped;
}

function normalizeCauseCategory(category: string | null | undefined) {
  const clean = category?.trim();
  if (!clean) return 'Outras';
  const key = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const match = CAUSE_CATEGORIES.find((item) => item.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === key);
  if (match) return match;
  if (key === 'medicao') return 'Medida';
  if (key === 'mao-de-obra' || key === 'mao de obra') return 'Mão de obra';
  return clean;
}

function formatCausesForAction(causes: Deviation['causes']) {
  return causes
    .map((cause) => `- ${normalizeCauseCategory(cause.category)}: ${cause.description}`)
    .join('\n');
}

function formatAnalysesForAction(analyses: Deviation['analyses']) {
  return analyses
    .map((analysis) => `- ${METHOD_LABEL[analysis.method] ?? analysis.method}: ${analysis.content}`)
    .join('\n\n');
}
