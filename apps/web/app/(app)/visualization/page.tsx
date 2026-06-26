'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Edit3, MessageSquareText } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';

interface OrgNodeOption {
  id: string;
  parentId: string | null;
  name: string;
  code: string | null;
  type: string;
  _count?: { children: number; indicatorsOwned: number };
}

interface IndicatorRow {
  id: string;
  name: string;
  code: string | null;
  unit: string;
  unitLabel: string | null;
  direction: string;
  ownerNode: { id: string; name: string; type: string; parentId: string | null };
  currentTarget: { target: number; lowerBound: number | null; upperBound: number | null } | null;
  last: {
    value: number;
    light: string;
    attainment: number | null;
    deviationPct: number | null;
  } | null;
}

const PLACEHOLDER_CARDS = 8;
const CONCLUSION_PLACEHOLDER = 'Nenhuma mensagem-chave registrada para esta área.';

const LIGHT_DOT: Record<string, string> = {
  GREEN: 'bg-emerald-700',
  YELLOW: 'bg-amber-500',
  RED: 'bg-red-700 status-red-pulse',
  GRAY: 'bg-slate-400',
};

const LIGHT_TEXT: Record<string, string> = {
  GREEN: 'Sem evento crítico',
  YELLOW: 'Atenção preventiva',
  RED: 'Fora da rota',
  GRAY: 'Sem lançamento',
};

export default function VisualizationPage() {
  const orgNodes = useQuery<OrgNodeOption[]>({
    queryKey: ['visualization', 'orgnodes'],
    queryFn: () => api<OrgNodeOption[]>('/dashboard/areas'),
  });
  const queryClient = useQueryClient();
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [conclusionDraft, setConclusionDraft] = useState('');
  const [conclusionOpen, setConclusionOpen] = useState(false);

  // Combobox mostra apenas as áreas-pai (que têm sub-áreas) — ex.: GOIASA, ADMINISTRAÇÃO, INDÚSTRIA, SSMA...
  const orderedNodes = useMemo(
    () => buildIndentedNodes((orgNodes.data ?? []).filter((node) => (node._count?.children ?? 0) > 0 || node.parentId === null)),
    [orgNodes.data],
  );

  useEffect(() => {
    if (!selectedNodeId && orderedNodes.length) {
      setSelectedNodeId(orderedNodes[0].id);
    }
  }, [orderedNodes, selectedNodeId]);

  const indicators = useQuery<IndicatorRow[]>({
    queryKey: ['visualization', 'indicators', selectedNodeId],
    queryFn: () => api<IndicatorRow[]>(`/dashboard/area-indicators?ownerNodeId=${encodeURIComponent(selectedNodeId)}`),
    enabled: Boolean(selectedNodeId),
  });
  const conclusionQuery = useQuery<{ ownerNodeId: string; conclusion: string; updatedAt: string | null }>({
    queryKey: ['visualization', 'conclusion', selectedNodeId],
    queryFn: () => api<{ ownerNodeId: string; conclusion: string; updatedAt: string | null }>(`/dashboard/area-conclusion?ownerNodeId=${encodeURIComponent(selectedNodeId)}`),
    enabled: Boolean(selectedNodeId),
  });
  const saveConclusionMutation = useMutation({
    mutationFn: (conclusion: string) =>
      api(`/dashboard/area-conclusion?ownerNodeId=${encodeURIComponent(selectedNodeId)}`, {
        method: 'PATCH',
        json: { conclusion },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visualization', 'conclusion', selectedNodeId] });
      setConclusionOpen(false);
    },
  });

  const indicatorRows = indicators.data ?? [];
  const selectedNode = orderedNodes.find((node) => node.id === selectedNodeId);
  const visibleCards = indicatorRows.slice(0, PLACEHOLDER_CARDS);
  const conclusion = conclusionQuery.data?.conclusion ?? '';

  const openConclusionEditor = () => {
    setConclusionDraft(conclusion);
    setConclusionOpen(true);
  };

  const saveConclusion = () => {
    const clean = conclusionDraft.trim();
    saveConclusionMutation.mutate(clean);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Painel executivo"
        title="Visão executiva por área"
        tone="view"
      />

      <Card className="overflow-hidden">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr),minmax(280px,420px)] lg:items-end">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <BarChart3 className="h-4 w-4 shrink-0 text-status-green" />
              <span>Escopo do painel</span>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Indicadores principais, faróis e mensagem-chave do mês em uma visão compacta para decisão.
            </p>
          </div>

          <div className="min-w-0">
            <Label htmlFor="area-select" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Área da árvore organizacional
            </Label>
            <NativeSelect
              id="area-select"
              value={selectedNodeId}
              onChange={(event) => setSelectedNodeId(event.target.value)}
              className="h-10 w-full rounded-md border-border bg-background text-sm text-foreground shadow-sm"
            >
              {orderedNodes.length === 0 && <option value="">Nenhuma área cadastrada</option>}
              {orderedNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {`${'\u00A0'.repeat(node.depth * 4)}${node.name}`}
                </option>
              ))}
            </NativeSelect>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {indicators.isLoading ? (
            Array.from({ length: PLACEHOLDER_CARDS }).map((_, index) => <ExecutiveIndicatorSkeleton key={`loading-${index}`} />)
          ) : visibleCards.length === 0 ? (
            <ExecutiveIndicatorEmptyState />
          ) : (
            visibleCards.map((indicator) => <ExecutiveIndicatorCard key={indicator.id} indicator={indicator} />)
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr),minmax(320px,0.82fr)] lg:items-start">
          <Card>
            <CardContent className="p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground">Leitura executiva</h2>
              <div className="mt-4 grid gap-3 text-sm leading-relaxed text-muted-foreground sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <ExecutiveReadItem color="bg-status-green" title="Dentro da meta" text="Manter rotina, registrar aprendizado e padronizar boas práticas." />
                <ExecutiveReadItem color="bg-status-yellow" title="Atenção" text="Checar tendência, risco de virada e contramedidas preventivas." />
                <ExecutiveReadItem color="bg-status-red status-red-pulse" title="Crítico" text="Exigir causa, responsável, prazo e decisão do fórum executivo." />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-status-orange">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-foreground">
                    <MessageSquareText className="h-4 w-4 shrink-0 text-status-orange" />
                    <span>Mensagem-chave do mês</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                    {conclusion || CONCLUSION_PLACEHOLDER}
                  </p>
                </div>
              </div>
              <Button className="mt-4 gap-2" type="button" variant="outline" onClick={openConclusionEditor} disabled={!selectedNodeId}>
                <Edit3 className="h-4 w-4" />
                {conclusion ? 'Editar mensagem' : 'Registrar mensagem'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <Dialog open={conclusionOpen} onOpenChange={setConclusionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conclusão executiva da área</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="executive-conclusion">Mensagem-chave do mês</Label>
            <Textarea
              id="executive-conclusion"
              rows={5}
              value={conclusionDraft}
              onChange={(event) => setConclusionDraft(event.target.value)}
              placeholder="Resultado geral, maior risco e decisão necessária."
            />
            <p className="text-xs text-muted-foreground">
              Área selecionada: {selectedNode?.name ?? 'nenhuma área selecionada'}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConclusionOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={saveConclusion} disabled={saveConclusionMutation.isPending}>
              {saveConclusionMutation.isPending ? 'Salvando...' : 'Salvar conclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExecutiveIndicatorCard({ indicator }: { indicator: IndicatorRow }) {
  const light = indicator.last?.light ?? 'GRAY';
  const targetText = formatTarget(indicator);
  const valueText = formatNumber(indicator.last?.value, { maximumFractionDigits: 2 });
  const unitText = displayUnit(indicator.unitLabel || indicator.unit);
  return (
    <Link
      href={`/indicators/${indicator.id}`}
      className="panel panel-hover group relative flex min-h-[178px] min-w-0 flex-col overflow-hidden p-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`Abrir detalhe do indicador ${indicator.name}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 break-words text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary" title={indicator.name}>
            {indicator.name}
          </h2>
          {indicator.code && <div className="mt-1 truncate text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{indicator.code}</div>}
        </div>
        <span className={cn('mt-0.5 h-3 w-3 shrink-0 rounded-full ring-4 ring-background', LIGHT_DOT[light] ?? LIGHT_DOT.GRAY)} />
      </div>

      <div className="mt-4 min-w-0">
        <div className="truncate text-[30px] font-semibold leading-none tabular-nums tracking-tight text-foreground" title={valueText}>
          {valueText}
        </div>
        <div className="mt-1 truncate text-xs font-medium text-muted-foreground">{unitText}</div>
      </div>

      <div className="mt-auto min-w-0 pt-4">
        <div className="truncate text-xs text-muted-foreground" title={`Meta: ${targetText}`}>
          Meta: <span className="font-medium text-foreground">{targetText}</span>
        </div>
        <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/45 px-2 py-1 text-[11px] font-medium text-foreground">
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', LIGHT_DOT[light] ?? LIGHT_DOT.GRAY)} />
          <span className="truncate">{LIGHT_TEXT[light] ?? LIGHT_TEXT.GRAY}</span>
        </div>
      </div>
    </Link>
  );
}

function ExecutiveIndicatorEmptyState() {
  return (
    <div className="panel flex min-h-[178px] items-center justify-center border-dashed p-6 text-center text-sm text-muted-foreground sm:col-span-2 xl:col-span-4">
      Nenhum indicador vinculado à área selecionada.
    </div>
  );
}

function ExecutiveIndicatorSkeleton() {
  return (
    <div className="panel min-h-[178px] animate-pulse p-4">
      <div className="h-4 w-3/4 rounded bg-muted" />
      <div className="mt-2 h-3 w-1/3 rounded bg-muted" />
      <div className="mt-7 h-8 w-1/2 rounded bg-muted" />
      <div className="mt-8 h-3 w-2/3 rounded bg-muted" />
      <div className="mt-3 h-6 w-24 rounded-full bg-muted" />
    </div>
  );
}

function ExecutiveReadItem({ color, title, text }: { color: string; title: string; text: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border/70 bg-muted/25 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', color)} />
        <span className="truncate">{title}</span>
      </div>
      <p className="mt-2 break-words text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function formatTarget(indicator: IndicatorRow) {
  const unit = unitSuffix(indicator.unitLabel || indicator.unit || '');
  const lower = indicator.currentTarget?.lowerBound;
  const upper = indicator.currentTarget?.upperBound;
  const target = indicator.currentTarget?.target;

  if (lower !== null && lower !== undefined && upper !== null && upper !== undefined) {
    return `${formatNumber(lower)} a ${formatNumber(upper)}${unit}`;
  }
  if (target === null || target === undefined) return '-';
  const prefix = indicator.direction === 'LOWER_BETTER' ? '<= ' : indicator.direction === 'HIGHER_BETTER' ? '>= ' : '= ';
  return `${prefix}${formatNumber(target)}${unit}`;
}

function displayUnit(unit: string | null | undefined) {
  const clean = unit?.trim();
  if (!clean || clean === 'un') return 'Resultado';
  const labels: Record<string, string> = {
    PERCENT: 'Percentual',
    CURRENCY: 'Moeda',
    QUANTITY: 'Quantidade',
    HOURS: 'Horas',
    DAYS: 'Dias',
    TONS: 'Toneladas',
    LITERS: 'Litros',
    INDEX: 'Índice',
    TEXT: 'Texto',
    CUSTOM: 'Personalizada',
  };
  return labels[clean.toUpperCase()] ?? clean;
}

function unitSuffix(unit: string) {
  const clean = unit.trim();
  if (!clean || clean === 'un') return '';
  const suffixes: Record<string, string> = {
    PERCENT: '%',
    CURRENCY: ' R$',
    QUANTITY: ' quantidade',
    HOURS: ' horas',
    DAYS: ' dias',
    TONS: ' toneladas',
    LITERS: ' litros',
    INDEX: ' índice',
  };
  return clean === '%' ? '%' : suffixes[clean.toUpperCase()] ?? ` ${clean}`;
}

function buildIndentedNodes(nodes: OrgNodeOption[]) {
  const children = new Map<string | null, OrgNodeOption[]>();
  for (const node of nodes) {
    const list = children.get(node.parentId) ?? [];
    list.push(node);
    children.set(node.parentId, list);
  }
  const sortByName = (items: OrgNodeOption[]) => [...items].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const output: Array<OrgNodeOption & { depth: number }> = [];

  const walk = (parentId: string | null, depth: number) => {
    for (const node of sortByName(children.get(parentId) ?? [])) {
      output.push({ ...node, depth });
      walk(node.id, depth + 1);
    }
  };

  walk(null, 0);
  const attached = new Set(output.map((node) => node.id));
  for (const node of sortByName(nodes.filter((item) => !attached.has(item.id)))) {
    output.push({ ...node, depth: 0 });
  }
  return output;
}
