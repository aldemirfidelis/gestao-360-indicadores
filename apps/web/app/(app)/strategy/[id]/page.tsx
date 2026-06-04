'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import ReactFlow, {
  Background,
  ConnectionMode,
  Handle,
  NodeResizer,
  Position,
  getRectOfNodes,
  getTransformForBounds,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng } from 'html-to-image';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  ChevronDown,
  Circle,
  ClipboardList,
  Compass,
  Download,
  ExternalLink,
  Filter,
  GripVertical,
  History,
  Layers,
  Link2,
  Mail,
  Maximize2,
  Minimize2,
  Monitor,
  Move,
  Pencil,
  Plus,
  Presentation,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Sliders,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { StatusBadge } from '@/components/platform/status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber, formatPercent, periodRefLabel } from '@/lib/utils';
import { ACTION_PRIORITY_LABEL, ACTION_STATUS_LABEL } from '@/lib/labels';

interface Perspective {
  id: string;
  kind: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  position: number;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
  active: boolean;
}

interface Indicator {
  id: string;
  name: string;
  code: string | null;
  status?: string;
  ownerNode?: { id: string; name: string; type?: string };
  responsibleUser?: { id: string; name: string };
  results?: { light: string; attainment: number | null; value?: number | null; periodRef?: string }[];
  targets?: { target: number; periodRef: string }[];
  actions?: IndicatorAction[];
}

interface IndicatorAction {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  progress: number;
  priority: string;
  responsibleUser?: { id: string; name: string } | null;
  ownerNode?: { id: string; name: string; type?: string } | null;
}

interface OrgNode {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  color?: string | null;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  jobTitle?: string | null;
}

interface Objective {
  id: string;
  mapId: string;
  perspectiveId: string;
  perspective: Perspective;
  name: string;
  description: string | null;
  responsible: string | null;
  responsibleUserId: string | null;
  responsibleUser?: UserOption | null;
  ownerNodeId: string | null;
  ownerNode?: OrgNode | null;
  status: string;
  weight: number;
  priority: number;
  position: number;
  positionX: number;
  positionY: number;
  width?: number;
  height?: number;
  active: boolean;
  aggregateLight: string;
  baseLight?: string;
  aggregateAttainment: number | null;
  actionCount: number;
  openActionCount?: number;
  lateActionCount?: number;
  treatmentCount: number;
  deviationCount: number;
  projectCount?: number;
  indicators: Indicator[];
  orgNodeLinks: { id: string; kind: string; orgNode: OrgNode }[];
  outRelations: { id: string; kind?: string; label: string | null; to: { id: string; name: string } }[];
  inRelations: { id: string; kind?: string; label: string | null; from: { id: string; name: string } }[];
}

interface StrategicMap {
  id: string;
  name: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
  perspectives: Perspective[];
  objectives: Objective[];
  versions: StrategyVersion[];
}

interface StrategyVersion {
  id: string;
  version: number;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  publishedAt: string | null;
  createdBy?: { id: string; name: string } | null;
}

interface StrategyOptions {
  indicators: Indicator[];
  orgNodes: OrgNode[];
  users: UserOption[];
}

const LANE_HEIGHT = 230;
const LANE_WIDTH = 1320;
const LANE_X = 0;
const OBJECTIVE_START_X = 300;

const STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Planejado',
  ON_TRACK: 'No prazo',
  AT_RISK: 'Em risco',
  OFF_TRACK: 'Fora da meta',
  DONE: 'Concluido',
  CANCELLED: 'Cancelado',
};

const LIGHT_LABEL: Record<string, string> = {
  GREEN: 'Dentro da meta',
  YELLOW: 'Atenção',
  RED: 'Crítico',
  GRAY: 'Sem dados',
};

const LIGHT_CLASS: Record<string, string> = {
  GREEN: 'border-emerald-600 bg-emerald-600 text-white shadow-md',
  YELLOW: 'border-amber-500 bg-amber-500 text-amber-950 shadow-md',
  RED: 'border-rose-600 bg-rose-600 text-white shadow-md',
  GRAY: 'border-foreground bg-muted text-muted-foreground shadow-sm',
};

const LIGHT_STROKE: Record<string, string> = {
  GREEN: '#16a34a',
  YELLOW: '#f59e0b',
  RED: '#e11d48',
  GRAY: '#64748b',
};

const LIGHT_RANK: Record<string, number> = {
  RED: 4,
  YELLOW: 3,
  GRAY: 2,
  GREEN: 1,
};

const ACTION_DONE_STATUSES = new Set(['DONE', 'DONE_LATE', 'CANCELLED', 'EFFECTIVE', 'INEFFECTIVE']);

interface RelationKindMeta {
  kind: string;
  label: string;
  description: string;
  color: string;
}

const RELATION_KINDS: RelationKindMeta[] = [
  { kind: 'contribui', label: 'Contribui para', description: 'A entrega de A contribui positivamente para B', color: '#16a34a' },
  { kind: 'impacta', label: 'Impacta', description: 'A altera direta ou indiretamente o resultado de B', color: '#2563eb' },
  { kind: 'depende', label: 'Depende de', description: 'A so avanca quando B avanca', color: '#9333ea' },
  { kind: 'medido_por', label: 'E medido por', description: 'A e mensurado pelo indicador/objetivo B', color: '#0ea5e9' },
  { kind: 'gera_acao', label: 'Gera ação', description: 'A motiva um plano de ação em B', color: '#f97316' },
  { kind: 'vinculado', label: 'Está vinculado a', description: 'Ligacao livre entre A e B', color: '#64748b' },
  { kind: 'responsável', label: 'Responsável por', description: 'A responde pela execucao de B', color: '#db2777' },
];

const RELATION_KIND_MAP = new Map(RELATION_KINDS.map((rel) => [rel.kind, rel]));
const HANDLE_IDS = new Set(['top', 'right', 'bottom', 'left']);

function kindMeta(kind?: string | null): RelationKindMeta {
  return RELATION_KIND_MAP.get(kind ?? 'impacta') ?? RELATION_KINDS[1];
}

function isManualHandle(value: string | undefined): value is 'top' | 'right' | 'bottom' | 'left' {
  return Boolean(value && HANDLE_IDS.has(value));
}

function getBestHandles(sourceNode: Node, targetNode: Node): { sourceHandle: string; targetHandle: string } {
  const sX = sourceNode.position.x;
  const sY = sourceNode.position.y;
  const sW = sourceNode.width ?? 260;
  const sH = sourceNode.height ?? 150;

  const tX = targetNode.position.x;
  const tY = targetNode.position.y;
  const tW = targetNode.width ?? 260;
  const tH = targetNode.height ?? 150;

  const sCX = sX + sW / 2;
  const sCY = sY + sH / 2;
  const tCX = tX + tW / 2;
  const tCY = tY + tH / 2;

  const dx = tCX - sCX;
  const dy = tCY - sCY;

  if (Math.abs(dy) > Math.abs(dx) * 0.8) {
    return dy > 0
      ? { sourceHandle: 'bottom', targetHandle: 'top' }
      : { sourceHandle: 'top', targetHandle: 'bottom' };
  } else {
    return dx > 0
      ? { sourceHandle: 'right', targetHandle: 'left' }
      : { sourceHandle: 'left', targetHandle: 'right' };
  }
}

const PERSPECTIVE_PRESETS = [
  { name: 'Personalizado', kind: 'CUSTOM', color: '#2563eb', icon: '' },
  { name: 'Financeiro', kind: 'FINANCIAL', color: '#16a34a', icon: 'F' },
  { name: 'Clientes & Mercado', kind: 'CUSTOMERS', color: '#2563eb', icon: 'C' },
  { name: 'Processos Internos', kind: 'INTERNAL_PROCESS', color: '#f59e0b', icon: 'P' },
  { name: 'Aprendizado & Crescimento', kind: 'LEARNING_GROWTH', color: '#8b5cf6', icon: 'A' },
  { name: 'Segurança & Saúde', kind: 'SAFETY', color: '#dc2626', icon: 'S' },
  { name: 'Sustentabilidade (ESG)', kind: 'ESG', color: '#059669', icon: 'E' },
  { name: 'Qualidade', kind: 'QUALITY', color: '#4f46e5', icon: 'Q' },
  { name: 'Produtividade', kind: 'PRODUCTIVITY', color: '#06b6d4', icon: 'PR' },
  { name: 'Pessoas & Cultura', kind: 'PEOPLE', color: '#ec4899', icon: 'PE' },
  { name: 'Custos', kind: 'COSTS', color: '#ef4444', icon: '$' },
];

function PerspectiveLane({
  data,
  selected,
}: NodeProps<{
  perspective: Perspective;
  objectiveCount: number;
  editMode: boolean;
  onResize?: (width: number, height: number) => void;
}>) {
  const perspective = data.perspective;
  const color = perspective.color ?? '#64748b';

  const laneStyle: React.CSSProperties = {
    borderColor: color,
    background: `linear-gradient(to right, ${color}1a, ${color}05), hsl(var(--background))`,
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-lg border-2 shadow-sm"
      style={laneStyle}
    >
      {data.editMode && (
        <NodeResizer
          minWidth={520}
          minHeight={150}
          isVisible={selected}
          handleStyle={{ background: color }}
          lineStyle={{ borderColor: color }}
          onResizeEnd={(_, params) => data.onResize?.(Math.round(params.width), Math.round(params.height))}
        />
      )}
      <div className="flex h-full">
        <div
          className="flex w-[68px] shrink-0 items-center justify-center"
          style={{ background: color }}
        >
          <div
            className="select-none whitespace-nowrap text-xl font-bold uppercase tracking-wide text-white drop-shadow-sm"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            {perspective.name}
          </div>
        </div>
        <div className="min-h-full flex-1 p-3">
          {perspective.description && (
            <p className="line-clamp-3 text-xs text-muted-foreground">{perspective.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function pickFocusIndicator(objective: Objective) {
  if (objective.indicators.length === 0) return null;
  return objective.indicators.reduce((best, indicator) => {
    const bestLatest = best.results?.[0];
    const latest = indicator.results?.[0];
    const bestRank = LIGHT_RANK[bestLatest?.light ?? 'GRAY'] ?? 0;
    const rank = LIGHT_RANK[latest?.light ?? 'GRAY'] ?? 0;
    if (rank !== bestRank) return rank > bestRank ? indicator : best;

    const bestAttainment = bestLatest?.attainment ?? Number.POSITIVE_INFINITY;
    const attainment = latest?.attainment ?? Number.POSITIVE_INFINITY;
    return attainment < bestAttainment ? indicator : best;
  }, objective.indicators[0]);
}

function objectiveHoverSummary(objective: Objective) {
  const indicator = pickFocusIndicator(objective);
  const latest = indicator?.results?.[0];
  const latestTarget = latest?.periodRef
    ? indicator?.targets?.find((target) => target.periodRef === latest.periodRef)
    : indicator?.targets?.[0];
  const actions = objective.indicators.flatMap((item) => item.actions ?? []);

  return {
    responsible: objective.responsibleUser?.name ?? objective.responsible ?? 'Sem responsável',
    area: objective.ownerNode?.name ?? objective.orgNodeLinks[0]?.orgNode.name ?? 'Sem área vinculada',
    indicator,
    latest,
    latestTarget,
    openActions: objective.openActionCount ?? actions.filter((action) => !ACTION_DONE_STATUSES.has(action.status)).length,
    lateActions: objective.lateActionCount ?? actions.filter(isActionOverdue).length,
    projects: objective.projectCount ?? 0,
  };
}

function ObjectiveNode({
  data,
  selected,
}: NodeProps<{ objective: Objective; selected: boolean; editMode: boolean; propagated: boolean }>) {
  const objective = data.objective;
  const light = objective.aggregateLight;
  const isDarkColor = light === 'GREEN' || light === 'RED';
  const summary = objectiveHoverSummary(objective);
  return (
    <div
      tabIndex={0}
      className={cn(
        'group relative flex h-full w-full flex-col rounded-lg border-2 p-3 shadow-md transition focus:outline-none',
        LIGHT_CLASS[light] ?? LIGHT_CLASS.GRAY,
        (selected || data.selected) && 'ring-2 ring-primary',
      )}
    >
      {data.editMode && (
        <NodeResizer
          minWidth={220}
          minHeight={130}
          isVisible={selected || data.selected}
          handleStyle={{ background: 'hsl(var(--primary))' }}
          lineStyle={{ borderColor: 'hsl(var(--primary))' }}
        />
      )}
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        className={cn(
          "!h-5 !w-5 !bg-transparent !border-0 flex items-center justify-center -translate-x-1 !absolute",
          data.editMode ? "group-hover:opacity-100 opacity-0 transition-opacity duration-200 pointer-events-auto" : "!pointer-events-none !opacity-0"
        )}
        style={{ left: 0 }}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background shadow-md hover:scale-125 transition-transform duration-150 animate-pulse" />
      </Handle>
      <Handle
        id="top"
        type="source"
        position={Position.Top}
        className={cn(
          "!h-5 !w-5 !bg-transparent !border-0 flex items-center justify-center -translate-y-1 !absolute",
          data.editMode ? "group-hover:opacity-100 opacity-0 transition-opacity duration-200 pointer-events-auto" : "!pointer-events-none !opacity-0"
        )}
        style={{ top: 0 }}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background shadow-md hover:scale-125 transition-transform duration-150 animate-pulse" />
      </Handle>
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-2 px-2 text-center">
        <div className={cn("line-clamp-3 text-lg font-bold leading-tight", isDarkColor ? "text-white" : "text-foreground")}>
          {objective.name}
        </div>
        <div className={cn("text-[11px]", isDarkColor ? "text-white/80" : "text-muted-foreground")}>
          {summary.responsible}
        </div>
        {data.editMode && (
          <GripVertical className={cn("absolute right-2 top-2 h-4 w-4 shrink-0", isDarkColor ? "text-white/70" : "text-muted-foreground")} />
        )}
      </div>

      <div className="nodrag nopan pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-50 hidden w-[340px] -translate-x-1/2 rounded-lg border bg-card p-3 text-left text-card-foreground shadow-xl group-hover:block group-focus-within:block">
        <div className="absolute left-1/2 top-[-5px] h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-l border-t bg-card" />
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{objective.name}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {objective.perspective.name} · {LIGHT_LABEL[light] ?? light}
            </div>
          </div>
          <Badge className={cn('shrink-0 border', LIGHT_CLASS[light])} variant="outline">
            {LIGHT_LABEL[light] ?? light}
          </Badge>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <MiniMetric label="Responsável" value={summary.responsible} />
          <MiniMetric label="Área" value={summary.area} />
          <MiniMetric label="Indicadores" value={formatNumber(objective.indicators.length)} />
          <MiniMetric label="Atingimento" value={formatPercent(objective.aggregateAttainment)} />
        </div>

        <div className="mt-3 rounded-md border bg-background/60 p-2 text-xs">
          <div className="text-[10px] uppercase text-muted-foreground">Indicador em foco</div>
          {summary.indicator ? (
            <>
              <div className="mt-0.5 truncate font-semibold">
                {summary.indicator.code ? `${summary.indicator.code} - ` : ''}{summary.indicator.name}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <MiniMetric label="Realizado" value={formatNumber(summary.latest?.value)} />
                <MiniMetric label="Meta" value={formatNumber(summary.latestTarget?.target)} />
                <MiniMetric label="Ating." value={formatPercent(summary.latest?.attainment ?? null)} />
              </div>
            </>
          ) : (
            <div className="mt-1 text-muted-foreground">Nenhum indicador vinculado.</div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px]">
          <div className="rounded-md border bg-background/60 p-2">
            <ClipboardList className="mx-auto mb-1 h-3.5 w-3.5" />
            <div className="font-semibold">{formatNumber(summary.openActions)}</div>
            <div className="text-muted-foreground">abertas</div>
          </div>
          <div className="rounded-md border bg-background/60 p-2">
            <Calendar className="mx-auto mb-1 h-3.5 w-3.5" />
            <div className={cn('font-semibold', summary.lateActions > 0 && 'text-rose-600')}>
              {formatNumber(summary.lateActions)}
            </div>
            <div className="text-muted-foreground">atrasadas</div>
          </div>
          <div className="rounded-md border bg-background/60 p-2">
            <ShieldAlert className="mx-auto mb-1 h-3.5 w-3.5" />
            <div className={cn('font-semibold', objective.deviationCount > 0 && 'text-rose-600')}>
              {formatNumber(objective.deviationCount)}
            </div>
            <div className="text-muted-foreground">desvios</div>
          </div>
          <div className="rounded-md border bg-background/60 p-2">
            <Layers className="mx-auto mb-1 h-3.5 w-3.5" />
            <div className="font-semibold">{formatNumber(summary.projects)}</div>
            <div className="text-muted-foreground">projetos</div>
          </div>
        </div>

        <div className="mt-2 text-[11px] text-muted-foreground">
          Clique no objetivo para abrir o drill-down lateral.
        </div>
      </div>
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className={cn(
          "!h-5 !w-5 !bg-transparent !border-0 flex items-center justify-center translate-x-1 !absolute",
          data.editMode ? "group-hover:opacity-100 opacity-0 transition-opacity duration-200 pointer-events-auto" : "!pointer-events-none !opacity-0"
        )}
        style={{ right: 0 }}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background shadow-md hover:scale-125 transition-transform duration-150 animate-pulse" />
      </Handle>
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className={cn(
          "!h-5 !w-5 !bg-transparent !border-0 flex items-center justify-center translate-y-1 !absolute",
          data.editMode ? "group-hover:opacity-100 opacity-0 transition-opacity duration-200 pointer-events-auto" : "!pointer-events-none !opacity-0"
        )}
        style={{ bottom: 0 }}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background shadow-md hover:scale-125 transition-transform duration-150 animate-pulse" />
      </Handle>
    </div>
  );
}

function getOrthogonalPath({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  controlX,
  controlY,
}: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition?: Position;
  targetPosition?: Position;
  controlX: number;
  controlY: number;
}) {
  const targetIsHorizontal = targetPosition === Position.Left || targetPosition === Position.Right;
  const routeHorizontalFirst = !targetIsHorizontal;

  const points = routeHorizontalFirst
    ? [
        { x: sourceX, y: sourceY },
        { x: controlX, y: sourceY },
        { x: controlX, y: controlY },
        { x: targetX, y: controlY },
        { x: targetX, y: targetY },
      ]
    : [
        { x: sourceX, y: sourceY },
        { x: sourceX, y: controlY },
        { x: controlX, y: controlY },
        { x: controlX, y: targetY },
        { x: targetX, y: targetY },
      ];

  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}

function StrategyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<{
  kind: string;
  label?: string | null;
  description?: string | null;
  editMode?: boolean;
  onEdgeDragStop?: (edgeId: string, offsetX: number, offsetY: number) => void;
}>) {
  const [isDragging, setIsDragging] = useState(false);
  const [localOffset, setLocalOffset] = useState({ x: 0, y: 0 });
  const startDragPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });
  const currentOffset = useRef({ x: 0, y: 0 });

  const parsedOffset = useMemo(() => {
    let x = 0;
    let y = 0;
    if (data?.description) {
      const parts = data.description.split(':');
      if (parts.length >= 4) {
        x = parseFloat(parts[2]) || 0;
        y = parseFloat(parts[3]) || 0;
      }
    }
    return { x, y };
  }, [data?.description]);

  useEffect(() => {
    if (!isDragging) {
      setLocalOffset(parsedOffset);
      currentOffset.current = parsedOffset;
    }
  }, [parsedOffset, isDragging]);

  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  const controlX = midX + localOffset.x;
  const controlY = midY + localOffset.y;

  const path = getOrthogonalPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    controlX,
    controlY,
  });
  const meta = kindMeta(data?.kind);

  const getPointerPosition = (event: React.PointerEvent<SVGCircleElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    const screenCtm = svg?.getScreenCTM();
    if (!svg || !screenCtm) {
      return { x: event.clientX, y: event.clientY };
    }
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const transformed = point.matrixTransform(screenCtm.inverse());
    return { x: transformed.x, y: transformed.y };
  };

  const onPointerDown = (event: React.PointerEvent<SVGCircleElement>) => {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    startDragPos.current = getPointerPosition(event);
    startOffset.current = { ...currentOffset.current };
  };

  const onPointerMove = (event: React.PointerEvent<SVGCircleElement>) => {
    if (!isDragging) return;
    event.stopPropagation();
    event.preventDefault();
    const pointer = getPointerPosition(event);
    const next = {
      x: startOffset.current.x + pointer.x - startDragPos.current.x,
      y: startOffset.current.y + pointer.y - startDragPos.current.y,
    };
    currentOffset.current = next;
    setLocalOffset(next);
  };

  const onPointerUp = (event: React.PointerEvent<SVGCircleElement>) => {
    if (!isDragging) return;
    event.stopPropagation();
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
    data?.onEdgeDragStop?.(
      id,
      Math.round(currentOffset.current.x),
      Math.round(currentOffset.current.y),
    );
  };

  return (
    <>
      <style>{`
        @keyframes edge-flow-dash {
          from {
            stroke-dashoffset: 24;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        .edge-animated-selected {
          stroke-dasharray: 8 4 !important;
          animation: edge-flow-dash 0.6s linear infinite !important;
        }
      `}</style>
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        className="react-flow__edge-interaction"
      />
      <path
        id={id}
        d={path}
        markerEnd="url(#g360-arrow)"
        fill="none"
        style={{
          stroke: meta.color,
          strokeWidth: selected ? 4.5 : 3,
          opacity: 1,
          strokeDasharray: selected ? undefined : (data?.kind === 'depende' ? '8 5' : undefined),
          filter: 'drop-shadow(0 1px 1px rgba(15, 23, 42, 0.18))',
        }}
        className={cn("react-flow__edge-path", selected ? 'edge-animated-selected' : '')}
      />
      {data?.editMode && (
        <g>
          <circle
            cx={controlX}
            cy={controlY}
            r={8}
            fill="#ffffff"
            stroke={meta.color}
            strokeWidth={3}
            style={{ cursor: isDragging ? 'grabbing' : 'grab', pointerEvents: 'all' }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="nodrag nopan shadow-sm hover:scale-125 transition-transform"
          />
          <circle
            cx={controlX}
            cy={controlY}
            r={3.5}
            fill={meta.color}
            style={{ pointerEvents: 'none' }}
          />
        </g>
      )}
    </>
  );
}

const nodeTypes = { perspectiveLane: PerspectiveLane, objective: ObjectiveNode };
const edgeTypes = { strategy: StrategyEdge };

export default function StrategyMapPage() {
  return (
    <ReactFlowProvider>
      <StrategyMapPageInner />
    </ReactFlowProvider>
  );
}

function StrategyMapPageInner() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const reactFlow = useReactFlow();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [perspectiveFilter, setPerspectiveFilter] = useState('');
  const [perspectiveOpen, setPerspectiveOpen] = useState(false);
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [perspectiveForm, setPerspectiveForm] = useState(defaultPerspectiveForm());
  const [objectiveForm, setObjectiveForm] = useState(defaultObjectiveForm());
  const [selectedPerspectiveDraft, setSelectedPerspectiveDraft] = useState(defaultPerspectiveForm());
  const [selectedObjectiveDraft, setSelectedObjectiveDraft] = useState(defaultObjectiveForm());
  const [indicatorToAttach, setIndicatorToAttach] = useState('');
  const [orgNodeToAttach, setOrgNodeToAttach] = useState('');
  const [drawerObjective, setDrawerObjective] = useState<Objective | null>(null);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [pendingKind, setPendingKind] = useState<string>('impacta');
  const [pendingLabel, setPendingLabel] = useState<string>('');
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [editingEdgeKind, setEditingEdgeKind] = useState<string>('impacta');
  const [editingEdgeLabel, setEditingEdgeLabel] = useState<string>('');
  const [editingEdgeSourceHandle, setEditingEdgeSourceHandle] = useState<string>('auto');
  const [editingEdgeTargetHandle, setEditingEdgeTargetHandle] = useState<string>('auto');
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [period, setPeriod] = useState('');
  const [periodOptions, setPeriodOptions] = useState<string[]>([]);

  const mapQuery = useQuery<StrategicMap>({
    queryKey: ['strategy', 'map', id, period],
    queryFn: () =>
      api<StrategicMap>(`/strategy/maps/${id}${period ? `?periodRef=${encodeURIComponent(period)}` : ''}`),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const optionsQuery = useQuery<StrategyOptions>({
    queryKey: ['strategy', 'options'],
    queryFn: () => api<StrategyOptions>('/strategy/options'),
  });

  const map = mapQuery.data;
  const mapRef = useRef<StrategicMap | undefined>(map);

  // Lista de periodos disponiveis (derivada do modo atual, mantida ao filtrar)
  useEffect(() => {
    if (period !== '' || !map) return;
    const set = new Set<string>();
    for (const obj of map.objectives) {
      for (const ind of obj.indicators ?? []) {
        for (const r of ind.results ?? []) if (r.periodRef) set.add(r.periodRef);
      }
    }
    const next = Array.from(set).sort().reverse();
    if (next.length) setPeriodOptions(next);
  }, [map, period]);

  async function exportMapPng(): Promise<string | null> {
    const viewport = canvasRef.current?.querySelector<HTMLElement>('.react-flow__viewport');
    // Enquadra TODO o fluxo (independente do zoom/scroll atual) numa imagem horizontal
    if (viewport && nodes.length > 0) {
      const bounds = getRectOfNodes(nodes);
      const imageWidth = Math.min(4096, Math.max(1280, Math.ceil(bounds.width) + 160));
      const imageHeight = Math.min(4096, Math.max(720, Math.ceil(bounds.height) + 160));
      const [tx, ty, tzoom] = getTransformForBounds(bounds, imageWidth, imageHeight, 0.2, 2, 0.08);
      try {
        return await toPng(viewport, {
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
      } catch {
        return null;
      }
    }
    // Fallback: captura o que estiver visivel
    if (!canvasRef.current) return null;
    try {
      return await toPng(canvasRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
    } catch {
      return null;
    }
  }

  async function downloadMapPng() {
    const dataUrl = await exportMapPng();
    if (!dataUrl) {
      toast.error('Não foi possível gerar a imagem');
      return;
    }
    const a = document.createElement('a');
    a.download = `mapa-estrategico-${new Date().toISOString().slice(0, 10)}.png`;
    a.href = dataUrl;
    a.click();
  }

  async function emailMapPng() {
    const dataUrl = await exportMapPng();
    if (dataUrl) {
      const a = document.createElement('a');
      a.download = `mapa-estrategico-${new Date().toISOString().slice(0, 10)}.png`;
      a.href = dataUrl;
      a.click();
    }
    const subject = encodeURIComponent(`Mapa estratégico: ${mapRef.current?.name ?? ''}`);
    const body = encodeURIComponent(
      `Segue o mapa estratégico "${mapRef.current?.name ?? ''}"${period ? ` (período ${period})` : ' (atual)'}.\n\nA imagem PNG foi baixada — anexe-a a este email.`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  useEffect(() => {
    mapRef.current = map;
  }, [map]);

  const filteredObjectives = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (map?.objectives ?? []).filter((objective) => {
      if (perspectiveFilter && objective.perspectiveId !== perspectiveFilter) return false;
      if (statusFilter && objective.aggregateLight !== statusFilter && objective.status !== statusFilter) return false;
      if (onlyCritical && objective.aggregateLight !== 'RED') return false;
      if (onlyOverdue && (objective.openActionCount ?? objective.actionCount) === 0) return false;
      if (onlyUnlinked && (objective.indicators.length > 0 || objective.orgNodeLinks.length > 0)) return false;
      if (!term) return true;
      return [
        objective.name,
        objective.description,
        objective.responsible,
        objective.responsibleUser?.name,
        objective.ownerNode?.name,
        ...objective.indicators.map((indicator) => `${indicator.code ?? ''} ${indicator.name}`),
      ].some((value) => value?.toLowerCase().includes(term));
    });
  }, [map?.objectives, perspectiveFilter, search, statusFilter, onlyCritical, onlyOverdue, onlyUnlinked]);

  const selectedPerspective = useMemo(() => map?.perspectives.find((item) => item.id === selectedId) ?? null, [map?.perspectives, selectedId]);
  const selectedObjective = useMemo(() => map?.objectives.find((item) => item.id === selectedId) ?? null, [map?.objectives, selectedId]);

  const openEdgeEditor = useCallback((edgeId: string) => {
    setEditingEdgeId(edgeId);
  }, []);

  // Persistencia "silenciosa" de posicao/tamanho: NAO mostra toast nem invalida o
  // mapa (o estado local do ReactFlow ja reflete a mudanca). Evita o refetch pesado
  // no Neon a cada arrasto/resize, que era a causa do travamento ao organizar.
  const resizeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const persistPerspective = useCallback((perspectiveId: string, patch: Record<string, number>) => {
    const timers = resizeTimers.current;
    if (timers[perspectiveId]) clearTimeout(timers[perspectiveId]);
    timers[perspectiveId] = setTimeout(() => {
      api(`/strategy/perspectives/${perspectiveId}`, { method: 'PATCH', json: patch }).catch(() => {});
    }, 400);
  }, []);
  const persistObjective = useCallback((objectiveId: string, patch: Record<string, number>) => {
    api(`/strategy/objectives/${objectiveId}`, { method: 'PATCH', json: patch }).catch(() => {});
  }, []);

  const handlePerspectiveResize = useCallback(
    (perspectiveId: string, width: number, height: number) => {
      persistPerspective(perspectiveId, { width, height });
    },
    [persistPerspective],
  );





  const computedEdges = useMemo(() => {
    const nodesMap = new Map(nodes.map((n) => [n.id, n]));
    return edges.map((edge) => {
      if (edge.sourceHandle && edge.targetHandle) {
        return edge; // Respect manual connection!
      }
      const sourceNode = nodesMap.get(edge.source);
      const targetNode = nodesMap.get(edge.target);
      if (sourceNode && targetNode && sourceNode.type === 'objective' && targetNode.type === 'objective') {
        const { sourceHandle, targetHandle } = getBestHandles(sourceNode, targetNode);
        return {
          ...edge,
          sourceHandle,
          targetHandle,
        };
      }
      return edge;
    });
  }, [nodes, edges]);

  useEffect(() => {
    const term = search.trim().toLowerCase();
    if (!term || filteredObjectives.length === 0) return;
    const match = filteredObjectives.find((objective) =>
      [objective.name, objective.responsibleUser?.name].some((v) =>
        v && v.toLowerCase().includes(term),
      ),
    );
    if (match) {
      reactFlow.fitView({ nodes: [{ id: match.id }], duration: 400, padding: 0.4 });
    }
  }, [search, filteredObjectives, reactFlow]);

  useEffect(() => {
    if (!fullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
    }
  }, [fullscreen]);

  function toggleFullscreen() {
    if (!canvasRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
      setFullscreen(false);
    } else {
      canvasRef.current.requestFullscreen().then(() => setFullscreen(true)).catch(() => { });
    }
  }

  function autoLayout() {
    if (!map) return;
    const updates = filteredObjectives.map((objective, index) => {
      const laneIndex = map.perspectives.findIndex((p) => p.id === objective.perspectiveId);
      const inLaneIndex = filteredObjectives.filter((o) => o.perspectiveId === objective.perspectiveId).findIndex((o) => o.id === objective.id);
      const x = OBJECTIVE_START_X + (inLaneIndex % 4) * 320;
      const y = Math.max(laneIndex, 0) * LANE_HEIGHT + 50 + Math.floor(inLaneIndex / 4) * 180;
      return { id: objective.id, perspectiveId: objective.perspectiveId, position: index, positionX: x, positionY: y, width: objective.width ?? 260, height: objective.height ?? 150 };
    });
    api(`/strategy/maps/${id}/layout`, { method: 'PATCH', json: { nodes: updates } })
      .then(() => {
        toast.success('Layout reorganizado por perspectiva');
        invalidate();
      })
      .catch((e: any) => toast.error(e?.message ?? 'Falha ao reorganizar layout'));
  }

  useEffect(() => {
    if (selectedPerspective) setSelectedPerspectiveDraft(formFromPerspective(selectedPerspective));
    if (selectedObjective) setSelectedObjectiveDraft(formFromObjective(selectedObjective));
    setIndicatorToAttach('');
    setOrgNodeToAttach('');
  }, [selectedPerspective, selectedObjective]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['strategy', 'map', id] });
  };

  const createPerspective = useMutation({
    mutationFn: () => api(`/strategy/maps/${id}/perspectives`, { method: 'POST', json: perspectiveForm }),
    onSuccess: () => {
      toast.success('Perspectiva criada');
      setPerspectiveOpen(false);
      setPerspectiveForm(defaultPerspectiveForm());
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao criar perspectiva'),
  });

  const updatePerspective = useMutation({
    mutationFn: ({ perspectiveId, patch }: { perspectiveId: string; patch: any }) =>
      api(`/strategy/perspectives/${perspectiveId}`, { method: 'PATCH', json: patch }),
    onSuccess: () => {
      toast.success('Perspectiva atualizada');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao atualizar perspectiva'),
  });

  const deletePerspective = useMutation({
    mutationFn: (perspectiveId: string) => api(`/strategy/perspectives/${perspectiveId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Perspectiva inativada');
      setSelectedId(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao inativar perspectiva'),
  });

  const reorderPerspectives = useMutation({
    mutationFn: (ids: string[]) => api(`/strategy/maps/${id}/perspectives/reorder`, { method: 'PATCH', json: { ids } }),
    onSuccess: invalidate,
  });

  const createObjective = useMutation({
    mutationFn: () => api(`/strategy/maps/${id}/objectives`, { method: 'POST', json: objectiveForm }),
    onSuccess: () => {
      toast.success('Objetivo criado');
      setObjectiveOpen(false);
      setObjectiveForm(defaultObjectiveForm(map?.perspectives[0]?.id));
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao criar objetivo'),
  });

  const updateObjective = useMutation({
    mutationFn: ({ objectiveId, patch }: { objectiveId: string; patch: any }) =>
      api(`/strategy/objectives/${objectiveId}`, { method: 'PATCH', json: patch }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao atualizar objetivo'),
  });

  const deleteObjective = useMutation({
    mutationFn: (objectiveId: string) => api(`/strategy/objectives/${objectiveId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Objetivo inativado');
      setSelectedId(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao inativar objetivo'),
  });

  const saveLayout = useMutation({
    mutationFn: () =>
      api(`/strategy/maps/${id}/layout`, {
        method: 'PATCH',
        json: {
          nodes: nodes
            .filter((node) => node.type === 'objective')
            .map((node, index) => ({
              id: node.id,
              perspectiveId: perspectiveForY(map, node.position.y)?.id,
              position: index,
              positionX: Math.round(node.position.x),
              positionY: Math.round(node.position.y),
              width: Math.round(node.width ?? (node.style?.width as number | undefined) ?? 260),
              height: Math.round(node.height ?? (node.style?.height as number | undefined) ?? 150),
            })),
        },
      }),
    onSuccess: () => {
      toast.success('Layout salvo');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar layout'),
  });

  const addRelation = useMutation({
    mutationFn: ({ connection, kind, label }: { connection: Connection; kind: string; label: string }) =>
      api('/strategy/relations', {
        method: 'POST',
        json: {
          fromId: connection.source,
          toId: connection.target,
          kind,
          label: label || kindMeta(kind).label,
          description: (connection.sourceHandle && connection.targetHandle)
            ? `${connection.sourceHandle}:${connection.targetHandle}`
            : null,
          weight: 1,
        },
      }),
    onSuccess: () => {
      toast.success('Ligacao criada');
      setPendingConnection(null);
      setPendingLabel('');
      setPendingKind('impacta');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao criar ligacao'),
  });

  const updateRelation = useMutation({
    mutationFn: ({ relationId, kind, label, description }: { relationId: string; kind: string; label: string; description: string | null }) =>
      api(`/strategy/relations/${relationId}`, {
        method: 'PATCH',
        json: { kind, label: label || kindMeta(kind).label, description },
      }),
    onSuccess: () => {
      toast.success('Ligacao atualizada');
      setEditingEdgeId(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao atualizar ligacao'),
  });
  const updateRelationMutateRef = useRef(updateRelation.mutate);

  useEffect(() => {
    updateRelationMutateRef.current = updateRelation.mutate;
  }, [updateRelation.mutate]);

  const handleEdgeDragStop = useCallback((edgeId: string, offsetX: number, offsetY: number) => {
    let relation: any = null;
    const currentMap = mapRef.current;
    if (currentMap) {
      for (const obj of currentMap.objectives) {
        const found = obj.outRelations.find((r) => r.id === edgeId);
        if (found) {
          relation = found;
          break;
        }
      }
    }
    if (!relation) return;
    let sourceHandle: string | null = null;
    let targetHandle: string | null = null;
    const desc = relation.description ?? '';
    if (desc && desc.includes(':')) {
      const parts = desc.split(':');
      if (isManualHandle(parts[0]) && isManualHandle(parts[1])) {
        sourceHandle = parts[0];
        targetHandle = parts[1];
      }
    }
    const newDesc = sourceHandle && targetHandle
      ? `${sourceHandle}:${targetHandle}:${offsetX}:${offsetY}`
      : `auto:auto:${offsetX}:${offsetY}`;
    updateRelationMutateRef.current({
      relationId: edgeId,
      kind: relation.kind || 'impacta',
      label: relation.label || '',
      description: newDesc,
    });
  }, []);

  useEffect(() => {
    if (!map) return;
    const flowNodes = buildNodes(map, filteredObjectives, editMode, selectedId, handlePerspectiveResize);
    const objectiveIds = new Set(filteredObjectives.map((objective) => objective.id));
    const flowEdges = filteredObjectives.flatMap((objective) =>
      objective.outRelations
        .filter((relation) => objectiveIds.has(relation.to.id))
        .map((relation) => toFlowEdge(relation, objective.id, handleEdgeDragStop, editMode)),
    );
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [editMode, filteredObjectives, map, selectedId, setEdges, setNodes, handlePerspectiveResize, handleEdgeDragStop]);

  const removeRelation = useMutation({
    mutationFn: (relationId: string) => api(`/strategy/relations/${relationId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Ligacao removida');
      invalidate();
    },
  });

  const attachIndicator = useMutation({
    mutationFn: ({ objectiveId, indicatorId }: { objectiveId: string; indicatorId: string }) =>
      api(`/strategy/objectives/${objectiveId}/indicators/${indicatorId}`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Indicador vinculado');
      setIndicatorToAttach('');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao vincular indicador'),
  });

  const detachIndicator = useMutation({
    mutationFn: ({ objectiveId, indicatorId }: { objectiveId: string; indicatorId: string }) =>
      api(`/strategy/objectives/${objectiveId}/indicators/${indicatorId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Indicador removido');
      invalidate();
    },
  });

  const attachOrgNode = useMutation({
    mutationFn: ({ objectiveId, orgNodeId }: { objectiveId: string; orgNodeId: string }) =>
      api(`/strategy/objectives/${objectiveId}/orgnodes/${orgNodeId}`, { method: 'POST', json: { kind: 'responsável' } }),
    onSuccess: () => {
      toast.success('Estrutura vinculada');
      setOrgNodeToAttach('');
      invalidate();
    },
  });

  const detachOrgNode = useMutation({
    mutationFn: ({ objectiveId, orgNodeId }: { objectiveId: string; orgNodeId: string }) =>
      api(`/strategy/objectives/${objectiveId}/orgnodes/${orgNodeId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Estrutura removida');
      invalidate();
    },
  });

  const createVersion = useMutation({
    mutationFn: (publish: boolean) =>
      api(`/strategy/maps/${id}/versions`, {
        method: 'POST',
        json: { publish, title: publish ? `Versão publicada - ${new Date().toLocaleDateString('pt-BR')}` : undefined },
      }),
    onSuccess: (_, publish) => {
      toast.success(publish ? 'Mapa publicado' : 'Versão criada');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao versionar mapa'),
  });

  const editingRelationCtx = useMemo(() => {
    if (!editingEdgeId || !map) return null;
    for (const obj of map.objectives) {
      const rel = obj.outRelations.find((r) => r.id === editingEdgeId);
      if (rel) return { rel, from: { id: obj.id, name: obj.name } };
    }
    return null;
  }, [editingEdgeId, map]);
  const editingRelation = editingRelationCtx?.rel ?? null;

  useEffect(() => {
    if (!editingRelation) return;
    setEditingEdgeKind(editingRelation.kind ?? 'impacta');
    setEditingEdgeLabel(editingRelation.label ?? '');

    const desc = (editingRelation as any).description ?? '';
    if (desc && desc.includes(':')) {
      const parts = desc.split(':');
      setEditingEdgeSourceHandle(parts[0]);
      setEditingEdgeTargetHandle(parts[1]);
    } else {
      setEditingEdgeSourceHandle('auto');
      setEditingEdgeTargetHandle('auto');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRelation?.id]);

  if (mapQuery.isLoading) return <p className="text-sm text-muted-foreground">Carregando mapa estratégico...</p>;
  if (!map) return null;

  return (
    <div className={cn(presentationMode && 'bg-background')}>
      {!presentationMode && (
        <PageHeader
          eyebrow="Estratégia"
          tone="view"
          title={map.name}
          description={`${formatDate(map.startsAt)} - ${formatDate(map.endsAt)}. Mapa visual integrado a indicadores, áreas, planos e rastreabilidade.`}
          breadcrumbs={[{ label: 'Mapas estratégicos', href: '/strategy' }, { label: map.name }]}
        />
      )}

      {!presentationMode && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar objetivo, indicador, responsável ou área" />
          </div>
          <NativeSelect className="w-[180px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Todos status</option>
            {Object.entries(LIGHT_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
            {Object.entries(STATUS_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </NativeSelect>
          <NativeSelect className="w-[200px]" value={perspectiveFilter} onChange={(event) => setPerspectiveFilter(event.target.value)}>
            <option value="">Todas perspectivas</option>
            {map.perspectives.map((perspective) => (
              <option key={perspective.id} value={perspective.id}>{perspective.name}</option>
            ))}
          </NativeSelect>
          <Button
            variant={onlyCritical ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOnlyCritical((v) => !v)}
            title="Mostrar apenas itens críticos"
          >
            <ShieldAlert className="mr-1.5 h-3.5 w-3.5" /> Críticos
          </Button>
          <Button
            variant={onlyOverdue ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOnlyOverdue((v) => !v)}
            title="Itens com ações abertas"
          >
            <Calendar className="mr-1.5 h-3.5 w-3.5" /> Com ação aberta
          </Button>
          <Button
            variant={onlyUnlinked ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOnlyUnlinked((v) => !v)}
            title="Apenas objetivos sem indicador ou estrutura"
          >
            <Sliders className="mr-1.5 h-3.5 w-3.5" /> Sem vínculo
          </Button>
          {(search || statusFilter || perspectiveFilter || onlyCritical || onlyOverdue || onlyUnlinked) && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setPerspectiveFilter('');
                setOnlyCritical(false);
                setOnlyOverdue(false);
                setOnlyUnlinked(false);
              }}
            >
              <X className="mr-1 h-3.5 w-3.5" /> Limpar
            </Button>
          )}
        </div>
      )}

      <div className={cn('grid grid-cols-1 gap-3', presentationMode ? '' : 'xl:grid-cols-[1fr,390px]')}>
        <div className="space-y-2">
          {!presentationMode && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-card px-2 py-1.5">
              <Button
                size="icon"
                variant={editMode ? 'default' : 'outline'}
                className="h-9 w-9"
                onClick={() => setEditMode((value) => !value)}
                title={editMode ? 'Modo edição' : 'Modo visualização'}
                aria-label={editMode ? 'Modo edição' : 'Modo visualização'}
              >
                {editMode ? <Pencil className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
              </Button>
              <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => setPerspectiveOpen(true)} disabled={!editMode} title="Perspectiva" aria-label="Perspectiva">
                <Layers className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                className="h-9 w-9"
                onClick={() => {
                  setObjectiveForm(defaultObjectiveForm(map.perspectives[0]?.id));
                  setObjectiveOpen(true);
                }}
                disabled={!editMode || map.perspectives.length === 0}
                title="Objetivo"
                aria-label="Objetivo"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => saveLayout.mutate()} disabled={!editMode || saveLayout.isPending} title="Salvar layout" aria-label="Salvar layout">
                <Save className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="outline" className="h-9 w-9" onClick={autoLayout} disabled={!editMode} title="Organizar" aria-label="Organizar">
                <Compass className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => setPresentationMode(true)} title="Apresentar" aria-label="Apresentar">
                <Presentation className="h-3.5 w-3.5" />
              </Button>
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                {/* Período: combobox (não ícones — cada mês era um Calendar idêntico). */}
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <NativeSelect
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="h-9 w-[160px] text-xs"
                    title="Período"
                    aria-label="Período"
                  >
                    <option value="">Período atual</option>
                    {periodOptions.map((p) => (
                      <option key={p} value={p}>{periodRefLabel(p)}</option>
                    ))}
                  </NativeSelect>
                </div>
                <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => mapQuery.refetch()} disabled={mapQuery.isFetching} title="Atualizar" aria-label="Atualizar">
                  <RefreshCw className={cn('h-3.5 w-3.5', mapQuery.isFetching && 'animate-spin')} />
                </Button>
                <Button size="icon" variant="outline" className="h-9 w-9" onClick={downloadMapPng} title="Baixar Fluxo" aria-label="Baixar Fluxo">
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="outline" className="h-9 w-9" onClick={emailMapPng} title="Fluxo Email" aria-label="Fluxo Email">
                  <Mail className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
          <SectionCard
          title="Canvas estratégico"
          description={editMode ? 'Arraste objetivos, conecte com drag-to-connect, redimensione pelos cantos e clique nas linhas para editar.' : 'Navegue, aproxime e clique no objetivo para abrir o detalhe. Passe o mouse para ver o resumo.'}
          contentClassName="p-0"
        >
          <div
            ref={canvasRef}
            className={cn(
              'relative overflow-hidden rounded-b-lg transition-colors duration-200',
              fullscreen || presentationMode ? 'h-screen bg-background p-4' : 'h-[74vh] bg-muted/5',
            )}
          >
            <ReactFlow
              nodes={nodes}
              edges={computedEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              connectionMode={ConnectionMode.Loose}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={(connection) => {
                if (!editMode || !connection.source || !connection.target) return;
                if (connection.source === connection.target) return;
                setPendingConnection(connection);
                setPendingKind('impacta');
                setPendingLabel('');
              }}
              onNodeDragStop={(_, node) => {
                if (!editMode) return;
                if (node.type === 'objective') {
                  persistObjective(node.id, {
                    positionX: Math.round(node.position.x),
                    positionY: Math.round(node.position.y),
                  });
                }
                if (node.type === 'perspectiveLane') {
                  persistPerspective(node.id, {
                    positionX: Math.round(node.position.x),
                    positionY: Math.round(node.position.y),
                  });
                }
              }}
              onNodeClick={(_, node) => {
                setSelectedId(node.id);
                if (node.type === 'objective') {
                  const found = map?.objectives.find((o) => o.id === node.id);
                  if (found) setDrawerObjective(found);
                }
              }}
              onEdgeClick={(_, edge) => {
                if (!editMode) return;
                openEdgeEditor(edge.id);
              }}
              onPaneClick={() => setSelectedId(null)}
              fitView
              minZoom={0.2}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <svg width="0" height="0">
                <defs>
                  <marker id="g360-arrow" viewBox="0 0 10 10" markerWidth="6" markerHeight="6" refX="8" refY="5" orient="auto">
                    <path d="M0,2 L8,5 L0,8 L2,5 z" fill="currentColor" />
                  </marker>
                </defs>
              </svg>
              <Background gap={20} size={1} color="#cbd5e1" className="opacity-45" />
            </ReactFlow>

            <div className="absolute right-3 top-3 z-10 flex flex-wrap gap-1.5">
              <Button variant="outline" size="sm" onClick={toggleFullscreen} title="Tela cheia">
                {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
              {presentationMode && (
                <Button variant="outline" size="sm" onClick={() => setPresentationMode(false)} title="Sair do modo apresentacao">
                  <Monitor className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 rounded-md border bg-background/95 px-4 py-1.5 text-[11px] shadow-sm backdrop-blur">
              <div className="flex items-center gap-2 font-semibold uppercase text-muted-foreground">
                <Layers className="h-3 w-3" /> Tipos de relação:
              </div>
              {RELATION_KINDS.map((rel) => (
                <div key={rel.kind} className="flex items-center gap-1.5">
                  <span style={{ background: rel.color }} className="h-2 w-4 rounded" />
                  {rel.label}
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Detalhes" description="Edite o item selecionado e acompanhe sua rastreabilidade.">
            {!selectedPerspective && !selectedObjective && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                <Move className="mx-auto mb-2 h-8 w-8 opacity-50" />
                Selecione uma perspectiva ou objetivo no canvas.
              </div>
            )}

            {selectedPerspective && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-[1fr,84px]">
                  <div>
                    <Label>Perspectiva</Label>
                    <Input value={selectedPerspectiveDraft.name} onChange={(event) => setSelectedPerspectiveDraft({ ...selectedPerspectiveDraft, name: event.target.value })} disabled={!editMode} />
                  </div>
                  <div>
                    <Label>Cor</Label>
                    <Input type="color" value={selectedPerspectiveDraft.color} onChange={(event) => setSelectedPerspectiveDraft({ ...selectedPerspectiveDraft, color: event.target.value })} disabled={!editMode} />
                  </div>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea value={selectedPerspectiveDraft.description} onChange={(event) => setSelectedPerspectiveDraft({ ...selectedPerspectiveDraft, description: event.target.value })} disabled={!editMode} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    disabled={!editMode || selectedPerspective.position === 0}
                    onClick={() => movePerspective(map, selectedPerspective.id, -1, reorderPerspectives.mutate)}
                  >
                    Subir
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!editMode || selectedPerspective.position >= map.perspectives.length - 1}
                    onClick={() => movePerspective(map, selectedPerspective.id, 1, reorderPerspectives.mutate)}
                  >
                    Descer
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={!editMode || updatePerspective.isPending}
                    onClick={() => updatePerspective.mutate({ perspectiveId: selectedPerspective.id, patch: selectedPerspectiveDraft })}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Salvar
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!editMode}
                    onClick={() => window.confirm('Inativar esta perspectiva?') && deletePerspective.mutate(selectedPerspective.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {selectedObjective && (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge variant="secondary">{selectedObjective.perspective.name}</Badge>
                    <StatusBadge value={selectedObjective.aggregateLight} label={LIGHT_LABEL[selectedObjective.aggregateLight] ?? selectedObjective.aggregateLight} />
                  </div>
                  <Label>Objetivo</Label>
                  <Input value={selectedObjectiveDraft.name} onChange={(event) => setSelectedObjectiveDraft({ ...selectedObjectiveDraft, name: event.target.value })} disabled={!editMode} />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea value={selectedObjectiveDraft.description} onChange={(event) => setSelectedObjectiveDraft({ ...selectedObjectiveDraft, description: event.target.value })} disabled={!editMode} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Perspectiva</Label>
                    <NativeSelect value={selectedObjectiveDraft.perspectiveId} onChange={(event) => setSelectedObjectiveDraft({ ...selectedObjectiveDraft, perspectiveId: event.target.value })} disabled={!editMode}>
                      {map.perspectives.map((perspective) => (
                        <option key={perspective.id} value={perspective.id}>{perspective.name}</option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <NativeSelect value={selectedObjectiveDraft.status} onChange={(event) => setSelectedObjectiveDraft({ ...selectedObjectiveDraft, status: event.target.value })} disabled={!editMode}>
                      {Object.entries(STATUS_LABEL).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Peso</Label>
                    <Input type="number" value={selectedObjectiveDraft.weight} onChange={(event) => setSelectedObjectiveDraft({ ...selectedObjectiveDraft, weight: Number(event.target.value) })} disabled={!editMode} />
                  </div>
                  <div>
                    <Label>Prioridade</Label>
                    <Input type="number" min={1} max={5} value={selectedObjectiveDraft.priority} onChange={(event) => setSelectedObjectiveDraft({ ...selectedObjectiveDraft, priority: Number(event.target.value) })} disabled={!editMode} />
                  </div>
                </div>
                <div>
                  <Label>Responsável</Label>
                  <NativeSelect value={selectedObjectiveDraft.responsibleUserId} onChange={(event) => setSelectedObjectiveDraft({ ...selectedObjectiveDraft, responsibleUserId: event.target.value })} disabled={!editMode}>
                    <option value="">Sem usuário vinculado</option>
                    {optionsQuery.data?.users.map((user) => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div>
                  <Label>Área ou setor responsável</Label>
                  <NativeSelect value={selectedObjectiveDraft.ownerNodeId} onChange={(event) => setSelectedObjectiveDraft({ ...selectedObjectiveDraft, ownerNodeId: event.target.value })} disabled={!editMode}>
                    <option value="">Sem estrutura vinculada</option>
                    {optionsQuery.data?.orgNodes.map((node) => (
                      <option key={node.id} value={node.id}>{node.name} ({node.type})</option>
                    ))}
                  </NativeSelect>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">Indicadores vinculados</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{selectedObjective.indicators.length}</Badge>
                      {editMode && (
                        <Button variant="outline" size="sm" asChild>
                          <Link href="/indicators">
                            <Plus className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {selectedObjective.indicators.map((indicator) => (
                      <div key={indicator.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs">
                        <span className="truncate">{indicator.code ? `${indicator.code} - ` : ''}{indicator.name}</span>
                        <div className="flex items-center gap-1">
                          <StatusBadge value={indicator.results?.[0]?.light ?? 'GRAY'} label={LIGHT_LABEL[indicator.results?.[0]?.light ?? 'GRAY'] ?? (indicator.results?.[0]?.light ?? 'GRAY')} />
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/indicators/${indicator.id}`}>
                              <Maximize2 className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          {editMode && (
                            <Button variant="ghost" size="sm" onClick={() => detachIndicator.mutate({ objectiveId: selectedObjective.id, indicatorId: indicator.id })}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {selectedObjective.indicators.length === 0 && <p className="text-xs text-muted-foreground">Nenhum indicador vinculado.</p>}
                  </div>
                  {editMode && (
                    <div className="mt-3 grid grid-cols-[1fr,auto] gap-2">
                      <NativeSelect value={indicatorToAttach} onChange={(event) => setIndicatorToAttach(event.target.value)}>
                        <option value="">Selecionar indicador</option>
                        {optionsQuery.data?.indicators.map((indicator) => (
                          <option key={indicator.id} value={indicator.id}>{indicator.code ? `${indicator.code} - ` : ''}{indicator.name}</option>
                        ))}
                      </NativeSelect>
                      <Button variant="outline" disabled={!indicatorToAttach} onClick={() => attachIndicator.mutate({ objectiveId: selectedObjective.id, indicatorId: indicatorToAttach })}>
                        <Link2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border p-3">
                  <div className="mb-2 text-sm font-semibold">Áreas, setores e processos</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedObjective.orgNodeLinks.map((link) => (
                      <Badge key={`${link.orgNode.id}-${link.kind}`} variant="secondary" className="gap-1">
                        {link.orgNode.name}
                        {editMode && (
                          <button onClick={() => detachOrgNode.mutate({ objectiveId: selectedObjective.id, orgNodeId: link.orgNode.id })} className="ml-1 text-muted-foreground hover:text-foreground">
                            x
                          </button>
                        )}
                      </Badge>
                    ))}
                    {selectedObjective.orgNodeLinks.length === 0 && <span className="text-xs text-muted-foreground">Sem estrutura adicional.</span>}
                  </div>
                  {editMode && (
                    <div className="mt-3 grid grid-cols-[1fr,auto] gap-2">
                      <NativeSelect value={orgNodeToAttach} onChange={(event) => setOrgNodeToAttach(event.target.value)}>
                        <option value="">Vincular estrutura</option>
                        {optionsQuery.data?.orgNodes.map((node) => (
                          <option key={node.id} value={node.id}>{node.name} ({node.type})</option>
                        ))}
                      </NativeSelect>
                      <Button variant="outline" disabled={!orgNodeToAttach} onClick={() => attachOrgNode.mutate({ objectiveId: selectedObjective.id, orgNodeId: orgNodeToAttach })}>
                        <Link2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border p-3">
                  <div className="mb-2 text-sm font-semibold">Ligacoes estratégicas</div>
                  <div className="space-y-1 text-xs">
                    {selectedObjective.outRelations.map((relation) => (
                      <div key={relation.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1">
                        <span className="truncate">Impacta {relation.to.name}</span>
                        {editMode && (
                          <Button variant="ghost" size="sm" onClick={() => removeRelation.mutate(relation.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {selectedObjective.inRelations.map((relation) => (
                      <div key={relation.id} className="rounded-md bg-muted/40 px-2 py-1">Impactado por {relation.from.name}</div>
                    ))}
                    {selectedObjective.outRelations.length + selectedObjective.inRelations.length === 0 && <p className="text-muted-foreground">Sem ligacoes cadastradas.</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <Link className="rounded-lg border p-2 hover:bg-muted" href={`/meetings?indicatorId=${selectedObjective.indicators[0]?.id ?? ''}`}>Reunião</Link>
                  <Link className="rounded-lg border p-2 hover:bg-muted" href={`/actions?indicatorId=${selectedObjective.indicators[0]?.id ?? ''}`}>Plano</Link>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={!editMode || updateObjective.isPending}
                    onClick={() => updateObjective.mutate({ objectiveId: selectedObjective.id, patch: selectedObjectiveDraft })}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Salvar objetivo
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!editMode}
                    onClick={() => window.confirm('Inativar este objetivo? Os vínculos serão preservados na auditoria.') && deleteObjective.mutate(selectedObjective.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Versionamento" description="Publique versões para congelar o mapa aprovado.">
            <div className="mb-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => createVersion.mutate(false)}>
                <History className="mr-2 h-4 w-4" />
                Criar versão
              </Button>
              <Button size="sm" onClick={() => createVersion.mutate(true)}>
                <Circle className="mr-2 h-4 w-4" />
                Publicar
              </Button>
            </div>
            <div className="space-y-2">
              {map.versions?.slice(0, 5).map((version) => (
                <div key={version.id} className="rounded-lg border p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">v{version.version} - {version.title}</span>
                    <Badge variant={version.status === 'PUBLISHED' ? 'default' : 'secondary'}>{version.status === 'PUBLISHED' ? 'Publicada' : version.status === 'DRAFT' ? 'Rascunho' : version.status === 'ARCHIVED' ? 'Arquivada' : version.status}</Badge>
                  </div>
                  <div className="mt-1 text-muted-foreground">{formatDate(version.createdAt)} por {version.createdBy?.name ?? 'Sistema'}</div>
                </div>
              ))}
              {map.versions?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma versão criada.</p>}
            </div>
          </SectionCard>
        </div>
      </div>

      <Dialog open={perspectiveOpen} onOpenChange={setPerspectiveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova perspectiva</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Modelo / Preset</Label>
              <NativeSelect
                onChange={(event) => {
                  const val = event.target.value;
                  const preset = PERSPECTIVE_PRESETS.find((p) => p.name === val);
                  if (preset) {
                    setPerspectiveForm({
                      ...perspectiveForm,
                      kind: preset.kind,
                      name: preset.name === 'Personalizado' ? '' : preset.name,
                      color: preset.color,
                      icon: preset.icon,
                    });
                  }
                }}
              >
                {PERSPECTIVE_PRESETS.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr,88px]">
              <div>
                <Label>Nome *</Label>
                <Input value={perspectiveForm.name} onChange={(event) => setPerspectiveForm({ ...perspectiveForm, name: event.target.value })} placeholder="Ex.: Clientes, Operações, Sustentabilidade" />
              </div>
              <div>
                <Label>Cor</Label>
                <Input type="color" value={perspectiveForm.color} onChange={(event) => setPerspectiveForm({ ...perspectiveForm, color: event.target.value })} />
              </div>
            </div>
            <div>
              <Label>Icone ou sigla</Label>
              <Input maxLength={3} value={perspectiveForm.icon} onChange={(event) => setPerspectiveForm({ ...perspectiveForm, icon: event.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={perspectiveForm.description} onChange={(event) => setPerspectiveForm({ ...perspectiveForm, description: event.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPerspectiveOpen(false)}>Cancelar</Button>
            <Button onClick={() => createPerspective.mutate()} disabled={!perspectiveForm.name.trim() || createPerspective.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={objectiveOpen} onOpenChange={setObjectiveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo objetivo estratégico</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Perspectiva *</Label>
              <NativeSelect value={objectiveForm.perspectiveId} onChange={(event) => setObjectiveForm({ ...objectiveForm, perspectiveId: event.target.value })}>
                {map.perspectives.map((perspective) => (
                  <option key={perspective.id} value={perspective.id}>{perspective.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={objectiveForm.name} onChange={(event) => setObjectiveForm({ ...objectiveForm, name: event.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={objectiveForm.description} onChange={(event) => setObjectiveForm({ ...objectiveForm, description: event.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Responsável</Label>
                <NativeSelect value={objectiveForm.responsibleUserId} onChange={(event) => setObjectiveForm({ ...objectiveForm, responsibleUserId: event.target.value })}>
                  <option value="">Sem usuário</option>
                  {optionsQuery.data?.users.map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label>Área ou setor</Label>
                <NativeSelect value={objectiveForm.ownerNodeId} onChange={(event) => setObjectiveForm({ ...objectiveForm, ownerNodeId: event.target.value })}>
                  <option value="">Sem estrutura</option>
                  {optionsQuery.data?.orgNodes.map((node) => (
                    <option key={node.id} value={node.id}>{node.name}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Status</Label>
                <NativeSelect value={objectiveForm.status} onChange={(event) => setObjectiveForm({ ...objectiveForm, status: event.target.value })}>
                  {Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </NativeSelect>
              </div>
              <div>
                <Label>Peso</Label>
                <Input type="number" value={objectiveForm.weight} onChange={(event) => setObjectiveForm({ ...objectiveForm, weight: Number(event.target.value) })} />
              </div>
              <div>
                <Label>Prioridade</Label>
                <Input type="number" min={1} max={5} value={objectiveForm.priority} onChange={(event) => setObjectiveForm({ ...objectiveForm, priority: Number(event.target.value) })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setObjectiveOpen(false)}>Cancelar</Button>
            <Button onClick={() => createObjective.mutate()} disabled={!objectiveForm.name.trim() || !objectiveForm.perspectiveId || createObjective.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Criar objetivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: escolher tipo de relação quando o usuário conecta */}
      <Dialog open={Boolean(pendingConnection)} onOpenChange={(open) => !open && setPendingConnection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova ligacao estratégica</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Escolha o tipo de relação entre os objetivos selecionados.
            </p>
            <div className="grid gap-2">
              {RELATION_KINDS.map((rel) => (
                <button
                  key={rel.kind}
                  type="button"
                  onClick={() => setPendingKind(rel.kind)}
                  className={cn(
                    'flex items-start gap-3 rounded-md border p-3 text-left transition hover:bg-accent/30',
                    pendingKind === rel.kind && 'border-primary bg-accent/30',
                  )}
                >
                  <span style={{ background: rel.color }} className="mt-1 h-3 w-6 shrink-0 rounded" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{rel.label}</div>
                    <div className="text-xs text-muted-foreground">{rel.description}</div>
                  </div>
                </button>
              ))}
            </div>
            <div>
              <Label>Texto exibido na linha (opcional)</Label>
              <Input
                value={pendingLabel}
                onChange={(event) => setPendingLabel(event.target.value)}
                placeholder={kindMeta(pendingKind).label}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingConnection(null)}>Cancelar</Button>
            <Button
              onClick={() =>
                pendingConnection && addRelation.mutate({ connection: pendingConnection, kind: pendingKind, label: pendingLabel })
              }
              disabled={!pendingConnection || addRelation.isPending}
            >
              <Link2 className="mr-2 h-4 w-4" /> Conectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: editar/excluir uma ligacao existente */}
      <Dialog
        open={Boolean(editingEdgeId)}
        onOpenChange={(open) => {
          if (!open) setEditingEdgeId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar ligacao</DialogTitle>
          </DialogHeader>
          {editingRelation && (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                Liga: <strong>{editingRelationCtx?.from.name ?? '...'} </strong> &rarr;{' '}
                <strong>{editingRelation.to?.name ?? '...'}</strong>
              </div>
              <div className="grid gap-2">
                {RELATION_KINDS.map((rel) => (
                  <button
                    key={rel.kind}
                    type="button"
                    onClick={() => setEditingEdgeKind(rel.kind)}
                    className={cn(
                      'flex items-start gap-3 rounded-md border p-2.5 text-left transition hover:bg-accent/30',
                      (editingEdgeKind || editingRelation.kind || 'impacta') === rel.kind && 'border-primary bg-accent/30',
                    )}
                  >
                    <span style={{ background: rel.color }} className="mt-1 h-3 w-6 shrink-0 rounded" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{rel.label}</div>
                      <div className="text-xs text-muted-foreground">{rel.description}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div>
                <Label>Texto exibido</Label>
                <Input
                  value={editingEdgeLabel || editingRelation.label || ''}
                  onChange={(event) => setEditingEdgeLabel(event.target.value)}
                  placeholder={kindMeta(editingEdgeKind || editingRelation.kind || 'impacta').label}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <Label>Lado de Saída (Origem)</Label>
                  <NativeSelect
                    value={editingEdgeSourceHandle}
                    onChange={(event) => setEditingEdgeSourceHandle(event.target.value)}
                  >
                    <option value="auto">Automático (Mais próximo)</option>
                    <option value="top">Superior (Cima)</option>
                    <option value="bottom">Inferior (Baixo)</option>
                    <option value="left">Lado Esquerdo</option>
                    <option value="right">Lado Direito</option>
                  </NativeSelect>
                </div>
                <div>
                  <Label>Lado de Entrada (Destino)</Label>
                  <NativeSelect
                    value={editingEdgeTargetHandle}
                    onChange={(event) => setEditingEdgeTargetHandle(event.target.value)}
                  >
                    <option value="auto">Automático (Mais próximo)</option>
                    <option value="top">Superior (Cima)</option>
                    <option value="bottom">Inferior (Baixo)</option>
                    <option value="left">Lado Esquerdo</option>
                    <option value="right">Lado Direito</option>
                  </NativeSelect>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={!editingEdgeId || removeRelation.isPending}
              onClick={() => {
                if (editingEdgeId && window.confirm('Remover esta ligacao?')) {
                  removeRelation.mutate(editingEdgeId);
                  setEditingEdgeId(null);
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Remover
            </Button>
            <Button variant="ghost" onClick={() => setEditingEdgeId(null)}>Fechar</Button>
            <Button
              disabled={!editingEdgeId || updateRelation.isPending}
              onClick={() => {
                if (!editingEdgeId) return;
                const description = (editingEdgeSourceHandle === 'auto' || editingEdgeTargetHandle === 'auto')
                  ? null
                  : `${editingEdgeSourceHandle}:${editingEdgeTargetHandle}`;
                updateRelation.mutate({
                  relationId: editingEdgeId,
                  kind: editingEdgeKind || editingRelation?.kind || 'impacta',
                  label: editingEdgeLabel || editingRelation?.label || '',
                  description,
                });
              }}
            >
              <Save className="mr-2 h-4 w-4" /> Salvar ligacao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drawer detalhado ao clicar */}
      {drawerObjective && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l bg-background shadow-xl">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/95 p-4 backdrop-blur">
            <div className="min-w-0">
              <div className="text-xs uppercase text-muted-foreground">{drawerObjective.perspective.name}</div>
              <h3 className="truncate text-base font-semibold">{drawerObjective.name}</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setDrawerObjective(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-4 p-4 text-sm">
            <ObjectiveDrawerContent objective={drawerObjective} />
          </div>
        </div>
      )}
    </div>
  );
}

function ObjectiveDrawerContent({ objective }: { objective: Objective }) {
  const indicatorId = objective.indicators[0]?.id ?? '';
  const summary = objectiveHoverSummary(objective);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Badge className={cn('border', LIGHT_CLASS[objective.aggregateLight])} variant="outline">
          {LIGHT_LABEL[objective.aggregateLight] ?? objective.aggregateLight}
        </Badge>
        <Badge variant="secondary">{STATUS_LABEL[objective.status] ?? objective.status}</Badge>
        <Badge variant="outline">P{objective.priority}</Badge>
        <Badge variant="outline">Peso {objective.weight}</Badge>
      </div>
      {objective.description && (
        <p className="text-muted-foreground">{objective.description}</p>
      )}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border p-2">
          <div className="text-muted-foreground">Responsável</div>
          <div className="font-medium">
            {summary.responsible}
          </div>
        </div>
        <div className="rounded-md border p-2">
          <div className="text-muted-foreground">Área/Setor</div>
          <div className="font-medium">{summary.area}</div>
        </div>
        <div className="rounded-md border p-2">
          <div className="text-muted-foreground">Indicadores</div>
          <div className="font-medium">{objective.indicators.length}</div>
        </div>
        <div className="rounded-md border p-2">
          <div className="text-muted-foreground">Atingimento</div>
          <div className="font-medium">{formatPercent(objective.aggregateAttainment)}</div>
        </div>
        <div className="rounded-md border p-2">
          <div className="text-muted-foreground">Ações abertas</div>
          <div className="font-medium">{formatNumber(summary.openActions)}</div>
        </div>
        <div className="rounded-md border p-2">
          <div className="text-muted-foreground">Ações atrasadas</div>
          <div className={cn('font-medium', summary.lateActions > 0 && 'text-rose-600')}>
            {formatNumber(summary.lateActions)}
          </div>
        </div>
        <div className="rounded-md border p-2">
          <div className="text-muted-foreground">Desvios</div>
          <div className={cn('font-medium', objective.deviationCount > 0 && 'text-rose-600')}>
            {formatNumber(objective.deviationCount)}
          </div>
        </div>
        <div className="rounded-md border p-2">
          <div className="text-muted-foreground">Projetos</div>
          <div className="font-medium">{formatNumber(summary.projects)}</div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Indicadores vinculados</div>
        {objective.indicators.length === 0 && (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Nenhum indicador vinculado a este objetivo.
          </div>
        )}
        <div className="space-y-3">
          {objective.indicators.map((indicator) => (
            <IndicatorLinkedCard key={indicator.id} indicator={indicator} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <Link className="rounded-md border p-2 transition hover:bg-accent/35" href={`/actions${indicatorId ? `?indicatorId=${indicatorId}` : ''}`}>
          <ClipboardList className="mx-auto mb-1 h-4 w-4" />
          Ações ({summary.openActions})
          {summary.lateActions > 0 && (
            <span className="mt-0.5 block font-semibold text-rose-600">{summary.lateActions} atrasada(s)</span>
          )}
        </Link>
        <Link className="rounded-md border p-2 transition hover:bg-accent/35" href={`/meetings${indicatorId ? `?indicatorId=${indicatorId}` : ''}`}>
          <Calendar className="mx-auto mb-1 h-4 w-4" /> Reuniões
        </Link>
        <Link className="rounded-md border p-2 transition hover:bg-accent/35" href={`/deviations${indicatorId ? `?indicatorId=${indicatorId}` : ''}`}>
          <ShieldAlert className="mx-auto mb-1 h-4 w-4" /> Desvios ({objective.deviationCount})
        </Link>
        <Link className="rounded-md border p-2 transition hover:bg-accent/35" href="/projects">
          <Layers className="mx-auto mb-1 h-4 w-4" /> Projetos ({summary.projects})
        </Link>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Áreas/setores</div>
        <div className="flex flex-wrap gap-1.5">
          {objective.orgNodeLinks.length === 0 && (
            <span className="text-xs text-muted-foreground">Nenhuma estrutura vinculada.</span>
          )}
          {objective.orgNodeLinks.map((link) => (
            <Badge key={link.id} variant="secondary">{link.orgNode.name}</Badge>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Ligacoes estratégicas</div>
        <div className="space-y-1 text-xs">
          {objective.outRelations.length === 0 && objective.inRelations.length === 0 && (
            <div className="text-muted-foreground">Sem ligacoes cadastradas.</div>
          )}
          {objective.outRelations.map((rel) => (
            <div key={rel.id} className="flex items-center gap-2 rounded-md border bg-muted/20 px-2 py-1">
              <span style={{ background: kindMeta(rel.kind).color }} className="h-2 w-3 rounded" />
              <span className="truncate">
                <span className="font-semibold">{kindMeta(rel.kind).label}</span> &rarr; {rel.to.name}
              </span>
            </div>
          ))}
          {objective.inRelations.map((rel) => (
            <div key={rel.id} className="flex items-center gap-2 rounded-md border bg-muted/20 px-2 py-1">
              <ArrowRight className="h-3 w-3 -scale-x-100" />
              <span className="truncate">
                <span className="font-semibold">{rel.from.name}</span> {kindMeta(rel.kind).label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function IndicatorLinkedCard({ indicator }: { indicator: Indicator }) {
  const [open, setOpen] = useState(false);
  const latest = indicator.results?.[0];
  const latestTarget = latest?.periodRef
    ? indicator.targets?.find((target) => target.periodRef === latest.periodRef)
    : indicator.targets?.[0];
  const actions = [...(indicator.actions ?? [])].sort(sortIndicatorActions);
  const openActions = actions.filter((action) => !ACTION_DONE_STATUSES.has(action.status)).length;
  const lateActions = actions.filter(isActionOverdue).length;

  return (
    <div className="rounded-md border bg-muted/15 p-3 text-xs shadow-sm">
      <div className="flex items-start justify-between gap-2">
        {/* Cabecalho clicavel: expande/recolhe o grafico e as acoes (acordeon) */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
          aria-expanded={open}
        >
          <ChevronDown className={cn('mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-foreground">
              {indicator.code ? `${indicator.code} - ` : ''}{indicator.name}
            </span>
            <span className="mt-0.5 block truncate text-muted-foreground">
              {indicator.ownerNode?.name ?? indicator.responsibleUser?.name ?? 'Sem área vinculada'}
            </span>
          </span>
        </button>
        <span className="flex shrink-0 items-center gap-1.5">
          <StatusBadge value={latest?.light ?? 'GRAY'} label={LIGHT_LABEL[latest?.light ?? 'GRAY']} />
          {/* Abre em nova aba para nao perder o mapa */}
          <Link
            href={`/indicators/${indicator.id}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir indicador em nova aba"
            className="text-muted-foreground transition hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniMetric label="Realizado" value={formatNumber(latest?.value)} />
        <MiniMetric label="Meta" value={formatNumber(latestTarget?.target)} />
        <MiniMetric label="Ating." value={formatPercent(latest?.attainment ?? null)} />
      </div>

      {open && (
        <>
          <IndicatorSparkline indicator={indicator} />

          <div className="mt-3 border-t pt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-semibold uppercase text-muted-foreground">
                <ClipboardList className="h-3.5 w-3.5" />
                Ações vinculadas ({actions.length})
              </div>
              {(openActions > 0 || lateActions > 0) && (
                <div className="flex shrink-0 gap-1">
                  {openActions > 0 && <Badge variant="secondary">{openActions} abertas</Badge>}
                  {lateActions > 0 && <Badge variant="destructive">{lateActions} atrasadas</Badge>}
                </div>
              )}
            </div>

            {actions.length === 0 ? (
              <div className="rounded-md border border-dashed p-2 text-muted-foreground">
                Nenhum plano de ação vinculado a este indicador.
              </div>
            ) : (
              <div className="space-y-2">
                {actions.slice(0, 5).map((action) => (
                  <IndicatorActionRow key={action.id} action={action} />
                ))}
                {actions.length > 5 && (
                  <Link
                    href={`/actions?indicatorId=${indicator.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-md border border-dashed p-2 text-center font-medium text-muted-foreground transition hover:bg-accent/35 hover:text-foreground"
                  >
                    Ver mais {actions.length - 5} ação(ões)
                  </Link>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background/60 px-2 py-1.5">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="truncate font-semibold">{value}</div>
    </div>
  );
}

const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function IndicatorSparkline({ indicator }: { indicator: Indicator }) {
  const data = buildIndicatorChartPoints(indicator);
  const values = data.flatMap((point) => [point.value, point.target]).filter(isFiniteNumber);

  if (values.length === 0) {
    return (
      <div className="mt-3 rounded-md border border-dashed bg-background/50 p-3 text-center text-[11px] text-muted-foreground">
        Sem histórico suficiente para o mini gráfico.
      </div>
    );
  }

  const width = 320;
  const height = 100;
  const padX = 10;
  const padTop = 8;
  const padBottom = 16;
  const maxV = Math.max(...values, 0);
  const minV = Math.min(...values, 0);
  const range = maxV - minV || 1;
  const chartH = height - padTop - padBottom;
  const yFor = (value: number) => padTop + chartH - ((value - minV) / range) * chartH;
  const baselineY = yFor(0);
  const n = data.length;
  const slotW = (width - padX * 2) / Math.max(n, 1);
  const barW = Math.max(3, Math.min(11, slotW * 0.36));

  return (
    <div className="mt-3 rounded-md border bg-background/60 p-2">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase text-muted-foreground">
        <span>Realizado x Meta</span>
        <span>
          {data[0]?.periodRef ? periodRefLabel(data[0].periodRef) : '-'} - {data[n - 1]?.periodRef ? periodRefLabel(data[n - 1].periodRef) : '-'}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full" role="img" aria-label={`Realizado x meta de ${indicator.name}`}>
        <line x1={padX} x2={width - padX} y1={baselineY} y2={baselineY} className="stroke-muted" />
        {data.map((point, index) => {
          const cx = padX + slotW * index + slotW / 2;
          const realColor = LIGHT_STROKE[point.light ?? 'GRAY'] ?? LIGHT_STROKE.GRAY;
          const month = point.periodRef?.match(/^\d{4}-(\d{2})/)?.[1];
          const monthName = month ? MONTH_ABBR[Number(month) - 1] : '';
          return (
            <g key={point.periodRef}>
              {isFiniteNumber(point.target) && (
                <rect
                  x={cx + 1}
                  y={Math.min(yFor(point.target), baselineY)}
                  width={barW}
                  height={Math.max(1, Math.abs(baselineY - yFor(point.target)))}
                  rx="1"
                  fill="#94a3b8"
                  opacity="0.75"
                />
              )}
              {isFiniteNumber(point.value) && (
                <rect
                  x={cx - barW - 1}
                  y={Math.min(yFor(point.value), baselineY)}
                  width={barW}
                  height={Math.max(1, Math.abs(baselineY - yFor(point.value)))}
                  rx="1"
                  fill={realColor}
                />
              )}
              {monthName && n <= 12 && (
                <text x={cx} y={height - 4} textAnchor="middle" className="fill-muted-foreground" fontSize="7">
                  {monthName}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm" style={{ background: LIGHT_STROKE.GREEN }} /> Realizado (cor = farol)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm bg-slate-400" /> Meta
        </span>
      </div>
    </div>
  );
}

function IndicatorActionRow({ action }: { action: IndicatorAction }) {
  const overdue = isActionOverdue(action);
  const progress = clampPercent(action.progress);

  return (
    <Link href={`/actions/${action.id}`} target="_blank" rel="noopener noreferrer" className="block rounded-md border bg-background/60 p-2 transition hover:bg-accent/35">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold text-foreground">{action.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span className={cn('inline-flex items-center gap-1', overdue && 'font-semibold text-rose-600')}>
              <Calendar className="h-3 w-3" />
              {action.dueDate ? formatDate(action.dueDate) : 'Sem prazo'}
            </span>
            <span className="inline-flex items-center gap-1">
              <UserCheck className="h-3 w-3" />
              {action.responsibleUser?.name ?? action.ownerNode?.name ?? 'Sem responsável'}
            </span>
          </div>
        </div>
        <StatusBadge value={action.status} label={ACTION_STATUS_LABEL[action.status] ?? action.status} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full', overdue ? 'bg-rose-600' : 'bg-emerald-600')}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="w-9 text-right text-[10px] font-medium text-muted-foreground">{formatNumber(progress, { maximumFractionDigits: 0 })}%</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>Prioridade: {ACTION_PRIORITY_LABEL[action.priority] ?? action.priority}</span>
        {overdue && <span className="font-semibold text-rose-600">Prazo vencido</span>}
      </div>
    </Link>
  );
}

function buildIndicatorChartPoints(indicator: Indicator) {
  const byPeriod = new Map<string, { periodRef: string; value: number | null; target: number | null; light: string | null }>();
  for (const result of indicator.results ?? []) {
    if (!result.periodRef) continue;
    byPeriod.set(result.periodRef, {
      periodRef: result.periodRef,
      value: isFiniteNumber(result.value) ? result.value : null,
      target: byPeriod.get(result.periodRef)?.target ?? null,
      light: result.light ?? null,
    });
  }
  for (const target of indicator.targets ?? []) {
    const current = byPeriod.get(target.periodRef);
    byPeriod.set(target.periodRef, {
      periodRef: target.periodRef,
      value: current?.value ?? null,
      target: isFiniteNumber(target.target) ? target.target : null,
      light: current?.light ?? null,
    });
  }
  // Ate 12 periodos (ano civil): mostra realizado E meta de Jan a Dez.
  return Array.from(byPeriod.values()).sort((a, b) => a.periodRef.localeCompare(b.periodRef)).slice(-12);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function sortIndicatorActions(a: IndicatorAction, b: IndicatorAction) {
  const aDone = ACTION_DONE_STATUSES.has(a.status);
  const bDone = ACTION_DONE_STATUSES.has(b.status);
  if (aDone !== bDone) return aDone ? 1 : -1;
  const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
  const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
  if (aDue !== bDue) return aDue - bDue;
  return a.title.localeCompare(b.title);
}

function isActionOverdue(action: IndicatorAction) {
  if (!action.dueDate || ACTION_DONE_STATUSES.has(action.status)) return false;
  const due = new Date(action.dueDate);
  due.setHours(23, 59, 59, 999);
  return due.getTime() < Date.now();
}

function clampPercent(value: number | null | undefined) {
  if (!isFiniteNumber(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function laneOffsets(map: StrategicMap): { offsetById: Map<string, number>; heightById: Map<string, number>; widthById: Map<string, number> } {
  const offsetById = new Map<string, number>();
  const heightById = new Map<string, number>();
  const widthById = new Map<string, number>();
  let cursor = 0;
  for (const perspective of map.perspectives) {
    const height = perspective.height ?? LANE_HEIGHT;
    const width = perspective.width ?? LANE_WIDTH;
    offsetById.set(perspective.id, cursor);
    heightById.set(perspective.id, height);
    widthById.set(perspective.id, width);
    cursor += height;
  }
  return { offsetById, heightById, widthById };
}

function buildNodes(
  map: StrategicMap,
  objectives: Objective[],
  editMode: boolean,
  selectedId: string | null,
  onPerspectiveResize?: (perspectiveId: string, width: number, height: number) => void,
): Node[] {
  const objectiveByPerspective = new Map<string, Objective[]>();
  for (const objective of objectives) {
    const list = objectiveByPerspective.get(objective.perspectiveId) ?? [];
    list.push(objective);
    objectiveByPerspective.set(objective.perspectiveId, list);
  }

  const { offsetById, heightById, widthById } = laneOffsets(map);

  const lanes: Node[] = map.perspectives.map((perspective) => {
    const width = widthById.get(perspective.id) ?? LANE_WIDTH;
    const height = heightById.get(perspective.id) ?? LANE_HEIGHT;
    const hasSavedPos = (perspective.positionX ?? 0) !== 0 || (perspective.positionY ?? 0) !== 0;
    return {
      id: perspective.id,
      type: 'perspectiveLane',
      position: {
        x: hasSavedPos ? (perspective.positionX ?? LANE_X) : LANE_X,
        y: hasSavedPos ? (perspective.positionY ?? 0) : (offsetById.get(perspective.id) ?? 0),
      },
      data: {
        perspective,
        objectiveCount: objectiveByPerspective.get(perspective.id)?.length ?? 0,
        editMode,
        onResize: onPerspectiveResize ? (w: number, h: number) => onPerspectiveResize(perspective.id, w, h) : undefined,
      },
      draggable: editMode,
      selectable: editMode,
      style: { width, height: Math.max(height - 20, 130), zIndex: -1 },
      width,
      height,
    } satisfies Node;
  });

  const objectiveNodes = objectives.map((objective) => {
    const indexInsideLane = objectiveByPerspective.get(objective.perspectiveId)?.findIndex((item) => item.id === objective.id) ?? 0;
    const laneY = offsetById.get(objective.perspectiveId) ?? 0;
    const defaultX = OBJECTIVE_START_X + (indexInsideLane % 3) * 310;
    const defaultY = laneY + 46 + Math.floor(indexInsideLane / 3) * 96;
    const hasSavedPosition = objective.positionX !== 0 || objective.positionY !== 0;
    const width = objective.width ?? 260;
    const height = objective.height ?? 150;
    const propagated = (objective.baseLight ?? objective.aggregateLight) !== objective.aggregateLight;
    return {
      id: objective.id,
      type: 'objective',
      position: {
        x: hasSavedPosition ? objective.positionX : defaultX,
        y: hasSavedPosition ? objective.positionY : defaultY,
      },
      data: { objective, selected: selectedId === objective.id, editMode, propagated },
      draggable: editMode,
      style: { zIndex: 10, width, height },
      width,
      height,
    } satisfies Node;
  });

  return [...lanes, ...objectiveNodes];
}

function toFlowEdge(
  relation: Objective['outRelations'][number],
  sourceId: string,
  onEdgeDragStop?: (edgeId: string, offsetX: number, offsetY: number) => void,
  editMode?: boolean,
): Edge {
  const meta = kindMeta(relation.kind);
  let sourceHandle: string | undefined;
  let targetHandle: string | undefined;
  const relAny = relation as any;
  if (relAny.description && relAny.description.includes(':')) {
    const parts = relAny.description.split(':');
    if (isManualHandle(parts[0]) && isManualHandle(parts[1])) {
      sourceHandle = parts[0];
      targetHandle = parts[1];
    }
  }
  return {
    id: relation.id,
    source: sourceId,
    target: relation.to.id,
    type: 'strategy',
    sourceHandle,
    targetHandle,
    data: {
      kind: relation.kind ?? 'impacta',
      label: relation.label ?? meta.label,
      description: relAny.description,
      editMode,
      onEdgeDragStop,
    },
  };
}

function perspectiveForY(map: StrategicMap | undefined, y: number) {
  if (!map?.perspectives.length) return null;
  let cursor = 0;
  for (const perspective of map.perspectives) {
    const height = perspective.height ?? LANE_HEIGHT;
    if (y < cursor + height) return perspective;
    cursor += height;
  }
  return map.perspectives[map.perspectives.length - 1] ?? null;
}

function movePerspective(map: StrategicMap, perspectiveId: string, direction: -1 | 1, mutate: (ids: string[]) => void) {
  const sorted = [...map.perspectives].sort((a, b) => a.position - b.position);
  const index = sorted.findIndex((perspective) => perspective.id === perspectiveId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= sorted.length) return;
  const [item] = sorted.splice(index, 1);
  sorted.splice(targetIndex, 0, item);
  mutate(sorted.map((perspective) => perspective.id));
}

function defaultPerspectiveForm() {
  return { kind: 'CUSTOM', name: '', description: '', color: '#2563eb', icon: '' };
}

function formFromPerspective(perspective: Perspective) {
  return {
    kind: perspective.kind,
    name: perspective.name,
    description: perspective.description ?? '',
    color: perspective.color ?? '#2563eb',
    icon: perspective.icon ?? '',
  };
}

function defaultObjectiveForm(perspectiveId = '') {
  return {
    perspectiveId,
    name: '',
    description: '',
    responsible: '',
    responsibleUserId: '',
    ownerNodeId: '',
    status: 'PLANNED',
    weight: 1,
    priority: 3,
  };
}

function formFromObjective(objective: Objective) {
  return {
    perspectiveId: objective.perspectiveId,
    name: objective.name,
    description: objective.description ?? '',
    responsible: objective.responsible ?? '',
    responsibleUserId: objective.responsibleUserId ?? '',
    ownerNodeId: objective.ownerNodeId ?? '',
    status: objective.status,
    weight: objective.weight,
    priority: objective.priority,
  };
}
