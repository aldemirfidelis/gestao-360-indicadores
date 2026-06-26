'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle, AtSign, Bookmark, CalendarDays, CheckCircle2, CheckSquare, Clock3, Columns3, EyeOff, FileText, FileWarning,
  Inbox, LayoutList, MessageSquare, Pin, Plus, RefreshCw, Search, ShieldAlert, SlidersHorizontal, Sparkles, Table2, Target, Stamp, ThumbsDown, ThumbsUp, UserPlus, Users, Workflow,
  Star, Sun, Play, Pause, BarChart3, Clock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/select';
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
  isBlocking?: boolean;
  recommendedAction?: string | null;
  availableActions?: Array<{ key: string; label: string; kind?: string; inline?: boolean; requiresJustification?: boolean; href?: string | null }> | null;
  contextData?: { delegatedFromName?: string; delegationReason?: string } | null;
  isDelegated?: boolean;
  delegatedFromUserId?: string | null;
  isFollowed?: boolean;
  isPinned?: boolean;
  followedAt?: string | null;
  pinnedAt?: string | null;
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
  DOCUMENT_EDIT_APPROVAL: { label: 'Liberar documento', icon: FileText },
  DOCUMENT_EDIT: { label: 'Editar documento', icon: FileText },
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
  { key: 'overview', label: 'Visão geral' },
  { key: 'priorities', label: 'Prioridades' },
  { key: 'today', label: 'Hoje' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'approvals', label: 'Aprovações' },
  { key: 'overdue', label: 'Atrasados' },
  { key: 'upcoming', label: 'Próximos prazos' },
];

const EXTRA_TABS = [
  { key: 'delegated', label: 'Delegados' },
  { key: 'following', label: 'Acompanhando' },
  { key: 'pinned', label: 'Fixados' },
];

interface DelegationPayload {
  given: Array<{ id: string; status: string; startsAt: string; endsAt?: string | null; reason?: string | null; delegate: { id: string; name: string; email: string } }>;
  received: Array<{ id: string; status: string; startsAt: string; endsAt?: string | null; reason?: string | null; delegator: { id: string; name: string; email: string } }>;
  users: Array<{ id: string; name: string; email: string; jobTitle?: string | null }>;
}

interface AssistantResult {
  enabled: boolean;
  disclaimer: string;
  generatedAt: string;
  summary: string | null;
  recommendations: Array<{ key: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO'; title: string; explanation: string; suggestion: string; relatedItemIds?: string[]; pattern?: string }>;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatTodayDate() {
  const d = new Date();
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  const dateStr = d.toLocaleDateString('pt-BR', options);
  const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${dateStr}  |  ${capitalizedWeekday}`;
}

const Sparkline = ({ color }: { color: string }) => {
  return (
    <svg className="w-16 h-6 stroke-2 fill-none" viewBox="0 0 60 20">
      <path
        d={color === 'red' 
          ? "M 0 5 Q 15 18 30 8 T 60 15" 
          : color === 'green' 
          ? "M 0 15 Q 15 5 30 12 T 60 3" 
          : color === 'orange'
          ? "M 0 10 Q 15 3 30 15 T 60 8"
          : color === 'purple'
          ? "M 0 15 Q 15 15 30 5 T 60 12"
          : color === 'turquoise'
          ? "M 0 12 Q 15 5 30 15 T 60 6"
          : "M 0 10 L 20 10 L 40 10 L 60 10"}
        stroke={color === 'red' ? '#ef4444' : color === 'green' ? '#22c55e' : color === 'orange' ? '#f97316' : color === 'purple' ? '#a855f7' : color === 'turquoise' ? '#06b6d4' : color === 'blue' ? '#3b82f6' : '#94a3b8'}
      />
    </svg>
  );
};

export default function MeuDiaPage() {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const vision = useVision360();

  const [tab, setTab] = useState('overview');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [actOn, setActOn] = useState<WorkItem | null>(null);
  const [view, setView] = useState<'list' | 'table' | 'kanban' | 'calendar' | 'timeline'>('list');
  const [compact, setCompact] = useState(false);
  const [hiddenCards, setHiddenCards] = useState<string[]>([]);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [delegationsOpen, setDelegationsOpen] = useState(false);
  const prefsInit = useRef(false);

  const overview = useQuery<{ summary: Summary; isManager: boolean }>({ queryKey: ['my-day', 'overview'], queryFn: () => api('/my-day') });
  const itemsQuery = useQuery<{ rows: WorkItem[]; total: number }>({
    queryKey: ['my-day', 'items', tab, typeFilter, q],
    queryFn: () => api(`/my-day/items?tab=${tab}${typeFilter ? `&itemType=${typeFilter}` : ''}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`),
  });

  const refresh = useMutation({
    mutationFn: () => api('/my-day/refresh', { method: 'POST' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['my-day'] }); toast.success('Atualizado'); },
  });

  const prefs = useQuery<any>({ queryKey: ['my-day', 'preferences'], queryFn: () => api('/my-day/preferences') });
  const savedFilters = useQuery<any[]>({ queryKey: ['my-day', 'saved-filters'], queryFn: () => api('/my-day/saved-filters') });
  const delegations = useQuery<DelegationPayload>({ queryKey: ['my-day', 'delegations'], queryFn: () => api('/my-day/delegations'), enabled: delegationsOpen });
  const assistant = useQuery<AssistantResult>({ queryKey: ['my-day', 'assistant'], queryFn: () => api('/my-day/assistant') });

  useEffect(() => {
    if (prefsInit.current || !prefs.data) return;
    prefsInit.current = true;
    if (['table', 'kanban', 'list', 'calendar', 'timeline'].includes(prefs.data.defaultView)) setView(prefs.data.defaultView);
    if (prefs.data.compactMode) setCompact(true);
    const hidden = prefs.data.visibleWidgets?.hidden;
    if (Array.isArray(hidden)) setHiddenCards(hidden);
  }, [prefs.data]);

  const savePrefs = useMutation({
    mutationFn: (patch: any) => api('/my-day/preferences', { method: 'PUT', json: patch }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['my-day', 'preferences'] }); setPrefsOpen(false); toast.success('Preferências salvas'); },
  });
  const addFilter = useMutation({
    mutationFn: (body: any) => api('/my-day/saved-filters', { method: 'POST', json: body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['my-day', 'saved-filters'] }); setSaveOpen(false); toast.success('Filtro salvo'); },
  });
  const delFilter = useMutation({
    mutationFn: (id: string) => api(`/my-day/saved-filters/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-day', 'saved-filters'] }),
  });
  const followMut = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => api(`/my-day/items/${id}/follow`, { method: 'POST', json: { pinned } }),
    onSuccess: () => { invalidate(); toast.success('Acompanhamento atualizado'); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao acompanhar item'),
  });
  const unfollowMut = useMutation({
    mutationFn: (id: string) => api(`/my-day/items/${id}/follow`, { method: 'DELETE' }),
    onSuccess: () => { invalidate(); toast.success('Item removido do acompanhamento'); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao remover acompanhamento'),
  });
  const createDelegation = useMutation({
    mutationFn: (body: any) => api('/my-day/delegations', { method: 'POST', json: body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['my-day', 'delegations'] }); toast.success('Delegação criada'); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao criar delegação'),
  });
  const revokeDelegation = useMutation({
    mutationFn: (id: string) => api(`/my-day/delegations/${id}`, { method: 'DELETE' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['my-day', 'delegations'] }); invalidate(); toast.success('Delegação encerrada'); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao encerrar delegação'),
  });
  const hideRecommendation = useMutation({
    mutationFn: (key: string) => api(`/my-day/assistant/${encodeURIComponent(key)}/hide`, { method: 'POST' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['my-day', 'assistant'] }); toast.success('Recomendação ocultada'); },
  });
  const feedbackRecommendation = useMutation({
    mutationFn: ({ key, helpful }: { key: string; helpful: boolean }) => api(`/my-day/assistant/${encodeURIComponent(key)}/feedback`, { method: 'POST', json: { helpful } }),
    onSuccess: () => toast.success('Retorno registrado'),
  });

  function applyFilter(f: any) {
    if (f.view) setView(f.view);
    setTab(f.tab || 'priorities');
    setTypeFilter(f.itemType || null);
    setQ(f.q || '');
  }

  function invalidate() { void qc.invalidateQueries({ queryKey: ['my-day'] }); }
  function toggleFollow(it: WorkItem) {
    if (it.isFollowed && !it.isPinned) unfollowMut.mutate(it.id);
    else followMut.mutate({ id: it.id, pinned: false });
  }
  function togglePin(it: WorkItem) {
    followMut.mutate({ id: it.id, pinned: !it.isPinned });
  }
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
    else if (type === 'documentsToReview') { setTab('priorities'); setTypeFilter('DOCUMENTS'); }
    else if (type === 'meetingsToday') { setTab('priorities'); setTypeFilter('MEETING'); }
  }

  const s = overview.data?.summary;
  const isManager = overview.data?.isManager;
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
      {tab === 'overview' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
              {greeting()}, {user?.name?.split(' ')[0] ?? 'Usuário'}! 👋
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Vamos transformar planos em resultados extraordinários hoje.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 border bg-card px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm text-slate-700">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              <span>{formatTodayDate()}</span>
            </div>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 px-4 h-9 shadow-sm font-medium"
              onClick={() => toast.info('Nova tarefa será aberta no módulo de tarefas.')}
            >
              <Plus className="h-4 w-4" /> Nova tarefa
            </Button>
            <Button
              variant="outline"
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg flex items-center gap-1.5 px-4 h-9 shadow-sm font-medium"
            >
              <SlidersHorizontal className="h-4 w-4 text-slate-400" /> Ações rápidas
            </Button>
          </div>
        </div>
      ) : (
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
            {isManager && (
              <Button variant="outline" size="sm" onClick={() => router.push('/meu-dia/equipe')}>
                <Users className="mr-2 h-4 w-4" />Equipe
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setDelegationsOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />Delegacoes
            </Button>
            <Button variant="outline" size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
              <RefreshCw className={cn('mr-2 h-4 w-4', refresh.isPending && 'animate-spin')} />Atualizar
            </Button>
          </div>
        </div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
        {cards.filter((c) => !hiddenCards.includes(c.key)).map((c) => {
          let IconComp = CheckSquare;
          let iconColor = "text-blue-500 bg-blue-50";
          let sparklineColor = "blue";
          let variation = "↑ 8% vs ontem";
          let varColor = "text-emerald-600";
          
          if (c.key === 'pending') {
            IconComp = CheckSquare;
            iconColor = "text-blue-500 bg-blue-50";
            sparklineColor = "blue";
            variation = "↑ 8% vs ontem";
            varColor = "text-emerald-600";
          } else if (c.key === 'overdue') {
            IconComp = Clock;
            iconColor = "text-red-500 bg-red-50";
            sparklineColor = "red";
            variation = "↓ 25% vs ontem";
            varColor = "text-rose-600";
          } else if (c.key === 'today') {
            IconComp = CalendarDays;
            iconColor = "text-orange-500 bg-orange-50";
            sparklineColor = "orange";
            variation = "↑ 12% vs ontem";
            varColor = "text-emerald-600";
          } else if (c.key === 'approvals') {
            IconComp = Stamp;
            iconColor = "text-purple-500 bg-purple-50";
            sparklineColor = "purple";
            variation = "↑ 33% vs ontem";
            varColor = "text-emerald-600";
          } else if (c.key === 'indicators') {
            IconComp = Target;
            iconColor = "text-cyan-500 bg-cyan-50";
            sparklineColor = "turquoise";
            variation = "↑ 5% vs ontem";
            varColor = "text-emerald-600";
          } else if (c.key === 'risksCritical') {
            IconComp = AlertTriangle;
            iconColor = "text-amber-500 bg-amber-50";
            sparklineColor = "slate";
            variation = "= estável";
            varColor = "text-slate-500";
          } else if (c.key === 'documentsToReview') {
            IconComp = FileText;
            iconColor = "text-blue-600 bg-blue-50";
            sparklineColor = "blue";
            variation = "↑ 10% vs ontem";
            varColor = "text-emerald-600";
          } else if (c.key === 'meetingsToday') {
            IconComp = Users;
            iconColor = "text-green-500 bg-green-50";
            sparklineColor = "green";
            variation = "↓ 14% vs ontem";
            varColor = "text-rose-600";
          }
          
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => pickCard(c.key as any)}
              className="rounded-xl border border-border bg-card p-4 text-left shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:border-primary/20 transition-all flex flex-col justify-between h-[120px]"
            >
              <div className="flex items-center justify-between w-full">
                <div className={cn("p-1.5 rounded-lg", iconColor)}>
                  <IconComp className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{c.label}</span>
              </div>
              
              <div className="mt-2 text-2xl font-bold text-slate-800 leading-none">{c.value}</div>
              
              <div className="mt-2 flex items-center justify-between w-full border-t border-slate-50 pt-2 shrink-0">
                <span className={cn("text-[9px] font-bold flex items-center gap-0.5", varColor)}>
                  {variation}
                </span>
                <div className="opacity-80 scale-90 -mr-2">
                  <Sparkline color={sparklineColor} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Abas */}
      <div className="flex flex-wrap gap-1 border-b">
        {[...TABS, ...EXTRA_TABS].map((t) => (
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

      {/* Toolbar: visualização + filtros salvos + personalizar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 p-2 rounded-xl border border-border/60">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border bg-white p-0.5 shadow-sm">
            {([['list', LayoutList, 'Lista'], ['table', Table2, 'Tabela'], ['kanban', Columns3, 'Kanban'], ['calendar', CalendarDays, 'Calendário'], ['timeline', Clock3, 'Linha do tempo']] as const).map(([v, Ic, lbl]) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
                  view === v 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                )}
              >
                <Ic className="h-3.5 w-3.5" />{lbl}
              </button>
            ))}
          </div>
          {(savedFilters.data ?? []).length > 0 && (
            <NativeSelect className="h-9 w-44 text-xs font-medium rounded-lg" value="" onChange={(e) => { const f = (savedFilters.data ?? []).find((x) => x.id === e.target.value); if (f) applyFilter(f); }}>
              <option value="">Filtros salvos…</option>
              {(savedFilters.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </NativeSelect>
          )}
          <Button variant="ghost" size="sm" className="h-9 text-xs font-semibold text-slate-500 hover:text-slate-900 rounded-lg" onClick={() => setSaveOpen(true)}>
            <Bookmark className="mr-1 h-3.5 w-3.5 text-slate-400" />Salvar filtro
          </Button>
        </div>
        <Button variant="outline" size="sm" className="h-9 text-xs font-semibold bg-white border border-border text-slate-600 hover:text-slate-900 shadow-sm rounded-lg" onClick={() => setPrefsOpen(true)}>
          <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5 text-slate-400" />Personalizar dashboard
        </Button>
      </div>

      <AssistantPanel
        data={assistant.data}
        loading={assistant.isPending}
        onRefresh={() => void qc.invalidateQueries({ queryKey: ['my-day', 'assistant'] })}
        onHide={(key) => hideRecommendation.mutate(key)}
        onFeedback={(key, helpful) => feedbackRecommendation.mutate({ key, helpful })}
      />

      {/* Lista de itens ou Painel Visão Geral */}
      {tab === 'overview' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* TOPO: Resumo do seu dia (col-span-2) */}
          <div className="lg:col-span-2 rounded-2xl bg-gradient-to-br from-[#0c1938] to-[#12224d] p-6 text-white shadow-md border border-[#1b2b54]/40 flex flex-col justify-between min-h-[220px]">
            <div className="flex items-start justify-between w-full gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 mt-1">
                  <Sun className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-white">Resumo do seu dia</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Visão consolidada do que mais importa agora.</p>
                </div>
              </div>
              {/* Gráfico circular de Donut */}
              <div className="relative flex items-center justify-center h-20 w-20 shrink-0">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" r="30" className="stroke-slate-800 fill-none" strokeWidth="6" />
                  <circle cx="40" cy="40" r="30" className="stroke-cyan-400 fill-none" strokeWidth="6"
                    strokeDasharray={`${2 * Math.PI * 30}`}
                    strokeDashoffset={`${2 * Math.PI * 30 * (1 - 0.92)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-sm font-bold text-white leading-none">92%</span>
                  <span className="text-[9px] text-cyan-400 font-semibold mt-0.5">Índice</span>
                </div>
              </div>
            </div>

            <div className="my-4">
              <h4 className="text-md font-semibold text-white tracking-tight">Sem criticidades relevantes no momento.</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">Mantenha o foco e a disciplina para seguir gerando resultados.</p>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-4 border-t border-white/[0.06] text-center">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Concluídas hoje
                </div>
                <div className="text-lg font-bold text-white mt-1">7</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span> Em andamento
                </div>
                <div className="text-lg font-bold text-white mt-1">15</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                  <span className="h-2 w-2 rounded-full bg-orange-500"></span> Pausadas
                </div>
                <div className="text-lg font-bold text-white mt-1">2</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                  <span className="h-2 w-2 rounded-full bg-slate-500"></span> Planejadas
                </div>
                <div className="text-lg font-bold text-white mt-1">6</div>
              </div>
            </div>
          </div>

          {/* Insights com IA */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col justify-between min-h-[220px]">
            <div className="flex items-start justify-between w-full">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 mt-1">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-slate-800 tracking-tight text-sm">Insights com IA</h3>
                    <span className="bg-indigo-100 text-indigo-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">Novo</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Análises inteligentes para apoiar suas decisões.</p>
                </div>
              </div>
            </div>

            <div className="bg-[#fcfaff] border border-indigo-50/50 rounded-xl p-4 my-3 flex items-start gap-2.5">
              <div className="p-1 rounded-full bg-indigo-100 text-indigo-500 shrink-0 mt-0.5">
                <Sparkles className="h-3 w-3" />
              </div>
              <div className="text-xs leading-relaxed text-indigo-950 font-medium">
                <strong className="text-indigo-900 block font-bold mb-0.5">Rotina sob controle</strong>
                Nenhuma criticidade relevante identificada. Mantenha os acompanhamentos e revise os próximos prazos ao fim do dia.
              </div>
            </div>

            <div className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer">
              Ver mais insights <span className="text-[14px] font-bold">&rarr;</span>
            </div>
          </div>

          {/* COLUNA 1: Prioridades do dia */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Star className="h-4.5 w-4.5 text-amber-500 fill-amber-500" />
                <h3 className="font-bold text-slate-800 text-sm tracking-tight">Prioridades do dia</h3>
              </div>
              <button className="text-slate-400 hover:text-slate-600 text-xs">×</button>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-100 bg-slate-50/20 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-4.5 w-4.5 rounded-full border border-slate-300 flex items-center justify-center shrink-0 cursor-pointer"></div>
                  <span className="text-xs font-semibold text-slate-800 line-clamp-1">Validar indicadores de performance Q2</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="bg-rose-50 text-rose-600 text-[10px] font-bold px-1.5 py-0.5 rounded">Alta</span>
                  <span className="text-[10px] text-slate-500 font-medium">Hoje</span>
                  <div className="h-6 w-6 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-[10px] font-bold text-slate-700">UD</div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-100 bg-slate-50/20 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-4.5 w-4.5 rounded-full border border-slate-300 flex items-center justify-center shrink-0 cursor-pointer"></div>
                  <span className="text-xs font-semibold text-slate-800 line-clamp-1">Aprovar plano de ação - Auditoria Interna</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="bg-rose-50 text-rose-600 text-[10px] font-bold px-1.5 py-0.5 rounded">Alta</span>
                  <span className="text-[10px] text-slate-500 font-medium">Hoje</span>
                  <div className="h-6 w-6 rounded-full bg-slate-300 overflow-hidden flex items-center justify-center text-[10px] font-bold text-slate-700">UD</div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-100 bg-slate-50/20 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-4.5 w-4.5 rounded-full border border-slate-300 flex items-center justify-center shrink-0 cursor-pointer"></div>
                  <span className="text-xs font-semibold text-slate-800 line-clamp-1">Revisar procedimentos - Segurança Patrimonial</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="bg-amber-50 text-amber-600 text-[10px] font-bold px-1.5 py-0.5 rounded">Média</span>
                  <span className="text-[10px] text-slate-500 font-medium">Amanhã</span>
                  <div className="h-6 w-6 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-[10px] font-bold text-slate-700">UD</div>
                </div>
              </div>
            </div>

            <div className="text-xs font-semibold text-blue-600 hover:text-blue-700 pt-2 cursor-pointer" onClick={() => setTab('priorities')}>
              Ver todas as prioridades &rarr;
            </div>
          </div>

          {/* COLUNA 2: Aprovações pendentes */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Stamp className="h-4.5 w-4.5 text-purple-600" />
                <h3 className="font-bold text-slate-800 text-sm tracking-tight">Aprovações pendentes</h3>
              </div>
              <span className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer" onClick={() => { setTab('priorities'); setTypeFilter('APPROVAL'); }}>Ver todas</span>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/10 hover:bg-slate-50 transition-all flex flex-col gap-2 cursor-pointer" onClick={() => { setTab('priorities'); setTypeFilter('APPROVAL'); }}>
                <div className="flex items-center justify-between w-full gap-2">
                  <span className="text-xs font-bold text-slate-800 line-clamp-1">Compra de equipamentos</span>
                  <span className="bg-orange-50 text-orange-600 text-[9px] font-bold px-1.5 py-0.5 rounded">Alta prioridade</span>
                </div>
                <span className="text-[11px] text-slate-500">Solicitante: João Silva</span>
              </div>

              <div className="p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/10 hover:bg-slate-50 transition-all flex flex-col gap-2 cursor-pointer" onClick={() => { setTab('priorities'); setTypeFilter('APPROVAL'); }}>
                <div className="flex items-center justify-between w-full gap-2">
                  <span className="text-xs font-bold text-slate-800 line-clamp-1">Política de Qualidade v2.1</span>
                  <span className="bg-amber-50 text-amber-600 text-[9px] font-bold px-1.5 py-0.5 rounded">Média prioridade</span>
                </div>
                <span className="text-[11px] text-slate-500">Solicitante: Mariana Costa</span>
              </div>
            </div>
          </div>

          {/* COLUNA 3: Próximas reuniões */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4.5 w-4.5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-sm tracking-tight">Próximas reuniões</h3>
              </div>
              <span className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer" onClick={() => router.push('/meetings')}>Ver agenda</span>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/10 hover:bg-slate-50 transition-all flex items-center justify-between gap-3 cursor-pointer" onClick={() => router.push('/meetings')}>
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold text-slate-800 mt-0.5">09:00</span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">Alinhamento Operacional</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Sala de Reuniões 1</p>
                  </div>
                </div>
                <span className="bg-emerald-50 text-emerald-600 text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0">Em 35 min</span>
              </div>

              <div className="p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/10 hover:bg-slate-50 transition-all flex items-center justify-between gap-3 cursor-pointer" onClick={() => router.push('/meetings')}>
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold text-slate-800 mt-0.5">14:00</span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">Revisão de Indicadores</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Online - Teams</p>
                  </div>
                </div>
                <span className="bg-amber-50 text-amber-600 text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0">Em 5h 35m</span>
              </div>
            </div>
          </div>

          {/* COLUNA 1 LINHA 3: Riscos críticos */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4.5 w-4.5 text-red-500" />
                <h3 className="font-bold text-slate-800 text-sm tracking-tight">Riscos críticos</h3>
              </div>
              <span className="bg-red-100 text-red-700 text-[9px] font-bold h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full">2</span>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/10 hover:bg-slate-50 transition-all flex flex-col gap-2 cursor-pointer" onClick={() => router.push('/risks')}>
                <div className="flex items-center justify-between w-full gap-2">
                  <span className="text-xs font-bold text-slate-800 line-clamp-1">Fornecedores críticos sem avaliação atualizada</span>
                  <span className="bg-red-50 text-red-600 text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0">Alta</span>
                </div>
                <span className="text-[11px] text-slate-500">Risco operacional</span>
              </div>
            </div>
          </div>

          {/* COLUNA 2 LINHA 3: Documentos recentes */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-blue-500" />
                <h3 className="font-bold text-slate-800 text-sm tracking-tight">Documentos recentes</h3>
              </div>
              <span className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer" onClick={() => router.push('/documents')}>Ver todos</span>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/10 hover:bg-slate-50 transition-all flex items-center justify-between gap-3 cursor-pointer" onClick={() => router.push('/documents')}>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-800 truncate">Relatório de Auditoria Interna - Maio/2026</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">Atualizado há 2h por Mariana Costa</p>
                </div>
                <span className="bg-red-50 text-red-600 text-[9px] font-bold px-2 py-0.5 rounded shrink-0">PDF</span>
              </div>
            </div>
          </div>

          {/* COLUNA 3 LINHA 2-3: Indicadores em destaque */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4.5 w-4.5 text-cyan-600" />
                <h3 className="font-bold text-slate-800 text-sm tracking-tight">Indicadores em destaque</h3>
              </div>
              <span className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer" onClick={() => router.push('/indicators')}>Ver painel</span>
            </div>

            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-3 cursor-pointer" onClick={() => router.push('/indicators')}>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-800 truncate">Produtividade Operacional</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Meta: &ge; 90%</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Sparkline color="green" />
                  <span className="text-xs font-bold text-emerald-600">92,4%</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 cursor-pointer" onClick={() => router.push('/indicators')}>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-800 truncate">Qualidade de Processos</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Meta: &ge; 95%</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Sparkline color="green" />
                  <span className="text-xs font-bold text-emerald-600">96,1%</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 cursor-pointer" onClick={() => router.push('/indicators')}>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-800 truncate">Satisfação do Cliente</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Meta: &ge; 90%</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Sparkline color="red" />
                  <span className="text-xs font-bold text-rose-600">88,7%</span>
                </div>
              </div>
            </div>
          </div>

          {/* COLUNA 3 LINHA 3: Acompanhamentos */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-emerald-600" />
                <h3 className="font-bold text-slate-800 text-sm tracking-tight">Acompanhamentos</h3>
              </div>
              <span className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer">Ver todos</span>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/10 hover:bg-slate-50 transition-all flex flex-col gap-2.5">
                <div className="flex items-center justify-between w-full gap-2">
                  <span className="text-xs font-bold text-slate-800">Plano de ação - ISO 9001</span>
                  <span className="text-xs font-bold text-slate-700">75%</span>
                </div>
                {/* Barra de progresso */}
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: '75%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {itemsQuery.isPending ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg border bg-muted/30" />)}</div>
          ) : rows.length === 0 ? (
            <Card><CardContent className="p-10 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
              <div className="mt-2 text-base font-semibold">Nada por aqui</div>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Nenhum item para esta visão. Aproveite para adiantar outras frentes.</p>
            </CardContent></Card>
          ) : view === 'table' ? (
            <ItemsTable rows={rows} onAct={setActOn} onFollow={toggleFollow} onPin={togglePin} />
          ) : view === 'kanban' ? (
            <ItemsKanban rows={rows} onAct={setActOn} onFollow={toggleFollow} onPin={togglePin} />
          ) : view === 'calendar' ? (
            <ItemsCalendar rows={rows} onAct={setActOn} onFollow={toggleFollow} onPin={togglePin} />
          ) : view === 'timeline' ? (
            <ItemsTimeline rows={rows} onAct={setActOn} onFollow={toggleFollow} onPin={togglePin} />
          ) : (
            rows.map((it) => {
              const meta = TYPE_META[it.itemType] ?? { label: it.itemType, icon: Inbox };
              const Icon = meta.icon;
              const prio = PRIORITY_META[it.priority] ?? PRIORITY_META.MEDIUM;
              return (
                <Card key={it.id} className={cn(it.overdueDays > 0 && 'border-l-4 border-l-rose-400')}>
                  <CardContent className={cn('flex flex-wrap items-start gap-3', compact ? 'p-2' : 'p-3')}>
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', prio.cls)}>{prio.label}</span>
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{meta.label}</span>
                        {it.overdueDays > 0 && <Badge variant="outline" className="border-rose-300 text-rose-600">Atrasado {it.overdueDays}d</Badge>}
                        {it.isDelegated && <Badge variant="outline">Delegado por {it.contextData?.delegatedFromName ?? 'usuário'}</Badge>}
                        {it.isPinned && <Badge variant="outline">Fixado</Badge>}
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
                      <div className="flex gap-1">
                        <Button size="sm" variant={it.isFollowed ? 'secondary' : 'outline'} onClick={() => toggleFollow(it)} title="Acompanhar">
                          <Bookmark className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant={it.isPinned ? 'secondary' : 'outline'} onClick={() => togglePin(it)} title="Fixar">
                          <Pin className="h-4 w-4" />
                        </Button>
                      </div>
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
      )}

      {prefsOpen && (
        <PersonalizeDialog
          initial={{ view, compact, hiddenCards, landingPage: prefs.data?.landingPage ?? '/meu-dia' }}
          cards={cards.map((c) => ({ key: c.key, label: c.label }))}
          saving={savePrefs.isPending}
          onClose={() => setPrefsOpen(false)}
          onSave={(p) => {
            setView(p.view); setCompact(p.compact); setHiddenCards(p.hiddenCards);
            savePrefs.mutate({ defaultView: p.view, compactMode: p.compact, visibleWidgets: { hidden: p.hiddenCards }, landingPage: p.landingPage });
          }}
        />
      )}
      {saveOpen && (
        <SaveFilterDialog
          saving={addFilter.isPending}
          existing={savedFilters.data ?? []}
          onDelete={(id) => delFilter.mutate(id)}
          onClose={() => setSaveOpen(false)}
          onSave={(name) => addFilter.mutate({ name, view, tab, itemType: typeFilter, q })}
        />
      )}
      {delegationsOpen && (
        <DelegationsDialog
          data={delegations.data}
          loading={delegations.isPending}
          creating={createDelegation.isPending}
          revoking={revokeDelegation.isPending}
          onClose={() => setDelegationsOpen(false)}
          onCreate={(body) => createDelegation.mutate(body)}
          onRevoke={(id) => revokeDelegation.mutate(id)}
        />
      )}
      {actOn && (
        <ActNowDialog item={actOn} onClose={() => setActOn(null)} onDone={() => { setActOn(null); invalidate(); }}
          onOpen={() => { openItem(actOn); setActOn(null); }}
          onVision={() => { openVision(actOn); setActOn(null); }} />
      )}
    </div>
  );
}

function AssistantPanel({ data, loading, onRefresh, onHide, onFeedback }: {
  data?: AssistantResult;
  loading: boolean;
  onRefresh: () => void;
  onHide: (key: string) => void;
  onFeedback: (key: string, helpful: boolean) => void;
}) {
  if (loading) return <div className="h-24 animate-pulse rounded-lg border bg-muted/30" />;
  if (!data) return null;
  return (
    <Card className="border-primary/20">
      <CardContent className="p-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold">Resumo assistido do Meu Dia</div>
              {!data.enabled && <Badge variant="outline">Desativado</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{data.disclaimer}</p>
            {data.summary && <p className="mt-2 text-sm">{data.summary}</p>}
          </div>
          <Button size="sm" variant="outline" onClick={onRefresh}><RefreshCw className="mr-1 h-4 w-4" />Atualizar</Button>
        </div>
        {data.enabled && data.recommendations.length > 0 && (
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {data.recommendations.map((rec) => {
              const cls = PRIORITY_META[rec.severity]?.cls ?? PRIORITY_META.INFO.cls;
              return (
                <div key={rec.key} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', cls)}>{rec.severity}</span>
                    <span className="text-sm font-medium">{rec.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{rec.explanation}</p>
                  <p className="mt-2 text-sm text-primary">{rec.suggestion}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onFeedback(rec.key, true)}><ThumbsUp className="mr-1 h-3.5 w-3.5" />Útil</Button>
                    <Button size="sm" variant="ghost" onClick={() => onFeedback(rec.key, false)}><ThumbsDown className="mr-1 h-3.5 w-3.5" />Não útil</Button>
                    <Button size="sm" variant="ghost" onClick={() => onHide(rec.key)}><EyeOff className="mr-1 h-3.5 w-3.5" />Ocultar</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActNowDialog({ item, onClose, onDone, onOpen, onVision }: {
  item: WorkItem; onClose: () => void; onDone: () => void; onOpen: () => void; onVision: () => void;
}) {
  const [justification, setJustification] = useState('');
  const isApproval = item.itemType === 'APPROVAL';
  const isTask = ['TASK', 'OVERDUE_ACTION'].includes(item.itemType) && item.sourceEntityType === 'ACTION_PLAN';
  const isNotification = item.sourceEntityType === 'NOTIFICATION';
  const isDocumentEditApproval = item.itemType === 'DOCUMENT_EDIT_APPROVAL';
  const isDocumentEdit = item.itemType === 'DOCUMENT_EDIT';

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
        ) : isDocumentEditApproval ? (
          <div className="space-y-3">
            <div>
              <Label>Justificativa <span className="text-xs text-muted-foreground">(obrigatoria para rejeitar)</span></Label>
              <Textarea rows={3} value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Oriente o solicitante, quando necessário." />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={act.isPending} onClick={() => act.mutate('approve')}>Liberar edição</Button>
              <Button variant="outline" className="border-rose-300 text-rose-600" disabled={act.isPending} onClick={() => act.mutate('reject')}>Rejeitar</Button>
            </div>
          </div>
        ) : isDocumentEdit ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Abra o documento para editar pela web. Ao finalizar, marque a tarefa como concluída.</p>
            <Button disabled={act.isPending} onClick={() => act.mutate('complete')}>Concluir edição</Button>
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

function ItemsTable({ rows, onAct, onFollow, onPin }: { rows: WorkItem[]; onAct: (it: WorkItem) => void; onFollow: (it: WorkItem) => void; onPin: (it: WorkItem) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Prioridade</th>
            <th className="px-3 py-2 text-left">Tipo</th>
            <th className="px-3 py-2 text-left">Item</th>
            <th className="px-3 py-2 text-left">Prazo</th>
            <th className="px-3 py-2 text-right">Ação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((it) => {
            const prio = PRIORITY_META[it.priority] ?? PRIORITY_META.MEDIUM;
            const meta = TYPE_META[it.itemType] ?? { label: it.itemType, icon: Inbox };
            return (
              <tr key={it.id} className="border-t">
                <td className="px-3 py-2"><span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', prio.cls)}>{prio.label}</span></td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{meta.label}</td>
                <td className="px-3 py-2"><div className="font-medium">{it.title}</div>{it.summary && <div className="text-xs text-muted-foreground">{it.summary}</div>}</td>
                <td className="px-3 py-2 text-xs">{it.overdueDays > 0 ? <span className="text-rose-600">atrasado {it.overdueDays}d</span> : it.dueAt ? formatDate(it.dueAt) : '—'}</td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center gap-1">
                    <Button size="sm" variant={it.isFollowed ? 'secondary' : 'outline'} onClick={() => onFollow(it)}><Bookmark className="h-4 w-4" /></Button>
                    <Button size="sm" variant={it.isPinned ? 'secondary' : 'outline'} onClick={() => onPin(it)}><Pin className="h-4 w-4" /></Button>
                    <Button size="sm" onClick={() => onAct(it)}>Agir</Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const KANBAN_LANES = [
  { key: 'new', label: 'Novo' },
  { key: 'progress', label: 'Em andamento' },
  { key: 'waiting', label: 'Aguardando' },
  { key: 'blocked', label: 'Bloqueado' },
];
function laneOf(it: WorkItem): string {
  if (it.isBlocking) return 'blocked';
  if (it.itemType === 'APPROVAL') return 'waiting';
  if (it.status === 'IN_PROGRESS') return 'progress';
  return 'new';
}
function ItemsKanban({ rows, onAct, onFollow, onPin }: { rows: WorkItem[]; onAct: (it: WorkItem) => void; onFollow: (it: WorkItem) => void; onPin: (it: WorkItem) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {KANBAN_LANES.map((lane) => {
        const items = rows.filter((it) => laneOf(it) === lane.key);
        return (
          <div key={lane.key} className="rounded-lg border bg-muted/20 p-2">
            <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold text-muted-foreground">
              <span>{lane.label}</span><span>{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((it) => {
                const prio = PRIORITY_META[it.priority] ?? PRIORITY_META.MEDIUM;
                return (
                  <div key={it.id}
                    className={cn('w-full rounded-md border bg-card p-2 text-left hover:border-primary/40', it.overdueDays > 0 && 'border-l-2 border-l-rose-400')}>
                    <div className="flex items-center gap-1.5">
                      <span className={cn('rounded px-1 py-0.5 text-[10px] font-medium', prio.cls)}>{prio.label}</span>
                      <span className="text-[10px] uppercase text-muted-foreground">{TYPE_META[it.itemType]?.label ?? it.itemType}</span>
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs font-medium">{it.title}</div>
                    {it.overdueDays > 0 && <div className="mt-0.5 text-[10px] text-rose-600">atrasado {it.overdueDays}d</div>}
                    <div className="mt-2 flex items-center gap-1">
                      <Button size="sm" variant={it.isFollowed ? 'secondary' : 'outline'} onClick={() => onFollow(it)}><Bookmark className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant={it.isPinned ? 'secondary' : 'outline'} onClick={() => onPin(it)}><Pin className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" className="ml-auto" onClick={() => onAct(it)}>Agir</Button>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && <div className="px-1 py-4 text-center text-[11px] text-muted-foreground">—</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function dayKey(value?: string | null) {
  if (!value) return 'Sem prazo';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Sem prazo';
  return d.toISOString().slice(0, 10);
}

function ItemsCalendar({ rows, onAct, onFollow, onPin }: { rows: WorkItem[]; onAct: (it: WorkItem) => void; onFollow: (it: WorkItem) => void; onPin: (it: WorkItem) => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, WorkItem[]>();
    for (const row of rows) {
      const key = dayKey(row.dueAt);
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return [...map.entries()].sort(([a], [b]) => (a === 'Sem prazo' ? 1 : b === 'Sem prazo' ? -1 : a.localeCompare(b)));
  }, [rows]);
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {groups.map(([key, items]) => (
        <Card key={key}>
          <CardContent className="p-3">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold">
              <span>{key === 'Sem prazo' ? key : formatDate(key)}</span>
              <span className="text-xs text-muted-foreground">{items.length} item(ns)</span>
            </div>
            <div className="space-y-2">
              {items.map((it) => <MiniWorkItem key={it.id} item={it} onAct={onAct} onFollow={onFollow} onPin={onPin} />)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ItemsTimeline({ rows, onAct, onFollow, onPin }: { rows: WorkItem[]; onAct: (it: WorkItem) => void; onFollow: (it: WorkItem) => void; onPin: (it: WorkItem) => void }) {
  const ordered = [...rows].sort((a, b) => {
    const da = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const db = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return da - db || b.overdueDays - a.overdueDays;
  });
  return (
    <div className="space-y-2">
      {ordered.map((it) => (
        <div key={it.id} className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-[140px_1fr]">
          <div className="text-xs text-muted-foreground">
            {it.overdueDays > 0 ? <span className="font-medium text-rose-600">Atrasado {it.overdueDays}d</span> : it.dueAt ? formatDate(it.dueAt) : 'Sem prazo'}
          </div>
          <MiniWorkItem item={it} onAct={onAct} onFollow={onFollow} onPin={onPin} unframed />
        </div>
      ))}
    </div>
  );
}

function MiniWorkItem({ item, onAct, onFollow, onPin, unframed }: { item: WorkItem; onAct: (it: WorkItem) => void; onFollow: (it: WorkItem) => void; onPin: (it: WorkItem) => void; unframed?: boolean }) {
  const prio = PRIORITY_META[item.priority] ?? PRIORITY_META.MEDIUM;
  return (
    <div className={cn(!unframed && 'rounded-md border p-2')}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', prio.cls)}>{prio.label}</span>
        <span className="text-[11px] uppercase text-muted-foreground">{TYPE_META[item.itemType]?.label ?? item.itemType}</span>
        {item.isDelegated && <Badge variant="outline">Delegado</Badge>}
        {item.isPinned && <Badge variant="outline">Fixado</Badge>}
      </div>
      <div className="mt-1 text-sm font-medium">{item.title}</div>
      {item.summary && <div className="text-xs text-muted-foreground">{item.summary}</div>}
      <div className="mt-2 flex flex-wrap gap-1">
        <Button size="sm" variant={item.isFollowed ? 'secondary' : 'outline'} onClick={() => onFollow(item)}><Bookmark className="h-4 w-4" /></Button>
        <Button size="sm" variant={item.isPinned ? 'secondary' : 'outline'} onClick={() => onPin(item)}><Pin className="h-4 w-4" /></Button>
        <Button size="sm" onClick={() => onAct(item)}>Agir</Button>
      </div>
    </div>
  );
}

function DelegationsDialog({ data, loading, creating, revoking, onClose, onCreate, onRevoke }: {
  data?: DelegationPayload;
  loading: boolean;
  creating: boolean;
  revoking: boolean;
  onClose: () => void;
  onCreate: (body: any) => void;
  onRevoke: (id: string) => void;
}) {
  const [delegateUserId, setDelegateUserId] = useState('');
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState('');
  const users = data?.users ?? [];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Delegacoes e substituicoes</DialogTitle></DialogHeader>
        {loading ? (
          <div className="h-32 animate-pulse rounded-md bg-muted/40" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="text-sm font-semibold">Delegar meus itens</div>
              <div>
                <Label>Substituto</Label>
                <NativeSelect value={delegateUserId} onChange={(e) => setDelegateUserId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name} - {u.email}</option>)}
                </NativeSelect>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Inicio</Label><Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></div>
                <div><Label>Fim</Label><Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></div>
              </div>
              <div><Label>Motivo</Label><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ferias, ausencia, cobertura operacional..." /></div>
              <Button disabled={!delegateUserId || creating} onClick={() => onCreate({ delegateUserId, startsAt, endsAt: endsAt || null, reason })}>Criar delegação</Button>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold">Minhas delegações</div>
                <div className="mt-2 space-y-2">
                  {(data?.given ?? []).length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma delegação criada.</p> : data!.given.map((d) => (
                    <div key={d.id} className="rounded-md border p-2 text-sm">
                      <div className="font-medium">{d.delegate.name}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(d.startsAt)} até {d.endsAt ? formatDate(d.endsAt) : 'sem fim'} - {d.status}</div>
                      {d.reason && <div className="mt-1 text-xs">{d.reason}</div>}
                      {d.status === 'ACTIVE' && <Button size="sm" variant="outline" className="mt-2" disabled={revoking} onClick={() => onRevoke(d.id)}>Encerrar</Button>}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold">Recebidas</div>
                <div className="mt-2 space-y-2">
                  {(data?.received ?? []).length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma substituicao recebida.</p> : data!.received.map((d) => (
                    <div key={d.id} className="rounded-md border p-2 text-sm">
                      <div className="font-medium">{d.delegator.name}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(d.startsAt)} até {d.endsAt ? formatDate(d.endsAt) : 'sem fim'} - {d.status}</div>
                      {d.reason && <div className="mt-1 text-xs">{d.reason}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        <DialogFooter><Button variant="ghost" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PersonalizeDialog({ initial, cards, saving, onClose, onSave }: {
  initial: { view: 'list' | 'table' | 'kanban' | 'calendar' | 'timeline'; compact: boolean; hiddenCards: string[]; landingPage: string };
  cards: Array<{ key: string; label: string }>;
  saving: boolean;
  onClose: () => void;
  onSave: (p: { view: 'list' | 'table' | 'kanban' | 'calendar' | 'timeline'; compact: boolean; hiddenCards: string[]; landingPage: string }) => void;
}) {
  const [view, setView] = useState(initial.view);
  const [compact, setCompact] = useState(initial.compact);
  const [hidden, setHidden] = useState<string[]>(initial.hiddenCards);
  const [landing, setLanding] = useState(initial.landingPage || '/meu-dia');
  const toggleCard = (key: string) => setHidden((h) => (h.includes(key) ? h.filter((k) => k !== key) : [...h, key]));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Personalizar Meu Dia</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Visualização padrão</Label>
              <NativeSelect value={view} onChange={(e) => setView(e.target.value as any)}>
                <option value="list">Lista</option><option value="table">Tabela</option><option value="kanban">Kanban</option><option value="calendar">Calendário</option><option value="timeline">Linha do tempo</option>
              </NativeSelect>
            </div>
            <div>
              <Label>Página inicial</Label>
              <NativeSelect value={landing} onChange={(e) => setLanding(e.target.value)}>
                <option value="/meu-dia">Meu Dia</option>
                <option value="/visualization">Painel Executivo</option>
                <option value="/visualization">Painel Executivo</option>
                <option value="/strategy">Mapa Estratégico</option>
                <option value="/indicators">Indicadores</option>
              </NativeSelect>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} />Modo compacto
          </label>
          <div>
            <Label>Cards de resumo visíveis</Label>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {cards.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!hidden.includes(c.key)} onChange={() => toggleCard(c.key)} />{c.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={saving} onClick={() => onSave({ view, compact, hiddenCards: hidden, landingPage: landing })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaveFilterDialog({ saving, existing, onDelete, onClose, onSave }: {
  saving: boolean; existing: any[]; onDelete: (id: string) => void; onClose: () => void; onSave: (name: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Filtros salvos</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Nome do filtro atual" value={name} onChange={(e) => setName(e.target.value)} />
            <Button disabled={!name.trim() || saving} onClick={() => onSave(name.trim())}><Plus className="mr-1 h-4 w-4" />Salvar</Button>
          </div>
          {existing.length > 0 && (
            <div className="space-y-1">
              {existing.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-md border px-2 py-1.5 text-sm">
                  <span>{f.name}</span>
                  <button type="button" className="text-xs text-rose-600" onClick={() => onDelete(f.id)}>Remover</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
