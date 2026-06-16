'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Circle, Download, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MetricCard } from '@/components/platform/metric-card';
import { EmptyState } from '@/components/platform/empty-state';
import { api } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import { downloadCsv, formatTime } from '@/lib/asset-security/format';
import type { EmergencyReport } from '@/lib/asset-security/types';

/**
 * Painel de emergência/evacuação: lista viva de pessoas/veículos presentes para
 * chamada (roll-call). A marcação de "localizado" é local ao evento de evacuação
 * (não há persistência por pessoa no backend) e pode ser exportada como ata.
 */
export function EmergencyPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [located, setLocated] = useState<Set<string>>(new Set());
  const [meetingPoint, setMeetingPoint] = useState('');

  const report = useQuery<EmergencyReport>({
    queryKey: ['asset-security', 'emergency-report'],
    queryFn: () => api('/asset-security/emergency-report?take=500'),
    enabled: open,
    refetchInterval: open ? 30_000 : false,
  });

  const people = report.data?.people ?? [];
  const accountedFor = useMemo(() => people.filter((p) => located.has(p.id)).length, [people, located]);
  const pct = people.length ? Math.round((accountedFor / people.length) * 100) : 0;

  function toggle(id: string) {
    setLocated((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportRollCall() {
    downloadCsv(`evacuacao-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.csv`, [
      ['Ponto de encontro', meetingPoint || '—'],
      ['Gerado em', new Date().toLocaleString('pt-BR')],
      ['Localizados', `${accountedFor}/${people.length}`],
      [],
      ['Código', 'Pessoa', 'Placa', 'Portaria', 'Entrada', 'Localizado'],
      ...people.map((p) => [
        p.code ?? '',
        p.person?.name ?? '',
        p.plate ?? p.vehicle?.plate ?? '',
        p.gate?.name ?? '',
        p.entryAt ? new Date(p.entryAt).toLocaleString('pt-BR') : '',
        located.has(p.id) ? 'SIM' : 'NÃO',
      ]),
    ]);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-status-red" />
            Emergência e evacuação — chamada ao vivo
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard compact title="Pessoas presentes" value={formatNumber(report.data?.totalPeople ?? 0)} tone="blue" />
          <MetricCard compact title="Veículos presentes" value={formatNumber(report.data?.totalVehicles ?? 0)} tone="purple" />
          <MetricCard
            compact
            title="Localizados"
            value={`${accountedFor}/${people.length}`}
            description={`${pct}% da população`}
            tone={pct === 100 ? 'green' : 'yellow'}
          />
        </div>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Input
            className="sm:w-72"
            placeholder="Ponto de encontro (ex.: Estacionamento A)"
            value={meetingPoint}
            onChange={(e) => setMeetingPoint(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => report.refetch()}>
              <RefreshCw className={cn('mr-2 h-4 w-4', report.isFetching && 'animate-spin')} />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={exportRollCall} disabled={!people.length}>
              <Download className="mr-2 h-4 w-4" />
              Exportar ata
            </Button>
          </div>
        </div>

        {report.data?.lastOfflineSyncAt && (
          <p className="text-xs text-muted-foreground">
            Última sincronização sem conexão: {new Date(report.data.lastOfflineSyncAt).toLocaleString('pt-BR')}
          </p>
        )}

        <div className="mt-2 max-h-[44vh] overflow-y-auto rounded-md border">
          {report.isPending ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Carregando presentes…</div>
          ) : people.length === 0 ? (
            <EmptyState title="Ninguém presente" description="Não há entradas em aberto no momento." />
          ) : (
            <ul className="divide-y">
              {people.map((p) => {
                const ok = located.has(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => toggle(p.id)}
                      className={cn('flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50', ok && 'bg-status-green/5')}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-status-green" /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />}
                        <div className="min-w-0">
                          <div className={cn('truncate text-sm font-medium', ok && 'text-muted-foreground line-through')}>
                            {p.person?.name ?? p.plate ?? p.vehicle?.plate ?? p.code ?? '—'}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {[p.gate?.name, p.contractorCompany?.tradeName ?? p.originCompanyName].filter(Boolean).join(' · ') || '—'}
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">entrada {formatTime(p.entryAt)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
