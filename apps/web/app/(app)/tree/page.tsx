'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { GitBranch, Maximize2, Plus, Save, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { StatusBadge } from '@/components/platform/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

interface MapNodeRecord {
  id: string;
  type: string;
  refTable: string | null;
  refId: string | null;
  label: string;
  status: string | null;
  responsible: string | null;
  dueDate: string | null;
  positionX: number;
  positionY: number;
  data?: unknown;
}

interface MapEdgeRecord {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  kind: string;
  label: string | null;
}

interface RelationshipMap {
  id: string;
  name: string;
  description: string | null;
  mode: string;
  nodes: MapNodeRecord[];
  edges: MapEdgeRecord[];
}

const TYPE_LABEL: Record<string, string> = {
  COMPANY: 'Empresa',
  GUIDELINE: 'Diretriz',
  SECTOR: 'Setor',
  AREA: 'Area',
  PROCESS: 'Processo',
  INDICATOR: 'Indicador',
  DEVIATION: 'Desvio',
  MEETING: 'Reuniao',
  ACTION: 'Plano de acao',
  EXECUTION: 'Execucao',
  FOLLOW_UP: 'Acompanhamento',
  CONCLUSION: 'Conclusao',
  OBJECTIVE: 'Objetivo',
  OKR: 'OKR',
  PROJECT: 'Projeto',
  CUSTOM: 'Livre',
};

const TYPE_TONE: Record<string, string> = {
  COMPANY: 'border-primary/50 bg-primary/10',
  GUIDELINE: 'border-status-purple/50 bg-status-purple/10',
  SECTOR: 'border-status-blue/40 bg-status-blue/10',
  AREA: 'border-status-blue/30 bg-status-blue/5',
  PROCESS: 'border-muted-foreground/30 bg-muted/40',
  INDICATOR: 'border-status-green/40 bg-status-green/10',
  DEVIATION: 'border-status-orange/50 bg-status-orange/10',
  MEETING: 'border-status-purple/40 bg-status-purple/10',
  ACTION: 'border-status-yellow/50 bg-status-yellow/10',
  CUSTOM: 'border-border bg-card',
};

function RelationNode({ data }: NodeProps<{ node: MapNodeRecord; selected: boolean }>) {
  const node = data.node;
  return (
    <div
      className={cn(
        'min-w-[220px] rounded-lg border-2 bg-card px-3 py-2 shadow-sm',
        TYPE_TONE[node.type] ?? TYPE_TONE.CUSTOM,
        data.selected && 'ring-2 ring-primary',
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="rounded border bg-background/70 px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
          {TYPE_LABEL[node.type] ?? node.type}
        </span>
        {node.status && <StatusBadge value={node.status} label={node.status} />}
      </div>
      <div className="line-clamp-2 text-sm font-semibold leading-tight">{node.label}</div>
      <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span className="truncate">{node.responsible ?? node.refTable ?? 'Sem responsavel'}</span>
        {node.dueDate && <span>{formatDate(node.dueDate)}</span>}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
    </div>
  );
}

const nodeTypes = { relation: RelationNode };

export default function TreePage() {
  const qc = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newNode, setNewNode] = useState({ label: '', type: 'CUSTOM', responsible: '', status: 'PLANNED' });

  const mapQuery = useQuery<RelationshipMap>({
    queryKey: ['relationship-map', 'default'],
    queryFn: () => api<RelationshipMap>('/relationship-map/default'),
  });

  useEffect(() => {
    if (!mapQuery.data) return;
    setNodes(mapQuery.data.nodes.map(toFlowNode));
    setEdges(mapQuery.data.edges.map(toFlowEdge));
  }, [mapQuery.data, setEdges, setNodes]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return mapQuery.data?.nodes.find((node) => node.id === selectedId) ?? null;
  }, [mapQuery.data?.nodes, selectedId]);

  const createNode = useMutation({
    mutationFn: () =>
      api('/relationship-map/nodes', {
        method: 'POST',
        json: {
          mapId: mapQuery.data?.id,
          label: newNode.label,
          type: newNode.type,
          responsible: newNode.responsible || undefined,
          status: newNode.status || undefined,
          positionX: 420,
          positionY: 80,
        },
      }),
    onSuccess: () => {
      toast.success('Bloco criado');
      setCreateOpen(false);
      setNewNode({ label: '', type: 'CUSTOM', responsible: '', status: 'PLANNED' });
      qc.invalidateQueries({ queryKey: ['relationship-map'] });
    },
  });

  const createEdge = useMutation({
    mutationFn: (connection: Connection) =>
      api('/relationship-map/edges', {
        method: 'POST',
        json: {
          mapId: mapQuery.data?.id,
          sourceNodeId: connection.source,
          targetNodeId: connection.target,
          kind: 'manual',
          label: 'relacao',
        },
      }),
    onSuccess: () => {
      toast.success('Conexao criada');
      qc.invalidateQueries({ queryKey: ['relationship-map'] });
    },
  });

  const saveLayout = useMutation({
    mutationFn: () =>
      api(`/relationship-map/${mapQuery.data?.id}/layout`, {
        method: 'POST',
        json: {
          mode: 'TRACEABILITY',
          nodes: nodes.map((node) => ({
            id: node.id,
            positionX: node.position.x,
            positionY: node.position.y,
          })),
        },
      }),
    onSuccess: () => {
      toast.success('Layout salvo');
      qc.invalidateQueries({ queryKey: ['relationship-map'] });
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Visualizacao"
        tone="view"
        title="Mapa de Relacoes"
        description="Fluxo rastreavel da empresa: estrutura, indicadores, desvios, reunioes, planos de acao e execucao."
        breadcrumbs={[{ label: 'Inicio', href: '/' }, { label: 'Visualizacao', href: '/visualization' }, { label: 'Mapa de relacoes' }]}
        actions={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo bloco
            </Button>
            <Button onClick={() => saveLayout.mutate()} disabled={!mapQuery.data || saveLayout.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Salvar layout
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr,360px]">
        <SectionCard
          title={mapQuery.data?.name ?? 'Mapa 360'}
          description={mapQuery.data?.description ?? 'Carregando relacoes corporativas.'}
          contentClassName="p-0"
        >
          <div className="h-[72vh] overflow-hidden rounded-b-lg bg-muted/25">
            {mapQuery.isLoading ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">Montando mapa...</div>
            ) : (
              <ReactFlow
                nodes={nodes.map((node) => ({ ...node, data: { ...node.data, selected: node.id === selectedId } }))}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={(connection) => {
                  setEdges((eds) => addEdge({ ...connection, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
                  createEdge.mutate(connection);
                }}
                onNodeClick={(_, node) => setSelectedId(node.id)}
                onPaneClick={() => setSelectedId(null)}
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background gap={24} />
                <MiniMap pannable zoomable />
                <Controls />
              </ReactFlow>
            )}
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Detalhes do bloco" description="Clique em um bloco para consultar o contexto.">
            {!selected && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                <GitBranch className="mx-auto mb-2 h-8 w-8 opacity-40" />
                Selecione um bloco para ver status, responsavel, prazo e origem.
              </div>
            )}
            {selected && (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded border bg-muted px-2 py-1 text-[10px] font-semibold uppercase">
                      {TYPE_LABEL[selected.type] ?? selected.type}
                    </span>
                    {selected.status && <StatusBadge value={selected.status} label={selected.status} />}
                  </div>
                  <h3 className="text-base font-semibold">{selected.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selected.responsible ?? 'Sem responsavel definido'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="text-[10px] uppercase text-muted-foreground">Prazo</div>
                    <div className="font-medium">{formatDate(selected.dueDate)}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="text-[10px] uppercase text-muted-foreground">Origem</div>
                    <div className="truncate font-medium">{selected.refTable ?? 'Manual'}</div>
                  </div>
                </div>
                {selected.refId && (
                  <Button variant="outline" className="w-full" asChild>
                    <a href={hrefForNode(selected)}>
                      <Maximize2 className="mr-2 h-4 w-4" />
                      Abrir registro
                    </a>
                  </Button>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Modos de uso" description="O mesmo mapa apoia operacao, analise e apresentacao.">
            <div className="space-y-2 text-sm">
              {['Modo arvore', 'Modo livre', 'Modo rastreabilidade', 'Modo apresentacao'].map((mode) => (
                <div key={mode} className="flex items-center gap-2 rounded-lg border p-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {mode}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo bloco no mapa</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={newNode.label} onChange={(e) => setNewNode({ ...newNode, label: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <NativeSelect value={newNode.type} onChange={(e) => setNewNode({ ...newNode, type: e.target.value })}>
                  {Object.entries(TYPE_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Input value={newNode.status} onChange={(e) => setNewNode({ ...newNode, status: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Responsavel</Label>
              <Input value={newNode.responsible} onChange={(e) => setNewNode({ ...newNode, responsible: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={() => createNode.mutate()} disabled={!newNode.label.trim() || createNode.isPending}>
              {createNode.isPending ? 'Criando...' : 'Criar bloco'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toFlowNode(node: MapNodeRecord): Node {
  return {
    id: node.id,
    type: 'relation',
    position: { x: node.positionX, y: node.positionY },
    data: { node, selected: false },
  };
}

function toFlowEdge(edge: MapEdgeRecord): Edge {
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
    label: edge.label ?? undefined,
    style: { stroke: edge.kind === 'manual' ? '#2563eb' : '#94a3b8' },
  };
}

function hrefForNode(node: MapNodeRecord) {
  if (node.refTable === 'Indicator') return `/indicators/${node.refId}`;
  if (node.refTable === 'Deviation') return `/deviations/${node.refId}`;
  if (node.refTable === 'ActionPlan') return `/actions/${node.refId}`;
  if (node.refTable === 'Meeting') return `/meetings/${node.refId}`;
  if (node.refTable === 'OrgNode') return '/org';
  return '#';
}
