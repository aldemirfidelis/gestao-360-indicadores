'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BookOpen,
  CarFront,
  CheckCircle2,
  DoorOpen,
  Download,
  FileWarning,
  KeyRound,
  LayoutDashboard,
  PackageCheck,
  Plus,
  QrCode,
  RadioTower,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';

type TabKey = 'overview' | 'operation' | 'people' | 'authorizations' | 'rounds' | 'assets' | 'settings';
type AnyRecord = Record<string, any>;

interface Summary {
  gates: number;
  posts: number;
  peoplePresent: number;
  vehiclesPresent: number;
  todayEntries: number;
  todayExits: number;
  pendingExits: number;
  overduePresence: number;
  expiredOrInvalidDocuments: number;
  authorizationsPending: number;
  openIncidents: number;
  criticalIncidents: number;
  lateRounds: number;
  custodyPending: number;
  correspondenceWaiting: number;
  offlinePending: number;
  activeBlocklistItems: number;
  generatedAt: string;
}

interface Options {
  branches: AnyRecord[];
  orgNodes: AnyRecord[];
  users: AnyRecord[];
  gates: AnyRecord[];
  posts: AnyRecord[];
  people: AnyRecord[];
  contractorCompanies: AnyRecord[];
  vehicles: AnyRecord[];
  roundRoutes: AnyRecord[];
  formTemplates: AnyRecord[];
  packageFeatures: string[];
  gateTypes: string[];
  vehicleTypes: string[];
  recordStatuses: string[];
  personTypes: string[];
  documentStatuses: string[];
  authorizationStatuses: string[];
  incidentSeverities: string[];
  custodyTypes: string[];
  custodyStatuses: string[];
}

interface DialogField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'datetime' | 'select' | 'textarea' | 'checkbox';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  placeholder?: string;
}

interface EntityDialogState {
  title: string;
  method?: 'POST' | 'PATCH';
  path: string;
  fields: DialogField[];
  defaults?: AnyRecord;
  success: string;
}

const TABS: Array<{ key: TabKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'overview', label: 'Visao Geral', icon: LayoutDashboard },
  { key: 'operation', label: 'Operacao', icon: DoorOpen },
  { key: 'people', label: 'Pessoas e Veiculos', icon: Users },
  { key: 'authorizations', label: 'Autorizacoes', icon: QrCode },
  { key: 'rounds', label: 'Rondas e Ocorrencias', icon: RadioTower },
  { key: 'assets', label: 'Materiais e Chaves', icon: KeyRound },
  { key: 'settings', label: 'Configuracoes', icon: PackageCheck },
];

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  REQUESTED: 'bg-amber-100 text-amber-700',
  WAITING_APPROVAL: 'bg-amber-100 text-amber-700',
  WAITING_DOCUMENTS: 'bg-amber-100 text-amber-700',
  OVERDUE: 'bg-rose-100 text-rose-700',
  BLOCKED: 'bg-rose-100 text-rose-700',
  CRITICAL: 'bg-rose-100 text-rose-700',
  EMERGENCY: 'bg-rose-100 text-rose-700',
  CLOSED: 'bg-zinc-100 text-zinc-700',
  DONE: 'bg-emerald-100 text-emerald-700',
};

export default function SegurancaPatrimonialPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['asset-security:create', 'asset-security:manage']);
  const canOperate = hasPermission(['asset-security:entry', 'asset-security:exit', 'asset-security:update']);
  const canApprove = hasPermission(['asset-security:approve', 'asset-security:manage']);
  const canManage = hasPermission(['asset-security:manage']);
  const initialTab = isTab(searchParams.get('tab')) ? (searchParams.get('tab') as TabKey) : 'overview';
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [dialog, setDialog] = useState<EntityDialogState | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const next = isTab(searchParams.get('tab')) ? (searchParams.get('tab') as TabKey) : 'overview';
    setTab(next);
  }, [searchParams]);

  const summary = useQuery<Summary>({ queryKey: ['asset-security', 'summary'], queryFn: () => api('/asset-security/summary') });
  const options = useQuery<Options>({ queryKey: ['asset-security', 'options'], queryFn: () => api('/asset-security/options') });
  const gates = useQuery<AnyRecord[]>({ queryKey: ['asset-security', 'gates'], queryFn: () => api('/asset-security/gates') });
  const posts = useQuery<AnyRecord[]>({ queryKey: ['asset-security', 'posts'], queryFn: () => api('/asset-security/posts') });
  const people = useQuery<AnyRecord[]>({ queryKey: ['asset-security', 'people', search], queryFn: () => api(`/asset-security/people${search ? `?search=${encodeURIComponent(search)}` : ''}`) });
  const vehicles = useQuery<AnyRecord[]>({ queryKey: ['asset-security', 'vehicles', search], queryFn: () => api(`/asset-security/vehicles${search ? `?search=${encodeURIComponent(search)}` : ''}`) });
  const authorizations = useQuery<AnyRecord[]>({ queryKey: ['asset-security', 'authorizations'], queryFn: () => api('/asset-security/authorizations') });
  const present = useQuery<AnyRecord[]>({ queryKey: ['asset-security', 'present'], queryFn: () => api('/asset-security/present?take=200') });
  const pending = useQuery<AnyRecord[]>({ queryKey: ['asset-security', 'pending-exits'], queryFn: () => api('/asset-security/pending-exits?take=200') });
  const incidents = useQuery<AnyRecord[]>({ queryKey: ['asset-security', 'incidents'], queryFn: () => api('/asset-security/incidents') });
  const roundRoutes = useQuery<AnyRecord[]>({ queryKey: ['asset-security', 'round-routes'], queryFn: () => api('/asset-security/round-routes') });
  const custody = useQuery<AnyRecord[]>({ queryKey: ['asset-security', 'custody'], queryFn: () => api('/asset-security/custody-items') });
  const materials = useQuery<AnyRecord[]>({ queryKey: ['asset-security', 'materials'], queryFn: () => api('/asset-security/materials') });
  const logbook = useQuery<AnyRecord[]>({ queryKey: ['asset-security', 'logbook'], queryFn: () => api('/asset-security/logbook') });
  const insights = useQuery<AnyRecord>({ queryKey: ['asset-security', 'assistant-insights'], queryFn: () => api('/asset-security/assistant-insights') });
  const packageConfig = useQuery<AnyRecord>({ queryKey: ['asset-security', 'package'], queryFn: () => api('/asset-security/package'), enabled: canManage });

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ['asset-security'] });
  }

  function selectTab(next: TabKey) {
    setTab(next);
    if (typeof window !== 'undefined') {
      const url = next === 'overview' ? '/seguranca-patrimonial' : `/seguranca-patrimonial?tab=${next}`;
      window.history.replaceState(null, '', url);
    }
  }

  const optionValues = useMemo(() => buildOptions(options.data), [options.data]);

  return (
    <div>
      <PageHeader
        eyebrow="Corporativo"
        tone="admin"
        title="Seguranca Patrimonial e Portarias"
        description="Controle de portarias, acessos, visitantes, prestadores, veiculos, rondas, ocorrencias, chaves, crachas, QR Code e operacao offline."
        breadcrumbs={[{ label: 'Inicio', href: '/' }, { label: 'Seguranca Patrimonial' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {canOperate && <Button onClick={() => setDialog(entryDialog(optionValues))}><DoorOpen className="mr-2 h-4 w-4" />Registrar entrada</Button>}
            {canOperate && <Button variant="outline" onClick={() => setDialog(exitDialog(optionValues))}><CheckCircle2 className="mr-2 h-4 w-4" />Registrar saida</Button>}
            <Button variant="outline" onClick={() => downloadExport('present')}><Download className="mr-2 h-4 w-4" />Presentes</Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1 border-b">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => selectTab(item.key)}
              className={cn('flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors', tab === item.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <OverviewTab summary={summary.data} insights={insights.data} loading={summary.isPending} onTab={selectTab} />
      )}

      {tab === 'operation' && (
        <OperationTab
          present={present.data ?? []}
          pending={pending.data ?? []}
          loading={present.isPending || pending.isPending}
          canOperate={canOperate}
          optionValues={optionValues}
          onDialog={setDialog}
        />
      )}

      {tab === 'people' && (
        <PeopleTab
          people={people.data ?? []}
          vehicles={vehicles.data ?? []}
          contractorCompanies={options.data?.contractorCompanies ?? []}
          loading={people.isPending || vehicles.isPending}
          search={search}
          setSearch={setSearch}
          canCreate={canCreate}
          optionValues={optionValues}
          onDialog={setDialog}
        />
      )}

      {tab === 'authorizations' && (
        <AuthorizationsTab
          rows={authorizations.data ?? []}
          loading={authorizations.isPending}
          canCreate={canCreate}
          canApprove={canApprove}
          optionValues={optionValues}
          onDialog={setDialog}
          onChanged={invalidate}
        />
      )}

      {tab === 'rounds' && (
        <RoundsTab
          incidents={incidents.data ?? []}
          routes={roundRoutes.data ?? []}
          logbook={logbook.data ?? []}
          loading={incidents.isPending || roundRoutes.isPending}
          canCreate={canOperate}
          optionValues={optionValues}
          onDialog={setDialog}
        />
      )}

      {tab === 'assets' && (
        <AssetsTab
          custody={custody.data ?? []}
          materials={materials.data ?? []}
          loading={custody.isPending || materials.isPending}
          canCreate={canOperate}
          optionValues={optionValues}
          onDialog={setDialog}
          onChanged={invalidate}
        />
      )}

      {tab === 'settings' && (
        <SettingsTab
          gates={gates.data ?? []}
          posts={posts.data ?? []}
          packageConfig={packageConfig.data}
          loading={gates.isPending || posts.isPending}
          canManage={canManage}
          optionValues={optionValues}
          onDialog={setDialog}
        />
      )}

      {dialog && <EntityDialog state={dialog} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); invalidate(); }} />}
    </div>
  );
}

function OverviewTab({ summary, insights, loading, onTab }: { summary?: Summary; insights?: AnyRecord; loading: boolean; onTab: (tab: TabKey) => void }) {
  const s = summary;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Pessoas presentes" value={loading ? '...' : formatNumber(s?.peoplePresent ?? 0)} description="Dentro das unidades agora" icon={<Users className="h-4 w-4" />} tone="blue" href="/seguranca-patrimonial?tab=operation" />
        <MetricCard title="Veiculos presentes" value={loading ? '...' : formatNumber(s?.vehiclesPresent ?? 0)} description="Com entrada aberta" icon={<CarFront className="h-4 w-4" />} tone="purple" href="/seguranca-patrimonial?tab=operation" />
        <MetricCard title="Pendencias de saida" value={loading ? '...' : formatNumber(s?.pendingExits ?? 0)} description={`${s?.overduePresence ?? 0} com permanencia excedida`} icon={<AlertTriangle className="h-4 w-4" />} tone={(s?.overduePresence ?? 0) > 0 ? 'red' : 'yellow'} href="/seguranca-patrimonial?tab=operation" />
        <MetricCard title="Ocorrencias abertas" value={loading ? '...' : formatNumber(s?.openIncidents ?? 0)} description={`${s?.criticalIncidents ?? 0} criticas`} icon={<FileWarning className="h-4 w-4" />} tone={(s?.criticalIncidents ?? 0) > 0 ? 'red' : 'neutral'} href="/seguranca-patrimonial?tab=rounds" />
        <MetricCard title="Entradas hoje" value={loading ? '...' : formatNumber(s?.todayEntries ?? 0)} description={`${s?.todayExits ?? 0} saidas no dia`} icon={<DoorOpen className="h-4 w-4" />} tone="green" />
        <MetricCard title="Documentos invalidos" value={loading ? '...' : formatNumber(s?.expiredOrInvalidDocuments ?? 0)} description="Pessoas, empresas ou veiculos" icon={<FileWarning className="h-4 w-4" />} tone={(s?.expiredOrInvalidDocuments ?? 0) > 0 ? 'red' : 'neutral'} />
        <MetricCard title="Rondas atrasadas" value={loading ? '...' : formatNumber(s?.lateRounds ?? 0)} description="Atrasadas ou incompletas" icon={<RadioTower className="h-4 w-4" />} tone={(s?.lateRounds ?? 0) > 0 ? 'yellow' : 'neutral'} href="/seguranca-patrimonial?tab=rounds" />
        <MetricCard title="Fila offline" value={loading ? '...' : formatNumber(s?.offlinePending ?? 0)} description="Pendencias de sincronizacao" icon={<ShieldCheck className="h-4 w-4" />} tone={(s?.offlinePending ?? 0) > 0 ? 'yellow' : 'neutral'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Atalhos operacionais</h2>
                <p className="text-sm text-muted-foreground">Fluxos principais do ciclo cadastro, autorizacao, entrada, permanencia, saida e tratativa.</p>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {[
                ['operation', DoorOpen, 'Operacao em tempo real', 'Registrar entrada/saida, consultar presentes e conciliar pendencias.'],
                ['authorizations', QrCode, 'Autorizacoes e QR Code', 'Pre-cadastro, convites externos, aprovacao e documentos.'],
                ['rounds', RadioTower, 'Rondas e ocorrencias', 'Roteiros, pontos de controle, ocorrencias e livro eletronico.'],
                ['assets', KeyRound, 'Materiais, chaves e crachas', 'Movimentacao de bens, emprestimos, devolucoes e correspondencias.'],
              ].map(([key, Icon, title, desc]) => (
                <button key={String(key)} type="button" onClick={() => onTab(key as TabKey)} className="rounded-md border p-3 text-left transition-colors hover:bg-muted/50">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" />{String(title)}</div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{String(desc)}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h2 className="text-base font-semibold">IA assistiva</h2>
            <p className="mb-3 text-sm text-muted-foreground">Recomendacoes sinalizadas como apoio; decisoes criticas continuam humanas.</p>
            <div className="space-y-2">
              {((insights?.insights as AnyRecord[] | undefined) ?? []).map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-md border p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{item.title}</span>
                    <StatusBadge value={String(item.severity)} />
                  </div>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                  <p className="mt-2 text-xs">{item.recommendation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OperationTab({ present, pending, loading, canOperate, optionValues, onDialog }: { present: AnyRecord[]; pending: AnyRecord[]; loading: boolean; canOperate: boolean; optionValues: ReturnType<typeof buildOptions>; onDialog: (d: EntityDialogState) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <ActionButton disabled={!canOperate} icon={DoorOpen} title="Registrar entrada" text="Pessoa, veiculo, material ou carga" onClick={() => onDialog(entryDialog(optionValues))} />
        <ActionButton disabled={!canOperate} icon={CheckCircle2} title="Registrar saida" text="Baixa por codigo, pessoa ou placa" onClick={() => onDialog(exitDialog(optionValues))} />
        <ActionButton disabled={!canOperate} icon={QrCode} title="Ler QR Code" text="Validar convite ou autorizacao" onClick={() => onDialog(validateQrDialog())} />
        <ActionButton disabled={!canOperate} icon={FileWarning} title="Ocorrencia" text="Registrar fato relevante" onClick={() => onDialog(incidentDialog(optionValues))} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="p-0">
            <TableHeader title="Pessoas e veiculos presentes" count={present.length} />
            <MovementTable rows={present} loading={loading} empty="Nenhuma entrada aberta." />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-0">
            <TableHeader title="Pendencias de saida" count={pending.length} />
            <MovementTable rows={pending} loading={loading} empty="Sem pendencias de saida." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PeopleTab({ people, vehicles, contractorCompanies, loading, search, setSearch, canCreate, optionValues, onDialog }: { people: AnyRecord[]; vehicles: AnyRecord[]; contractorCompanies: AnyRecord[]; loading: boolean; search: string; setSearch: (v: string) => void; canCreate: boolean; optionValues: ReturnType<typeof buildOptions>; onDialog: (d: EntityDialogState) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome, documento, placa ou empresa" />
        </div>
        {canCreate && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onDialog(personDialog(optionValues))}><Plus className="mr-2 h-4 w-4" />Pessoa</Button>
            <Button variant="outline" onClick={() => onDialog(vehicleDialog(optionValues))}><CarFront className="mr-2 h-4 w-4" />Veiculo</Button>
            <Button variant="outline" onClick={() => onDialog(contractorDialog(optionValues))}>Empresa prestadora</Button>
          </div>
        )}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card><CardContent className="p-0"><TableHeader title="Pessoas cadastradas" count={people.length} /><PeopleTable rows={people} loading={loading} /></CardContent></Card>
        <div className="space-y-4">
          <Card><CardContent className="p-0"><TableHeader title="Veiculos" count={vehicles.length} /><VehicleTable rows={vehicles} loading={loading} /></CardContent></Card>
          <Card><CardContent className="p-0"><TableHeader title="Empresas prestadoras" count={contractorCompanies.length} /><SimpleRows rows={contractorCompanies} primary="tradeName" secondary="legalName" status="documentStatus" empty="Nenhuma empresa prestadora." /></CardContent></Card>
        </div>
      </div>
    </div>
  );
}

function AuthorizationsTab({ rows, loading, canCreate, canApprove, optionValues, onDialog, onChanged }: { rows: AnyRecord[]; loading: boolean; canCreate: boolean; canApprove: boolean; optionValues: ReturnType<typeof buildOptions>; onDialog: (d: EntityDialogState) => void; onChanged: () => void }) {
  const decision = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) => api(`/asset-security/authorizations/${id}/${action}`, { method: 'POST', json: {} }),
    onSuccess: () => { toast.success('Autorizacao atualizada'); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao atualizar'),
  });
  const invite = useMutation({
    mutationFn: (id: string) => api<AnyRecord>(`/asset-security/authorizations/${id}/external-invite`, { method: 'POST', json: {} }),
    onSuccess: (data) => { toast.success(`Convite gerado: ${data.publicUrl}`); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao gerar convite'),
  });
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b p-3">
          <TableTitle title="Autorizacoes e pre-cadastros" count={rows.length} />
          {canCreate && <Button size="sm" onClick={() => onDialog(authorizationDialog(optionValues))}><Plus className="mr-2 h-4 w-4" />Nova autorizacao</Button>}
        </div>
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead><tr><th className="text-left">Codigo</th><th className="text-left">Pessoa</th><th className="text-left">Veiculo</th><th className="text-left">Periodo</th><th className="text-left">Status</th><th className="text-right">Acoes</th></tr></thead>
            <tbody>
              {loading ? <LoadingRow colSpan={6} /> : rows.length === 0 ? <EmptyRow colSpan={6} text="Nenhuma autorizacao." /> : rows.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium">{row.code ?? '-'}</td>
                  <td>{row.person?.name ?? '-'}</td>
                  <td>{row.vehicle?.plate ?? '-'}</td>
                  <td className="text-xs">{formatDate(row.scheduledStartAt)}<br />{formatDate(row.scheduledEndAt)}</td>
                  <td><StatusBadge value={row.status} /></td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      {canApprove && ['REQUESTED', 'WAITING_APPROVAL', 'WAITING_DOCUMENTS'].includes(row.status) && <Button size="sm" variant="outline" disabled={decision.isPending} onClick={() => decision.mutate({ id: row.id, action: 'approve' })}>Aprovar</Button>}
                      {canApprove && ['REQUESTED', 'WAITING_APPROVAL', 'WAITING_DOCUMENTS'].includes(row.status) && <Button size="sm" variant="outline" disabled={decision.isPending} onClick={() => decision.mutate({ id: row.id, action: 'reject' })}>Reprovar</Button>}
                      {canCreate && <Button size="sm" variant="ghost" disabled={invite.isPending} onClick={() => invite.mutate(row.id)}>Convite</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function RoundsTab({ incidents, routes, logbook, loading, canCreate, optionValues, onDialog }: { incidents: AnyRecord[]; routes: AnyRecord[]; logbook: AnyRecord[]; loading: boolean; canCreate: boolean; optionValues: ReturnType<typeof buildOptions>; onDialog: (d: EntityDialogState) => void }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b p-3">
            <TableTitle title="Ocorrencias" count={incidents.length} />
            {canCreate && <Button size="sm" onClick={() => onDialog(incidentDialog(optionValues))}><Plus className="mr-2 h-4 w-4" />Ocorrencia</Button>}
          </div>
          <SimpleRows rows={incidents} primary="title" secondary="description" status="severity" empty="Nenhuma ocorrencia." loading={loading} />
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b p-3">
              <TableTitle title="Rotas de ronda" count={routes.length} />
              {canCreate && <Button size="sm" variant="outline" onClick={() => onDialog(roundRouteDialog(optionValues))}>Nova rota</Button>}
            </div>
            <SimpleRows rows={routes} primary="name" secondary="description" status="status" empty="Nenhuma rota." loading={loading} />
          </CardContent>
        </Card>
        <Card><CardContent className="p-0"><TableHeader title="Livro eletronico" count={logbook.length} /><SimpleRows rows={logbook} primary="title" secondary="description" status="entryType" empty="Sem registros no livro." /></CardContent></Card>
      </div>
    </div>
  );
}

function AssetsTab({ custody, materials, loading, canCreate, optionValues, onDialog, onChanged }: { custody: AnyRecord[]; materials: AnyRecord[]; loading: boolean; canCreate: boolean; optionValues: ReturnType<typeof buildOptions>; onDialog: (d: EntityDialogState) => void; onChanged: () => void }) {
  const action = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string }) => api(`/asset-security/custody-items/${id}/${path}`, { method: 'POST', json: {} }),
    onSuccess: () => { toast.success('Item atualizado'); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao atualizar'),
  });
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b p-3">
            <TableTitle title="Chaves e crachas" count={custody.length} />
            {canCreate && <Button size="sm" onClick={() => onDialog(custodyDialog(optionValues))}><Plus className="mr-2 h-4 w-4" />Item</Button>}
          </div>
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead><tr><th className="text-left">Codigo</th><th className="text-left">Descricao</th><th className="text-left">Tipo</th><th className="text-left">Status</th><th className="text-right">Acoes</th></tr></thead>
              <tbody>
                {loading ? <LoadingRow colSpan={5} /> : custody.length === 0 ? <EmptyRow colSpan={5} text="Nenhum item." /> : custody.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium">{row.code}</td><td>{row.description}</td><td>{row.itemType}</td><td><StatusBadge value={row.status} /></td>
                    <td className="text-right">
                      {row.status === 'AVAILABLE' ? <Button size="sm" variant="outline" onClick={() => onDialog(loanDialog(row.id, optionValues))}>Emprestar</Button> : <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ id: row.id, path: 'return' })}>Devolver</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b p-3">
            <TableTitle title="Materiais e cargas" count={materials.length} />
            {canCreate && <Button size="sm" variant="outline" onClick={() => onDialog(materialDialog(optionValues))}>Movimentar</Button>}
          </div>
          <SimpleRows rows={materials} primary="description" secondary="fiscalDocument" status="status" empty="Nenhum material movimentado." loading={loading} />
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsTab({ gates, posts, packageConfig, loading, canManage, optionValues, onDialog }: { gates: AnyRecord[]; posts: AnyRecord[]; packageConfig?: AnyRecord; loading: boolean; canManage: boolean; optionValues: ReturnType<typeof buildOptions>; onDialog: (d: EntityDialogState) => void }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold">Pacote comercial</h2>
              <p className="text-sm text-muted-foreground">Status operacional: <span className="font-medium text-foreground">{packageConfig?.status ?? 'ENABLED'}</span>. Recursos ativos: {(packageConfig?.enabledFeatures ?? []).join(', ') || 'todos'}.</p>
            </div>
            {canManage && <Button variant="outline" onClick={() => onDialog(packageDialog(optionValues, packageConfig))}>Configurar pacote</Button>}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b p-3">
              <TableTitle title="Portarias" count={gates.length} />
              {canManage && <Button size="sm" onClick={() => onDialog(gateDialog(optionValues))}><Plus className="mr-2 h-4 w-4" />Portaria</Button>}
            </div>
            <SimpleRows rows={gates} primary="name" secondary="type" status="status" empty="Nenhuma portaria." loading={loading} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b p-3">
              <TableTitle title="Postos de vigilancia" count={posts.length} />
              {canManage && <Button size="sm" variant="outline" onClick={() => onDialog(postDialog(optionValues))}>Posto</Button>}
            </div>
            <SimpleRows rows={posts} primary="name" secondary="location" status="criticality" empty="Nenhum posto." loading={loading} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EntityDialog({ state, onClose, onSaved }: { state: EntityDialogState; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<AnyRecord>(() => state.defaults ?? {});
  const save = useMutation({
    mutationFn: () => api(state.path, { method: state.method ?? 'POST', json: normalizePayload(form, state.fields) }),
    onSuccess: () => { toast.success(state.success); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar'),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{state.title}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {state.fields.map((field) => (
            <FieldInput key={field.name} field={field} value={form[field.name]} onChange={(value) => setForm((current) => ({ ...current, [field.name]: value }))} />
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button disabled={save.isPending || state.fields.some((f) => f.required && !String(form[f.name] ?? '').trim())} onClick={() => save.mutate()}>{save.isPending ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldInput({ field, value, onChange }: { field: DialogField; value: unknown; onChange: (value: unknown) => void }) {
  const label = <Label className={field.required ? 'field-required' : ''}>{field.label}</Label>;
  if (field.type === 'textarea') return <div className="md:col-span-2">{label}<Textarea rows={3} value={String(value ?? '')} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} /></div>;
  if (field.type === 'select') return <div>{label}<NativeSelect value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}><option value="">-</option>{(field.options ?? []).map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</NativeSelect></div>;
  if (field.type === 'checkbox') return <label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />{field.label}</label>;
  return <div>{label}<Input type={field.type === 'datetime' ? 'datetime-local' : field.type === 'number' ? 'number' : 'text'} value={String(value ?? '')} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} /></div>;
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

function MovementTable({ rows, loading, empty }: { rows: AnyRecord[]; loading: boolean; empty: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="table-modern">
        <thead><tr><th className="text-left">Codigo</th><th className="text-left">Pessoa/placa</th><th className="text-left">Portaria</th><th className="text-left">Entrada</th><th className="text-left">Prev. saida</th><th className="text-left">Status</th></tr></thead>
        <tbody>
          {loading ? <LoadingRow colSpan={6} /> : rows.length === 0 ? <EmptyRow colSpan={6} text={empty} /> : rows.map((row) => (
            <tr key={row.id}>
              <td className="font-medium">{row.code ?? '-'}</td>
              <td>{row.person?.name ?? row.plate ?? row.vehicle?.plate ?? '-'}<div className="text-xs text-muted-foreground">{row.contractorCompany?.tradeName ?? row.originCompanyName ?? ''}</div></td>
              <td>{row.gate?.name ?? '-'}</td>
              <td className="text-xs">{formatDate(row.entryAt)}</td>
              <td className="text-xs">{formatDate(row.expectedExitAt)}</td>
              <td><StatusBadge value={row.overdue ? 'OVERDUE' : row.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeopleTable({ rows, loading }: { rows: AnyRecord[]; loading: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="table-modern">
        <thead><tr><th className="text-left">Nome</th><th className="text-left">Tipo</th><th className="text-left">Documento</th><th className="text-left">Docs</th><th className="text-left">Status</th></tr></thead>
        <tbody>{loading ? <LoadingRow colSpan={5} /> : rows.length === 0 ? <EmptyRow colSpan={5} text="Nenhuma pessoa cadastrada." /> : rows.map((row) => <tr key={row.id}><td className="font-medium">{row.name}</td><td>{row.type}</td><td>{row.documentMasked ?? '-'}</td><td><StatusBadge value={row.documentStatus} /></td><td><StatusBadge value={row.status} /></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function VehicleTable({ rows, loading }: { rows: AnyRecord[]; loading: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="table-modern">
        <thead><tr><th className="text-left">Placa</th><th className="text-left">Tipo</th><th className="text-left">Modelo</th><th className="text-left">Docs</th><th className="text-left">Status</th></tr></thead>
        <tbody>{loading ? <LoadingRow colSpan={5} /> : rows.length === 0 ? <EmptyRow colSpan={5} text="Nenhum veiculo cadastrado." /> : rows.map((row) => <tr key={row.id}><td className="font-medium">{row.plate}</td><td>{row.type}</td><td>{row.model ?? '-'}</td><td><StatusBadge value={row.documentStatus} /></td><td><StatusBadge value={row.status} /></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function SimpleRows({ rows, primary, secondary, status, empty, loading }: { rows: AnyRecord[]; primary: string; secondary?: string; status?: string; empty: string; loading?: boolean }) {
  if (loading) return <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>;
  if (!rows.length) return <div className="p-6 text-center text-sm text-muted-foreground">{empty}</div>;
  return (
    <div className="divide-y">
      {rows.map((row) => (
        <div key={row.id} className="flex items-start justify-between gap-3 p-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{row[primary] ?? '-'}</div>
            {secondary && <div className="mt-0.5 truncate text-xs text-muted-foreground">{row[secondary] ?? ''}</div>}
          </div>
          {status && <StatusBadge value={String(row[status] ?? '-')} />}
        </div>
      ))}
    </div>
  );
}

function TableHeader({ title, count }: { title: string; count: number }) {
  return <div className="border-b p-3"><TableTitle title={title} count={count} /></div>;
}

function TableTitle({ title, count }: { title: string; count: number }) {
  return <div className="text-sm font-semibold">{title} <span className="text-xs font-normal text-muted-foreground">({count})</span></div>;
}

function StatusBadge({ value }: { value?: string | null }) {
  const text = value || '-';
  return <span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-medium', STATUS_CLASS[text] ?? 'bg-muted text-muted-foreground')}>{text}</span>;
}

function LoadingRow({ colSpan }: { colSpan: number }) {
  return <tr><td colSpan={colSpan} className="p-6 text-center text-sm text-muted-foreground">Carregando...</td></tr>;
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return <tr><td colSpan={colSpan} className="p-6 text-center text-sm text-muted-foreground">{text}</td></tr>;
}

function buildOptions(data?: Options) {
  const map = (rows: AnyRecord[] | undefined, labelKey = 'name') => (rows ?? []).map((row) => ({ value: row.id, label: row[labelKey] ?? row.name ?? row.code ?? row.id }));
  return {
    gates: map(data?.gates),
    posts: map(data?.posts),
    people: map(data?.people),
    vehicles: (data?.vehicles ?? []).map((row) => ({ value: row.id, label: `${row.plate}${row.model ? ` - ${row.model}` : ''}` })),
    contractorCompanies: (data?.contractorCompanies ?? []).map((row) => ({ value: row.id, label: row.tradeName ?? row.legalName })),
    users: map(data?.users),
    orgNodes: map(data?.orgNodes),
    branches: map(data?.branches),
    formTemplates: (data?.formTemplates ?? []).map((row) => ({ value: row.id, label: row.title ?? row.code })),
    gateTypes: (data?.gateTypes ?? []).map((value) => ({ value, label: value })),
    vehicleTypes: (data?.vehicleTypes ?? []).map((value) => ({ value, label: value })),
    personTypes: (data?.personTypes ?? []).map((value) => ({ value, label: value })),
    documentStatuses: (data?.documentStatuses ?? []).map((value) => ({ value, label: value })),
    recordStatuses: (data?.recordStatuses ?? []).map((value) => ({ value, label: value })),
    authorizationStatuses: (data?.authorizationStatuses ?? []).map((value) => ({ value, label: value })),
    incidentSeverities: (data?.incidentSeverities ?? []).map((value) => ({ value, label: value })),
    custodyTypes: (data?.custodyTypes ?? []).map((value) => ({ value, label: value })),
    custodyStatuses: (data?.custodyStatuses ?? []).map((value) => ({ value, label: value })),
    packageFeatures: (data?.packageFeatures ?? []).map((value) => ({ value, label: value })),
  };
}

function entryDialog(options: ReturnType<typeof buildOptions>): EntityDialogState {
  return { title: 'Registrar entrada', path: '/asset-security/movements/entry', success: 'Entrada registrada', fields: [
    { name: 'gateId', label: 'Portaria', type: 'select', options: options.gates, required: true },
    { name: 'postId', label: 'Posto', type: 'select', options: options.posts },
    { name: 'personId', label: 'Pessoa', type: 'select', options: options.people },
    { name: 'vehicleId', label: 'Veiculo', type: 'select', options: options.vehicles },
    { name: 'authorizationId', label: 'Autorizacao', type: 'text', placeholder: 'ID/codigo aprovado' },
    { name: 'reason', label: 'Motivo' },
    { name: 'destinationAreaId', label: 'Area de destino', type: 'select', options: options.orgNodes },
    { name: 'expectedExitAt', label: 'Previsao de saida', type: 'datetime' },
    { name: 'exceptionJustification', label: 'Justificativa de excecao', type: 'textarea' },
    { name: 'notes', label: 'Observacoes', type: 'textarea' },
  ] };
}

function exitDialog(options: ReturnType<typeof buildOptions>): EntityDialogState {
  return { title: 'Registrar saida', path: '/asset-security/movements/exit', success: 'Saida registrada', fields: [
    { name: 'id', label: 'ID da entrada aberta' },
    { name: 'personId', label: 'Pessoa', type: 'select', options: options.people },
    { name: 'vehicleId', label: 'Veiculo', type: 'select', options: options.vehicles },
    { name: 'plate', label: 'Placa' },
    { name: 'code', label: 'Codigo da movimentacao' },
    { name: 'notes', label: 'Observacoes', type: 'textarea' },
  ] };
}

function validateQrDialog(): EntityDialogState {
  return { title: 'Validar QR Code', path: '/asset-security/qrcodes', success: 'QR Code registrado/validado', fields: [
    { name: 'entityType', label: 'Entidade', required: true, placeholder: 'SecurityAuthorization' },
    { name: 'entityId', label: 'ID da entidade', required: true },
    { name: 'purpose', label: 'Finalidade', required: true, placeholder: 'AUTHORIZATION' },
    { name: 'expiresAt', label: 'Expira em', type: 'datetime' },
  ] };
}

function personDialog(options: ReturnType<typeof buildOptions>): EntityDialogState {
  return { title: 'Cadastrar pessoa', path: '/asset-security/people', success: 'Pessoa cadastrada', fields: [
    { name: 'name', label: 'Nome', required: true },
    { name: 'type', label: 'Tipo', type: 'select', options: options.personTypes, required: true },
    { name: 'documentType', label: 'Tipo de documento' },
    { name: 'documentNumber', label: 'Documento' },
    { name: 'contractorCompanyId', label: 'Empresa prestadora', type: 'select', options: options.contractorCompanies },
    { name: 'originCompanyName', label: 'Empresa/origem' },
    { name: 'phone', label: 'Telefone' },
    { name: 'email', label: 'E-mail' },
    { name: 'documentStatus', label: 'Status documental', type: 'select', options: options.documentStatuses },
    { name: 'notes', label: 'Observacoes', type: 'textarea' },
  ], defaults: { type: 'VISITOR', documentStatus: 'NOT_REQUIRED' } };
}

function vehicleDialog(options: ReturnType<typeof buildOptions>): EntityDialogState {
  return { title: 'Cadastrar veiculo', path: '/asset-security/vehicles', success: 'Veiculo cadastrado', fields: [
    { name: 'plate', label: 'Placa', required: true },
    { name: 'type', label: 'Tipo', type: 'select', options: options.vehicleTypes, required: true },
    { name: 'model', label: 'Modelo' },
    { name: 'brand', label: 'Marca' },
    { name: 'color', label: 'Cor' },
    { name: 'ownerName', label: 'Proprietario' },
    { name: 'companyName', label: 'Empresa' },
    { name: 'documentStatus', label: 'Status documental', type: 'select', options: options.documentStatuses },
  ], defaults: { type: 'Carro', documentStatus: 'NOT_REQUIRED' } };
}

function contractorDialog(_options: ReturnType<typeof buildOptions>): EntityDialogState {
  return { title: 'Cadastrar empresa prestadora', path: '/asset-security/contractor-companies', success: 'Empresa cadastrada', fields: [
    { name: 'legalName', label: 'Razao social', required: true },
    { name: 'tradeName', label: 'Nome fantasia' },
    { name: 'cnpj', label: 'CNPJ' },
    { name: 'contractCode', label: 'Contrato' },
    { name: 'serviceTypes', label: 'Servicos (separados por virgula)' },
    { name: 'documentStatus', label: 'Status documental', type: 'select', options: ['VALID', 'EXPIRING', 'EXPIRED', 'MISSING', 'IN_REVIEW', 'REJECTED', 'BLOCKED'].map((value) => ({ value, label: value })) },
    { name: 'notes', label: 'Observacoes', type: 'textarea' },
  ], defaults: { documentStatus: 'MISSING' } };
}

function authorizationDialog(options: ReturnType<typeof buildOptions>): EntityDialogState {
  return { title: 'Nova autorizacao', path: '/asset-security/authorizations', success: 'Autorizacao criada', fields: [
    { name: 'personId', label: 'Pessoa', type: 'select', options: options.people },
    { name: 'vehicleId', label: 'Veiculo', type: 'select', options: options.vehicles },
    { name: 'contractorCompanyId', label: 'Empresa prestadora', type: 'select', options: options.contractorCompanies },
    { name: 'gateId', label: 'Portaria', type: 'select', options: options.gates },
    { name: 'destinationAreaId', label: 'Area de destino', type: 'select', options: options.orgNodes },
    { name: 'internalResponsibleId', label: 'Responsavel interno', type: 'select', options: options.users },
    { name: 'scheduledStartAt', label: 'Inicio previsto', type: 'datetime' },
    { name: 'scheduledEndAt', label: 'Fim previsto', type: 'datetime' },
    { name: 'reason', label: 'Motivo', type: 'textarea' },
  ] };
}

function incidentDialog(options: ReturnType<typeof buildOptions>): EntityDialogState {
  return { title: 'Registrar ocorrencia', path: '/asset-security/incidents', success: 'Ocorrencia registrada', fields: [
    { name: 'title', label: 'Titulo', required: true },
    { name: 'type', label: 'Tipo' },
    { name: 'severity', label: 'Criticidade', type: 'select', options: options.incidentSeverities, required: true },
    { name: 'gateId', label: 'Portaria', type: 'select', options: options.gates },
    { name: 'postId', label: 'Posto', type: 'select', options: options.posts },
    { name: 'responsibleUserId', label: 'Responsavel', type: 'select', options: options.users },
    { name: 'dueAt', label: 'Prazo', type: 'datetime' },
    { name: 'description', label: 'Descricao', type: 'textarea' },
    { name: 'immediateAction', label: 'Acao imediata', type: 'textarea' },
  ], defaults: { severity: 'MEDIUM' } };
}

function roundRouteDialog(options: ReturnType<typeof buildOptions>): EntityDialogState {
  return { title: 'Nova rota de ronda', path: '/asset-security/round-routes', success: 'Rota criada', fields: [
    { name: 'name', label: 'Nome', required: true },
    { name: 'code', label: 'Codigo' },
    { name: 'gateId', label: 'Portaria', type: 'select', options: options.gates },
    { name: 'responsibleUserId', label: 'Responsavel', type: 'select', options: options.users },
    { name: 'frequencyMinutes', label: 'Frequencia (min)', type: 'number' },
    { name: 'toleranceMinutes', label: 'Tolerancia (min)', type: 'number' },
    { name: 'instructions', label: 'Instrucoes', type: 'textarea' },
  ] };
}

function custodyDialog(options: ReturnType<typeof buildOptions>): EntityDialogState {
  return { title: 'Cadastrar chave ou cracha', path: '/asset-security/custody-items', success: 'Item cadastrado', fields: [
    { name: 'code', label: 'Codigo', required: true },
    { name: 'description', label: 'Descricao', required: true },
    { name: 'itemType', label: 'Tipo', type: 'select', options: options.custodyTypes, required: true },
    { name: 'gateId', label: 'Portaria', type: 'select', options: options.gates },
    { name: 'location', label: 'Localizacao' },
    { name: 'status', label: 'Status', type: 'select', options: options.custodyStatuses },
  ], defaults: { itemType: 'KEY', status: 'AVAILABLE' } };
}

function loanDialog(id: string, options: ReturnType<typeof buildOptions>): EntityDialogState {
  return { title: 'Emprestar item', path: `/asset-security/custody-items/${id}/loan`, success: 'Item emprestado', fields: [
    { name: 'holderPersonId', label: 'Pessoa', type: 'select', options: options.people, required: true },
    { name: 'expectedReturnAt', label: 'Previsao de devolucao', type: 'datetime' },
    { name: 'purpose', label: 'Finalidade' },
    { name: 'notes', label: 'Observacoes', type: 'textarea' },
  ] };
}

function materialDialog(options: ReturnType<typeof buildOptions>): EntityDialogState {
  return { title: 'Movimentar material/carga', path: '/asset-security/materials', success: 'Movimentacao registrada', fields: [
    { name: 'description', label: 'Descricao', required: true },
    { name: 'type', label: 'Tipo', type: 'select', options: ['MATERIAL_ENTRY', 'MATERIAL_EXIT', 'EQUIPMENT_ENTRY', 'EQUIPMENT_EXIT', 'CARGO', 'UNLOADING'].map((value) => ({ value, label: value })) },
    { name: 'quantity', label: 'Quantidade', type: 'number' },
    { name: 'unit', label: 'Unidade' },
    { name: 'vehicleId', label: 'Veiculo', type: 'select', options: options.vehicles },
    { name: 'fiscalDocument', label: 'Nota/documento' },
    { name: 'alertCode', label: 'Alerta' },
    { name: 'notes', label: 'Observacoes', type: 'textarea' },
  ], defaults: { type: 'MATERIAL_ENTRY' } };
}

function gateDialog(options: ReturnType<typeof buildOptions>): EntityDialogState {
  return { title: 'Cadastrar portaria', path: '/asset-security/gates', success: 'Portaria cadastrada', fields: [
    { name: 'name', label: 'Nome', required: true },
    { name: 'code', label: 'Codigo' },
    { name: 'type', label: 'Tipo', type: 'select', options: options.gateTypes, required: true },
    { name: 'branchId', label: 'Filial', type: 'select', options: options.branches },
    { name: 'unitId', label: 'Unidade', type: 'select', options: options.orgNodes },
    { name: 'address', label: 'Endereco' },
    { name: 'location', label: 'Localizacao' },
    { name: 'notes', label: 'Observacoes', type: 'textarea' },
  ], defaults: { type: 'Portaria Principal' } };
}

function postDialog(options: ReturnType<typeof buildOptions>): EntityDialogState {
  return { title: 'Cadastrar posto', path: '/asset-security/posts', success: 'Posto cadastrado', fields: [
    { name: 'name', label: 'Nome', required: true },
    { name: 'code', label: 'Codigo' },
    { name: 'gateId', label: 'Portaria', type: 'select', options: options.gates },
    { name: 'unitId', label: 'Unidade', type: 'select', options: options.orgNodes },
    { name: 'criticality', label: 'Criticidade', type: 'select', options: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => ({ value, label: value })) },
    { name: 'responsibleUserId', label: 'Responsavel', type: 'select', options: options.users },
    { name: 'location', label: 'Localizacao' },
    { name: 'instructions', label: 'Instrucoes', type: 'textarea' },
  ], defaults: { criticality: 'MEDIUM' } };
}

function packageDialog(options: ReturnType<typeof buildOptions>, current?: AnyRecord): EntityDialogState {
  return { title: 'Configurar pacote comercial', path: '/asset-security/package', method: 'PATCH', success: 'Pacote configurado', defaults: { status: current?.status ?? 'ENABLED', enabledFeatures: (current?.enabledFeatures ?? []).join(',') }, fields: [
    { name: 'status', label: 'Status', type: 'select', options: ['ENABLED', 'DISABLED', 'TRIAL', 'READ_ONLY', 'BLOCKED', 'EXPIRED'].map((value) => ({ value, label: value })) },
    { name: 'unitId', label: 'Unidade', type: 'select', options: options.orgNodes },
    { name: 'enabledFeatures', label: 'Recursos ativos (separados por virgula)', placeholder: 'GATES,VISITORS,QR_CODE,OFFLINE_APP' },
    { name: 'commercialPlanCode', label: 'Plano comercial' },
    { name: 'trialEndsAt', label: 'Fim do teste', type: 'datetime' },
    { name: 'blockReason', label: 'Motivo de bloqueio', type: 'textarea' },
  ] };
}

function normalizePayload(form: AnyRecord, fields: DialogField[]) {
  const payload: AnyRecord = {};
  for (const field of fields) {
    const value = form[field.name];
    if (field.type === 'checkbox') payload[field.name] = Boolean(value);
    else if (field.type === 'number') payload[field.name] = value === '' || value === undefined ? null : Number(value);
    else if (field.name.endsWith('Ids') || field.name === 'enabledFeatures' || field.name === 'serviceTypes') payload[field.name] = String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
    else payload[field.name] = value === '' || value === undefined ? null : value;
  }
  return payload;
}

function isTab(value: string | null): value is TabKey {
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
