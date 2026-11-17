'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/auth-provider';
import { MetricCard } from '@/components/platform/metric-card';
import { SecondarySection } from '@/components/platform/secondary-section';
import { ChevronDown, Network } from 'lucide-react';
import { api } from '@/lib/api';

export function ProcessDashboard({ defaultCollapsed = false, standalone = false }: { defaultCollapsed?: boolean; standalone?: boolean }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const contentId = useId();
  const { hasPermission } = useAuth();
  const allowed = hasPermission(['processes:view']);
  const query = useQuery({ queryKey: ['process-governance-dashboard'], queryFn: () => api<{ total: number; withoutOwner: number; documented: number; pendingReview: number; overdueReview: number; activitiesWithoutOwner: number; outsideTarget: number; openDeviations: number; improvementProjects: number; attention: Array<{ id: string; name: string; reasons: string[] }> }>('/processes/governance/dashboard'), enabled: allowed, staleTime: 30_000 });
  if (!allowed || query.isLoading) return null;
  if (query.isError) return <p className="text-xs text-muted-foreground">Resumo de processos indisponível para o acesso atual.</p>;
  if (!query.data) return null;
  const data = query.data;
  if (data.total === 0) return <p className="p-4 text-sm text-muted-foreground">A governança ficará disponível quando houver processos cadastrados.</p>;
  const items = [
    ['Com versão publicada', data.documented],
    ['Artefatos em revisão', data.pendingReview],
    ['Revisões vencidas', data.overdueReview],
    ['Sem proprietário', data.withoutOwner],
  ] as const;
  const details = [
    ['Atividades sem responsável', data.activitiesWithoutOwner],
    ['Com indicador fora da meta', data.outsideTarget],
    ['Com desvio em aberto', data.openDeviations],
  ] as const;
  const attention = data.attention.map((item) => ({ ...item, reasons: item.reasons.filter((reason) => reason !== 'Projeto de melhoria') })).filter((item) => item.reasons.length > 0);
  return (
    <section className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="min-w-0 font-semibold">
          {standalone ? 'Governança de processos' : <button
            type="button"
            className="flex items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`${collapsed ? 'Expandir' : 'Recolher'} Governança de processos`}
            aria-expanded={!collapsed}
            aria-controls={contentId}
            onClick={() => setCollapsed((value) => !value)}
          >
            <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${collapsed ? '-rotate-90' : ''}`} />
            Governança de processos
          </button>}
        </h2>
        {!standalone && <Link className="text-sm text-primary hover:underline" href="/processes">Abrir processos</Link>}
      </div>
      <div id={contentId} hidden={!standalone && collapsed} className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {items.map(([label, value]) => <MetricCard key={label} compact title={label} value={value} tone="blue" icon={<Network className="h-4 w-4" />} />)}
        </div>
        <SecondarySection title="Outros dados de governança">
          <dl className="grid gap-3 sm:grid-cols-3">
            {details.map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-semibold tabular-nums">{value}</dd></div>)}
          </dl>
        </SecondarySection>
        {attention.length > 0 && (
          <div>
            <h3 className="text-sm font-medium">Processos que precisam de atenção</h3>
            <div className="mt-2 max-h-64 divide-y overflow-y-auto">
              {attention.map((item) => (
                <Link key={item.id} href={`/processes/${item.id}`} className="block py-2 text-sm hover:underline">
                  <span className="text-primary">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">{item.reasons.join(' · ')}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
