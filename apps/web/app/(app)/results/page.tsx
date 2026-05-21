'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusLight } from '@/components/ui/status-light';
import { api } from '@/lib/api';
import { cn, periodRefLabel } from '@/lib/utils';

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
  const query = useQuery<PendingRow[]>({
    queryKey: ['results', 'pending'],
    queryFn: () => api<PendingRow[]>('/results/pending?points=6'),
  });

  // local state: indicatorId -> periodRef -> string
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});

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

  const pendingCount = Object.values(edits).reduce(
    (acc, m) => acc + Object.values(m).filter((v) => v.trim() !== '').length,
    0,
  );

  return (
    <div>
      <PageHeader
        title="Lancamentos"
        description="Insira valores realizados por periodo. O farol e o desvio sao calculados automaticamente."
        actions={
          <Button onClick={handleSave} disabled={upsert.isPending || pendingCount === 0}>
            <Save className="h-4 w-4 mr-2" />
            {upsert.isPending ? 'Salvando...' : `Salvar (${pendingCount})`}
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left sticky left-0 bg-muted/50 z-10 min-w-[260px]">Indicador</th>
                {allPeriods.map((p) => (
                  <th key={p} className="px-3 py-3 text-center min-w-[120px]">
                    {periodRefLabel(p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data?.map((row) => (
                <tr key={row.indicator.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 sticky left-0 bg-background z-10">
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
                      <td key={p} className="px-2 py-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Input
                            value={display}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [row.indicator.id]: { ...prev[row.indicator.id], [p]: e.target.value },
                              }))
                            }
                            placeholder={cell?.target !== null ? String(cell?.target) : '—'}
                            className={cn(
                              'h-8 w-24 text-center text-sm',
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
          {query.isLoading && <p className="p-6 text-sm text-muted-foreground">Carregando...</p>}
          {!query.isLoading && (query.data?.length ?? 0) === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">
              Nenhum indicador ativo para lancamento no momento.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
