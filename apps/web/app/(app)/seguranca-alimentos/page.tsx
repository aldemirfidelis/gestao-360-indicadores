'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import {
  AlertCircle,
  AlertTriangle,
  Brain,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FileWarning,
  GaugeCircle,
  Layers3,
  ListChecks,
  Network,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Truck,
  Workflow,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { ComplianceTab } from '@/components/food-safety/compliance-tab';
import { IntelligenceTab } from '@/components/food-safety/intelligence-tab';
import { SupplyChainTab } from '@/components/food-safety/supply-chain-tab';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { LoadingState } from '@/components/platform/loading-state';
import type { FlowTemplateStep, VisualModelId } from '@/components/seguranca-alimentos/isometric-library';

// React Flow (+CSS) e pesado e so e necessario na aba Fluxograma; carrega sob
// demanda para nao entrar no bundle inicial da pagina de Seguranca de Alimentos.
const ProcessFlow = dynamic(
  () => import('@/components/seguranca-alimentos/process-flow').then((m) => m.ProcessFlow),
  { ssr: false, loading: () => <LoadingState label="Carregando fluxograma..." /> },
);

// IsometricFlow (Three.js) e carregado sob demanda apenas se o usuario alternar para o modo 3D.
const IsometricFlow = dynamic(
  () => import('@/components/seguranca-alimentos/isometric-flow').then((m) => m.IsometricFlow),
  { ssr: false, loading: () => <LoadingState label="Carregando editor 3D..." /> },
);

// ----------------------------- tipos --------------------------------------
type ProgramStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
type ProcessStatus = 'DRAFT' | 'IN_ANALYSIS' | 'IN_REVIEW' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'OBSOLETE';
type StepType = 'RECEIVING' | 'STORAGE' | 'PROCESSING' | 'PACKAGING' | 'TRANSPORT' | 'DISTRIBUTION' | 'OTHER';

interface OrgRef { id: string; name: string; type: string }
interface UserRef { id: string; name: string; email: string }

interface Program {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  scope: string | null;
  visibility: string;
  status: ProgramStatus;
  orgNodeId: string | null;
  ownerUserId: string | null;
  orgNode: OrgRef | null;
  owner: UserRef | null;
  _count?: { processes: number };
}

interface Step {
  id: string;
  number: number;
  code: string | null;
  name: string;
  description: string | null;
  type: StepType;
  visualModel: string | null;
  inputs: string | null;
  outputs: string | null;
  positionX: number | null;
  positionY: number | null;
  isControlPoint: boolean;
}

interface Process {
  id: string;
  number: number;
  code: string | null;
  name: string;
  description: string | null;
  objective: string | null;
  productName: string | null;
  productionLine: string | null;
  version: string | null;
  status: ProcessStatus;
  positionX: number | null;
  positionY: number | null;
  programId: string;
  orgNodeId: string | null;
  ownerUserId: string | null;
  orgNode: OrgRef | null;
  owner: UserRef | null;
  steps: Step[];
}

interface Summary {
  processes: number;
  published: number;
  draft: number;
  inReview: number;
  pendingApproval: number;
  obsolete: number;
  steps: number;
  controlPoints: number;
  hazards?: number;
  hazardsCritical?: number;
  hazardsHigh?: number;
  ccp?: number;
  oprp?: number;
}

interface Options {
  orgNodes: OrgRef[];
  users: UserRef[];
  programStatuses: ProgramStatus[];
  processStatuses: ProcessStatus[];
  stepTypes: StepType[];
  hazardCategories: HazardCategory[];
  riskLevels: RiskLevel[];
  controlTypes: ControlType[];
  hazardStatuses: HazardStatus[];
  visibilities: string[];
}

const PROCESS_STATUS_LABEL: Record<ProcessStatus, string> = {
  DRAFT: 'Rascunho',
  IN_ANALYSIS: 'Em análise',
  IN_REVIEW: 'Em revisão',
  PENDING_APPROVAL: 'Aguardando aprovação',
  APPROVED: 'Aprovado',
  PUBLISHED: 'Publicado',
  OBSOLETE: 'Obsoleto',
};
const PROCESS_STATUS_CLASS: Record<ProcessStatus, string> = {
  DRAFT: 'pill-gray',
  IN_ANALYSIS: 'pill-yellow',
  IN_REVIEW: 'pill-yellow',
  PENDING_APPROVAL: 'pill-yellow',
  APPROVED: 'pill-green',
  PUBLISHED: 'pill-green',
  OBSOLETE: 'pill-red',
};
const STEP_TYPE_LABEL: Record<StepType, string> = {
  RECEIVING: 'Recebimento',
  STORAGE: 'Armazenamento',
  PROCESSING: 'Processamento',
  PACKAGING: 'Embalagem',
  TRANSPORT: 'Transporte',
  DISTRIBUTION: 'Distribuição',
  OTHER: 'Outro',
};
const PROGRAM_STATUS_LABEL: Record<ProgramStatus, string> = { ACTIVE: 'Ativo', DRAFT: 'Rascunho', ARCHIVED: 'Arquivado' };

type HazardCategory = 'BIOLOGICAL' | 'CHEMICAL' | 'PHYSICAL' | 'ALLERGENIC' | 'RADIOLOGICAL' | 'FRAUD' | 'SABOTAGE' | 'CROSS_CONTAMINATION' | 'OTHER';
type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
type ControlType = 'NONE' | 'PRP' | 'OPRP' | 'CCP';
type HazardStatus = 'OPEN' | 'ASSESSED' | 'CONTROLLED' | 'ARCHIVED';

interface Hazard {
  id: string;
  number: number;
  code: string | null;
  category: HazardCategory;
  name: string;
  description: string | null;
  source: string | null;
  consequence: string | null;
  justification: string | null;
  severity: number | null;
  probability: number | null;
  detection: number | null;
  riskIndex: number | null;
  riskLevel: RiskLevel | null;
  controlType: ControlType;
  controlJustification: string | null;
  existingControls: string | null;
  additionalControls: string | null;
  status: HazardStatus;
  processId: string;
  stepId: string | null;
  responsibleUserId: string | null;
  process: { id: string; number: number; name: string; code: string | null; orgNodeId: string | null; programId: string } | null;
  step: { id: string; number: number; name: string } | null;
  responsible: UserRef | null;
}

interface RiskMatrix {
  id: string;
  name: string;
  severityScale: number;
  probabilityScale: number;
  useDetection: boolean;
  detectionScale: number;
  thresholdLow: number;
  thresholdModerate: number;
  thresholdHigh: number;
}

type ControlPlanStatus = 'ACTIVE' | 'INACTIVE';
type MonitoringResult = 'OK' | 'ALERT' | 'OUT';

interface ControlPlan {
  id: string;
  hazardId: string;
  controlType: ControlType;
  parameter: string | null;
  unit: string | null;
  criticalLimitText: string | null;
  criticalMin: number | null;
  criticalMax: number | null;
  alertMin: number | null;
  alertMax: number | null;
  method: string | null;
  instrument: string | null;
  frequency: string | null;
  correction: string | null;
  correctiveAction: string | null;
  requiresLotBlock: boolean;
  requiresNonConformity: boolean;
  status: ControlPlanStatus;
  responsibleUserId: string | null;
  hazard: { id: string; number: number; name: string; controlType: ControlType; process: { id: string; name: string; orgNodeId: string | null } | null; step: { id: string; name: string } | null } | null;
  responsible: UserRef | null;
  _count?: { records: number };
}

interface MonitoringRecord {
  id: string;
  measuredAt: string;
  valueNum: number | null;
  valueText: string | null;
  result: MonitoringResult;
  notes: string | null;
  lotBlocked: boolean;
  nonConformityId: string | null;
  recordedBy: { id: string; name: string } | null;
}

const RESULT_LABEL: Record<MonitoringResult, string> = { OK: 'Dentro do limite', ALERT: 'Alerta', OUT: 'Fora do limite' };
const RESULT_CLASS: Record<MonitoringResult, string> = {
  OK: 'bg-emerald-100 text-emerald-700',
  ALERT: 'bg-amber-100 text-amber-700',
  OUT: 'bg-rose-100 text-rose-700',
};

function computeResultClient(plan: ControlPlan, valueNum: number | null): MonitoringResult {
  if (valueNum == null) return 'OK';
  if ((plan.criticalMin != null && valueNum < plan.criticalMin) || (plan.criticalMax != null && valueNum > plan.criticalMax)) return 'OUT';
  if ((plan.alertMin != null && valueNum < plan.alertMin) || (plan.alertMax != null && valueNum > plan.alertMax)) return 'ALERT';
  return 'OK';
}

const HAZARD_CATEGORY_LABEL: Record<HazardCategory, string> = {
  BIOLOGICAL: 'Biológico',
  CHEMICAL: 'Químico',
  PHYSICAL: 'Físico',
  ALLERGENIC: 'Alergênico',
  RADIOLOGICAL: 'Radiológico',
  FRAUD: 'Fraude',
  SABOTAGE: 'Sabotagem',
  CROSS_CONTAMINATION: 'Contaminação cruzada',
  OTHER: 'Outro',
};
const RISK_LEVEL_LABEL: Record<RiskLevel, string> = { LOW: 'Baixo', MODERATE: 'Moderado', HIGH: 'Alto', CRITICAL: 'Crítico' };
const RISK_LEVEL_CLASS: Record<RiskLevel, string> = {
  LOW: 'bg-emerald-100 text-emerald-700',
  MODERATE: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-rose-100 text-rose-700',
};
const CONTROL_TYPE_LABEL: Record<ControlType, string> = { NONE: '—', PRP: 'PPR', OPRP: 'PPRO', CCP: 'PCC' };

type TabKey = 'overview' | 'processes' | 'hazards' | 'monitoring' | 'compliance' | 'chain' | 'intelligence' | 'flow' | 'matrix';
const TABS: Array<{ key: TabKey; label: string; icon: typeof Network }> = [
  { key: 'overview', label: 'Visão Geral', icon: ShieldCheck },
  { key: 'processes', label: 'Processos', icon: ListChecks },
  { key: 'hazards', label: 'Perigos / APPCC', icon: AlertTriangle },
  { key: 'monitoring', label: 'Monitoramento', icon: GaugeCircle },
  { key: 'compliance', label: 'Compliance', icon: ClipboardCheck },
  { key: 'chain', label: 'Cadeia e Recall', icon: Truck },
  { key: 'intelligence', label: 'Inteligência', icon: Brain },
  { key: 'flow', label: 'Fluxograma', icon: Workflow },
  { key: 'matrix', label: 'Matriz Geral', icon: Layers3 },
];
const TAB_KEYS = new Set<TabKey>(TABS.map((tab) => tab.key));

function isFoodSafetyTab(value: string | null): value is TabKey {
  return Boolean(value && TAB_KEYS.has(value as TabKey));
}

// Reuso dos modulos corporativos existentes (integracao da Fase 1).
const SHORTCUTS: Array<{ href: string; title: string; description: string; icon: typeof Network; tone: string }> = [
  { href: '/documents', title: 'Documentos', description: 'Manuais, POPs, procedimentos, registros e evidências (GED).', icon: FileText, tone: 'bg-status-blue/10 text-status-blue' },
  { href: '/actions', title: 'Tarefas e planos de ação', description: 'Ações corretivas, prazos, responsáveis e eficácia.', icon: CheckSquare, tone: 'bg-status-green/10 text-status-green' },
  { href: '/audits', title: 'Auditorias e inspeções', description: 'Auditorias, listas de verificação, constatações e geração de NCs.', icon: ClipboardCheck, tone: 'bg-status-purple/10 text-status-purple' },
  { href: '/nonconformities', title: 'Não conformidades', description: 'NCs, análise de causa, ação corretiva e verificação.', icon: FileWarning, tone: 'bg-status-red/10 text-status-red' },
  { href: '/forms', title: 'Formulários e listas de verificação', description: 'Monitoramentos, listas de verificação digitais e preenchimentos.', icon: ClipboardList, tone: 'bg-status-yellow/10 text-status-yellow' },
];

// ----------------------------- página -------------------------------------
export default function SegurancaAlimentosPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['fsms:create', 'fsms:update', 'fsms:manage']);
  const requestedTab = searchParams.get('tab');
  const initialTab = isFoodSafetyTab(requestedTab) ? requestedTab : 'overview';
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [programId, setProgramId] = useState<string>('');
  const [programDialog, setProgramDialog] = useState<Program | 'new' | null>(null);
  const [processDialog, setProcessDialog] = useState<Process | 'new' | null>(null);
  const [hazardDialog, setHazardDialog] = useState<Hazard | 'new' | null>(null);
  const [matrixDialog, setMatrixDialog] = useState(false);
  const [planDialog, setPlanDialog] = useState<ControlPlan | 'new' | null>(null);
  const [recordPlan, setRecordPlan] = useState<ControlPlan | null>(null);
  const [selectedFlowProcessId, setSelectedFlowProcessId] = useState<string>('');

  const programs = useQuery<Program[]>({ queryKey: ['fsms', 'programs'], queryFn: () => api('/food-safety/programs') });
  const options = useQuery<Options>({ queryKey: ['fsms', 'options'], queryFn: () => api('/food-safety/options') });

  useEffect(() => {
    const rows = programs.data ?? [];
    if (rows.length && !rows.some((p) => p.id === programId)) setProgramId(rows[0].id);
  }, [programs.data, programId]);

  useEffect(() => {
    const requested = searchParams.get('tab');
    const nextTab = isFoodSafetyTab(requested) ? requested : 'overview';
    setTab(nextTab);
  }, [searchParams]);

  const program = (programs.data ?? []).find((p) => p.id === programId) ?? null;

  const processes = useQuery<Process[]>({
    queryKey: ['fsms', 'processes', programId],
    queryFn: () => api(`/food-safety/processes?programId=${programId}`),
    enabled: !!programId,
  });
  const summary = useQuery<Summary>({
    queryKey: ['fsms', 'summary', programId],
    queryFn: () => api(`/food-safety/summary?programId=${programId}`),
    enabled: !!programId,
  });
  const hazardsAll = useQuery<Hazard[]>({ queryKey: ['fsms', 'hazards'], queryFn: () => api('/food-safety/hazards'), enabled: !!programId });
  const riskMatrix = useQuery<RiskMatrix>({ queryKey: ['fsms', 'risk-matrix'], queryFn: () => api('/food-safety/risk-matrix') });
  const controlPlans = useQuery<ControlPlan[]>({ queryKey: ['fsms', 'control-plans', programId], queryFn: () => api(`/food-safety/control-plans?programId=${programId}`), enabled: !!programId });
  const hazards = (hazardsAll.data ?? []).filter((h) => h.process?.programId === programId);

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ['fsms'] });
  }

  // Efeito para auto-selecionar o primeiro processo para a visualizacao 3D se nada estiver selecionado
  useEffect(() => {
    if (processes.data?.length && !selectedFlowProcessId) {
      setSelectedFlowProcessId(processes.data[0].id);
    }
  }, [processes.data, selectedFlowProcessId]);

  // Mutation para mover e salvar posicoes de etapas do grid 3D no banco
  const moveStepMutation = useMutation({
    mutationFn: ({ stepId, positionX, positionY }: { stepId: string; positionX: number; positionY: number }) =>
      api(`/food-safety/steps/${stepId}`, { method: 'PATCH', json: { positionX, positionY } }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar posição da etapa'),
  });

  const arrangeStepsMutation = useMutation({
    mutationFn: (positions: Array<{ id: string; positionX: number; positionY: number }>) =>
      Promise.all(
        positions.map(({ id, positionX, positionY }) =>
          api(`/food-safety/steps/${id}`, { method: 'PATCH', json: { positionX, positionY } }),
        ),
      ),
    onSuccess: () => {
      invalidate();
      toast.success('Etapas organizadas automaticamente');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao organizar as etapas'),
  });

  // Mutation para criar uma nova etapa
  const createStepMutation = useMutation({
    mutationFn: ({
      processId,
      name,
      description,
      type,
      visualModel,
      isControlPoint,
    }: {
      processId: string;
      name: string;
      description?: string;
      type: StepType;
      visualModel: VisualModelId;
      isControlPoint: boolean;
    }) =>
      api(`/food-safety/processes/${processId}/steps`, {
        method: 'POST',
        json: { name, description: description || null, type, visualModel, isControlPoint },
      }),
    onSuccess: () => {
      invalidate();
      toast.success('Etapa adicionada com sucesso');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao adicionar etapa'),
  });

  const applyTemplateMutation = useMutation({
    mutationFn: ({ processId, steps }: { processId: string; steps: FlowTemplateStep[] }) =>
      api<{ created: number }>(`/food-safety/processes/${processId}/steps/bulk`, {
        method: 'POST',
        json: { steps },
      }),
    onSuccess: ({ created }) => {
      invalidate();
      toast.success(`${created} etapas do modelo adicionadas com sucesso`);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao importar o fluxo completo'),
  });

  // Mutation para excluir uma etapa
  const deleteStepMutation = useMutation({
    mutationFn: (stepId: string) =>
      api(`/food-safety/steps/${stepId}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      toast.success('Etapa removida com sucesso');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao remover etapa'),
  });

  // Mutation para atualizar campos gerais de uma etapa (Nome, Tipo de modelo, PCC)
  const updateStepMutation = useMutation({
    mutationFn: ({
      stepId,
      data,
    }: {
      stepId: string;
      data: {
        number?: number;
        name?: string;
        description?: string | null;
        inputs?: string | null;
        outputs?: string | null;
        type?: string;
        visualModel?: string | null;
        isControlPoint?: boolean;
      };
    }) =>
      api(`/food-safety/steps/${stepId}`, { method: 'PATCH', json: data }),
    onSuccess: () => {
      invalidate();
      toast.success('Etapa atualizada com sucesso');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao atualizar etapa'),
  });

  function selectTab(nextTab: TabKey) {
    setTab(nextTab);
    if (typeof window === 'undefined') return;
    const url = nextTab === 'overview' ? '/seguranca-alimentos' : `/seguranca-alimentos?tab=${nextTab}`;
    window.history.replaceState(null, '', url);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Corporativo"
        tone="admin"
        title="Segurança dos Alimentos"
        description="Gestão de programas, processos, perigos e controles da segurança dos alimentos (FSMS)."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Segurança dos Alimentos' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {(programs.data ?? []).length > 0 && (
              <NativeSelect className="h-9 w-56" value={programId} onChange={(e) => setProgramId(e.target.value)}>
                {(programs.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code ? `${p.code} · ` : ''}{p.name}
                  </option>
                ))}
              </NativeSelect>
            )}
            {canManage && (
              <Button onClick={() => setProgramDialog('new')}>
                <Plus className="mr-2 h-4 w-4" />
                Novo programa
              </Button>
            )}
          </div>
        }
      />

      {programs.isPending ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Carregando programas...</CardContent></Card>
      ) : (programs.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
            <div className="text-base font-semibold">Nenhum programa de segurança dos alimentos</div>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Crie o primeiro programa (ex.: &quot;Segurança dos Alimentos - Unidade X&quot;) para mapear processos, perigos e controles.
            </p>
            {canManage && (
              <Button className="mt-4" onClick={() => setProgramDialog('new')}>
                <Plus className="mr-2 h-4 w-4" />
                Criar programa
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* abas removidas pois já estão no menu lateral */}

          {tab === 'overview' && <OverviewTab program={program} summary={summary.data} />}
          {tab === 'processes' && (
            <ProcessesTab
              processes={processes.data ?? []}
              loading={processes.isPending}
              canManage={canManage}
              onNew={() => setProcessDialog('new')}
              onEdit={(p) => setProcessDialog(p)}
            />
          )}
          {tab === 'hazards' && (
            <PerigosTab
              hazards={hazards}
              loading={hazardsAll.isPending}
              canManage={canManage}
              onNew={() => setHazardDialog('new')}
              onEdit={(h) => setHazardDialog(h)}
              onConfig={() => setMatrixDialog(true)}
            />
          )}
          {tab === 'monitoring' && (
            <MonitoramentoTab
              plans={controlPlans.data ?? []}
              loading={controlPlans.isPending}
              canManage={canManage}
              hasHazards={hazards.length > 0}
              onNew={() => setPlanDialog('new')}
              onEdit={(p) => setPlanDialog(p)}
              onRecord={(p) => setRecordPlan(p)}
            />
          )}
          {tab === 'compliance' && <ComplianceTab canManage={canManage} users={options.data?.users ?? []} />}
          {tab === 'chain' && <SupplyChainTab programId={programId} canManage={canManage} users={options.data?.users ?? []} processes={processes.data ?? []} />}
          {tab === 'intelligence' && <IntelligenceTab programId={programId} canManage={canManage} />}
          {tab === 'flow' && (
            <div className="space-y-4">
              {/* Barra de Ações do Modo de Fluxo */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Workflow className="h-4.5 w-4.5 text-sky-500" />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Mapeamento e Fluxograma de Processos 3D</span>
                </div>

                {(processes.data ?? []).length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Selecione o Processo:</span>
                    <NativeSelect 
                      className="h-8 w-60 text-xs py-0" 
                      value={selectedFlowProcessId} 
                      onChange={(e) => setSelectedFlowProcessId(e.target.value)}
                    >
                      {(processes.data ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code ? `${p.code} · ` : ''}{p.name} ({p.steps.length} etapas)
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                )}
              </div>

              {(() => {
                const activeProcess = (processes.data ?? []).find((p) => p.id === selectedFlowProcessId);
                if (!activeProcess) {
                  return (
                    <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum processo selecionado para exibição 3D.</CardContent></Card>
                  );
                }
                return (
                  <IsometricFlow
                    steps={activeProcess.steps}
                    canManage={canManage}
                    onStepMove={(stepId, x, y) => moveStepMutation.mutate({ stepId, positionX: x, positionY: y })}
                    onStepsArrange={(positions) => arrangeStepsMutation.mutate(positions)}
                    onStepCreate={(data) => createStepMutation.mutate({ processId: activeProcess.id, ...data })}
                    onTemplateApply={(steps) => applyTemplateMutation.mutate({ processId: activeProcess.id, steps })}
                    onStepDelete={(stepId) => deleteStepMutation.mutate(stepId)}
                    onStepUpdate={(stepId, data) => updateStepMutation.mutate({ stepId, data })}
                  />
                );
              })()}
            </div>
          )}
          {tab === 'matrix' && <MatrixTab processes={processes.data ?? []} hazards={hazards} />}
        </>
      )}

      {programDialog && (
        <ProgramDialog
          record={programDialog === 'new' ? null : programDialog}
          options={options.data}
          onClose={() => setProgramDialog(null)}
          onSaved={(saved) => {
            setProgramDialog(null);
            setProgramId(saved.id);
            invalidate();
          }}
        />
      )}
      {processDialog && programId && (
        <ProcessDialog
          record={processDialog === 'new' ? null : processDialog}
          programId={programId}
          options={options.data}
          canManage={canManage}
          onClose={() => setProcessDialog(null)}
          onSaved={() => {
            setProcessDialog(null);
            invalidate();
          }}
        />
      )}
      {hazardDialog && (
        <HazardDialog
          record={hazardDialog === 'new' ? null : hazardDialog}
          processes={processes.data ?? []}
          options={options.data}
          matrix={riskMatrix.data}
          canManage={canManage}
          onClose={() => setHazardDialog(null)}
          onSaved={() => {
            setHazardDialog(null);
            invalidate();
          }}
        />
      )}
      {matrixDialog && (
        <RiskMatrixDialog matrix={riskMatrix.data} canManage={canManage} onClose={() => setMatrixDialog(false)} onSaved={() => { setMatrixDialog(false); invalidate(); }} />
      )}
      {planDialog && (
        <ControlPlanDialog
          record={planDialog === 'new' ? null : planDialog}
          hazards={hazards}
          options={options.data}
          canManage={canManage}
          onClose={() => setPlanDialog(null)}
          onSaved={() => { setPlanDialog(null); invalidate(); }}
        />
      )}
      {recordPlan && (
        <RecordDialog plan={recordPlan} canManage={canManage} onClose={() => setRecordPlan(null)} onSaved={() => { setRecordPlan(null); invalidate(); }} />
      )}
    </div>
  );
}

// ----------------------------- Visão Geral --------------------------------
function OverviewTab({ program, summary }: { program: Program | null; summary?: Summary }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard title="Processos" value={formatNumber(summary?.processes ?? 0)} icon={<ListChecks className="h-4 w-4" />} />
        <MetricCard title="Publicados" value={formatNumber(summary?.published ?? 0)} icon={<ShieldCheck className="h-4 w-4" />} />
        <MetricCard title="Etapas mapeadas" value={formatNumber(summary?.steps ?? 0)} icon={<Network className="h-4 w-4" />} />
        <MetricCard title="Pontos de controle" value={formatNumber(summary?.controlPoints ?? 0)} icon={<ClipboardList className="h-4 w-4" />} />
      </div>

      {program && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            <Field label="Programa" value={program.name} />
            <Field label="Código" value={program.code ?? '—'} />
            <Field label="Unidade / Área" value={program.orgNode?.name ?? '—'} />
            <Field label="Responsável" value={program.owner?.name ?? '—'} />
            <Field label="Visibilidade" value={program.visibility} />
            <Field label="Status" value={PROGRAM_STATUS_LABEL[program.status] ?? program.status} />
            {program.scope && <div className="md:col-span-2"><Field label="Escopo" value={program.scope} /></div>}
            {program.description && <div className="md:col-span-2"><Field label="Descrição" value={program.description} /></div>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          <div className="mb-2 font-semibold text-foreground">Distribuição dos processos por status</div>
          <div className="flex flex-wrap gap-2">
            <Pill label="Rascunho" value={summary?.draft ?? 0} />
            <Pill label="Em revisão" value={summary?.inReview ?? 0} />
            <Pill label="Aguardando aprovação" value={summary?.pendingApproval ?? 0} />
            <Pill label="Publicado" value={summary?.published ?? 0} />
            <Pill label="Obsoleto" value={summary?.obsolete ?? 0} />
          </div>
          <div className="mb-2 mt-4 font-semibold text-foreground">Perigos e controles</div>
          <div className="flex flex-wrap gap-2">
            <Pill label="Perigos" value={summary?.hazards ?? 0} />
            <Pill label="Críticos" value={summary?.hazardsCritical ?? 0} />
            <Pill label="Alto risco" value={summary?.hazardsHigh ?? 0} />
            <Pill label="PCC" value={summary?.ccp ?? 0} />
            <Pill label="PPRO" value={summary?.oprp ?? 0} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="text-sm font-semibold">Documentos, tarefas e integrações</div>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">Atalhos para os módulos corporativos integrados à segurança dos alimentos.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {SHORTCUTS.map((s) => {
              const Icon = s.icon;
              return (
                <Link key={s.href} href={s.href} className="group flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/35">
                  <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-md', s.tone)}><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{s.title}</div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1 text-xs">
      <span className="font-semibold">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

// ----------------------------- Processos ----------------------------------
function ProcessesTab({
  processes,
  loading,
  canManage,
  onNew,
  onEdit,
}: {
  processes: Process[];
  loading: boolean;
  canManage: boolean;
  onNew: () => void;
  onEdit: (p: Process) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b p-3">
          <div className="text-sm font-semibold">Processos do programa</div>
          {canManage && (
            <Button size="sm" onClick={onNew}>
              <Plus className="mr-2 h-4 w-4" />
              Novo processo
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th className="text-left">Processo</th>
                <th className="text-left">Produto / Linha</th>
                <th className="text-left">Área</th>
                <th className="text-left">Etapas</th>
                <th className="text-left">Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">Carregando...</td></tr>
              ) : processes.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">Nenhum processo cadastrado neste programa.</td></tr>
              ) : (
                processes.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="font-medium">{p.code ? `${p.code} · ` : ''}{p.name}</div>
                      <div className="text-xs text-muted-foreground">#{p.number}{p.version ? ` · v${p.version}` : ''}</div>
                    </td>
                    <td className="text-sm">{[p.productName, p.productionLine].filter(Boolean).join(' / ') || '—'}</td>
                    <td className="text-sm">{p.orgNode?.name ?? '—'}</td>
                    <td>{p.steps.length}{p.steps.some((s) => s.isControlPoint) ? ` · ${p.steps.filter((s) => s.isControlPoint).length} PC` : ''}</td>
                    <td><span className={cn('pill', PROCESS_STATUS_CLASS[p.status])}>{PROCESS_STATUS_LABEL[p.status]}</span></td>
                    <td className="text-right">
                      <Button variant="outline" size="sm" onClick={() => onEdit(p)}>{canManage ? 'Abrir' : 'Ver'}</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}


// ----------------------------- Matriz Geral (APPCC) -----------------------
function MatrixTab({ processes, hazards }: { processes: Process[]; hazards: Hazard[] }) {
  const rows = useMemo(() => {
    const byStep = new Map<string, Hazard[]>();
    const byProcessNoStep = new Map<string, Hazard[]>();
    for (const h of hazards) {
      if (h.stepId) byStep.set(h.stepId, [...(byStep.get(h.stepId) ?? []), h]);
      else byProcessNoStep.set(h.processId, [...(byProcessNoStep.get(h.processId) ?? []), h]);
    }
    const out: Array<{ p: Process; s: Step | null; h: Hazard | null }> = [];
    for (const p of processes) {
      for (const h of byProcessNoStep.get(p.id) ?? []) out.push({ p, s: null, h });
      for (const s of p.steps) {
        const hs = byStep.get(s.id) ?? [];
        if (hs.length === 0) out.push({ p, s, h: null });
        else for (const h of hs) out.push({ p, s, h });
      }
      if (p.steps.length === 0 && (byProcessNoStep.get(p.id) ?? []).length === 0) out.push({ p, s: null, h: null });
    }
    return out;
  }, [processes, hazards]);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b p-2 text-xs text-muted-foreground">
          Matriz APPCC: cada linha é uma etapa/perigo. Linhas &quot;sem perigo analisado&quot; indicam lacunas a tratar.
        </div>
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th className="text-left">Processo</th>
                <th className="text-left">Etapa</th>
                <th className="text-left">Perigo</th>
                <th className="text-left">Categoria</th>
                <th className="text-center">Sev</th>
                <th className="text-center">Prob</th>
                <th className="text-center">Índice</th>
                <th className="text-left">Nível</th>
                <th className="text-left">Controle</th>
                <th className="text-left">Controles existentes</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={10} className="p-6 text-center text-sm text-muted-foreground">Cadastre processos, etapas e perigos para montar a matriz.</td></tr>
              ) : (
                rows.map(({ p, s, h }, i) => (
                  <tr key={`${p.id}-${s?.id ?? 'np'}-${h?.id ?? i}`}>
                    <td className="font-medium">{p.code ? `${p.code} · ` : ''}{p.name}</td>
                    <td>{s ? `${s.number}. ${s.name}` : <span className="text-muted-foreground">Processo</span>}</td>
                    <td>{h ? h.name : <span className="text-muted-foreground">— sem perigo analisado —</span>}</td>
                    <td>{h ? HAZARD_CATEGORY_LABEL[h.category] : '—'}</td>
                    <td className="text-center">{h?.severity ?? '—'}</td>
                    <td className="text-center">{h?.probability ?? '—'}</td>
                    <td className="text-center font-semibold">{h?.riskIndex ?? '—'}</td>
                    <td>{h?.riskLevel ? <span className={cn('rounded px-2 py-0.5 text-xs font-medium', RISK_LEVEL_CLASS[h.riskLevel])}>{RISK_LEVEL_LABEL[h.riskLevel]}</span> : '—'}</td>
                    <td>{h && h.controlType !== 'NONE' ? <Badge variant="outline">{CONTROL_TYPE_LABEL[h.controlType]}</Badge> : '—'}</td>
                    <td className="max-w-[16rem] truncate text-sm">{h?.existingControls ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ----------------------------- Dialogs ------------------------------------
function ProgramDialog({
  record,
  options,
  onClose,
  onSaved,
}: {
  record: Program | null;
  options?: Options;
  onClose: () => void;
  onSaved: (saved: Program) => void;
}) {
  const [form, setForm] = useState({
    name: record?.name ?? '',
    code: record?.code ?? '',
    description: record?.description ?? '',
    scope: record?.scope ?? '',
    visibility: record?.visibility ?? 'PRIVATE',
    status: record?.status ?? 'ACTIVE',
    orgNodeId: record?.orgNodeId ?? '',
    ownerUserId: record?.ownerUserId ?? '',
  });
  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        code: form.code || null,
        description: form.description || null,
        scope: form.scope || null,
        visibility: form.visibility,
        status: form.status,
        orgNodeId: form.orgNodeId || null,
        ownerUserId: form.ownerUserId || null,
      };
      return record
        ? api<Program>(`/food-safety/programs/${record.id}`, { method: 'PATCH', json: payload })
        : api<Program>('/food-safety/programs', { method: 'POST', json: payload });
    },
    onSuccess: (saved) => {
      toast.success('Programa salvo');
      onSaved(saved);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{record ? 'Editar' : 'Novo'} programa</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2"><Label className="field-required">Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Código</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
          <div>
            <Label>Unidade / Área</Label>
            <NativeSelect value={form.orgNodeId} onChange={(e) => setForm({ ...form, orgNodeId: e.target.value })}>
              <option value="">—</option>
              {(options?.orgNodes ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label>Responsável</Label>
            <NativeSelect value={form.ownerUserId} onChange={(e) => setForm({ ...form, ownerUserId: e.target.value })}>
              <option value="">—</option>
              {(options?.users ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label>Visibilidade</Label>
            <NativeSelect value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
              {(options?.visibilities ?? ['PUBLIC', 'PRIVATE', 'RESTRICTED']).map((v) => <option key={v} value={v}>{v}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label>Status</Label>
            <NativeSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProgramStatus })}>
              {(options?.programStatuses ?? ['ACTIVE', 'DRAFT', 'ARCHIVED']).map((s) => <option key={s} value={s}>{PROGRAM_STATUS_LABEL[s as ProgramStatus] ?? s}</option>)}
            </NativeSelect>
          </div>
          <div className="md:col-span-2"><Label>Escopo</Label><Textarea rows={2} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Descrição</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProcessDialog({
  record,
  programId,
  options,
  canManage,
  onClose,
  onSaved,
}: {
  record: Process | null;
  programId: string;
  options?: Options;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: record?.name ?? '',
    code: record?.code ?? '',
    description: record?.description ?? '',
    objective: record?.objective ?? '',
    productName: record?.productName ?? '',
    productionLine: record?.productionLine ?? '',
    version: record?.version ?? '',
    status: record?.status ?? 'DRAFT',
    orgNodeId: record?.orgNodeId ?? '',
    ownerUserId: record?.ownerUserId ?? '',
  });
  const [steps, setSteps] = useState<Step[]>(record?.steps ?? []);
  const [newStep, setNewStep] = useState({ name: '', type: 'PROCESSING' as StepType, isControlPoint: false });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        programId,
        name: form.name,
        code: form.code || null,
        description: form.description || null,
        objective: form.objective || null,
        productName: form.productName || null,
        productionLine: form.productionLine || null,
        version: form.version || null,
        status: form.status,
        orgNodeId: form.orgNodeId || null,
        ownerUserId: form.ownerUserId || null,
      };
      return record
        ? api(`/food-safety/processes/${record.id}`, { method: 'PATCH', json: payload })
        : api('/food-safety/processes', { method: 'POST', json: payload });
    },
    onSuccess: () => {
      toast.success('Processo salvo');
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar'),
  });

  const addStep = useMutation({
    mutationFn: () => api<Step>(`/food-safety/processes/${record!.id}/steps`, { method: 'POST', json: newStep }),
    onSuccess: (step) => {
      setSteps((prev) => [...prev, step]);
      setNewStep({ name: '', type: 'PROCESSING', isControlPoint: false });
      void qc.invalidateQueries({ queryKey: ['fsms'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao adicionar etapa'),
  });

  const removeStep = useMutation({
    mutationFn: (stepId: string) => api(`/food-safety/steps/${stepId}`, { method: 'DELETE' }),
    onSuccess: (_, stepId) => {
      setSteps((prev) => prev.filter((s) => s.id !== stepId));
      void qc.invalidateQueries({ queryKey: ['fsms'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao remover etapa'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{record ? `Processo #${record.number}` : 'Novo processo'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2"><Label className="field-required">Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Código</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Versão</Label><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Produto</Label><Input value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Linha produtiva</Label><Input value={form.productionLine} onChange={(e) => setForm({ ...form, productionLine: e.target.value })} disabled={!canManage} /></div>
          <div>
            <Label>Área</Label>
            <NativeSelect value={form.orgNodeId} onChange={(e) => setForm({ ...form, orgNodeId: e.target.value })} disabled={!canManage}>
              <option value="">—</option>
              {(options?.orgNodes ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label>Responsável</Label>
            <NativeSelect value={form.ownerUserId} onChange={(e) => setForm({ ...form, ownerUserId: e.target.value })} disabled={!canManage}>
              <option value="">—</option>
              {(options?.users ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label>Status (fluxo de trabalho)</Label>
            <NativeSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProcessStatus })} disabled={!canManage}>
              {(options?.processStatuses ?? Object.keys(PROCESS_STATUS_LABEL)).map((s) => <option key={s} value={s}>{PROCESS_STATUS_LABEL[s as ProcessStatus] ?? s}</option>)}
            </NativeSelect>
          </div>
          <div className="md:col-span-2"><Label>Objetivo</Label><Textarea rows={2} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-2"><Label>Descrição</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={!canManage} /></div>
        </div>

        {/* etapas — só após o processo existir */}
        {record && (
          <div className="mt-2 rounded-lg border p-3">
            <div className="mb-2 text-sm font-semibold">Etapas do processo</div>
            <div className="space-y-1">
              {steps.length === 0 && <div className="text-xs text-muted-foreground">Nenhuma etapa. Adicione abaixo.</div>}
              {steps.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-md border bg-muted/20 px-2 py-1.5 text-sm">
                  <span className="font-medium">{s.number}.</span>
                  <span className="flex-1 truncate">{s.name}</span>
                  <Badge variant="outline" className="shrink-0">{STEP_TYPE_LABEL[s.type]}</Badge>
                  {s.isControlPoint && <Badge variant="outline" className="shrink-0 border-emerald-300 bg-emerald-50 text-emerald-700">PC</Badge>}
                  {canManage && (
                    <Button variant="ghost" size="sm" onClick={() => removeStep.mutate(s.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {canManage && (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[10rem]"><Label>Nova etapa</Label><Input value={newStep.name} onChange={(e) => setNewStep({ ...newStep, name: e.target.value })} placeholder="Nome da etapa" /></div>
                <NativeSelect className="w-40" value={newStep.type} onChange={(e) => setNewStep({ ...newStep, type: e.target.value as StepType })}>
                  {Object.entries(STEP_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </NativeSelect>
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={newStep.isControlPoint} onChange={(e) => setNewStep({ ...newStep, isControlPoint: e.target.checked })} />PCC</label>
                <Button size="sm" disabled={!newStep.name.trim() || addStep.isPending} onClick={() => addStep.mutate()}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar</Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {canManage && <Button disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Salvando...' : 'Salvar'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------- Perigos / APPCC ----------------------------
function computeRiskClient(matrix: RiskMatrix | undefined, sev: number | null, prob: number | null, det: number | null): { index: number | null; level: RiskLevel | null } {
  if (!matrix || sev == null || prob == null) return { index: null, level: null };
  let index = sev * prob;
  if (matrix.useDetection && det != null) index *= det;
  let level: RiskLevel;
  if (index <= matrix.thresholdLow) level = 'LOW';
  else if (index <= matrix.thresholdModerate) level = 'MODERATE';
  else if (index <= matrix.thresholdHigh) level = 'HIGH';
  else level = 'CRITICAL';
  return { index, level };
}

function PerigosTab({
  hazards,
  loading,
  canManage,
  onNew,
  onEdit,
  onConfig,
}: {
  hazards: Hazard[];
  loading: boolean;
  canManage: boolean;
  onNew: () => void;
  onEdit: (h: Hazard) => void;
  onConfig: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b p-3">
          <div className="text-sm font-semibold">Perigos e análise APPCC</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onConfig}><SlidersHorizontal className="mr-2 h-4 w-4" />Matriz de risco</Button>
            {canManage && <Button size="sm" onClick={onNew}><Plus className="mr-2 h-4 w-4" />Novo perigo</Button>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th className="text-left">Perigo</th>
                <th className="text-left">Categoria</th>
                <th className="text-left">Processo / Etapa</th>
                <th className="text-left">Risco</th>
                <th className="text-left">Controle</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">Carregando...</td></tr>
              ) : hazards.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">Nenhum perigo cadastrado. Use &quot;Novo perigo&quot; para iniciar a análise APPCC.</td></tr>
              ) : (
                hazards.map((h) => (
                  <tr key={h.id}>
                    <td><div className="font-medium">{h.code ? `${h.code} · ` : ''}{h.name}</div><div className="text-xs text-muted-foreground">#{h.number}</div></td>
                    <td>{HAZARD_CATEGORY_LABEL[h.category]}</td>
                    <td className="text-sm">{h.process?.name ?? '—'}{h.step ? ` · ${h.step.name}` : ''}</td>
                    <td>{h.riskLevel ? <span className={cn('rounded px-2 py-0.5 text-xs font-medium', RISK_LEVEL_CLASS[h.riskLevel])}>{RISK_LEVEL_LABEL[h.riskLevel]}{h.riskIndex != null ? ` (${h.riskIndex})` : ''}</span> : <span className="text-xs text-muted-foreground">não avaliado</span>}</td>
                    <td>{h.controlType !== 'NONE' ? <Badge variant="outline">{CONTROL_TYPE_LABEL[h.controlType]}</Badge> : '—'}</td>
                    <td className="text-right"><Button variant="outline" size="sm" onClick={() => onEdit(h)}>{canManage ? 'Abrir' : 'Ver'}</Button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function HazardDialog({
  record,
  processes,
  options,
  matrix,
  canManage,
  onClose,
  onSaved,
}: {
  record: Hazard | null;
  processes: Process[];
  options?: Options;
  matrix?: RiskMatrix;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    processId: record?.processId ?? (processes[0]?.id ?? ''),
    stepId: record?.stepId ?? '',
    category: record?.category ?? ('BIOLOGICAL' as HazardCategory),
    name: record?.name ?? '',
    code: record?.code ?? '',
    source: record?.source ?? '',
    consequence: record?.consequence ?? '',
    justification: record?.justification ?? '',
    severity: record?.severity != null ? String(record.severity) : '',
    probability: record?.probability != null ? String(record.probability) : '',
    detection: record?.detection != null ? String(record.detection) : '',
    controlType: record?.controlType ?? ('NONE' as ControlType),
    controlJustification: record?.controlJustification ?? '',
    existingControls: record?.existingControls ?? '',
    additionalControls: record?.additionalControls ?? '',
    status: record?.status ?? ('OPEN' as HazardStatus),
    responsibleUserId: record?.responsibleUserId ?? '',
  });
  const selectedProcess = processes.find((p) => p.id === form.processId);
  const preview = computeRiskClient(matrix, form.severity ? Number(form.severity) : null, form.probability ? Number(form.probability) : null, form.detection ? Number(form.detection) : null);
  const scale = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        code: form.code || null,
        stepId: form.stepId || null,
        responsibleUserId: form.responsibleUserId || null,
        severity: form.severity || null,
        probability: form.probability || null,
        detection: form.detection || null,
      };
      return record
        ? api(`/food-safety/hazards/${record.id}`, { method: 'PATCH', json: payload })
        : api('/food-safety/hazards', { method: 'POST', json: payload });
    },
    onSuccess: () => { toast.success('Perigo salvo'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{record ? `Perigo #${record.number}` : 'Novo perigo'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label className="field-required">Processo</Label>
            <NativeSelect value={form.processId} onChange={(e) => setForm({ ...form, processId: e.target.value, stepId: '' })} disabled={!canManage || !!record}>
              {processes.map((p) => <option key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ''}{p.name}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label>Etapa (opcional)</Label>
            <NativeSelect value={form.stepId} onChange={(e) => setForm({ ...form, stepId: e.target.value })} disabled={!canManage}>
              <option value="">— processo todo —</option>
              {(selectedProcess?.steps ?? []).map((s) => <option key={s.id} value={s.id}>{s.number}. {s.name}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label>Categoria</Label>
            <NativeSelect value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as HazardCategory })} disabled={!canManage}>
              {(options?.hazardCategories ?? (Object.keys(HAZARD_CATEGORY_LABEL) as HazardCategory[])).map((c) => <option key={c} value={c}>{HAZARD_CATEGORY_LABEL[c]}</option>)}
            </NativeSelect>
          </div>
          <div><Label>Código</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-2"><Label className="field-required">Perigo</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!canManage} placeholder="Ex.: Salmonella spp." /></div>
          <div className="md:col-span-2"><Label>Origem / causa provável</Label><Textarea rows={2} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-2"><Label>Consequência</Label><Textarea rows={2} value={form.consequence} onChange={(e) => setForm({ ...form, consequence: e.target.value })} disabled={!canManage} /></div>

          <div className="rounded-lg border p-3 md:col-span-2">
            <div className="mb-2 text-sm font-semibold">Avaliação de risco</div>
            <div className="flex flex-wrap items-end gap-3">
              <div><Label>Severidade</Label><NativeSelect className="w-24" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} disabled={!canManage}><option value="">—</option>{scale(matrix?.severityScale ?? 5).map((n) => <option key={n} value={n}>{n}</option>)}</NativeSelect></div>
              <div><Label>Probabilidade</Label><NativeSelect className="w-24" value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} disabled={!canManage}><option value="">—</option>{scale(matrix?.probabilityScale ?? 5).map((n) => <option key={n} value={n}>{n}</option>)}</NativeSelect></div>
              {matrix?.useDetection && <div><Label>Detecção</Label><NativeSelect className="w-24" value={form.detection} onChange={(e) => setForm({ ...form, detection: e.target.value })} disabled={!canManage}><option value="">—</option>{scale(matrix?.detectionScale ?? 5).map((n) => <option key={n} value={n}>{n}</option>)}</NativeSelect></div>}
              <div className="ml-auto text-right">
                <div className="text-[11px] uppercase text-muted-foreground">Risco calculado</div>
                {preview.level ? <span className={cn('mt-1 inline-block rounded px-2 py-1 text-sm font-semibold', RISK_LEVEL_CLASS[preview.level])}>{RISK_LEVEL_LABEL[preview.level]} · {preview.index}</span> : <span className="text-sm text-muted-foreground">defina severidade e probabilidade</span>}
              </div>
            </div>
            <div className="mt-2"><Label>Justificativa técnica</Label><Textarea rows={2} value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} disabled={!canManage} /></div>
          </div>

          <div>
            <Label>Classificação do controle</Label>
            <NativeSelect value={form.controlType} onChange={(e) => setForm({ ...form, controlType: e.target.value as ControlType })} disabled={!canManage}>
              <option value="NONE">Não classificado</option>
              <option value="PRP">PPR — Programa de Pré-Requisito</option>
              <option value="OPRP">PPRO — Pré-Requisito Operacional</option>
              <option value="CCP">PCC — Ponto Crítico de Controle</option>
            </NativeSelect>
          </div>
          <div>
            <Label>Status</Label>
            <NativeSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as HazardStatus })} disabled={!canManage}>
              <option value="OPEN">Aberto</option>
              <option value="ASSESSED">Avaliado</option>
              <option value="CONTROLLED">Controlado</option>
              <option value="ARCHIVED">Arquivado</option>
            </NativeSelect>
          </div>
          <div className="md:col-span-2"><Label>Justificativa da classificação (árvore decisória)</Label><Textarea rows={2} value={form.controlJustification} onChange={(e) => setForm({ ...form, controlJustification: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-2"><Label>Controles existentes</Label><Textarea rows={2} value={form.existingControls} onChange={(e) => setForm({ ...form, existingControls: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-2"><Label>Controles adicionais</Label><Textarea rows={2} value={form.additionalControls} onChange={(e) => setForm({ ...form, additionalControls: e.target.value })} disabled={!canManage} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {canManage && <Button disabled={!form.name.trim() || !form.processId || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Salvando...' : 'Salvar'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RiskMatrixDialog({ matrix, canManage, onClose, onSaved }: { matrix?: RiskMatrix; canManage: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: matrix?.name ?? 'Matriz padrão',
    severityScale: String(matrix?.severityScale ?? 5),
    probabilityScale: String(matrix?.probabilityScale ?? 5),
    useDetection: matrix?.useDetection ?? false,
    detectionScale: String(matrix?.detectionScale ?? 5),
    thresholdLow: String(matrix?.thresholdLow ?? 4),
    thresholdModerate: String(matrix?.thresholdModerate ?? 9),
    thresholdHigh: String(matrix?.thresholdHigh ?? 15),
  });
  const save = useMutation({
    mutationFn: () =>
      api('/food-safety/risk-matrix', {
        method: 'PATCH',
        json: {
          name: form.name,
          severityScale: Number(form.severityScale),
          probabilityScale: Number(form.probabilityScale),
          useDetection: form.useDetection,
          detectionScale: Number(form.detectionScale),
          thresholdLow: Number(form.thresholdLow),
          thresholdModerate: Number(form.thresholdModerate),
          thresholdHigh: Number(form.thresholdHigh),
        },
      }),
    onSuccess: () => { toast.success('Matriz de risco salva'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar'),
  });
  const numField = (k: string, label: string) => (
    <div><Label>{label}</Label><Input type="number" min={1} value={String((form as Record<string, unknown>)[k] ?? '')} onChange={(e) => setForm({ ...form, [k]: e.target.value })} disabled={!canManage} /></div>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Matriz de risco</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          Índice = Severidade × Probabilidade{form.useDetection ? ' × Detecção' : ''}. As faixas definem o nível (índice ≤ baixo → Baixo; ≤ moderado → Moderado; ≤ alto → Alto; acima → Crítico).
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!canManage} /></div>
          {numField('severityScale', 'Escala de severidade')}
          {numField('probabilityScale', 'Escala de probabilidade')}
          <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.useDetection} onChange={(e) => setForm({ ...form, useDetection: e.target.checked })} disabled={!canManage} />Usar fator de detecção</label>
          {form.useDetection && numField('detectionScale', 'Escala de detecção')}
          {numField('thresholdLow', 'Limite Baixo (≤)')}
          {numField('thresholdModerate', 'Limite Moderado (≤)')}
          {numField('thresholdHigh', 'Limite Alto (≤)')}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {canManage && <Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Salvando...' : 'Salvar'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------- Monitoramento (PPR/PPRO/PCC) ---------------
function limitText(p: ControlPlan): string {
  const parts: string[] = [];
  if (p.criticalMin != null) parts.push(`≥ ${p.criticalMin}`);
  if (p.criticalMax != null) parts.push(`≤ ${p.criticalMax}`);
  return parts.length ? `${parts.join(' e ')}${p.unit ? ` ${p.unit}` : ''}` : '—';
}

function MonitoramentoTab({
  plans,
  loading,
  canManage,
  hasHazards,
  onNew,
  onEdit,
  onRecord,
}: {
  plans: ControlPlan[];
  loading: boolean;
  canManage: boolean;
  hasHazards: boolean;
  onNew: () => void;
  onEdit: (p: ControlPlan) => void;
  onRecord: (p: ControlPlan) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b p-3">
          <div className="text-sm font-semibold">Monitoramento de controles (PPR / PPRO / PCC)</div>
          {canManage && <Button size="sm" onClick={onNew} disabled={!hasHazards}><Plus className="mr-2 h-4 w-4" />Novo plano</Button>}
        </div>
        {!hasHazards && <div className="border-b bg-amber-50 p-2 text-center text-xs text-amber-700">Cadastre perigos na aba &quot;Perigos / APPCC&quot; antes de criar planos de monitoramento.</div>}
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th className="text-left">Controle</th>
                <th className="text-left">Perigo / Processo</th>
                <th className="text-left">Parâmetro</th>
                <th className="text-left">Limite crítico</th>
                <th className="text-left">Frequência</th>
                <th className="text-left">Registros</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">Carregando...</td></tr>
              ) : plans.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">Nenhum plano de monitoramento. Crie a partir de um perigo classificado (PCC/PPRO).</td></tr>
              ) : (
                plans.map((p) => (
                  <tr key={p.id}>
                    <td><Badge variant="outline">{CONTROL_TYPE_LABEL[p.controlType]}</Badge></td>
                    <td className="text-sm">{p.hazard?.name ?? '—'}<div className="text-xs text-muted-foreground">{p.hazard?.process?.name ?? ''}</div></td>
                    <td>{p.parameter ?? '—'}{p.unit ? ` (${p.unit})` : ''}</td>
                    <td className="text-sm">{p.criticalLimitText ?? limitText(p)}</td>
                    <td className="text-sm">{p.frequency ?? '—'}</td>
                    <td>{p._count?.records ?? 0}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        {canManage && <Button size="sm" onClick={() => onRecord(p)}>Registrar</Button>}
                        <Button variant="outline" size="sm" onClick={() => onEdit(p)}>{canManage ? 'Editar' : 'Ver'}</Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ControlPlanDialog({
  record,
  hazards,
  options,
  canManage,
  onClose,
  onSaved,
}: {
  record: ControlPlan | null;
  hazards: Hazard[];
  options?: Options;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    hazardId: record?.hazardId ?? (hazards[0]?.id ?? ''),
    controlType: (record?.controlType ?? hazards[0]?.controlType ?? 'CCP') as ControlType,
    parameter: record?.parameter ?? '',
    unit: record?.unit ?? '',
    criticalLimitText: record?.criticalLimitText ?? '',
    criticalMin: record?.criticalMin != null ? String(record.criticalMin) : '',
    criticalMax: record?.criticalMax != null ? String(record.criticalMax) : '',
    alertMin: record?.alertMin != null ? String(record.alertMin) : '',
    alertMax: record?.alertMax != null ? String(record.alertMax) : '',
    method: record?.method ?? '',
    instrument: record?.instrument ?? '',
    frequency: record?.frequency ?? '',
    correction: record?.correction ?? '',
    correctiveAction: record?.correctiveAction ?? '',
    requiresLotBlock: record?.requiresLotBlock ?? false,
    requiresNonConformity: record?.requiresNonConformity ?? true,
    responsibleUserId: record?.responsibleUserId ?? '',
    status: (record?.status ?? 'ACTIVE') as ControlPlanStatus,
  });
  const save = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        parameter: form.parameter || null,
        unit: form.unit || null,
        criticalLimitText: form.criticalLimitText || null,
        criticalMin: form.criticalMin || null,
        criticalMax: form.criticalMax || null,
        alertMin: form.alertMin || null,
        alertMax: form.alertMax || null,
        method: form.method || null,
        instrument: form.instrument || null,
        frequency: form.frequency || null,
        correction: form.correction || null,
        correctiveAction: form.correctiveAction || null,
        responsibleUserId: form.responsibleUserId || null,
      };
      return record
        ? api(`/food-safety/control-plans/${record.id}`, { method: 'PATCH', json: payload })
        : api('/food-safety/control-plans', { method: 'POST', json: payload });
    },
    onSuccess: () => { toast.success('Plano de controle salvo'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{record ? 'Plano de controle' : 'Novo plano de controle'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label className="field-required">Perigo</Label>
            <NativeSelect value={form.hazardId} onChange={(e) => { const h = hazards.find((x) => x.id === e.target.value); setForm({ ...form, hazardId: e.target.value, controlType: (h?.controlType ?? form.controlType) as ControlType }); }} disabled={!canManage || !!record}>
              {hazards.map((h) => <option key={h.id} value={h.id}>{h.name}{h.controlType !== 'NONE' ? ` (${CONTROL_TYPE_LABEL[h.controlType]})` : ''}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label>Tipo de controle</Label>
            <NativeSelect value={form.controlType} onChange={(e) => setForm({ ...form, controlType: e.target.value as ControlType })} disabled={!canManage}>
              <option value="PRP">PPR</option>
              <option value="OPRP">PPRO</option>
              <option value="CCP">PCC</option>
            </NativeSelect>
          </div>
          <div><Label>Parâmetro</Label><Input value={form.parameter} onChange={(e) => setForm({ ...form, parameter: e.target.value })} disabled={!canManage} placeholder="Ex.: Temperatura" /></div>
          <div><Label>Unidade</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} disabled={!canManage} placeholder="°C, pH, ppm..." /></div>
          <div className="rounded-lg border p-3 md:col-span-2">
            <div className="mb-2 text-sm font-semibold">Limites</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><Label>Crítico mín.</Label><Input type="number" value={form.criticalMin} onChange={(e) => setForm({ ...form, criticalMin: e.target.value })} disabled={!canManage} /></div>
              <div><Label>Crítico máx.</Label><Input type="number" value={form.criticalMax} onChange={(e) => setForm({ ...form, criticalMax: e.target.value })} disabled={!canManage} /></div>
              <div><Label>Alerta mín.</Label><Input type="number" value={form.alertMin} onChange={(e) => setForm({ ...form, alertMin: e.target.value })} disabled={!canManage} /></div>
              <div><Label>Alerta máx.</Label><Input type="number" value={form.alertMax} onChange={(e) => setForm({ ...form, alertMax: e.target.value })} disabled={!canManage} /></div>
            </div>
            <div className="mt-2"><Label>Limite crítico (texto, opcional)</Label><Input value={form.criticalLimitText} onChange={(e) => setForm({ ...form, criticalLimitText: e.target.value })} disabled={!canManage} placeholder="Ex.: ≥ 72°C por 15s" /></div>
          </div>
          <div><Label>Método de medição</Label><Input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Instrumento</Label><Input value={form.instrument} onChange={(e) => setForm({ ...form, instrument: e.target.value })} disabled={!canManage} /></div>
          <div><Label>Frequência</Label><Input value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} disabled={!canManage} placeholder="Ex.: a cada lote / 2h" /></div>
          <div>
            <Label>Responsável</Label>
            <NativeSelect value={form.responsibleUserId} onChange={(e) => setForm({ ...form, responsibleUserId: e.target.value })} disabled={!canManage}>
              <option value="">—</option>
              {(options?.users ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </NativeSelect>
          </div>
          <div className="md:col-span-2"><Label>Ação imediata no desvio</Label><Textarea rows={2} value={form.correction} onChange={(e) => setForm({ ...form, correction: e.target.value })} disabled={!canManage} /></div>
          <div className="md:col-span-2"><Label>Ação corretiva</Label><Textarea rows={2} value={form.correctiveAction} onChange={(e) => setForm({ ...form, correctiveAction: e.target.value })} disabled={!canManage} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.requiresLotBlock} onChange={(e) => setForm({ ...form, requiresLotBlock: e.target.checked })} disabled={!canManage} />Bloquear lote no desvio</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.requiresNonConformity} onChange={(e) => setForm({ ...form, requiresNonConformity: e.target.checked })} disabled={!canManage} />Abrir NC automática no desvio</label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {canManage && <Button disabled={!form.hazardId || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Salvando...' : 'Salvar'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordDialog({ plan, canManage, onClose, onSaved }: { plan: ControlPlan; canManage: boolean; onClose: () => void; onSaved: () => void }) {
  const [valueNum, setValueNum] = useState('');
  const [valueText, setValueText] = useState('');
  const [notes, setNotes] = useState('');
  const records = useQuery<MonitoringRecord[]>({ queryKey: ['fsms', 'records', plan.id], queryFn: () => api(`/food-safety/control-plans/${plan.id}/records`) });
  const preview = computeResultClient(plan, valueNum ? Number(valueNum) : null);

  const save = useMutation({
    mutationFn: () => api<MonitoringRecord>(`/food-safety/control-plans/${plan.id}/records`, { method: 'POST', json: { valueNum: valueNum || null, valueText: valueText || null, notes: notes || null } }),
    onSuccess: (rec) => {
      if (rec?.result === 'OUT') toast.error('Desvio registrado (fora do limite). Não conformidade aberta automaticamente.');
      else toast.success('Monitoramento registrado');
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao registrar'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Registrar monitoramento — {plan.parameter ?? plan.hazard?.name}</DialogTitle></DialogHeader>
        <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
          <Badge variant="outline" className="mr-2">{CONTROL_TYPE_LABEL[plan.controlType]}</Badge>
          Limite crítico: <span className="font-medium text-foreground">{plan.criticalLimitText ?? limitText(plan)}</span>
          {plan.frequency ? <> · Frequência: {plan.frequency}</> : null}
        </div>
        {canManage && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div><Label>Valor medido</Label><Input type="number" value={valueNum} onChange={(e) => setValueNum(e.target.value)} placeholder={plan.unit ?? ''} /></div>
            <div><Label>Ou valor (texto)</Label><Input value={valueText} onChange={(e) => setValueText(e.target.value)} placeholder="Conforme / Não conforme" /></div>
            <div className="md:col-span-2"><Label>Observações</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <div className="md:col-span-2 flex items-center justify-between rounded-md border p-2">
              <span className="text-xs text-muted-foreground">Resultado previsto</span>
              <span className={cn('rounded px-2 py-1 text-sm font-semibold', RESULT_CLASS[preview])}>{RESULT_LABEL[preview]}</span>
            </div>
            {preview === 'OUT' && plan.requiresNonConformity && <div className="md:col-span-2 text-xs text-rose-600">Ao salvar, será aberta uma não conformidade automaticamente{plan.requiresLotBlock ? ' e o lote será sinalizado para bloqueio' : ''}.</div>}
          </div>
        )}

        <div className="mt-2">
          <div className="mb-1 text-sm font-semibold">Últimos registros</div>
          <div className="max-h-56 overflow-y-auto rounded-md border">
            <table className="table-modern">
              <thead><tr><th className="text-left">Quando</th><th className="text-left">Valor</th><th className="text-left">Resultado</th><th className="text-left">Por</th></tr></thead>
              <tbody>
                {(records.data ?? []).length === 0 ? (
                  <tr><td colSpan={4} className="p-3 text-center text-xs text-muted-foreground">Sem registros ainda.</td></tr>
                ) : (
                  (records.data ?? []).map((r) => (
                    <tr key={r.id}>
                      <td className="text-xs">{formatDate(r.measuredAt)}</td>
                      <td className="text-sm">{r.valueNum ?? r.valueText ?? '—'}</td>
                      <td><span className={cn('rounded px-2 py-0.5 text-xs font-medium', RESULT_CLASS[r.result])}>{RESULT_LABEL[r.result]}</span>{r.lotBlocked ? <span className="ml-1 text-[10px] text-rose-600">lote bloqueado</span> : null}</td>
                      <td className="text-xs">{r.recordedBy?.name ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {canManage && <Button disabled={(!valueNum && !valueText) || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Registrando...' : 'Registrar'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
