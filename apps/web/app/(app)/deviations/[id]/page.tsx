'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, CalendarPlus, Lock } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/select';
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
  noImmediateAction: boolean;
  openedAt: string;
  dueDate: string | null;
  closedAt: string | null;
  indicator: { id: string; name: string; code: string | null };
  responsibleUser: { id: string; name: string } | null;
  causes: { id: string; category: string | null; description: string; weight: number }[];
  analyses: { id: string; method: string; content: string; createdAt: string }[];
  actions: { id: string; title: string; status: string; responsibleUser: { id: string; name: string } | null }[];
  meetings?: { id: string; title: string; status: string }[];
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

export default function DeviationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const query = useQuery<Deviation>({
    queryKey: ['deviation', id],
    queryFn: () => api<Deviation>(`/deviations/${id}`),
  });

  const update = useMutation({
    mutationFn: (patch: any) => api(`/deviations/${id}`, { method: 'PATCH', json: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deviation', id] }),
  });

  const createMeeting = useMutation({
    mutationFn: () => {
      const dev = query.data!;
      return api<{ id: string }>(`/meetings`, {
        method: 'POST',
        json: {
          title: `Reunião do desvio #${dev.number} — ${dev.indicator.name}`,
          kind: 'DEVIATION',
          startsAt: new Date().toISOString(),
          indicatorId: dev.indicator.id,
          deviationId: dev.id,
          responsibleUserId: dev.responsibleUser?.id ?? undefined,
          objective: dev.fact ?? undefined,
        },
      });
    },
    onSuccess: (meeting) => {
      toast.success('Reunião criada — conduza a análise de causa nas ferramentas');
      qc.invalidateQueries({ queryKey: ['deviation', id] });
      router.push(`/meetings/${meeting.id}`);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível criar a reunião'),
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
            <CardTitle>Análise do desvio</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Preencha o fato, o impacto e a providência imediata. A causa raiz é preenchida automaticamente
              após a análise nas ferramentas (5 Porquês) durante a reunião.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Fato observado</Label>
              <Textarea
                defaultValue={d.fact ?? ''}
                placeholder="Descreva objetivamente o que aconteceu (números, datas, evidências)..."
                onBlur={(e) => {
                  if (e.target.value !== (d.fact ?? '')) update.mutate({ fact: e.target.value });
                }}
              />
            </div>
            <div>
              <Label>Impacto</Label>
              <Textarea
                defaultValue={d.impact ?? ''}
                placeholder="Impacto financeiro, operacional, reputacional..."
                onBlur={(e) => {
                  if (e.target.value !== (d.impact ?? '')) update.mutate({ impact: e.target.value });
                }}
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <Label>Providência imediata</Label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={d.noImmediateAction}
                    onChange={(e) =>
                      update.mutate({ noImmediateAction: e.target.checked, ...(e.target.checked ? { immediateAction: null } : {}) })
                    }
                  />
                  Não houve providência (precisa ser analisado)
                </label>
              </div>
              {d.noImmediateAction ? (
                <div className="mt-1 rounded-md border border-dashed border-status-yellow/50 bg-status-yellow/10 p-3 text-sm text-muted-foreground">
                  Sinalizado que <strong>não houve providência imediata</strong> — o desvio segue direto para análise de causa.
                </div>
              ) : (
                <Textarea
                  defaultValue={d.immediateAction ?? ''}
                  placeholder="O que a área fez de imediato para conter ou sanar momentaneamente o problema?"
                  onBlur={(e) => {
                    if (e.target.value !== (d.immediateAction ?? '')) update.mutate({ immediateAction: e.target.value });
                  }}
                />
              )}
            </div>

            <div className="rounded-md border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">Conduzir análise de causa</div>
                  <div className="text-xs text-muted-foreground">
                    {d.meetings && d.meetings.length > 0
                      ? 'Já existe reunião vinculada a este desvio.'
                      : 'A análise (Ishikawa → 5 Porquês → 5W2H → PDCA) é feita em uma reunião.'}
                  </div>
                </div>
                {d.meetings && d.meetings.length > 0 ? (
                  <Button variant="outline" asChild>
                    <Link href={`/meetings/${d.meetings[0].id}`}>Abrir reunião</Link>
                  </Button>
                ) : (
                  <Button onClick={() => createMeeting.mutate()} disabled={createMeeting.isPending}>
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    {createMeeting.isPending ? 'Criando...' : 'Criar reunião'}
                  </Button>
                )}
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                Causa raiz consolidada
                <span className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/30 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Lock className="h-3 w-3" /> automática
                </span>
              </Label>
              <div className="mt-1 min-h-[72px] whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                {d.rootCause?.trim()
                  ? <span className="text-foreground">{d.rootCause}</span>
                  : 'Preenchida automaticamente quando a causa raiz for identificada nos 5 Porquês durante a reunião.'}
              </div>
            </div>
          </CardContent>
        </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Ações vinculadas ({d.actions.length})</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Os planos de ação nascem da reunião (análise de causa → 5W2H). Aqui ficam os planos vinculados a este desvio.
          </p>
        </CardHeader>
        <CardContent>
          {d.actions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma ação vinculada ainda. Crie a reunião acima e gere a 1ª tarefa no 5W2H — o plano será criado e aparecerá aqui.
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
    </div>
  );
}
