'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Calendar, CheckCircle2, LockKeyhole, Plus, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

interface WorkPeriod {
  id: string;
  year: number;
  name: string;
  startsAt: string;
  endsAt: string;
  status: 'OPEN' | 'CLOSED' | 'ARCHIVED';
  isCurrent: boolean;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PeriodsResponse {
  baseYear: number;
  current: WorkPeriod | null;
  periods: WorkPeriod[];
}

const statusLabel: Record<WorkPeriod['status'], string> = {
  OPEN: 'Aberto',
  CLOSED: 'Fechado',
  ARCHIVED: 'Arquivado',
};

export default function PeriodsPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const periods = useQuery<PeriodsResponse>({
    queryKey: ['periods'],
    queryFn: () => api<PeriodsResponse>('/periods'),
  });

  const data = periods.data;
  const ordered = data?.periods ?? [];
  const current = data?.current ?? ordered.find((period) => period.isCurrent) ?? null;
  const selected = ordered.find((period) => period.id === selectedId) ?? current;
  const nextYear = useMemo(() => Math.max(data?.baseYear ? data.baseYear - 1 : 2025, ...ordered.map((period) => period.year)) + 1, [data?.baseYear, ordered]);

  useEffect(() => {
    if (!selectedId && current?.id) setSelectedId(current.id);
  }, [current?.id, selectedId]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['periods'] });

  const setCurrent = useMutation({
    mutationFn: (id: string) => api<WorkPeriod>(`/periods/${id}/current`, { method: 'PATCH' }),
    onSuccess: () => {
      toast.success('Ano de trabalho atualizado');
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Nao foi possivel alterar o periodo'),
  });

  const closePeriod = useMutation({
    mutationFn: (id: string) => api<WorkPeriod>(`/periods/${id}/close`, { method: 'POST' }),
    onSuccess: (next) => {
      toast.success(`Ano fechado. ${next.year} foi aberto automaticamente.`);
      setSelectedId(next.id);
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Nao foi possivel fechar o periodo'),
  });

  const createNext = useMutation({
    mutationFn: () => api<WorkPeriod>('/periods', { method: 'POST', json: { year: nextYear } }),
    onSuccess: (period) => {
      toast.success(`Periodo ${period.year} criado`);
      setSelectedId(period.id);
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Nao foi possivel criar o proximo ano'),
  });

  const handleClose = (period: WorkPeriod) => {
    const confirmed = window.confirm(`Fechar o ano ${period.year}? O sistema abrira automaticamente ${period.year + 1} de 01/01/${period.year + 1} a 31/12/${period.year + 1}.`);
    if (confirmed) closePeriod.mutate(period.id);
  };

  if (periods.isLoading) return <LoadingState label="Carregando periodos..." />;

  return (
    <div>
      <PageHeader
        eyebrow="Gestao"
        tone="admin"
        title="Periodos de trabalho"
        description="Defina o ano vigente para metas, lancamentos, resultados e analises do sistema."
        breadcrumbs={[{ label: 'Inicio', href: '/' }, { label: 'Gestao' }, { label: 'Periodos' }]}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">Ano vigente</div>
            <Calendar className="h-4 w-4 text-status-blue" />
          </div>
          <div className="mt-3 text-3xl font-semibold">{current?.year ?? '-'}</div>
          <div className="mt-1 text-xs text-muted-foreground">{current ? `${formatDate(current.startsAt)} a ${formatDate(current.endsAt)}` : 'Nenhum periodo aberto'}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Periodos cadastrados</div>
          <div className="mt-3 text-3xl font-semibold">{ordered.length}</div>
          <div className="mt-1 text-xs text-muted-foreground">A partir de {data?.baseYear ?? 2026}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Anos fechados</div>
          <div className="mt-3 text-3xl font-semibold">{ordered.filter((period) => period.status === 'CLOSED').length}</div>
          <div className="mt-1 text-xs text-muted-foreground">Historico protegido</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Proximo ano</div>
          <div className="mt-3 text-3xl font-semibold">{nextYear}</div>
          <div className="mt-1 text-xs text-muted-foreground">Criado automaticamente ao fechar</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px,1fr]">
        <SectionCard
          title="Ano de trabalho"
          description="Escolha o exercicio usado como referencia operacional."
          actions={
            <Button variant="outline" size="sm" onClick={() => periods.refetch()} disabled={periods.isFetching}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          }
        >
          {ordered.length === 0 && <EmptyState title="Nenhum periodo cadastrado" description="O sistema cria 2026 automaticamente no primeiro carregamento." />}
          {ordered.length > 0 && (
            <div className="space-y-4">
              <NativeSelect value={selected?.id ?? ''} onChange={(event) => setSelectedId(event.target.value)}>
                {ordered.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.year} - {period.isCurrent ? 'vigente' : statusLabel[period.status]}
                  </option>
                ))}
              </NativeSelect>

              {selected && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">{selected.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(selected.startsAt)} a {formatDate(selected.endsAt)}
                      </div>
                    </div>
                    <PeriodBadge period={selected} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <Info label="Inicio" value={formatDate(selected.startsAt)} />
                    <Info label="Fim" value={formatDate(selected.endsAt)} />
                    <Info label="Status" value={selected.isCurrent ? 'Vigente' : statusLabel[selected.status]} />
                    <Info label="Fechado em" value={formatDate(selected.closedAt)} />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={selected.isCurrent || selected.status !== 'OPEN' || setCurrent.isPending}
                      onClick={() => setCurrent.mutate(selected.id)}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Usar este ano
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={selected.status !== 'OPEN' || closePeriod.isPending}
                      onClick={() => handleClose(selected)}
                    >
                      <LockKeyhole className="mr-2 h-4 w-4" />
                      Fechar ano
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Calendario anual"
          description="Cada periodo anual sempre cobre 01/01 a 31/12 do respectivo ano."
          actions={
            <Button variant="outline" size="sm" onClick={() => createNext.mutate()} disabled={createNext.isPending}>
              <Plus className="mr-2 h-4 w-4" />
              Criar {nextYear}
            </Button>
          }
          contentClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Ano</th>
                  <th className="px-4 py-3 text-left">Inicio</th>
                  <th className="px-4 py-3 text-left">Fim</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((period) => (
                  <tr key={period.id} className={cn('border-t', period.isCurrent && 'bg-status-blue/5')}>
                    <td className="px-4 py-3 font-semibold">{period.year}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(period.startsAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(period.endsAt)}</td>
                    <td className="px-4 py-3"><PeriodBadge period={period} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={period.isCurrent || period.status !== 'OPEN' || setCurrent.isPending}
                          onClick={() => setCurrent.mutate(period.id)}
                        >
                          Usar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={period.status !== 'OPEN' || closePeriod.isPending}
                          onClick={() => handleClose(period)}
                        >
                          Fechar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function PeriodBadge({ period }: { period: WorkPeriod }) {
  if (period.isCurrent) return <Badge className="bg-status-blue text-white">Vigente</Badge>;
  if (period.status === 'CLOSED') return <Badge variant="secondary">Fechado</Badge>;
  if (period.status === 'ARCHIVED') return <Badge variant="outline">Arquivado</Badge>;
  return <Badge variant="outline" className="border-status-green text-status-green">Aberto</Badge>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
