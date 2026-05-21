'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusLight } from '@/components/ui/status-light';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatNumber, formatPercent, periodRefLabel } from '@/lib/utils';

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

const UNIT_SYMBOL: Record<string, string> = {
  PERCENT: '%',
  CURRENCY: 'R$',
  HOURS: 'h',
  DAYS: 'd',
  TONS: 't',
  LITERS: 'l',
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

  const items = query.data ?? [];

  return (
    <div>
      <PageHeader
        title="Indicadores"
        description="Catalogo de KPIs corporativos com metas, realizado e status atual."
        actions={
          <Link href="/indicators/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo indicador
            </Button>
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou codigo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(['GREEN', 'YELLOW', 'RED', 'GRAY'] as const).map((l) => (
              <Button
                key={l}
                variant={light === l ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLight(light === l ? null : l)}
              >
                <StatusLight light={l} />
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {query.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      <div className="grid gap-3">
        {items.map((ind) => (
          <Link key={ind.id} href={`/indicators/${ind.id}`}>
            <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{ind.name}</h3>
                    {ind.code && <Badge variant="outline">{ind.code}</Badge>}
                    <Badge variant="secondary">{TYPE_LABEL[ind.type] ?? ind.type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ind.ownerNode.name} - {ind.responsibleUser?.name ?? 'Sem responsavel'} - {ind.periodicity}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-6 text-right">
                  <div>
                    <div className="text-[11px] uppercase text-muted-foreground">Realizado</div>
                    <div className="font-semibold">
                      {ind.last ? formatNumber(ind.last.value) : '—'}
                      <span className="text-xs text-muted-foreground ml-1">
                        {ind.unitLabel ?? UNIT_SYMBOL[ind.unit] ?? ''}
                      </span>
                    </div>
                    {ind.last && (
                      <div className="text-[11px] text-muted-foreground">{periodRefLabel(ind.last.periodRef)}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-[11px] uppercase text-muted-foreground">Atingim.</div>
                    <div className="font-semibold">{formatPercent(ind.last?.attainment ?? null)}</div>
                    {ind.last?.deviationPct !== null && ind.last?.deviationPct !== undefined && (
                      <div className="text-[11px] text-muted-foreground">
                        {ind.last.deviationPct > 0 ? '+' : ''}
                        {formatNumber(ind.last.deviationPct, { maximumFractionDigits: 1 })}%
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end justify-center">
                    <StatusLight light={ind.last?.light ?? 'GRAY'} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!query.isLoading && items.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhum indicador encontrado. Ajuste os filtros ou cadastre um novo.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
