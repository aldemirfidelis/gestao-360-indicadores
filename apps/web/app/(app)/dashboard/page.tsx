'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Plus,
  Target,
  Settings,
  Calendar,
  BarChart3,
  Network,
  Map,
  ClipboardCheck,
  Users,
  FileBarChart,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { StatusBadge } from '@/components/platform/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber, formatPercent, periodRefLabel } from '@/lib/utils';
import { ACTION_PRIORITY_LABEL } from '@/lib/labels';

interface Overview {
  totalIndicators: number;
  counts: { GREEN: number; YELLOW: number; RED: number; GRAY: number };
  generalAttainment: number | null;
  openActions: number;
  overdueActions: number;
  doneActions: number;
  criticalDeviations: number;
  openDeviations: number;
  pendingMeetings: number;
  dueSoonActions: Array<{
    id: string;
    title: string;
    dueDate: string | null;
    priority: string;
    responsibleUser: { id: string; name: string } | null;
  }>;
  sectorsWithDeviation: Array<{
    nodeId: string;
    nodeName: string;
    nodeType: string;
    deviations: number;
    indicatorCount: number;
    criticalIndicators: number;
    attentionIndicators: number;
  }>;
}

interface Pending {
  periodRef: string;
  total: number;
  filled: number;
  pending: number;
}

interface WorstRow {
  indicator: {
    id: string;
    name: string;
    code: string | null;
    ownerNode: { id: string; name: string };
  };
  periodRef: string;
  deviationPct: number | null;
  light: string;
}

const SHORTCUT_DEFS = [
  { id: 'indicators', href: '/indicators', label: 'Gestão de Indicadores', icon: Target },
  { id: 'actions', href: '/actions', label: 'Planos de ação', icon: ClipboardList },
  { id: 'reports', href: '/reports', label: 'Exportar relatório', icon: FileBarChart },
  { id: 'visualization', href: '/visualization', label: 'Dashboard Executivo', icon: BarChart3 },
  { id: 'org', href: '/org', label: 'Árvore Organizacional', icon: Network },
  { id: 'strategy', href: '/strategy', label: 'Mapa Estratégico', icon: Map },
  { id: 'aprovacoes', href: '/aprovacoes-cargo?tab=eficacia', label: 'Aprovações', icon: ClipboardCheck },
  { id: 'meetings', href: '/meetings', label: 'Reuniões', icon: Calendar },
  { id: 'deviations', href: '/deviations', label: 'Criar Análise de Causa', icon: AlertTriangle },
  { id: 'organograma', href: '/organograma', label: 'Organograma de Área', icon: Users },
];

export default function HomePage() {
  const overview = useQuery<Overview>({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => api<Overview>('/dashboard/overview'),
  });
  const pending = useQuery<Pending>({
    queryKey: ['dashboard', 'pending'],
    queryFn: () => api<Pending>('/dashboard/pending'),
  });
  const worst = useQuery<WorstRow[]>({
    queryKey: ['dashboard', 'worst'],
    queryFn: () => api<WorstRow[]>('/dashboard/worst?limit=12'),
  });

  const [selectedShortcuts, setSelectedShortcuts] = useState<string[]>([]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('g360-dashboard-shortcuts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const filtered = Array.isArray(parsed) ? parsed.filter((id) => id !== 'results') : ['indicators', 'actions', 'reports'];
        setSelectedShortcuts(filtered.length > 0 ? filtered : ['indicators', 'actions', 'reports']);
      } catch (e) {
        setSelectedShortcuts(['indicators', 'actions', 'reports']);
      }
    } else {
      setSelectedShortcuts(['indicators', 'actions', 'reports']);
    }
  }, []);

  const handleToggleShortcut = (id: string) => {
    setSelectedShortcuts((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSaveShortcuts = () => {
    localStorage.setItem('g360-dashboard-shortcuts', JSON.stringify(selectedShortcuts));
    setIsConfigOpen(false);
  };

  const ov = overview.data;

  return (
    <div>
      <PageHeader
        eyebrow="Início"
        title="Visão geral do Gestão 360"
        description="Resumo executivo, pendências operacionais e atalhos para lancar dados ou analisar desempenho."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Indicadores ativos"
          value={formatNumber(ov?.totalIndicators)}
          description={`${formatPercent(ov?.generalAttainment)} de atingimento`}
          icon={<Target className="h-4 w-4" />}
          tone="blue"
          href="/indicators"
        />
        <MetricCard
          title="Dentro da meta"
          value={formatNumber(ov?.counts.GREEN)}
          description="Farois verdes"
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="green"
          href="/visualization"
        />
        <MetricCard
          title="Críticos"
          value={formatNumber((ov?.counts.RED ?? 0) + (ov?.criticalDeviations ?? 0))}
          description="Indicadores e desvios"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="red"
          href="/visualization"
        />
        <MetricCard
          title="Pendências"
          value={formatNumber((pending.data?.pending ?? 0) + (ov?.overdueActions ?? 0))}
          description="Indicadores e ações"
          icon={<ClipboardList className="h-4 w-4" />}
          tone="yellow"
          href="/indicators"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Ações abertas"
          value={formatNumber(ov?.openActions)}
          description={`${formatNumber(ov?.doneActions)} concluídas`}
          icon={<ClipboardList className="h-4 w-4" />}
          tone="purple"
          href="/actions"
        />
        <MetricCard
          title="Ações atrasadas"
          value={formatNumber(ov?.overdueActions)}
          description="Prazos vencidos"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="red"
          href="/actions"
        />
        <MetricCard
          title="Desvios abertos"
          value={formatNumber(ov?.openDeviations)}
          description={`${formatNumber(ov?.criticalDeviations)} crítico(s)`}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="yellow"
          href="/deviations"
        />
        <MetricCard
          title="Reuniões pendentes"
          value={formatNumber(ov?.pendingMeetings)}
          description="Próximos 7 dias"
          icon={<CalendarClock className="h-4 w-4" />}
          tone="blue"
          href="/meetings"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,340px]">
        <SectionCard
          title="Atalhos rápidos"
          description="Acesso direto às rotinas mais usadas."
          actions={
            <Button variant="ghost" size="sm" onClick={() => setIsConfigOpen(true)}>
              <Settings className="mr-1.5 h-3.5 w-3.5" />
              Editar
            </Button>
          }
          contentClassName="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3"
        >
          {SHORTCUT_DEFS.filter((s) => selectedShortcuts.includes(s.id)).map((item) => {
            const Icon = item.icon;
            return (
              <Button key={item.id} variant="outline" className="h-10 justify-start gap-2 bg-background px-2 text-xs" asChild>
                <Link href={item.href}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              </Button>
            );
          })}
          <button
            type="button"
            onClick={() => setIsConfigOpen(true)}
            className={cn(
              'group flex h-10 items-center justify-center gap-2 rounded-md border border-dashed px-2 text-xs text-muted-foreground transition hover:border-primary hover:bg-primary/5 hover:text-primary',
              selectedShortcuts.length === 0 && 'col-span-2 sm:col-span-3',
            )}
          >
            <span className="grid h-7 w-7 place-items-center rounded-md bg-muted text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary">
              <Plus className="h-3.5 w-3.5" />
            </span>
            <span className="truncate font-medium">
              {selectedShortcuts.length === 0 ? 'Adicionar seu primeiro atalho' : 'Adicionar atalho'}
            </span>
          </button>
        </SectionCard>

        <SectionCard title="Alertas importantes" description="Histórico recente dos itens críticos." contentClassName="p-3">
          <div className="mb-3 rounded-lg border bg-muted/35 p-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Lançamentos pendentes</div>
                <div className="text-xs text-muted-foreground">
                  {pending.data ? periodRefLabel(pending.data.periodRef) : 'Período atual'}
                </div>
              </div>
              <div className="text-2xl font-semibold">{formatNumber(pending.data?.pending)}</div>
            </div>
          </div>
          <div className="max-h-[285px] space-y-2 overflow-y-auto pr-1">
            {worst.data?.map((w) => (
              <Link key={`${w.indicator.id}-${w.periodRef}`} href={`/indicators/${w.indicator.id}`} className="flex items-start justify-between gap-3 rounded-lg border p-2.5 transition-colors hover:bg-accent/35">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{w.indicator.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{w.indicator.ownerNode.name} - {periodRefLabel(w.periodRef)}</span>
                  </div>
                </div>
                <StatusBadge value={w.light} label={w.light === 'RED' ? 'Crítico' : w.light} />
              </Link>
            ))}
            {!worst.isLoading && (worst.data?.length ?? 0) === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                Nenhum alerta crítico no momento.
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Próximos vencimentos" description="Ações que precisam de acompanhamento na semana.">
          <div className="space-y-3">
            {ov?.dueSoonActions?.map((action) => (
              <Link key={action.id} href={`/actions/${action.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/35">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{action.title}</div>
                  <div className="text-xs text-muted-foreground">{action.responsibleUser?.name ?? 'Sem responsável'}</div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-medium">{formatDate(action.dueDate)}</div>
                  <StatusBadge value={action.priority} label={ACTION_PRIORITY_LABEL[action.priority] ?? action.priority} />
                </div>
              </Link>
            ))}
            {(!ov?.dueSoonActions || ov.dueSoonActions.length === 0) && (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                Nenhuma ação vencendo nos próximos dias.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Setores com mais desvios" description="Onde concentrar energia gerencial agora.">
          <div className="space-y-3">
            {ov?.sectorsWithDeviation?.map((sector) => (
              <Link key={sector.nodeId} href={`/indicators?ownerNodeId=${sector.nodeId}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/35">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-status-orange/10 text-status-orange">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{sector.nodeName}</div>
                    <div className="text-xs text-muted-foreground">
                      {sector.nodeType} · {formatNumber(sector.indicatorCount)} indicador(es) · {formatNumber(sector.criticalIndicators)} crítico(s)
                    </div>
                    {sector.attentionIndicators > 0 && (
                      <div className="mt-1 text-[11px] text-status-yellow">{formatNumber(sector.attentionIndicators)} em atenção</div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-semibold">{sector.deviations}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">desvios</div>
                </div>
              </Link>
            ))}
            {(!ov?.sectorsWithDeviation || ov.sectorsWithDeviation.length === 0) && (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                Nenhum desvio aberto por setor.
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Personalizar atalhos rápidos</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto py-2">
            {SHORTCUT_DEFS.map((shortcut) => {
              const Icon = shortcut.icon;
              const isSelected = selectedShortcuts.includes(shortcut.id);
              return (
                <button
                  key={shortcut.id}
                  type="button"
                  onClick={() => handleToggleShortcut(shortcut.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-accent/40',
                    isSelected ? 'border-primary bg-primary/5' : 'bg-card'
                  )}
                >
                  <span className={cn(
                    'grid h-8 w-8 place-items-center rounded-md',
                    isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  )}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{shortcut.label}</div>
                  </div>
                  <div className={cn(
                    'h-4 w-4 rounded border flex items-center justify-center shrink-0',
                    isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'
                  )}>
                    {isSelected && <span className="text-[10px]">✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsConfigOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveShortcuts}>Salvar atalhos</Button>
          </DialogFooter>
        </DialogContent>
    </Dialog>
  </div>
  );
}
