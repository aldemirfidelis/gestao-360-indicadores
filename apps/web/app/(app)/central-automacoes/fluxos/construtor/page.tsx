'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import {
  Save,
  CheckCircle,
  Play,
  Share2,
  Copy,
  ChevronLeft,
  Settings,
  HelpCircle,
  Search,
  Plus,
  Trash2,
  AlertTriangle,
  Code,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Standard block types library
const BLOCKS_CATALOG = [
  { type: 'TRIGGER', blockType: 'indicator.result_recorded', label: 'Lançamento de Indicador', icon: 'Target', color: 'bg-blue-500/10 border-blue-500 text-blue-500' },
  { type: 'TRIGGER', blockType: 'indicator.out_of_target', label: 'Indicador Fora da Meta', icon: 'AlertTriangle', color: 'bg-red-500/10 border-red-500 text-red-500' },
  { type: 'TRIGGER', blockType: 'document.published', label: 'Documento Publicado', icon: 'FileText', color: 'bg-green-500/10 border-green-500 text-green-500' },
  { type: 'TRIGGER', blockType: 'document.expiration_approaching', label: 'Doc Próximo do Vencimento', icon: 'Clock', color: 'bg-amber-500/10 border-amber-500 text-amber-500' },
  { type: 'TRIGGER', blockType: 'nonconformity.created', label: 'Não Conformidade Registrada', icon: 'FileWarning', color: 'bg-orange-500/10 border-orange-500 text-orange-500' },

  { type: 'CONDITION', blockType: 'logic.condition', label: 'Regra Condicional (Se/Senão)', icon: 'GitBranch', color: 'bg-purple-500/10 border-purple-500 text-purple-500' },

  { type: 'HUMAN_TASK', blockType: 'human.task', label: 'Criar Tarefa Humana', icon: 'CheckSquare', color: 'bg-sky-500/10 border-sky-500 text-sky-500' },
  { type: 'APPROVAL', blockType: 'human.approval', label: 'Solicitar Aprovação', icon: 'ShieldCheck', color: 'bg-indigo-500/10 border-indigo-500 text-indigo-500' },

  { type: 'TIMER', blockType: 'logic.timer', label: 'Aguardar (Delay/Timer)', icon: 'Clock', color: 'bg-teal-500/10 border-teal-500 text-teal-500' },

  { type: 'ACTION', blockType: 'action.deviation.create', label: 'Criar Desvio (FCA)', icon: 'AlertCircle', color: 'bg-pink-500/10 border-pink-500 text-pink-500' },
  { type: 'ACTION', blockType: 'action.plan.create', label: 'Criar Plano de Ação', icon: 'ClipboardList', color: 'bg-rose-500/10 border-rose-500 text-rose-500' },
  { type: 'ACTION', blockType: 'action.meeting.create', label: 'Agendar Reunião', icon: 'Calendar', color: 'bg-violet-500/10 border-violet-500 text-violet-500' },

  { type: 'INTEGRATION', blockType: 'integration.webhook', label: 'Disparar Webhook API', icon: 'Globe', color: 'bg-emerald-500/10 border-emerald-500 text-emerald-500' },
  { type: 'INTEGRATION', blockType: 'integration.email', label: 'Enviar Alerta de E-mail', icon: 'Mail', color: 'bg-cyan-500/10 border-cyan-500 text-cyan-500' },
];

export default function WorkflowBuilder() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const id = searchParams.get('id');
  const isNew = searchParams.get('new') === 'true';

  const [workflowName, setWorkflowName] = useState('Novo Fluxo');
  const [workflowDesc, setWorkflowDesc] = useState('');
  const [module, setModule] = useState('INDICATORS');
  const [category, setCategory] = useState('NOTIFICATION');

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  const [simulationLogs, setSimulationLogs] = useState<any[]>(null as any);
  const [simulationContext, setSimulationContext] = useState<string>('{\n  "value": 85,\n  "periodRef": "2026-06"\n}');

  // Left sidebar toolbox filter
  const [searchQuery, setSearchQuery] = useState('');

  // Load workflow and version if ID exists
  const { data: workflowDef, refetch } = useQuery<any>({
    queryKey: ['automations', 'workflows', id],
    queryFn: () => api<any>(`/automations/workflows/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (workflowDef) {
      setWorkflowName(workflowDef.name);
      setWorkflowDesc(workflowDef.description || '');
      setModule(workflowDef.module);
      setCategory(workflowDef.category);

      if (workflowDef.versions && workflowDef.versions.length > 0) {
        const latest = workflowDef.versions[0];
        try {
          const parsed = JSON.parse(latest.canvasData || '{"nodes":[],"edges":[]}');
          setNodes(parsed.nodes || []);
          setEdges(parsed.edges || []);
        } catch (e) {
          toast.error('Falha ao decodificar grafo salvo.');
        }
      }
    }
  }, [workflowDef, setNodes, setEdges]);

  // Connect handler
  const onConnect = (params: Connection) => {
    setEdges((eds) => addEdge({
      ...params,
      markerEnd: { type: MarkerType.ArrowClosed },
    }, eds));
  };

  // Node selected handler
  const onNodeClick = (_: any, node: Node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  const onEdgeClick = (_: any, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  };

  // Insert block into canvas
  const handleAddBlock = (block: typeof BLOCKS_CATALOG[number]) => {
    const id = `${block.type.toLowerCase()}-${Date.now().toString().slice(-4)}`;
    const newNode: Node = {
      id,
      type: 'default',
      data: {
        label: block.label,
        blockType: block.blockType,
        nodeType: block.type,
        config: {
          title: block.label,
          retryPolicy: { maxAttempts: 3, delaySeconds: 10 },
        },
      },
      position: { x: 250 + Math.random() * 50, y: 150 + Math.random() * 50 },
      style: {
        borderRadius: '8px',
        padding: '10px',
        fontSize: '11px',
        fontWeight: '600',
        width: 170,
        textAlign: 'center',
        border: '1px solid',
      },
      className: block.color,
    };
    setNodes((nds) => nds.concat(newNode));
    toast.success(`Nó "${block.label}" adicionado ao canvas.`);
  };

  // Update node config details from right sidebar
  const handleUpdateNodeConfig = (updatedConfig: any) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          return {
            ...n,
            data: {
              ...n.data,
              config: updatedConfig,
            },
          };
        }
        return n;
      })
    );
    setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, config: updatedConfig } } : null);
    toast.success('Configurações do nó atualizadas!');
  };

  // Save flow mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      let activeId = id;
      if (isNew || !id) {
        // Create Definition first
        const def = await api<any>('/automations/workflows', {
          method: 'POST',
          json: { name: workflowName, description: workflowDesc, module, category },
        });
        activeId = def.id;
      } else {
        // Update Definition
        await api(`/automations/workflows/${id}`, {
          method: 'PUT',
          json: { name: workflowName, description: workflowDesc },
        });
      }

      // Save new version
      const canvasData = JSON.stringify({ nodes, edges });
      await api(`/automations/workflows/${activeId}/versions`, {
        method: 'POST',
        json: { canvasData, configurationSnapshot: '{}', changeSummary: 'Salvo via Construtor' },
      });

      return activeId;
    },
    onSuccess: (activeId) => {
      toast.success('Fluxo e versão salvos com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['automations', 'workflows'] });
      if (isNew) {
        router.push(`/central-automacoes/fluxos/construtor?id=${activeId}`);
      } else {
        refetch();
      }
    },
    onError: (err: any) => {
      toast.error(`Falha ao salvar: ${err.message}`);
    },
  });

  // Validate Graph mutation
  const validateMutation = useMutation({
    mutationFn: async () => {
      if (!id) {
        toast.warning('Salve o fluxo como rascunho antes de validar.');
        return;
      }
      const res = await api<any>(`/automations/workflow-versions/${workflowDef?.versions[0]?.id}/validate`, {
        method: 'POST',
      });
      setValidationErrors(res.errors || []);
      if (res.valid) {
        toast.success('Parabéns! O grafo do fluxo está 100% válido e consistente.');
      } else {
        toast.error('Foram encontrados problemas na consistência do grafo.');
      }
    },
  });

  // Simulate Graph mutation
  const simulateMutation = useMutation({
    mutationFn: async () => {
      if (!id) {
        toast.warning('Salve o fluxo como rascunho antes de simular.');
        return;
      }
      let contextObj = {};
      try {
        contextObj = JSON.parse(simulationContext);
      } catch (e) {
        toast.error('JSON de variáveis da simulação inválido.');
        return;
      }

      const res = await api<any>(`/automations/workflow-versions/${workflowDef?.versions[0]?.id}/simulate`, {
        method: 'POST',
        json: { initialContext: contextObj },
      });
      setSimulationLogs(res.steps || []);
      toast.success('Simulação concluída com sucesso! Relatório gerado.');
    },
  });

  // Publish workflow version mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!id || !workflowDef?.versions?.[0]?.id) {
        toast.warning('Salve o fluxo como rascunho antes de publicar.');
        return;
      }
      await api(`/automations/workflow-versions/${workflowDef.versions[0].id}/publish`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast.success('Workflow publicado e ativado com sucesso!');
      refetch();
    },
    onError: (err: any) => {
      toast.error(`Falha ao publicar: ${err.message}`);
    },
  });

  const filteredBlocks = BLOCKS_CATALOG.filter(b =>
    b.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.blockType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Top Header Controls */}
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" asChild>
            <Link href="/central-automacoes/fluxos">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="text-sm font-semibold bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none w-56 truncate"
              placeholder="Nome da Automação"
            />
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate flex items-center gap-2">
              <span>Módulo: {module}</span> • <span>Categoria: {category}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Validate */}
          <Button variant="outline" size="sm" className="h-8 text-xs flex items-center gap-1" onClick={() => validateMutation.mutate()}>
            <CheckCircle className="h-3.5 w-3.5 text-yellow-500" />
            Validar
          </Button>

          {/* Simulate */}
          <Button variant="outline" size="sm" className="h-8 text-xs flex items-center gap-1" onClick={() => {
            if (!simulationLogs) setSimulationLogs([]);
            else setSimulationLogs(null as any);
          }}>
            <Code className="h-3.5 w-3.5" />
            Simulador
          </Button>

          {/* Save Draft */}
          <Button variant="outline" size="sm" className="h-8 text-xs flex items-center gap-1" onClick={() => saveMutation.mutate()}>
            <Save className="h-3.5 w-3.5" />
            Salvar Rascunho
          </Button>

          {/* Publish */}
          <Button size="sm" className="h-8 text-xs flex items-center gap-1" onClick={() => publishMutation.mutate()}>
            <Share2 className="h-3.5 w-3.5" />
            Publicar & Ativar
          </Button>
        </div>
      </header>

      {/* Editor Body */}
      <div className="flex-1 flex min-h-0 w-full overflow-hidden relative">
        {/* Left catalog panel */}
        <aside className="w-64 border-r bg-card flex flex-col min-h-0 shrink-0">
          <div className="p-3 border-b">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filtrar blocos da biblioteca..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-[11px] bg-background border rounded-lg focus:outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            <div>
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase px-2 mb-1 tracking-wider">Biblioteca de Blocos</h4>
              <p className="text-[10px] text-muted-foreground px-2 mb-2">Clique em um bloco para adicioná-lo ao canvas:</p>
              <div className="space-y-1">
                {filteredBlocks.map((block) => (
                  <button
                    key={block.blockType}
                    onClick={() => handleAddBlock(block)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-xs font-semibold border hover:bg-muted transition-colors truncate flex items-center justify-between',
                      block.color
                    )}
                  >
                    <span>{block.label}</span>
                    <Plus className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Center Canvas */}
        <div className="flex-1 min-w-0 h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            fitView
          >
            <MiniMap style={{ height: 80, width: 120 }} zoomable pannable />
            <Controls />
            <Background gap={12} size={1} />
          </ReactFlow>

          {/* Validation report alert overlays */}
          {validationErrors.length > 0 && (
            <div className="absolute top-4 left-4 z-10 max-w-sm bg-card border rounded-lg shadow-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1 text-yellow-600">
                  <AlertTriangle className="h-4 w-4" />
                  Alertas de Validação ({validationErrors.length})
                </span>
                <button className="text-[10px] hover:underline text-muted-foreground" onClick={() => setValidationErrors([])}>Ocultar</button>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {validationErrors.map((err, i) => (
                  <div key={i} className="text-[10px] border-b pb-1 last:border-0 leading-relaxed text-muted-foreground">
                    <strong className="text-foreground">[{err.severity}]</strong>: {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Simulator Panel Overlay */}
          {simulationLogs !== null && (
            <div className="absolute top-4 left-4 z-10 w-96 bg-card border rounded-xl shadow-2xl p-4 flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between border-b pb-2 mb-2">
                <span className="text-xs font-bold flex items-center gap-1 text-primary">
                  <Play className="h-3.5 w-3.5" />
                  Simulador de Workflows (Modo Teste)
                </span>
                <button className="text-[11px] text-muted-foreground hover:underline" onClick={() => setSimulationLogs(null as any)}>Fechar</button>
              </div>
              <div className="space-y-3 flex-1 flex flex-col min-h-0">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Variáveis de Contexto (JSON)</label>
                  <textarea
                    value={simulationContext}
                    onChange={(e) => setSimulationContext(e.target.value)}
                    rows={4}
                    className="w-full p-2 text-[10px] font-mono border rounded-lg bg-background focus:outline-none"
                  />
                </div>
                <Button size="sm" className="w-full text-xs h-8" onClick={() => simulateMutation.mutate()}>
                  Rodar Simulação Local
                </Button>

                {simulationLogs.length > 0 && (
                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 border-t pt-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Log de Simulação</label>
                    {simulationLogs.map((step, i) => (
                      <div key={i} className={cn(
                        'text-[10px] p-2 rounded border border-dashed leading-relaxed',
                        step.status === 'COMPLETED' && 'bg-status-green/5 border-status-green/30 text-status-green',
                        step.status === 'SKIPPED' && 'bg-muted/40 border-muted text-muted-foreground',
                        step.status === 'FAILED' && 'bg-status-red/5 border-status-red/30 text-status-red'
                      )}>
                        <div className="font-semibold">{step.name} ({step.nodeType})</div>
                        <div className="mt-0.5">{step.message}</div>
                        {Object.keys(step.outputVariables || {}).length > 0 && (
                          <div className="mt-1 font-mono text-[9px] opacity-75">
                            Output: {JSON.stringify(step.outputVariables)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right contextual properties panel */}
        <aside className="w-80 border-l bg-card flex flex-col min-h-0 shrink-0">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="text-xs font-bold flex items-center gap-1.5">
              <Settings className="h-4 w-4 text-muted-foreground" />
              Configurar Bloco
            </h3>
            {selectedNode && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                  setSelectedNode(null);
                  toast.success('Bloco removido do canvas.');
                }}
                title="Excluir Bloco"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Nome do Bloco</label>
                  <input
                    type="text"
                    value={selectedNode.data?.label || ''}
                    onChange={(e) => {
                      const updated = { ...selectedNode.data?.config, title: e.target.value };
                      setNodes((nds) =>
                        nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, label: e.target.value, config: updated } } : n))
                      );
                      setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, label: e.target.value, config: updated } } : null);
                    }}
                    className="w-full px-3 py-1.5 text-xs bg-background border rounded-lg focus:outline-none"
                  />
                </div>

                {/* Condition Logic Configurator */}
                {(selectedNode.type === 'CONDITION' || selectedNode.data?.blockType === 'logic.condition' || selectedNode.data?.blockType === 'logic.if_else') && (
                  <div className="border rounded-lg p-3 bg-muted/20 space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block">Lógica da Condição</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedNode.data?.config?.condition?.field || 'value'}
                          onChange={(e) => {
                            const condition = { ...selectedNode.data?.config?.condition, field: e.target.value };
                            handleUpdateNodeConfig({ ...selectedNode.data?.config, condition });
                          }}
                          className="w-full px-2 py-1 text-xs bg-background border rounded"
                        >
                          <option value="value">Valor Atual</option>
                          <option value="previousValue">Valor Anterior</option>
                          <option value="light">Farol (Cor)</option>
                          <option value="attainment">Atingimento (%)</option>
                          <option value="severity">Criticidade</option>
                          <option value="status">Status</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedNode.data?.config?.condition?.operator || 'eq'}
                          onChange={(e) => {
                            const condition = { ...selectedNode.data?.config?.condition, operator: e.target.value };
                            handleUpdateNodeConfig({ ...selectedNode.data?.config, condition });
                          }}
                          className="w-full px-2 py-1 text-xs bg-background border rounded"
                        >
                          <option value="eq">Igual a</option>
                          <option value="neq">Diferente de</option>
                          <option value="gt">Maior que</option>
                          <option value="lt">Menor que</option>
                          <option value="contains">Contém</option>
                          <option value="empty">Está Vazio</option>
                        </select>
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Valor de comparação..."
                          value={selectedNode.data?.config?.condition?.value || ''}
                          onChange={(e) => {
                            const condition = { ...selectedNode.data?.config?.condition, value: e.target.value };
                            handleUpdateNodeConfig({ ...selectedNode.data?.config, condition });
                          }}
                          className="w-full px-2 py-1 text-xs bg-background border rounded focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Responsible config (for Tasks and Approvals) */}
                {(selectedNode.data?.nodeType === 'HUMAN_TASK' || selectedNode.data?.nodeType === 'APPROVAL' || selectedNode.type === 'default' && (selectedNode.data?.blockType?.includes('human') || selectedNode.data?.blockType?.includes('approval'))) && (
                  <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block">Responsável Pela Etapa</label>
                    <div className="space-y-2">
                      <select
                        value={selectedNode.data?.config?.responsible?.type || 'ROLE'}
                        onChange={(e) => {
                          const responsible = { ...selectedNode.data?.config?.responsible, type: e.target.value };
                          handleUpdateNodeConfig({ ...selectedNode.data?.config, responsible });
                        }}
                        className="w-full px-2 py-1 text-xs bg-background border rounded"
                      >
                        <option value="CREATOR">Criador do Registro</option>
                        <option value="INDICATOR_RESPONSIBLE">Responsável pelo Indicador</option>
                        <option value="DOCUMENT_RESPONSIBLE">Responsável pelo Documento</option>
                        <option value="ROLE">Papel Organizacional (Role)</option>
                        <option value="USER">Usuário Específico</option>
                      </select>

                      {selectedNode.data?.config?.responsible?.type === 'ROLE' && (
                        <select
                          value={selectedNode.data?.config?.responsible?.role || 'MANAGER'}
                          onChange={(e) => {
                            const responsible = { ...selectedNode.data?.config?.responsible, role: e.target.value };
                            handleUpdateNodeConfig({ ...selectedNode.data?.config, responsible });
                          }}
                          className="w-full px-2 py-1 text-xs bg-background border rounded"
                        >
                          <option value="COMPANY_ADMIN">Administrador</option>
                          <option value="MANAGER">Gestor / Gerente</option>
                          <option value="DIRECTOR">Diretoria</option>
                          <option value="COLLABORATOR">Colaborador</option>
                        </select>
                      )}
                    </div>
                  </div>
                )}

                {/* Webhook Configurator */}
                {selectedNode.data?.blockType === 'integration.webhook' && (
                  <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block">Configurar Endpoint Webhook</label>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="https://api.exemplo.com/webhook"
                        value={selectedNode.data?.config?.url || ''}
                        onChange={(e) => handleUpdateNodeConfig({ ...selectedNode.data?.config, url: e.target.value })}
                        className="w-full px-2 py-1.5 text-xs bg-background border rounded focus:outline-none"
                      />
                      <select
                        value={selectedNode.data?.config?.method || 'POST'}
                        onChange={(e) => handleUpdateNodeConfig({ ...selectedNode.data?.config, method: e.target.value })}
                        className="w-full px-2 py-1 text-xs bg-background border rounded"
                      >
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="GET">GET</option>
                      </select>
                      <div>
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Payload JSON Template</label>
                        <textarea
                          placeholder='{"id": "{{id}}", "event": "indicador_alerta"}'
                          value={selectedNode.data?.config?.body || ''}
                          onChange={(e) => handleUpdateNodeConfig({ ...selectedNode.data?.config, body: e.target.value })}
                          rows={4}
                          className="w-full p-2 text-[10px] font-mono border rounded bg-background focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : selectedEdge ? (
              <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                <div>
                  <strong className="text-foreground">Conexão Selecionada:</strong>
                  <div className="mt-1">Origem: {selectedEdge.source}</div>
                  <div>Destino: {selectedEdge.target}</div>
                </div>
                {selectedEdge.sourceHandle && (
                  <div className="mt-2">
                    <strong className="text-foreground">Caminho Lógico:</strong>
                    <div className="mt-0.5 capitalize px-2 py-0.5 rounded bg-muted text-foreground inline-block text-[10px] font-bold">
                      {selectedEdge.sourceHandle === 'true' ? 'Verdadeiro' : 'Falso'}
                    </div>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive h-8 mt-4"
                  onClick={() => {
                    setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
                    setSelectedEdge(null);
                    toast.success('Conexão removida do canvas.');
                  }}
                >
                  Remover Conexão
                </Button>
              </div>
            ) : (
              <div className="text-center py-20 text-xs text-muted-foreground">
                <HelpCircle className="h-8 w-8 mx-auto opacity-50 mb-2" />
                Selecione um bloco ou conexão no canvas para visualizar e editar suas propriedades contextuais.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
