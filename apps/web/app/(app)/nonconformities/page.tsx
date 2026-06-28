'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Activity,
  AlertTriangle, 
  CalendarClock, 
  CheckCircle2, 
  ClipboardCheck, 
  Clock, 
  Edit, 
  FileText, 
  FileUp, 
  FileWarning, 
  Filter, 
  HelpCircle, 
  Layers, 
  Network, 
  Plus, 
  Scale, 
  Sparkles, 
  Trash2, 
  TrendingUp, 
  Users, 
  X 
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { downloadCsv } from '@/lib/compensation/format';
import { cn, formatDate, formatNumber } from '@/lib/utils';

type NcStatus = 'OPEN' | 'TRIAGE' | 'ANALYSIS' | 'ACTION' | 'VERIFICATION' | 'CLOSED' | 'CANCELLED';
type NcSource = 'INDICATOR' | 'AUDIT' | 'PROCESS' | 'CUSTOMER' | 'SUPPLIER' | 'PROJECT' | 'CHECKLIST' | 'INSPECTION' | 'DOCUMENT' | 'MANUAL' | 'OTHER';
type NcSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL';

interface NonConformity {
  id: string;
  number: number;
  title: string;
  description: string | null;
  source: NcSource;
  severity: NcSeverity;
  status: NcStatus;
  immediateAction: string | null;
  rootCause: string | null;
  correctivePlan: string | null;
  effectivenessCheck: string | null;
  effectivenessOk: boolean | null;
  isOverdue: boolean;
  dueDate: string | null;
  identifiedAt: string;
  orgNodeId: string | null;
  indicatorId: string | null;
  deviationId: string | null;
  correctiveActionId: string | null;
  responsibleUserId: string | null;
  orgNode: { id: string; name: string; type: string } | null;
  indicator: { id: string; name: string; code: string | null; ownerNodeId: string } | null;
  deviation: { id: string; number: number; title: string; status: string } | null;
  correctiveAction: { id: string; title: string; status: string; dueDate: string | null; effectivenessStatus: string | null } | null;
  responsibleUser: { id: string; name: string; email: string } | null;
}

interface NcSummary {
  total: number;
  open: number;
  critical: number;
  overdue: number;
  effective: number;
  topOpen: Array<Pick<NonConformity, 'id' | 'number' | 'title' | 'status' | 'source' | 'severity' | 'dueDate' | 'isOverdue' | 'responsibleUser' | 'orgNode' | 'indicator'>>;
}

interface NcOptions {
  orgNodes: Array<{ id: string; name: string; type: string }>;
  indicators: Array<{ id: string; name: string; code: string | null; ownerNodeId: string }>;
  deviations: Array<{ id: string; number: number; title: string; status: string }>;
  actions: Array<{ id: string; title: string; status: string; dueDate: string | null; ownerNodeId: string | null; indicatorId: string | null }>;
  users: Array<{ id: string; name: string; email: string; defaultNodeId: string | null }>;
  statuses: NcStatus[];
  sources: NcSource[];
  severities: NcSeverity[];
}

interface AuditDashboard {
  summary: { total: number; completed: number; open: number };
  calendar: Array<{
    id: string;
    code: string | null;
    title: string;
    status: string;
    plannedDate: string;
    orgNode: { id: string; name: string } | null;
  }>;
}

interface NcForm {
  title: string;
  description: string;
  source: NcSource;
  severity: NcSeverity;
  status: NcStatus;
  orgNodeId: string;
  indicatorId: string;
  deviationId: string;
  correctiveActionId: string;
  responsibleUserId: string;
  dueDate: string;
  immediateAction: string;
  rootCause: string;
  correctivePlan: string;
  effectivenessCheck: string;
  effectivenessOk: string; // '', 'true', 'false'
}

const STATUS_LABEL: Record<NcStatus, string> = {
  OPEN: 'Registrada',
  TRIAGE: 'Triagem',
  ANALYSIS: 'Análise de causa',
  ACTION: 'Ação corretiva',
  VERIFICATION: 'Verificação',
  CLOSED: 'Encerrada',
  CANCELLED: 'Cancelada',
};

const SOURCE_LABEL: Record<NcSource, string> = {
  INDICATOR: 'Indicador',
  AUDIT: 'Auditoria',
  PROCESS: 'Processo',
  CUSTOMER: 'Cliente',
  SUPPLIER: 'Fornecedor',
  PROJECT: 'Projeto',
  CHECKLIST: 'Lista de verificação',
  INSPECTION: 'Inspeção',
  DOCUMENT: 'Documento',
  MANUAL: 'Manual',
  OTHER: 'Outro',
};

const SEVERITY_LABEL: Record<NcSeverity, string> = {
  MINOR: 'Menor',
  MAJOR: 'Maior',
  CRITICAL: 'Crítica',
};

const SEVERITY_CLASS: Record<NcSeverity, string> = {
  MINOR: 'border-status-blue/30 text-status-blue',
  MAJOR: 'border-status-yellow/40 text-status-yellow',
  CRITICAL: 'border-status-red/40 text-status-red',
};

const STATUS_CLASS: Record<NcStatus, string> = {
  OPEN: 'border-border text-muted-foreground',
  TRIAGE: 'border-status-blue/30 text-status-blue',
  ANALYSIS: 'border-status-purple/30 text-status-purple',
  ACTION: 'border-status-yellow/40 text-status-yellow',
  VERIFICATION: 'border-status-blue/30 text-status-blue',
  CLOSED: 'border-status-green/30 text-status-green',
  CANCELLED: 'border-border text-muted-foreground',
};

const EMPTY_FORM: NcForm = {
  title: '',
  description: '',
  source: 'INDICATOR',
  severity: 'MAJOR',
  status: 'OPEN',
  orgNodeId: '',
  indicatorId: '',
  deviationId: '',
  correctiveActionId: '',
  responsibleUserId: '',
  dueDate: '',
  immediateAction: '',
  rootCause: '',
  correctivePlan: '',
  effectivenessCheck: '',
  effectivenessOk: '',
};

export default function NonConformitiesPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['nc:create']);
  const canUpdate = hasPermission(['nc:update']);
  const canDelete = hasPermission(['nc:delete']);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NonConformity | null>(null);
  const [selectedNc, setSelectedNc] = useState<NonConformity | null>(null); // Nc selecionada para Ishikawa / 5 Whys
  const [filters, setFilters] = useState({ search: '', status: '', severity: '' });
  const [form, setForm] = useState<NcForm>(EMPTY_FORM);
  const riskRef = useRef<HTMLDivElement>(null);
  const ishikawaRef = useRef<HTMLDivElement>(null);

  const listQuery = useQuery<NonConformity[]>({
    queryKey: ['nonconformities', filters],
    queryFn: () => api<NonConformity[]>(`/nonconformities${toQueryString(filters)}`),
  });
  const summaryQuery = useQuery<NcSummary>({
    queryKey: ['nonconformities', 'summary'],
    queryFn: () => api<NcSummary>('/nonconformities/summary'),
  });
  const optionsQuery = useQuery<NcOptions>({
    queryKey: ['nonconformities', 'options'],
    queryFn: () => api<NcOptions>('/nonconformities/options'),
    staleTime: 60_000,
  });
  const auditsQuery = useQuery<AuditDashboard>({
    queryKey: ['audits', 'dashboard', 'nonconformities'],
    queryFn: () => api<AuditDashboard>('/audits/dashboard'),
  });

  const items = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const summary = summaryQuery.data;
  const options = optionsQuery.data;

  // Auto-selecionar a primeira NC da lista para detalhamento visual
  useEffect(() => {
    if (items.length > 0 && !selectedNc) {
      setSelectedNc(items[0]);
    }
  }, [items, selectedNc]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        description: form.description || null,
        source: form.source,
        severity: form.severity,
        status: form.status,
        orgNodeId: form.orgNodeId || null,
        indicatorId: form.indicatorId || null,
        deviationId: form.deviationId || null,
        correctiveActionId: form.correctiveActionId || null,
        responsibleUserId: form.responsibleUserId || null,
        dueDate: form.dueDate || null,
        immediateAction: form.immediateAction || null,
        rootCause: form.rootCause || null,
        correctivePlan: form.correctivePlan || null,
        effectivenessCheck: form.effectivenessCheck || null,
        effectivenessOk: form.effectivenessOk === '' ? null : form.effectivenessOk === 'true',
      };
      return editing
        ? api<NonConformity>(`/nonconformities/${editing.id}`, { method: 'PATCH', json: payload })
        : api<NonConformity>('/nonconformities', { method: 'POST', json: payload });
    },
    onSuccess: () => {
      toast.success(editing ? 'Não conformidade atualizada' : 'Não conformidade registrada');
      closeDialog();
      invalidate(qc);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível salvar a NC'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api<NonConformity>(`/nonconformities/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Não conformidade excluída');
      invalidate(qc);
      if (selectedNc?.id === editing?.id) {
        setSelectedNc(null);
      }
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível excluir a NC'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (nc: NonConformity) => {
    setEditing(nc);
    setForm({
      title: nc.title,
      description: nc.description ?? '',
      source: nc.source,
      severity: nc.severity,
      status: nc.status,
      orgNodeId: nc.orgNodeId ?? '',
      indicatorId: nc.indicatorId ?? '',
      deviationId: nc.deviationId ?? '',
      correctiveActionId: nc.correctiveActionId ?? '',
      responsibleUserId: nc.responsibleUserId ?? '',
      dueDate: toInputDate(nc.dueDate),
      immediateAction: nc.immediateAction ?? '',
      rootCause: nc.rootCause ?? '',
      correctivePlan: nc.correctivePlan ?? '',
      effectivenessCheck: nc.effectivenessCheck ?? '',
      effectivenessOk: nc.effectivenessOk === null || nc.effectivenessOk === undefined ? '' : String(nc.effectivenessOk),
    });
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  // Deep-link
  const focusId = searchParams.get('focus');
  const focusedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusId || focusedRef.current === focusId) return;
    const target = items.find((nc) => nc.id === focusId);
    if (target) {
      focusedRef.current = focusId;
      openEdit(target);
    }
  }, [focusId, items]);

  const countTotal = summary?.total ?? 0;
  const countOpen = summary?.open ?? 0;
  const countCritical = summary?.critical ?? 0;
  const countOverdue = summary?.overdue ?? 0;
  const countEffective = summary?.effective ?? 0;
  const countClosed = Math.max(0, countTotal - countOpen);
  const auditSummary = auditsQuery.data?.summary;
  const priorityMatrix = (['CRITICAL', 'MAJOR', 'MINOR'] as NcSeverity[]).map((severity) => ({
    severity,
    overdue: items.filter((item) => item.severity === severity && item.isOverdue).length,
    dueSoon: items.filter((item) => {
      if (item.severity !== severity || item.isOverdue || !item.dueDate) return false;
      const days = (new Date(item.dueDate).getTime() - Date.now()) / 86_400_000;
      return days >= 0 && days <= 7;
    }).length,
    onTime: items.filter((item) => {
      if (item.severity !== severity || item.isOverdue) return false;
      if (!item.dueDate) return true;
      return (new Date(item.dueDate).getTime() - Date.now()) / 86_400_000 > 7;
    }).length,
  }));

  function editSelected(section: 'cause' | 'plan') {
    if (!selectedNc) {
      toast.info('Selecione uma RNC antes de iniciar a análise');
      return;
    }
    openEdit(selectedNc);
    toast.info(section === 'cause' ? 'Preencha a causa raiz da RNC selecionada' : 'Preencha o plano corretivo 5W2H da RNC selecionada');
  }

  function exportReport() {
    if (items.length === 0) return;
    downloadCsv(`rnc-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Número', 'Título', 'Origem', 'Severidade', 'Status', 'Responsável', 'Área', 'Prazo', 'Atrasada', 'Causa raiz', 'Plano corretivo', 'Eficácia'],
      ...items.map((item) => [
        item.number,
        item.title,
        SOURCE_LABEL[item.source],
        SEVERITY_LABEL[item.severity],
        STATUS_LABEL[item.status],
        item.responsibleUser?.name ?? '',
        item.orgNode?.name ?? '',
        item.dueDate ?? '',
        item.isOverdue ? 'Sim' : 'Não',
        item.rootCause ?? '',
        item.correctivePlan ?? '',
        item.effectivenessOk == null ? 'Não avaliada' : item.effectivenessOk ? 'Eficaz' : 'Ineficaz',
      ]),
    ]);
  }

  return (
    <div className="space-y-6">
      
      {/* A. Cabeçalho de Comando (Quality Command Center) */}
      <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800/85 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-500 uppercase tracking-wider">
            <span>Qualidade e Compliance</span>
            <span className="text-slate-400 dark:text-slate-650">/</span>
            <span className="text-slate-550 dark:text-slate-400">Não Conformidades</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1 text-slate-900 dark:text-white font-sans">Não Conformidades (RNC)</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Controle integrado de desvios, análises de causa raiz (Ishikawa / 5 Porquês) e planos corretivos 5W2H.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700 text-white font-semibold" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nova RNC
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-9 gap-1.5 bg-card hover:bg-muted" title="Abrir auditorias" onClick={() => router.push('/audits')}>
            <Layers className="h-4.5 w-4.5 text-slate-500" />
            Auditorias
          </Button>
        </div>
      </div>

      {/* B. Cards de Indicadores do SGQ (KPIs) */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard title="NCs em aberto" value={countOpen} change={`${countTotal} total registradas`} color="sky" icon={FileWarning} />
        <KpiCard title="NCs encerradas" value={countClosed} change={`${countTotal} registros no total`} color="emerald" icon={Clock} />
        <KpiCard title="Taxa de Eficácia" value={`${((countEffective / (countClosed || 1)) * 100).toFixed(1)}%`} change={`${countEffective} encerradas como eficazes`} color="emerald" icon={CheckCircle2} />
        <KpiCard title="Desvios Críticos" value={countCritical} change="Severidade extrema" color="rose" icon={AlertTriangle} />
        <KpiCard title="Auditorias concluídas" value={auditSummary?.completed ?? 0} change={`${auditSummary?.total ?? 0} auditorias cadastradas`} color="emerald" icon={ClipboardCheck} />
        <KpiCard title="Planos Atrasados" value={countOverdue} change="Exigindo intervenção imediata" color="rose" icon={CalendarClock} />
      </div>

      {/* C. Faixa de Ações Rápidas */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
        <QuickActionBtn icon={Plus} title="Registrar RNC" onClick={openCreate} />
        <QuickActionBtn icon={Network} title="Espinha de Ishikawa" onClick={() => ishikawaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
        <QuickActionBtn icon={FileText} title="Novo Plano 5W2H" onClick={() => editSelected('plan')} />
        <QuickActionBtn icon={Scale} title="Matriz de prioridade" onClick={() => riskRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
        <QuickActionBtn icon={ClipboardCheck} title="Cronograma de Auditorias" onClick={() => router.push('/audits')} />
        <QuickActionBtn icon={FileUp} title="Relatório de Qualidade" onClick={exportReport} />
      </div>

      {listQuery.isLoading && <LoadingState />}

      {/* D. Grid Principal (3 Colunas) */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Coluna Esquerda: NCs Críticas e Matriz de Risco 5x5 */}
        <div className="space-y-6">
          
          {/* NCs Prioritárias */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[380px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                Não Conformidades Prioritárias
                <span className="text-[10px] bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-bold">{summary?.topOpen?.length || 0}</span>
              </h3>
            </div>
            <CardContent className="p-0 overflow-y-auto flex-1">
              {(summary?.topOpen ?? []).length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground h-full flex flex-col items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                  Nenhuma NC prioritária no momento.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-850/40">
                  {(summary?.topOpen ?? []).map((nc) => (
                    <div 
                      key={nc.id} 
                      onClick={() => {
                        const original = items.find(item => item.id === nc.id);
                        if (original) setSelectedNc(original);
                      }}
                      className={cn(
                        'p-3 hover:bg-slate-50/40 dark:hover:bg-slate-900/40 transition-all cursor-pointer flex flex-col gap-1 text-xs border-l-2',
                        selectedNc?.id === nc.id ? 'border-l-sky-500 bg-sky-50/20 dark:bg-sky-950/10' : 'border-l-transparent'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-850 dark:text-slate-200">#{nc.number} {nc.title}</span>
                        <Badge variant="outline" className={cn('text-[9px] scale-90', SEVERITY_CLASS[nc.severity])}>{SEVERITY_LABEL[nc.severity]}</Badge>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">
                        {SOURCE_LABEL[nc.source]} - {nc.responsibleUser?.name ?? 'Sem responsável'}
                      </div>
                      {nc.indicator && (
                        <div className="text-[9px] text-sky-500 font-semibold truncate mt-1">
                          KPI {nc.indicator.code ? `[${nc.indicator.code}] ` : ''}{nc.indicator.name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Matriz de Riscos 5x5 Heatmap */}
          <Card ref={riskRef} className="scroll-mt-20 border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[300px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <Scale className="h-4 w-4 text-emerald-500" />
                Matriz de prioridade das RNCs
              </h3>
            </div>
            <CardContent className="p-4 flex-1 flex flex-col justify-between">
              
              <div className="grid grid-cols-[110px,repeat(3,1fr)] gap-2 text-center text-[10px]">
                <div />
                <div className="font-semibold text-muted-foreground">No prazo</div>
                <div className="font-semibold text-amber-600">Até 7 dias</div>
                <div className="font-semibold text-rose-600">Atrasada</div>
                {priorityMatrix.map((row) => (
                  <div key={row.severity} className="contents">
                    <div className="flex items-center text-left font-semibold">{SEVERITY_LABEL[row.severity]}</div>
                    <button type="button" className="rounded-lg bg-emerald-500/10 p-4 text-base font-bold text-emerald-700" onClick={() => setFilters((current) => ({ ...current, severity: row.severity }))}>{row.onTime}</button>
                    <button type="button" className="rounded-lg bg-amber-500/10 p-4 text-base font-bold text-amber-700" onClick={() => setFilters((current) => ({ ...current, severity: row.severity }))}>{row.dueSoon}</button>
                    <button type="button" className="rounded-lg bg-rose-500/10 p-4 text-base font-bold text-rose-700" onClick={() => setFilters((current) => ({ ...current, severity: row.severity }))}>{row.overdue}</button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-[9px] text-slate-400 border-t pt-2 mt-2">
                <span>Valores calculados por severidade e prazo dos registros.</span>
                <span className="font-bold text-red-500">Críticas: {countCritical}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Central: Tabela Geral e Ishikawa SVG */}
        <div className="space-y-6">
          
          {/* Tabela de Não Conformidades */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[380px]">
            <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
              <div className="flex items-center gap-2">
                <FileWarning className="h-4 w-4 text-sky-500" />
                <h3 className="font-semibold text-sm text-slate-850 dark:text-white">Não Conformidades Ativas</h3>
              </div>
              
              {/* Filtro simples integrado */}
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  placeholder="Buscar..." 
                  value={filters.search} 
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                  className="h-7 w-36 px-2 rounded-md border text-[11px] bg-card text-card-foreground"
                />
                {(filters.search || filters.status || filters.severity) && (
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setFilters({ search: '', status: '', severity: '' })}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            
            <CardContent className="p-0 overflow-y-auto flex-1">
              {items.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground h-full flex flex-col items-center justify-center">
                  <FileWarning className="h-8 w-8 text-slate-300 mb-2" />
                  Nenhuma NC encontrada para os filtros atuais.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-850/40">
                  {items.map((nc) => (
                    <div 
                      key={nc.id} 
                      onClick={() => setSelectedNc(nc)}
                      className={cn(
                        'p-3 hover:bg-slate-50/40 dark:hover:bg-slate-900/40 transition-all cursor-pointer flex flex-col gap-1 text-xs border-l-2',
                        selectedNc?.id === nc.id ? 'border-l-sky-500 bg-sky-50/15 dark:bg-sky-950/10' : 'border-l-transparent'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800 dark:text-slate-200">#{nc.number}</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[180px]">{nc.title}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="outline" className={cn('text-[9px] scale-90 px-1 py-0', SEVERITY_CLASS[nc.severity])}>{SEVERITY_LABEL[nc.severity]}</Badge>
                          <Badge variant="outline" className={cn('text-[9px] scale-90 px-1 py-0', STATUS_CLASS[nc.status])}>{STATUS_LABEL[nc.status]}</Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                        <span>Responsável: {nc.responsibleUser?.name ?? 'Sem responsável'}</span>
                        <span className={cn(nc.isOverdue && 'text-rose-500 font-bold')}>Prazo: {formatDate(nc.dueDate)}</span>
                      </div>

                      <div className="flex items-center justify-end gap-1 mt-1 shrink-0 border-t pt-2 border-slate-50/50">
                        {canUpdate && (
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-sky-500" onClick={(e) => { e.stopPropagation(); openEdit(nc); }}>
                            Editar
                          </Button>
                        )}
                        {canDelete && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-[10px] px-2 text-rose-500" 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (window.confirm('Excluir esta não conformidade?')) remove.mutate(nc.id); 
                            }}
                          >
                            Excluir
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Diagrama de Causa Raiz - Ishikawa SVG */}
          <Card ref={ishikawaRef} className="scroll-mt-20 border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[300px]">
            <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <Network className="h-4 w-4 text-violet-500" />
                Diagrama de Ishikawa (Espinha de Peixe)
              </h3>
              {selectedNc && <Badge variant="secondary">RNC #{selectedNc.number}</Badge>}
            </div>
            
            <CardContent className="p-4 flex-1 flex flex-col justify-between">
              <div className="flex-1 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex items-center justify-center p-2 relative min-h-[180px]">
                
                <svg className="w-full h-full max-h-[160px] select-none" viewBox="0 0 320 160" xmlns="http://www.w3.org/2000/svg">
                  {/* Linha Central / Espinha Principal */}
                  <line x1="20" y1="80" x2="270" y2="80" stroke="#0ea5e9" strokeWidth="3" />
                  <polygon points="270,75 285,80 270,85" fill="#0ea5e9" />

                  {/* Cabeça do peixe (Efeito / Problema) */}
                  <g>
                    <rect x="235" y="60" width="80" height="40" rx="4" fill="#0f172a" stroke="#0ea5e9" strokeWidth="1" />
                    <text x="275" y="83" fill="#ffffff" fontSize="7" fontWeight="bold" textAnchor="middle">
                      {selectedNc ? `NC #${selectedNc.number}` : 'Desvio'}
                    </text>
                  </g>

                  {/* Linhas transversais (Os 6Ms) */}
                  {/* Mão de Obra */}
                  <line x1="70" y1="25" x2="110" y2="80" stroke="#7c3aed" strokeWidth="1.5" />
                  <text x="50" y="20" fill="#7c3aed" fontSize="7" fontWeight="bold">Mão de Obra</text>
                  
                  {/* Método */}
                  <line x1="140" y1="25" x2="180" y2="80" stroke="#7c3aed" strokeWidth="1.5" />
                  <text x="125" y="20" fill="#7c3aed" fontSize="7" fontWeight="bold">Método</text>

                  {/* Máquina */}
                  <line x1="210" y1="25" x2="250" y2="80" stroke="#7c3aed" strokeWidth="1.5" />
                  <text x="195" y="20" fill="#7c3aed" fontSize="7" fontWeight="bold">Máquina</text>

                  {/* Meio Ambiente */}
                  <line x1="110" y1="80" x2="70" y2="135" stroke="#10b981" strokeWidth="1.5" />
                  <text x="45" y="145" fill="#10b981" fontSize="7" fontWeight="bold">Meio Ambiente</text>

                  {/* Medida */}
                  <line x1="180" y1="80" x2="140" y2="135" stroke="#10b981" strokeWidth="1.5" />
                  <text x="125" y="145" fill="#10b981" fontSize="7" fontWeight="bold">Medida</text>

                  {/* Matéria-Prima */}
                  <line x1="250" y1="80" x2="210" y2="135" stroke="#10b981" strokeWidth="1.5" />
                  <text x="190" y="145" fill="#10b981" fontSize="7" fontWeight="bold">Matéria-Prima</text>

                  {/* Causas secundárias vinculadas */}
                  {selectedNc?.rootCause && (
                    <g>
                      <rect x="75" y="45" width="70" height="14" rx="2" fill="#7c3aed" opacity="0.15" />
                      <text x="110" y="54" fill="#6d28d9" fontSize="6" fontWeight="semibold" textAnchor="middle">
                        {selectedNc.rootCause.slice(0, 15)}...
                      </text>
                    </g>
                  )}
                </svg>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 border-t pt-2 mt-2">
                <span className="truncate max-w-[200px]">Causa mapeada: <strong>{selectedNc?.rootCause || 'Não analisada'}</strong></span>
                <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2 text-sky-500 border border-sky-100 hover:bg-sky-50/50 dark:border-sky-900/40" onClick={() => editSelected('cause')} disabled={!selectedNc || !canUpdate}>
                  Mapear Causas
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita: Análise 5 Porquês e Auditorias */}
        <div className="space-y-6">
          {/* Análise de 5 Porquês */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[380px]">
            <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <HelpCircle className="h-4 w-4 text-sky-500" />
                Análise causal registrada
              </h3>
            </div>
            
            <CardContent className="p-4 flex-1 overflow-y-auto">
              {selectedNc ? (
                <div className="relative border-l border-sky-200 dark:border-sky-900 ml-2.5 pl-4 space-y-4 text-xs">
                  {[
                    { q: 'Problema registrado', a: selectedNc.title },
                    { q: 'Descrição observada', a: selectedNc.description },
                    { q: 'Contenção imediata', a: selectedNc.immediateAction },
                    { q: 'Causa raiz identificada', a: selectedNc.rootCause },
                    { q: 'Plano corretivo', a: selectedNc.correctivePlan },
                  ].map((why, index) => (
                    <div key={index} className="relative">
                      {/* Marcador circular */}
                      <span className="absolute -left-[21px] top-1 h-3.5 w-3.5 rounded-full border-2 border-sky-500 bg-white dark:bg-slate-900 flex items-center justify-center text-[7px] font-bold text-sky-500">
                        {index + 1}
                      </span>
                      <div className="font-bold text-slate-500">{why.q}</div>
                      <div className={cn('mt-0.5 font-semibold', why.a ? 'text-slate-800 dark:text-slate-200' : 'text-amber-600')}>
                        {why.a || 'Ainda não informado'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground h-full flex flex-col items-center justify-center">
                  <HelpCircle className="h-8 w-8 text-slate-350 dark:text-slate-700 mb-2" />
                  Selecione uma RNC para visualizar sua análise causal.
                </div>
              )}
            </CardContent>
          </Card>

          {/* SLA e Auditorias ISO */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[300px]">
            <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <CalendarClock className="h-4 w-4 text-purple-500" />
                Próximas auditorias
              </h3>
            </div>
            
            <CardContent className="p-3 flex-1 overflow-y-auto text-xs">
              <div className="space-y-3">
                {auditsQuery.isLoading ? (
                  <LoadingState />
                ) : (auditsQuery.data?.calendar ?? []).length === 0 ? (
                  <EmptyState title="Sem auditorias agendadas" description="O cronograma de auditorias não possui eventos futuros." />
                ) : (auditsQuery.data?.calendar ?? []).slice(0, 5).map((audit) => (
                  <button type="button" key={audit.id} onClick={() => router.push('/audits')} className="w-full p-2.5 text-left rounded-lg border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-all flex flex-col gap-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-800 dark:text-slate-200">{audit.code ? `${audit.code} · ` : ''}{audit.title}</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full border bg-slate-100 border-slate-200 text-slate-550">{audit.status}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">{formatDate(audit.plannedDate)}</div>
                    <div className="text-[10.5px] text-slate-500 line-clamp-1">{audit.orgNode?.name ?? 'Área não definida'}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* E. Rodapé de Governança */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800/80 pt-4 mt-2 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-500" />
            <span>Base do SGQ: <strong className="text-slate-700 dark:text-slate-350">{countTotal} RNCs registradas</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-sky-500" />
            <span>Colaboradores disponíveis como responsáveis: <strong>{(options?.users ?? []).length} pessoas</strong></span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-slate-655 dark:text-slate-450 hover:text-slate-900" onClick={exportReport} disabled={items.length === 0}>
            <FileUp className="h-3.5 w-3.5" />
            Exportar Painel de RNCs
          </Button>
          <button type="button" onClick={() => router.push('/central-atendimento')} className="h-8 w-8 rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center cursor-pointer shadow-md transition-all hover:scale-105" title="Central de Atendimento">
            <HelpCircle className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Dialog Formulário Modal */}
      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh] bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar NC #${editing.number}` : 'Nova não conformidade'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 p-2">
            <div className="md:col-span-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>Origem</Label>
              <NativeSelect value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as NcSource }))}>
                {Object.entries(SOURCE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Severidade</Label>
              <NativeSelect value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as NcSeverity }))}>
                {Object.entries(SEVERITY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Status</Label>
              <NativeSelect value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as NcStatus }))}>
                {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div>
              <Label>Área/processo</Label>
              <NativeSelect value={form.orgNodeId} onChange={(e) => setForm((f) => ({ ...f, orgNodeId: e.target.value }))}>
                <option value="">Sem área direta</option>
                {(options?.orgNodes ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Responsável</Label>
              <NativeSelect value={form.responsibleUserId} onChange={(e) => setForm((f) => ({ ...f, responsibleUserId: e.target.value }))}>
                <option value="">Sem responsável</option>
                {(options?.users ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>KPI vinculado</Label>
              <NativeSelect value={form.indicatorId} onChange={(e) => setForm((f) => ({ ...f, indicatorId: e.target.value }))}>
                <option value="">Sem KPI</option>
                {(options?.indicators ?? []).map((item) => <option key={item.id} value={item.id}>{item.code ? `[${item.code}] ` : ''}{item.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Desvio de origem</Label>
              <NativeSelect value={form.deviationId} onChange={(e) => setForm((f) => ({ ...f, deviationId: e.target.value }))}>
                <option value="">Sem desvio</option>
                {(options?.deviations ?? []).map((item) => <option key={item.id} value={item.id}>#{item.number} {item.title}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Ação corretiva (plano)</Label>
              <NativeSelect value={form.correctiveActionId} onChange={(e) => setForm((f) => ({ ...f, correctiveActionId: e.target.value }))}>
                <option value="">Sem plano vinculado</option>
                {(options?.actions ?? []).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Eficácia verificada?</Label>
              <NativeSelect value={form.effectivenessOk} onChange={(e) => setForm((f) => ({ ...f, effectivenessOk: e.target.value }))}>
                <option value="">Não avaliada</option>
                <option value="true">Eficaz</option>
                <option value="false">Ineficaz</option>
              </NativeSelect>
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Ação imediata / contenção</Label>
              <Textarea rows={2} value={form.immediateAction} onChange={(e) => setForm((f) => ({ ...f, immediateAction: e.target.value }))} />
            </div>
            <div>
              <Label>Causa raiz</Label>
              <Textarea rows={3} value={form.rootCause} onChange={(e) => setForm((f) => ({ ...f, rootCause: e.target.value }))} />
            </div>
            <div>
              <Label>Plano corretivo</Label>
              <Textarea rows={3} value={form.correctivePlan} onChange={(e) => setForm((f) => ({ ...f, correctivePlan: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Verificação de eficácia</Label>
              <Textarea rows={2} value={form.effectivenessCheck} onChange={(e) => setForm((f) => ({ ...f, effectivenessCheck: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim()}>
              {save.isPending ? 'Salvando...' : 'Salvar NC'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// Componentes Helper Internos

interface KpiCardProps {
  title: string;
  value: string | number;
  change: string;
  color: 'emerald' | 'rose' | 'sky';
  icon: React.ComponentType<any>;
}

function KpiCard({ title, value, change, color, icon: Icon }: KpiCardProps) {
  const colorMaps = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 dark:bg-emerald-500/20 border-emerald-500/10',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-455 dark:bg-rose-500/20 border-rose-500/10',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-455 dark:bg-sky-500/20 border-sky-500/10',
  };

  return (
    <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm transition-all hover:shadow-md">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="space-y-1 min-w-0">
          <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider block truncate">{title}</span>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white leading-none">{value}</div>
          <div className="text-[9px] text-slate-500 dark:text-slate-400 font-medium block truncate mt-0.5">{change}</div>
        </div>
        <div className={cn('h-9 w-9 rounded-full flex items-center justify-center shrink-0 border ml-2', colorMaps[color])}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionBtn({ icon: Icon, title, onClick }: { icon: React.ComponentType<any>; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md hover:border-slate-200/50 dark:hover:border-slate-800"
    >
      <div className="h-8 w-8 rounded-full flex items-center justify-center border bg-slate-50/50 dark:bg-slate-950/20 border-slate-200/40 text-sky-500">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="text-[10px] font-bold text-slate-850 dark:text-slate-200 leading-snug max-w-[120px]">{title}</div>
    </button>
  );
}

function toQueryString(filters: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

function toInputDate(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['nonconformities'] });
}
