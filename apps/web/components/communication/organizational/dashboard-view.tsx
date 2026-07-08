'use client';

// Extraido de app/(app)/comunicacao/page.tsx (decomposicao Fase 4).
import Link from 'next/link';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileBarChart,
  FileText,
  FileUp,
  HelpCircle,
  Megaphone,
  MessageCircle,
  MessageSquare,
  PlaySquare,
  Plus,
  QrCode,
  Send,
  SlidersHorizontal,
  Sparkles,
  ThumbsUp,
  Users,
  Video,
  Vote,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn, formatDate, formatNumber, formatPercent } from '@/lib/utils';
import {
  audienceLabel,
  defaultForm,
  STATUS_LABEL,
  toneClass,
  TYPE_LABEL,
  type Campaign,
  type CommunicationForm,
  type CommunicationOverview,
  type CommunicationPost,
  type CommunicationTab,
  type KpiCardProps,
} from './shared';
import { PriorityBadge, SmallFact } from './shared-widgets';
import { WallList } from './post-views';

export function KpiCard({ title, value, change, color, icon: Icon }: KpiCardProps) {
  const colorClasses = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 dark:bg-emerald-500/20 border-emerald-500/10',
    purple: 'bg-violet-500/10 text-violet-650 dark:text-violet-400 dark:bg-violet-500/20 border-violet-500/10',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-500/20 border-amber-500/10',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 dark:bg-rose-500/20 border-rose-500/10',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 dark:bg-sky-500/20 border-sky-500/10',
  };

  return (
    <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm transition-all hover:shadow-md">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="space-y-1 min-w-0">
          <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider block truncate">{title}</span>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white leading-none">{value}</div>
          <div className="text-[9px] text-slate-500 dark:text-slate-400 font-medium block truncate mt-0.5">{change}</div>
        </div>
        <div className={cn('h-9 w-9 rounded-full flex items-center justify-center shrink-0 border ml-2', colorClasses[color])}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </CardContent>
    </Card>
  );
}

export function QuickActionBtn({ icon: Icon, title, onClick }: { icon: React.ComponentType<any>; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md hover:border-slate-200/50 dark:hover:border-slate-800"
    >
      <div className="h-8 w-8 rounded-full flex items-center justify-center border bg-slate-50/50 dark:bg-slate-950/20 border-slate-200/40 text-sky-500">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="text-[10px] font-bold text-slate-850 dark:text-slate-200 leading-snug max-w-[90px]">{title}</div>
    </button>
  );
}

export function CampaignItem({ time, title, color, type }: { time: string; title: string; color: 'purple' | 'green' | 'amber' | 'blue'; type: string }) {
  const borderColors = {
    purple: 'border-l-violet-500 bg-violet-500/5 dark:bg-violet-500/10 text-violet-750 dark:text-violet-400',
    green: 'border-l-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-750 dark:text-emerald-400',
    amber: 'border-l-amber-500 bg-amber-500/5 dark:bg-amber-500/10 text-amber-750 dark:text-amber-400',
    blue: 'border-l-sky-500 bg-sky-500/5 dark:bg-sky-500/10 text-sky-750 dark:text-sky-400',
  };

  return (
    <div className={cn('p-3 rounded-r-lg border border-slate-100 dark:border-slate-800 border-l-4 transition-all hover:shadow-sm', borderColors[color])}>
      <div className="flex items-center justify-between text-[10px] font-bold">
        <span>{time}</span>
        <span className="uppercase text-[8px] tracking-wider opacity-80">{type}</span>
      </div>
      <div className="text-xs font-bold text-slate-850 dark:text-slate-150 mt-1 line-clamp-1">{title}</div>
    </div>
  );
}

export interface CommunicationDashboardViewProps {
  data?: CommunicationOverview;
  loading: boolean;
  channelFilter: string;
  setChannelFilter: (v: string) => void;
  setTab: (tab: CommunicationTab) => void;
  onCreatePreset: (preset: Partial<CommunicationForm>) => void;
  onSelectPost: (id: string) => void;
  onMessageUser: (id: string) => void;
  unread: number;
  conversationCount: number;
  canCreate: boolean;
}

export function CommunicationDashboardView({
  data,
  loading,
  channelFilter,
  setChannelFilter,
  setTab,
  onCreatePreset,
  onSelectPost,
  onMessageUser,
  unread,
  conversationCount,
  canCreate,
}: CommunicationDashboardViewProps) {
  const router = useRouter();

  const posts = data?.posts ?? [];
  const countPublished = data?.metrics?.publishedThisMonth ?? 0;
  const countDrafts = data?.metrics?.drafts ?? 0;
  const readRate = data?.metrics?.readRate ?? 0;
  const countPending = data?.metrics?.mandatoryPending ?? 0;
  const activePolls = posts.filter((post) => ['POLL', 'SURVEY'].includes(post.type) && post.status === 'PUBLISHED').length;
  const countCritical = data?.metrics?.critical ?? 0;
  const countMessages = unread;
  const countReach = data?.metrics?.totalViews ?? 0;
  const countImpacted = posts.filter((post) => post.status === 'PUBLISHED').reduce((sum, post) => sum + post.audienceSize, 0);
  const countScheduled = data?.metrics?.scheduled ?? 0;

  const CHANNELS = [
    { label: 'Todos os canais', filter: 'Todos os canais' },
    { label: 'Mural', filter: 'Mural' },
    { label: 'E-mail', filter: 'E-mail' },
    { label: 'Push', filter: 'Push' },
    { label: 'In-app', filter: 'In-app' },
    { label: 'Banner', filter: 'Banner' },
    { label: 'Enquete', filter: 'Enquete' },
    { label: 'Confirmação obrigatória', filter: 'Confirmação' },
  ];

  const pendingStaff = data?.team?.pendingPeople ?? [];
  const publicSegments = data?.charts?.readByArea ?? [];
  const channelDefinitions = [
    { name: 'Mural', matches: (post: CommunicationPost) => Boolean(post.channels.digitalBoard) },
    { name: 'Push', matches: (post: CommunicationPost) => Boolean(post.channels.push) },
    { name: 'E-mail', matches: (post: CommunicationPost) => Boolean(post.channels.email) },
    { name: 'In-app', matches: (post: CommunicationPost) => Boolean(post.channels.platform || post.channels.myDay || post.channels.homeCard) },
    { name: 'Banner', matches: (post: CommunicationPost) => Boolean(post.channels.topBanner || post.type === 'BANNER') },
    { name: 'Enquete', matches: (post: CommunicationPost) => ['POLL', 'SURVEY'].includes(post.type) },
  ];
  const channelRates = channelDefinitions.map((channel) => {
    const channelPosts = posts.filter(channel.matches);
    const delivered = channelPosts.reduce((sum, post) => sum + post.audienceSize, 0);
    const views = channelPosts.reduce((sum, post) => sum + post.receipts.length, 0);
    return { name: channel.name, rate: delivered > 0 ? views / delivered : 0, posts: channelPosts.length };
  });
  const recentPosts = posts.filter((post) => {
    if (channelFilter === 'Todos os canais') return true;
    if (channelFilter === 'Confirmação') return post.requiresReadConfirmation;
    return channelDefinitions.find((channel) => channel.name === channelFilter)?.matches(post) ?? true;
  });
  const pollResponses = posts.reduce((sum, post) => sum + post.pollResponses.length, 0);
  const featuredPost = posts.find((post) => post.isFeatured) ?? data?.charts?.mostAccessed?.[0] ?? null;

  return (
    <div className="space-y-6">
      
      {/* 1. Cabeçalho */}
      <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800/85 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-500 uppercase tracking-wider">
            <span>Comunicação</span>
            <span className="text-slate-400 dark:text-slate-650">/</span>
            <span className="text-slate-550 dark:text-slate-400">Meu Mural</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1 text-slate-900 dark:text-white font-sans">Comunicação Organizacional</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Comunicados, campanhas, mural, pesquisas, confirmações e chat corporativo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <>
              <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700 text-white font-semibold" onClick={() => setTab('criar')}>
                <Plus className="mr-1.5 h-4 w-4" />
                Novo comunicado
              </Button>
              <Button size="sm" variant="outline" className="h-9 gap-1.5 border-slate-200 bg-card hover:bg-muted" onClick={() => setTab('campanhas')}>
                <Plus className="h-4 w-4 text-sky-500" />
                Nova campanha
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-slate-200 bg-card hover:bg-muted" onClick={() => router.push('/pessoas')}>
            <Users className="h-4 w-4 text-slate-500" />
            Pessoas
          </Button>
          <Button variant="outline" size="sm" className="h-9 px-3 border-slate-200 bg-card hover:bg-muted" title="Métricas e relatórios" onClick={() => setTab('metricas')}>
            <SlidersHorizontal className="h-4 w-4 text-slate-600" />
          </Button>
        </div>
      </div>

      {/* 2. Barra de Filtros por Canal */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {CHANNELS.map((ch) => (
          <button
            key={ch.label}
            onClick={() => setChannelFilter(ch.filter)}
            className={cn(
              'h-8 px-3.5 rounded-full text-xs font-semibold border transition-all shrink-0',
              channelFilter === ch.filter
                ? 'bg-sky-500 border-sky-500 text-white shadow-sm'
                : 'bg-card border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-muted'
            )}
          >
            {ch.label}
          </button>
        ))}
      </div>

      {/* 3. Cards de Indicadores (KPIs) */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard title="Publicados no mês" value={countPublished} change="Publicações registradas no período" color="emerald" icon={Megaphone} />
        <KpiCard title="Rascunhos" value={countDrafts} change={`${data?.metrics?.pendingApproval ?? 0} aguardando aprovação`} color="purple" icon={FileText} />
        <KpiCard title="Taxa de leitura" value={`${(readRate * 100).toFixed(1)}%`} change={`${countReach} visualizações registradas`} color="emerald" icon={BookOpenCheck} />
        <KpiCard title="Confirmações pendentes" value={countPending} change="Pendências obrigatórias reais" color="amber" icon={ClipboardCheck} />
        <KpiCard title="Enquetes ativas" value={activePolls} change={`${pollResponses} respostas registradas`} color="purple" icon={Vote} />
        <KpiCard title="Comunicados críticos" value={countCritical} change="Publicações em prioridade crítica" color="rose" icon={AlertTriangle} />
        <KpiCard title="Mensagens internas" value={countMessages} change="Não lidas no chat" color="sky" icon={MessageCircle} />
        <KpiCard title="Visualizações" value={countReach.toLocaleString('pt-BR')} change="Leituras acumuladas" color="sky" icon={Users} />
        <KpiCard title="Entregas" value={countImpacted.toLocaleString('pt-BR')} change="Audiências das publicações" color="emerald" icon={Users} />
        <KpiCard title="Agendados" value={countScheduled} change="Programados para publicação" color="sky" icon={Clock} />
      </div>

      {/* 4. Faixa de Ações Rápidas */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
        <QuickActionBtn icon={Plus} title="Criar comunicado" onClick={() => onCreatePreset({})} />
        <QuickActionBtn icon={Megaphone} title="Agendar campanha" onClick={() => setTab('campanhas')} />
        <QuickActionBtn icon={SlidersHorizontal} title="Publicar no mural" onClick={() => onCreatePreset({ channels: { ...defaultForm.channels, digitalBoard: true } })} />
        <QuickActionBtn icon={ClipboardCheck} title="Enviar confirmação obrigatória" onClick={() => onCreatePreset({ isMandatory: true, requiresReadConfirmation: true, channels: { ...defaultForm.channels, mandatoryPopup: true } })} />
        <QuickActionBtn icon={Vote} title="Criar enquete" onClick={() => onCreatePreset({ type: 'POLL', requiresPollAnswer: true })} />
        <QuickActionBtn icon={MessageSquare} title="Mensagem para equipes" onClick={() => setTab('chat')} />
        <QuickActionBtn icon={FileText} title="Biblioteca de templates" onClick={() => onCreatePreset({})} />
      </div>

      {/* 5. Grid Principal (3 Colunas) */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Coluna Esquerda */}
        <div className="space-y-6">
          {/* Pendências obrigatórias */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[380px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <ClipboardCheck className="h-4 w-4 text-amber-500" />
                Pendências obrigatórias
                <span className="text-[10px] bg-red-100 dark:bg-red-950/40 text-red-650 dark:text-red-400 px-1.5 py-0.5 rounded-full font-bold">{countPending}</span>
              </h3>
            </div>
            <CardContent className="p-0 overflow-y-auto flex-1">
              {pendingStaff.length === 0 ? (
                <div className="flex h-full items-center justify-center p-8 text-center text-xs text-muted-foreground">Nenhum colaborador com confirmação obrigatória pendente.</div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-850/40">
                {pendingStaff.map((staff) => (
                  <div key={staff.id} className="flex items-center justify-between p-3 hover:bg-slate-50/40 dark:hover:bg-slate-900/40 transition-all">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-sky-500/10 text-[10px] font-bold text-sky-600">{staff.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-855 dark:text-slate-200 truncate">{staff.name}</div>
                        <div className="text-[10px] font-medium text-sky-500 truncate line-clamp-1 mt-0.5">{staff.pending} confirmação(ões) pendente(s)</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2 text-sky-500 border border-sky-100 hover:bg-sky-50/40 dark:border-sky-950/20 dark:hover:bg-sky-950/10 rounded-md" onClick={() => onMessageUser(staff.id)}>
                        Cobrar
                      </Button>
                    </div>
                  </div>
                ))}
                </div>
              )}
            </CardContent>
            <div className="border-t p-2 text-center shrink-0">
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-sky-500 font-semibold hover:text-sky-600" onClick={() => setTab('metricas')}>
                Ver todas as pendências →
              </Button>
            </div>
          </Card>

          {/* Segmentos / Públicos */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[280px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <Users className="h-4 w-4 text-sky-500" />
                Segmentos / Públicos
              </h3>
            </div>
            <CardContent className="p-3 flex-1 overflow-y-auto">
              <div className="space-y-2">
                {publicSegments.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">Sem dados de audiência por área.</div>}
                {publicSegments.map((segment) => (
                  <button type="button" key={segment.area} onClick={() => setTab('metricas')} className="flex w-full items-center justify-between text-xs py-1 hover:bg-slate-50/20 px-1.5 rounded transition-all">
                    <span className="font-medium text-slate-700 dark:text-slate-350">{segment.area}</span>
                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-650 dark:text-slate-450 border border-slate-200/30 dark:border-slate-700/30">
                      {segment.read}/{segment.delivered} · {(segment.readRate * 100).toFixed(0)}%
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
            <div className="border-t p-2 text-center shrink-0">
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-sky-500 font-semibold hover:text-sky-600" onClick={() => setTab('metricas')}>
                Ver todos os segmentos →
              </Button>
            </div>
          </Card>

          {/* Chat e interações */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[260px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <MessageCircle className="h-4 w-4 text-sky-500" />
                Chat e interações
              </h3>
            </div>
            <CardContent className="p-3 flex-1 flex flex-col justify-between">
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-600 dark:text-slate-400">Mensagens não lidas</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400">{unread}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-t pt-2 border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-600 dark:text-slate-400">Confirmações pendentes</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-955/40 text-amber-600 dark:text-amber-400">{countPending}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-t pt-2 border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-600 dark:text-slate-400">Conversas ativas</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">{conversationCount}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-t pt-2 border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-600 dark:text-slate-400">Bots e automações</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-955/40 text-sky-600 dark:text-sky-400">{(data?.automations ?? []).filter((rule) => rule.active).length}</span>
                </div>
              </div>
              <Button size="sm" className="w-full mt-3 h-8 bg-sky-500 hover:bg-sky-600 text-white font-semibold" onClick={() => setTab('chat')}>
                Abrir chat
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Central */}
        <div className="space-y-6 lg:col-span-1">
          {/* Comunicados recentes */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[380px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <Megaphone className="h-4 w-4 text-sky-500" />
                Comunicados recentes
              </h3>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-sky-500 hover:text-sky-600" onClick={() => setTab('central')}>Ver todos</Button>
            </div>
            <CardContent className="p-0 overflow-y-auto flex-1">
              {loading ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Carregando comunicados...</div>
              ) : recentPosts.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center h-full">
                  <Megaphone className="h-8 w-8 text-slate-350 dark:text-slate-700 mb-2" />
                  Nenhum comunicado recente publicado.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {recentPosts.slice(0, 5).map((post) => (
                    <div key={post.id} className="p-3 hover:bg-slate-50/40 dark:hover:bg-slate-900/40 transition-all cursor-pointer flex flex-col gap-1" onClick={() => onSelectPost(post.id)}>
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 border border-sky-500/20 uppercase tracking-wider">{post.category}</span>
                        <span className="text-[10px] text-slate-400">{formatDate(post.createdAt)}</span>
                      </div>
                      <div className="text-xs font-semibold text-slate-850 dark:text-slate-200 line-clamp-1">{post.title}</div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Público: {audienceLabel(post.audience.scope)}</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-450">Leitura: {post.readRate ? (post.readRate * 100).toFixed(0) : '0'}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <div className="border-t p-2 text-center shrink-0">
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-sky-500 font-semibold hover:text-sky-600" onClick={() => setTab('central')}>
                Ver todos os comunicados →
              </Button>
            </div>
          </Card>

          {/* Calendário de campanhas */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[560px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <Clock className="h-4 w-4 text-violet-500" />
                Calendário de campanhas
                <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1.5">{data?.campaigns?.length ?? 0} cadastrada(s)</span>
              </h3>
            </div>
            <CardContent className="p-4 flex-1 flex flex-col justify-between gap-3">
              
              <div className="flex-1 space-y-3 mt-3 overflow-y-auto pr-1">
                {(data?.campaigns ?? []).length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">Nenhuma campanha cadastrada.</div>
                ) : (data?.campaigns ?? []).map((campaign, index) => (
                  <button type="button" key={campaign.id} className="block w-full text-left" onClick={() => setTab('campanhas')}>
                    <CampaignItem
                      time={campaign.startsAt ? formatDate(campaign.startsAt) : 'Sem início'}
                      title={campaign.name}
                      color={(['purple', 'green', 'amber', 'blue'] as const)[index % 4]}
                      type={`${campaign.category} · ${campaign.status}`}
                    />
                  </button>
                ))}
              </div>

              <div className="border-t pt-3 text-center shrink-0">
                <Button variant="link" size="sm" className="h-auto p-0 text-xs text-sky-500 font-semibold hover:text-sky-600" onClick={() => setTab('campanhas')}>
                  Ver calendário completo →
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita */}
        <div className="space-y-6">
          {/* Engajamento */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[380px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <BarChart3 className="h-4 w-4 text-emerald-500" />
                Engajamento <span className="text-[10px] text-slate-400 dark:text-slate-500">(últimos 30 dias)</span>
              </h3>
            </div>
            <CardContent className="p-4 flex-1 flex flex-col justify-between gap-3 text-xs text-slate-850 dark:text-slate-200">
              {/* Sparkline 1: Leitura */}
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Leitura</div>
                  <div className="text-base font-extrabold text-slate-900 dark:text-white">{((data?.metrics?.readRate ?? 0) * 100).toFixed(1)}%</div>
                  <div className="text-[9px] text-emerald-600 font-bold">Sobre a audiência entregue</div>
                </div>
                <div className="w-28 h-8 shrink-0">
                  <svg className="w-full h-full" viewBox="0 0 100 40">
                    <path d="M 0,35 Q 20,20 40,25 T 80,10 L 100,8" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
                    <path d="M 0,35 Q 20,20 40,25 T 80,10 L 100,8 L 100,40 L 0,40 Z" fill="url(#sparkline-green-comm)" opacity="0.1" />
                    <defs>
                      <linearGradient id="sparkline-green-comm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>

              {/* Sparkline 2: Confirmação */}
              <div className="flex items-center justify-between gap-4 border-t pt-2">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Confirmação</div>
                  <div className="text-base font-extrabold text-slate-900 dark:text-white">{((data?.metrics?.confirmationRate ?? 0) * 100).toFixed(1)}%</div>
                  <div className="text-[9px] text-emerald-600 font-bold">Ciências obrigatórias confirmadas</div>
                </div>
                <div className="w-28 h-8 shrink-0">
                  <svg className="w-full h-full" viewBox="0 0 100 40">
                    <path d="M 0,30 Q 15,25 35,28 T 75,15 L 100,10" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
                    <path d="M 0,30 Q 15,25 35,28 T 75,15 L 100,10 L 100,40 L 0,40 Z" fill="url(#sparkline-blue-comm)" opacity="0.1" />
                    <defs>
                      <linearGradient id="sparkline-blue-comm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>

              {/* Sparkline 3: Respostas */}
              <div className="flex items-center justify-between gap-4 border-t pt-2">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Respostas (enquetes)</div>
                  <div className="text-base font-extrabold text-slate-900 dark:text-white">{pollResponses}</div>
                  <div className="text-[9px] text-emerald-600 font-bold">{((data?.metrics?.pollResponseRate ?? 0) * 100).toFixed(1)}% da audiência</div>
                </div>
                <div className="w-28 h-8 shrink-0">
                  <svg className="w-full h-full" viewBox="0 0 100 40">
                    <path d="M 0,35 Q 25,15 50,30 T 100,10" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
                    <path d="M 0,35 Q 25,15 50,30 T 100,10 L 100,40 L 0,40 Z" fill="url(#sparkline-purple-comm)" opacity="0.1" />
                    <defs>
                      <linearGradient id="sparkline-purple-comm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>

              {/* Sparkline 4: Alcance */}
              <div className="flex items-center justify-between gap-4 border-t pt-2">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Alcance</div>
                  <div className="text-base font-extrabold text-slate-900 dark:text-white">{countReach.toLocaleString('pt-BR')}</div>
                  <div className="text-[9px] text-emerald-600 font-bold">Visualizações registradas</div>
                </div>
                <div className="w-28 h-8 shrink-0">
                  <svg className="w-full h-full" viewBox="0 0 100 40">
                    <path d="M 0,20 Q 30,10 60,30 T 100,5" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" />
                    <path d="M 0,20 Q 30,10 60,30 T 100,5 L 100,40 L 0,40 Z" fill="url(#sparkline-sky-comm)" opacity="0.1" />
                    <defs>
                      <linearGradient id="sparkline-sky-comm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0ea5e9" />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Canais */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[280px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <SlidersHorizontal className="h-4 w-4 text-sky-500" />
                Canais
              </h3>
            </div>
            <CardContent className="p-3 flex-1 overflow-y-auto">
              <div className="space-y-2.5">
                {channelRates.map((channel) => (
                  <div key={channel.name} className="flex items-center justify-between text-xs py-0.5">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">{channel.name} <small>({channel.posts})</small></span>
                    <div className="flex items-center gap-2 w-1/2">
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-sky-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, channel.rate * 100)}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 shrink-0 w-8 text-right">{(channel.rate * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <div className="border-t p-2 text-center shrink-0">
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-sky-500 font-semibold hover:text-sky-655" onClick={() => setTab('metricas')}>
                Ver desempenho por canal →
              </Button>
            </div>
          </Card>

          {/* Destaques */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm overflow-hidden flex flex-col h-[260px]">
            <div className="h-[120px] bg-gradient-to-tr from-blue-600 via-indigo-650 to-sky-500 flex flex-col justify-end p-3 relative shrink-0">
              <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
              <div className="absolute top-2 right-2 bg-emerald-500/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wider">
                DESTAQUE
              </div>
              <div className="text-[10px] text-white/80 font-bold tracking-wider uppercase">{featuredPost?.category ?? 'Comunicação'}</div>
              <h4 className="text-sm font-extrabold text-white line-clamp-1 leading-snug">{featuredPost?.title ?? 'Nenhum destaque publicado'}</h4>
            </div>
            <CardContent className="p-3 flex-1 flex flex-col justify-between">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                {featuredPost ? featuredPost.content.replace(/<[^>]*>/g, ' ') : 'Marque um comunicado como destaque para exibi-lo neste espaço.'}
              </p>
              <div className="flex items-center justify-between border-t pt-2.5 mt-2">
                <span className="text-[9px] text-slate-400">{featuredPost ? `Publicado em: ${formatDate(featuredPost.publishedAt ?? featuredPost.createdAt)}` : 'Sem publicação'}</span>
                <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2 text-sky-500 border border-sky-100 hover:bg-sky-50/50 dark:border-sky-900/40" onClick={() => featuredPost && onSelectPost(featuredPost.id)} disabled={!featuredPost}>
                  Ver comunicado completo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* 6. Rodapé Operacional */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800/80 pt-4 mt-2 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-500" />
            <span>Fonte dos dados: <strong>API de comunicação organizacional</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-sky-500" />
            <span>Visualizações / entregas: <strong>{countReach.toLocaleString('pt-BR')} de {countImpacted.toLocaleString('pt-BR')}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-purple-400" />
            <span>Templates disponíveis: <strong>{data?.templates?.length ?? 0}</strong></span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-slate-650 dark:text-slate-400 hover:text-slate-900" onClick={() => setTab('metricas')}>
            <FileUp className="h-3.5 w-3.5" />
            Relatórios e dados
          </Button>
          <button type="button" onClick={() => router.push('/central-atendimento')} className="h-8 w-8 rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center cursor-pointer shadow-md transition-all hover:scale-105" title="Central de Atendimento">
            <HelpCircle className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

    </div>
  );
}
