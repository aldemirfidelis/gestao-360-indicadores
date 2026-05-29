'use client';

import { useMemo, useState, type DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  Clock,
  GripVertical,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { EmptyState } from '@/components/platform/empty-state';
import { LoadingState } from '@/components/platform/loading-state';
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
import { cn, formatNumber } from '@/lib/utils';

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

interface PendingApprovalSummary {
  id: string;
  status: string;
  approver: { id: string; name: string; email?: string };
  requester: { id: string; name: string; email?: string };
  currentJob: { id: string; name: string };
  targetJob: { id: string; name: string };
  currentBand: string;
  targetBand: string;
  createdAt: string;
}

interface OrgEmployee {
  id: string;
  registrationId: string | null;
  name: string;
  jobId: string;
  job: OrgJob;
  jobPretendedId: string | null;
  jobPretended: OrgJob | null;
  orgNodeId: string | null;
  orgNode: OrgNode | null;
  band: string;
  bandPretended: string;
  shift: string;
  isBudgeted: boolean;
  status: string;
  approvalStatus: string;
  approvalRequests?: PendingApprovalSummary[];
}

interface OrganogramaData {
  jobs: OrgJob[];
  employees: OrgEmployee[];
  careerPaths: any[];
}

interface StrategyOptions {
  orgNodes: OrgNode[];
}

const UNLINKED_KEY = 'unlinked';

export default function OrganogramaPage() {
  const qc = useQueryClient();
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({});
  const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});
  const [dragEmployeeId, setDragEmployeeId] = useState<string | null>(null);
  const [hoverSlot, setHoverSlot] = useState<string | null>(null);

  // Modals
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [editEmployeeModal, setEditEmployeeModal] = useState<{ open: boolean; employee: OrgEmployee | null }>({ open: false, employee: null });
  const [approvalDialog, setApprovalDialog] = useState<{ open: boolean; employee: OrgEmployee | null }>({ open: false, employee: null });

  // Forms
  const [jobForm, setJobForm] = useState({ name: '', description: '' });
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    jobId: '',
    orgNodeId: '',
    registrationId: '',
    band: 'A',
    bandPretended: 'B',
    shift: 'D',
    isBudgeted: true,
    status: 'ACTIVE',
    approvalStatus: 'PENDENTE',
  });
  const [editForm, setEditForm] = useState({
    name: '',
    jobId: '',
    jobPretendedId: '',
    band: 'B',
    bandPretended: 'B',
    shift: 'D',
    registrationId: '',
    isBudgeted: true,
    status: 'ACTIVE',
  });
  const [approvalForm, setApprovalForm] = useState({ approverId: '', reason: '' });

  // Queries
  const organogramaQuery = useQuery<OrganogramaData>({
    queryKey: ['strategy', 'organograma'],
    queryFn: () => api<OrganogramaData>('/strategy/organograma'),
  });
  const optionsQuery = useQuery<StrategyOptions>({
    queryKey: ['strategy', 'options'],
    queryFn: () => api<StrategyOptions>('/strategy/options'),
  });
  const approversQuery = useQuery<{ id: string; name: string; email?: string; role: string; jobTitle?: string }[]>({
    queryKey: ['career-approvers'],
    queryFn: () => api('/strategy/career-approvals/approvers'),
    staleTime: 60_000,
  });

  const data = organogramaQuery.data;
  const orgNodes = optionsQuery.data?.orgNodes ?? [];
  const areasAndSectors = useMemo(() => orgNodes.filter((n) => n.type === 'SECTOR' || n.type === 'AREA'), [orgNodes]);

  // Mutations
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['strategy', 'organograma'] });
    qc.invalidateQueries({ queryKey: ['strategy', 'options'] });
  };

  const createJob = useMutation({
    mutationFn: (body: { name: string; description?: string }) => api('/strategy/jobs', { method: 'POST', json: body }),
    onSuccess: () => {
      toast.success('Cargo cadastrado');
      setJobModalOpen(false);
      setJobForm({ name: '', description: '' });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao cadastrar cargo'),
  });
  const createEmployee = useMutation({
    mutationFn: (body: any) => api('/strategy/employees', { method: 'POST', json: body }),
    onSuccess: () => {
      toast.success('Colaborador alocado');
      setEmployeeModalOpen(false);
      setNewEmployee({ name: '', jobId: '', orgNodeId: '', registrationId: '', band: 'A', bandPretended: 'B', shift: 'D', isBudgeted: true, status: 'ACTIVE', approvalStatus: 'PENDENTE' });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao alocar colaborador'),
  });
  const updateEmployee = useMutation({
    mutationFn: ({ id, ...body }: { id: string; [key: string]: any }) => api(`/strategy/employees/${id}`, { method: 'PATCH', json: body }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao atualizar colaborador'),
  });
  const removeEmployee = useMutation({
    mutationFn: (id: string) => api(`/strategy/employees/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Colaborador removido');
      invalidate();
    },
  });
  const sendForApproval = useMutation({
    mutationFn: (body: { employeeId: string; approverId: string; targetJobId?: string; targetBand?: string; reason?: string }) =>
      api('/strategy/career-approvals', { method: 'POST', json: body }),
    onSuccess: () => {
      toast.success('Solicitação enviada para aprovação');
      setApprovalDialog({ open: false, employee: null });
      setApprovalForm({ approverId: '', reason: '' });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao enviar para aprovação'),
  });

  // Group data by Area -> Job -> Employees
  const grouped = useMemo(() => {
    const map = new Map<string, { area: OrgNode | null; jobs: Map<string, { job: OrgJob; employees: OrgEmployee[] }> }>();
    if (!data) return map;

    // initialize known areas/sectors so they appear even sem colaboradores
    areasAndSectors.forEach((area) => {
      map.set(area.id, { area, jobs: new Map() });
    });
    map.set(UNLINKED_KEY, { area: null, jobs: new Map() });

    data.employees.forEach((emp) => {
      const key = emp.orgNodeId ?? UNLINKED_KEY;
      const entry = map.get(key) ?? { area: emp.orgNode ?? null, jobs: new Map() };
      const jobEntry = entry.jobs.get(emp.jobId) ?? { job: emp.job, employees: [] };
      jobEntry.employees.push(emp);
      entry.jobs.set(emp.jobId, jobEntry);
      if (!map.has(key)) map.set(key, entry);
    });

    return map;
  }, [data, areasAndSectors]);

  const stats = useMemo(() => {
    if (!data) return { total: 0, active: 0, budgeted: 0, vacant: 0 };
    const total = data.employees.length;
    const active = data.employees.filter((e) => e.status === 'ACTIVE').length;
    const budgeted = data.employees.filter((e) => e.isBudgeted).length;
    const vacant = data.employees.filter((e) => e.status === 'VACANT').length;
    return { total, active, budgeted, vacant };
  }, [data]);

  function toggleArea(key: string) {
    setExpandedAreas((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  }
  function toggleJob(key: string) {
    setExpandedJobs((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  }

  // Drag & drop handlers
  function onDragStart(empId: string) {
    setDragEmployeeId(empId);
  }
  function onDragEnd() {
    setDragEmployeeId(null);
    setHoverSlot(null);
  }
  function onDragOver(event: DragEvent<HTMLDivElement>, slotKey: string) {
    if (!dragEmployeeId) return;
    event.preventDefault();
    setHoverSlot(slotKey);
  }
  function onDrop(event: DragEvent<HTMLDivElement>, areaKey: string, jobId: string) {
    event.preventDefault();
    if (!dragEmployeeId || !data) return;
    const emp = data.employees.find((e) => e.id === dragEmployeeId);
    if (!emp) return;
    const targetOrgNodeId = areaKey === UNLINKED_KEY ? null : areaKey;
    const sameArea = emp.orgNodeId === targetOrgNodeId;
    const sameJob = emp.jobId === jobId;
    if (sameArea && sameJob) {
      onDragEnd();
      return;
    }
    updateEmployee.mutate(
      {
        id: emp.id,
        orgNodeId: targetOrgNodeId,
        jobId,
      },
      {
        onSuccess: () => {
          const areaLabel = targetOrgNodeId ? areasAndSectors.find((a) => a.id === targetOrgNodeId)?.name ?? 'Área' : 'Sem área';
          const jobLabel = data.jobs.find((j) => j.id === jobId)?.name ?? 'cargo';
          toast.success(`${emp.name} movido para ${jobLabel} • ${areaLabel}`);
        },
      },
    );
    onDragEnd();
  }

  function openEditEmployee(emp: OrgEmployee) {
    setEditForm({
      name: emp.name,
      jobId: emp.jobId,
      jobPretendedId: emp.jobPretendedId ?? '',
      band: emp.band,
      bandPretended: emp.bandPretended ?? 'B',
      shift: emp.shift,
      registrationId: emp.registrationId ?? '',
      isBudgeted: emp.isBudgeted,
      status: emp.status,
    });
    setEditEmployeeModal({ open: true, employee: emp });
  }

  function submitEditEmployee() {
    if (!editEmployeeModal.employee) return;
    updateEmployee.mutate(
      {
        id: editEmployeeModal.employee.id,
        name: editForm.name,
        jobId: editForm.jobId,
        jobPretendedId: editForm.jobPretendedId || null,
        band: editForm.band,
        bandPretended: editForm.bandPretended,
        shift: editForm.shift,
        registrationId: editForm.registrationId || null,
        isBudgeted: editForm.isBudgeted,
        status: editForm.status,
      },
      {
        onSuccess: () => {
          toast.success('Cadastro atualizado');
          setEditEmployeeModal({ open: false, employee: null });
        },
      },
    );
  }

  function submitApproval() {
    if (!approvalDialog.employee || !approvalForm.approverId) return;
    const emp = approvalDialog.employee;
    sendForApproval.mutate({
      employeeId: emp.id,
      approverId: approvalForm.approverId,
      targetJobId: emp.jobPretendedId ?? undefined,
      targetBand: emp.bandPretended ?? undefined,
      reason: approvalForm.reason || undefined,
    });
  }

  const orderedAreas = [
    ...areasAndSectors.map((area) => ({ key: area.id, area })),
    { key: UNLINKED_KEY, area: null as OrgNode | null },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Gestão de Pessoas"
        tone="view"
        title="Organograma de Área"
        description="Hierarquia de Áreas, Cargos e Colaboradores. Arraste a linha do colaborador para movê-lo entre Cargos ou Áreas — a alocação é salva automaticamente no cadastro."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Organograma' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setJobModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo cargo
            </Button>
            <Button onClick={() => setEmployeeModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Alocar colaborador
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total" value={formatNumber(stats.total)} description="Colaboradores e vagas" icon={<Users className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Ativos" value={formatNumber(stats.active)} description="Alocados no quadro" icon={<User className="h-4 w-4" />} tone="green" />
        <MetricCard title="Dentro do orçamento" value={formatNumber(stats.budgeted)} description="Previstos no plano" icon={<Briefcase className="h-4 w-4" />} tone="purple" />
        <MetricCard title="Vagas em aberto" value={formatNumber(stats.vacant)} description="Posições disponíveis" icon={<Building2 className="h-4 w-4" />} tone="yellow" />
      </div>

      <SectionCard
        title="Estrutura de pessoas"
        description="Áreas, cargos e colaboradores. Clique nas linhas para arrastá-las e reorganizar a alocação sem editar o cadastro."
        contentClassName="p-3"
      >
        {organogramaQuery.isLoading && <LoadingState />}
        {!organogramaQuery.isLoading && (data?.employees.length ?? 0) === 0 && (
          <EmptyState
            title="Nenhum colaborador cadastrado"
            description="Cadastre cargos e aloque colaboradores para visualizar o organograma por Área."
          />
        )}

        <div className="space-y-1">
          {orderedAreas.map(({ key, area }) => {
            const entry = grouped.get(key);
            if (!entry) return null;
            const totalEmps = Array.from(entry.jobs.values()).reduce((acc, j) => acc + j.employees.length, 0);
            if (key === UNLINKED_KEY && totalEmps === 0) return null;
            const areaOpen = expandedAreas[key] ?? true;
            const areaLabel = area?.name ?? 'Sem área definida';

            return (
              <div key={key}>
                <div className="grid grid-cols-[auto,1fr,auto] items-center gap-3 border-b border-border/60 px-2 py-2 transition-colors hover:bg-accent/40">
                  <button
                    onClick={() => toggleArea(key)}
                    className="grid h-7 w-7 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={areaOpen ? 'Recolher' : 'Expandir'}
                  >
                    {areaOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <button onClick={() => toggleArea(key)} className="flex min-w-0 items-center gap-3 text-left">
                    <span className="grid h-8 w-8 shrink-0 place-items-center bg-foreground text-background">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{areaLabel}</span>
                      <span className="block text-xs text-muted-foreground">
                        {entry.jobs.size} cargo(s) · {totalEmps} colaborador(es)
                      </span>
                    </span>
                  </button>
                  <Badge variant="outline">{totalEmps}</Badge>
                </div>

                {areaOpen && (
                  <div className="ml-5 border-l border-dashed border-border/60">
                    {entry.jobs.size === 0 && (
                      <div className="ml-3 px-3 py-3 text-xs italic text-muted-foreground">
                        Nenhum colaborador alocado nesta área. Arraste um colaborador para cá.
                      </div>
                    )}
                    {Array.from(entry.jobs.values()).map(({ job, employees }) => {
                      const slotKey = `${key}::${job.id}`;
                      const jobOpen = expandedJobs[slotKey] ?? true;
                      const isHover = hoverSlot === slotKey;
                      return (
                        <div
                          key={slotKey}
                          onDragOver={(ev) => onDragOver(ev, slotKey)}
                          onDragLeave={() => setHoverSlot((cur) => (cur === slotKey ? null : cur))}
                          onDrop={(ev) => onDrop(ev, key, job.id)}
                          className={cn(
                            'border-l border-transparent',
                            isHover && 'border-l-foreground bg-foreground/[0.04]',
                          )}
                        >
                          <div className="grid grid-cols-[auto,1fr,auto] items-center gap-3 px-2 py-2 transition-colors hover:bg-accent/30">
                            <button
                              onClick={() => toggleJob(slotKey)}
                              className="grid h-6 w-6 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              {jobOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                            <button onClick={() => toggleJob(slotKey)} className="flex min-w-0 items-center gap-3 text-left">
                              <span className="grid h-7 w-7 shrink-0 place-items-center border border-border/60 bg-muted text-muted-foreground">
                                <Briefcase className="h-3.5 w-3.5" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">{job.name}</span>
                                <span className="block text-xs text-muted-foreground">{employees.length} colaborador(es)</span>
                              </span>
                            </button>
                            <Badge variant="secondary">{employees.length}</Badge>
                          </div>

                          {jobOpen && (
                            <div className="ml-4 border-l border-dashed border-border/60">
                              {employees.length === 0 && (
                                <div className="ml-3 px-3 py-2 text-xs italic text-muted-foreground">
                                  Solte um colaborador aqui para movê-lo para {job.name}.
                                </div>
                              )}
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[1080px] border-collapse text-left text-xs">
                                  <thead>
                                    <tr className="border-b border-border/60 text-[10px] uppercase tracking-wide text-muted-foreground">
                                      <th className="p-2 w-8"></th>
                                      <th className="p-2 w-[200px]">Colaborador</th>
                                      <th className="p-2 w-[100px] text-center">Faixa atual</th>
                                      <th className="p-2 w-[140px]">Cargo pretendido</th>
                                      <th className="p-2 w-[100px] text-center">Faixa pretendida</th>
                                      <th className="p-2 w-[80px] text-center">Turno</th>
                                      <th className="p-2 w-[100px] text-center">Matrícula</th>
                                      <th className="p-2 w-[110px] text-center">Orçamento</th>
                                      <th className="p-2 w-[130px] text-center">Status</th>
                                      <th className="p-2 w-[90px] text-center">Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {employees.map((emp) => (
                                      <tr
                                        key={emp.id}
                                        draggable
                                        onDragStart={() => onDragStart(emp.id)}
                                        onDragEnd={onDragEnd}
                                        className={cn(
                                          'border-b border-border/60 align-middle transition-colors hover:bg-muted/30',
                                          dragEmployeeId === emp.id && 'opacity-40',
                                        )}
                                      >
                                        <td className="p-2 align-middle">
                                          <span className="grid h-7 w-7 cursor-grab place-items-center text-muted-foreground/70 active:cursor-grabbing" title="Arraste para mover">
                                            <GripVertical className="h-4 w-4" />
                                          </span>
                                        </td>
                                        <td className="p-2">
                                          <div className="flex min-w-[180px] items-center gap-2">
                                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-semibold text-background">
                                              {emp.name.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                                            </span>
                                            <Input
                                              value={emp.name}
                                              onChange={(e) => updateEmployee.mutate({ id: emp.id, name: e.target.value })}
                                              className="h-8 text-xs"
                                              placeholder="Nome do colaborador"
                                            />
                                            {emp.approvalRequests && emp.approvalRequests.length > 0 ? (
                                              <span className="inline-flex shrink-0 items-center gap-1 border border-status-blue/30 bg-status-blue/10 px-1.5 py-0.5 text-[10px] font-medium text-status-blue">
                                                <Clock className="h-3 w-3" /> Aguardando
                                              </span>
                                            ) : (
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                  setApprovalForm({ approverId: '', reason: '' });
                                                  setApprovalDialog({ open: true, employee: emp });
                                                }}
                                                className="h-7 shrink-0 px-2 text-[10px]"
                                                title="Enviar para aprovação"
                                              >
                                                <Send className="mr-1 h-3 w-3" /> Aprovação
                                              </Button>
                                            )}
                                          </div>
                                        </td>
                                        <td className="p-2 text-center">
                                          <NativeSelect
                                            value={emp.band}
                                            onChange={(e) => updateEmployee.mutate({ id: emp.id, band: e.target.value })}
                                            className="h-8 w-[80px] mx-auto text-xs"
                                          >
                                            <option value="A">Faixa A</option>
                                            <option value="B">Faixa B</option>
                                            <option value="C">Faixa C</option>
                                            <option value="D">Faixa D</option>
                                          </NativeSelect>
                                        </td>
                                        <td className="p-2">
                                          <NativeSelect
                                            value={emp.jobPretendedId ?? ''}
                                            onChange={(e) => updateEmployee.mutate({ id: emp.id, jobPretendedId: e.target.value || null })}
                                            className="h-8 w-[130px] text-xs"
                                          >
                                            <option value="">— Mesmo cargo —</option>
                                            {data?.jobs.map((j) => (
                                              <option key={j.id} value={j.id}>{j.name}</option>
                                            ))}
                                          </NativeSelect>
                                        </td>
                                        <td className="p-2 text-center">
                                          <NativeSelect
                                            value={emp.bandPretended || 'B'}
                                            onChange={(e) => updateEmployee.mutate({ id: emp.id, bandPretended: e.target.value })}
                                            className="h-8 w-[80px] mx-auto text-xs"
                                          >
                                            <option value="A">Faixa A</option>
                                            <option value="B">Faixa B</option>
                                            <option value="C">Faixa C</option>
                                            <option value="D">Faixa D</option>
                                          </NativeSelect>
                                        </td>
                                        <td className="p-2 text-center">
                                          <NativeSelect
                                            value={emp.shift}
                                            onChange={(e) => updateEmployee.mutate({ id: emp.id, shift: e.target.value })}
                                            className="h-8 w-[80px] mx-auto text-xs"
                                          >
                                            <option value="A">A</option>
                                            <option value="B">B</option>
                                            <option value="C">C</option>
                                            <option value="D">D</option>
                                          </NativeSelect>
                                        </td>
                                        <td className="p-2 text-center">
                                          <Input
                                            value={emp.registrationId ?? ''}
                                            onChange={(e) => updateEmployee.mutate({ id: emp.id, registrationId: e.target.value || null })}
                                            className="h-8 w-[100px] mx-auto text-center text-xs"
                                            placeholder="VAGA"
                                          />
                                        </td>
                                        <td className="p-2 text-center">
                                          <NativeSelect
                                            value={emp.isBudgeted ? 'true' : 'false'}
                                            onChange={(e) => updateEmployee.mutate({ id: emp.id, isBudgeted: e.target.value === 'true' })}
                                            className={cn(
                                              'h-8 w-[110px] mx-auto text-xs font-medium',
                                              emp.isBudgeted ? 'text-status-green' : 'text-status-yellow',
                                            )}
                                          >
                                            <option value="true">Previsto</option>
                                            <option value="false">Fora orçado</option>
                                          </NativeSelect>
                                        </td>
                                        <td className="p-2 text-center">
                                          <NativeSelect
                                            value={emp.approvalStatus || 'PENDENTE'}
                                            onChange={(e) => updateEmployee.mutate({ id: emp.id, approvalStatus: e.target.value })}
                                            className={cn(
                                              'h-8 w-[130px] mx-auto text-xs font-medium',
                                              emp.approvalStatus === 'APROVADO' && 'text-status-green',
                                              emp.approvalStatus === 'REPROVADO' && 'text-status-red',
                                              emp.approvalStatus === 'EM_ANALISE' && 'text-status-blue',
                                            )}
                                          >
                                            <option value="PENDENTE">Pendente</option>
                                            <option value="EM_ANALISE">Em análise</option>
                                            <option value="APROVADO">Aprovado</option>
                                            <option value="REPROVADO">Reprovado</option>
                                          </NativeSelect>
                                        </td>
                                        <td className="p-2 text-center">
                                          <div className="flex items-center justify-center gap-1">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => openEditEmployee(emp)}
                                              className="h-7 w-7 p-0"
                                              title="Editar cadastro"
                                            >
                                              <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                if (window.confirm('Remover este colaborador?')) removeEmployee.mutate(emp.id);
                                              }}
                                              className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                              title="Excluir"
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Novo cargo */}
      <Dialog open={jobModalOpen} onOpenChange={setJobModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo cargo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nome do cargo *</Label>
              <Input value={jobForm.name} onChange={(e) => setJobForm({ ...jobForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={3} value={jobForm.description} onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setJobModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => createJob.mutate({ name: jobForm.name, description: jobForm.description })} disabled={!jobForm.name.trim() || createJob.isPending}>
              <Save className="mr-2 h-4 w-4" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alocar colaborador */}
      <Dialog open={employeeModalOpen} onOpenChange={setEmployeeModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Alocar colaborador</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Nome *</Label>
              <Input value={newEmployee.name} onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })} />
            </div>
            <div>
              <Label>Cargo *</Label>
              <NativeSelect value={newEmployee.jobId} onChange={(e) => setNewEmployee({ ...newEmployee, jobId: e.target.value })}>
                <option value="">Selecione</option>
                {data?.jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Área / Setor</Label>
              <NativeSelect value={newEmployee.orgNodeId} onChange={(e) => setNewEmployee({ ...newEmployee, orgNodeId: e.target.value })}>
                <option value="">Sem área</option>
                {areasAndSectors.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Matrícula</Label>
              <Input value={newEmployee.registrationId} onChange={(e) => setNewEmployee({ ...newEmployee, registrationId: e.target.value })} />
            </div>
            <div>
              <Label>Faixa atual</Label>
              <NativeSelect value={newEmployee.band} onChange={(e) => setNewEmployee({ ...newEmployee, band: e.target.value })}>
                <option value="A">Faixa A</option>
                <option value="B">Faixa B</option>
                <option value="C">Faixa C</option>
                <option value="D">Faixa D</option>
              </NativeSelect>
            </div>
            <div>
              <Label>Faixa pretendida</Label>
              <NativeSelect value={newEmployee.bandPretended} onChange={(e) => setNewEmployee({ ...newEmployee, bandPretended: e.target.value })}>
                <option value="A">Faixa A</option>
                <option value="B">Faixa B</option>
                <option value="C">Faixa C</option>
                <option value="D">Faixa D</option>
              </NativeSelect>
            </div>
            <div>
              <Label>Turno</Label>
              <NativeSelect value={newEmployee.shift} onChange={(e) => setNewEmployee({ ...newEmployee, shift: e.target.value })}>
                <option value="A">Turno A</option>
                <option value="B">Turno B</option>
                <option value="C">Turno C</option>
                <option value="D">Turno D</option>
              </NativeSelect>
            </div>
            <div>
              <Label>Status cadastral</Label>
              <NativeSelect value={newEmployee.status} onChange={(e) => setNewEmployee({ ...newEmployee, status: e.target.value })}>
                <option value="ACTIVE">Ativo</option>
                <option value="VACANT">Vaga</option>
              </NativeSelect>
            </div>
            <label className="sm:col-span-2 mt-1 flex items-center gap-2 border border-border/60 p-3 text-sm">
              <input
                type="checkbox"
                checked={newEmployee.isBudgeted}
                onChange={(e) => setNewEmployee({ ...newEmployee, isBudgeted: e.target.checked })}
                className="h-4 w-4 accent-foreground"
              />
              Colaborador dentro do limite orçado
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmployeeModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createEmployee.mutate(newEmployee)}
              disabled={!newEmployee.name.trim() || !newEmployee.jobId || createEmployee.isPending}
            >
              <Save className="mr-2 h-4 w-4" /> Alocar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar cadastro */}
      <Dialog open={editEmployeeModal.open} onOpenChange={(open) => setEditEmployeeModal({ open, employee: open ? editEmployeeModal.employee : null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Editar cadastro do colaborador
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Nome *</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Cargo atual *</Label>
              <NativeSelect value={editForm.jobId} onChange={(e) => setEditForm({ ...editForm, jobId: e.target.value })}>
                {data?.jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Cargo pretendido</Label>
              <NativeSelect value={editForm.jobPretendedId} onChange={(e) => setEditForm({ ...editForm, jobPretendedId: e.target.value })}>
                <option value="">— Mesmo cargo —</option>
                {data?.jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Faixa atual</Label>
              <NativeSelect value={editForm.band} onChange={(e) => setEditForm({ ...editForm, band: e.target.value })}>
                <option value="A">Faixa A</option>
                <option value="B">Faixa B</option>
                <option value="C">Faixa C</option>
                <option value="D">Faixa D</option>
              </NativeSelect>
            </div>
            <div>
              <Label>Faixa pretendida</Label>
              <NativeSelect value={editForm.bandPretended} onChange={(e) => setEditForm({ ...editForm, bandPretended: e.target.value })}>
                <option value="A">Faixa A</option>
                <option value="B">Faixa B</option>
                <option value="C">Faixa C</option>
                <option value="D">Faixa D</option>
              </NativeSelect>
            </div>
            <div>
              <Label>Turno</Label>
              <NativeSelect value={editForm.shift} onChange={(e) => setEditForm({ ...editForm, shift: e.target.value })}>
                <option value="A">Turno A</option>
                <option value="B">Turno B</option>
                <option value="C">Turno C</option>
                <option value="D">Turno D</option>
              </NativeSelect>
            </div>
            <div>
              <Label>Matrícula</Label>
              <Input value={editForm.registrationId} onChange={(e) => setEditForm({ ...editForm, registrationId: e.target.value })} placeholder="VAGA" />
            </div>
            <div>
              <Label>Status</Label>
              <NativeSelect value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                <option value="ACTIVE">Ativo</option>
                <option value="VACANT">Vaga</option>
                <option value="INACTIVE">Inativo</option>
              </NativeSelect>
            </div>
            <label className="sm:col-span-2 mt-1 flex items-center gap-2 border border-border/60 p-3 text-sm">
              <input
                type="checkbox"
                checked={editForm.isBudgeted}
                onChange={(e) => setEditForm({ ...editForm, isBudgeted: e.target.checked })}
                className="h-4 w-4 accent-foreground"
              />
              Dentro do orçamento
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditEmployeeModal({ open: false, employee: null })}>Cancelar</Button>
            <Button onClick={submitEditEmployee} disabled={!editForm.name.trim() || !editForm.jobId || updateEmployee.isPending}>
              <Save className="mr-2 h-4 w-4" /> Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enviar para aprovação */}
      <Dialog open={approvalDialog.open} onOpenChange={(open) => setApprovalDialog({ open, employee: open ? approvalDialog.employee : null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4" /> Enviar para aprovação
            </DialogTitle>
          </DialogHeader>
          {approvalDialog.employee && (
            <div className="grid gap-4 py-2">
              <div className="border border-border/60 bg-muted/30 p-3 text-xs">
                <div className="mb-2 font-semibold">{approvalDialog.employee.name}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Cargo atual</div>
                    <div>{approvalDialog.employee.job.name} · Faixa {approvalDialog.employee.band}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Cargo pretendido</div>
                    <div className="font-medium">
                      {approvalDialog.employee.jobPretended?.name ?? approvalDialog.employee.job.name} · Faixa {approvalDialog.employee.bandPretended}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <Label>Aprovador *</Label>
                <NativeSelect value={approvalForm.approverId} onChange={(e) => setApprovalForm({ ...approvalForm, approverId: e.target.value })}>
                  <option value="">Selecione um aprovador</option>
                  {(approversQuery.data ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}{u.jobTitle ? ` · ${u.jobTitle}` : ''} ({u.role})
                    </option>
                  ))}
                </NativeSelect>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Apenas usuários com perfil ADMIN, DIRECTOR ou MANAGER podem aprovar.
                </p>
              </div>
              <div>
                <Label>Justificativa (opcional)</Label>
                <Textarea
                  rows={3}
                  value={approvalForm.reason}
                  onChange={(e) => setApprovalForm({ ...approvalForm, reason: e.target.value })}
                  placeholder="Motivo da promoção / mudança de cargo..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApprovalDialog({ open: false, employee: null })}>Cancelar</Button>
            <Button onClick={submitApproval} disabled={!approvalForm.approverId || sendForApproval.isPending}>
              <Send className="mr-2 h-4 w-4" /> Enviar solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
