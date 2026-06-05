'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileText,
  Filter,
  Gauge,
  Layers,
  Library,
  ListChecks,
  Plus,
  Radar,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';

type AuditStatus =
  | 'DRAFT' | 'WAITING_APPROVAL' | 'PLANNED' | 'SCHEDULED' | 'PREPARATION' | 'READY_EXECUTION'
  | 'IN_PROGRESS' | 'WAITING_COMPLEMENT' | 'LEAD_REVIEW' | 'WAITING_AUDITED_RESPONSE'
  | 'REPORT_ISSUED' | 'FOLLOW_UP' | 'COMPLETED' | 'CLOSED' | 'SUSPENDED' | 'CANCELLED' | 'RESCHEDULED';
type AuditType = string;
type AuditModality = 'PRESENTIAL' | 'REMOTE' | 'HYBRID';
type FindingType = string;
type FindingStatus = string;
type Severity = 'MINOR' | 'MAJOR' | 'CRITICAL';
type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

interface OptionItem { id: string; name: string; code?: string | null; email?: string | null; type?: string | null; category?: string | null; status?: string | null; riskScore?: number; riskLevel?: RiskLevel; }
interface Finding {
  id: string;
  code: string | null;
  type: FindingType;
  severity: Severity | null;
  status: FindingStatus;
  description: string;
  conditionFound: string | null;
  expectedCriteria: string | null;
  evidence: string | null;
  recommendation: string | null;
  dueDate: string | null;
  nonConformityId: string | null;
  nonConformity: { id: string; number: number; title: string; status: string } | null;
}
interface Audit {
  id: string;
  number: number;
  code: string | null;
  title: string;
  scope: string | null;
  objective: string | null;
  criteria: string | null;
  type: AuditType;
  modality: AuditModality;
  status: AuditStatus;
  programId: string | null;
  universeItemId: string | null;
  orgNodeId: string | null;
  leadAuditorUserId: string | null;
  plannedDate: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  score: number | null;
  result: string | null;
  opinion: string | null;
  summary: string | null;
  orgNode: { id: string; name: string; type: string } | null;
  leadAuditor: { id: string; name: string; email: string } | null;
  findings: Finding[];
  findingsCount: number;
  openFindings: number;
  ncCount: number;
  pendingNc: number;
  criticalFindings: number;
  overdueFindings: number;
}
interface AuditDetail extends Audit {
  program?: OptionItem | null;
  universeItem?: OptionItem | null;
  checklistExecutions?: Array<{ id: string; code: string; status: string; progress: number; templateId: string | null; responses: unknown[] }>;
  evidence?: Array<{ id: string; code: string; description: string | null; fileName: string | null; type: string | null; status: string; createdAt: string }>;
  reports?: Array<{ id: string; code: string; title: string; status: string; executiveSummary: string | null; createdAt: string }>;
  followUps?: Array<{ id: string; title: string; status: string; dueDate: string | null; responsibleUserId: string | null }>;
  timeline?: Array<{ id: string; title: string; action: string; description: string | null; createdAt: string }>;
  aiSuggestions?: Array<{ id: string; title: string; content: string; status: string; createdAt: string }>;
}
interface AuditSummary {
  total: number;
  open: number;
  completed: number;
  overdueAudits: number;
  openFindings: number;
  ncFindings: number;
  pendingNc: number;
  criticalFindings: number;
  overdueFindings: number;
  upcoming: Array<Pick<Audit, 'id' | 'number' | 'code' | 'title' | 'type' | 'modality' | 'status' | 'plannedDate' | 'orgNode' | 'leadAuditor'>>;
}
interface Dashboard {
  summary: AuditSummary;
  coverageByArea: Array<{ name: string; total: number; open: number; critical: number }>;
  workload: Array<{ auditor: string; total: number; open: number; hours: number }>;
  calendar: Array<{ id: string; code: string; title: string; status: AuditStatus; plannedDate: string; orgNode: Audit['orgNode'] }>;
  riskQueue: OptionItem[];
  riskHeatmap: Array<{ level: RiskLevel; total: number; items: OptionItem[] }>;
  criticalAudits: Audit[];
  activity: Array<{ id: string; title: string; action: string; createdAt: string }>;
}
interface AuditOptions {
  orgNodes: OptionItem[];
  users: OptionItem[];
  typeConfigs: OptionItem[];
  programs: OptionItem[];
  universeItems: OptionItem[];
  auditorProfiles: OptionItem[];
  checklistTemplates: OptionItem[];
  standards: OptionItem[];
  classifications: OptionItem[];
  riskCriteria: OptionItem[];
  types: string[];
  modalities: string[];
  statuses: string[];
  findingTypes: string[];
  findingStatuses: string[];
  severities: string[];
  riskLevels: RiskLevel[];
  universeKinds: string[];
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  WAITING_APPROVAL: 'Aguardando aprovacao',
  PLANNED: 'Planejada',
  SCHEDULED: 'Agendada',
  PREPARATION: 'Preparacao',
  READY_EXECUTION: 'Pronta',
  IN_PROGRESS: 'Execucao',
  WAITING_COMPLEMENT: 'Complementacao',
  LEAD_REVIEW: 'Revisao lider',
  WAITING_AUDITED_RESPONSE: 'Manifestacao',
  REPORT_ISSUED: 'Relatorio emitido',
  FOLLOW_UP: 'Follow-up',
  COMPLETED: 'Concluida',
  CLOSED: 'Encerrada',
  SUSPENDED: 'Suspensa',
  CANCELLED: 'Cancelada',
  RESCHEDULED: 'Reagendada',
};
const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'border-border text-muted-foreground',
  WAITING_APPROVAL: 'border-status-purple/30 text-status-purple',
  PLANNED: 'border-status-blue/30 text-status-blue',
  SCHEDULED: 'border-status-blue/30 text-status-blue',
  PREPARATION: 'border-status-yellow/40 text-status-yellow',
  READY_EXECUTION: 'border-status-green/30 text-status-green',
  IN_PROGRESS: 'border-status-yellow/40 text-status-yellow',
  WAITING_COMPLEMENT: 'border-status-yellow/40 text-status-yellow',
  LEAD_REVIEW: 'border-status-purple/30 text-status-purple',
  WAITING_AUDITED_RESPONSE: 'border-status-purple/30 text-status-purple',
  REPORT_ISSUED: 'border-status-blue/30 text-status-blue',
  FOLLOW_UP: 'border-status-yellow/40 text-status-yellow',
  COMPLETED: 'border-status-green/30 text-status-green',
  CLOSED: 'border-status-green/30 text-status-green',
  SUSPENDED: 'border-border text-muted-foreground',
  CANCELLED: 'border-status-red/40 text-status-red',
  RESCHEDULED: 'border-status-yellow/40 text-status-yellow',
};
const RISK_CLASS: Record<RiskLevel, string> = {
  LOW: 'border-status-green/30 text-status-green',
  MODERATE: 'border-status-yellow/40 text-status-yellow',
  HIGH: 'border-status-red/30 text-status-red',
  CRITICAL: 'border-status-red/50 bg-status-red/10 text-status-red',
};

const EMPTY_AUDIT = {
  title: '', type: 'INTERNAL', modality: 'PRESENTIAL', status: 'PLANNED', programId: '', universeItemId: '',
  orgNodeId: '', leadAuditorUserId: '', plannedDate: '', estimatedHours: '', scope: '', objective: '', criteria: '',
};
const EMPTY_PROGRAM = { name: '', status: 'DRAFT', startsAt: '', endsAt: '', ownerUserId: '', approverUserId: '', estimatedHours: '', budget: '', description: '' };
const EMPTY_UNIVERSE = { name: '', kind: 'AREA', orgNodeId: '', ownerUserId: '', impact: '3', probability: '3', recurrence: '2', regulatory_requirement: '2', strategic_relevance: '3', description: '' };
const EMPTY_AUDITOR = { userId: '', name: '', kind: 'INTERNAL', status: 'ACTIVE', competenceLevel: '3', standards: '', notes: '' };
const EMPTY_CHECKLIST = { name: '', auditType: 'INTERNAL', status: 'DRAFT', standardId: '', questions: 'O requisito foi atendido?\nHa evidencia objetiva registrada?' };
const EMPTY_FINDING = { classificationId: '', type: 'OBSERVATION', severity: '', description: '', conditionFound: '', expectedCriteria: '', evidence: '', recommendation: '', dueDate: '' };
const EMPTY_EVIDENCE = { description: '', type: 'TEXT', fileName: '', content: '' };
const EMPTY_REPORT = { title: '', summary: '', executiveSummary: '', issue: false };

export default function AuditsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['audits:create', 'audits:plan']);
  const canUpdate = hasPermission(['audits:update', 'audits:execute']);
  const canManage = hasPermission(['audits:manage']);
  const canDelete = hasPermission(['audits:delete']);

  const [filters, setFilters] = useState({ search: '', status: '', type: '', programId: '' });
  const [auditOpen, setAuditOpen] = useState(false);
  const [programOpen, setProgramOpen] = useState(false);
  const [universeOpen, setUniverseOpen] = useState(false);
  const [auditorOpen, setAuditorOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [auditForm, setAuditForm] = useState(EMPTY_AUDIT);
  const [programForm, setProgramForm] = useState(EMPTY_PROGRAM);
  const [universeForm, setUniverseForm] = useState(EMPTY_UNIVERSE);
  const [auditorForm, setAuditorForm] = useState(EMPTY_AUDITOR);
  const [checklistForm, setChecklistForm] = useState(EMPTY_CHECKLIST);
  const [findingForm, setFindingForm] = useState(EMPTY_FINDING);
  const [evidenceForm, setEvidenceForm] = useState(EMPTY_EVIDENCE);
  const [reportForm, setReportForm] = useState(EMPTY_REPORT);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const listQuery = useQuery<Audit[]>({ queryKey: ['audits', filters], queryFn: () => api<Audit[]>(`/audits${toQueryString(filters)}`) });
  const dashboardQuery = useQuery<Dashboard>({ queryKey: ['audits', 'dashboard'], queryFn: () => api<Dashboard>('/audits/dashboard') });
  const optionsQuery = useQuery<AuditOptions>({ queryKey: ['audits', 'options'], queryFn: () => api<AuditOptions>('/audits/options'), staleTime: 60_000 });
  const programsQuery = useQuery<OptionItem[]>({ queryKey: ['audits', 'programs'], queryFn: () => api<OptionItem[]>('/audits/programs') });
  const universeQuery = useQuery<OptionItem[]>({ queryKey: ['audits', 'universe'], queryFn: () => api<OptionItem[]>('/audits/universe') });
  const auditorsQuery = useQuery<OptionItem[]>({ queryKey: ['audits', 'auditors'], queryFn: () => api<OptionItem[]>('/audits/auditors') });
  const checklistsQuery = useQuery<any[]>({ queryKey: ['audits', 'checklist-templates'], queryFn: () => api<any[]>('/audits/checklist-templates') });
  const standardsQuery = useQuery<any[]>({ queryKey: ['audits', 'standards'], queryFn: () => api<any[]>('/audits/standards') });
  const detailQuery = useQuery<AuditDetail>({
    queryKey: ['audits', 'detail', selectedId],
    queryFn: () => api<AuditDetail>(`/audits/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  const audits = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const options = optionsQuery.data;
  const dashboard = dashboardQuery.data;
  const selectedDetail = detailQuery.data;
  const selected = selectedDetail ?? audits.find((audit) => audit.id === selectedId) ?? null;
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['audits'] });
  };

  const saveAudit = useMutation({
    mutationFn: () => api<Audit>('/audits', { method: 'POST', json: auditPayload(auditForm) }),
    onSuccess: () => { toast.success('Auditoria criada'); setAuditOpen(false); setAuditForm(EMPTY_AUDIT); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel salvar a auditoria'),
  });
  const deleteAudit = useMutation({
    mutationFn: (id: string) => api<Audit>(`/audits/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Auditoria excluida logicamente'); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel excluir'),
  });
  const transitionAudit = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) => api<Audit>(`/audits/${id}/transition`, { method: 'POST', json: { status, reason } }),
    onSuccess: () => { toast.success('Fluxo atualizado'); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel alterar status'),
  });
  const saveProgram = useMutation({
    mutationFn: () => api('/audits/programs', { method: 'POST', json: programPayload(programForm) }),
    onSuccess: () => { toast.success('Programa criado'); setProgramOpen(false); setProgramForm(EMPTY_PROGRAM); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel criar o programa'),
  });
  const saveUniverse = useMutation({
    mutationFn: () => api('/audits/universe', { method: 'POST', json: universePayload(universeForm) }),
    onSuccess: () => { toast.success('Item auditavel criado'); setUniverseOpen(false); setUniverseForm(EMPTY_UNIVERSE); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel criar o item auditavel'),
  });
  const saveAuditor = useMutation({
    mutationFn: () => api('/audits/auditors', { method: 'POST', json: auditorPayload(auditorForm) }),
    onSuccess: () => { toast.success('Auditor cadastrado'); setAuditorOpen(false); setAuditorForm(EMPTY_AUDITOR); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel cadastrar auditor'),
  });
  const saveChecklist = useMutation({
    mutationFn: () => api('/audits/checklist-templates', { method: 'POST', json: checklistPayload(checklistForm) }),
    onSuccess: () => { toast.success('Modelo de checklist criado'); setChecklistOpen(false); setChecklistForm(EMPTY_CHECKLIST); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel criar checklist'),
  });
  const addFinding = useMutation({
    mutationFn: () => api<Finding>(`/audits/${selectedId}/findings`, { method: 'POST', json: findingPayload(findingForm) }),
    onSuccess: () => { toast.success('Constatacao registrada'); setFindingForm(EMPTY_FINDING); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel registrar constatacao'),
  });
  const generateNc = useMutation({
    mutationFn: (id: string) => api<Finding>(`/audits/findings/${id}/nonconformity`, { method: 'POST', json: {} }),
    onSuccess: () => { toast.success('NC gerada a partir da constatacao'); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao gerar NC'),
  });
  const addEvidence = useMutation({
    mutationFn: () => api(`/audits/${selectedId}/evidence`, { method: 'POST', json: evidencePayload(evidenceForm) }),
    onSuccess: () => { toast.success('Evidencia registrada'); setEvidenceForm(EMPTY_EVIDENCE); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel registrar evidencia'),
  });
  const startChecklist = useMutation({
    mutationFn: () => api(`/audits/${selectedId}/checklists`, { method: 'POST', json: { templateId: selectedTemplateId || null } }),
    onSuccess: () => { toast.success('Execucao de checklist iniciada'); setSelectedTemplateId(''); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel iniciar checklist'),
  });
  const generateReport = useMutation({
    mutationFn: () => api(`/audits/${selectedId}/report`, { method: 'POST', json: reportPayload(reportForm) }),
    onSuccess: () => { toast.success('Relatorio gerado'); setReportForm(EMPTY_REPORT); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel gerar relatorio'),
  });
  const createAi = useMutation({
    mutationFn: () => api(`/audits/${selectedId}/ai/suggestions`, { method: 'POST', json: {} }),
    onSuccess: () => { toast.success('Sugestoes criadas para validacao humana'); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel criar sugestoes'),
  });

  return (
    <div>
      <PageHeader
        title="Auditorias e Compliance"
        description="Programas, planejamento por risco, execucao, evidencias, constatacoes, NCs, follow-up e relatorios."
        actions={canCreate ? <Button onClick={() => setAuditOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova auditoria</Button> : null}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Em aberto" value={formatNumber(dashboard?.summary.open)} description={`${formatNumber(dashboard?.summary.total)} no total`} icon={<ClipboardCheck className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Concluidas" value={formatNumber(dashboard?.summary.completed)} description="Concluidas ou encerradas" icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
        <MetricCard title="Atrasadas" value={formatNumber(dashboard?.summary.overdueAudits)} description={`${formatNumber(dashboard?.summary.overdueFindings)} constatacoes vencidas`} icon={<AlertTriangle className="h-4 w-4" />} tone={(dashboard?.summary.overdueAudits ?? 0) > 0 ? 'red' : 'green'} />
        <MetricCard title="Constatacoes" value={formatNumber(dashboard?.summary.openFindings)} description={`${formatNumber(dashboard?.summary.criticalFindings)} criticas`} icon={<ClipboardList className="h-4 w-4" />} tone="yellow" />
        <MetricCard title="NCs a gerar" value={formatNumber(dashboard?.summary.pendingNc)} description="Constatacoes sem NC" icon={<FileCheck2 className="h-4 w-4" />} tone={(dashboard?.summary.pendingNc ?? 0) > 0 ? 'red' : 'green'} />
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="dashboard"><BarChart3 className="mr-2 h-4 w-4" />Dashboard</TabsTrigger>
          <TabsTrigger value="audits"><ClipboardCheck className="mr-2 h-4 w-4" />Auditorias</TabsTrigger>
          <TabsTrigger value="programs"><CalendarClock className="mr-2 h-4 w-4" />Programas</TabsTrigger>
          <TabsTrigger value="universe"><Radar className="mr-2 h-4 w-4" />Universo</TabsTrigger>
          <TabsTrigger value="checklists"><ListChecks className="mr-2 h-4 w-4" />Checklists</TabsTrigger>
          <TabsTrigger value="auditors"><UserCheck className="mr-2 h-4 w-4" />Auditores</TabsTrigger>
          <TabsTrigger value="standards"><Library className="mr-2 h-4 w-4" />Normas</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr,0.7fr]">
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Cobertura por area</div>
                    <div className="text-xs text-muted-foreground">Total, abertas e constatacoes criticas.</div>
                  </div>
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboard?.coverageByArea ?? []} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} height={60} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="total" name="Total" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="open" name="Abertas" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="critical" name="Criticas" fill="#dc2626" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Fila por risco</div>
                    <div className="text-xs text-muted-foreground">Prioridades do universo auditavel.</div>
                  </div>
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-3">
                  {(dashboard?.riskHeatmap ?? []).map((row) => (
                    <div key={row.level}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <Badge variant="outline" className={RISK_CLASS[row.level]}>{label(row.level)}</Badge>
                        <span className="text-muted-foreground">{row.total} itens</span>
                      </div>
                      <Progress value={Math.min(100, row.total * 12)} />
                    </div>
                  ))}
                  {(dashboard?.riskQueue ?? []).slice(0, 5).map((item) => (
                    <button key={item.id} className="w-full rounded-md border p-3 text-left text-sm hover:bg-muted/60" onClick={() => setFilters((f) => ({ ...f, search: item.name }))}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{item.name}</span>
                        {item.riskLevel && <Badge variant="outline" className={RISK_CLASS[item.riskLevel]}>{label(item.riskLevel)}</Badge>}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">Score {formatNumber(item.riskScore ?? 0)}</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <PanelList title="Proximas auditorias" icon={<CalendarClock className="h-4 w-4" />}>
              {(dashboard?.summary.upcoming ?? []).length === 0 && <EmptyLine text="Nenhuma auditoria em aberto." />}
              {(dashboard?.summary.upcoming ?? []).map((audit) => (
                <AuditLine key={audit.id} audit={audit as Audit} onClick={() => setSelectedId(audit.id)} />
              ))}
            </PanelList>
            <PanelList title="Carga por auditor" icon={<UserCheck className="h-4 w-4" />}>
              {(dashboard?.workload ?? []).slice(0, 8).map((item) => (
                <div key={item.auditor} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{item.auditor}</span>
                    <Badge variant="secondary">{item.open} abertas</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.total} auditorias - {formatNumber(item.hours)}h estimadas</div>
                </div>
              ))}
            </PanelList>
            <PanelList title="Atividade recente" icon={<Layers className="h-4 w-4" />}>
              {(dashboard?.activity ?? []).length === 0 && <EmptyLine text="Nenhuma atividade recente." />}
              {(dashboard?.activity ?? []).map((event) => (
                <div key={event.id} className="rounded-md border p-3 text-sm">
                  <div className="font-medium">{event.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{label(event.action)} - {formatDate(event.createdAt)}</div>
                </div>
              ))}
            </PanelList>
          </div>
        </TabsContent>

        <TabsContent value="audits" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <Input placeholder="Buscar por titulo, codigo, escopo..." value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
                <NativeSelect value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                  <option value="">Todos os status</option>
                  {(options?.statuses ?? []).map((status) => <option key={status} value={status}>{STATUS_LABEL[status] ?? label(status)}</option>)}
                </NativeSelect>
                <NativeSelect value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
                  <option value="">Todos os tipos</option>
                  {(options?.types ?? []).map((type) => <option key={type} value={type}>{label(type)}</option>)}
                </NativeSelect>
                <NativeSelect value={filters.programId} onChange={(e) => setFilters((f) => ({ ...f, programId: e.target.value }))}>
                  <option value="">Todos os programas</option>
                  {(programsQuery.data ?? options?.programs ?? []).map((program) => <option key={program.id} value={program.id}>{program.code ? `${program.code} - ` : ''}{program.name}</option>)}
                </NativeSelect>
                <div className="flex gap-2">
                  <Button variant="outline" className="w-full" onClick={() => setFilters({ search: '', status: '', type: '', programId: '' })}><X className="mr-2 h-4 w-4" />Limpar</Button>
                  {canCreate && <Button className="shrink-0" onClick={() => setAuditOpen(true)}><Plus className="h-4 w-4" /></Button>}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {audits.length === 0 && <Card className="xl:col-span-2"><CardContent className="p-8 text-center text-sm text-muted-foreground">{listQuery.isLoading ? 'Carregando auditorias...' : 'Nenhuma auditoria encontrada.'}</CardContent></Card>}
            {audits.map((audit) => (
              <Card key={audit.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{audit.code ?? `#${audit.number}`}</Badge>
                        <Badge variant="outline" className={STATUS_CLASS[audit.status]}>{STATUS_LABEL[audit.status] ?? label(audit.status)}</Badge>
                        <Badge variant="secondary">{label(audit.type)}</Badge>
                        <Badge variant="outline">{label(audit.modality)}</Badge>
                      </div>
                      <h2 className="mt-3 truncate text-base font-semibold">{audit.title}</h2>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{audit.scope || audit.objective || 'Sem escopo registrado.'}</p>
                    </div>
                    {canDelete && <Button variant="ghost" size="icon" onClick={() => window.confirm('Excluir esta auditoria?') && deleteAudit.mutate(audit.id)} disabled={deleteAudit.isPending} title="Excluir"><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                    <div>Area: <span className="text-foreground">{audit.orgNode?.name ?? '-'}</span></div>
                    <div>Auditor: <span className="text-foreground">{audit.leadAuditor?.name ?? '-'}</span></div>
                    <div>Data: <span className="text-foreground">{formatDate(audit.plannedDate)}</span></div>
                    <div>NCs: <span className={cn('text-foreground', audit.pendingNc > 0 && 'text-status-red')}>{audit.ncCount}{audit.pendingNc > 0 ? ` (${audit.pendingNc})` : ''}</span></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedId(audit.id)}><ClipboardList className="mr-2 h-4 w-4" />Detalhes</Button>
                    {canUpdate && audit.status !== 'IN_PROGRESS' && <Button size="sm" variant="ghost" onClick={() => transitionAudit.mutate({ id: audit.id, status: 'IN_PROGRESS' })}>Iniciar</Button>}
                    {canUpdate && audit.status === 'IN_PROGRESS' && <Button size="sm" variant="ghost" onClick={() => transitionAudit.mutate({ id: audit.id, status: 'COMPLETED' })}>Concluir</Button>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="programs" className="space-y-4">
          <SectionHeader title="Programa de auditorias" action={canManage ? <Button onClick={() => setProgramOpen(true)}><Plus className="mr-2 h-4 w-4" />Novo programa</Button> : null} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {(programsQuery.data ?? []).map((program: any) => (
              <Card key={program.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">{program.code}</Badge>
                    <Badge variant="secondary">{label(program.status)}</Badge>
                  </div>
                  <h3 className="mt-3 text-base font-semibold">{program.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{program.description || 'Sem descricao.'}</p>
                  <div className="mt-3 text-xs text-muted-foreground">{formatDate(program.startsAt)} - {formatDate(program.endsAt)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="universe" className="space-y-4">
          <SectionHeader title="Universo auditavel e risco" action={canManage ? <Button onClick={() => setUniverseOpen(true)}><Plus className="mr-2 h-4 w-4" />Novo item</Button> : null} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {(universeQuery.data ?? []).map((item: any) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">{item.code}</Badge>
                    <Badge variant="outline" className={RISK_CLASS[item.riskLevel as RiskLevel] ?? ''}>{label(item.riskLevel)}</Badge>
                  </div>
                  <h3 className="mt-3 text-base font-semibold">{item.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description || label(item.kind)}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Score {formatNumber(item.riskScore)}</span>
                    <span>Freq. {item.recommendedFrequencyDays ?? '-'} dias</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="checklists" className="space-y-4">
          <SectionHeader title="Modelos de checklist" action={canManage ? <Button onClick={() => setChecklistOpen(true)}><Plus className="mr-2 h-4 w-4" />Novo checklist</Button> : null} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {(checklistsQuery.data ?? []).map((template) => (
              <Card key={template.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">{template.code}</Badge>
                    <Badge variant="secondary">{label(template.status)}</Badge>
                  </div>
                  <h3 className="mt-3 text-base font-semibold">{template.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{template.sections?.length ?? 0} secoes - {(template.sections ?? []).reduce((acc: number, s: any) => acc + (s.items?.length ?? 0), 0)} perguntas</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="auditors" className="space-y-4">
          <SectionHeader title="Auditores e competencias" action={canManage ? <Button onClick={() => setAuditorOpen(true)}><Plus className="mr-2 h-4 w-4" />Novo auditor</Button> : null} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {(auditorsQuery.data ?? []).map((auditor: any) => (
              <Card key={auditor.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">{label(auditor.kind)}</Badge>
                    <Badge variant="secondary">{label(auditor.status)}</Badge>
                  </div>
                  <h3 className="mt-3 text-base font-semibold">{auditor.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{auditor.email || auditor.companyName || 'Sem contato.'}</p>
                  <div className="mt-3 text-xs text-muted-foreground">{auditor.competencies?.length ?? 0} competencias - {auditor.certifications?.length ?? 0} certificacoes</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="standards" className="space-y-4">
          <SectionHeader title="Normas e requisitos" action={null} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {(standardsQuery.data ?? []).map((standard) => (
              <Card key={standard.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">{standard.code}</Badge>
                    <Badge variant="secondary">{standard.version || 'Sem versao'}</Badge>
                  </div>
                  <h3 className="mt-3 text-base font-semibold">{standard.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{standard.requirements?.length ?? 0} requisitos cadastrados</p>
                </CardContent>
              </Card>
            ))}
            {(standardsQuery.data ?? []).length === 0 && <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhuma norma cadastrada ainda.</CardContent></Card>}
          </div>
        </TabsContent>
      </Tabs>

      <AuditDialog open={auditOpen} onOpenChange={setAuditOpen} form={auditForm} setForm={setAuditForm} options={options} onSave={() => saveAudit.mutate()} saving={saveAudit.isPending} />
      <ProgramDialog open={programOpen} onOpenChange={setProgramOpen} form={programForm} setForm={setProgramForm} options={options} onSave={() => saveProgram.mutate()} saving={saveProgram.isPending} />
      <UniverseDialog open={universeOpen} onOpenChange={setUniverseOpen} form={universeForm} setForm={setUniverseForm} options={options} onSave={() => saveUniverse.mutate()} saving={saveUniverse.isPending} />
      <AuditorDialog open={auditorOpen} onOpenChange={setAuditorOpen} form={auditorForm} setForm={setAuditorForm} options={options} onSave={() => saveAuditor.mutate()} saving={saveAuditor.isPending} />
      <ChecklistDialog open={checklistOpen} onOpenChange={setChecklistOpen} form={checklistForm} setForm={setChecklistForm} options={options} onSave={() => saveChecklist.mutate()} saving={saveChecklist.isPending} />

      <Dialog open={!!selectedId} onOpenChange={(v) => { if (!v) setSelectedId(null); }}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>{selected ? `${selected.code ?? `#${selected.number}`} - ${selected.title}` : 'Auditoria'}</DialogTitle>
          </DialogHeader>
          {selected && (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="flex h-auto flex-wrap">
                <TabsTrigger value="overview">Visao geral</TabsTrigger>
                <TabsTrigger value="checklist">Checklist</TabsTrigger>
                <TabsTrigger value="evidence">Evidencias</TabsTrigger>
                <TabsTrigger value="findings">Constatacoes</TabsTrigger>
                <TabsTrigger value="report">Relatorio</TabsTrigger>
                <TabsTrigger value="history">Historico</TabsTrigger>
                <TabsTrigger value="ai">IA</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <InfoBox label="Status" value={STATUS_LABEL[selected.status] ?? label(selected.status)} />
                <InfoBox label="Area" value={selected.orgNode?.name ?? '-'} />
                <InfoBox label="Auditor lider" value={selected.leadAuditor?.name ?? '-'} />
                <InfoBox label="Programa" value={selectedDetail?.program?.name ?? '-'} />
                <InfoBox label="Item auditavel" value={selectedDetail?.universeItem?.name ?? '-'} />
                <InfoBox label="Data planejada" value={formatDate(selected.plannedDate)} />
                <div className="rounded-md border p-3 md:col-span-3">
                  <div className="text-xs text-muted-foreground">Escopo e criterio</div>
                  <p className="mt-1 text-sm">{selected.scope || selected.objective || 'Sem escopo registrado.'}</p>
                  {selected.criteria && <p className="mt-2 text-sm text-muted-foreground">{selected.criteria}</p>}
                </div>
              </TabsContent>

              <TabsContent value="checklist" className="space-y-3">
                {canUpdate && (
                  <div className="rounded-md border p-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr,auto]">
                      <NativeSelect value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                        <option value="">Sem modelo</option>
                        {(options?.checklistTemplates ?? []).map((template) => <option key={template.id} value={template.id}>{template.code ? `${template.code} - ` : ''}{template.name}</option>)}
                      </NativeSelect>
                      <Button onClick={() => startChecklist.mutate()} disabled={startChecklist.isPending}><ListChecks className="mr-2 h-4 w-4" />Iniciar checklist</Button>
                    </div>
                  </div>
                )}
                {(detailQuery.data?.checklistExecutions ?? []).map((execution) => (
                  <div key={execution.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{execution.code}</div>
                      <Badge variant="secondary">{label(execution.status)}</Badge>
                    </div>
                    <Progress className="mt-3" value={execution.progress ?? 0} />
                    <div className="mt-1 text-xs text-muted-foreground">{formatNumber(execution.progress)}% preenchido - {execution.responses?.length ?? 0} respostas</div>
                  </div>
                ))}
                {(detailQuery.data?.checklistExecutions ?? []).length === 0 && <EmptyLine text="Nenhuma execucao de checklist iniciada." />}
              </TabsContent>

              <TabsContent value="evidence" className="space-y-3">
                {canUpdate && (
                  <div className="rounded-md border p-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Input placeholder="Descricao" value={evidenceForm.description} onChange={(e) => setEvidenceForm((f) => ({ ...f, description: e.target.value }))} />
                      <Input placeholder="Nome do arquivo" value={evidenceForm.fileName} onChange={(e) => setEvidenceForm((f) => ({ ...f, fileName: e.target.value }))} />
                      <Textarea className="md:col-span-2" rows={3} placeholder="Conteudo textual da evidencia" value={evidenceForm.content} onChange={(e) => setEvidenceForm((f) => ({ ...f, content: e.target.value }))} />
                    </div>
                    <div className="mt-3 flex justify-end"><Button onClick={() => addEvidence.mutate()} disabled={addEvidence.isPending || !evidenceForm.description.trim()}><FileText className="mr-2 h-4 w-4" />Adicionar evidencia</Button></div>
                  </div>
                )}
                {(detailQuery.data?.evidence ?? []).map((item) => (
                  <div key={item.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{item.code}</span>
                      <Badge variant="outline">{label(item.status)}</Badge>
                    </div>
                    <div className="mt-1 text-muted-foreground">{item.description || item.fileName || '-'}</div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="findings" className="space-y-3">
                <div className="max-h-[42vh] space-y-3 overflow-y-auto pr-1">
                  {(selected.findings ?? []).length === 0 && <EmptyLine text="Nenhuma constatacao registrada." />}
                  {(selected.findings ?? []).map((finding) => (
                    <div key={finding.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{finding.code ?? label(finding.type)}</Badge>
                          {finding.severity && <Badge variant="secondary">{label(finding.severity)}</Badge>}
                          <Badge variant="outline">{label(finding.status)}</Badge>
                        </div>
                        {!finding.nonConformity && isNonConformityFinding(finding.type) && canUpdate && (
                          <Button size="sm" variant="outline" onClick={() => generateNc.mutate(finding.id)} disabled={generateNc.isPending}><FileCheck2 className="mr-2 h-4 w-4" />Gerar NC</Button>
                        )}
                      </div>
                      <div className="mt-2 text-sm">{finding.description}</div>
                      {finding.nonConformity && <a href={`/nonconformities?focus=${finding.nonConformity.id}`} className="mt-2 block text-xs text-primary hover:underline">NC #{finding.nonConformity.number} vinculada</a>}
                    </div>
                  ))}
                </div>
                {canUpdate && (
                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="mb-2 text-sm font-semibold">Nova constatacao</div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <NativeSelect value={findingForm.classificationId} onChange={(e) => setFindingForm((f) => ({ ...f, classificationId: e.target.value }))}>
                        <option value="">Classificacao livre</option>
                        {(options?.classifications ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </NativeSelect>
                      <NativeSelect value={findingForm.type} onChange={(e) => setFindingForm((f) => ({ ...f, type: e.target.value }))}>{(options?.findingTypes ?? []).map((type) => <option key={type} value={type}>{label(type)}</option>)}</NativeSelect>
                      <NativeSelect value={findingForm.severity} onChange={(e) => setFindingForm((f) => ({ ...f, severity: e.target.value }))}><option value="">Sem severidade</option>{(options?.severities ?? []).map((s) => <option key={s} value={s}>{label(s)}</option>)}</NativeSelect>
                      <Textarea className="md:col-span-3" rows={2} placeholder="Descricao objetiva" value={findingForm.description} onChange={(e) => setFindingForm((f) => ({ ...f, description: e.target.value }))} />
                      <Textarea className="md:col-span-3" rows={2} placeholder="Evidencia objetiva" value={findingForm.evidence} onChange={(e) => setFindingForm((f) => ({ ...f, evidence: e.target.value }))} />
                    </div>
                    <div className="mt-3 flex justify-end"><Button onClick={() => addFinding.mutate()} disabled={addFinding.isPending || !findingForm.description.trim()}>Adicionar constatacao</Button></div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="report" className="space-y-3">
                {canUpdate && (
                  <div className="rounded-md border p-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Input placeholder="Titulo do relatorio" value={reportForm.title} onChange={(e) => setReportForm((f) => ({ ...f, title: e.target.value }))} />
                      <NativeSelect value={reportForm.issue ? 'yes' : 'no'} onChange={(e) => setReportForm((f) => ({ ...f, issue: e.target.value === 'yes' }))}><option value="no">Minuta</option><option value="yes">Emitir agora</option></NativeSelect>
                      <Textarea className="md:col-span-2" rows={3} placeholder="Resumo executivo" value={reportForm.executiveSummary} onChange={(e) => setReportForm((f) => ({ ...f, executiveSummary: e.target.value }))} />
                    </div>
                    <div className="mt-3 flex justify-end"><Button onClick={() => generateReport.mutate()} disabled={generateReport.isPending}><FileText className="mr-2 h-4 w-4" />Gerar relatorio</Button></div>
                  </div>
                )}
                {(detailQuery.data?.reports ?? []).map((report) => (
                  <div key={report.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2"><span className="font-medium">{report.code} - {report.title}</span><Badge variant="secondary">{label(report.status)}</Badge></div>
                    <p className="mt-1 text-muted-foreground">{report.executiveSummary || 'Sem resumo executivo.'}</p>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="history" className="space-y-2">
                {(detailQuery.data?.timeline ?? []).length === 0 && <EmptyLine text="Sem historico registrado." />}
                {(detailQuery.data?.timeline ?? []).map((event) => (
                  <div key={event.id} className="rounded-md border p-3 text-sm">
                    <div className="font-medium">{event.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{label(event.action)} - {formatDate(event.createdAt)}</div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="ai" className="space-y-3">
                {canUpdate && <Button onClick={() => createAi.mutate()} disabled={createAi.isPending}><Sparkles className="mr-2 h-4 w-4" />Criar sugestoes</Button>}
                {(detailQuery.data?.aiSuggestions ?? []).map((item) => (
                  <div key={item.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2"><span className="font-medium">{item.title}</span><Badge variant="outline">{label(item.status)}</Badge></div>
                    <p className="mt-2 text-muted-foreground">{item.content}</p>
                  </div>
                ))}
                {(detailQuery.data?.aiSuggestions ?? []).length === 0 && <EmptyLine text="Nenhuma sugestao registrada." />}
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setSelectedId(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AuditDialog({ open, onOpenChange, form, setForm, options, onSave, saving }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Nova auditoria</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Titulo" className="md:col-span-2"><Input value={form.title} onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))} /></Field>
          <Field label="Tipo"><NativeSelect value={form.type} onChange={(e) => setForm((f: any) => ({ ...f, type: e.target.value }))}>{(options?.types ?? ['INTERNAL']).map((v: string) => <option key={v} value={v}>{label(v)}</option>)}</NativeSelect></Field>
          <Field label="Modalidade"><NativeSelect value={form.modality} onChange={(e) => setForm((f: any) => ({ ...f, modality: e.target.value }))}>{(options?.modalities ?? ['PRESENTIAL']).map((v: string) => <option key={v} value={v}>{label(v)}</option>)}</NativeSelect></Field>
          <Field label="Programa"><NativeSelect value={form.programId} onChange={(e) => setForm((f: any) => ({ ...f, programId: e.target.value }))}><option value="">Sem programa</option>{(options?.programs ?? []).map((i: OptionItem) => <option key={i.id} value={i.id}>{i.code ? `${i.code} - ` : ''}{i.name}</option>)}</NativeSelect></Field>
          <Field label="Item auditavel"><NativeSelect value={form.universeItemId} onChange={(e) => setForm((f: any) => ({ ...f, universeItemId: e.target.value }))}><option value="">Sem item</option>{(options?.universeItems ?? []).map((i: OptionItem) => <option key={i.id} value={i.id}>{i.name}</option>)}</NativeSelect></Field>
          <Field label="Area/processo"><NativeSelect value={form.orgNodeId} onChange={(e) => setForm((f: any) => ({ ...f, orgNodeId: e.target.value }))}><option value="">Sem area direta</option>{(options?.orgNodes ?? []).map((i: OptionItem) => <option key={i.id} value={i.id}>{i.name}</option>)}</NativeSelect></Field>
          <Field label="Auditor lider"><NativeSelect value={form.leadAuditorUserId} onChange={(e) => setForm((f: any) => ({ ...f, leadAuditorUserId: e.target.value }))}><option value="">Sem auditor</option>{(options?.users ?? []).map((i: OptionItem) => <option key={i.id} value={i.id}>{i.name}</option>)}</NativeSelect></Field>
          <Field label="Data planejada"><Input type="date" value={form.plannedDate} onChange={(e) => setForm((f: any) => ({ ...f, plannedDate: e.target.value }))} /></Field>
          <Field label="Horas estimadas"><Input type="number" min="0" step="0.5" value={form.estimatedHours} onChange={(e) => setForm((f: any) => ({ ...f, estimatedHours: e.target.value }))} /></Field>
          <Field label="Objetivo" className="md:col-span-2"><Textarea rows={2} value={form.objective} onChange={(e) => setForm((f: any) => ({ ...f, objective: e.target.value }))} /></Field>
          <Field label="Escopo" className="md:col-span-2"><Textarea rows={2} value={form.scope} onChange={(e) => setForm((f: any) => ({ ...f, scope: e.target.value }))} /></Field>
          <Field label="Criterios" className="md:col-span-2"><Textarea rows={2} value={form.criteria} onChange={(e) => setForm((f: any) => ({ ...f, criteria: e.target.value }))} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={onSave} disabled={saving || !form.title.trim()}>{saving ? 'Salvando...' : 'Salvar'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProgramDialog({ open, onOpenChange, form, setForm, options, onSave, saving }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Novo programa</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nome" className="md:col-span-2"><Input value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Responsavel"><NativeSelect value={form.ownerUserId} onChange={(e) => setForm((f: any) => ({ ...f, ownerUserId: e.target.value }))}><option value="">Usuario atual</option>{(options?.users ?? []).map((i: OptionItem) => <option key={i.id} value={i.id}>{i.name}</option>)}</NativeSelect></Field>
          <Field label="Aprovador"><NativeSelect value={form.approverUserId} onChange={(e) => setForm((f: any) => ({ ...f, approverUserId: e.target.value }))}><option value="">Sem aprovador</option>{(options?.users ?? []).map((i: OptionItem) => <option key={i.id} value={i.id}>{i.name}</option>)}</NativeSelect></Field>
          <Field label="Inicio"><Input type="date" value={form.startsAt} onChange={(e) => setForm((f: any) => ({ ...f, startsAt: e.target.value }))} /></Field>
          <Field label="Fim"><Input type="date" value={form.endsAt} onChange={(e) => setForm((f: any) => ({ ...f, endsAt: e.target.value }))} /></Field>
          <Field label="Horas estimadas"><Input type="number" value={form.estimatedHours} onChange={(e) => setForm((f: any) => ({ ...f, estimatedHours: e.target.value }))} /></Field>
          <Field label="Orcamento"><Input type="number" value={form.budget} onChange={(e) => setForm((f: any) => ({ ...f, budget: e.target.value }))} /></Field>
          <Field label="Descricao" className="md:col-span-2"><Textarea rows={3} value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={onSave} disabled={saving || !form.name.trim()}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UniverseDialog({ open, onOpenChange, form, setForm, options, onSave, saving }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Novo item auditavel</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nome" className="md:col-span-2"><Input value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Tipo"><NativeSelect value={form.kind} onChange={(e) => setForm((f: any) => ({ ...f, kind: e.target.value }))}>{(options?.universeKinds ?? ['AREA']).map((v: string) => <option key={v} value={v}>{label(v)}</option>)}</NativeSelect></Field>
          <Field label="Area"><NativeSelect value={form.orgNodeId} onChange={(e) => setForm((f: any) => ({ ...f, orgNodeId: e.target.value }))}><option value="">Sem area</option>{(options?.orgNodes ?? []).map((i: OptionItem) => <option key={i.id} value={i.id}>{i.name}</option>)}</NativeSelect></Field>
          {['impact', 'probability', 'recurrence', 'regulatory_requirement', 'strategic_relevance'].map((key) => (
            <Field key={key} label={label(key)}><Input type="number" min="1" max="5" value={form[key]} onChange={(e) => setForm((f: any) => ({ ...f, [key]: e.target.value }))} /></Field>
          ))}
          <Field label="Descricao" className="md:col-span-2"><Textarea rows={3} value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={onSave} disabled={saving || !form.name.trim()}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuditorDialog({ open, onOpenChange, form, setForm, options, onSave, saving }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Novo auditor</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Usuario vinculado"><NativeSelect value={form.userId} onChange={(e) => setForm((f: any) => ({ ...f, userId: e.target.value }))}><option value="">Auditor externo/manual</option>{(options?.users ?? []).map((i: OptionItem) => <option key={i.id} value={i.id}>{i.name}</option>)}</NativeSelect></Field>
          <Field label="Nome"><Input value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Tipo"><NativeSelect value={form.kind} onChange={(e) => setForm((f: any) => ({ ...f, kind: e.target.value }))}><option value="INTERNAL">Interno</option><option value="EXTERNAL">Externo</option></NativeSelect></Field>
          <Field label="Competencia"><Input type="number" min="1" max="5" value={form.competenceLevel} onChange={(e) => setForm((f: any) => ({ ...f, competenceLevel: e.target.value }))} /></Field>
          <Field label="Normas dominadas" className="md:col-span-2"><Input placeholder="ISO 9001, ISO 14001..." value={form.standards} onChange={(e) => setForm((f: any) => ({ ...f, standards: e.target.value }))} /></Field>
          <Field label="Observacoes" className="md:col-span-2"><Textarea rows={3} value={form.notes} onChange={(e) => setForm((f: any) => ({ ...f, notes: e.target.value }))} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={onSave} disabled={saving || (!form.name.trim() && !form.userId)}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChecklistDialog({ open, onOpenChange, form, setForm, options, onSave, saving }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Novo modelo de checklist</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nome" className="md:col-span-2"><Input value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Tipo"><NativeSelect value={form.auditType} onChange={(e) => setForm((f: any) => ({ ...f, auditType: e.target.value }))}>{(options?.types ?? ['INTERNAL']).map((v: string) => <option key={v} value={v}>{label(v)}</option>)}</NativeSelect></Field>
          <Field label="Norma"><NativeSelect value={form.standardId} onChange={(e) => setForm((f: any) => ({ ...f, standardId: e.target.value }))}><option value="">Sem norma</option>{(options?.standards ?? []).map((i: OptionItem) => <option key={i.id} value={i.id}>{i.name}</option>)}</NativeSelect></Field>
          <Field label="Perguntas" className="md:col-span-2"><Textarea rows={7} value={form.questions} onChange={(e) => setForm((f: any) => ({ ...f, questions: e.target.value }))} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={onSave} disabled={saving || !form.name.trim()}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label: text, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={className}><Label>{text}</Label>{children}</div>;
}
function SectionHeader({ title, action }: { title: string; action: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">{title}</h2>{action}</div>;
}
function PanelList({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <Card><CardContent className="p-4"><div className="mb-3 flex items-center gap-2 text-sm font-semibold">{icon}{title}</div><div className="space-y-2">{children}</div></CardContent></Card>;
}
function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{text}</div>;
}
function InfoBox({ label: text, value }: { label: string; value: string }) {
  return <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">{text}</div><div className="mt-1 truncate text-sm font-medium">{value}</div></div>;
}
function AuditLine({ audit, onClick }: { audit: Audit; onClick: () => void }) {
  return (
    <button className="w-full rounded-md border p-3 text-left hover:bg-muted/60" onClick={onClick}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{audit.code ?? `#${audit.number}`} {audit.title}</span>
        <Badge variant="outline" className={STATUS_CLASS[audit.status]}>{STATUS_LABEL[audit.status] ?? label(audit.status)}</Badge>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{audit.orgNode?.name ?? 'Sem area'} - {formatDate(audit.plannedDate)}</div>
    </button>
  );
}

function auditPayload(form: typeof EMPTY_AUDIT) {
  return { ...form, programId: form.programId || null, universeItemId: form.universeItemId || null, orgNodeId: form.orgNodeId || null, leadAuditorUserId: form.leadAuditorUserId || null, plannedDate: form.plannedDate || null, estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : null };
}
function programPayload(form: typeof EMPTY_PROGRAM) {
  return { ...form, ownerUserId: form.ownerUserId || null, approverUserId: form.approverUserId || null, startsAt: form.startsAt || null, endsAt: form.endsAt || null, estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : null, budget: form.budget ? Number(form.budget) : null };
}
function universePayload(form: typeof EMPTY_UNIVERSE) {
  return {
    name: form.name,
    kind: form.kind,
    orgNodeId: form.orgNodeId || null,
    ownerUserId: form.ownerUserId || null,
    description: form.description || null,
    riskFactors: {
      impact: Number(form.impact),
      probability: Number(form.probability),
      recurrence: Number(form.recurrence),
      regulatory_requirement: Number(form.regulatory_requirement),
      strategic_relevance: Number(form.strategic_relevance),
    },
  };
}
function auditorPayload(form: typeof EMPTY_AUDITOR) {
  return { ...form, userId: form.userId || null, competenceLevel: Number(form.competenceLevel), standards: splitCsv(form.standards), name: form.name || undefined };
}
function checklistPayload(form: typeof EMPTY_CHECKLIST) {
  const questions = form.questions.split('\n').map((line) => line.trim()).filter(Boolean);
  return {
    name: form.name,
    auditType: form.auditType,
    standardId: form.standardId || null,
    status: form.status,
    sections: [{ title: 'Roteiro principal', items: questions.map((question, index) => ({ question, code: `Q${String(index + 1).padStart(2, '0')}`, evidenceRequired: false, mandatory: true })) }],
  };
}
function findingPayload(form: typeof EMPTY_FINDING) {
  return { ...form, classificationId: form.classificationId || null, severity: form.severity || null, dueDate: form.dueDate || null };
}
function evidencePayload(form: typeof EMPTY_EVIDENCE) {
  return { ...form, fileName: form.fileName || undefined, content: form.content || undefined };
}
function reportPayload(form: typeof EMPTY_REPORT) {
  return { ...form, title: form.title || undefined, summary: form.summary || undefined, executiveSummary: form.executiveSummary || undefined };
}
function toQueryString(filters: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  const query = params.toString();
  return query ? `?${query}` : '';
}
function label(value: string | null | undefined) {
  if (!value) return '-';
  return String(value).toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}
function splitCsv(value: string) {
  return value.split(',').map((part) => part.trim()).filter(Boolean);
}
function isNonConformityFinding(type: string) {
  return ['NONCONFORMITY', 'MINOR_NONCONFORMITY', 'MAJOR_NONCONFORMITY', 'CRITICAL_NONCONFORMITY'].includes(type);
}
