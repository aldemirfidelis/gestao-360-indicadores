'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft, Plus, CheckCircle2 } from 'lucide-react';
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
import { periodRefLabel } from '@/lib/utils';

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
  immediateAction: string | null;
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

  const [actionOpen, setActionOpen] = useState(false);
  const [actionForm, setActionForm] = useState({
    title: '',
    description: '',
    priority: 'HIGH',
    dueDate: '',
    responsibleUserId: '',
    estimatedCost: '',
    expectedResult: '',
  });

  const update = useMutation({
    mutationFn: (patch: any) => api(`/deviations/${id}`, { method: 'PATCH', json: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deviation', id] }),
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
          expectedResult: actionForm.expectedResult || undefined,
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
        expectedResult: '',
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
      // Sem descrição gigante: fato/causa raiz/impacto já ficam no desvio e a análise
      // detalhada (5 Porquês, Ishikawa, PDCA...) é feita na reunião do plano.
      description: '',
      priority: d.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      dueDate: d.dueDate ? d.dueDate.slice(0, 10) : '',
      responsibleUserId: d.responsibleUser?.id ?? '',
      estimatedCost: '',
      expectedResult: d.impact ?? '',
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
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
      </div>

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
            <div>
              <Label>Providência imediata</Label>
              <Textarea
                defaultValue={d.immediateAction ?? ''}
                placeholder="O que a área fez de imediato para conter ou sanar momentaneamente o problema?"
                onBlur={(e) => {
                  if (e.target.value !== (d.immediateAction ?? '')) {
                    update.mutate({ immediateAction: e.target.value });
                  }
                }}
              />
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
            <div className="space-y-2">
              <Label>Resultado esperado *</Label>
              <Textarea
                rows={3}
                value={actionForm.expectedResult}
                onChange={(e) => setActionForm({ ...actionForm, expectedResult: e.target.value })}
                placeholder="Impacto esperado da ação corretiva/preventiva..."
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
                <Label>Prazo *</Label>
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
              <Label>Responsável *</Label>
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
              disabled={!actionForm.title.trim() || !actionForm.responsibleUserId || !actionForm.dueDate || !actionForm.expectedResult.trim() || createAction.isPending}
            >
              {createAction.isPending ? 'Criando...' : 'Enviar para Planos de Ação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
