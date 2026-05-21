'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, CheckCircle2, RotateCcw, Save, Target } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { EmptyState } from '@/components/platform/empty-state';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusLight } from '@/components/ui/status-light';
import { api } from '@/lib/api';
import { cn, formatNumber, periodRefLabel } from '@/lib/utils';

interface PendingRow {
  indicator: {
    id: string;
    name: string;
    code: string | null;
    unit: string;
    unitLabel: string | null;
    periodicity: string;
    direction: string;
    ownerNode: { id: string; name: string };
  };
  cells: {
    periodRef: string;
    target: number | null;
    value: number | null;
    status: string;
    light: string;
  }[];
}

interface UpsertOutcome {
  result: { id: string };
  shouldOpenDeviation: boolean;
}

export default function ResultsPage() {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});

  const query = useQuery<PendingRow[]>({
    queryKey: ['results', 'pending'],
    queryFn: () => api<PendingRow[]>('/results/pending?points=6'),
  });

  const allPeriods = useMemo(() => {
    const set = new Set<string>();
    query.data?.forEach((r) => r.cells.forEach((c) => set.add(c.periodRef)));
    return Array.from(set);
  }, [query.data]);

  const upsert = useMutation({
    mutationFn: (items: { indicatorId: string; periodRef: string; value: number }[]) =>
      api<{ count: number; results: UpsertOutcome[] }>('/results/batch', {
        method: 'POST',
        json: { items },
      }),
    onSuccess: (out) => {
      const reds = out.results.filter((r) => r.shouldOpenDeviation).length;
      toast.success(`${out.count} lancamentos salvos${reds ? ` - ${reds} indicador(es) em vermelho` : ''}`);
      setEdits({});
      qc.invalidateQueries({ queryKey: ['results', 'pending'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar'),
  });

  const pendingCount = Object.values(edits).reduce(
    (acc, m) => acc + Object.values(m).filter((v) => v.trim() !== '').length,
    0,
  );
  const totalCells = query.data?.reduce((acc, r) => acc + r.cells.length, 0) ?? 0;
  const filledCells =
    query.data?.reduce((acc, r) => acc + r.cells.filter((c) => c.value !== null && c.value !== undefined).length, 0) ?? 0;
  const missingCells = Math.max(0, totalCells - filledCells);

  const handleSave = () => {
    const items: { indicatorId: string; periodRef: string; value: number }[] = [];
    for (const [indicatorId, byRef] of Object.entries(edits)) {
      for (const [periodRef, raw] of Object.entries(byRef)) {
        const trimmed = raw.trim().replace(',', '.');
        if (trimmed === '') continue;
        const num = Number(trimmed);
        if (!Number.isFinite(num)) continue;
        items.push({ indicatorId, periodRef, value: num });
      }
    }
    if (items.length === 0) {
      toast.message('Nada para salvar.');
      return;
    }
    upsert.mutate(items);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Lancamentos"
        tone="launch"
        title="Lancamento de resultados"
        description="Registro de realizado por indicador e periodo, com farol e desvio calculados automaticamente."
        breadcrumbs={[{ label: 'Inicio', href: '/' }, { label: 'Lancamentos', href: '/launches' }, { label: 'Resultados' }]}
        actions={
          <>
            <Button variant="outline" onClick={() => setEdits({})} disabled={pendingCount === 0}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Limpar
            </Button>
            <Button onClick={handleSave} disabled={upsert.isPending || pendingCount === 0}>
              <Save className="mr-2 h-4 w-4" />
              {upsert.isPending ? 'Salvando...' : `Salvar (${pendingCount})`}
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Indicadores"
          value={formatNumber(query.data?.length)}
          description="Disponiveis para lancamento"
          icon={<Target className="h-4 w-4" />}
          tone="blue"
        />
        <MetricCard
          title="Periodos"
          value={formatNumber(allPeriods.length)}
          description={allPeriods[0] ? `${periodRefLabel(allPeriods[0])} em diante` : 'Sem periodo'}
          icon={<CalendarClock className="h-4 w-4" />}
          tone="purple"
        />
        <MetricCard
          title="Preenchidos"
          value={formatNumber(filledCells)}
          description={`${formatNumber(totalCells)} celulas previstas`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="green"
        />
        <MetricCard
          title="Pendentes"
          value={formatNumber(missingCells)}
          description={`${formatNumber(pendingCount)} alteracoes locais`}
          icon={<Save className="h-4 w-4" />}
          tone="yellow"
        />
      </div>

      <SectionCard title="Grade de lancamento" description="Digite os valores realizados e salve em lote." contentClassName="p-0">
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[280px] bg-muted/70 text-left">Indicador</th>
                {allPeriods.map((p) => (
                  <th key={p} className="min-w-[128px] text-center">
                    {periodRefLabel(p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data?.map((row) => (
                <tr key={row.indicator.id}>
                  <td className="sticky left-0 z-10 bg-card">
                    <div className="font-medium">{row.indicator.name}</div>
                    <div className="text-xs text-muted-foreground">{row.indicator.ownerNode.name}</div>
                  </td>
                  {allPeriods.map((p) => {
                    const cell = row.cells.find((c) => c.periodRef === p);
                    const editVal = edits[row.indicator.id]?.[p] ?? '';
                    const display =
                      editVal !== ''
                        ? editVal
                        : cell?.value !== null && cell?.value !== undefined
                          ? String(cell.value)
                          : '';
                    return (
                      <td key={p} className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Input
                            value={display}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [row.indicator.id]: { ...prev[row.indicator.id], [p]: e.target.value },
                              }))
                            }
                            placeholder={cell?.target !== null && cell?.target !== undefined ? String(cell.target) : '-'}
                            className={cn(
                              'h-9 w-24 text-center text-sm',
                              cell?.light === 'RED' && 'border-status-red/60',
                              cell?.light === 'YELLOW' && 'border-status-yellow/60',
                              cell?.light === 'GREEN' && 'border-status-green/60',
                            )}
                          />
                          {cell?.light && cell.light !== 'GRAY' && <StatusLight light={cell.light} />}
                          {cell?.target !== null && cell?.target !== undefined && (
                            <span className="text-[10px] text-muted-foreground">meta: {cell.target}</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {query.isLoading && <LoadingState className="m-4" />}
          {!query.isLoading && (query.data?.length ?? 0) === 0 && (
            <div className="p-4">
              <EmptyState title="Nenhum indicador ativo" description="Cadastre indicadores antes de registrar resultados." />
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
