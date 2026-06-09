'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle, AtSign, CalendarDays, CheckCircle2, CheckSquare, FileText, FileWarning,
  Inbox, MessageSquare, RefreshCw, Search, ShieldAlert, Target, Stamp, Workflow,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/components/auth/auth-provider';
import { useVision360 } from '@/components/ui/vision360-context';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

interface WorkItem {
  id: string;
  itemType: string;
  title: string;
  summary?: string | null;
  status: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  priorityReason?: string | null;
  criticality?: string | null;
  dueAt?: string | null;
  overdueDays: number;
  slaStatus?: string | null;
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: string;
  workflowInstanceId?: string | null;
  requiresDecision: boolean;
  recommendedAction?: string | null;
  availableActions?: Array<{ key: string; label: string; kind?: string; inline?: boolean; requiresJustification?: boolean; href?: string | null }> | null;
}
interface Summary {
  pending: number; overdue: number; dueToday: number; approvals: number;
  indicatorsOffTarget: number; risksCritical: number; documentsToReview: number;
  trainingsPending: number; meetingsToday: number; unreadMessages: number;
}

const TYPE_META: Record<string, { label: string; icon: typeof Inbox }> = {
  TASK: { label: 'Tarefa', icon: CheckSquare },
  OVERDUE_ACTION: { label: 'Ação atrasada', icon: AlertTriangle },
  WORKFLOW_TASK: { label: 'Tarefa de fluxo', icon: Workflow },
  APPROVAL: { label: 'Aprovação', icon: Stamp },
  DOCUMENT_REVIEW: { label: 'Documento', icon: FileText },
  RISK_CRITICAL: { label: 'Risco', icon: ShieldAlert },
  MEETING: { label: 'Reunião', icon: CalendarDays },
  NONCONFORMITY: { label: 'Não conformidade', icon: FileWarning },
  INDICATOR_OFF_TARGET: { label: 'Indicador', icon: Target },
  ALERT: { label: 'Alerta', icon: AlertTriangle },
  MESSAGE: { label: 'Mensagem', icon: MessageSquare },
  MENTION: { label: 'Menção', icon: AtSign },
};
const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  CRITICAL: { label: 'Crítica', cls: 'bg-rose-100 text-rose-700' },
  HIGH: { label: 'Alta', cls: 'bg-orange-100 text-orange-700' },
  MEDIUM: { label: 'Média', cls: 'bg-amber-100 text-amber-700' },
  LOW: { label: 'Baixa', cls: 'bg-emerald-100 text-emerald-700' },
  INFO: { label: 'Info', cls: 'bg-sky-100 text-sky-700' },
};
const VISION360_TYPE: Record<string, string> = {
  ACTION_PLAN: 'ACTION_PLAN', DOCUMENT: 'DOCUMENT', RISK_REGISTER: 'RISK',
  NON_CONFORMITY: 'NON_CONFORMITY', MEETING: 'MEETING', INDICATOR: 'INDICATOR',
};
const TABS = [
  { key: 'priorities', label: 'Prioridades' },
  { key: 'today', label: 'Hoje' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'approvals', label: 'Aprovações' },
  { key: 'overdue', label: 'Atrasados' },
  { key: 'upcoming', label: 'Próximos prazos' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function MeuDiaPage() {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const vision = useVision360();

  const [tab, setTab] = useState('priorities');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [actOn, setActOn] = useState<WorkItem | null>(null);

  const summary = useQuery<Summary>({ queryKey: ['my-day', 'summary'], queryFn: () => api('/my-day/summary') });
  const itemsQuery = useQuery<{ rows: WorkItem[]; total: number }>({
    queryKey: ['my-day', 'items', tab, typeFilter, q],
    queryFn: () => api(`/my-day/items?tab=${tab}${typeFilter ? `&itemType=${typeFilter}` : ''}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`),
  });

  const refresh = useMutation({
    mutationFn: () => api('/my-day/refresh', { method: 'POST' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['my-day'] }); toast.success('Atualizado'); },
  });

  function invalidate() { void qc.invalidateQueries({ queryKey: ['my-day'] }); }
  function openItem(it: WorkItem) {
    const href = it.availableActions?.find((a) => a.key === 'open')?.href;
    if (href) router.push(href);
  }
  function openVision(it: WorkItem) {
    const t = VISION360_TYPE[it.sourceEntityType];
    if (t) vision.open(t, it.sourceEntityId);
    else toast.info('Visão 360° indisponível para este tipo de item');
  }
  function pickCard(type: 'pending' | 'overdue' | 'today' | 'approvals' | 'indicators' | 'risksCritical' | 'documentsToReview' | 'meetingsToday') {
    setTypeFilter(null);
    if (type === 'pending') setTab('pending');
    else if (type === 'overdue') setTab('overdue');
    else if (type === 'today') setTab('today');
    else if (type === 'approvals') { setTab('priorities'); setTypeFilter('APPROVAL'); }
    else if (type === 'indicators') { setTab('priorities'); setTypeFilter('INDICATOR_OFF_TARGET'); }
    else if (type === 'risksCritical') { setTab('priorities'); setTypeFilter('RISK_CRITICAL'); }
    else if (type === 'documentsToReview') { setTab('priorities'); setTypeFilter('DOCUMENT_REVIEW'); }
    else if (type === 'meetingsToday') { setTab('priorities'); setTypeFilter('MEETING'); }
  }

  const s = summary.data;
  const cards = useMemo(() => ([
    { key: 'pending', label: 'Pendentes', value: s?.pending ?? 0, cls: 'text-slate-700' },
    { key: 'overdue', label: 'Vencidos', value: s?.overdue ?? 0, cls: 'text-rose-600' },
    { key: 'today', label: 'Vencendo hoje', value: s?.dueToday ?? 0, cls: 'text-amber-600' },
    { key: 'approvals', label: 'Aprovações', value: s?.approvals ?? 0, cls: 'text-indigo-600' },
    { key: 'indicators', label: 'Indicadores', value: s?.indicatorsOffTarget ?? 0, cls: 'text-fuchsia-600' },
    { key: 'risksCritical', label: 'Riscos críticos', value: s?.risksCritical ?? 0, cls: 'text-orange-600' },
    { key: 'documentsToReview', label: 'Documentos', value: s?.documentsToReview ?? 0, cls: 'text-sky-600' },
    { key: 'meetingsToday', label: 'Reuniões hoje', value: s?.meetingsToday ?? 0, cls: 'text-emerald-600' },
  ] as const), [s]);

  const rows = itemsQuery.data?.rows ?? [];

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xl font-semibold">
            <Inbox className="h-5 w-5 text-primary" />
            {greeting()}, {user?.name?.split(' ')[0] ?? 'bem-vindo'}.
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {(s?.pending ?? 0) > 0
              ? `Você possui ${s?.pending} item(ns) para tratar — ${s?.overdue ?? 0} vencido(s).`
              : 'Tudo em dia! Nenhuma pendência atribuída a você.'}
            {' · '}{formatDate(new Date().toISOString())}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="h-9 w-56 pl-8" placeholder="Buscar nos meus itens..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            <RefreshCw className={cn('mr-2 h-4 w-4', refresh.isPending && 'animate-spin')} />Atualizar
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-8">
        {cards.map((c) => (
          <button key={c.key} type="button" onClick={() => pickCard(c.key as any)}
            className="rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/30">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className={cn('mt-1 text-2xl font-semibold', c.cls)}>{c.value}</div>
          </button>
        ))}
      </div>

      {/* Abas */}
      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button key={t.key} type="button"
            onClick={() => { setTab(t.key); setTypeFilter(null); }}
            className={cn('px-3 py-2 text-sm font-medium transition-colors',
              tab === t.key && !typeFilter ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground')}>
            {t.label}
          </button>
        ))}
        {typeFilter && (
          <span className="ml-2 inline-flex items-center gap-1 self-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            Filtro: {TYPE_META[typeFilter]?.label ?? typeFilter}
            <button type="button" className="ml-1 font-bold" onClick={() => setTypeFilter(null)}>×</button>
          </span>
        )}
      </div>

      {/* Lista de itens */}
      <div className="space-y-2">
        {itemsQuery.isPending ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg border bg-muted/30" />)}</div>
        ) : rows.length === 0 ? (
          <Card><CardContent className="p-10 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
            <div className="mt-2 text-base font-semibold">Nada por aqui</div>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Nenhum item para esta visão. Aproveite para adiantar outras frentes.</p>
          </CardContent></Card>
        ) : (
          rows.map((it) => {
            const meta = TYPE_META[it.itemType] ?? { label: it.itemType, icon: Inbox };
            const Icon = meta.icon;
            const prio = PRIORITY_META[it.priority] ?? PRIORITY_META.MEDIUM;
            return (
              <Card key={it.id} className={cn(it.overdueDays > 0 && 'border-l-4 border-l-rose-400')}>
                <CardContent className="flex flex-wrap items-start gap-3 p-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', prio.cls)}>{prio.label}</span>
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{meta.label}</span>
                      {it.overdueDays > 0 && <Badge variant="outline" className="border-rose-300 text-rose-600">Atrasado {it.overdueDays}d</Badge>}
                      {it.dueAt && it.overdueDays === 0 && <span className="text-xs text-muted-foreground">vence {formatDate(it.dueAt)}</span>}
                    </div>
                    <div className="mt-1 truncate font-medium">{it.title}</div>
                    {it.summary && <div className="truncate text-xs text-muted-foreground">{it.summary}</div>}
                    {it.recommendedAction && (
                      <div className="mt-1 text-xs text-primary">→ {it.recommendedAction}</div>
                    )}
                    {it.priorityReason && <div className="mt-0.5 text-[11px] text-muted-foreground">{it.priorityReason}</div>}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <Button size="sm" onClick={() => setActOn(it)}>Agir agora</Button>
                    {VISION360_TYPE[it.sourceEntityType] && (
                      <Button size="sm" variant="outline" onClick={() => openVision(it)}>Visão 360°</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
        {itemsQuery.data && itemsQuery.data.total > rows.length && (
          <div className="pt-1 text-center text-xs text-muted-foreground">Mostrando {rows.length} de {itemsQuery.data.total} itens</div>
        )}
      </div>

      {actOn && (
        <ActNowDialog item={actOn} onClose={() => setActOn(null)} onDone={() => { setActOn(null); invalidate(); }}
          onOpen={() => { openItem(actOn); setActOn(null); }}
          onVision={() => { openVision(actOn); setActOn(null); }} />
      )}
    </div>
  );
}

function ActNowDialog({ item, onClose, onDone, onOpen, onVision }: {
  item: WorkItem; onClose: () => void; onDone: () => void; onOpen: () => void; onVision: () => void;
}) {
  const [justification, setJustification] = useState('');
  const isApproval = item.itemType === 'APPROVAL';
  const isTask = ['TASK', 'OVERDUE_ACTION'].includes(item.itemType) && item.sourceEntityType === 'ACTION_PLAN';
  const isNotification = item.sourceEntityType === 'NOTIFICATION';

  const act = useMutation({
    mutationFn: (action: string) => api(`/my-day/items/${item.id}/action`, { method: 'POST', json: { action, justification } }),
    onSuccess: (res: any) => {
      if (res?.redirect) { window.location.href = res.redirect; return; }
      toast.success(res?.message ?? 'Ação registrada');
      onDone();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao executar ação'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Agir agora</DialogTitle></DialogHeader>
        <div className="rounded-md border bg-muted/20 p-3">
          <div className="text-sm font-semibold">{item.title}</div>
          {item.summary && <div className="mt-0.5 text-xs text-muted-foreground">{item.summary}</div>}
          {item.recommendedAction && <div className="mt-1 text-xs text-primary">Próxima ação: {item.recommendedAction}</div>}
        </div>

        {isApproval ? (
          <div className="space-y-3">
            <div>
              <Label>Justificativa <span className="text-xs text-muted-foreground">(obrigatória para reprovar/ajustes)</span></Label>
              <Textarea rows={3} value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Descreva o motivo da sua decisão..." />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={act.isPending} onClick={() => act.mutate('approve')}>Aprovar</Button>
              <Button variant="outline" className="border-rose-300 text-rose-600" disabled={act.isPending} onClick={() => act.mutate('reject')}>Reprovar</Button>
              <Button variant="outline" disabled={act.isPending} onClick={() => act.mutate('changes')}>Solicitar ajustes</Button>
            </div>
          </div>
        ) : isTask ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Conclua a tarefa aqui, ou abra o registro para atualizar progresso, anexar evidências e comentar.</p>
            <Button disabled={act.isPending} onClick={() => act.mutate('complete')}>Concluir tarefa</Button>
          </div>
        ) : isNotification ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{item.summary || 'Notificação'}</p>
            <Button disabled={act.isPending} onClick={() => act.mutate('markRead')}>Marcar como lida</Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Esta ação é concluída no módulo de origem. Abra o registro para executar com todo o contexto, ou consulte os vínculos na Visão 360°.
          </p>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {VISION360_TYPE[item.sourceEntityType] && <Button variant="outline" onClick={onVision}>Abrir Visão 360°</Button>}
          <Button variant="outline" onClick={onOpen}>Abrir registro</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
