'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CarFront,
  CheckCircle2,
  DoorOpen,
  Download,
  FileWarning,
  KeyRound,
  LayoutDashboard,
  Maximize2,
  Minimize2,
  PackageCheck,
  Plus,
  QrCode,
  RadioTower,
  Search,
  Upload,
  Users,
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
  const rounds = roundsCompliance(roundExecutions);
  const avgDwell = averageDwellMinutes(movements);

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
  loading,
  canOperate,
  optionValues,
  onEntry,
  onExit,
  onDialog,
  onDetail,
  onQr,
}: {
  present: SecurityMovement[];
  pending: SecurityMovement[];
  gates: AnyRecord[];
  loading: boolean;
  canOperate: boolean;
  optionValues: ReturnType<typeof buildOptions>;
  onEntry: () => void;
  onExit: () => void;
  onDialog: (d: EntityDialogState) => void;
  onDetail: (m: SecurityMovement) => void;
  onQr: () => void;
}) {
  const [gateId, setGateId] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const filterByGate = (rows: SecurityMovement[]) => (gateId ? rows.filter((r) => r.gate?.id === gateId) : rows);
  const presentRows = filterByGate(present);
  const pendingRows = filterByGate(pending);
  const Root = focusMode ? 'section' : 'div';

  return (
    <Root className={cn('space-y-4', focusMode && 'fixed inset-0 z-40 overflow-y-auto bg-background p-4 lg:p-6')}>
      <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Operação de Portaria</h2>
          <p className="text-sm text-muted-foreground">Visão focal de entradas, saídas e pendências abertas.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setFocusMode((current) => !current)}>
          {focusMode ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
          {focusMode ? 'Sair da tela cheia' : 'Tela cheia'}
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <ActionButton disabled={!canOperate} icon={DoorOpen} title="Registrar entrada" text="Pessoa, veículo, material ou carga" onClick={onEntry} />
        <ActionButton disabled={!canOperate} icon={CheckCircle2} title="Registrar saída" text="Baixa por entrada em aberto" onClick={onExit} />
        <ActionButton disabled={!canOperate} icon={QrCode} title="Validar código QR" text="Conferir convite ou autorização" onClick={onQr} />
        <ActionButton disabled={!canOperate} icon={FileWarning} title="Ocorrência" text="Registrar fato relevante" onClick={() => onDialog(incidentDialog(optionValues))} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="sm:w-72">
          <NativeSelect value={gateId} onChange={(e) => setGateId(e.target.value)}>
            <option value="">Todas as portarias</option>
            {gates.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </NativeSelect>
        </div>
        <Button variant="outline" size="sm" onClick={() => downloadExport('present')}><Download className="mr-2 h-4 w-4" />Exportar presentes</Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title={`Presentes (${presentRows.length})`} description="Pessoas e veículos com entrada em aberto." contentClassName="p-0">
          <MovementTable rows={presentRows} loading={loading} empty="Nenhuma entrada em aberto." onDetail={onDetail} />
        </SectionCard>
        <SectionCard title={`Pendências de saída (${pendingRows.length})`} description="Sem saída registrada ou previsão excedida." contentClassName="p-0">
          <MovementTable rows={pendingRows} loading={loading} empty="Sem pendências de saída." onDetail={onDetail} />
        </SectionCard>
      </div>
    </Root>
  );
}

function MovementTable({ rows, loading, empty, onDetail }: { rows: SecurityMovement[]; loading: boolean; empty: string; onDetail: (m: SecurityMovement) => void }) {
  if (loading) return <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (!rows.length) return <EmptyState title={empty} className="border-0" />;
  return (
    <div className="overflow-x-auto">
      <table className="table-modern">
        <thead>
          <tr>
            <th className="text-left">Código</th>
            <th className="text-left">Pessoa / placa</th>
            <th className="text-left">Portaria</th>
            <th className="text-left">Entrada</th>
            <th className="text-left">Permanência</th>
            <th className="text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const dwell = dwellMinutes(row.entryAt, row.exitAt);
            return (
              <tr key={row.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onDetail(row)}>
                <td className="font-medium">{row.code ?? '—'}</td>
                <td>
                  {row.person?.name ?? row.plate ?? row.vehicle?.plate ?? '—'}
                  <div className="text-xs text-muted-foreground">{row.contractorCompany?.tradeName ?? row.originCompanyName ?? ''}</div>
                </td>
                <td>{row.gate?.name ?? '—'}</td>
                <td className="text-xs">{formatDateTime(row.entryAt)}</td>
                <td className={cn('text-xs tabular-nums', row.overdue && 'font-semibold text-status-red')}>{formatDuration(dwell)}</td>
                <td><StatusBadge value={row.overdue ? 'OVERDUE' : row.status} label={row.overdue ? 'Excedida' : labelFor(row.status, MOVEMENT_STATUS_LABELS)} tone={row.overdue ? 'red' : statusTone(row.status)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
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
                {canManage && <Button variant="outline" onClick={() => onDialog(packageDialog(optionValues, packageConfig))}>Configurar pacote</Button>}
              </div>
            </CardContent>
          </Card>
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
