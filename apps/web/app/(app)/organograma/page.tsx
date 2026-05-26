'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Building2,
  Calendar,
  Layers,
  LayoutGrid,
  Link2,
  Plus,
  Save,
  Search,
  Settings,
  Table,
  Trash2,
  Users,
  X,
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
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
import { cn } from '@/lib/utils';

// TYPES
interface OrgJob {
  id: string;
  name: string;
  description: string | null;
}

interface OrgNode {
  id: string;
  name: string;
  type: string;
}

interface OrgEmployee {
  id: string;
  registrationId: string | null;
  name: string;
  jobId: string;
  job: OrgJob;
  orgNodeId: string | null;
  orgNode: OrgNode | null;
  band: string; // A, B, C
  shift: string; // A, B, C, D
  isBudgeted: boolean;
  status: string; // ACTIVE, VACANT
}

interface OrgJobCareerPath {
  id: string;
  fromJobId: string;
  toJobId: string;
  fromJob: OrgJob;
  toJob: OrgJob;
  sourceHandle?: string;
  targetHandle?: string;
}

interface OrganogramaData {
  jobs: OrgJob[];
  employees: OrgEmployee[];
  careerPaths: OrgJobCareerPath[];
}

interface StrategyOptions {
  orgNodes: OrgNode[];
}

// Custom CustomNode for ReactFlow (representing a Job Role)
function JobRoleNode({
  data,
  selected,
}: NodeProps<{ job: OrgJob; employees: OrgEmployee[]; editMode: boolean }>) {
  const job = data.job;
  const employees = data.employees ?? [];
  const activeEmployees = employees.filter((e) => e.status === 'ACTIVE');
  const vacantEmployees = employees.filter((e) => e.status === 'VACANT');

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border-2 bg-card p-3 shadow-lg transition duration-200 w-[240px]',
        selected ? 'border-primary ring-2 ring-primary/25' : 'border-border'
      )}
    >
      <Handle id="left" type="target" position={Position.Left} className="!h-3 !w-3 !bg-primary" />
      <Handle id="top" type="target" position={Position.Top} className="!h-3 !w-3 !bg-primary" />
      
      <div className="flex items-start justify-between gap-1.5 mb-2">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Cargo</div>
          <div className="text-sm font-semibold truncate text-foreground">{job.name}</div>
        </div>
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 shrink-0">
          {activeEmployees.length} MO
        </Badge>
      </div>

      {employees.length > 0 ? (
        <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
          {employees.map((emp) => (
            <div
              key={emp.id}
              className={cn(
                'rounded-lg border px-2 py-1 text-[11px] flex flex-col gap-0.5 transition hover:bg-muted/40',
                emp.status === 'VACANT' 
                  ? 'border-dashed border-warning/35 bg-warning/5 text-warning-foreground' 
                  : emp.isBudgeted 
                    ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
                    : 'border-destructive/25 bg-destructive/5 text-destructive dark:text-destructive-foreground'
              )}
            >
              <div className="font-medium truncate flex items-center justify-between">
                <span>{emp.name}</span>
                <span className="font-bold opacity-80">{emp.band}</span>
              </div>
              <div className="flex justify-between text-[9px] opacity-75">
                <span>{emp.registrationId ? `#${emp.registrationId}` : 'VAGA'}</span>
                <span className="uppercase font-semibold">Turno {emp.shift}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground italic text-center py-2 border border-dashed rounded-lg bg-muted/10">Sem colaboradores alocados</p>
      )}

      <Handle id="right" type="source" position={Position.Right} className="!h-3 !w-3 !bg-primary" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="!h-3 !w-3 !bg-primary" />
    </div>
  );
}

// Custom CustomEdge for ReactFlow (representing Career Path)
function CareerPathEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
}: EdgeProps) {
  // Always straight horizontal/vertical paths (Goiasa Retas e Quadradas)
  const xMid = sourceX + (targetX - sourceX) * 0.5;
  const path = `M ${sourceX} ${sourceY} L ${xMid} ${sourceY} L ${xMid} ${targetY} L ${targetX} ${targetY}`;

  return (
    <>
      <style>{`
        @keyframes career-flow {
          from {
            stroke-dashoffset: 20;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        .career-path-animated {
          stroke-dasharray: 6 4 !important;
          animation: career-flow 0.8s linear infinite !important;
        }
      `}</style>
      <path
        id={id}
        d={path}
        fill="none"
        style={{
          stroke: '#16a34a',
          strokeWidth: selected ? 4 : 2.5,
          opacity: 1,
          strokeDasharray: selected ? undefined : '6 4',
          filter: 'drop-shadow(0 1px 1.5px rgba(15, 23, 42, 0.12))',
        }}
        className={selected ? 'career-path-animated' : ''}
      />
    </>
  );
}

const nodeTypes = { jobRole: JobRoleNode };
const edgeTypes = { strategy: CareerPathEdge };

function OrganogramaInner() {
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<'excel' | 'canvas'>('excel');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  
  // States for CRUD modals
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [selectedJobIdForEmployee, setSelectedJobIdForEmployee] = useState<string>('');

  // Form States
  const [jobName, setJobName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  
  const [employeeName, setEmployeeName] = useState('');
  const [employeeRegistration, setEmployeeRegistration] = useState('');
  const [employeeBand, setEmployeeBand] = useState('A');
  const [employeeShift, setEmployeeShift] = useState('D');
  const [employeeIsBudgeted, setEmployeeIsBudgeted] = useState(true);
  const [employeeStatus, setEmployeeStatus] = useState('ACTIVE');
  const [employeeAreaId, setEmployeeAreaId] = useState('');

  // Canvas States
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // FETCH DATA
  const organogramaQuery = useQuery<OrganogramaData>({
    queryKey: ['strategy', 'organograma'],
    queryFn: () => api<OrganogramaData>('/strategy/organograma'),
  });

  const optionsQuery = useQuery<StrategyOptions>({
    queryKey: ['strategy', 'options'],
    queryFn: () => api<StrategyOptions>('/strategy/options'),
  });

  const data = organogramaQuery.data;
  const orgNodes = optionsQuery.data?.orgNodes ?? [];

  // Filter orgNodes to get Areas and Sectors
  const areasAndSectors = useMemo(() => {
    return orgNodes.filter(n => n.type === 'SECTOR' || n.type === 'AREA');
  }, [orgNodes]);

  // MUTATIONS
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['strategy', 'organograma'] });
  };

  const createJob = useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      api('/strategy/jobs', { method: 'POST', json: body }),
    onSuccess: () => {
      toast.success('Cargo cadastrado com sucesso');
      setJobModalOpen(false);
      setJobName('');
      setJobDescription('');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao cadastrar cargo'),
  });

  const createEmployee = useMutation({
    mutationFn: (body: any) =>
      api('/strategy/employees', { method: 'POST', json: body }),
    onSuccess: () => {
      toast.success('Colaborador alocado com sucesso');
      setEmployeeModalOpen(false);
      resetEmployeeForm();
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao alocar colaborador'),
  });

  const removeEmployee = useMutation({
    mutationFn: (id: string) =>
      api(`/strategy/employees/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Colaborador removido');
      invalidate();
    },
  });

  const createCareerPath = useMutation({
    mutationFn: (body: { fromJobId: string; toJobId: string }) =>
      api('/strategy/career-paths', { method: 'POST', json: body }),
    onSuccess: () => {
      toast.success('Caminho de desenvolvimento salvo');
      invalidate();
    },
  });

  const removeCareerPath = useMutation({
    mutationFn: (id: string) =>
      api(`/strategy/career-paths/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Caminho de desenvolvimento removido');
      invalidate();
    },
  });

  const resetEmployeeForm = () => {
    setEmployeeName('');
    setEmployeeRegistration('');
    setEmployeeBand('A');
    setEmployeeShift('D');
    setEmployeeIsBudgeted(true);
    setEmployeeStatus('ACTIVE');
    setEmployeeAreaId(selectedAreaId);
  };

  // Filtered lists based on Selected Area/Sector
  const filteredEmployees = useMemo(() => {
    if (!data?.employees) return [];
    if (!selectedAreaId) return data.employees;
    return data.employees.filter((emp) => emp.orgNodeId === selectedAreaId);
  }, [data?.employees, selectedAreaId]);

  // Compute headcount totals for Goiasa Excel template
  const headcountTotals = useMemo(() => {
    const total = filteredEmployees.length;
    const leadershipCount = filteredEmployees.filter((e) => e.job.name.toLowerCase().includes('gestor') || e.job.name.toLowerCase().includes('gerente') || e.job.name.toLowerCase().includes('coordenador')).length;
    return {
      total,
      leadership: leadershipCount,
      operational: total - leadershipCount,
    };
  }, [filteredEmployees]);

  // BUILD REACT FLOW NODES & EDGES
  useEffect(() => {
    if (!data) return;

    // Calculate node coordinates by grouping them vertically or in hierarchy
    const flowNodes: Node[] = data.jobs.map((job, index) => {
      const jobEmployees = filteredEmployees.filter(emp => emp.jobId === job.id);
      return {
        id: job.id,
        type: 'jobRole',
        data: { job, employees: jobEmployees, editMode: true },
        position: { x: 50 + (index % 3) * 320, y: 50 + Math.floor(index / 3) * 280 },
      };
    });

    const flowEdges: Edge[] = data.careerPaths.map((path) => ({
      id: path.id,
      source: path.fromJobId,
      target: path.toJobId,
      type: 'strategy',
      sourceHandle: path.sourceHandle ?? 'right',
      targetHandle: path.targetHandle ?? 'left',
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [data, filteredEmployees, setNodes, setEdges]);

  // Handle Drag-To-Connect Careers
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      createCareerPath.mutate({
        fromJobId: connection.source,
        toJobId: connection.target,
      });
    },
    [createCareerPath]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Gestão de Pessoas"
        tone="view"
        title="Organograma de Área"
        description="Controle de headcount (MO), orçamento, cargos, faixas salariais e plano de carreira por Área ou Setor."
        breadcrumbs={[{ label: 'Organograma de Área' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setJobModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar Cargo
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                resetEmployeeForm();
                setSelectedJobIdForEmployee('');
                setEmployeeModalOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Alocar Colaborador
            </Button>
          </div>
        }
      />

      {/* TOOLBAR CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Label className="font-semibold text-muted-foreground">Filtrar por Área / Setor:</Label>
          <NativeSelect
            value={selectedAreaId}
            onChange={(e) => setSelectedAreaId(e.target.value)}
            className="w-[280px] bg-background"
          >
            <option value="">Geral (Todos colaboradores)</option>
            {areasAndSectors.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1.5 rounded-lg border bg-muted/40 p-1">
          <Button
            variant={viewMode === 'excel' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('excel')}
            className="text-xs"
          >
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
            Lotação Turno (Excel)
          </Button>
          <Button
            variant={viewMode === 'canvas' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('canvas')}
            className="text-xs"
          >
            <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
            Canvas de Carreira
          </Button>
        </div>
      </div>

      {/* DUAL VIEW RENDER */}
      {viewMode === 'excel' ? (
        <div className="rounded-xl border bg-card p-6 shadow-md overflow-x-auto">
          {/* HEADER GOIASA ESTILIZADO */}
          <div className="border-b-2 border-emerald-600 pb-4 mb-6 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold uppercase text-emerald-700 tracking-wider">Organograma de Área</h2>
              <p className="text-xs text-muted-foreground">
                Setor Selecionado:{' '}
                <span className="font-semibold text-foreground">
                  {areasAndSectors.find((n) => n.id === selectedAreaId)?.name ?? 'Geral'}
                </span>
              </p>
            </div>
            <div className="text-right">
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-3 py-1">
                MO TOTAL: {headcountTotals.total}
              </Badge>
            </div>
          </div>

          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-muted border-b text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <th className="p-3 w-[240px]">Cargo</th>
                <th className="p-3 w-[80px] text-center">Faixa</th>
                <th className="p-3 w-[120px] text-center">Turno D</th>
                <th className="p-3 w-[120px] text-center">Turno A</th>
                <th className="p-3 w-[120px] text-center">Turno B</th>
                <th className="p-3 w-[120px] text-center">Turno C</th>
                <th className="p-3 w-[110px] text-center">Total MO</th>
                <th className="p-3 text-center w-[160px]">Orçamento / Situação</th>
                {selectedAreaId && <th className="p-3 w-[60px] text-center">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {data?.jobs.map((job) => {
                const jobEmps = filteredEmployees.filter((e) => e.jobId === job.id);
                if (selectedAreaId && jobEmps.length === 0) return null;

                // Group by shift
                const shiftD = jobEmps.filter((e) => e.shift === 'D');
                const shiftA = jobEmps.filter((e) => e.shift === 'A');
                const shiftB = jobEmps.filter((e) => e.shift === 'B');
                const shiftC = jobEmps.filter((e) => e.shift === 'C');

                const maxCount = Math.max(1, shiftD.length, shiftA.length, shiftB.length, shiftC.length);

                return Array.from({ length: maxCount }).map((_, rowIndex) => {
                  const empD = shiftD[rowIndex];
                  const empA = shiftA[rowIndex];
                  const empB = shiftB[rowIndex];
                  const empC = shiftC[rowIndex];

                  const isRowEmpty = !empD && !empA && !empB && !empC;
                  if (isRowEmpty && rowIndex > 0) return null;

                  return (
                    <tr
                      key={`${job.id}-${rowIndex}`}
                      className="border-b transition hover:bg-muted/30 align-middle"
                    >
                      {rowIndex === 0 ? (
                        <td className="p-3 font-semibold text-foreground bg-muted/10 border-r" rowSpan={maxCount}>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">{job.name}</span>
                            <span className="text-[10px] text-muted-foreground font-normal line-clamp-1">{job.description}</span>
                          </div>
                        </td>
                      ) : null}

                      {/* FAIXA */}
                      <td className="p-3 text-center border-r font-bold text-primary">
                        {empD?.band ?? empA?.band ?? empB?.band ?? empC?.band ?? 'B'}
                      </td>

                      {/* SHIFT CELLS */}
                      <td className="p-3 text-center border-r">
                        {empD ? (
                          <div className="flex flex-col gap-0.5 items-center">
                            <span className="font-semibold text-foreground">{empD.name}</span>
                            <span className="text-[9px] text-muted-foreground">{empD.registrationId ? `#${empD.registrationId}` : 'VAGA'}</span>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="p-3 text-center border-r">
                        {empA ? (
                          <div className="flex flex-col gap-0.5 items-center">
                            <span className="font-semibold text-foreground">{empA.name}</span>
                            <span className="text-[9px] text-muted-foreground">{empA.registrationId ? `#${empA.registrationId}` : 'VAGA'}</span>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="p-3 text-center border-r">
                        {empB ? (
                          <div className="flex flex-col gap-0.5 items-center">
                            <span className="font-semibold text-foreground">{empB.name}</span>
                            <span className="text-[9px] text-muted-foreground">{empB.registrationId ? `#${empB.registrationId}` : 'VAGA'}</span>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="p-3 text-center border-r">
                        {empC ? (
                          <div className="flex flex-col gap-0.5 items-center">
                            <span className="font-semibold text-foreground">{empC.name}</span>
                            <span className="text-[9px] text-muted-foreground">{empC.registrationId ? `#${empC.registrationId}` : 'VAGA'}</span>
                          </div>
                        ) : '-'}
                      </td>

                      {/* TOTAL MO per Role Row */}
                      {rowIndex === 0 ? (
                        <td className="p-3 text-center font-bold text-sm text-foreground bg-muted/10 border-r" rowSpan={maxCount}>
                          {jobEmps.length}
                        </td>
                      ) : null}

                      {/* BUDGET STATUS / ORÇAMENTO */}
                      <td className="p-3 text-center border-r">
                        {empD || empA || empB || empC ? (
                          <div className="flex items-center justify-center gap-1.5">
                            {((empD?.isBudgeted ?? true) && (empA?.isBudgeted ?? true) && (empB?.isBudgeted ?? true) && (empC?.isBudgeted ?? true)) ? (
                              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold">
                                Previsto
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-semibold" title="Divergência de quadro orçado">
                                Divergente (Fora)
                              </Badge>
                            )}
                          </div>
                        ) : '-'}
                      </td>

                      {/* ACTION CONTROLS */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {empD && (
                            <Button variant="ghost" size="sm" onClick={() => removeEmployee.mutate(empD.id)} className="h-7 w-7 p-0 text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {empA && (
                            <Button variant="ghost" size="sm" onClick={() => removeEmployee.mutate(empA.id)} className="h-7 w-7 p-0 text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                });
              })}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground italic">
                    Nenhum colaborador alocado nesta área ou setor. Clique no botão de alocação para começar!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative border rounded-xl overflow-hidden shadow-md bg-muted/5 h-[65vh]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            minZoom={0.3}
            maxZoom={2}
          >
            <Background gap={20} size={1} color="#16a34a" className="opacity-15" />
            <Controls />
          </ReactFlow>

          <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex flex-col gap-1 rounded-md border bg-background/95 p-3 text-[10px] shadow">
            <div className="flex items-center gap-1.5 font-bold uppercase text-muted-foreground tracking-wider mb-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Legenda do organograma
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-4 rounded border border-emerald-500/30 bg-emerald-500/10" /> Colaborador Ativo (Orçado)
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-4 rounded border border-destructive/30 bg-destructive/10" /> Fora do Orçamento
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-4 rounded border border-dashed border-warning/45 bg-warning/10" /> Vaga Cadastrada
            </div>
          </div>
        </div>
      )}

      {/* DIALOGS FOR CRUD ACTIONS */}
      {/* JOB CREATION DIALOG */}
      <Dialog open={jobModalOpen} onOpenChange={setJobModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Cargo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome do Cargo *</Label>
              <Input
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="Ex.: Gestor de Pessoas, Analista de Remuneração"
              />
            </div>
            <div>
              <Label>Descrição / Responsabilidades</Label>
              <Textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Ex.: Responsável pelo processamento e análise dos planos de carreira..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setJobModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createJob.mutate({ name: jobName, description: jobDescription })}
              disabled={!jobName.trim() || createJob.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              Salvar Cargo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EMPLOYEE ALLOCATION DIALOG */}
      <Dialog open={employeeModalOpen} onOpenChange={setEmployeeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alocar Colaborador no Quadro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cargo *</Label>
                <NativeSelect
                  value={selectedJobIdForEmployee}
                  onChange={(e) => setSelectedJobIdForEmployee(e.target.value)}
                >
                  <option value="">Selecione o cargo</option>
                  {data?.jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label>Área / Setor de Destino *</Label>
                <NativeSelect
                  value={employeeAreaId}
                  onChange={(e) => setEmployeeAreaId(e.target.value)}
                >
                  <option value="">Sem vínculo</option>
                  {areasAndSectors.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <div>
              <Label>Nome Completo do Colaborador *</Label>
              <Input
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="Ex.: Jailson Moreira Pimentel"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Matrícula (Código)</Label>
                <Input
                  value={employeeRegistration}
                  onChange={(e) => setEmployeeRegistration(e.target.value)}
                  placeholder="Ex.: 945951"
                />
              </div>
              <div>
                <Label>Faixa Salarial / Nível *</Label>
                <NativeSelect
                  value={employeeBand}
                  onChange={(e) => setEmployeeBand(e.target.value)}
                >
                  <option value="A">Faixa A</option>
                  <option value="B">Faixa B</option>
                  <option value="C">Faixa C</option>
                  <option value="D">Faixa D</option>
                </NativeSelect>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Turno Operacional *</Label>
                <NativeSelect
                  value={employeeShift}
                  onChange={(e) => setEmployeeShift(e.target.value)}
                >
                  <option value="A">Turno A</option>
                  <option value="B">Turno B</option>
                  <option value="C">Turno C</option>
                  <option value="D">Turno D</option>
                </NativeSelect>
              </div>
              <div>
                <Label>Situação Cadastral *</Label>
                <NativeSelect
                  value={employeeStatus}
                  onChange={(e) => setEmployeeStatus(e.target.value)}
                >
                  <option value="ACTIVE">Ativo (Alocado)</option>
                  <option value="VACANT">Vaga em Aberto</option>
                </NativeSelect>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t">
              <input
                type="checkbox"
                id="isBudgeted"
                checked={employeeIsBudgeted}
                onChange={(e) => setEmployeeIsBudgeted(e.target.checked)}
                className="h-4 w-4 border-gray-300 rounded text-primary focus:ring-primary"
              />
              <Label htmlFor="isBudgeted" className="font-semibold cursor-pointer">
                Colaborador dentro do limite orçado do quadro de lotação
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmployeeModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                createEmployee.mutate({
                  name: employeeName || 'Vaga em Aberto',
                  jobId: selectedJobIdForEmployee,
                  orgNodeId: employeeAreaId,
                  registrationId: employeeRegistration,
                  band: employeeBand,
                  shift: employeeShift,
                  isBudgeted: employeeIsBudgeted,
                  status: employeeStatus,
                })
              }
              disabled={!selectedJobIdForEmployee || !employeeName.trim() || createEmployee.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              Alocar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function OrganogramaPage() {
  return (
    <ReactFlowProvider>
      <OrganogramaInner />
    </ReactFlowProvider>
  );
}
