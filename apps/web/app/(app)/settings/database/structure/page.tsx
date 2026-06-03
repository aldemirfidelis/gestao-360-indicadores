'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { FileDown, Image as ImageIcon, RefreshCcw, Search } from 'lucide-react';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { DbSchemaGraph } from '@/components/database-admin/types';

const COLS = 6;
const X_GAP = 260;
const Y_GAP = 150;

export default function StructurePage() {
  return (
    <ReactFlowProvider>
      <StructureFlow />
    </ReactFlowProvider>
  );
}

function StructureFlow() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const flowRef = useRef<HTMLDivElement>(null);

  const graph = useQuery<DbSchemaGraph>({
    queryKey: ['db-admin', 'schema-graph'],
    queryFn: () => api<DbSchemaGraph>('/admin/database/schema'),
    refetchOnWindowFocus: false,
  });

  const built = useMemo(() => buildGraph(graph.data, search, showAll), [graph.data, search, showAll]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Sincroniza os nós/arestas calculados com o estado controlado do ReactFlow.
  useEffect(() => {
    setNodes(built.nodes);
    setEdges(built.edges);
  }, [built, setNodes, setEdges]);

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_e, node) => router.push(`/settings/database/tables/${encodeURIComponent(node.id)}`),
    [router],
  );

  async function exportImage(kind: 'png' | 'pdf') {
    const container = flowRef.current?.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!container) return;
    const dataUrl = await toPng(container, { backgroundColor: '#ffffff', cacheBust: true });
    if (kind === 'png') {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'estrutura-banco.png';
      a.click();
      return;
    }
    const img = new Image();
    img.src = dataUrl;
    await new Promise((r) => (img.onload = r));
    const pdf = new jsPDF({ orientation: img.width > img.height ? 'landscape' : 'portrait', unit: 'px', format: [img.width, img.height] });
    pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
    pdf.save('estrutura-banco.pdf');
  }

  const totalTables = graph.data?.tables.length ?? 0;
  const totalRels = graph.data?.relationships.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Estrutura e Relacionamentos</h2>
          <p className="text-sm text-muted-foreground">
            {graph.data ? `${totalTables} tabelas · ${totalRels} relacionamentos · ${nodes.length} no diagrama` : 'Diagrama ER'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="w-48 pl-9" placeholder="Destacar tabela..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button variant={showAll ? 'default' : 'outline'} size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Todas as tabelas' : 'Só relacionadas'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => graph.refetch()} disabled={graph.isFetching}>
            <RefreshCcw className={cn('mr-2 h-4 w-4', graph.isFetching && 'animate-spin')} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportImage('png')} disabled={!graph.data}>
            <ImageIcon className="mr-2 h-4 w-4" />
            PNG
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportImage('pdf')} disabled={!graph.data}>
            <FileDown className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {graph.isLoading && <LoadingState label="Montando diagrama..." />}
      {graph.isError && (
        <div className="rounded-lg border border-status-red/30 bg-status-red/10 p-4 text-sm">{(graph.error as Error)?.message}</div>
      )}

      {graph.data && (
        <div ref={flowRef} className="h-[72vh] overflow-hidden rounded-lg border bg-muted/5">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.05}
            nodesDraggable
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} />
            <Controls />
            <MiniMap pannable zoomable nodeStrokeWidth={3} />
          </ReactFlow>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Clique em uma tabela para abrir sua estrutura. Por padrão mostra apenas tabelas com relacionamento; use “Todas as tabelas” para ver o catálogo completo.
      </p>
    </div>
  );
}

function buildGraph(data: DbSchemaGraph | undefined, search: string, showAll: boolean): { nodes: Node[]; edges: Edge[] } {
  if (!data) return { nodes: [], edges: [] };
  const q = search.trim().toLowerCase();

  // Tabelas com ao menos um relacionamento (origem ou destino).
  const related = new Set<string>();
  for (const r of data.relationships) {
    related.add(r.sourceTable);
    related.add(r.targetTable);
  }
  const tables = showAll ? data.tables : data.tables.filter((t) => related.has(t.name) || (q && t.name.toLowerCase().includes(q)));
  const visible = new Set(tables.map((t) => t.name));

  const nodes: Node[] = tables.map((t, i) => {
    const highlighted = !!q && t.name.toLowerCase().includes(q);
    return {
      id: t.name,
      position: { x: (i % COLS) * X_GAP, y: Math.floor(i / COLS) * Y_GAP },
      data: {
        label: (
          <div className="text-left leading-tight">
            <div className="truncate text-xs font-semibold">{t.name}</div>
            <div className="mt-0.5 text-[10px] opacity-70">PK: {t.primaryKey.join(', ') || '—'}</div>
            <div className="text-[10px] opacity-70">{t.columnCount} col · {t.foreignKeyCount} FK</div>
          </div>
        ),
      },
      style: {
        width: 190,
        borderRadius: 8,
        border: `2px solid ${t.kind === 'system' ? '#eab308' : highlighted ? '#2563eb' : '#94a3b8'}`,
        background: highlighted ? '#dbeafe' : '#ffffff',
        padding: 8,
        opacity: q && !highlighted ? 0.4 : 1,
      },
    };
  });

  const edges: Edge[] = data.relationships
    .filter((r) => visible.has(r.sourceTable) && visible.has(r.targetTable))
    .map((r) => ({
      id: r.name,
      source: r.sourceTable,
      target: r.targetTable,
      style: { stroke: '#94a3b8' },
      labelStyle: { fontSize: 9, fill: '#64748b' },
    }));

  return { nodes, edges };
}
