'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import ReactFlow, {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  MiniMap,
  NodeResizer,
  Position,
  addEdge,
  getBezierPath,
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
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Circle,
  ClipboardList,
  Compass,
  ExternalLink,
  Filter,
  GripVertical,
  History,
  Layers,
  Link2,
  Maximize2,
  Minimize2,
  Monitor,
  Move,
  Network,
  Pencil,
  Plus,
  Presentation,
  Save,
  Search,
  ShieldAlert,
  Sliders,
  Target,
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
import { cn, formatDate, formatPercent } from '@/lib/utils';

interface Perspective {
  id: string;
  kind: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  position: number;
  active: boolean;
}

interface Indicator {
  id: string;
  name: string;
  code: string | null;
  status?: string;
  ownerNode?: { id: string; name: string; type?: string };
  responsibleUser?: { id: string; name: string };
  results?: { light: string; attainment: number | null; value?: number; periodRef?: string }[];
  targets?: { target: number; periodRef: string }[];
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
  treatmentCount: number;
  deviationCount: number;
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
  YELLOW: 'Atencao',
  RED: 'Critico',
  GRAY: 'Sem dados',
};

const LIGHT_CLASS: Record<string, string> = {
  GREEN: 'border-status-green/50 bg-status-green/10',
  YELLOW: 'border-status-yellow/60 bg-status-yellow/10',
  RED: 'border-status-red/60 bg-status-red/10',
  GRAY: 'border-muted-foreground/30 bg-muted/40',
};

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
  { kind: 'gera_acao', label: 'Gera acao', description: 'A motiva um plano de acao em B', color: '#f97316' },
  { kind: 'vinculado', label: 'Esta vinculado a', description: 'Ligacao livre entre A e B', color: '#64748b' },
  { kind: 'responsavel', label: 'Responsavel por', description: 'A responde pela execucao de B', color: '#db2777' },
];

const RELATION_KIND_MAP = new Map(RELATION_KINDS.map((rel) => [rel.kind, rel]));

function kindMeta(kind?: string | null): RelationKindMeta {
  return RELATION_KIND_MAP.get(kind ?? 'impacta') ?? RELATION_KINDS[1];
}

function PerspectiveLane({ data }: NodeProps<{ perspective: Perspective; objectiveCount: number }>) {
  const perspective = data.perspective;
  return (
    <div className="h-full w-full rounded-lg border bg-background/80 shadow-sm" style={{ borderColor: perspective.color ?? undefined }}>
      <div className="flex h-full gap-4 p-4">
        <div className="w-[230px] shrink-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-md border bg-card text-sm font-bold" style={{ color: perspective.color ?? undefined }}>
              {perspective.icon || perspective.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <div className="text-sm font-semibold">{perspective.name}</div>
              <div className="text-[11px] uppercase text-muted-foreground">{data.objectiveCount} objetivo(s)</div>
            </div>
          </div>
          {perspective.description && <p className="line-clamp-4 text-xs text-muted-foreground">{perspective.description}</p>}
        </div>
        <div className="min-h-full flex-1 rounded-md border border-dashed bg-muted/20" />
      </div>
    </div>
  );
}

function ObjectiveNode({
  data,
  selected,
}: NodeProps<{ objective: Objective; selected: boolean; editMode: boolean; propagated: boolean }>) {
  const objective = data.objective;
  const light = objective.aggregateLight;
  const baseLight = objective.baseLight ?? objective.aggregateLight;
  const propagatedOnly = data.propagated && baseLight !== light;
  const offIndicators = objective.indicators.filter((indicator) => indicator.results?.[0]?.light === 'RED').length;
  return (
    <div
      className={cn(
        'flex h-full w-full flex-col rounded-lg border-2 bg-card p-3 shadow-md transition',
        LIGHT_CLASS[light] ?? LIGHT_CLASS.GRAY,
        (selected || data.selected) && 'ring-2 ring-primary',
        light === 'RED' && 'animate-[pulse_3s_ease-in-out_infinite]',
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
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />
      <Handle type="target" position={Position.Top} id="t" className="!bg-muted-foreground" />
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-semibold leading-tight">{objective.name}</div>
          <div className="mt-1 truncate text-[11px] text-muted-foreground">
            {objective.responsibleUser?.name ?? objective.responsible ?? objective.ownerNode?.name ?? 'Sem responsavel'}
          </div>
        </div>
        {data.editMode && <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        <Badge variant="secondary">{objective.indicators.length} ind.</Badge>
        <Badge variant="secondary">{objective.actionCount} acoes</Badge>
        <Badge variant="secondary">P{objective.priority}</Badge>
        {offIndicators > 0 && (
          <Badge className="border border-status-red/40 bg-status-red/10 text-status-red" variant="outline">
            {offIndicators} fora
          </Badge>
        )}
        {propagatedOnly && (
          <Badge className="border border-amber-300 bg-amber-50 text-amber-700" variant="outline">
            <AlertTriangle className="mr-1 h-3 w-3" /> Impacto herdado
          </Badge>
        )}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{LIGHT_LABEL[light] ?? light}</span>
        <span>{formatPercent(objective.aggregateAttainment)}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
      <Handle type="source" position={Position.Bottom} id="b" className="!bg-muted-foreground" />
    </div>
  );
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
}: EdgeProps<{ kind: string; label?: string | null; onPick?: (edgeId: string) => void }>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const meta = kindMeta(data?.kind);
  const label = data?.label ?? meta.label;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd="url(#g360-arrow)"
        style={{
          stroke: meta.color,
          strokeWidth: selected ? 3 : 2,
          opacity: 0.9,
          strokeDasharray: data?.kind === 'depende' ? '6 4' : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            data?.onPick?.(id);
          }}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            background: '#fff',
            border: `1px solid ${meta.color}`,
            color: meta.color,
          }}
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase shadow-sm transition hover:scale-105"
        >
          {label}
        </button>
      </EdgeLabelRenderer>
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
  const [hoveredObjective, setHoveredObjective] = useState<Objective | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [drawerObjective, setDrawerObjective] = useState<Objective | null>(null);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [pendingKind, setPendingKind] = useState<string>('impacta');
  const [pendingLabel, setPendingLabel] = useState<string>('');
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [editingEdgeKind, setEditingEdgeKind] = useState<string>('impacta');
  const [editingEdgeLabel, setEditingEdgeLabel] = useState<string>('');
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);
  const [showIndicatorOverlay, setShowIndicatorOverlay] = useState(true);
  const [showActionOverlay, setShowActionOverlay] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const mapQuery = useQuery<StrategicMap>({
    queryKey: ['strategy', 'map', id],
    queryFn: () => api<StrategicMap>(`/strategy/maps/${id}`),
  });

  const optionsQuery = useQuery<StrategyOptions>({
    queryKey: ['strategy', 'options'],
    queryFn: () => api<StrategyOptions>('/strategy/options'),
  });

  const map = mapQuery.data;

  const filteredObjectives = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (map?.objectives ?? []).filter((objective) => {
      if (perspectiveFilter && objective.perspectiveId !== perspectiveFilter) return false;
      if (statusFilter && objective.aggregateLight !== statusFilter && objective.status !== statusFilter) return false;
      if (onlyCritical && objective.aggregateLight !== 'RED') return false;
      if (onlyOverdue && objective.actionCount === 0 && objective.treatmentCount === 0) return false;
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

  useEffect(() => {
    if (!map) return;
    const flowNodes = buildNodes(map, filteredObjectives, editMode, selectedId);
    const objectiveIds = new Set(filteredObjectives.map((objective) => objective.id));
    const flowEdges = filteredObjectives.flatMap((objective) =>
      objective.outRelations
        .filter((relation) => objectiveIds.has(relation.to.id))
        .map((relation) => toFlowEdge(relation, objective.id, openEdgeEditor)),
    );
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [editMode, filteredObjectives, map, selectedId, setEdges, setNodes, openEdgeEditor]);

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
      document.exitFullscreen().catch(() => {});
    }
  }, [fullscreen]);

  function toggleFullscreen() {
    if (!canvasRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    } else {
      canvasRef.current.requestFullscreen().then(() => setFullscreen(true)).catch(() => {});
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
        json: { fromId: connection.source, toId: connection.target, kind, label: label || kindMeta(kind).label, weight: 1 },
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
    mutationFn: ({ relationId, kind, label }: { relationId: string; kind: string; label: string }) =>
      api(`/strategy/relations/${relationId}`, {
        method: 'PATCH',
        json: { kind, label: label || kindMeta(kind).label },
      }),
    onSuccess: () => {
      toast.success('Ligacao atualizada');
      setEditingEdgeId(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao atualizar ligacao'),
  });

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
      api(`/strategy/objectives/${objectiveId}/orgnodes/${orgNodeId}`, { method: 'POST', json: { kind: 'responsavel' } }),
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
        json: { publish, title: publish ? `Versao publicada - ${new Date().toLocaleDateString('pt-BR')}` : undefined },
      }),
    onSuccess: (_, publish) => {
      toast.success(publish ? 'Mapa publicado' : 'Versao criada');
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRelation?.id]);

  if (mapQuery.isLoading) return <p className="text-sm text-muted-foreground">Carregando mapa estrategico...</p>;
  if (!map) return null;

  return (
    <div className={cn(presentationMode && 'bg-background')}>
      {!presentationMode && (
        <PageHeader
          eyebrow="Estrategia"
          tone="view"
          title={map.name}
          description={`${formatDate(map.startsAt)} - ${formatDate(map.endsAt)}. Mapa visual integrado a indicadores, areas, planos e rastreabilidade.`}
          breadcrumbs={[{ label: 'Mapas estrategicos', href: '/strategy' }, { label: map.name }]}
          actions={
            <>
              <Button variant="outline" asChild>
                <Link href="/strategy">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Link>
              </Button>
              <Button variant={editMode ? 'default' : 'outline'} onClick={() => setEditMode((value) => !value)}>
                <Pencil className="mr-2 h-4 w-4" />
                {editMode ? 'Modo edicao' : 'Modo visualizacao'}
              </Button>
              <Button variant="outline" onClick={() => setPerspectiveOpen(true)} disabled={!editMode}>
                <Plus className="mr-2 h-4 w-4" />
                Perspectiva
              </Button>
              <Button
                onClick={() => {
                  setObjectiveForm(defaultObjectiveForm(map.perspectives[0]?.id));
                  setObjectiveOpen(true);
                }}
                disabled={!editMode || map.perspectives.length === 0}
              >
                <Plus className="mr-2 h-4 w-4" />
                Objetivo
              </Button>
              <Button variant="outline" onClick={() => saveLayout.mutate()} disabled={!editMode || saveLayout.isPending}>
                <Save className="mr-2 h-4 w-4" />
                Salvar layout
              </Button>
              <Button variant="outline" onClick={autoLayout} disabled={!editMode}>
                <Compass className="mr-2 h-4 w-4" />
                Organizar
              </Button>
              <Button variant="outline" onClick={() => setPresentationMode(true)}>
                <Presentation className="mr-2 h-4 w-4" />
                Apresentar
              </Button>
            </>
          }
        />
      )}

      {!presentationMode && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar objetivo, indicador, responsavel ou area" />
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
            title="Mostrar apenas itens criticos"
          >
            <ShieldAlert className="mr-1.5 h-3.5 w-3.5" /> Criticos
          </Button>
          <Button
            variant={onlyOverdue ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOnlyOverdue((v) => !v)}
            title="Itens com acoes ou tratativas em andamento"
          >
            <Calendar className="mr-1.5 h-3.5 w-3.5" /> Com tratativa
          </Button>
          <Button
            variant={onlyUnlinked ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOnlyUnlinked((v) => !v)}
            title="Apenas objetivos sem indicador ou estrutura"
          >
            <Sliders className="mr-1.5 h-3.5 w-3.5" /> Sem vinculo
          </Button>
          <div className="ml-auto flex items-center gap-1 rounded-md border bg-background p-1 text-xs">
            <span className="px-2 text-muted-foreground">Camadas:</span>
            <Button
              variant={showIndicatorOverlay ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setShowIndicatorOverlay((v) => !v)}
            >
              <Target className="mr-1 h-3.5 w-3.5" /> Indicadores
            </Button>
            <Button
              variant={showActionOverlay ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setShowActionOverlay((v) => !v)}
            >
              <ClipboardList className="mr-1 h-3.5 w-3.5" /> Acoes
            </Button>
          </div>
          {(search || statusFilter || perspectiveFilter || onlyCritical || onlyOverdue || onlyUnlinked) && (
            <Button
              variant="ghost"
              size="sm"
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

      <div className={cn('grid grid-cols-1 gap-4', presentationMode ? '' : 'xl:grid-cols-[1fr,390px]')}>
        <SectionCard
          title="Canvas estrategico"
          description={editMode ? 'Arraste objetivos, conecte com drag-to-connect, redimensione pelos cantos e clique nas linhas para editar.' : 'Navegue, aproxime e clique no objetivo para abrir o detalhe. Passe o mouse para ver o resumo.'}
          contentClassName="p-0"
        >
          <div
            ref={canvasRef}
            className={cn(
              'relative overflow-hidden rounded-b-lg bg-muted/20',
              fullscreen || presentationMode ? 'h-screen' : 'h-[74vh]',
            )}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
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
                if (!editMode || node.type !== 'objective') return;
                const targetPerspective = perspectiveForY(map, node.position.y);
                updateObjective.mutate({
                  objectiveId: node.id,
                  patch: {
                    perspectiveId: targetPerspective?.id,
                    positionX: Math.round(node.position.x),
                    positionY: Math.round(node.position.y),
                  },
                });
              }}
              onNodeClick={(_, node) => {
                setSelectedId(node.id);
                const found = map?.objectives.find((o) => o.id === node.id);
                if (found) setDrawerObjective(found);
              }}
              onNodeMouseEnter={(event, node) => {
                if (node.type !== 'objective') return;
                const found = map?.objectives.find((o) => o.id === node.id);
                if (!found) return;
                setHoveredObjective(found);
                setHoverPos({ x: event.clientX + 16, y: event.clientY + 16 });
              }}
              onNodeMouseLeave={() => {
                setHoveredObjective(null);
                setHoverPos(null);
              }}
              onPaneClick={() => setSelectedId(null)}
              fitView
              minZoom={0.2}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <svg width="0" height="0">
                <defs>
                  <marker id="g360-arrow" viewBox="0 0 12 12" markerWidth="10" markerHeight="10" refX="10" refY="6" orient="auto">
                    <path d="M0,0 L0,12 L12,6 z" fill="currentColor" />
                  </marker>
                </defs>
              </svg>
              <Background gap={24} />
              <MiniMap pannable zoomable nodeStrokeColor={() => '#475569'} nodeColor={(node) => {
                const obj = map?.objectives.find((o) => o.id === node.id);
                if (!obj) return '#cbd5e1';
                if (obj.aggregateLight === 'RED') return '#dc2626';
                if (obj.aggregateLight === 'YELLOW') return '#f59e0b';
                if (obj.aggregateLight === 'GREEN') return '#16a34a';
                return '#cbd5e1';
              }} />
              <Controls />
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

            <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-col gap-1 rounded-md border bg-background/95 p-2 text-[10px] shadow">
              <div className="flex items-center gap-2 font-semibold uppercase text-muted-foreground">
                <Layers className="h-3 w-3" /> Tipos de relacao
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-1">
                {RELATION_KINDS.map((rel) => (
                  <div key={rel.kind} className="flex items-center gap-1">
                    <span style={{ background: rel.color }} className="h-2 w-3 rounded" /> {rel.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

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
                  <Label>Descricao</Label>
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
                  <Label>Descricao</Label>
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
                  <Label>Responsavel</Label>
                  <NativeSelect value={selectedObjectiveDraft.responsibleUserId} onChange={(event) => setSelectedObjectiveDraft({ ...selectedObjectiveDraft, responsibleUserId: event.target.value })} disabled={!editMode}>
                    <option value="">Sem usuario vinculado</option>
                    {optionsQuery.data?.users.map((user) => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div>
                  <Label>Area ou setor responsavel</Label>
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
                          <StatusBadge value={indicator.results?.[0]?.light ?? 'GRAY'} label={indicator.results?.[0]?.light ?? 'GRAY'} />
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
                  <div className="mb-2 text-sm font-semibold">Areas, setores e processos</div>
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
                  <div className="mb-2 text-sm font-semibold">Ligacoes estrategicas</div>
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

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <Link className="rounded-lg border p-2 hover:bg-muted" href={`/treatments?indicatorId=${selectedObjective.indicators[0]?.id ?? ''}`}>Analise</Link>
                  <Link className="rounded-lg border p-2 hover:bg-muted" href={`/meetings?indicatorId=${selectedObjective.indicators[0]?.id ?? ''}`}>Reuniao</Link>
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
                    onClick={() => window.confirm('Inativar este objetivo? Os vinculos serao preservados na auditoria.') && deleteObjective.mutate(selectedObjective.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Versionamento" description="Publique versoes para congelar o mapa aprovado.">
            <div className="mb-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => createVersion.mutate(false)}>
                <History className="mr-2 h-4 w-4" />
                Criar versao
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
                    <Badge variant={version.status === 'PUBLISHED' ? 'default' : 'secondary'}>{version.status}</Badge>
                  </div>
                  <div className="mt-1 text-muted-foreground">{formatDate(version.createdAt)} por {version.createdBy?.name ?? 'Sistema'}</div>
                </div>
              ))}
              {map.versions?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma versao criada.</p>}
            </div>
          </SectionCard>
        </div>
      </div>

      <Dialog open={perspectiveOpen} onOpenChange={setPerspectiveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova perspectiva</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr,88px]">
              <div>
                <Label>Nome *</Label>
                <Input value={perspectiveForm.name} onChange={(event) => setPerspectiveForm({ ...perspectiveForm, name: event.target.value })} placeholder="Ex.: Clientes, Operacoes, Sustentabilidade" />
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
              <Label>Descricao</Label>
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
          <DialogHeader><DialogTitle>Novo objetivo estrategico</DialogTitle></DialogHeader>
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
              <Label>Descricao</Label>
              <Textarea value={objectiveForm.description} onChange={(event) => setObjectiveForm({ ...objectiveForm, description: event.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Responsavel</Label>
                <NativeSelect value={objectiveForm.responsibleUserId} onChange={(event) => setObjectiveForm({ ...objectiveForm, responsibleUserId: event.target.value })}>
                  <option value="">Sem usuario</option>
                  {optionsQuery.data?.users.map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label>Area ou setor</Label>
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

      {/* Dialog: escolher tipo de relacao quando o usuario conecta */}
      <Dialog open={Boolean(pendingConnection)} onOpenChange={(open) => !open && setPendingConnection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova ligacao estrategica</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Escolha o tipo de relacao entre os objetivos selecionados.
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
              onClick={() =>
                editingEdgeId &&
                updateRelation.mutate({
                  relationId: editingEdgeId,
                  kind: editingEdgeKind || editingRelation?.kind || 'impacta',
                  label: editingEdgeLabel || editingRelation?.label || '',
                })
              }
            >
              <Save className="mr-2 h-4 w-4" /> Salvar ligacao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hover card flutuante */}
      {hoveredObjective && hoverPos && (
        <div
          style={{ position: 'fixed', left: hoverPos.x, top: hoverPos.y, zIndex: 50 }}
          className="pointer-events-none w-[320px] rounded-xl border bg-background/95 p-4 shadow-2xl backdrop-blur"
        >
          <ObjectiveHoverCard objective={hoveredObjective} />
        </div>
      )}

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

function ObjectiveHoverCard({ objective }: { objective: Objective }) {
  const offIndicators = objective.indicators.filter((i) => i.results?.[0]?.light === 'RED');
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Badge variant="secondary">{objective.perspective.name}</Badge>
        <Badge className={cn('border', LIGHT_CLASS[objective.aggregateLight])} variant="outline">
          {LIGHT_LABEL[objective.aggregateLight] ?? objective.aggregateLight}
        </Badge>
      </div>
      <div className="mt-2 text-base font-semibold leading-snug">{objective.name}</div>
      {objective.description && (
        <div className="mt-1 line-clamp-3 text-xs text-muted-foreground">{objective.description}</div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md border p-2">
          <div className="text-muted-foreground">Indicadores</div>
          <div className="text-base font-semibold">{objective.indicators.length}</div>
        </div>
        <div className="rounded-md border p-2">
          <div className="text-muted-foreground">Fora da meta</div>
          <div className={cn('text-base font-semibold', offIndicators.length > 0 && 'text-status-red')}>
            {offIndicators.length}
          </div>
        </div>
        <div className="rounded-md border p-2">
          <div className="text-muted-foreground">Acoes</div>
          <div className="text-base font-semibold">{objective.actionCount}</div>
        </div>
        <div className="rounded-md border p-2">
          <div className="text-muted-foreground">Atingimento</div>
          <div className="text-base font-semibold">{formatPercent(objective.aggregateAttainment)}</div>
        </div>
      </div>
      {offIndicators.length > 0 && (
        <div className="mt-3 rounded-md border border-status-red/30 bg-status-red/5 p-2 text-[11px]">
          <div className="flex items-center gap-1 font-semibold text-status-red">
            <AlertTriangle className="h-3 w-3" /> Indicadores fora da meta
          </div>
          <div className="mt-1 space-y-0.5">
            {offIndicators.slice(0, 3).map((i) => (
              <div key={i.id} className="truncate text-muted-foreground">- {i.code ? `${i.code} ` : ''}{i.name}</div>
            ))}
            {offIndicators.length > 3 && (
              <div className="text-muted-foreground">+ {offIndicators.length - 3} indicador(es)...</div>
            )}
          </div>
        </div>
      )}
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <UserCheck className="h-3 w-3" />
        {objective.responsibleUser?.name ?? objective.responsible ?? objective.ownerNode?.name ?? 'Sem responsavel'}
      </div>
      <div className="mt-2 border-t pt-2 text-[10px] uppercase text-muted-foreground">
        Clique no objetivo para abrir o detalhe completo.
      </div>
    </div>
  );
}

function ObjectiveDrawerContent({ objective }: { objective: Objective }) {
  const indicatorId = objective.indicators[0]?.id ?? '';
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
          <div className="text-muted-foreground">Responsavel</div>
          <div className="font-medium">
            {objective.responsibleUser?.name ?? objective.responsible ?? '-'}
          </div>
        </div>
        <div className="rounded-md border p-2">
          <div className="text-muted-foreground">Area/Setor</div>
          <div className="font-medium">{objective.ownerNode?.name ?? '-'}</div>
        </div>
        <div className="rounded-md border p-2">
          <div className="text-muted-foreground">Indicadores</div>
          <div className="font-medium">{objective.indicators.length}</div>
        </div>
        <div className="rounded-md border p-2">
          <div className="text-muted-foreground">Atingimento</div>
          <div className="font-medium">{formatPercent(objective.aggregateAttainment)}</div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Indicadores vinculados</div>
        {objective.indicators.length === 0 && (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Nenhum indicador vinculado a este objetivo.
          </div>
        )}
        <div className="space-y-2">
          {objective.indicators.map((indicator) => (
            <Link
              key={indicator.id}
              href={`/indicators/${indicator.id}`}
              className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 p-2 text-xs transition hover:bg-accent/35"
            >
              <span className="truncate">
                {indicator.code ? `${indicator.code} - ` : ''}{indicator.name}
              </span>
              <span className="flex items-center gap-1">
                <StatusBadge value={indicator.results?.[0]?.light ?? 'GRAY'} label={LIGHT_LABEL[indicator.results?.[0]?.light ?? 'GRAY']} />
                <ExternalLink className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <Link className="rounded-md border p-2 transition hover:bg-accent/35" href={`/actions${indicatorId ? `?indicatorId=${indicatorId}` : ''}`}>
          <ClipboardList className="mx-auto mb-1 h-4 w-4" />
          Acoes ({objective.actionCount})
        </Link>
        <Link className="rounded-md border p-2 transition hover:bg-accent/35" href={`/meetings${indicatorId ? `?indicatorId=${indicatorId}` : ''}`}>
          <Calendar className="mx-auto mb-1 h-4 w-4" /> Reunioes
        </Link>
        <Link className="rounded-md border p-2 transition hover:bg-accent/35" href={`/treatments${indicatorId ? `?indicatorId=${indicatorId}` : ''}`}>
          <Network className="mx-auto mb-1 h-4 w-4" /> Tratativas ({objective.treatmentCount})
        </Link>
        <Link className="rounded-md border p-2 transition hover:bg-accent/35" href={`/deviations${indicatorId ? `?indicatorId=${indicatorId}` : ''}`}>
          <ShieldAlert className="mx-auto mb-1 h-4 w-4" /> Desvios ({objective.deviationCount})
        </Link>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Areas/setores</div>
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
        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Ligacoes estrategicas</div>
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

function buildNodes(map: StrategicMap, objectives: Objective[], editMode: boolean, selectedId: string | null): Node[] {
  const objectiveByPerspective = new Map<string, Objective[]>();
  for (const objective of objectives) {
    const list = objectiveByPerspective.get(objective.perspectiveId) ?? [];
    list.push(objective);
    objectiveByPerspective.set(objective.perspectiveId, list);
  }

  const lanes: Node[] = map.perspectives.map((perspective, index) => ({
    id: perspective.id,
    type: 'perspectiveLane',
    position: { x: LANE_X, y: index * LANE_HEIGHT },
    data: { perspective, objectiveCount: objectiveByPerspective.get(perspective.id)?.length ?? 0 },
    draggable: false,
    selectable: true,
    style: { width: LANE_WIDTH, height: LANE_HEIGHT - 20, zIndex: 0 },
  }));

  const objectiveNodes = objectives.map((objective) => {
    const laneIndex = map.perspectives.findIndex((perspective) => perspective.id === objective.perspectiveId);
    const indexInsideLane = objectiveByPerspective.get(objective.perspectiveId)?.findIndex((item) => item.id === objective.id) ?? 0;
    const defaultX = OBJECTIVE_START_X + (indexInsideLane % 3) * 310;
    const defaultY = Math.max(laneIndex, 0) * LANE_HEIGHT + 46 + Math.floor(indexInsideLane / 3) * 96;
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
  onPick: (edgeId: string) => void,
): Edge {
  const meta = kindMeta(relation.kind);
  return {
    id: relation.id,
    source: sourceId,
    target: relation.to.id,
    type: 'strategy',
    data: { kind: relation.kind ?? 'impacta', label: relation.label ?? meta.label, onPick },
  };
}

function perspectiveForY(map: StrategicMap | undefined, y: number) {
  if (!map?.perspectives.length) return null;
  const index = Math.max(0, Math.min(map.perspectives.length - 1, Math.floor((y + LANE_HEIGHT / 3) / LANE_HEIGHT)));
  return map.perspectives[index] ?? null;
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
