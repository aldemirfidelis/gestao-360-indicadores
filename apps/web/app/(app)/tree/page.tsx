'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  type Edge,
  type Node,
  type NodeProps,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface GraphNode {
  id: string;
  label: string;
  code: string | null;
  type: string;
  owner: string;
  light: 'GREEN' | 'YELLOW' | 'RED' | 'GRAY';
  attainment: number | null;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: string;
  weight: number;
}

interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface ImpactRow {
  indicatorId: string;
  name: string;
  code: string | null;
  depth: number;
  accumulatedWeight: number;
  kind: string;
  light: string;
}

const LIGHT_BG: Record<string, string> = {
  GREEN: '#10b98122',
  YELLOW: '#f59e0b22',
  RED: '#ef444422',
  GRAY: '#9ca3af22',
};
const LIGHT_BORDER: Record<string, string> = {
  GREEN: '#10b981',
  YELLOW: '#f59e0b',
  RED: '#ef4444',
  GRAY: '#9ca3af',
};

function IndicatorNode({ data }: NodeProps<{ label: string; code: string | null; light: string; owner: string; selected: boolean }>) {
  return (
    <div
      className={cn(
        'rounded-lg px-3 py-2 border-2 text-xs min-w-[180px] shadow-sm bg-background',
        data.selected && 'ring-2 ring-primary',
      )}
      style={{
        background: LIGHT_BG[data.light] ?? LIGHT_BG.GRAY,
        borderColor: LIGHT_BORDER[data.light] ?? LIGHT_BORDER.GRAY,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="font-medium text-sm leading-tight">{data.label}</div>
      <div className="text-[10px] text-muted-foreground">{data.code ?? '—'} - {data.owner}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
}

const nodeTypes = { indicator: IndicatorNode };

export default function TreePage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const graph = useQuery<Graph>({
    queryKey: ['indicators', 'tree', 'graph'],
    queryFn: () => api<Graph>('/indicators/tree/graph'),
  });

  const impact = useQuery<ImpactRow[]>({
    queryKey: ['indicators', 'impact', selectedId],
    queryFn: () => api<ImpactRow[]>(`/indicators/${selectedId}/impact?depth=4`),
    enabled: !!selectedId,
  });

  const { nodes, edges } = useMemo(() => {
    if (!graph.data) return { nodes: [], edges: [] };
    return layout(graph.data, selectedId);
  }, [graph.data, selectedId]);

  return (
    <div>
      <PageHeader
        title="Arvore de Indicadores"
        description="Visualizacao das relacoes entre indicadores. Clique em um no para simular o impacto."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-4">
        <Card>
          <CardContent className="p-0" style={{ height: '70vh' }}>
            {graph.isLoading ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">Carregando...</div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                onNodeClick={(_, n) => setSelectedId(n.id)}
                onPaneClick={() => setSelectedId(null)}
                proOptions={{ hideAttribution: true }}
              >
                <Background gap={20} />
                <Controls />
              </ReactFlow>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Simulacao de impacto</h3>
              </div>
              {!selectedId && (
                <p className="text-xs text-muted-foreground">
                  Clique em um indicador no diagrama para ver quais outros seriam afetados se ele piorar.
                </p>
              )}
              {selectedId && impact.isLoading && (
                <p className="text-xs text-muted-foreground">Calculando...</p>
              )}
              {selectedId && impact.data && impact.data.length === 0 && (
                <p className="text-xs text-muted-foreground">Este indicador nao tem descendentes.</p>
              )}
              {selectedId && impact.data && impact.data.length > 0 && (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {impact.data.map((i) => (
                    <div
                      key={i.indicatorId}
                      className={cn(
                        'rounded-md border px-3 py-2 text-xs',
                        i.light === 'RED' && 'border-status-red/40',
                        i.light === 'YELLOW' && 'border-status-yellow/40',
                      )}
                    >
                      <div className="font-medium truncate">{i.name}</div>
                      <div className="text-muted-foreground flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[9px]">profundidade {i.depth}</Badge>
                        <span>peso {Math.round(i.accumulatedWeight * 100) / 100}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-xs space-y-1">
              <div className="font-semibold mb-2">Legenda</div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded" style={{ background: LIGHT_BG.GREEN, border: `2px solid ${LIGHT_BORDER.GREEN}` }} />
                Dentro da meta
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded" style={{ background: LIGHT_BG.YELLOW, border: `2px solid ${LIGHT_BORDER.YELLOW}` }} />
                Atencao
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded" style={{ background: LIGHT_BG.RED, border: `2px solid ${LIGHT_BORDER.RED}` }} />
                Critico
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded" style={{ background: LIGHT_BG.GRAY, border: `2px solid ${LIGHT_BORDER.GRAY}` }} />
                Sem dados
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Layout simples por niveis (BFS topologico). Funciona para arvores e
 * grafos pequenos sem ciclos relevantes.
 */
function layout(graph: Graph, selectedId: string | null): { nodes: Node[]; edges: Edge[] } {
  const incoming = new Map<string, number>();
  graph.nodes.forEach((n) => incoming.set(n.id, 0));
  graph.edges.forEach((e) => incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1));

  const adj = new Map<string, string[]>();
  graph.edges.forEach((e) => {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  });

  const level = new Map<string, number>();
  const queue: string[] = [];
  incoming.forEach((deg, id) => {
    if (deg === 0) {
      level.set(id, 0);
      queue.push(id);
    }
  });
  while (queue.length) {
    const cur = queue.shift()!;
    const lv = level.get(cur) ?? 0;
    for (const next of adj.get(cur) ?? []) {
      const nl = Math.max(level.get(next) ?? 0, lv + 1);
      level.set(next, nl);
      queue.push(next);
    }
  }
  // Nodes ainda sem nivel (ciclos) vao para o ultimo nivel
  const maxLevel = Math.max(0, ...Array.from(level.values()));
  graph.nodes.forEach((n) => {
    if (!level.has(n.id)) level.set(n.id, maxLevel + 1);
  });

  // Distribui por niveis
  const byLevel = new Map<number, string[]>();
  level.forEach((lv, id) => {
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv)!.push(id);
  });

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const out: Node[] = [];
  const COL = 260;
  const ROW = 110;
  Array.from(byLevel.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([lv, ids]) => {
      const offset = -((ids.length - 1) * COL) / 2;
      ids.forEach((id, i) => {
        const n = nodeMap.get(id)!;
        out.push({
          id,
          type: 'indicator',
          position: { x: offset + i * COL, y: lv * ROW },
          data: { ...n, selected: id === selectedId },
        });
      });
    });

  const edges: Edge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    type: 'smoothstep',
    animated: e.from === selectedId || e.to === selectedId,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: e.kind === 'NEGATIVE' ? '#ef4444' : '#94a3b8' },
    label: e.weight !== 1 ? String(e.weight) : undefined,
  }));

  return { nodes: out, edges };
}
