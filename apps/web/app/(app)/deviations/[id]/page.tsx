'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatDate, periodRefLabel } from '@/lib/utils';

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

const SEVERITY_LABEL: Record<string, string> = {
  LOW: 'Leve',
  MODERATE: 'Moderado',
  CRITICAL: 'Critico',
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Aberto',
  IN_ANALYSIS: 'Em analise',
  WAITING_ACTION: 'Aguardando acao',
  IN_PROGRESS: 'Em execucao',
  CLOSED: 'Concluido',
  CLOSED_LATE: 'Concluido fora do prazo',
  CANCELLED: 'Cancelado',
};

const METHOD_LABEL: Record<string, string> = {
  FCA: 'FCA',
  FIVE_WHYS: '5 Porques',
  ISHIKAWA: 'Ishikawa (6M)',
  PARETO: 'Pareto',
  CAPA: 'CAPA',
  SIMPLE: 'Analise simples',
};

const CAUSE_CATEGORIES = ['Metodo', 'Maquina', 'Mao de obra', 'Material', 'Medida', 'Meio ambiente'];

export default function DeviationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const query = useQuery<Deviation>({
    queryKey: ['deviation', id],
    queryFn: () => api<Deviation>(`/deviations/${id}`),
  });

  const [newCause, setNewCause] = useState({ category: 'Metodo', description: '' });
  const [newAnalysis, setNewAnalysis] = useState({ method: 'FIVE_WHYS', content: '' });

  const update = useMutation({
    mutationFn: (patch: any) => api(`/deviations/${id}`, { method: 'PATCH', json: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deviation', id] }),
  });

  const addCause = useMutation({
    mutationFn: () => api(`/deviations/${id}/causes`, { method: 'POST', json: newCause }),
    onSuccess: () => {
      setNewCause({ category: 'Metodo', description: '' });
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

  const close = useMutation({
    mutationFn: () => api(`/deviations/${id}/close`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Desvio concluido');
      qc.invalidateQueries({ queryKey: ['deviation', id] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel fechar'),
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!query.data) return null;
  const d = query.data;

  const openActions = d.actions.filter((a) => a.status !== 'DONE' && a.status !== 'DONE_LATE');

  return (
    <div>
      <Link href="/deviations" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Desvios
      </Link>

      <PageHeader
        title={`#${d.number} - ${d.title}`}
        description={`Indicador: ${d.indicator.name} - Periodo ${periodRefLabel(d.periodRef)}`}
        actions={
          d.status !== 'CLOSED' &&
          d.status !== 'CLOSED_LATE' && (
            <Button onClick={() => close.mutate()} disabled={close.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {openActions.length > 0 ? `Fechar (${openActions.length} acao(oes) abertas)` : 'Fechar desvio'}
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
            <div className="text-xs uppercase text-muted-foreground">Metodo de analise</div>
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
              placeholder="Descreva objetivamente o que aconteceu (numeros, datas, evidencias)..."
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
                placeholder="Apos analise das causas, qual e a causa raiz?"
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
          <CardContent>
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
            <div className="space-y-2">
              {d.causes.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <Badge variant="outline" className="text-[10px]">{c.category ?? 'Outras'}</Badge>
                  <span className="flex-1">{c.description}</span>
                  <button
                    onClick={() => removeCause.mutate(c.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {d.causes.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">Nenhuma causa registrada.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Analises detalhadas</CardTitle>
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
              placeholder="Conteudo da analise (ex.: 5 Porques pergunta-resposta, hipoteses Ishikawa, etc.)"
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
              <p className="text-xs text-muted-foreground py-2">Nenhuma analise registrada.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Acoes vinculadas ({d.actions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {d.actions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma acao vinculada. Crie uma acao na pagina de Planos de Acao indicando este desvio como origem.
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
                    {a.responsibleUser?.name ?? 'Sem responsavel'}
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
    </div>
  );
}
