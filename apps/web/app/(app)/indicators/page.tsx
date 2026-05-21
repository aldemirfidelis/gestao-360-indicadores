'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Filter, Plus, Search, Target, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { FilterBar } from '@/components/platform/filter-bar';
import { EmptyState } from '@/components/platform/empty-state';
import { LoadingState } from '@/components/platform/loading-state';
import { IndicatorCard, type IndicatorCardData } from '@/components/platform/indicator-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusLight } from '@/components/ui/status-light';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

interface IndicatorRow {
  id: string;
  name: string;
  code: string | null;
  type: string;
  periodicity: string;
  unit: string;
  unitLabel: string | null;
  status: string;
  ownerNode: { id: string; name: string; type: string };
  responsibleUser: { id: string; name: string } | null;
  last: {
    periodRef: string;
    value: number;
    light: string;
    attainment: number | null;
    deviationPct: number | null;
  } | null;
}

const TYPE_LABEL: Record<string, string> = {
  STRATEGIC: 'Estrategico',
  TACTICAL: 'Tatico',
  OPERATIONAL: 'Operacional',
  PROJECT: 'Projeto',
  PROCESS: 'Processo',
  SAFETY: 'Seguranca',
  QUALITY: 'Qualidade',
  HR: 'RH',
  FINANCE: 'Financeiro',
  PRODUCTION: 'Producao',
  MAINTENANCE: 'Manutencao',
  PROCUREMENT: 'Suprimentos',
  COMMERCIAL: 'Comercial',
  CUSTOM: 'Personalizado',
};

export default function IndicatorsPage() {
  const [search, setSearch] = useState('');
  const [light, setLight] = useState<string | null>(null);

  const query = useQuery<IndicatorRow[]>({
    queryKey: ['indicators', search, light],
    queryFn: () =>
      api<IndicatorRow[]>(
        `/indicators${search || light ? `?${[search && `search=${encodeURIComponent(search)}`, light && `light=${light}`].filter(Boolean).join('&')}` : ''}`,
      ),
  });

  const items = useMemo<IndicatorCardData[]>(
    () =>
      (query.data ?? []).map((ind) => ({
        ...ind,
        type: TYPE_LABEL[ind.type] ?? ind.type,
      })),
    [query.data],
  );
  const green = items.filter((i) => i.last?.light === 'GREEN').length;
  const red = items.filter((i) => i.last?.light === 'RED').length;
  const gray = items.filter((i) => !i.last || i.last.light === 'GRAY').length;
  const withoutOwner = items.filter((i) => !i.responsibleUser).length;

  return (
    <div>
      <PageHeader
        eyebrow="Visualizacao"
        tone="view"
        title="Dashboard de indicadores"
        description="Catalogo analitico com farol de desempenho, responsaveis, areas, ultimo realizado e historico."
        breadcrumbs={[{ label: 'Inicio', href: '/' }, { label: 'Visualizacao', href: '/visualization' }, { label: 'Indicadores' }]}
        actions={
          <Button asChild>
            <Link href="/indicators/new">
              <Plus className="mr-2 h-4 w-4" />
              Novo indicador
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total de indicadores" value={formatNumber(items.length)} description="Ativos no catalogo" icon={<Target className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Dentro da meta" value={formatNumber(green)} description="Farol verde" icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
        <MetricCard title="Fora da meta" value={formatNumber(red)} description={`${formatNumber(gray)} sem lancamento`} icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <MetricCard title="Sem responsavel" value={formatNumber(withoutOwner)} description="Revisar governanca" icon={<UserRound className="h-4 w-4" />} tone="yellow" />
      </div>

      <FilterBar
        actions={
          <Button variant="outline" size="sm" onClick={() => { setSearch(''); setLight(null); }}>
            Limpar filtros
          </Button>
        }
      >
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, codigo, area ou responsavel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {(['GREEN', 'YELLOW', 'RED', 'GRAY'] as const).map((l) => (
            <Button
              key={l}
              variant={light === l ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLight(light === l ? null : l)}
              aria-label={`Filtrar ${l}`}
            >
              <StatusLight light={l} />
            </Button>
          ))}
        </div>
      </FilterBar>

      {query.isLoading && <LoadingState />}

      {!query.isLoading && items.length === 0 && (
        <EmptyState
          title="Nenhum indicador encontrado"
          description="Ajuste os filtros ou cadastre um novo indicador."
          action={
            <Button asChild>
              <Link href="/indicators/new">Cadastrar indicador</Link>
            </Button>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {items.map((ind) => (
          <IndicatorCard key={ind.id} indicator={ind} />
        ))}
      </div>
    </div>
  );
}
