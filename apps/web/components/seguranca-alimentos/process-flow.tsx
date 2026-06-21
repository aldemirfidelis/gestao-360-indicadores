'use client';

import { useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';

// Tipo minimo do que o fluxograma precisa; estruturalmente compativel com o
// `Process` da pagina, mantendo este componente desacoplado para o lazy-load.
export interface FlowProcess {
  id: string;
  name: string;
  code: string | null;
  status: string;
  positionX: number | null;
  positionY: number | null;
  steps: Array<{ isControlPoint: boolean }>;
}

interface ProcessFlowProps {
  processes: FlowProcess[];
  canManage: boolean;
  onOpenId: (id: string) => void;
  onChanged: () => void;
  statusLabel: Record<string, string>;
}

export function ProcessFlow(props: ProcessFlowProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}

function FlowCanvas({ processes, canManage, onOpenId, onChanged, statusLabel }: ProcessFlowProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);

  const persist = useMutation({
    mutationFn: ({ id, positionX, positionY }: { id: string; positionX: number; positionY: number }) =>
      api(`/food-safety/processes/${id}`, { method: 'PATCH', json: { positionX, positionY } }),
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar posição'),
    onSuccess: () => onChanged(),
  });

  useEffect(() => {
    setNodes(
      processes.map((p, i) => ({
        id: p.id,
        position: { x: p.positionX ?? (i % 4) * 260 + 20, y: p.positionY ?? Math.floor(i / 4) * 150 + 20 },
        data: { label: p },
        type: 'default',
        style: {
          width: 220,
          borderRadius: 10,
          border: '2px solid',
          borderColor: p.status === 'PUBLISHED' || p.status === 'APPROVED' ? '#16a34a' : p.status === 'OBSOLETE' ? '#dc2626' : '#94a3b8',
          background: 'white',
          padding: 0,
        },
      })),
    );
  }, [processes, setNodes]);

  const nodeContent = useMemo(
    () =>
      ({ id }: Node) => {
        const p = processes.find((x) => x.id === id);
        return p;
      },
    [processes],
  );

  return (
    <Card>
      <CardContent className="p-0">
        <div className="h-[68vh] rounded-md bg-muted/5">
          <ReactFlow
            nodes={nodes.map((n) => {
              const p = nodeContent(n);
              return {
                ...n,
                data: {
                  label: p ? (
                    <div className="px-3 py-2 text-left">
                      <div className="truncate text-sm font-semibold text-slate-800">{p.code ? `${p.code} · ` : ''}{p.name}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {statusLabel[p.status] ?? p.status} · {p.steps.length} etapas
                        {p.steps.some((s) => s.isControlPoint) ? ` · ${p.steps.filter((s) => s.isControlPoint).length} PC` : ''}
                      </div>
                    </div>
                  ) : (
                    n.data?.label
                  ),
                },
              };
            })}
            onNodesChange={onNodesChange}
            nodesDraggable={canManage}
            onNodeDragStop={(_, node) => {
              if (!canManage) return;
              persist.mutate({ id: node.id, positionX: Math.round(node.position.x), positionY: Math.round(node.position.y) });
            }}
            onNodeClick={(_, node) => onOpenId(node.id)}
            fitView
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} color="#cbd5e1" className="opacity-45" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!bg-muted" />
          </ReactFlow>
        </div>
        <div className="border-t p-2 text-center text-xs text-muted-foreground">
          {processes.length === 0
            ? 'Cadastre processos na aba Processos para vê-los no fluxograma.'
            : canManage
              ? 'Arraste os processos para reorganizar · clique para abrir · zoom e minimapa no canto.'
              : 'Clique em um processo para ver os detalhes.'}
        </div>
      </CardContent>
    </Card>
  );
}
