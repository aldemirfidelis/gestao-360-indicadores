'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
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

const COLS = 5;
const X_GAP = 280;
const Y_GAP = 170;

export default function StructurePage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const flowRef = useRef<HTMLDivElement>(null);

  const graph = useQuery<DbSchemaGraph>({
    queryKey: ['db-admin', 'schema-graph'],
    queryFn: () => api<DbSchemaGraph>('/admin/database/schema'),
    refetchOnWindowFocus: false,
  });

  const { nodes, edges } = useMemo(() => buildGraph(graph.data, search), [graph.data, search]);

  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  useEffect(() => setRfNodes(nodes), [nodes]);

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_e, node) => router.push(`/settings/database/tables/${encodeURIComponent(node.id)}`),
    [router],
  );

  async function exportImage(kind: 'png' | 'pdf') {
    const el = flowRef.current?.querySelector('.react-flow__viewport') as HTMLElement | null;
    const container = flowRef.current;
    if (!container) return;
    const target = (el?.parentElement as HTMLElement) ?? container;
    const dataUrl = await toPng(target, { backgroundColor: '#ffffff', cacheBust: true });
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Estrutura e Relacionamentos</h2>
          <p className="text-sm text-muted-foreground">
            {graph.data ? `${graph.data.tables.length} tabelas · ${graph.data.relationships.length} relacionamentos` : 'Diagrama ER'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="w-48 pl-9" placeholder="Destacar tabela..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
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

      {graph.data && (
        <div ref={flowRef} className="panel h-[70vh] overflow-hidden p-0">
          <ReactFlow
            nodes={rfNodes}
            edges={edges}
            onNodesChange={(changes) => {
              // permite arrastar livremente
              setRfNodes((nds) =>
                nds.map((n) => {
                  const ch = changes.find((c: any) => c.id === n.id && c.type === 'position' && c.position);
                  return ch && (ch as any).position ? { ...n, position: (ch as any).position } : n;
                }),
              );
            }}
            onNodeClick={onNodeClick}
            fitView
            minZoom={0.1}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Clique em uma tabela para abrir sua estrutura. Tabelas sem relacionamento aparecem isoladas.</p>
    </div>
  );
}

function buildGraph(data: DbSchemaGraph | undefined, search: string): { nodes: Node[]; edges: Edge[] } {
  if (!data) return { nodes: [], edges: [] };
  const q = search.trim().toLowerCase();
  const nodes: Node[] = data.tables.map((t, i) => {
    const highlighted = q && t.name.toLowerCase().includes(q);
    return {
      id: t.name,
      position: { x: (i % COLS) * X_GAP, y: Math.floor(i / COLS) * Y_GAP },
      data: {
        label: (
          <div className="text-left">
            <div className="truncate text-xs font-semibold">{t.name}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              PK: {t.primaryKey.join(', ') || '—'}
            </div>
            <div className="text-[10px] text-muted-foreground">{t.columnCount} col · {t.foreignKeyCount} FK</div>
          </div>
        ),
      },
      style: {
        width: 200,
        borderRadius: 8,
        border: `2px solid ${t.kind === 'system' ? '#eab308' : highlighted ? '#2563eb' : '#94a3b8'}`,
        background: highlighted ? '#dbeafe' : '#ffffff',
        padding: 8,
        fontSize: 11,
        opacity: q && !highlighted ? 0.35 : 1,
      },
    };
  });
  const edges: Edge[] = data.relationships.map((r) => ({
    id: r.name,
    source: r.sourceTable,
    target: r.targetTable,
    animated: false,
    style: { stroke: '#94a3b8' },
    label: r.sourceColumns.join(', '),
    labelStyle: { fontSize: 9, fill: '#64748b' },
  }));
  return { nodes, edges };
}
