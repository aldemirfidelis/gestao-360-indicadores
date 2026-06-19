'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Handle,
  Position,
  MarkerType,
  getRectOfNodes,
  getTransformForBounds,
  type Node,
  type Edge,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng } from 'html-to-image';
import { Download, RefreshCw, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/select';
import { cn, formatPercent } from '@/lib/utils';

interface Checkin {
  weekRef: string;
  progress: number;
  confidence: number;
  createdAt: string;
}

export interface FlowObjective {
  id: string;
  name: string;
  parentId: string | null;
  status: string;
  progress: number;
  confidence: number;
  ownerName: string | null;
  team: string | null;
  ownerUser?: { name: string } | null;
  ownerNode?: { id: string; name: string } | null;
  area?: { id: string; name: string } | null;
  paceLabel?: 'AHEAD' | 'ON_TRACK' | 'BEHIND' | 'AT_RISK' | null;
  strategicObj?: {
    name: string;
    ownerNode?: { name: string } | null;
    perspective?: { name: string } | null;
    indicators?: { id: string }[];
  } | null;
  checkins?: Checkin[];
}

const STATUS_COLOR: Record<string, string> = {
  PLANNED: '#94a3b8',
  ON_TRACK: '#16a34a',
  AT_RISK: '#f59e0b',
  OFF_TRACK: '#dc2626',
  DONE: '#2563eb',
  CANCELLED: '#64748b',
};

const STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Planejado',
  ON_TRACK: 'No prazo',
  AT_RISK: 'Em risco',
  OFF_TRACK: 'Atrasado',
  DONE: 'Concluído',
  CANCELLED: 'Cancelado',
};

const NODE_W = 244;
const NODE_H = 116;
const GAP_X = 36;
const GAP_Y = 88;

interface OkrNodeData {
  name: string;
  status: string;
  owner: string | null;
  progressNow: number;
  progressAt: number | null; // progresso "como estava" no período selecionado
  hasPeriod: boolean;
  strategyLabel?: string | null;
  areaLabel?: string | null;
  indicatorCount?: number;
  paceLabel?: string | null;
}

const PACE_LABEL: Record<string, { label: string; color: string }> = {
  AHEAD: { label: 'Adiantado', color: '#2563eb' },
  ON_TRACK: { label: 'No ritmo', color: '#16a34a' },
  BEHIND: { label: 'Atrasado', color: '#f59e0b' },
  AT_RISK: { label: 'Em risco', color: '#dc2626' },
};

function OkrNode({ data }: NodeProps<OkrNodeData>) {
  const color = STATUS_COLOR[data.status] ?? '#94a3b8';
  const delta = data.progressAt !== null ? data.progressNow - data.progressAt : null;
  return (
    <div
      className="rounded-lg border bg-card shadow-sm"
      style={{ width: NODE_W, borderTopColor: color, borderTopWidth: 3 }}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-muted-foreground" />
      <div className="space-y-1.5 p-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
          <span className="line-clamp-2 text-sm font-semibold leading-tight">{data.name}</span>
        </div>
        <div className="flex items-center justify-between gap-1">
          {data.owner && <div className="truncate text-[11px] text-muted-foreground">{data.owner}</div>}
          {data.paceLabel && PACE_LABEL[data.paceLabel] && (
            <span className="shrink-0 text-[9px] font-semibold" style={{ color: PACE_LABEL[data.paceLabel].color }}>
              {PACE_LABEL[data.paceLabel].label}
            </span>
          )}
        </div>
        {data.areaLabel && (
          <div className="truncate text-[10px] font-medium text-foreground/70">{data.areaLabel}</div>
        )}
        {data.strategyLabel && (
          <div className="truncate text-[10px] text-muted-foreground">
            {data.strategyLabel}
            {data.indicatorCount ? ` · ${data.indicatorCount} ind.` : ''}
          </div>
        )}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full" style={{ width: `${Math.round(data.progressNow * 100)}%`, background: color }} />
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-foreground">{formatPercent(data.progressNow)}</span>
          {data.hasPeriod && (
            <span className="text-muted-foreground">
              período: {data.progressAt !== null ? formatPercent(data.progressAt) : '—'}
              {delta !== null && delta !== 0 && (
                <strong className={cn('ml-1', delta > 0 ? 'text-status-green' : 'text-status-red')}>
                  {delta > 0 ? '▲' : '▼'} {formatPercent(Math.abs(delta))}
                </strong>
              )}
            </span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-muted-foreground" />
    </div>
  );
}

const nodeTypes = { okr: OkrNode };

function progressAtPeriod(obj: FlowObjective, periodRef: string | null): number | null {
  if (!periodRef) return null;
  const cks = (obj.checkins ?? []).filter((c) => c.weekRef <= periodRef);
  if (cks.length === 0) return null;
  // checkins vêm ordenados por createdAt asc; o último <= período é o "como estava"
  return cks[cks.length - 1].progress;
}

function buildGraph(objectives: FlowObjective[], periodRef: string | null): { nodes: Node[]; edges: Edge[] } {
  const ids = new Set(objectives.map((o) => o.id));
  const byId = new Map(objectives.map((o) => [o.id, o]));
  const childrenMap = new Map<string, string[]>();
  const roots: string[] = [];
  for (const o of objectives) {
    const pid = o.parentId && ids.has(o.parentId) ? o.parentId : null;
    if (pid) {
      const arr = childrenMap.get(pid) ?? [];
      arr.push(o.id);
      childrenMap.set(pid, arr);
    } else {
      roots.push(o.id);
    }
  }

  const levels: string[][] = [];
  const visited = new Set<string>();
  const queue: Array<{ id: string; d: number }> = roots.map((id) => ({ id, d: 0 }));
  while (queue.length) {
    const { id, d } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    (levels[d] ??= []).push(id);
    for (const c of childrenMap.get(id) ?? []) queue.push({ id: c, d: d + 1 });
  }
  // Nós em ciclo ou órfãos: jogamos na raiz
  for (const o of objectives) {
    if (!visited.has(o.id)) {
      visited.add(o.id);
      (levels[0] ??= []).push(o.id);
    }
  }

  const nodes: Node[] = [];
  levels.forEach((level, d) => {
    const totalW = level.length * NODE_W + (level.length - 1) * GAP_X;
    level.forEach((id, i) => {
      const o = byId.get(id)!;
      nodes.push({
        id,
        type: 'okr',
        position: { x: i * (NODE_W + GAP_X) - totalW / 2, y: d * (NODE_H + GAP_Y) },
        data: {
          name: o.name,
          status: o.status,
          owner: o.ownerUser?.name ?? o.ownerName ?? o.team ?? null,
          progressNow: o.progress,
          progressAt: progressAtPeriod(o, periodRef),
          hasPeriod: !!periodRef,
          strategyLabel: o.strategicObj?.perspective?.name ?? o.strategicObj?.name ?? null,
          areaLabel: o.area?.name ?? o.ownerNode?.name ?? o.strategicObj?.ownerNode?.name ?? null,
          indicatorCount: o.strategicObj?.indicators?.length ?? 0,
          paceLabel: o.paceLabel ?? null,
        } satisfies OkrNodeData,
      });
    });
  });

  const edges: Edge[] = [];
  for (const [pid, kids] of childrenMap) {
    for (const c of kids) {
      edges.push({
        id: `${pid}-${c}`,
        source: pid,
        target: c,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#94a3b8' },
      });
    }
  }
  return { nodes, edges };
}

export function OkrFlowchart({
  objectives,
  onRefresh,
  isFetching,
}: {
  objectives: FlowObjective[];
  onRefresh: () => void;
  isFetching?: boolean;
}) {
  const [period, setPeriod] = useState<string>('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const periodOptions = useMemo(() => {
    const set = new Set<string>();
    for (const o of objectives) for (const c of o.checkins ?? []) set.add(c.weekRef);
    return Array.from(set).sort();
  }, [objectives]);

  const { nodes, edges } = useMemo(
    () => buildGraph(objectives, period || null),
    [objectives, period],
  );

  // Muda quando a ESTRUTURA muda (objetivos add/removidos) -> remonta e re-enquadra.
  // Nao muda ao trocar de periodo (mesmos ids) -> preserva o zoom/scroll.
  const flowKey = useMemo(() => nodes.map((n) => n.id).join('|'), [nodes]);

  const exportPng = useCallback(async () => {
    const viewport = wrapperRef.current?.querySelector<HTMLElement>('.react-flow__viewport');
    if (!viewport || nodes.length === 0) return;
    // Enquadra TODO o fluxo (nao so o que esta visivel) numa imagem horizontal
    const bounds = getRectOfNodes(nodes);
    const imageWidth = Math.min(4096, Math.max(1280, Math.ceil(bounds.width) + 160));
    const imageHeight = Math.min(4096, Math.max(720, Math.ceil(bounds.height) + 160));
    const [tx, ty, tzoom] = getTransformForBounds(bounds, imageWidth, imageHeight, 0.2, 2, 0.08);
    try {
      const dataUrl = await toPng(viewport, {
        backgroundColor: '#ffffff',
        width: imageWidth,
        height: imageHeight,
        pixelRatio: 2,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${tx}px, ${ty}px) scale(${tzoom})`,
        },
      });
      const a = document.createElement('a');
      a.download = `okrs-fluxograma-${new Date().toISOString().slice(0, 10)}.png`;
      a.href = dataUrl;
      a.click();
    } catch {
      // silencioso: navegadores antigos podem falhar no html-to-image
    }
  }, [nodes]);

  if (objectives.length === 0) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
        <GitBranch className="mb-2 h-8 w-8 opacity-50" />
        Crie objetivos (e defina o objetivo pai) para montar o fluxograma automaticamente.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-card px-2 py-1.5">
        <span className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Período</span>
        <NativeSelect className="h-9 w-[200px] text-xs" value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="">Atual (agora)</option>
          {periodOptions.map((w) => (
            <option key={w} value={w}>
              Como estava em {w}
            </option>
          ))}
        </NativeSelect>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={onRefresh} disabled={isFetching} title="Atualizar dados">
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', isFetching && 'animate-spin')} />
            Atualizar
          </Button>
          <Button size="sm" variant="outline" onClick={exportPng} title="Baixar todo o fluxo em PNG (enquadra automaticamente)">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Baixar Fluxo
          </Button>
        </div>
      </div>

      <div ref={wrapperRef} className="h-[68vh] overflow-hidden rounded-lg border bg-muted/5">
        <ReactFlow
          key={flowKey}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} color="#cbd5e1" className="opacity-45" />
        </ReactFlow>
      </div>
    </div>
  );
}
