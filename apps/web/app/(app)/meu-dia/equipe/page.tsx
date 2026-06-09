'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, GaugeCircle, RefreshCw, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

interface TeamItem {
  id: string; itemType: string; title: string; summary?: string | null;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  dueAt?: string | null; overdueDays: number; assignedUserId?: string | null;
  availableActions?: Array<{ key: string; href?: string | null }> | null;
}
interface WorkloadRow { userId: string; name: string; total: number; overdue: number; critical: number; approvals: number }
interface Bottleneck { type: string; label: string; count: number; userId?: string; userName?: string }
interface TeamSummary {
  teamSize: number; total: number; critical: number; overdue: number; dueToday: number;
  approvals: number; blocking: number; risksCritical: number; documentsToReview: number; indicatorsOffTarget: number;
}
interface TeamOverview {
  teamSize: number; scope: string; summary: TeamSummary;
  workload: WorkloadRow[]; bottlenecks: Bottleneck[];
}

const PRIORITY_CLS: Record<string, string> = {
  CRITICAL: 'bg-rose-100 text-rose-700', HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-amber-100 text-amber-700', LOW: 'bg-emerald-100 text-emerald-700', INFO: 'bg-sky-100 text-sky-700',
};
const TYPE_LABEL: Record<string, string> = {
  TASK: 'Tarefa', OVERDUE_ACTION: 'Ação atrasada', WORKFLOW_TASK: 'Tarefa de fluxo', APPROVAL: 'Aprovação',
  DOCUMENT_REVIEW: 'Documento', RISK_CRITICAL: 'Risco', MEETING: 'Reunião', NONCONFORMITY: 'NC',
  INDICATOR_OFF_TARGET: 'Indicador', ALERT: 'Alerta', MESSAGE: 'Mensagem', MENTION: 'Menção',
};

export default function MeuDiaEquipePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [member, setMember] = useState<string | null>(null);
  const [tab, setTab] = useState<string>('priorities');

  const team = useQuery<TeamOverview>({ queryKey: ['my-day', 'team'], queryFn: () => api('/my-day/team') });
  const items = useQuery<{ rows: TeamItem[]; total: number }>({
    queryKey: ['my-day', 'team', 'items', member, tab],
    queryFn: () => api(`/my-day/team/items?tab=${tab}${member ? `&member=${member}` : ''}`),
  });
  const refresh = useMutation({
    mutationFn: () => api('/my-day/refresh', { method: 'POST' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['my-day'] }); toast.success('Atualizado'); },
  });

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    (team.data?.workload ?? []).forEach((w) => m.set(w.userId, w.name));
    return m;
  }, [team.data]);

  const s = team.data?.summary;
  const cards = [
    { label: 'Total', value: s?.total ?? 0, tab: 'priorities', cls: 'text-slate-700' },
    { label: 'Críticos', value: s?.critical ?? 0, tab: 'critical', cls: 'text-rose-600' },
    { label: 'Vencidos', value: s?.overdue ?? 0, tab: 'overdue', cls: 'text-rose-600' },
    { label: 'Bloqueios', value: s?.blocking ?? 0, tab: 'blocking', cls: 'text-orange-600' },
    { label: 'Aprovações', value: s?.approvals ?? 0, tab: 'priorities', cls: 'text-indigo-600' },
    { label: 'Riscos', value: s?.risksCritical ?? 0, tab: 'priorities', cls: 'text-orange-600' },
    { label: 'Documentos', value: s?.documentsToReview ?? 0, tab: 'priorities', cls: 'text-sky-600' },
    { label: 'Indicadores', value: s?.indicatorsOffTarget ?? 0, tab: 'priorities', cls: 'text-fuchsia-600' },
  ];
  const rows = items.data?.rows ?? [];

  if (team.isPending) {
    return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/30" />)}</div>;
  }
  if ((team.data?.teamSize ?? 0) === 0) {
    return (
      <Card><CardContent className="p-10 text-center">
        <Users className="mx-auto h-8 w-8 text-muted-foreground" />
        <div className="mt-2 text-base font-semibold">Você não gerencia uma equipe</div>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Esta visão fica disponível para responsáveis por áreas/setores e administradores.</p>
        <Button className="mt-4" variant="outline" onClick={() => router.push('/meu-dia')}><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao Meu Dia</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xl font-semibold"><Users className="h-5 w-5 text-primary" />Meu Dia — Equipe</div>
          <p className="mt-1 text-sm text-muted-foreground">
            {team.data?.teamSize} pessoa(s) · {team.data?.scope === 'company' ? 'empresa toda' : 'sua área e setores'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/meu-dia')}><ArrowLeft className="mr-2 h-4 w-4" />Meu Dia</Button>
          <Button variant="outline" size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            <RefreshCw className={cn('mr-2 h-4 w-4', refresh.isPending && 'animate-spin')} />Atualizar
          </Button>
        </div>
      </div>

      {/* Cards gerenciais */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {cards.map((c) => (
          <button key={c.label} type="button" onClick={() => { setTab(c.tab); }}
            className={cn('rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/30', tab === c.tab && c.tab !== 'priorities' && 'border-primary/50')}>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className={cn('mt-1 text-2xl font-semibold', c.cls)}>{c.value}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Itens da equipe */}
        <div className="space-y-2 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Itens da equipe</div>
            {member && (
              <button type="button" className="text-xs text-primary" onClick={() => setMember(null)}>
                Filtro: {nameById.get(member) ?? member} ×
              </button>
            )}
          </div>
          {items.isPending ? (
            <div className="h-40 animate-pulse rounded-lg border bg-muted/30" />
          ) : rows.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum item nesta visão.</CardContent></Card>
          ) : (
            rows.map((it) => (
              <Card key={it.id} className={cn(it.overdueDays > 0 && 'border-l-4 border-l-rose-400')}>
                <CardContent className="flex flex-wrap items-center gap-3 p-3">
                  <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', PRIORITY_CLS[it.priority])}>{it.priority}</span>
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{TYPE_LABEL[it.itemType] ?? it.itemType}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{it.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {it.assignedUserId ? (nameById.get(it.assignedUserId) ?? '—') : '—'}
                      {it.overdueDays > 0 ? ` · atrasado ${it.overdueDays}d` : it.dueAt ? ` · vence ${formatDate(it.dueAt)}` : ''}
                    </div>
                  </div>
                  {it.availableActions?.find((a) => a.key === 'open')?.href && (
                    <Button size="sm" variant="outline" onClick={() => router.push(it.availableActions!.find((a) => a.key === 'open')!.href!)}>Abrir</Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
          {items.data && items.data.total > rows.length && (
            <div className="text-center text-xs text-muted-foreground">Mostrando {rows.length} de {items.data.total}</div>
          )}
        </div>

        {/* Gargalos + Carga */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-orange-500" />Gargalos</div>
              {(team.data?.bottlenecks ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum gargalo relevante. 👏</p>
              ) : (
                <ul className="space-y-1.5">
                  {team.data!.bottlenecks.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                      <span>{b.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><GaugeCircle className="h-4 w-4 text-sky-500" />Carga da equipe</div>
              <div className="space-y-1">
                {(team.data?.workload ?? []).slice(0, 12).map((w) => (
                  <button key={w.userId} type="button" onClick={() => setMember(member === w.userId ? null : w.userId)}
                    className={cn('flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/40', member === w.userId && 'bg-primary/10')}>
                    <span className="min-w-0 truncate">{w.name}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs">
                      {w.overdue > 0 && <Badge variant="outline" className="border-rose-300 text-rose-600">{w.overdue} venc.</Badge>}
                      {w.critical > 0 && <Badge variant="outline" className="border-orange-300 text-orange-600">{w.critical} crít.</Badge>}
                      <span className="text-muted-foreground">{w.total}</span>
                    </span>
                  </button>
                ))}
                {(team.data?.workload ?? []).length === 0 && <p className="text-xs text-muted-foreground">Sem dados de carga.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
