'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusLight } from '@/components/ui/status-light';
import { EmptyState } from '@/components/platform/empty-state';
import { LoadingState } from '@/components/platform/loading-state';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn, formatNumber, periodRefLabel } from '@/lib/utils';

interface PendingCell {
  periodRef: string;
  target: number | null;
  value: number | null;
  status: string;
  light: string;
}

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
  cells: PendingCell[];
}

interface UpsertOutcome {
  result: { id: string; indicatorId: string; periodRef: string };
  shouldOpenDeviation: boolean;
  treatment?: { id: string; status: string } | null;
}

const periodicityLabels: Record<string, string> = {
  DAILY: 'Diario',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
};

interface IndicatorResultEditorProps {
  indicatorId: string;
  fallbackName?: string;
  unitLabel?: string | null;
  invalidateKeys?: (string | number)[][];
}

export function IndicatorResultEditor({
  indicatorId,
  fallbackName,
  unitLabel,
  invalidateKeys = [],
}: IndicatorResultEditorProps) {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [offTargetOpen, setOffTargetOpen] = useState(false);
  const [offTargets, setOffTargets] = useState<UpsertOutcome[]>([]);
  const [ignoreReason, setIgnoreReason] = useState('');

  const query = useQuery<PendingRow[]>({
    queryKey: ['results', 'pending', 'indicator', indicatorId],
    enabled: Boolean(indicatorId),
    queryFn: () => api<PendingRow[]>(`/results/pending?indicatorId=${indicatorId}`),
  });

  const row = query.data?.[0] ?? null;
  const cells = row?.cells ?? [];

  const stats = useMemo(() => {
    const filled = cells.filter((c) => {
      const local = (edits[c.periodRef] ?? '').trim() !== '';
      return local || (c.value !== null && c.value !== undefined);
    }).length;
    const edited = Object.values(edits).filter((v) => v.trim() !== '').length;
    const pending = Math.max(0, cells.length - filled);
    return { filled, edited, pending };
  }, [cells, edits]);

  const upsert = useMutation({
    mutationFn: (items: { indicatorId: string; periodRef: string; value: number }[]) =>
      api<{ count: number; results: UpsertOutcome[] }>('/results/batch', {
        method: 'POST',
        json: { items },
      }),
    onSuccess: (out) => {
      const reds = out.results.filter((r) => r.shouldOpenDeviation).length;
      toast.success(`${out.count} lancamentos salvos${reds ? ` - ${reds} indicador(es) em vermelho` : ''}`);
      const treatments = out.results.filter((r) => r.shouldOpenDeviation && r.treatment);
      setOffTargets(treatments);
      setOffTargetOpen(treatments.length > 0);
      setEdits({});
      qc.invalidateQueries({ queryKey: ['results', 'pending', 'indicator', indicatorId] });
      qc.invalidateQueries({ queryKey: ['results', 'pending'] });
      qc.invalidateQueries({ queryKey: ['indicators'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      for (const key of invalidateKeys) qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar'),
  });

  const ignoreTreatment = useMutation({
    mutationFn: (treatmentId: string) =>
      api(`/treatments/${treatmentId}/ignore`, {
        method: 'POST',
        json: { reason: ignoreReason || 'Ignorado temporariamente no lancamento de resultado.' },
      }),
    onSuccess: () => {
      toast.success('Tratativa ignorada temporariamente');
      setIgnoreReason('');
      setOffTargetOpen(false);
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const handleSave = () => {
    const items: { indicatorId: string; periodRef: string; value: number }[] = [];
    for (const [periodRef, raw] of Object.entries(edits)) {
      const trimmed = raw.trim().replace(',', '.');
      if (trimmed === '') continue;
      const num = Number(trimmed);
      if (!Number.isFinite(num)) continue;
      items.push({ indicatorId, periodRef, value: num });
    }
    if (items.length === 0) {
      toast.message('Nada para salvar.');
      return;
    }
    upsert.mutate(items);
  };

  const name = row?.indicator.name ?? fallbackName ?? 'Indicador';
  const unit = row?.indicator.unitLabel ?? unitLabel ?? row?.indicator.unit ?? '';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Indicador</div>
          <h3 className="mt-1 truncate text-base font-semibold">{name}</h3>
          {row && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{row.indicator.code ?? 'Sem codigo'}</span>
              <span>{periodicityLabels[row.indicator.periodicity] ?? row.indicator.periodicity}</span>
              <span>{unit}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-status-green/15 px-2.5 py-1 font-medium text-status-green">
            {formatNumber(stats.filled)} preenchidos
          </span>
          <span className="rounded-full bg-status-yellow/15 px-2.5 py-1 font-medium text-status-yellow">
            {formatNumber(stats.pending)} pendentes
          </span>
          <span className="rounded-full bg-status-blue/15 px-2.5 py-1 font-medium text-status-blue">
            {formatNumber(stats.edited)} edicoes
          </span>
        </div>
      </div>

      {query.isLoading && <LoadingState className="min-h-56" />}
      {!query.isLoading && cells.length === 0 && (
        <EmptyState
          title="Sem periodos disponiveis"
          description="O indicador esta inativo ou ainda nao possui periodos cadastrados para o ano atual."
        />
      )}
      {!query.isLoading && cells.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="table-modern min-w-[640px]">
            <thead>
              <tr>
                <th className="text-left">Mes/periodo</th>
                <th className="text-left">Realizado</th>
                <th className="text-left">Meta</th>
                <th className="text-center">Farol</th>
              </tr>
            </thead>
            <tbody>
              {cells.map((cell) => {
                const editVal = edits[cell.periodRef] ?? '';
                const display =
                  editVal !== ''
                    ? editVal
                    : cell.value !== null && cell.value !== undefined
                      ? String(cell.value)
                      : '';
                return (
                  <tr key={cell.periodRef}>
                    <td>
                      <div className="font-medium">{periodRefLabel(cell.periodRef)}</div>
                      <div className="text-xs text-muted-foreground">{cell.periodRef}</div>
                    </td>
                    <td>
                      <Input
                        value={display}
                        onChange={(e) =>
                          setEdits((prev) => ({ ...prev, [cell.periodRef]: e.target.value }))
                        }
                        placeholder={
                          cell.target !== null && cell.target !== undefined ? String(cell.target) : '-'
                        }
                        className={cn(
                          'h-9 w-full max-w-[180px] text-sm',
                          cell.light === 'RED' && 'border-status-red/60',
                          cell.light === 'YELLOW' && 'border-status-yellow/60',
                          cell.light === 'GREEN' && 'border-status-green/60',
                        )}
                      />
                    </td>
                    <td>
                      <div className="text-sm font-medium">
                        {cell.target !== null && cell.target !== undefined ? formatNumber(cell.target) : '-'}
                      </div>
                    </td>
                    <td className="text-center">
                      {cell.light && cell.light !== 'GRAY' ? (
                        <StatusLight light={cell.light} />
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem farol</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={() => setEdits({})} disabled={stats.edited === 0}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Limpar
        </Button>
        <Button onClick={handleSave} disabled={upsert.isPending || stats.edited === 0}>
          <Save className="mr-2 h-4 w-4" />
          {upsert.isPending ? 'Salvando...' : `Salvar (${stats.edited})`}
        </Button>
      </div>

      <Dialog open={offTargetOpen} onOpenChange={setOffTargetOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Indicador fora da meta detectado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-status-red/30 bg-status-red/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-status-red" />
                <div>
                  <div className="font-semibold">
                    Este indicador esta fora da meta. Deseja iniciar o tratamento?
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    O sistema ja registrou a rastreabilidade inicial. Voce pode criar analise de causa,
                    agendar reuniao, criar plano de acao ou ignorar temporariamente com justificativa.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {offTargets.map((item) => (
                <div
                  key={item.treatment?.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium">{name}</div>
                    <div className="text-xs text-muted-foreground">
                      Periodo {periodRefLabel(item.result.periodRef)} - status {item.treatment?.status}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild>
                      <Link href={`/treatments/${item.treatment?.id}`}>Iniciar tratamento</Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href={`/indicators/${item.result.indicatorId}`}>Ver historico</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Ignorar temporariamente com justificativa</div>
              <Textarea
                rows={3}
                value={ignoreReason}
                onChange={(e) => setIgnoreReason(e.target.value)}
                placeholder="Explique por que esta tratativa sera adiada..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOffTargetOpen(false)}>
              Fechar
            </Button>
            <Button
              variant="destructive"
              disabled={offTargets.length === 0 || ignoreTreatment.isPending || !ignoreReason.trim()}
              onClick={() => offTargets[0]?.treatment?.id && ignoreTreatment.mutate(offTargets[0].treatment.id)}
            >
              Ignorar com justificativa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
