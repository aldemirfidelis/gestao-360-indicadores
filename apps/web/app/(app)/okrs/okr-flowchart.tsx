'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MiniMap,
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
import { ChevronsDownUp, ChevronsUpDown, Download, Minus, Plus, RefreshCw, GitBranch, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/select';
import { anchorLayout, layoutTree, lineageOf } from '@/lib/okr-tree-layout';
import { cn, formatPercent } from '@/lib/utils';

interface Checkin {
  weekRef: string;
  progress: number;
  confidence: number;
  createdAt: string;
}

interface FlowKR {
  id: string;
  metric: string;
  progress: number;
}

interface FlowActionPlan {
  id: string;
  title: string;
  status: string;
  progress: number;
  taskCount: number;
  doneTaskCount: number;
}

export interface FlowObjective {
  id: string;
  name: string;
  description?: string | null;
  parentId: string | null;
  status: string;
  progress: number;
  confidence: number;
  weight?: number;
  ownerName: string | null;
  team: string | null;
  ownerUser?: { name: string } | null;
  ownerNode?: { id: string; name: string } | null;
  area?: { id: string; name: string } | null;
  paceLabel?: 'AHEAD' | 'ON_TRACK' | 'BEHIND' | 'AT_RISK' | null;
  progressSource?: 'ACTIONS' | 'KEY_RESULTS' | 'CHECKINS' | 'CHILDREN' | 'EMPTY';
  actionPlanCount?: number;
  taskCount?: number;
  doneTaskCount?: number;
  keyResults?: FlowKR[];
  actionPlans?: FlowActionPlan[];
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
const NODE_H = 132;
const GAP_X = 36;
const GAP_Y = 80;
const TREE_SIZES = { nodeWidth: NODE_W, nodeHeight: NODE_H, gapX: GAP_X, gapY: GAP_Y };

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
  childCount: number;
  hiddenCount: number;
  selected: boolean;
  /** Fora da linhagem do objetivo selecionado: fica em segundo plano. */
  dimmed: boolean;
  onToggle: (id: string) => void;
}

const PACE_LABEL: Record<string, { label: string; color: string }> = {
  AHEAD: { label: 'Adiantado', color: '#2563eb' },
  ON_TRACK: { label: 'No ritmo', color: '#16a34a' },
  BEHIND: { label: 'Atrasado', color: '#f59e0b' },
  AT_RISK: { label: 'Em risco', color: '#dc2626' },
};

function OkrNode({ id, data }: NodeProps<OkrNodeData>) {
  const color = STATUS_COLOR[data.status] ?? '#94a3b8';
  const delta = data.progressAt !== null ? data.progressNow - data.progressAt : null;
  const collapsed = data.hiddenCount > 0;
  return (
    <div
      className={cn(
        'relative cursor-pointer rounded-lg border bg-card shadow-sm transition-[opacity,box-shadow] hover:shadow-md',
        data.selected && 'shadow-lg ring-4 ring-primary/40',
        data.dimmed && 'opacity-35',
      )}
      style={{ width: NODE_W, borderTopColor: color, borderTopWidth: 3 }}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} className="!h-2 !w-2 !border-0 !bg-muted-foreground/60" />
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
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="!h-2 !w-2 !border-0 !bg-muted-foreground/60" />
      {data.childCount > 0 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            data.onToggle(id);
          }}
          title={collapsed ? `Mostrar ${data.hiddenCount} objetivo(s) abaixo` : 'Recolher os objetivos abaixo'}
          aria-label={collapsed ? `Expandir ${data.name}` : `Recolher ${data.name}`}
          className="nodrag nopan absolute -bottom-3 left-1/2 z-10 inline-flex h-6 min-w-6 -translate-x-1/2 items-center justify-center gap-0.5 rounded-full border bg-background px-1.5 text-[10px] font-semibold text-muted-foreground shadow-sm transition hover:border-primary hover:text-primary"
        >
          {collapsed ? (
            <>
              <Plus className="h-3 w-3" />
              {data.hiddenCount}
            </>
          ) : (
            <Minus className="h-3 w-3" />
          )}
        </button>
      )}
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

interface GraphOptions {
  periodRef: string | null;
  collapsed: ReadonlySet<string>;
  selectedId: string | null;
  anchor: { id: string; x: number; y: number } | null;
  onToggle: (id: string) => void;
}

function buildGraph(objectives: FlowObjective[], options: GraphOptions): { nodes: Node<OkrNodeData>[]; edges: Edge[] } {
  const byId = new Map(objectives.map((o) => [o.id, o]));
  const layout = anchorLayout(layoutTree(objectives, options.collapsed, TREE_SIZES), options.anchor);
  const lineage = lineageOf(objectives, options.selectedId);
  const highlighting = lineage.size > 0;

  const nodes = layout.nodes.map((box): Node<OkrNodeData> => {
    const o = byId.get(box.id)!;
    return {
      id: box.id,
      type: 'okr',
      position: { x: box.x, y: box.y },
      draggable: false,
      connectable: false,
      data: {
        name: o.name,
        status: o.status,
        owner: o.ownerUser?.name ?? o.ownerName ?? o.team ?? null,
        progressNow: o.progress,
        progressAt: progressAtPeriod(o, options.periodRef),
        hasPeriod: !!options.periodRef,
        strategyLabel: o.strategicObj?.perspective?.name ?? o.strategicObj?.name ?? null,
        areaLabel: o.area?.name ?? o.ownerNode?.name ?? o.strategicObj?.ownerNode?.name ?? null,
        indicatorCount: o.strategicObj?.indicators?.length ?? 0,
        paceLabel: o.paceLabel ?? null,
        childCount: box.childCount,
        hiddenCount: box.hiddenCount,
        selected: box.id === options.selectedId,
        dimmed: highlighting && !lineage.has(box.id),
        onToggle: options.onToggle,
      },
    };
  });

  const edges = layout.edges.map(({ source, target }): Edge => {
    const strong = highlighting && lineage.has(source) && lineage.has(target);
    const color = strong ? '#2563eb' : '#94a3b8';
    return {
      id: `${source}-${target}`,
      source,
      target,
      type: 'smoothstep',
      pathOptions: { borderRadius: 12 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
      style: { stroke: color, strokeWidth: strong ? 2.5 : 1.5, opacity: highlighting && !strong ? 0.35 : 1 },
      zIndex: strong ? 1 : 0,
    };
  });
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [anchor, setAnchor] = useState<GraphOptions['anchor']>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Node<OkrNodeData>[]>([]);
  const selected = useMemo(() => objectives.find((o) => o.id === selectedId) ?? null, [objectives, selectedId]);
  const parentIds = useMemo(() => new Set(objectives.flatMap((o) => (o.parentId ? [o.parentId] : []))), [objectives]);

  const periodOptions = useMemo(() => {
    const set = new Set<string>();
    for (const o of objectives) for (const c of o.checkins ?? []) set.add(c.weekRef);
    return Array.from(set).sort();
  }, [objectives]);

  // Recolher/expandir mantém parado o card clicado; o resto da árvore se ajusta em volta.
  const toggleBranch = useCallback((id: string) => {
    const node = nodesRef.current.find((item) => item.id === id);
    if (node) setAnchor({ id, x: node.position.x, y: node.position.y });
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const { nodes, edges } = useMemo(
    () => buildGraph(objectives, { periodRef: period || null, collapsed, selectedId, anchor, onToggle: toggleBranch }),
    [objectives, period, collapsed, selectedId, anchor, toggleBranch],
  );
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Muda quando os objetivos mudam (criados/removidos/filtrados) -> remonta e re-enquadra.
  // Nao muda ao trocar de periodo nem ao recolher ramos -> preserva o zoom/scroll.
  const flowKey = useMemo(() => objectives.map((o) => `${o.id}:${o.parentId ?? ''}`).join('|'), [objectives]);

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
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {parentIds.size > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAnchor(null);
                  setCollapsed(new Set());
                }}
                disabled={collapsed.size === 0}
                title="Mostrar todos os objetivos"
              >
                <ChevronsUpDown className="mr-1.5 h-3.5 w-3.5" />
                Expandir tudo
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAnchor(null);
                  setCollapsed(new Set(parentIds));
                }}
                title="Mostrar só os objetivos de topo; abra cada ramo pelo botão + do card"
              >
                <ChevronsDownUp className="mr-1.5 h-3.5 w-3.5" />
                Recolher tudo
              </Button>
            </>
          )}
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

      <div ref={wrapperRef} className="relative h-[68vh] overflow-hidden rounded-lg border bg-muted/5">
        {/* Layout automático: os cards não arrastam (antes pareciam arrastáveis e voltavam
            ao lugar). Arrastar o fundo navega; a roda do mouse aproxima. */}
        <ReactFlow
          key={flowKey}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.1}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => setSelectedId((current) => (current === node.id ? null : node.id))}
          onPaneClick={() => setSelectedId(null)}
        >
          <Background gap={20} size={1} color="#cbd5e1" className="opacity-45" />
          <Controls showInteractive={false} position="bottom-left" />
          {!selected && (
            <MiniMap
              pannable
              zoomable
              position="bottom-right"
              className="hidden md:block"
              maskColor="rgba(15, 23, 42, 0.08)"
              nodeBorderRadius={6}
              nodeColor={(node) => STATUS_COLOR[(node.data as OkrNodeData).status] ?? '#94a3b8'}
            />
          )}
        </ReactFlow>
        {selected && <OkrDetailPanel obj={selected} periodRef={period || null} onClose={() => setSelectedId(null)} />}
      </div>
      <p className="px-1 text-[11px] text-muted-foreground">
        Clique em um objetivo para ver os detalhes e destacar a linha dele; use o botão +/− embaixo do card para abrir ou recolher um ramo. Arraste o fundo para navegar.
      </p>
    </div>
  );
}

function OkrDetailPanel({ obj, periodRef, onClose }: { obj: FlowObjective; periodRef: string | null; onClose: () => void }) {
  const color = STATUS_COLOR[obj.status] ?? '#94a3b8';
  const at = progressAtPeriod(obj, periodRef);
  const delta = at !== null ? obj.progress - at : null;
  const pace = obj.paceLabel ? PACE_LABEL[obj.paceLabel] : null;
  const taskCount = obj.taskCount ?? 0;
  const doneTaskCount = obj.doneTaskCount ?? 0;
  const pendingTaskCount = Math.max(0, taskCount - doneTaskCount);
  return (
    <aside className="absolute right-3 top-3 bottom-3 z-10 flex w-80 max-w-[calc(100%-24px)] flex-col rounded-lg border bg-card shadow-lg">
      <div className="flex items-start justify-between gap-2 border-b p-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight">{obj.name}</h3>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{STATUS_LABEL[obj.status] ?? obj.status}</div>
          </div>
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Fechar">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        {obj.description && <p className="text-xs leading-5 text-muted-foreground">{obj.description}</p>}

        <div className="grid grid-cols-2 gap-2">
          <Metric label="Progresso" value={formatPercent(obj.progress)} />
          <Metric label="Confiança" value={formatPercent(obj.confidence)} />
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full" style={{ width: `${Math.round(obj.progress * 100)}%`, background: color }} />
        </div>
        {periodRef && (
          <div className="text-[11px] text-muted-foreground">
            Como estava em {periodRef}: {at !== null ? formatPercent(at) : '—'}
            {delta !== null && delta !== 0 && (
              <strong className={cn('ml-1', delta > 0 ? 'text-status-green' : 'text-status-red')}>
                {delta > 0 ? '▲' : '▼'} {formatPercent(Math.abs(delta))}
              </strong>
            )}
          </div>
        )}
        {pace && <div className="text-xs font-medium" style={{ color: pace.color }}>Ritmo: {pace.label}</div>}

        <div className="space-y-1 border-t pt-2 text-xs text-muted-foreground">
          {(obj.ownerUser?.name || obj.ownerName) && <div><span className="text-foreground/70">Responsável:</span> {obj.ownerUser?.name ?? obj.ownerName}</div>}
          {(obj.area?.name || obj.ownerNode?.name) && <div><span className="text-foreground/70">Área:</span> {obj.area?.name ?? obj.ownerNode?.name}</div>}
          {obj.team && <div><span className="text-foreground/70">Equipe:</span> {obj.team}</div>}
        </div>

        <div className="rounded-md border bg-muted/20 p-2.5">
          <div className="text-[11px] font-semibold uppercase text-muted-foreground">Planos e tarefas</div>
          <div className="mt-1 text-xs">
            {obj.actionPlanCount ?? 0} plano(s) · <span className="text-status-green">{doneTaskCount} concluída(s)</span> · <span className="text-status-yellow">{pendingTaskCount} pendente(s)</span> de {taskCount}
          </div>
          {(obj.actionPlans ?? []).slice(0, 4).map((plan) => (
            <div key={plan.id} className="mt-1.5 border-t pt-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{plan.title}</span>
                <span className="shrink-0 text-muted-foreground">{plan.progress}%</span>
              </div>
              <div className="text-[11px] text-muted-foreground">{plan.doneTaskCount}/{plan.taskCount} tarefa(s) · {STATUS_LABEL[plan.status] ?? plan.status}</div>
            </div>
          ))}
        </div>

        {(obj.keyResults ?? []).length > 0 && (
          <div className="rounded-md border bg-muted/20 p-2.5">
            <div className="text-[11px] font-semibold uppercase text-muted-foreground">Key Results</div>
            {(obj.keyResults ?? []).map((kr) => (
              <div key={kr.id} className="mt-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{kr.metric}</span>
                  <span className="shrink-0 text-muted-foreground">{formatPercent(kr.progress)}</span>
                </div>
                <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(kr.progress * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {obj.strategicObj && (
          <div className="rounded-md border bg-muted/20 p-2.5 text-xs">
            <div className="text-[11px] font-semibold uppercase text-muted-foreground">Conexão estratégica</div>
            <div className="mt-1">{obj.strategicObj.name}</div>
            {(obj.strategicObj.perspective?.name || obj.strategicObj.ownerNode?.name) && (
              <div className="mt-0.5 text-muted-foreground">
                {[obj.strategicObj.perspective?.name, obj.strategicObj.ownerNode?.name].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
