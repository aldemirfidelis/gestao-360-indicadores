'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';
import { AlertTriangle, CalendarClock, CheckCircle2, Minus, Network, Plus, RotateCcw, Save, Target } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { EmptyState } from '@/components/platform/empty-state';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { StatusLight } from '@/components/ui/status-light';
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
  result: { id: string; indicatorId: string; periodRef: string };
  shouldOpenDeviation: boolean;
  treatment?: { id: string; status: string } | null;
}

interface TreeNode {
  id: string;
  parentId: string | null;
  name: string;
  type: string;
  active: boolean;
  children: TreeNode[];
}

interface AreaContext {
  macro: { id: string; name: string; type: string };
  micro: { id: string; name: string; type: string };
}

interface AreaGroup {
  id: string;
  name: string;
  type: string;
  microAreas: Array<{
    id: string;
    name: string;
    type: string;
    rows: PendingRow[];
  }>;
}

const periodicityLabels: Record<string, string> = {
  DAILY: 'Diário',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
};

export default function ResultsPage() {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [selectedIndicatorId, setSelectedIndicatorId] = useState('');
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [offTargetOpen, setOffTargetOpen] = useState(false);
  const [offTargets, setOffTargets] = useState<UpsertOutcome[]>([]);
  const [ignoreReason, setIgnoreReason] = useState('');
  const query = useQuery<PendingRow[]>({
    queryKey: ['results', 'pending', 'current-year'],
    queryFn: () => api<PendingRow[]>('/results/pending'),
  });
  const orgTree = useQuery<TreeNode[]>({
    queryKey: ['orgnodes', 'tree'],
    queryFn: () => api<TreeNode[]>('/orgnodes/tree'),
  });

  const allPeriods = useMemo(() => {
    const set = new Set<string>();
    query.data?.forEach((r) => r.cells.forEach((c) => set.add(c.periodRef)));
    return Array.from(set);
  }, [query.data]);

  const orgPaths = useMemo(() => buildPathMap(orgTree.data ?? []), [orgTree.data]);

  const areaGroups = useMemo(() => {
    const groups = new Map<string, AreaGroup>();
    const rows = query.data ?? [];

    for (const path of orgPaths.values()) {
      const activePath = path.filter((node) => node.active !== false);
      const areaPath = activePath.filter((node) => !ROOT_NODE_TYPES.has(node.type));
      if (areaPath.length === 0) continue;
      const macro = areaPath[0];
      const micro = areaPath.length > 1 ? areaPath[areaPath.length - 1] : macro;
      ensureAreaBucket(groups, {
        macro: { id: macro.id, name: macro.name, type: macro.type },
        micro: { id: micro.id, name: micro.name, type: micro.type },
      });
    }

    for (const row of rows) {
      const context = resolveAreaContext(row, orgPaths);
      const micro = ensureAreaBucket(groups, context);
      micro.rows.push(row);
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        microAreas: group.microAreas
          .map((micro) => ({ ...micro, rows: micro.rows.sort((a, b) => a.indicator.name.localeCompare(b.indicator.name, 'pt-BR')) }))
          .sort((a, b) => {
            if (a.rows.length !== b.rows.length) return b.rows.length - a.rows.length;
            return a.name.localeCompare(b.name, 'pt-BR');
          }),
      }))
      .sort((a, b) => {
        const countDiff = countRows(b) - countRows(a);
        return countDiff || a.name.localeCompare(b.name, 'pt-BR');
      });
  }, [orgPaths, query.data]);

  const effectiveAreaId = selectedAreaId || findMacroIdForIndicator(selectedIndicatorId, areaGroups) || areaGroups[0]?.id || '';
  const selectedArea = areaGroups.find((group) => group.id === effectiveAreaId) ?? areaGroups[0];

  const selectedRow = useMemo(() => {
    const areaRows = selectedArea?.microAreas.flatMap((micro) => micro.rows) ?? [];
    return areaRows.find((row) => row.indicator.id === selectedIndicatorId) ?? areaRows[0] ?? null;
  }, [selectedArea, selectedIndicatorId]);

  const selectedContext = useMemo(
    () => (selectedRow ? resolveAreaContext(selectedRow, orgPaths) : null),
    [orgPaths, selectedRow],
  );

  const upsert = useMutation({
    mutationFn: (items: { indicatorId: string; periodRef: string; value: number }[]) =>
      api<{ count: number; results: UpsertOutcome[] }>('/results/batch', {
        method: 'POST',
        json: { items },
      }),
    onSuccess: (out) => {
      const reds = out.results.filter((r) => r.shouldOpenDeviation).length;
      toast.success(`${out.count} lançamentos salvos${reds ? ` - ${reds} indicador(es) em vermelho` : ''}`);
      const treatments = out.results.filter((r) => r.shouldOpenDeviation && r.treatment);
      setOffTargets(treatments);
      setOffTargetOpen(treatments.length > 0);
      setEdits({});
      qc.invalidateQueries({ queryKey: ['results', 'pending'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar'),
  });

  const ignoreTreatment = useMutation({
    mutationFn: (treatmentId: string) =>
      api(`/treatments/${treatmentId}/ignore`, {
        method: 'POST',
        json: { reason: ignoreReason || 'Ignorado temporariamente no lançamento de resultado.' },
      }),
    onSuccess: () => {
      toast.success('Tratativa ignorada temporariamente');
      setIgnoreReason('');
      setOffTargetOpen(false);
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const pendingCount = Object.values(edits).reduce(
    (acc, m) => acc + Object.values(m).filter((v) => v.trim() !== '').length,
    0,
  );
  const totalCells = query.data?.reduce((acc, r) => acc + r.cells.length, 0) ?? 0;
  const filledCells =
    query.data?.reduce((acc, r) => acc + r.cells.filter((c) => c.value !== null && c.value !== undefined).length, 0) ?? 0;
  const missingCells = Math.max(0, totalCells - filledCells);
  const selectedCells = selectedRow?.cells ?? [];
  const selectedEditMap = selectedRow ? edits[selectedRow.indicator.id] ?? {} : {};
  const selectedFilledCells = selectedCells.filter((c) => {
    const hasLocalValue = (selectedEditMap[c.periodRef] ?? '').trim() !== '';
    return hasLocalValue || (c.value !== null && c.value !== undefined);
  }).length;
  const selectedEditedCount = selectedRow
    ? Object.values(edits[selectedRow.indicator.id] ?? {}).filter((v) => v.trim() !== '').length
    : 0;
  const selectedPendingCells = Math.max(0, selectedCells.length - selectedFilledCells);

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
        eyebrow="Lançamentos"
        tone="launch"
        title="Lançamento de resultados"
        description="Registro de realizado por indicador e período, com farol e desvio calculados automaticamente."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Lançamentos', href: '/launches' }, { label: 'Resultados' }]}
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
          description="Disponíveis para lançamento"
          icon={<Target className="h-4 w-4" />}
          tone="blue"
        />
        <MetricCard
          title="Períodos"
          value={formatNumber(allPeriods.length)}
          description={
            allPeriods.length > 0
              ? `${periodRefLabel(allPeriods[0])} a ${periodRefLabel(allPeriods[allPeriods.length - 1])}`
              : 'Sem período'
          }
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
          description={`${formatNumber(pendingCount)} alterações locais`}
          icon={<Save className="h-4 w-4" />}
          tone="yellow"
        />
      </div>

      <SectionCard
        title="Aba de lançamento"
        description="Escolha a área macro, expanda a área micro e lance ou ajuste o resultado em qualquer período do ano."
        contentClassName="p-0"
      >
        <div className="grid grid-cols-1 xl:grid-cols-[360px,1fr]">
          <div className="border-b p-4 xl:border-b-0 xl:border-r">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Selecionar área</div>
                <NativeSelect
                  value={selectedArea?.id ?? ''}
                  onChange={(e) => {
                    const next = areaGroups.find((group) => group.id === e.target.value);
                    setSelectedAreaId(e.target.value);
                    setSelectedIndicatorId(next?.microAreas.flatMap((micro) => micro.rows)[0]?.indicator.id ?? '');
                  }}
                  disabled={query.isLoading || orgTree.isLoading || areaGroups.length === 0}
                >
                  <option value="" disabled>
                    Selecione uma área macro
                  </option>
                  {areaGroups.map((área) => (
                    <option key={área.id} value={área.id}>
                      {área.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="overflow-hidden rounded-md border">
                {(query.isLoading || orgTree.isLoading) && <LoadingState className="min-h-56 border-0" />}
                {!query.isLoading && !orgTree.isLoading && areaGroups.length === 0 && (
                  <EmptyState
                    title="Nenhuma área com indicador"
                    description="Cadastre a área na Arvore Organizacional e vincule indicadores para registrar resultados."
                    className="border-0 bg-transparent py-8"
                  />
                )}
                {!query.isLoading && !orgTree.isLoading &&
                  selectedArea?.microAreas.map((group) => {
                    const open = expandedGroups[group.id] ?? true;
                    const selectedInGroup = group.rows.some((row) => row.indicator.id === selectedRow?.indicator.id);
                    return (
                      <div key={group.id} className="border-b last:border-b-0">
                        <button
                          type="button"
                          onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.id]: !(prev[group.id] ?? true) }))}
                          className={cn(
                            'flex w-full items-center gap-2 bg-muted/35 px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-accent/45',
                            selectedInGroup && 'text-primary',
                          )}
                        >
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border bg-background">
                            {open ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{group.name}</span>
                          <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                            {group.rows.length}
                          </span>
                        </button>
                        {open && (
                          <div className="max-h-96 overflow-y-auto bg-background">
                            {group.rows.length === 0 && (
                              <div className="border-t px-3 py-4 text-sm text-muted-foreground">
                                Nenhum indicador cadastrado para esta área.
                              </div>
                            )}
                            {group.rows.map((row) => {
                              const selected = row.indicator.id === selectedRow?.indicator.id;
                              const edited = Object.values(edits[row.indicator.id] ?? {}).some((value) => value.trim() !== '');
                              const unitLabel = row.indicator.unitLabel ?? row.indicator.unit;
                              return (
                                <button
                                  key={row.indicator.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedAreaId(effectiveAreaId);
                                    setSelectedIndicatorId(row.indicator.id);
                                  }}
                                  className={cn(
                                    'flex w-full items-start justify-between gap-3 border-t px-3 py-3 text-left transition-colors hover:bg-accent/35',
                                    selected && 'bg-accent/60',
                                  )}
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium">{row.indicator.name}</span>
                                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                      <span>{row.indicator.code ?? 'Sem código'}</span>
                                      <span>{periodicityLabels[row.indicator.periodicity] ?? row.indicator.periodicity}</span>
                                      <span>{unitLabel}</span>
                                    </span>
                                  </span>
                                  {edited && (
                                    <span className="shrink-0 rounded-full bg-status-yellow/15 px-2 py-0.5 text-xs font-medium text-status-yellow">
                                      editado
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="min-w-0">
            {query.isLoading && <LoadingState className="m-4 min-h-80" />}
            {!query.isLoading && !selectedRow && (
              <div className="p-4">
                <EmptyState title="Selecione um indicador" description="A grade vertical será exibida aqui." />
              </div>
            )}
            {!query.isLoading && selectedRow && (
              <>
                <div className="border-b p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase text-muted-foreground">Indicador selecionado</div>
                      <h2 className="mt-1 truncate text-base font-semibold">{selectedRow.indicator.name}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Network className="h-3.5 w-3.5" />
                          {selectedContext?.macro.name ?? selectedRow.indicator.ownerNode.name}
                        </span>
                        <span>{selectedContext?.micro.name ?? selectedRow.indicator.ownerNode.name}</span>
                        <span>{selectedRow.indicator.code ?? 'Sem código'}</span>
                        <span>{periodicityLabels[selectedRow.indicator.periodicity] ?? selectedRow.indicator.periodicity}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-status-green/15 px-2.5 py-1 font-medium text-status-green">
                        {formatNumber(selectedFilledCells)} preenchidos
                      </span>
                      <span className="rounded-full bg-status-yellow/15 px-2.5 py-1 font-medium text-status-yellow">
                        {formatNumber(selectedPendingCells)} pendentes
                      </span>
                      <span className="rounded-full bg-status-blue/15 px-2.5 py-1 font-medium text-status-blue">
                        {formatNumber(selectedEditedCount)} edicoes
                      </span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="table-modern min-w-[640px]">
                    <thead>
                      <tr>
                        <th className="text-left">Mês/período</th>
                        <th className="text-left">Realizado</th>
                        <th className="text-left">Meta</th>
                        <th className="text-center">Farol</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRow.cells.map((cell) => {
                        const editVal = edits[selectedRow.indicator.id]?.[cell.periodRef] ?? '';
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
                                  setEdits((prev) => ({
                                    ...prev,
                                    [selectedRow.indicator.id]: {
                                      ...prev[selectedRow.indicator.id],
                                      [cell.periodRef]: e.target.value,
                                    },
                                  }))
                                }
                                placeholder={cell.target !== null && cell.target !== undefined ? String(cell.target) : '-'}
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
              </>
            )}
          </div>
        </div>
      </SectionCard>

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
                  <div className="font-semibold">Este indicador esta fora da meta. Deseja iniciar o tratamento?</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    O sistema ja registrou a rastreabilidade inicial. Agora você pode criar análise de causa, agendar reunião, criar plano de ação ou ignorar temporariamente com justificativa.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {offTargets.map((item) => {
                const row = query.data?.find((r) => r.indicator.id === item.result.indicatorId);
                return (
                  <div key={item.treatment?.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium">{row?.indicator.name ?? 'Indicador fora da meta'}</div>
                      <div className="text-xs text-muted-foreground">
                        Período {periodRefLabel(item.result.periodRef)} - status {item.treatment?.status}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild>
                        <Link href={`/treatments/${item.treatment?.id}`}>Iniciar tratamento</Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href={`/indicators/${item.result.indicatorId}`}>Ver histórico</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Ignorar temporariamente com justificativa</div>
              <Textarea
                rows={3}
                value={ignoreReason}
                onChange={(e) => setIgnoreReason(e.target.value)}
                placeholder="Explique por que esta tratativa será adiada..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOffTargetOpen(false)}>Fechar</Button>
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

const ROOT_NODE_TYPES = new Set(['COMPANY', 'BRANCH', 'DIRECTORATE']);

function buildPathMap(nodes: TreeNode[]) {
  const paths = new Map<string, TreeNode[]>();

  function walk(node: TreeNode, parents: TreeNode[]) {
    const path = [...parents, node];
    paths.set(node.id, path);
    node.children?.forEach((child) => walk(child, path));
  }

  nodes.forEach((node) => walk(node, []));
  return paths;
}

function resolveAreaContext(row: PendingRow, paths: Map<string, TreeNode[]>): AreaContext {
  const fallback = {
    id: row.indicator.ownerNode.id,
    name: row.indicator.ownerNode.name,
    type: 'AREA',
  };
  const path = paths.get(row.indicator.ownerNode.id) ?? [];
  const areaPath = path
    .filter((node) => node.active !== false)
    .filter((node) => !ROOT_NODE_TYPES.has(node.type));

  if (areaPath.length === 0) return { macro: fallback, micro: fallback };

  const macro = areaPath[0];
  const micro = areaPath.length > 1 ? areaPath[areaPath.length - 1] : macro;
  return {
    macro: { id: macro.id, name: macro.name, type: macro.type },
    micro: { id: micro.id, name: micro.name, type: micro.type },
  };
}

function ensureAreaBucket(groups: Map<string, AreaGroup>, context: AreaContext) {
  const macro =
    groups.get(context.macro.id) ??
    {
      id: context.macro.id,
      name: context.macro.name,
      type: context.macro.type,
      microAreas: [],
    };

  let micro = macro.microAreas.find((item) => item.id === context.micro.id);
  if (!micro) {
    micro = {
      id: context.micro.id,
      name: context.micro.id === context.macro.id ? 'Indicadores diretamente vinculados' : context.micro.name,
      type: context.micro.type,
      rows: [],
    };
    macro.microAreas.push(micro);
  }
  groups.set(macro.id, macro);
  return micro;
}

function countRows(group: AreaGroup) {
  return group.microAreas.reduce((total, micro) => total + micro.rows.length, 0);
}

function findMacroIdForIndicator(indicatorId: string, groups: AreaGroup[]) {
  return groups.find((group) =>
    group.microAreas.some((micro) => micro.rows.some((row) => row.indicator.id === indicatorId)),
  )?.id;
}
