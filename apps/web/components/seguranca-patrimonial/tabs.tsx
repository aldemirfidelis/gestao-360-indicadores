'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  CalendarDays,
  CarFront,
  CheckCircle2,
  Clock,
  Compass,
  DoorClosed,
  DoorOpen,
  Download,
  FileCheck,
  FileClock,
  FileText,
  FileUp,
  FileWarning,
  HelpCircle,
  Key,
  KeyRound,
  Laptop,
  LayoutDashboard,
  Maximize2,
  Minimize2,
  Monitor,
  PackageCheck,
  Plus,
  QrCode,
  RadioTower,
  RotateCcw,
  Search,
  Shield,
  Upload,
  UserPlus,
  Users,
  Workflow,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { EmptyState } from '@/components/platform/empty-state';
import { StatusBadge } from '@/components/platform/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { SecurityQrGeneratorSection } from '@/components/asset-security/qr-generator-section';
import { api } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import { useAssetSecurityDashboard } from '@/hooks/asset-security/use-asset-security-dashboard';
import {
  AUTH_STATUS_LABELS,
  CUSTODY_STATUS_LABELS,
  CUSTODY_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  INCIDENT_SEVERITY_LABELS,
  MOVEMENT_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  PACKAGE_STATUS_LABELS,
  PERSON_TYPE_LABELS,
  RECORD_STATUS_LABELS,
  labelFor,
  statusTone,
  toOptions,
} from '@/lib/asset-security/labels';
import { dwellMinutes, formatDateTime, formatDuration } from '@/lib/asset-security/format';
import { averageDwellMinutes, documentCompliance, roundsCompliance } from '@/lib/asset-security/analytics';
import { MovementFlowChart } from '@/components/asset-security/movement-flow-chart';
import { IncidentBreakdownChart } from '@/components/asset-security/incident-breakdown-chart';
import { MovementDetailDialog } from '@/components/asset-security/movement-detail-dialog';
import { AuthorizationDetailDialog } from '@/components/asset-security/authorization-detail-dialog';
import { IncidentsSection } from '@/components/asset-security/incidents-section';
import { RoundsSection } from '@/components/asset-security/rounds-section';
import { ShiftHandoverSection } from '@/components/asset-security/shift-handover-section';
import { CorrespondenceSection } from '@/components/asset-security/correspondence-section';
import { DocumentRequirementsSection } from '@/components/asset-security/document-requirements-section';
import { BlocklistSection } from '@/components/asset-security/blocklist-section';
import { AuditLogSection } from '@/components/asset-security/audit-log-section';
import { OfflineSyncSection } from '@/components/asset-security/offline-sync-section';
import type {
  AnyRecord,
  AssistantInsightsResponse,
  SecurityMovement,
  SecurityOptions,
  SecuritySummary,
} from '@/lib/asset-security/types';
import type { TabKey, DialogField, EntityDialogState } from './types';

import {
  buildOptions,
  personDialog,
  vehicleDialog,
  contractorDialog,
  authorizationDialog,
  incidentDialog,
  custodyDialog,
  loanDialog,
  materialDialog,
  gateDialog,
  postDialog,
  packageDialog,
  type Options,
} from './dialog-configs';

export const TABS: Array<{ key: TabKey; label: string; icon: LucideIcon }> = [
  { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
  { key: 'operation', label: 'Operação', icon: DoorOpen },
  { key: 'people', label: 'Pessoas e Veículos', icon: Users },
  { key: 'authorizations', label: 'Autorizações', icon: QrCode },
  { key: 'rounds', label: 'Rondas e Ocorrências', icon: RadioTower },
  { key: 'assets', label: 'Materiais e Chaves', icon: KeyRound },
  { key: 'settings', label: 'Configurações', icon: PackageCheck },
];

/* ------------------------------- Visão Geral ------------------------------ */

export function OverviewTab({
  summary,
  insights,
  movements,
  incidents,
  roundExecutions,
  totalRecords,
  loading,
  onTab,
}: {
  summary?: SecuritySummary;
  insights?: AssistantInsightsResponse;
  movements: SecurityMovement[];
  incidents: AnyRecord[];
  roundExecutions: AnyRecord[];
  totalRecords: number;
  loading: boolean;
  onTab: (tab: TabKey) => void;
}) {
  const s = summary;
  const docs = documentCompliance(s?.expiredOrInvalidDocuments ?? 0, totalRecords);
  const rounds = useMemo(() => roundsCompliance(roundExecutions), [roundExecutions]);
  const avgDwell = useMemo(() => averageDwellMinutes(movements), [movements]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Pessoas presentes" value={loading ? '…' : formatNumber(s?.peoplePresent ?? 0)} description="Dentro das unidades agora" icon={<Users className="h-4 w-4" />} tone="blue" href="/seguranca-patrimonial?tab=operation" />
        <MetricCard title="Veículos presentes" value={loading ? '…' : formatNumber(s?.vehiclesPresent ?? 0)} description="Com entrada em aberto" icon={<CarFront className="h-4 w-4" />} tone="purple" href="/seguranca-patrimonial?tab=operation" />
        <MetricCard title="Pendências de saída" value={loading ? '…' : formatNumber(s?.pendingExits ?? 0)} description={`${s?.overduePresence ?? 0} com permanência excedida`} icon={<AlertTriangle className="h-4 w-4" />} tone={(s?.overduePresence ?? 0) > 0 ? 'red' : 'yellow'} href="/seguranca-patrimonial?tab=operation" />
        <MetricCard title="Ocorrências abertas" value={loading ? '…' : formatNumber(s?.openIncidents ?? 0)} description={`${s?.criticalIncidents ?? 0} críticas`} icon={<FileWarning className="h-4 w-4" />} tone={(s?.criticalIncidents ?? 0) > 0 ? 'red' : 'neutral'} href="/seguranca-patrimonial?tab=rounds" />
        <MetricCard title="Entradas hoje" value={loading ? '…' : formatNumber(s?.todayEntries ?? 0)} description={`${s?.todayExits ?? 0} saídas no dia`} icon={<DoorOpen className="h-4 w-4" />} tone="green" />
        <MetricCard title="Permanência média" value={loading ? '…' : formatDuration(avgDwell)} description="Movimentações encerradas" icon={<DoorOpen className="h-4 w-4" />} tone="neutral" />
        <MetricCard title="Documentos inválidos" value={loading ? '…' : formatNumber(s?.expiredOrInvalidDocuments ?? 0)} description="Pessoas, empresas ou veículos" icon={<FileWarning className="h-4 w-4" />} tone={(s?.expiredOrInvalidDocuments ?? 0) > 0 ? 'red' : 'neutral'} />
        <MetricCard title="Rondas atrasadas" value={loading ? '…' : formatNumber(s?.lateRounds ?? 0)} description="Atrasadas ou incompletas" icon={<RadioTower className="h-4 w-4" />} tone={(s?.lateRounds ?? 0) > 0 ? 'yellow' : 'neutral'} href="/seguranca-patrimonial?tab=rounds" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Fluxo de acessos (14 dias)" description="Entradas e saídas registradas por dia.">
          <MovementFlowChart movements={movements} />
        </SectionCard>
        <SectionCard title="Ocorrências por severidade" description="Distribuição das ocorrências registradas.">
          <IncidentBreakdownChart incidents={incidents} />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <SectionCard title="Conformidade" description="Indicadores de regularidade operacional.">
          <div className="space-y-4">
            <ComplianceRow bar={docs} />
            <ComplianceRow bar={rounds} />
          </div>
        </SectionCard>

        <SectionCard
          title="IA assistiva"
          description="Recomendações de apoio; decisões críticas continuam humanas."
        >
          <div className="space-y-2">
            {(insights?.insights ?? []).length === 0 && <EmptyState title="Sem sinais" description="Nenhuma recomendação no momento." />}
            {(insights?.insights ?? []).map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-md border p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{item.title}</span>
                  <StatusBadge value={item.severity} label={labelFor(item.severity, INCIDENT_SEVERITY_LABELS)} tone={statusTone(item.severity)} />
                </div>
                <p className="text-xs text-muted-foreground">{item.description}</p>
                <p className="mt-2 text-xs">{item.recommendation}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['operation', DoorOpen, 'Operação em tempo real', 'Registrar entrada/saída, consultar presentes e conciliar pendências.'],
          ['authorizations', QrCode, 'Autorizações e código QR', 'Pré-cadastro, convites externos, aprovação e documentos.'],
          ['rounds', RadioTower, 'Rondas e ocorrências', 'Roteiros, pontos de controle, ocorrências e livro eletrônico.'],
          ['assets', KeyRound, 'Materiais, chaves e crachás', 'Movimentação de bens, empréstimos, devoluções e correspondências.'],
        ].map(([key, Icon, title, desc]) => {
          const I = Icon as LucideIcon;
          return (
            <button key={String(key)} type="button" onClick={() => onTab(key as TabKey)} className="rounded-md border bg-card p-3 text-left transition-colors hover:bg-muted/50">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><I className="h-4 w-4 text-primary" />{String(title)}</div>
              <p className="text-xs leading-relaxed text-muted-foreground">{String(desc)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ComplianceRow({ bar }: { bar: { label: string; ok: number; total: number; percent: number } }) {
  const tone = bar.percent >= 90 ? 'bg-status-green' : bar.percent >= 70 ? 'bg-status-yellow' : 'bg-status-red';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{bar.label}</span>
        <span className="tabular-nums text-muted-foreground">{bar.ok}/{bar.total} · {bar.percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${bar.percent}%` }} />
      </div>
    </div>
  );
}

/* -------------------------------- Operação -------------------------------- */

export function OperationTab({
  present,
  pending,
  gates,
  movements,
  summary,
  incidents,
  roundExecutions,
  authorizations,
  insights,
  loading,
  canOperate,
  optionValues,
  onEntry,
  onExit,
  onDialog,
  onDetail,
  onQr,
  onTab,
}: {
  present: SecurityMovement[];
  pending: SecurityMovement[];
  gates: AnyRecord[];
  movements: SecurityMovement[];
  summary?: any;
  incidents?: any[];
  roundExecutions?: any[];
  authorizations?: any[];
  insights?: any;
  loading: boolean;
  canOperate: boolean;
  optionValues: ReturnType<typeof buildOptions>;
  onEntry: () => void;
  onExit: () => void;
  onDialog: (d: EntityDialogState) => void;
  onDetail: (m: SecurityMovement) => void;
  onQr: () => void;
  onTab: (tab: TabKey) => void;
}) {
  const router = useRouter();
  const [gateId, setGateId] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const [showAllMovements, setShowAllMovements] = useState(false);
  const [showAllPending, setShowAllPending] = useState(false);
  const [showAllIncidents, setShowAllIncidents] = useState(false);
  const filterByGate = (rows: SecurityMovement[]) => (gateId ? rows.filter((r) => r.gate?.id === gateId) : rows);
  
  const presentRows = filterByGate(present);
  const pendingRows = filterByGate(pending);
  const filteredMovements = filterByGate(movements);

  const Root = focusMode ? 'section' : 'div';

  const countPresent = presentRows.length;
  const countPending = pendingRows.length;
  const countAuth = summary?.authorizationsPending ?? 0;
  const countIncidents = summary?.openIncidents ?? incidents?.filter((item) => item.status !== 'RESOLVED').length ?? 0;
  const countRoundsDone = roundExecutions?.filter((item) => item.status === 'COMPLETED').length ?? 0;
  const countRoundsTotal = roundExecutions?.length ?? 0;
  const roundsPercent = countRoundsTotal > 0 ? Math.round((countRoundsDone / countRoundsTotal) * 100) : 0;
  const listIncidents = incidents ?? [];

  return (
    <Root className={cn('space-y-6', focusMode && 'fixed inset-0 z-50 overflow-y-auto bg-[#030712] p-6 lg:p-8 text-slate-100')}>
      
      {/* A. Cabeçalho Dinâmico */}
      <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800/85 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-500 uppercase tracking-wider">
            <span>Segurança Patrimonial</span>
            <span className="text-slate-400 dark:text-slate-650">/</span>
            <span className="text-slate-550 dark:text-slate-400">Operação</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1 text-slate-900 dark:text-white">Segurança Patrimonial</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Controle completo de acessos, rondas e ocorrências em tempo real.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Portaria */}
          <div className="w-52">
            <NativeSelect className="h-9 text-xs" value={gateId} onChange={(e) => setGateId(e.target.value)}>
              <option value="">Todas as portarias</option>
              {gates.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </NativeSelect>
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 bg-card hover:bg-muted" onClick={() => setFocusMode((current) => !current)}>
            {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {focusMode ? 'Sair da tela cheia' : 'Tela cheia'}
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 bg-card hover:bg-muted" onClick={onQr}>
            <QrCode className="h-4 w-4 text-sky-500" />
            QR Code rápido
          </Button>
          <Button size="sm" className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => onDialog(incidentDialog(optionValues))}>
            <Plus className="h-4 w-4" />
            Nova ocorrência
          </Button>
        </div>
      </div>

      {/* B. Cards de Indicadores (KPIs) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* KPI 1: Presentes agora */}
        <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Presentes agora</span>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{countPresent}</div>
              <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                <span>{summary?.todayEntries ?? 0} entradas registradas hoje</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center">
              <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Pendências de saída */}
        <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pendências de saída</span>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{countPending}</div>
              <div className="flex items-center gap-1 text-[10px] text-sky-600 font-bold">
                <span>{summary?.overduePresence ?? 0} permanências excedidas</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-full bg-sky-500/10 dark:bg-sky-500/20 flex items-center justify-center">
              <FileClock className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Autorizações hoje */}
        <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Autorizações pendentes</span>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{countAuth}</div>
              <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                <span>Fila aguardando decisão</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-full bg-cyan-500/10 dark:bg-cyan-500/20 flex items-center justify-center">
              <FileCheck className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Ocorrências ativas */}
        <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Ocorrências ativas</span>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{countIncidents}</div>
              <div className="flex items-center gap-1 text-[10px] text-rose-600 font-bold">
                <span>{summary?.criticalIncidents ?? 0} ocorrências críticas</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-full bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 5: Rondas do dia */}
        <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Rondas do dia</span>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{countRoundsDone} / {countRoundsTotal}</div>
              <div className="flex items-center gap-1 text-[10px] text-violet-600 font-bold">
                <span>{roundsPercent}% concluídas</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-full bg-violet-500/10 dark:bg-violet-500/20 flex items-center justify-center">
              <Compass className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* C. Faixa de Ações Rápidas */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <QuickActionButton disabled={!canOperate} icon={UserPlus} title="Registrar entrada" desc="Pessoa, veículo, material ou carga" onClick={onEntry} tone="green" />
        <QuickActionButton disabled={!canOperate} icon={DoorClosed} title="Registrar saída" desc="Baixa por saída em aberto" onClick={onExit} tone="blue" />
        <QuickActionButton disabled={!canOperate} icon={QrCode} title="Validar QR Code" desc="Convites e autorizações" onClick={onQr} tone="cyan" />
        <QuickActionButton disabled={!canOperate} icon={Compass} title="Iniciar ronda" desc="Ponto de controle" onClick={() => onTab('rounds')} tone="indigo" />
        <QuickActionButton disabled={!canOperate} icon={AlertTriangle} title="Nova ocorrência" desc="Registro de fato relevante" onClick={() => onDialog(incidentDialog(optionValues))} tone="red" />
        <QuickActionButton disabled={!canOperate} icon={Key} title="Material / Chave" desc="Empréstimos e devoluções" onClick={() => onTab('assets')} tone="purple" />
      </div>

      {/* D. Grid Principal de Conteúdo */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Coluna Esquerda: Acessos e Saídas Pendentes */}
        <div className="space-y-6">
          {/* Acessos em tempo real */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[400px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <ArrowRightLeft className="h-4 w-4 text-sky-500" />
                Acessos em tempo real
              </h3>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-sky-500 hover:text-sky-600" onClick={() => setShowAllMovements((current) => !current)}>{showAllMovements ? 'Ver recentes' : 'Ver todos'}</Button>
            </div>
            <CardContent className="p-0 overflow-y-auto flex-1">
              {loading ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Carregando acessos...</div>
              ) : filteredMovements.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center h-full">
                  <Shield className="h-8 w-8 text-slate-350 dark:text-slate-700 mb-2" />
                  Nenhum registro de acesso recente nas últimas portarias.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {(showAllMovements ? filteredMovements : filteredMovements.slice(0, 5)).map((mov) => {
                    const isEntry = mov.status === 'ENTRY' || !mov.exitAt;
                    return (
                      <div key={mov.id} className="flex items-center justify-between p-3 hover:bg-slate-50/40 dark:hover:bg-slate-900/40 transition-all cursor-pointer" onClick={() => onDetail(mov)}>
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={cn(
                            'text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 tracking-wider',
                            isEntry 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                              : 'bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400'
                          )}>
                            {isEntry ? 'ENTRADA' : 'SAÍDA'}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-850 dark:text-slate-200 truncate">
                              {mov.person?.name ?? mov.plate ?? mov.vehicle?.plate ?? 'Anônimo'}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {mov.contractorCompany?.tradeName ?? mov.originCompanyName ?? 'Origem não informada'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div className="text-[10px] font-medium text-slate-700 dark:text-slate-350">
                              {formatTimeOnly(mov.entryAt ?? undefined)}
                            </div>
                            <div className="text-[9px] text-muted-foreground">
                              {mov.gate?.name ?? 'Portaria não informada'}
                            </div>
                          </div>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Sincronizado" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Saídas pendentes */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[300px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <Clock className="h-4 w-4 text-amber-500" />
                Saídas pendentes
              </h3>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-sky-500 hover:text-sky-600" onClick={() => setShowAllPending((current) => !current)}>{showAllPending ? 'Ver recentes' : 'Ver todas'}</Button>
            </div>
            <CardContent className="p-0 overflow-y-auto flex-1">
              {loading ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Carregando pendências...</div>
              ) : pendingRows.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center h-full">
                  <CheckCircle2 className="h-8 w-8 text-slate-350 dark:text-slate-700 mb-2" />
                  Sem pendências de saída abertas.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {(showAllPending ? pendingRows : pendingRows.slice(0, 4)).map((mov) => {
                    const minutesPresent = Math.floor((Date.now() - new Date(mov.entryAt || Date.now()).getTime()) / 60000);
                    return (
                      <div key={mov.id} className="flex items-center justify-between p-3 hover:bg-slate-50/40 dark:hover:bg-slate-900/40 transition-all">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                            {mov.plate ? <CarFront className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-850 dark:text-slate-200 truncate">
                              {mov.person?.name ?? mov.plate ?? mov.vehicle?.plate ?? '—'}
                            </div>
                            <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1.5">
                              <span>Entrada: {formatTimeOnly(mov.entryAt ?? undefined)}</span>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span className={cn(mov.overdue && 'text-red-500 font-bold')}>
                                {minutesPresent > 60 ? `${Math.floor(minutesPresent/60)}h ${minutesPresent%60}m` : `${minutesPresent}m`}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[10px] px-2 text-sky-500 hover:text-sky-655 hover:bg-sky-50/50 dark:hover:bg-sky-950/20 rounded-md border border-sky-100 dark:border-sky-900/40"
                          onClick={() => onExit()}
                        >
                          Saída
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna Central: Mapa de Rondas e Indicadores do Dia */}
        <div className="space-y-6">
          {/* Mapa de Rondas */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[400px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <Compass className="h-4 w-4 text-violet-500" />
                Rondas recentes
              </h3>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-sky-500 hover:text-sky-600" onClick={() => onTab('rounds')}>Abrir operação</Button>
            </div>
            <CardContent className="p-4 flex-1 flex flex-col justify-between">
              <div className="flex-1 min-h-[220px] overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/30">
                {(roundExecutions ?? []).length === 0 ? (
                  <div className="flex h-full min-h-[220px] items-center justify-center p-6 text-center text-xs text-muted-foreground">Nenhuma execução de ronda cadastrada.</div>
                ) : (
                  <div className="divide-y">
                    {(roundExecutions ?? []).slice(0, 8).map((execution) => (
                      <button type="button" key={execution.id} onClick={() => onTab('rounds')} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted/50">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold">{execution.route?.name ?? execution.code ?? 'Ronda'}</div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">{formatDateTime(execution.startedAt ?? execution.scheduledAt)}</div>
                        </div>
                        <StatusBadge value={execution.status} label={String(execution.status)} tone={statusTone(execution.status)} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t pt-3 mt-2 text-[10px] text-slate-500">
                <div className="flex gap-4">
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Concluído</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span>Em andamento</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <span>Pendente</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-[10px] px-2.5 font-medium border-slate-200 dark:border-slate-800 bg-card" onClick={() => onTab('rounds')}>
                  Iniciar ronda
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Indicadores do dia */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[300px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <Workflow className="h-4 w-4 text-emerald-500" />
                Indicadores do dia
              </h3>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-sky-500 hover:text-sky-600" onClick={() => onTab('overview')}>Ver painel completo</Button>
            </div>
            <CardContent className="p-4 flex-1 flex flex-col justify-between gap-3">
              {/* Widget 1: fluxo real do dia */}
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Movimentações do dia</div>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white">{(summary?.todayEntries ?? 0) + (summary?.todayExits ?? 0)}</div>
                  <div className="text-[9px] text-emerald-600 font-bold">{summary?.todayEntries ?? 0} entradas · {summary?.todayExits ?? 0} saídas</div>
                </div>
                <ArrowRightLeft className="h-8 w-8 text-emerald-500" />
              </div>

              {/* Widget 2: Cumprimento de Rondas */}
              <div className="flex items-center justify-between gap-4 border-t pt-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Cumprimento de rondas</div>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white">{roundsPercent}%</div>
                  <div className="text-[9px] text-sky-600 font-bold">{countRoundsDone} de {countRoundsTotal} execuções concluídas</div>
                </div>
                <Compass className="h-8 w-8 text-sky-500" />
              </div>

              {/* Widget 3: Tempo Médio */}
              <div className="flex items-center justify-between gap-4 border-t pt-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Permanência média encerrada</div>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white">{formatDuration(averageDwellMinutes(filteredMovements))}</div>
                  <div className="text-[9px] text-violet-600 font-bold">Calculada pelas movimentações carregadas</div>
                </div>
                <Clock className="h-8 w-8 text-violet-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita: Ocorrências e Documentos */}
        <div className="space-y-6">
          {/* Ocorrências recentes */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[400px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <AlertCircle className="h-4 w-4 text-rose-500" />
                Ocorrências recentes
              </h3>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-sky-500 hover:text-sky-600" onClick={() => setShowAllIncidents((current) => !current)}>{showAllIncidents ? 'Ver recentes' : 'Ver todas'}</Button>
            </div>
            <CardContent className="p-0 overflow-y-auto flex-1">
              {loading ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Carregando ocorrências...</div>
              ) : listIncidents.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center h-full">
                  <CheckCircle2 className="h-8 w-8 text-slate-350 dark:text-slate-700 mb-2" />
                  Sem ocorrências registradas recentemente.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-805 dark:text-slate-200">
                  {(showAllIncidents ? listIncidents : listIncidents.slice(0, 4)).map((inc) => {
                    const isHigh = inc.severity === 'CRITICAL' || inc.severity === 'HIGH';
                    const isMedium = inc.severity === 'MEDIUM';
                    return (
                      <div key={inc.id} className="p-3 hover:bg-slate-50/40 dark:hover:bg-slate-900/40 transition-all flex flex-col gap-1.5 cursor-pointer" onClick={() => onDetail(inc as any)}>
                        <div className="flex items-center justify-between gap-3">
                          <span className={cn(
                            'text-[8px] font-bold px-1.5 py-0.5 rounded-full border shrink-0',
                            isHigh 
                              ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400' 
                              : isMedium 
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' 
                                : 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
                          )}>
                            {isHigh ? 'ALTA' : isMedium ? 'MÉDIA' : 'BAIXA'}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{formatTimeOnly(inc.createdAt)}</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-850 dark:text-slate-150 line-clamp-1">
                          {inc.title}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
                          <span>{inc.location ?? 'Local não informado'}</span>
                          <span className="bg-slate-105 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[9px] text-slate-600 dark:text-slate-400 font-semibold border border-slate-200/40 dark:border-slate-800">
                            {inc.status === 'RESOLVED' ? 'Concluída' : inc.status === 'UNDER_INVESTIGATION' ? 'Em análise' : 'Em andamento'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documentos e autorizações */}
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[300px]">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-850 dark:text-white">
                <FileText className="h-4 w-4 text-sky-500" />
                Documentos e autorizações
              </h3>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-sky-500 hover:text-sky-600" onClick={() => onTab('authorizations')}>Ver todas</Button>
            </div>
            <CardContent className="p-3 flex-1 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between p-2 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 rounded-lg transition-all border border-slate-100/50 dark:border-slate-800/30">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileCheck className="h-4.5 w-4.5 text-rose-500 shrink-0" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-350 truncate">Autorizações vencendo</span>
                </div>
                <span className="h-5 min-w-[20px] px-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                  {summary?.authorizationsPending ?? 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 rounded-lg transition-all border border-slate-100/50 dark:border-slate-800/30">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileWarning className="h-4.5 w-4.5 text-rose-500 shrink-0" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-350 truncate">Documentos expirados</span>
                </div>
                <span className="h-5 min-w-[20px] px-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                  {summary?.expiredOrInvalidDocuments ?? 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 rounded-lg transition-all border border-slate-100/50 dark:border-slate-800/30">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CalendarDays className="h-4.5 w-4.5 text-sky-500 shrink-0" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-350 truncate">Custódias pendentes</span>
                </div>
                <span className="h-5 min-w-[20px] px-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                  {summary?.custodyPending ?? 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* E. Rodapé Operacional */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800/80 pt-4 mt-2 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-500" />
            <span>Última sincronização: <strong>{new Date().toLocaleTimeString()}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-sky-500" />
            <span>Sincronizações offline pendentes: <strong>{summary?.offlinePending ?? 0}</strong></span>
          </div>
          <div className="flex items-center gap-2 cursor-pointer hover:text-sky-500 transition-colors" onClick={onQr}>
            <QrCode className="h-4 w-4 text-sky-400" />
            <span>QR Code da portaria: <strong className="underline decoration-dotted text-sky-500">Abrir leitor</strong></span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900" onClick={() => downloadExport('report')}>
            <FileUp className="h-3.5 w-3.5" />
            Relatório do dia
          </Button>
          <button type="button" onClick={() => router.push('/central-atendimento')} className="h-8 w-8 rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center cursor-pointer shadow-md transition-all hover:scale-105" title="Central de Atendimento">
            <HelpCircle className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

    </Root>
  );
}

// Componentes Helper Internos

interface QuickActionButtonProps {
  icon: LucideIcon;
  title: string;
  desc: string;
  disabled?: boolean;
  onClick: () => void;
  tone: 'green' | 'blue' | 'cyan' | 'indigo' | 'red' | 'purple';
}

function QuickActionButton({ icon: Icon, title, desc, disabled, onClick, tone }: QuickActionButtonProps) {
  const toneClasses = {
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/20 border-emerald-500/10',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 dark:bg-blue-500/20 border-blue-500/10',
    cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 dark:bg-cyan-500/20 border-cyan-500/10',
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 dark:bg-indigo-500/20 border-indigo-500/10',
    red: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 dark:bg-rose-500/20 border-rose-500/10',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 dark:bg-purple-500/20 border-purple-500/10',
  };

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        'border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 flex flex-col items-center text-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md hover:border-slate-200/50 dark:hover:border-slate-800',
        disabled && 'opacity-50 cursor-not-allowed hover:scale-100 hover:shadow-none'
      )}
    >
      <div className={cn('h-9 w-9 rounded-full flex items-center justify-center border', toneClasses[tone])}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="space-y-0.5">
        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{title}</div>
        <div className="text-[9px] text-muted-foreground leading-snug max-w-[120px] mx-auto">{desc}</div>
      </div>
    </button>
  );
}

// Formatador Helper de hora simples
function formatTimeOnly(dateStr?: string | Date): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

/* ---------------------------- Pessoas e Veículos -------------------------- */

export function PeopleTab({ people, vehicles, contractorCompanies, loading, search, setSearch, canCreate, optionValues, onDialog, onChanged }: { people: AnyRecord[]; vehicles: AnyRecord[]; contractorCompanies: AnyRecord[]; loading: boolean; search: string; setSearch: (v: string) => void; canCreate: boolean; optionValues: ReturnType<typeof buildOptions>; onDialog: (d: EntityDialogState) => void; onChanged: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome, documento, placa ou empresa" />
        </div>
        {canCreate && (
          <div className="flex flex-wrap gap-2">
            <ImportPeopleButton onImported={onChanged} />
            <Button onClick={() => onDialog(personDialog(optionValues))}><Plus className="mr-2 h-4 w-4" />Pessoa</Button>
            <Button variant="outline" onClick={() => onDialog(vehicleDialog(optionValues))}><CarFront className="mr-2 h-4 w-4" />Veículo</Button>
            <Button variant="outline" onClick={() => onDialog(contractorDialog())}>Empresa prestadora</Button>
          </div>
        )}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title={`Pessoas cadastradas (${people.length})`} contentClassName="p-0">
          <PeopleTable rows={people} loading={loading} canCreate={canCreate} onDialog={onDialog} optionValues={optionValues} />
        </SectionCard>
        <div className="space-y-4">
          <SectionCard title={`Veículos (${vehicles.length})`} contentClassName="p-0">
            <VehicleTable rows={vehicles} loading={loading} canCreate={canCreate} onDialog={onDialog} optionValues={optionValues} />
          </SectionCard>
          <SectionCard title={`Empresas prestadoras (${contractorCompanies.length})`} contentClassName="p-0">
            <SimpleRows rows={contractorCompanies} primary="tradeName" secondary="legalName" statusKey="documentStatus" statusMap={DOCUMENT_STATUS_LABELS} empty="Nenhuma empresa prestadora." />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function ImportPeopleButton({ onImported }: { onImported: () => void }) {
  const importPeople = useMutation({
    mutationFn: (rows: AnyRecord[]) => api<{ created: number; updated: number; skipped: number }>('/asset-security/people/import', { method: 'POST', json: { rows } }),
    onSuccess: (result) => {
      toast.success(`Importação concluída: ${result.created} criado(s), ${result.updated} atualizado(s), ${result.skipped} ignorado(s).`);
      onImported();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao importar pessoas'),
  });

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<AnyRecord>(sheet, { defval: '' });
      if (rows.length === 0) {
        toast.error('A planilha não possui linhas para importar.');
        return;
      }
      importPeople.mutate(rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao ler planilha');
    }
  }

  return (
    <Button variant="outline" asChild disabled={importPeople.isPending}>
      <label className="cursor-pointer">
        <Upload className="mr-2 h-4 w-4" />
        {importPeople.isPending ? 'Importando...' : 'Importar pessoas'}
        <input className="sr-only" type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
      </label>
    </Button>
  );
}

function PeopleTable({ rows, loading, canCreate, onDialog, optionValues }: { rows: AnyRecord[]; loading: boolean; canCreate: boolean; onDialog: (d: EntityDialogState) => void; optionValues: ReturnType<typeof buildOptions> }) {
  if (loading) return <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (!rows.length) return <EmptyState title="Nenhuma pessoa cadastrada." className="border-0" />;
  return (
    <div className="overflow-x-auto">
      <table className="table-modern">
        <thead><tr><th className="text-left">Nome</th><th className="text-left">Tipo</th><th className="text-left">Documento</th><th className="text-left">Docs</th><th className="text-left">Situação</th><th /></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="font-medium">{row.name}</td>
              <td>{labelFor(row.type, PERSON_TYPE_LABELS)}</td>
              <td>{row.documentMasked ?? '—'}</td>
              <td><StatusBadge value={row.documentStatus} label={labelFor(row.documentStatus, DOCUMENT_STATUS_LABELS)} tone={statusTone(row.documentStatus)} /></td>
              <td><StatusBadge value={row.status} label={labelFor(row.status, RECORD_STATUS_LABELS)} tone={statusTone(row.status)} /></td>
              <td className="text-right">{canCreate && <Button size="sm" variant="ghost" onClick={() => onDialog(personDialog(optionValues, row))}>Editar</Button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VehicleTable({ rows, loading, canCreate, onDialog, optionValues }: { rows: AnyRecord[]; loading: boolean; canCreate: boolean; onDialog: (d: EntityDialogState) => void; optionValues: ReturnType<typeof buildOptions> }) {
  if (loading) return <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (!rows.length) return <EmptyState title="Nenhum veículo cadastrado." className="border-0" />;
  return (
    <div className="overflow-x-auto">
      <table className="table-modern">
        <thead><tr><th className="text-left">Placa</th><th className="text-left">Tipo</th><th className="text-left">Modelo</th><th className="text-left">Docs</th><th /></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="font-medium">{row.plate}</td>
              <td>{row.type}</td>
              <td>{row.model ?? '—'}</td>
              <td><StatusBadge value={row.documentStatus} label={labelFor(row.documentStatus, DOCUMENT_STATUS_LABELS)} tone={statusTone(row.documentStatus)} /></td>
              <td className="text-right">{canCreate && <Button size="sm" variant="ghost" onClick={() => onDialog(vehicleDialog(optionValues, row))}>Editar</Button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------ Autorizações ------------------------------ */

export function AuthorizationsTab({ rows, loading, canCreate, canApprove, optionValues, onDialog, onChanged }: { rows: AnyRecord[]; loading: boolean; canCreate: boolean; canApprove: boolean; optionValues: ReturnType<typeof buildOptions>; onDialog: (d: EntityDialogState) => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<AnyRecord | null>(null);
  const decision = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) => api(`/asset-security/authorizations/${id}/${action}`, { method: 'POST', json: {} }),
    onSuccess: () => { toast.success('Autorização atualizada'); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao atualizar'),
  });
  const pendingStatuses = ['REQUESTED', 'WAITING_APPROVAL', 'WAITING_DOCUMENTS'];
  return (
    <SectionCard
      title={`Autorizações e pré-cadastros (${rows.length})`}
      description="Pré-cadastro, aprovação e convite externo de visitantes/prestadores. Clique para ver o detalhe."
      contentClassName="p-0"
      actions={canCreate && <Button size="sm" onClick={() => onDialog(authorizationDialog(optionValues))}><Plus className="mr-2 h-4 w-4" />Nova autorização</Button>}
    >
      {loading ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Nenhuma autorização." className="border-0" />
      ) : (
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead><tr><th className="text-left">Código</th><th className="text-left">Pessoa</th><th className="text-left">Veículo</th><th className="text-left">Período</th><th className="text-left">Status</th><th className="text-right">Ações</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetail(row)}>
                  <td className="font-medium">{row.code ?? '—'}</td>
                  <td>{row.person?.name ?? '—'}</td>
                  <td>{row.vehicle?.plate ?? '—'}</td>
                  <td className="text-xs">{formatDateTime(row.scheduledStartAt)}<br />{formatDateTime(row.scheduledEndAt)}</td>
                  <td><StatusBadge value={row.status} label={labelFor(row.status, AUTH_STATUS_LABELS)} tone={statusTone(row.status)} /></td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      {canApprove && pendingStatuses.includes(row.status) && <Button size="sm" variant="outline" disabled={decision.isPending} onClick={(e) => { e.stopPropagation(); decision.mutate({ id: row.id, action: 'approve' }); }}>Aprovar</Button>}
                      {canApprove && pendingStatuses.includes(row.status) && <Button size="sm" variant="outline" disabled={decision.isPending} onClick={(e) => { e.stopPropagation(); decision.mutate({ id: row.id, action: 'reject' }); }}>Reprovar</Button>}
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetail(row); }}>Detalhe</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detail && (
        <AuthorizationDetailDialog
          authorization={detail}
          peopleOptions={optionValues.people}
          userOptions={optionValues.users}
          canApprove={canApprove}
          canCreate={canCreate}
          onChanged={onChanged}
          onClose={() => setDetail(null)}
        />
      )}
    </SectionCard>
  );
}

/* --------------------------- Rondas e Ocorrências ------------------------- */

type RoundsSub = 'incidents' | 'rounds' | 'handover' | 'logbook';

export function RoundsTab({ logbook, loading, optionValues, canIncident, canRounds, canHandover }: { logbook: AnyRecord[]; loading: boolean; optionValues: ReturnType<typeof buildOptions>; canIncident: boolean; canRounds: boolean; canHandover: boolean }) {
  const [sub, setSub] = useState<RoundsSub>('incidents');
  const subTabs: Array<{ key: RoundsSub; label: string }> = [
    { key: 'incidents', label: 'Ocorrências' },
    { key: 'rounds', label: 'Rondas' },
    { key: 'handover', label: 'Passagem de turno' },
    { key: 'logbook', label: 'Livro eletrônico' },
  ];
  return (
    <div className="space-y-4">
      <SubTabBar tabs={subTabs} active={sub} onSelect={setSub} />
      {sub === 'incidents' && <IncidentsSection gates={optionValues.gates} posts={optionValues.posts} users={optionValues.users} canIncident={canIncident} />}
      {sub === 'rounds' && <RoundsSection gates={optionValues.gates} users={optionValues.users} canRounds={canRounds} />}
      {sub === 'handover' && <ShiftHandoverSection gates={optionValues.gates} posts={optionValues.posts} users={optionValues.users} canHandover={canHandover} />}
      {sub === 'logbook' && (
        <SectionCard title={`Livro eletrônico (${logbook.length})`} description="Registros e ocorrências do livro de portaria." contentClassName="p-0">
          <SimpleRows rows={logbook} primary="title" secondary="description" statusKey="entryType" empty="Sem registros no livro." loading={loading} />
        </SectionCard>
      )}
    </div>
  );
}

function SubTabBar<T extends string>({ tabs, active, onSelect }: { tabs: Array<{ key: T; label: string }>; active: T; onSelect: (key: T) => void }) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-md border bg-muted/35 p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onSelect(t.key)}
          className={cn('inline-flex h-8 items-center justify-center rounded px-3 text-xs font-medium transition-colors', active === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------- Materiais e Chaves --------------------------- */

type AssetsSub = 'items' | 'correspondence';

export function AssetsTab({ custody, materials, loading, canCreate, canUpdate, optionValues, onDialog, onChanged }: { custody: AnyRecord[]; materials: AnyRecord[]; loading: boolean; canCreate: boolean; canUpdate: boolean; optionValues: ReturnType<typeof buildOptions>; onDialog: (d: EntityDialogState) => void; onChanged: () => void }) {
  const [sub, setSub] = useState<AssetsSub>('items');
  const action = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string }) => api(`/asset-security/custody-items/${id}/${path}`, { method: 'POST', json: {} }),
    onSuccess: () => { toast.success('Item atualizado'); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao atualizar'),
  });
  return (
    <div className="space-y-4">
      <SubTabBar
        tabs={[{ key: 'items' as AssetsSub, label: 'Chaves e materiais' }, { key: 'correspondence' as AssetsSub, label: 'Correspondências' }]}
        active={sub}
        onSelect={setSub}
      />
      {sub === 'correspondence' ? (
        <CorrespondenceSection gates={optionValues.gates} users={optionValues.users} canUpdate={canUpdate} />
      ) : (
    <div className="grid gap-4 xl:grid-cols-2">
      <SectionCard
        title={`Chaves e crachás (${custody.length})`}
        contentClassName="p-0"
        actions={canCreate && <Button size="sm" onClick={() => onDialog(custodyDialog(optionValues))}><Plus className="mr-2 h-4 w-4" />Item</Button>}
      >
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : custody.length === 0 ? (
          <EmptyState title="Nenhum item." className="border-0" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead><tr><th className="text-left">Código</th><th className="text-left">Descrição</th><th className="text-left">Tipo</th><th className="text-left">Status</th><th className="text-right">Ações</th></tr></thead>
              <tbody>
                {custody.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium">{row.code}</td>
                    <td>{row.description}</td>
                    <td>{labelFor(row.itemType, CUSTODY_TYPE_LABELS)}</td>
                    <td><StatusBadge value={row.status} label={labelFor(row.status, CUSTODY_STATUS_LABELS)} tone={statusTone(row.status)} /></td>
                    <td className="text-right">
                      {row.status === 'AVAILABLE'
                        ? <Button size="sm" variant="outline" onClick={() => onDialog(loanDialog(row.id, optionValues))}>Emprestar</Button>
                        : <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ id: row.id, path: 'return' })}>Devolver</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      <SectionCard
        title={`Materiais e cargas (${materials.length})`}
        contentClassName="p-0"
        actions={canCreate && <Button size="sm" variant="outline" onClick={() => onDialog(materialDialog(optionValues))}>Movimentar</Button>}
      >
        <SimpleRows rows={materials} primary="description" secondary="fiscalDocument" statusKey="status" statusMap={MOVEMENT_STATUS_LABELS} empty="Nenhum material movimentado." loading={loading} />
      </SectionCard>
    </div>
      )}
    </div>
  );
}

/* ------------------------------ Configurações ----------------------------- */

type SettingsSub = 'general' | 'documents' | 'blocklist' | 'audit' | 'offline';

export function SettingsTab({ gates, posts, packageConfig, summary, loading, canManage, canBlock, canOffline, optionValues, onDialog }: { gates: AnyRecord[]; posts: AnyRecord[]; packageConfig?: AnyRecord; summary?: SecuritySummary; loading: boolean; canManage: boolean; canBlock: boolean; canOffline: boolean; optionValues: ReturnType<typeof buildOptions>; onDialog: (d: EntityDialogState) => void }) {
  const [sub, setSub] = useState<SettingsSub>('general');
  const { user } = useAuth();
  // O "Pacote comercial" (ativação/licenciamento dos recursos do módulo) é controle de
  // plataforma/comercial — só o Super Admin pode ver/configurar; o usuário final não.
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const subTabs: Array<{ key: SettingsSub; label: string }> = [
    { key: 'general', label: 'Geral' },
    { key: 'documents', label: 'Exigência documental' },
    { key: 'blocklist', label: 'Lista de bloqueio' },
    ...(canManage ? [{ key: 'audit' as SettingsSub, label: 'Auditoria' }] : []),
    ...(canOffline ? [{ key: 'offline' as SettingsSub, label: 'Sem conexão' }] : []),
  ];
  return (
    <div className="space-y-4">
      <SubTabBar tabs={subTabs} active={sub} onSelect={setSub} />

      {sub === 'general' && (
        <div className="space-y-4">
          {isSuperAdmin && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Pacote comercial</h2>
                  <p className="text-sm text-muted-foreground">
                    Status: <span className="font-medium text-foreground">{labelFor(packageConfig?.status ?? 'ENABLED', PACKAGE_STATUS_LABELS)}</span>. Recursos ativos: {(packageConfig?.enabledFeatures ?? []).join(', ') || 'todos'}.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Fila de sincronização sem conexão: {formatNumber(summary?.offlinePending ?? 0)} pendência(s).</p>
                </div>
                <Button variant="outline" onClick={() => onDialog(packageDialog(optionValues, packageConfig))}>Configurar pacote</Button>
              </div>
            </CardContent>
          </Card>
          )}
          {canManage && <SecurityQrGeneratorSection />}
          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard
              title={`Portarias (${gates.length})`}
              contentClassName="p-0"
              actions={canManage && <Button size="sm" onClick={() => onDialog(gateDialog(optionValues))}><Plus className="mr-2 h-4 w-4" />Portaria</Button>}
            >
              <SimpleRows rows={gates} primary="name" secondary="type" statusKey="status" statusMap={RECORD_STATUS_LABELS} empty="Nenhuma portaria." loading={loading} />
            </SectionCard>
            <SectionCard
              title={`Postos de vigilância (${posts.length})`}
              contentClassName="p-0"
              actions={canManage && <Button size="sm" variant="outline" onClick={() => onDialog(postDialog(optionValues))}>Posto</Button>}
            >
              <SimpleRows rows={posts} primary="name" secondary="location" statusKey="criticality" empty="Nenhum posto." loading={loading} />
            </SectionCard>
          </div>
        </div>
      )}

      {sub === 'documents' && <DocumentRequirementsSection canManage={canManage} />}
      {sub === 'blocklist' && <BlocklistSection people={optionValues.people} vehicles={optionValues.vehicles} canBlock={canBlock} />}
      {sub === 'audit' && canManage && <AuditLogSection users={optionValues.users} />}
      {sub === 'offline' && canOffline && <OfflineSyncSection />}
    </div>
  );
}

/* --------------------------------- Shared --------------------------------- */

function SimpleRows({ rows, primary, secondary, statusKey, statusMap, empty, loading }: { rows: AnyRecord[]; primary: string; secondary?: string; statusKey?: string; statusMap?: Record<string, string>; empty: string; loading?: boolean }) {
  if (loading) return <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (!rows.length) return <EmptyState title={empty} className="border-0" />;
  return (
    <div className="divide-y">
      {rows.map((row) => {
        const statusValue = statusKey ? row[statusKey] : null;
        return (
          <div key={row.id} className="flex items-start justify-between gap-3 p-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{row[primary] ?? '—'}</div>
              {secondary && <div className="mt-0.5 truncate text-xs text-muted-foreground">{row[secondary] ?? ''}</div>}
            </div>
            {statusValue && <StatusBadge value={String(statusValue)} label={labelFor(String(statusValue), statusMap)} tone={statusTone(String(statusValue))} />}
          </div>
        );
      })}
    </div>
  );
}

function ActionButton({ icon: Icon, title, text, disabled, onClick }: { icon: LucideIcon; title: string; text: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="rounded-md border bg-card p-4 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50">
      <Icon className="mb-3 h-6 w-6 text-primary" />
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{text}</div>
    </button>
  );
}

/* ----------------------------- Validar QR Code ---------------------------- */


export function isTab(value: string | null): value is TabKey {
  return Boolean(value && TABS.some((tab) => tab.key === value));
}

async function downloadExport(dataset: string) {
  try {
    const result = await api<AnyRecord>(`/asset-security/export?dataset=${dataset}`);
    const blob = new Blob([String(result.content ?? '')], { type: String(result.mimeType ?? 'text/csv;charset=utf-8') });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = String(result.filename ?? 'asset-security.csv');
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (err: any) {
    toast.error(err?.message ?? 'Falha ao exportar');
  }
}
