'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
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
const CONCLUSION_PLACEHOLDER = '[Escrever em 2 ou 3 linhas a conclusão executiva: resultado geral, maior risco e decisão necessária.]';

const LIGHT_DOT: Record<string, string> = {
  GREEN: 'bg-emerald-700',
  YELLOW: 'bg-amber-500',
  RED: 'bg-red-700',
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

  const orderedNodes = useMemo(() => buildIndentedNodes(orgNodes.data ?? []), [orgNodes.data]);

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
  const emptySlots = Math.max(0, PLACEHOLDER_CARDS - visibleCards.length);
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
    <div className="-m-6 min-h-[calc(100vh-4rem)] bg-white pb-8 text-slate-950">
      <div className="h-11 bg-gradient-to-r from-[#69b45f] via-[#53ab76] to-[#1f8f7b]" />

      <main className="px-7 pb-6 pt-3">
        <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr),360px] lg:items-end">
          <div>
            <div className="text-sm text-slate-600">Visão de uma página para iniciar a reunião e definir onde aprofundar.</div>
            <div className="mt-4 max-w-xl">
              <Label htmlFor="area-select" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Área da árvore organizacional
              </Label>
              <NativeSelect
                id="area-select"
                value={selectedNodeId}
                onChange={(event) => setSelectedNodeId(event.target.value)}
                className="h-11 rounded-md border-slate-300 bg-white text-slate-900 shadow-sm"
              >
                {orderedNodes.length === 0 && <option value="">Nenhuma área cadastrada</option>}
                {orderedNodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {`${'\u00A0'.repeat(node.depth * 4)}${node.name}`}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="justify-self-start rounded-md bg-red-600 px-5 py-2 text-center text-lg font-semibold leading-tight text-white shadow-lg lg:justify-self-end">
            Exemplo do painel da área /<br />Definir Indicadores
          </div>
        </div>

        <section className="grid gap-10">
          <div className="grid grid-cols-1 gap-x-7 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
            {visibleCards.map((indicator) => (
              <ExecutiveIndicatorCard key={indicator.id} indicator={indicator} />
            ))}
            {Array.from({ length: emptySlots }).map((_, index) => (
              <div key={`empty-${index}`} className="h-[140px] rounded-lg border border-slate-200 bg-white shadow-[0_2px_5px_rgba(15,23,42,0.35)]" />
            ))}
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr,0.9fr] lg:items-start">
            <div className="pl-2">
              <h2 className="text-lg font-bold text-emerald-950">Leitura executiva</h2>
              <div className="mt-3 space-y-2 text-base leading-6 text-slate-950">
                <p>Indicadores verdes: manter rotina e padronizar boas práticas.</p>
                <p>Indicadores amarelos: checar tendência, risco e contramedidas preventivas.</p>
                <p>Indicadores vermelhos: exigir análise de causa, plano de ação e decisão do fórum.</p>
              </div>
            </div>

            <div>
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_2px_5px_rgba(15,23,42,0.35)] [border-left:8px_solid_#f28b22]">
                <h2 className="text-lg font-bold text-orange-500">Mensagem-chave do mês</h2>
                <p className="mt-4 text-sm leading-5 text-slate-950">
                  {conclusion || CONCLUSION_PLACEHOLDER}
                </p>
              </div>
              <Button className="mt-4" type="button" onClick={openConclusionEditor} disabled={!selectedNodeId}>
                {conclusion ? 'Editar conclusão executiva' : 'Registrar conclusão executiva'}
              </Button>
            </div>
          </div>
        </section>
      </main>

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
  return (
    <article className="relative h-[140px] rounded-lg border border-slate-200 bg-white px-6 py-4 shadow-[0_2px_5px_rgba(15,23,42,0.35)]">
      <div className={cn('absolute right-6 top-4 h-4 w-4 rounded-full shadow-[0_0_7px_rgba(15,23,42,0.45)]', LIGHT_DOT[light] ?? LIGHT_DOT.GRAY)} />
      <h2 className="max-w-[calc(100%-2rem)] text-sm font-bold leading-4 text-slate-600">{indicator.name}</h2>
      <div className="mt-4 text-[32px] font-extrabold leading-none tracking-normal text-zinc-900">
        {formatNumber(indicator.last?.value, { maximumFractionDigits: 2 })}
      </div>
      <div className="mt-4 text-sm leading-4 text-slate-600">Meta: {targetText}</div>
      <div className="mt-1 text-xs leading-4 text-slate-800">{LIGHT_TEXT[light] ?? LIGHT_TEXT.GRAY}</div>
    </article>
  );
}

function formatTarget(indicator: IndicatorRow) {
  const unit = indicator.unitLabel || indicator.unit || '';
  const lower = indicator.currentTarget?.lowerBound;
  const upper = indicator.currentTarget?.upperBound;
  const target = indicator.currentTarget?.target;

  if (lower !== null && lower !== undefined && upper !== null && upper !== undefined) {
    return `${formatNumber(lower)} a ${formatNumber(upper)}${unitSuffix(unit)}`;
  }
  if (target === null || target === undefined) return '-';
  const prefix = indicator.direction === 'LOWER_BETTER' ? '<= ' : indicator.direction === 'HIGHER_BETTER' ? '>= ' : '= ';
  return `${prefix}${formatNumber(target)}${unitSuffix(unit)}`;
}

function unitSuffix(unit: string) {
  if (!unit || unit === 'un') return '';
  return unit === '%' ? '%' : ` ${unit}`;
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
