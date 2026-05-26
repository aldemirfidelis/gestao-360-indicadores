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
  ChevronDown,
  ChevronRight,
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
  bandPretended: string; // A, B, C
  shift: string; // A, B, C, D
  isBudgeted: boolean;
  status: string; // ACTIVE, VACANT
  approvalStatus: string; // PENDENTE, APROVADO, REPROVADO, EM_ANALISE
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

function AreaGroupNode({ data }: NodeProps<{ label: string }>) {
  return (
    <div className="h-full w-full rounded-2xl border-2 border-dashed border-emerald-600/30 bg-emerald-600/5 p-4 relative shadow-inner">
      <div className="absolute top-2 left-4 text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-300">
        Perspectiva: {data.label}
      </div>
    </div>
  );
}

const nodeTypes = { jobRole: JobRoleNode, areaGroup: AreaGroupNode };
const edgeTypes = { strategy: CareerPathEdge };

function OrganogramaInner() {
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<'excel' | 'canvas'>('excel');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({});
  
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
  const [employeeBandPretended, setEmployeeBandPretended] = useState('B');
  const [employeeShift, setEmployeeShift] = useState('D');
  const [employeeIsBudgeted, setEmployeeIsBudgeted] = useState(true);
  const [employeeStatus, setEmployeeStatus] = useState('ACTIVE');
  const [employeeApprovalStatus, setEmployeeApprovalStatus] = useState('PENDENTE');
  const [employeeAreaId, setEmployeeAreaId] = useState('');
  const [employeeNewAreaName, setEmployeeNewAreaName] = useState('');

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

  // Expand all by default
  useEffect(() => {
    if (areasAndSectors.length > 0) {
      const initial: Record<string, boolean> = { 'unlinked': true };
      areasAndSectors.forEach(a => {
        initial[a.id] = true;
      });
      setExpandedAreas(prev => ({ ...initial, ...prev }));
    }
  }, [areasAndSectors]);

  // MUTATIONS
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['strategy', 'organograma'] });
    qc.invalidateQueries({ queryKey: ['strategy', 'options'] });
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

  const updateEmployee = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; jobId?: string; orgNodeId?: string; registrationId?: string | null; band?: string; bandPretended?: string; shift?: string; isBudgeted?: boolean; status?: string; approvalStatus?: string }) =>
      api(`/strategy/employees/${id}`, { method: 'PATCH', json: body }),
    onSuccess: () => {
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao atualizar dados'),
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

  const resetEmployeeForm = () => {
    setEmployeeName('');
    setEmployeeRegistration('');
    setEmployeeBand('A');
    setEmployeeBandPretended('B');
    setEmployeeShift('D');
    setEmployeeIsBudgeted(true);
    setEmployeeStatus('ACTIVE');
    setEmployeeApprovalStatus('PENDENTE');
    setEmployeeAreaId(selectedAreaId);
    setEmployeeNewAreaName('');
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

  // BUILD REACT FLOW NODES & EDGES (With lanes/perspectives)
  useEffect(() => {
    if (!data) return;

    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];

    const activeAreas = areasAndSectors.filter(area => 
      data.employees.some(e => e.orgNodeId === area.id)
    );

    let currentX = 50;
    activeAreas.forEach((area) => {
      const areaEmployees = data.employees.filter(e => e.orgNodeId === area.id);
      const areaJobIds = Array.from(new Set(areaEmployees.map(e => e.jobId)));
      const areaJobs = data.jobs.filter(j => areaJobIds.includes(j.id));

      if (areaJobs.length === 0) return;

      const cols = 2;
      const rows = Math.ceil(areaJobs.length / cols);
      const laneWidth = 660;
      const laneHeight = 80 + rows * 260;

      flowNodes.push({
        id: `group-${area.id}`,
        type: 'areaGroup',
        data: { label: area.name },
        position: { x: currentX, y: 50 },
        style: { width: laneWidth, height: laneHeight },
        selectable: false,
        draggable: true,
      });

      areaJobs.forEach((job, jobIdx) => {
        const jobEmployees = areaEmployees.filter(e => e.jobId === job.id);
        const col = jobIdx % cols;
        const row = Math.floor(jobIdx / cols);

        flowNodes.push({
          id: `${area.id}-${job.id}`,
          parentId: `group-${area.id}`,
          type: 'jobRole',
          data: { job, employees: jobEmployees, editMode: true },
          position: { x: 30 + col * 310, y: 80 + row * 240 },
          extent: 'parent',
        });
      });

      currentX += laneWidth + 100;
    });

    // Unlinked jobs
    const unlinkedEmployees = data.employees.filter(e => !e.orgNodeId);
    const unlinkedJobIds = Array.from(new Set(unlinkedEmployees.map(e => e.jobId)));
    const remainingJobs = data.jobs.filter(j => 
      !data.employees.some(e => e.jobId === j.id) || unlinkedJobIds.includes(j.id)
    );

    if (remainingJobs.length > 0) {
      const cols = 2;
      const rows = Math.ceil(remainingJobs.length / cols);
      const laneWidth = 660;
      const laneHeight = 80 + rows * 260;

      flowNodes.push({
        id: 'group-unlinked',
        type: 'areaGroup',
        data: { label: 'Sem Área Definida' },
        position: { x: currentX, y: 50 },
        style: { width: laneWidth, height: laneHeight },
        selectable: false,
        draggable: true,
      });

      remainingJobs.forEach((job, jobIdx) => {
        const jobEmployees = unlinkedEmployees.filter(e => e.jobId === job.id);
        const col = jobIdx % cols;
        const row = Math.floor(jobIdx / cols);

        flowNodes.push({
          id: `unlinked-${job.id}`,
          parentId: 'group-unlinked',
          type: 'jobRole',
          data: { job, employees: jobEmployees, editMode: true },
          position: { x: 30 + col * 310, y: 80 + row * 240 },
          extent: 'parent',
        });
      });
    }

    // Connectors
    data.careerPaths.forEach((path) => {
      const sourceNodes = flowNodes.filter(n => n.id.endsWith(`-${path.fromJobId}`));
      const targetNodes = flowNodes.filter(n => n.id.endsWith(`-${path.toJobId}`));

      sourceNodes.forEach(src => {
        targetNodes.forEach(tgt => {
          flowEdges.push({
            id: `${path.id}-${src.id}-${tgt.id}`,
            source: src.id,
            target: tgt.id,
            type: 'strategy',
            sourceHandle: path.sourceHandle ?? 'right',
            targetHandle: path.targetHandle ?? 'left',
          });
        });
      });
    });

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [data, setNodes, setEdges, areasAndSectors]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const srcJobId = connection.source.split('-').pop();
      const tgtJobId = connection.target.split('-').pop();
      if (!srcJobId || !tgtJobId) return;

      createCareerPath.mutate({
        fromJobId: srcJobId,
        toJobId: tgtJobId,
      });
    },
    [createCareerPath]
  );

  const toggleAreaExpand = (areaId: string) => {
    setExpandedAreas((prev) => ({ ...prev, [areaId]: !prev[areaId] }));
  };

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
            Lista de Carreira
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
        <div className="space-y-4">
          {/* ACCORDION BY AREA */}
          {(selectedAreaId ? areasAndSectors.filter(a => a.id === selectedAreaId) : [...areasAndSectors, { id: 'unlinked', name: 'Sem Área Definida' }]).map((area) => {
            const areaEmps = data?.employees.filter(e => 
              area.id === 'unlinked' ? !e.orgNodeId : e.orgNodeId === area.id
            ) ?? [];

            if (areaEmps.length === 0 && area.id === 'unlinked') return null;

            const isOpen = !!expandedAreas[area.id];

            return (
              <div key={area.id} className="rounded-xl border bg-card shadow-sm overflow-hidden transition">
                {/* ACCORDION HEADER */}
                <button
                  onClick={() => toggleAreaExpand(area.id)}
                  className="w-full flex items-center justify-between p-4 bg-muted/40 hover:bg-muted/70 transition border-b text-left"
                >
                  <div className="flex items-center gap-2.5">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-emerald-600" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <h3 className="font-bold text-sm text-foreground uppercase tracking-wider flex items-center gap-2">
                        {area.name}
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] py-0.5 px-2 font-bold shrink-0">
                          {areaEmps.length} Colaboradores
                        </Badge>
                      </h3>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground font-semibold">
                    Divergentes: {areaEmps.filter(e => !e.isBudgeted).length}
                  </div>
                </button>

                {/* ACCORDION CONTENT */}
                {isOpen && (
                  <div className="p-4 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-muted border-b text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                          <th className="p-3 w-[220px]">Colaborador</th>
                          <th className="p-3 w-[180px]">Cargo</th>
                          <th className="p-3 w-[110px] text-center">Faixa Atual</th>
                          <th className="p-3 w-[110px] text-center">Faixa Pretendida</th>
                          <th className="p-3 w-[100px] text-center">Turno</th>
                          <th className="p-3 w-[110px] text-center">Matrícula</th>
                          <th className="p-3 w-[130px] text-center">Orçamento</th>
                          <th className="p-3 w-[150px] text-center">Status Carreira</th>
                          <th className="p-3 w-[60px] text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {areaEmps.map((emp) => (
                          <tr key={emp.id} className="border-b transition hover:bg-muted/20 align-middle">
                            {/* COLABORADOR NAME */}
                            <td className="p-3">
                              <Input
                                value={emp.name}
                                onChange={(e) => updateEmployee.mutate({ id: emp.id, name: e.target.value })}
                                className="h-8 font-semibold text-xs bg-background max-w-[200px]"
                                placeholder="Nome do Colaborador"
                              />
                            </td>

                            {/* CARGO (JOB ASSIGNMENT) */}
                            <td className="p-3">
                              <NativeSelect
                                value={emp.jobId}
                                onChange={(e) => updateEmployee.mutate({ id: emp.id, jobId: e.target.value })}
                                className="h-8 text-xs bg-background w-[160px]"
                              >
                                {data?.jobs.map((job) => (
                                  <option key={job.id} value={job.id}>
                                    {job.name}
                                  </option>
                                ))}
                              </NativeSelect>
                            </td>

                            {/* FAIXA ATUAL */}
                            <td className="p-3 text-center">
                              <NativeSelect
                                value={emp.band}
                                onChange={(e) => updateEmployee.mutate({ id: emp.id, band: e.target.value })}
                                className="h-8 text-xs bg-background mx-auto w-[80px] font-bold text-emerald-600"
                              >
                                <option value="A">Faixa A</option>
                                <option value="B">Faixa B</option>
                                <option value="C">Faixa C</option>
                                <option value="D">Faixa D</option>
                              </NativeSelect>
                            </td>

                            {/* FAIXA PRETENDIDA */}
                            <td className="p-3 text-center">
                              <NativeSelect
                                value={emp.bandPretended || 'B'}
                                onChange={(e) => updateEmployee.mutate({ id: emp.id, bandPretended: e.target.value })}
                                className="h-8 text-xs bg-background mx-auto w-[80px] font-bold text-amber-600"
                              >
                                <option value="A">Faixa A</option>
                                <option value="B">Faixa B</option>
                                <option value="C">Faixa C</option>
                                <option value="D">Faixa D</option>
                              </NativeSelect>
                            </td>

                            {/* TURNO */}
                            <td className="p-3 text-center">
                              <NativeSelect
                                value={emp.shift}
                                onChange={(e) => updateEmployee.mutate({ id: emp.id, shift: e.target.value })}
                                className="h-8 text-xs bg-background mx-auto w-[80px]"
                              >
                                <option value="A">Turno A</option>
                                <option value="B">Turno B</option>
                                <option value="C">Turno C</option>
                                <option value="D">Turno D</option>
                              </NativeSelect>
                            </td>

                            {/* MATRICULA */}
                            <td className="p-3 text-center">
                              <Input
                                value={emp.registrationId || ''}
                                onChange={(e) => updateEmployee.mutate({ id: emp.id, registrationId: e.target.value || null })}
                                className="h-8 text-center text-xs bg-background mx-auto w-[100px]"
                                placeholder="VAGA"
                              />
                            </td>

                            {/* ORÇAMENTO */}
                            <td className="p-3 text-center">
                              <NativeSelect
                                value={emp.isBudgeted ? 'true' : 'false'}
                                onChange={(e) => updateEmployee.mutate({ id: emp.id, isBudgeted: e.target.value === 'true' })}
                                className={cn(
                                  "h-8 text-xs mx-auto w-[120px] font-semibold rounded-md border",
                                  emp.isBudgeted 
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                    : "bg-amber-50 text-amber-800 border-amber-300"
                                )}
                              >
                                <option value="true">Previsto</option>
                                <option value="false">Fora Orçado</option>
                              </NativeSelect>
                            </td>

                            {/* CAREER STATUS */}
                            <td className="p-3 text-center">
                              <NativeSelect
                                value={emp.approvalStatus || 'PENDENTE'}
                                onChange={(e) => updateEmployee.mutate({ id: emp.id, approvalStatus: e.target.value })}
                                className={cn(
                                  "h-8 text-xs mx-auto w-[130px] font-bold rounded-md border",
                                  emp.approvalStatus === 'APROVADO' && "bg-emerald-500/10 text-emerald-700 border-emerald-300",
                                  emp.approvalStatus === 'REPROVADO' && "bg-destructive/10 text-destructive border-destructive-foreground/20",
                                  emp.approvalStatus === 'PENDENTE' && "bg-gray-100 text-gray-700 border-gray-300",
                                  emp.approvalStatus === 'EM_ANALISE' && "bg-sky-100 text-sky-800 border-sky-300"
                                )}
                              >
                                <option value="PENDENTE">Pendente</option>
                                <option value="EM_ANALISE">Em Análise</option>
                                <option value="APROVADO">Aprovado</option>
                                <option value="REPROVADO">Reprovado</option>
                              </NativeSelect>
                            </td>

                            {/* ACTIONS */}
                            <td className="p-3 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeEmployee.mutate(emp.id)}
                                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
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
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
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
                <Label>Área / Setor Existente</Label>
                <NativeSelect
                  value={employeeAreaId}
                  onChange={(e) => {
                    setEmployeeAreaId(e.target.value);
                    if (e.target.value) setEmployeeNewAreaName('');
                  }}
                >
                  <option value="">-- Selecione para vincular --</option>
                  {areasAndSectors.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <div>
              <Label>OU Criar Nova Perspectiva (Área / Setor)</Label>
              <Input
                value={employeeNewAreaName}
                onChange={(e) => {
                  setEmployeeNewAreaName(e.target.value);
                  if (e.target.value) setEmployeeAreaId('');
                }}
                placeholder="Ex.: Novos Negócios, Auditoria Interna"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Se digitado, criará essa nova perspectiva automaticamente no Canvas.
              </p>
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
                <Label>Faixa Salarial Atual *</Label>
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
                <Label>Faixa Pretendida *</Label>
                <NativeSelect
                  value={employeeBandPretended}
                  onChange={(e) => setEmployeeBandPretended(e.target.value)}
                >
                  <option value="A">Faixa A</option>
                  <option value="B">Faixa B</option>
                  <option value="C">Faixa C</option>
                  <option value="D">Faixa D</option>
                </NativeSelect>
              </div>
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status da Carreira *</Label>
                <NativeSelect
                  value={employeeApprovalStatus}
                  onChange={(e) => setEmployeeApprovalStatus(e.target.value)}
                >
                  <option value="PENDENTE">Pendente</option>
                  <option value="EM_ANALISE">Em Análise</option>
                  <option value="APROVADO">Aprovado</option>
                  <option value="REPROVADO">Reprovado</option>
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
              <Label htmlFor="isBudgeted" className="font-semibold cursor-pointer text-xs">
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
                  orgNodeName: employeeNewAreaName,
                  registrationId: employeeRegistration,
                  band: employeeBand,
                  bandPretended: employeeBandPretended,
                  shift: employeeShift,
                  isBudgeted: employeeIsBudgeted,
                  status: employeeStatus,
                  approvalStatus: employeeApprovalStatus,
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
