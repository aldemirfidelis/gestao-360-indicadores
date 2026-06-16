'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, Boxes, FileText, Flag, Plug, RefreshCcw, ScrollText, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import type { PortalOverview } from '@/components/portal-admin/types';

export function OverviewTab() {
  const q = useQuery<PortalOverview>({ queryKey: ['portal', 'overview'], queryFn: () => api('/admin/portal/overview'), refetchOnWindowFocus: false });
  const d = q.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Status geral e atividade administrativa do portal.</p>
        <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCcw className={cn('mr-2 h-4 w-4', q.isFetching && 'animate-spin')} /> Atualizar
        </Button>
      </div>

      {q.isLoading && <LoadingState label="Lendo configuração do portal..." />}

      {d && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Status do portal" value={d.portalStatus} description={`${d.activeMaintenance} manutenção(ões) ativa(s)`} icon={<Activity className="h-4 w-4" />} tone={d.portalStatus === 'OPERACIONAL' ? 'green' : 'yellow'} />
            <MetricCard title="Módulos" value={formatNumber(d.modules.total)} description={`${d.modules.active} ativos · ${d.modules.maintenance} em manutenção`} icon={<Boxes className="h-4 w-4" />} tone="blue" />
            <MetricCard title="Feature flags" value={formatNumber(d.flags.total)} description={`${d.flags.enabled} habilitada(s)`} icon={<Flag className="h-4 w-4" />} tone="purple" />
            <MetricCard title="Acessos negados (7d)" value={formatNumber(d.deniedAttempts)} description="Tentativas indevidas" icon={<ShieldAlert className="h-4 w-4" />} tone={d.deniedAttempts > 0 ? 'red' : 'green'} />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <Tile icon={<FileText className="h-4 w-4" />} label="Páginas" value={d.pages.total} sub={`${d.pages.blocked} bloqueadas`} />
            <Tile icon={<Boxes className="h-4 w-4" />} label="Funcionalidades" value={d.features.total} sub={`${d.features.restricted} restritas`} />
            <Tile icon={<Plug className="h-4 w-4" />} label="Integrações" value={d.integrations.total} sub={`${d.integrations.failing} c/ falha`} />
            <Tile icon={<Users className="h-4 w-4" />} label="Perfis" value={d.roles} sub={`${d.superAdmins} super admin`} />
            <Tile icon={<ScrollText className="h-4 w-4" />} label="Mudanças (7d)" value={d.recentChanges} sub={`${d.scheduledChanges} programadas`} />
            <Tile icon={<ShieldCheck className="h-4 w-4" />} label="Avisos ativos" value={d.activeAnnouncements} sub={d.lastSnapshot ? 'Cópia ✓' : 'Sem cópia'} />
          </div>

          <SectionCard title="Últimas ações administrativas" description="Registro recente da central." contentClassName="p-0">
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr><th className="text-left">Quando</th><th className="text-left">Usuário</th><th className="text-left">Aba</th><th className="text-left">Ação</th><th className="text-left">Alvo</th><th className="text-left">Resultado</th></tr>
                </thead>
                <tbody>
                  {d.recentActions.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-sm text-muted-foreground">Nenhuma ação registrada.</td></tr>
                  ) : d.recentActions.map((a) => (
                    <tr key={a.id}>
                      <td className="text-xs">{formatDate(a.createdAt)}</td>
                      <td className="text-xs">{a.userEmail ?? '-'}</td>
                      <td className="text-xs">{a.tab}</td>
                      <td><span className="font-mono text-xs">{a.action}</span></td>
                      <td className="text-xs">{a.targetCode ?? '-'}</td>
                      <td><span className={cn('pill', a.result === 'SUCCESS' ? 'pill-green' : a.result === 'DENIED' ? 'pill-yellow' : 'pill-red')}>{a.result}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {d.modules.critical > 0 && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />
              {d.modules.critical} módulo(s) crítico(s) com proteção adicional contra bloqueio acidental.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Tile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <div className="panel flex items-center gap-3 p-3">
      <div className="grid h-9 w-9 place-items-center rounded-md bg-muted text-primary">{icon}</div>
      <div className="min-w-0">
        <div className="text-lg font-semibold leading-tight">{formatNumber(value)}</div>
        <div className="truncate text-[11px] text-muted-foreground">{label}{sub ? ` · ${sub}` : ''}</div>
      </div>
    </div>
  );
}
