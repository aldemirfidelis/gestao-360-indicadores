'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import ReactFlow, {
  Background,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  MiniMap,
  NodeResizer,
  NodeToolbar,
  Position,
  getRectOfNodes,
  getSmoothStepPath,
  getTransformForBounds,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type EdgeChange,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng } from 'html-to-image';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  CircleCheck,
  Circle,
  ClipboardList,
  Download,
  ExternalLink,
  History,
  LayoutGrid,
  Layers,
  Link2,
  Loader2,
  Mail,
  Maximize2,
  Minimize2,
  Monitor,
  Network,
  Move,
  PanelRightOpen,
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
import { useAuth } from '@/components/auth/auth-provider';
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
import { api, ApiError } from '@/lib/api';
import { cn, formatDate, formatNumber, formatPercent, periodRefLabel } from '@/lib/utils';
import { ACTION_PRIORITY_LABEL, ACTION_STATUS_LABEL } from '@/lib/labels';
import {
  CARD_MIN_HEIGHT,
  CARD_MIN_WIDTH,
  LANE_HEADER_WIDTH,
  LAYOUT_GRID,
  arrangeLayout,
  cardPosition,
  deriveLayout,
  dropLane,
  layoutChanges,
  moveCards,
  resizeCard,
  type LayoutChanges,
  type MapLayout,
} from '@/lib/strategy-map-layout';
import { useVision360 } from '@/components/ui/vision360-context';

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
  { kind: 'vinculado', label: 'Está vinculado a', description: 'Ligação livre entre A e B', color: '#64748b' },
  { kind: 'responsável', label: 'Responsável por', description: 'A responde pela execução de B', color: '#db2777' },
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

interface LaneData {
  perspective: Perspective;
  objectiveCount: number;
  editMode: boolean;
  isDropTarget: boolean;
  onAddObjective: (perspectiveId: string) => void;
}

// Faixa da perspectiva: fundo fixo que não captura o mouse, então arrastar o
// fundo move o mapa. Só o rótulo responde: o clique seleciona a perspectiva.
function PerspectiveLane({ data }: NodeProps<LaneData>) {
  const perspective = data.perspective;
  const color = perspective.color ?? '#64748b';

  return (
    <div
      className="flex h-full w-full overflow-hidden rounded-xl border transition-shadow"
      style={{
        borderColor: `${color}66`,
        background: `linear-gradient(to right, ${color}${data.isDropTarget ? '30' : '14'}, ${color}05), hsl(var(--background))`,
        boxShadow: data.isDropTarget ? `0 0 0 3px ${color}` : undefined,
      }}
    >
      <div
        className="nopan flex shrink-0 cursor-pointer select-none flex-col justify-center gap-1.5 px-4 text-white"
        style={{ width: LANE_HEADER_WIDTH, background: color, pointerEvents: 'all' }}
        title={perspective.description || `Perspectiva ${perspective.name}`}
      >
        <div className="text-sm font-bold uppercase leading-tight tracking-wide drop-shadow-sm">{perspective.name}</div>
        <div className="text-[11px] font-medium text-white/85">
          {data.objectiveCount} {data.objectiveCount === 1 ? 'objetivo' : 'objetivos'}
        </div>
        {data.editMode && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              data.onAddObjective(perspective.id);
            }}
            className="mt-1 inline-flex w-fit items-center gap-1 rounded-md bg-white/20 px-2 py-1 text-[11px] font-semibold transition hover:bg-white/35"
          >
            <Plus className="h-3 w-3" /> Objetivo
          </button>
        )}
      </div>
      {data.isDropTarget && (
        <div className="flex flex-1 items-start justify-end p-3">
          <span className="rounded-md px-2 py-1 text-xs font-semibold text-white shadow" style={{ background: color }}>
            Soltar em {perspective.name}
          </span>
        </div>
      )}
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

interface ObjectiveNodeData {
  objective: Objective;
  editMode: boolean;
  onResizeEnd: (objectiveId: string, box: { x: number; y: number; width: number; height: number }) => void;
  onStartLink: (objectiveId: string) => void;
  onOpenDetails: (objectiveId: string) => void;
}

// Pontos de ligação centrados nas bordas, para não disputar o arraste do card.
const HANDLE_SIDES = [
  { id: 'top', position: Position.Top, style: { top: -8 } },
  { id: 'right', position: Position.Right, style: { right: -8 } },
  { id: 'bottom', position: Position.Bottom, style: { bottom: -8 } },
  { id: 'left', position: Position.Left, style: { left: -8 } },
] as const;

function ObjectiveNode({ id, data, selected }: NodeProps<ObjectiveNodeData>) {
  const objective = data.objective;
  const light = objective.aggregateLight;
  const isDarkColor = light === 'GREEN' || light === 'RED';
  const summary = objectiveHoverSummary(objective);
  return (
    <div
      className={cn(
        'group relative flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-4 py-3 text-center shadow-md transition-shadow',
        LIGHT_CLASS[light] ?? LIGHT_CLASS.GRAY,
        data.editMode && 'cursor-grab active:cursor-grabbing',
        selected && 'shadow-xl ring-4 ring-primary/50',
      )}
    >
      {data.editMode && (
        <>
          <NodeResizer
            minWidth={CARD_MIN_WIDTH}
            minHeight={CARD_MIN_HEIGHT}
            isVisible={selected}
            handleStyle={{ width: 10, height: 10, borderRadius: 3, background: 'hsl(var(--primary))', border: '2px solid white' }}
            lineStyle={{ borderColor: 'hsl(var(--primary))' }}
            onResizeEnd={(_, params) => data.onResizeEnd(id, params)}
          />
          <NodeToolbar position={Position.Top} offset={12}>
            <div className="flex items-center gap-1 rounded-lg border bg-background p-1 shadow-lg">
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => data.onStartLink(id)}>
                <Link2 className="mr-1 h-3.5 w-3.5" /> Ligar a…
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => data.onOpenDetails(id)}>
                <PanelRightOpen className="mr-1 h-3.5 w-3.5" /> Detalhes
              </Button>
            </div>
          </NodeToolbar>
        </>
      )}
      {HANDLE_SIDES.map((side) => (
        <Handle
          key={side.id}
          id={side.id}
          type="source"
          position={side.position}
          isConnectable={data.editMode}
          title={data.editMode ? 'Arraste até outro objetivo para criar uma ligação' : undefined}
          style={side.style}
          className={cn(
            '!h-4 !w-4 !rounded-full !border-2 !border-white !bg-primary !shadow-md transition-opacity',
            data.editMode ? 'opacity-0 hover:ring-4 hover:ring-primary/30 group-hover:opacity-100' : '!pointer-events-none opacity-0',
            data.editMode && selected && 'opacity-100',
          )}
        />
      ))}
      <div className={cn('line-clamp-3 text-[15px] font-bold leading-snug', isDarkColor ? 'text-white' : 'text-foreground')}>
        {objective.name}
      </div>
      <div className={cn('line-clamp-1 text-[11px]', isDarkColor ? 'text-white/80' : 'text-muted-foreground')}>
        {summary.responsible}
      </div>
    </div>
  );
}

interface StrategyEdgeData {
  kind: string;
  label?: string | null;
  description?: string | null;
  editMode?: boolean;
  onRouteChange: (edgeId: string, offsetX: number, offsetY: number) => void;
  onEdit: (edgeId: string) => void;
  onRemove: (edgeId: string) => void;
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
  markerEnd,
}: EdgeProps<StrategyEdgeData>) {
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

  // O desvio gravado desloca o trecho do meio da linha (o mesmo campo usado
  // pelas rotas antigas), então ligações já ajustadas mantêm o caminho.
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 14,
    centerX: (sourceX + targetX) / 2 + localOffset.x,
    centerY: (sourceY + targetY) / 2 + localOffset.y,
  });
  const meta = kindMeta(data?.kind);
  const title = data?.label && data.label !== meta.label ? `${meta.label}: ${data.label}` : meta.label;
  const editing = Boolean(selected && data?.editMode);

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
    data?.onRouteChange(
      id,
      Math.round(currentOffset.current.x),
      Math.round(currentOffset.current.y),
    );
  };

  return (
    <>
      <path d={path} fill="none" stroke="transparent" strokeWidth={22} className="react-flow__edge-interaction">
        <title>{title}</title>
      </path>
      <path
        id={id}
        d={path}
        markerEnd={markerEnd}
        fill="none"
        style={{
          stroke: meta.color,
          strokeWidth: selected ? 4 : 2.5,
          strokeDasharray: data?.kind === 'depende' ? '8 5' : undefined,
          filter: 'drop-shadow(0 1px 1px rgba(15, 23, 42, 0.18))',
        }}
        className="react-flow__edge-path"
      />
      {editing && (
        <g>
          <circle
            cx={labelX}
            cy={labelY}
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
            className="nodrag nopan"
          >
            <title>Arraste para desviar a linha</title>
          </circle>
          <circle cx={labelX} cy={labelY} r={3.5} fill={meta.color} style={{ pointerEvents: 'none' }} />
        </g>
      )}
      {editing && !isDragging && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute flex items-center gap-1 rounded-lg border bg-background p-1 shadow-lg"
            style={{ transform: `translate(-50%, calc(-100% - 14px)) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'all' }}
          >
            <span className="px-1.5 text-[11px] font-semibold" style={{ color: meta.color }}>{meta.label}</span>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => data?.onEdit(id)}>
              <Pencil className="mr-1 h-3 w-3" /> Editar
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => data?.onRemove(id)}>
              <Trash2 className="mr-1 h-3 w-3" /> Remover
            </Button>
          </div>
        </EdgeLabelRenderer>
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
  const { open: openVision360 } = useVision360();
  const qc = useQueryClient();
  const reactFlow = useReactFlow();
  const { user, hasPermission } = useAuth();
  const authScope = `${user?.id ?? 'anon'}:${user?.companyId ?? 'none'}`;
  // A demonstração e perfis só de consulta não veem o modo edição (o backend recusaria).
  const canEdit = !user?.isDemo && hasPermission(['strategy:objectives:update', 'strategy:manage']);
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
  const [pendingTarget, setPendingTarget] = useState('');
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
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const pendingSaves = useRef(0);
  const dropTargetRef = useRef<string | null>(null);
  const editModeRef = useRef(editMode);

  const mapQueryKey = useMemo(() => ['strategy', 'map', authScope, id, period] as const, [authScope, id, period]);
  const mapQuery = useQuery<StrategicMap>({
    queryKey: mapQueryKey,
    queryFn: () =>
      api<StrategicMap>(`/strategy/maps/${id}${period ? `?periodRef=${encodeURIComponent(period)}` : ''}`),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const optionsQuery = useQuery<StrategyOptions>({
    queryKey: ['strategy', 'options', authScope],
    queryFn: () => api<StrategyOptions>('/strategy/options'),
  });

  const map = mapQuery.isError ? undefined : mapQuery.data;
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

  const layout = useMemo(() => (map ? deriveLayout(map.perspectives, map.objectives) : null), [map]);
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);
  useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);

  // Salvamento automático do layout. O cache do mapa muda na hora porque o canvas
  // é reconstruído a partir dele: sem isso o card voltaria para a posição antiga
  // ao clicar em qualquer lugar. As gravações vão em fila para não chegarem fora
  // de ordem ao servidor.
  const commitLayout = useCallback(
    (next: MapLayout) => {
      const current = mapRef.current;
      if (!current) return;
      const changes = layoutChanges(next, current.perspectives, current.objectives);
      if (!changes.objectives.length && !changes.lanes.length) return;
      void qc.cancelQueries({ queryKey: mapQueryKey });
      qc.setQueryData<StrategicMap>(mapQueryKey, (old) => (old ? applyLayoutChanges(old, changes) : old));
      pendingSaves.current += 1;
      setSaveState('saving');
      saveQueue.current = saveQueue.current
        .then(() => api(`/strategy/maps/${id}/layout`, { method: 'PATCH', json: { nodes: changes.objectives, lanes: changes.lanes } }))
        .then(() => {
          pendingSaves.current -= 1;
          if (pendingSaves.current === 0) setSaveState('saved');
          // Outros períodos do mesmo mapa ainda guardam o layout anterior no cache.
          void qc.invalidateQueries({ queryKey: ['strategy', 'map', authScope, id], refetchType: 'none' });
        })
        .catch((error: unknown) => {
          pendingSaves.current -= 1;
          setSaveState('error');
          toast.error(error instanceof Error && error.message ? error.message : 'Não foi possível salvar o layout');
          void qc.invalidateQueries({ queryKey: ['strategy', 'map', authScope, id] });
        });
    },
    [authScope, id, mapQueryKey, qc],
  );

  // Aplica o layout calculado nos nós já existentes, sem esperar o cache: o card
  // encaixa na grade e na faixa no mesmo instante em que é solto.
  const showLayout = useCallback(
    (next: MapLayout) => {
      dropTargetRef.current = null;
      setNodes((current) =>
        current.map((node) => {
          if (node.type === 'perspectiveLane') {
            const lane = next.lanes.find((item) => item.perspectiveId === node.id);
            if (!lane) return node;
            return {
              ...node,
              position: { x: 0, y: lane.top },
              style: { ...node.style, width: next.width, height: lane.height },
              width: next.width,
              height: lane.height,
              data: { ...node.data, isDropTarget: false },
            };
          }
          const card = next.cards.get(node.id);
          if (!card) return node;
          return { ...node, position: cardPosition(next, card), style: { ...node.style, width: card.width, height: card.height } };
        }),
      );
    },
    [setNodes],
  );

  const showDropTarget = useCallback(
    (laneId: string | null) => {
      if (dropTargetRef.current === laneId) return;
      dropTargetRef.current = laneId;
      setNodes((current) =>
        current.map((node) =>
          node.type === 'perspectiveLane' ? { ...node, data: { ...node.data, isDropTarget: node.id === laneId } } : node,
        ),
      );
    },
    [setNodes],
  );

  const handleNodeDrag = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const current = layoutRef.current;
      const card = node.type === 'objective' ? current?.cards.get(node.id) : undefined;
      if (!current || !card) return;
      const lane = dropLane(current.lanes, card.perspectiveId, node.position.y + card.height / 2);
      showDropTarget(lane && lane.perspectiveId !== card.perspectiveId ? lane.perspectiveId : null);
    },
    [showDropTarget],
  );

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node, dragged: Node[]) => {
      const current = layoutRef.current;
      if (!current || !editModeRef.current) return;
      const moves = (dragged?.length ? dragged : [node])
        .filter((item) => item.type === 'objective')
        .map((item) => ({ id: item.id, x: item.position.x, y: item.position.y }));
      if (!moves.length) return;
      const next = moveCards(current, moves);
      for (const move of moves) {
        const from = current.cards.get(move.id)?.perspectiveId;
        const to = next.cards.get(move.id)?.perspectiveId;
        if (!from || !to || from === to) continue;
        const objective = mapRef.current?.objectives.find((item) => item.id === move.id);
        const perspective = mapRef.current?.perspectives.find((item) => item.id === to);
        toast.success(`"${objective?.name ?? 'Objetivo'}" agora está em ${perspective?.name ?? 'outra perspectiva'}`);
      }
      showLayout(next);
      commitLayout(next);
    },
    [commitLayout, showLayout],
  );

  const handleResizeEnd = useCallback(
    (objectiveId: string, box: { x: number; y: number; width: number; height: number }) => {
      const current = layoutRef.current;
      if (!current) return;
      const next = resizeCard(current, objectiveId, box);
      showLayout(next);
      commitLayout(next);
    },
    [commitLayout, showLayout],
  );

  // Nada some do canvas sem passar pela API: remoções locais (tecla Delete) são ignoradas.
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => onNodesChange(changes.filter((change) => change.type !== 'remove')),
    [onNodesChange],
  );
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => onEdgesChange(changes.filter((change) => change.type !== 'remove')),
    [onEdgesChange],
  );

  // Os nós recebem ações estáveis que leem a versão atual pelo ref; assim o
  // canvas não é reconstruído a cada renderização da tela.
  const actionsRef = useRef<(CanvasActions & { deleteRelation: (relationId: string) => void }) | null>(null);
  const canvasActions = useMemo<CanvasActions>(
    () => ({
      addObjective: (perspectiveId) => actionsRef.current?.addObjective(perspectiveId),
      startLink: (objectiveId) => actionsRef.current?.startLink(objectiveId),
      openDetails: (objectiveId) => actionsRef.current?.openDetails(objectiveId),
      resizeEnd: (objectiveId, box) => actionsRef.current?.resizeEnd(objectiveId, box),
      editEdge: (edgeId) => actionsRef.current?.editEdge(edgeId),
      removeEdge: (edgeId) => actionsRef.current?.removeEdge(edgeId),
      routeEdge: (edgeId, offsetX, offsetY) => actionsRef.current?.routeEdge(edgeId, offsetX, offsetY),
    }),
    [],
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

  function arrangeMap() {
    const current = layoutRef.current;
    if (!current) return;
    if (!window.confirm('Organizar os objetivos em linhas dentro de cada perspectiva? As posições atuais serão substituídas.')) return;
    const next = arrangeLayout(current);
    showLayout(next);
    commitLayout(next);
    window.setTimeout(() => reactFlow.fitView({ duration: 400, padding: 0.08 }), 60);
  }

  useEffect(() => {
    if (selectedPerspective) setSelectedPerspectiveDraft(formFromPerspective(selectedPerspective));
    if (selectedObjective) setSelectedObjectiveDraft(formFromObjective(selectedObjective));
    setIndicatorToAttach('');
    setOrgNodeToAttach('');
  }, [selectedPerspective, selectedObjective]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['strategy', 'map', authScope, id] });
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
      toast.success('Ligação criada');
      setPendingConnection(null);
      setPendingTarget('');
      setPendingLabel('');
      setPendingKind('impacta');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao criar ligação'),
  });

  const updateRelation = useMutation({
    mutationFn: ({ relationId, kind, label, description }: { relationId: string; kind: string; label: string; description: string | null }) =>
      api(`/strategy/relations/${relationId}`, {
        method: 'PATCH',
        json: { kind, label: label || kindMeta(kind).label, description },
      }),
    onSuccess: () => {
      toast.success('Ligação atualizada');
      setEditingEdgeId(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao atualizar ligação'),
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

  // O canvas é reconstruído só quando o mapa, o filtro ou o modo mudam. Selecionar
  // um card não reconstrói nada (antes reconstruía e desfazia o último arrasto).
  useEffect(() => {
    if (!map || !layout) return;
    const flowNodes = buildNodes(map, layout, filteredObjectives, editMode, canvasActions);
    const visibleIds = new Set(filteredObjectives.filter((objective) => layout.cards.has(objective.id)).map((objective) => objective.id));
    const flowEdges = filteredObjectives
      .filter((objective) => visibleIds.has(objective.id))
      .flatMap((objective) =>
        objective.outRelations
          .filter((relation) => visibleIds.has(relation.to.id))
          .map((relation) => toFlowEdge(relation, objective.id, editMode, canvasActions)),
      );
    setNodes((current) => keepSelection(current, flowNodes));
    setEdges((current) => keepSelection(current, flowEdges));
  }, [canvasActions, editMode, filteredObjectives, layout, map, setEdges, setNodes]);

  const removeRelation = useMutation({
    mutationFn: (relationId: string) => api(`/strategy/relations/${relationId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Ligação removida');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao remover ligação'),
  });

  useEffect(() => {
    actionsRef.current = {
      addObjective: (perspectiveId) => {
        setObjectiveForm(defaultObjectiveForm(perspectiveId));
        setObjectiveOpen(true);
      },
      startLink: (objectiveId) => {
        setPendingConnection({ source: objectiveId, target: null, sourceHandle: null, targetHandle: null });
        setPendingTarget('');
        setPendingKind('impacta');
        setPendingLabel('');
      },
      openDetails: (objectiveId) => {
        const found = mapRef.current?.objectives.find((objective) => objective.id === objectiveId);
        if (found) setDrawerObjective(found);
      },
      resizeEnd: handleResizeEnd,
      editEdge: openEdgeEditor,
      removeEdge: (edgeId) => {
        if (window.confirm('Remover esta ligação?')) removeRelation.mutate(edgeId);
      },
      routeEdge: handleEdgeDragStop,
      deleteRelation: (relationId) => removeRelation.mutate(relationId),
    };
  });

  const handleEdgesDelete = useCallback((deleted: Edge[]) => {
    if (!editModeRef.current || !deleted.length) return;
    if (!window.confirm(deleted.length === 1 ? 'Remover esta ligação?' : `Remover ${deleted.length} ligações?`)) return;
    deleted.forEach((edge) => actionsRef.current?.deleteRelation(edge.id));
  }, []);

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
  if (mapQuery.isError) {
    const status = mapQuery.error instanceof ApiError ? mapQuery.error.status : undefined;
    const description = status === 404 || status === 403
      ? 'Este mapa não pertence a sua empresa ou você não tem permissão para acessa-lo.'
      : 'Não foi possível carregar o mapa agora.';
    return (
      <SectionCard title="Mapa indisponível" description={description}>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild>
            <Link href="/strategy">Voltar aos mapas da minha empresa</Link>
          </Button>
          <Button variant="outline" onClick={() => mapQuery.refetch()}>
            Tentar novamente
          </Button>
        </div>
      </SectionCard>
    );
  }
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
              {canEdit && (
                <Button size="sm" variant={editMode ? 'default' : 'outline'} className="h-9" onClick={() => setEditMode((value) => !value)}>
                  {editMode ? <Check className="mr-1.5 h-4 w-4" /> : <Pencil className="mr-1.5 h-4 w-4" />}
                  {editMode ? 'Concluir edição' : 'Editar mapa'}
                </Button>
              )}
              {canEdit && editMode && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9"
                    onClick={() => {
                      setObjectiveForm(defaultObjectiveForm(map.perspectives[0]?.id));
                      setObjectiveOpen(true);
                    }}
                    disabled={map.perspectives.length === 0}
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Objetivo
                  </Button>
                  <Button size="sm" variant="outline" className="h-9" onClick={() => setPerspectiveOpen(true)}>
                    <Layers className="mr-1.5 h-4 w-4" /> Perspectiva
                  </Button>
                  <Button size="sm" variant="outline" className="h-9" onClick={arrangeMap} title="Distribui os objetivos em linhas dentro de cada perspectiva">
                    <LayoutGrid className="mr-1.5 h-4 w-4" /> Organizar
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" className="h-9" onClick={() => setPresentationMode(true)}>
                <Presentation className="mr-1.5 h-4 w-4" /> Apresentar
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
          description={
            editMode
              ? 'Arraste os cards (solte sobre outra faixa para mudar a perspectiva), puxe os pontos azuis até outro objetivo para ligar e redimensione pelos cantos. Shift + arrastar seleciona vários. Tudo é salvo automaticamente.'
              : 'Arraste o fundo para navegar, use a roda do mouse para aproximar e clique em um objetivo para ver o detalhe.'
          }
          actions={editMode ? <LayoutSaveStatus state={saveState} /> : undefined}
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
              connectionRadius={70}
              connectionLineType={ConnectionLineType.SmoothStep}
              connectionLineStyle={{ stroke: 'hsl(var(--primary))', strokeWidth: 2.5 }}
              nodesDraggable={editMode}
              nodesConnectable={editMode}
              snapToGrid={editMode}
              snapGrid={[LAYOUT_GRID, LAYOUT_GRID]}
              nodeDragThreshold={4}
              deleteKeyCode={editMode ? ['Delete', 'Backspace'] : null}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onEdgesDelete={handleEdgesDelete}
              onConnect={(connection) => {
                if (!editMode || !connection.source || !connection.target) return;
                if (connection.source === connection.target) return;
                setPendingConnection(connection);
                setPendingTarget('');
                setPendingKind('impacta');
                setPendingLabel('');
              }}
              onNodeDrag={handleNodeDrag}
              onNodeDragStop={handleNodeDragStop}
              onNodeClick={(_, node) => {
                setSelectedId(node.id);
                // Na edição o clique só seleciona (o painel ao lado edita); na
                // visualização ele abre o detalhe completo do objetivo.
                if (node.type === 'objective' && !editMode) {
                  const found = map?.objectives.find((o) => o.id === node.id);
                  if (found) setDrawerObjective(found);
                }
              }}
              onNodeDoubleClick={(_, node) => {
                if (node.type !== 'objective') return;
                const found = map?.objectives.find((o) => o.id === node.id);
                if (found) setDrawerObjective(found);
              }}
              onEdgeDoubleClick={(_, edge) => {
                if (editMode) openEdgeEditor(edge.id);
              }}
              onPaneClick={() => setSelectedId(null)}
              fitView
              fitViewOptions={{ padding: 0.08 }}
              minZoom={0.15}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={20} size={1} color="#cbd5e1" className="opacity-45" />
              <Controls showInteractive={false} position="bottom-left" />
              <MiniMap
                pannable
                zoomable
                position="bottom-right"
                className="hidden md:block"
                maskColor="rgba(15, 23, 42, 0.08)"
                nodeBorderRadius={6}
                nodeColor={(node) =>
                  node.type === 'objective'
                    ? LIGHT_STROKE[(node.data as ObjectiveNodeData).objective.aggregateLight] ?? LIGHT_STROKE.GRAY
                    : `${(node.data as LaneData).perspective.color ?? '#94a3b8'}33`
                }
              />
            </ReactFlow>

            <div className="absolute right-3 top-3 z-10 flex flex-wrap gap-1.5">
              <Button variant="outline" size="sm" onClick={toggleFullscreen} title="Tela cheia">
                {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
              {presentationMode && (
                <Button variant="outline" size="sm" onClick={() => setPresentationMode(false)} title="Sair do modo apresentação">
                  <Monitor className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <div className="pointer-events-none absolute bottom-3 left-16 right-3 z-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 rounded-md border bg-background/95 px-4 py-1.5 text-[11px] shadow-sm backdrop-blur md:right-[236px]">
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
                          <Button variant="ghost" size="sm" onClick={() => openVision360('INDICATOR', indicator.id)} title="Visão 360°">
                            <Network className="h-3.5 w-3.5 text-primary" />
                          </Button>
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
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">Ligações estratégicas</span>
                    {editMode && (
                      <Button variant="outline" size="sm" onClick={() => canvasActions.startLink(selectedObjective.id)}>
                        <Link2 className="mr-1 h-3.5 w-3.5" /> Nova ligação
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1 text-xs">
                    {selectedObjective.outRelations.map((relation) => (
                      <div key={relation.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span style={{ background: kindMeta(relation.kind).color }} className="h-2 w-3 shrink-0 rounded" />
                          <span className="truncate">{kindMeta(relation.kind).label} {relation.to.name}</span>
                        </span>
                        {editMode && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.confirm('Remover esta ligação?') && removeRelation.mutate(relation.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {selectedObjective.inRelations.map((relation) => (
                      <div key={relation.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1">
                        <ArrowRight className="h-3 w-3 shrink-0 -scale-x-100" />
                        <span className="truncate">{relation.from.name} ({kindMeta(relation.kind).label.toLowerCase()})</span>
                      </div>
                    ))}
                    {selectedObjective.outRelations.length + selectedObjective.inRelations.length === 0 && <p className="text-muted-foreground">Sem ligações cadastradas.</p>}
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
                    onClick={() =>
                      updateObjective.mutate({
                        objectiveId: selectedObjective.id,
                        // Trocar a perspectiva por aqui leva o card para a primeira vaga
                        // livre da faixa nova; a posição antiga não vale na outra faixa.
                        patch:
                          selectedObjectiveDraft.perspectiveId !== selectedObjective.perspectiveId
                            ? { ...selectedObjectiveDraft, positionX: 0, positionY: 0 }
                            : selectedObjectiveDraft,
                      })
                    }
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
            <DialogTitle>Nova ligação estratégica</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Escolha o tipo de relação entre os objetivos selecionados.
            </p>
            {pendingConnection && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs">
                <div className="text-muted-foreground">De</div>
                <div className="font-semibold">{map.objectives.find((o) => o.id === pendingConnection.source)?.name ?? '...'}</div>
                {pendingConnection.target ? (
                  <>
                    <div className="mt-2 text-muted-foreground">Para</div>
                    <div className="font-semibold">{map.objectives.find((o) => o.id === pendingConnection.target)?.name ?? '...'}</div>
                  </>
                ) : (
                  <div className="mt-2 space-y-1">
                    <Label>Para qual objetivo?</Label>
                    <NativeSelect value={pendingTarget} onChange={(event) => setPendingTarget(event.target.value)}>
                      <option value="">Selecione o objetivo de destino</option>
                      {map.perspectives.map((perspective) => (
                        <optgroup key={perspective.id} label={perspective.name}>
                          {map.objectives
                            .filter((o) => o.perspectiveId === perspective.id && o.id !== pendingConnection.source)
                            .map((o) => (
                              <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                        </optgroup>
                      ))}
                    </NativeSelect>
                  </div>
                )}
              </div>
            )}
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
                pendingConnection &&
                addRelation.mutate({
                  connection: { ...pendingConnection, target: pendingConnection.target || pendingTarget },
                  kind: pendingKind,
                  label: pendingLabel,
                })
              }
              disabled={!pendingConnection || !(pendingConnection.target || pendingTarget) || addRelation.isPending}
            >
              <Link2 className="mr-2 h-4 w-4" /> Conectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: editar/excluir uma ligação existente */}
      <Dialog
        open={Boolean(editingEdgeId)}
        onOpenChange={(open) => {
          if (!open) setEditingEdgeId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar ligação</DialogTitle>
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
                if (editingEdgeId && window.confirm('Remover esta ligação?')) {
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
              <Save className="mr-2 h-4 w-4" /> Salvar ligação
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
        <Link className="rounded-md border p-2 transition hover:bg-accent/35" href={`/projects/cronograma${indicatorId ? `?indicatorId=${indicatorId}` : ''}`}>
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

interface CanvasActions {
  addObjective: (perspectiveId: string) => void;
  startLink: (objectiveId: string) => void;
  openDetails: (objectiveId: string) => void;
  resizeEnd: (objectiveId: string, box: { x: number; y: number; width: number; height: number }) => void;
  editEdge: (edgeId: string) => void;
  removeEdge: (edgeId: string) => void;
  routeEdge: (edgeId: string, offsetX: number, offsetY: number) => void;
}

function LayoutSaveStatus({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
        <AlertTriangle className="h-3.5 w-3.5" /> Falha ao salvar o layout
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> {state === 'saved' ? 'Alterações salvas' : 'Salvamento automático'}
    </span>
  );
}

function keepSelection<T extends { id: string; selected?: boolean }>(current: T[], next: T[]): T[] {
  const selected = new Set(current.filter((item) => item.selected).map((item) => item.id));
  if (!selected.size) return next;
  return next.map((item) => (selected.has(item.id) ? { ...item, selected: true } : item));
}

/** Reflete no mapa em cache o que o PATCH de layout grava, inclusive a troca de perspectiva. */
function applyLayoutChanges(map: StrategicMap, changes: LayoutChanges): StrategicMap {
  const lanes = new Map(changes.lanes.map((lane) => [lane.id, lane]));
  const cards = new Map(changes.objectives.map((card) => [card.id, card]));
  const perspectives = map.perspectives.map((perspective) => ({ ...perspective, ...lanes.get(perspective.id) }));
  const perspectiveById = new Map(perspectives.map((perspective) => [perspective.id, perspective]));
  return {
    ...map,
    perspectives,
    objectives: map.objectives.map((objective) => {
      const card = cards.get(objective.id);
      if (!card) return objective;
      return {
        ...objective,
        perspectiveId: card.perspectiveId,
        perspective: perspectiveById.get(card.perspectiveId) ?? objective.perspective,
        positionX: card.positionX,
        positionY: card.positionY,
        width: card.width,
        height: card.height,
      };
    }),
  };
}

function buildNodes(map: StrategicMap, layout: MapLayout, objectives: Objective[], editMode: boolean, actions: CanvasActions): Node[] {
  const counts = new Map<string, number>();
  for (const card of layout.cards.values()) counts.set(card.perspectiveId, (counts.get(card.perspectiveId) ?? 0) + 1);
  const perspectiveById = new Map(map.perspectives.map((perspective) => [perspective.id, perspective]));

  // Faixas são fundo: não arrastam, não selecionam e não capturam o mouse.
  const lanes = layout.lanes.flatMap((lane): Node<LaneData>[] => {
    const perspective = perspectiveById.get(lane.perspectiveId);
    if (!perspective) return [];
    return [
      {
        id: perspective.id,
        type: 'perspectiveLane',
        position: { x: 0, y: lane.top },
        data: {
          perspective,
          objectiveCount: counts.get(perspective.id) ?? 0,
          editMode,
          isDropTarget: false,
          onAddObjective: actions.addObjective,
        },
        draggable: false,
        selectable: false,
        connectable: false,
        deletable: false,
        focusable: false,
        zIndex: -1,
        style: { width: layout.width, height: lane.height, pointerEvents: 'none' },
        width: layout.width,
        height: lane.height,
      },
    ];
  });

  const cards = objectives.flatMap((objective): Node<ObjectiveNodeData>[] => {
    const card = layout.cards.get(objective.id);
    if (!card) return [];
    return [
      {
        id: objective.id,
        type: 'objective',
        position: cardPosition(layout, card),
        data: {
          objective,
          editMode,
          onResizeEnd: actions.resizeEnd,
          onStartLink: actions.startLink,
          onOpenDetails: actions.openDetails,
        },
        draggable: editMode,
        connectable: editMode,
        deletable: false,
        zIndex: 10,
        style: { width: card.width, height: card.height },
        width: card.width,
        height: card.height,
      },
    ];
  });

  return [...lanes, ...cards];
}

function toFlowEdge(relation: Objective['outRelations'][number], sourceId: string, editMode: boolean, actions: CanvasActions): Edge<StrategyEdgeData> {
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
    markerEnd: { type: MarkerType.ArrowClosed, color: meta.color, width: 16, height: 16, markerUnits: 'userSpaceOnUse' },
    data: {
      kind: relation.kind ?? 'impacta',
      label: relation.label ?? meta.label,
      description: relAny.description,
      editMode,
      onRouteChange: actions.routeEdge,
      onEdit: actions.editEdge,
      onRemove: actions.removeEdge,
    },
  };
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
