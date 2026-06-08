'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  ClipboardList,
  Layers3,
  ListChecks,
  Network,
  Plus,
  ShieldCheck,
  Trash2,
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
import { api } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';

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
}

interface Options {
  orgNodes: OrgRef[];
  users: UserRef[];
  programStatuses: ProgramStatus[];
  processStatuses: ProcessStatus[];
  stepTypes: StepType[];
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

type TabKey = 'overview' | 'processes' | 'flow' | 'matrix';
const TABS: Array<{ key: TabKey; label: string; icon: typeof Network }> = [
  { key: 'overview', label: 'Visão Geral', icon: ShieldCheck },
  { key: 'processes', label: 'Processos', icon: ListChecks },
  { key: 'flow', label: 'Fluxograma', icon: Workflow },
  { key: 'matrix', label: 'Matriz Geral', icon: Layers3 },
];

// ----------------------------- página -------------------------------------
export default function SegurancaAlimentosPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['fsms:create', 'fsms:update', 'fsms:manage']);
  const [tab, setTab] = useState<TabKey>('overview');
  const [programId, setProgramId] = useState<string>('');
  const [programDialog, setProgramDialog] = useState<Program | 'new' | null>(null);
  const [processDialog, setProcessDialog] = useState<Process | 'new' | null>(null);

  const programs = useQuery<Program[]>({ queryKey: ['fsms', 'programs'], queryFn: () => api('/food-safety/programs') });
  const options = useQuery<Options>({ queryKey: ['fsms', 'options'], queryFn: () => api('/food-safety/options') });

  useEffect(() => {
    const rows = programs.data ?? [];
    if (rows.length && !rows.some((p) => p.id === programId)) setProgramId(rows[0].id);
  }, [programs.data, programId]);

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

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ['fsms'] });
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
          {/* abas */}
          <div className="mb-4 flex flex-wrap gap-1 border-b">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                    tab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

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
          {tab === 'flow' && (
            <FlowTab processes={processes.data ?? []} canManage={canManage} onOpen={(p) => setProcessDialog(p)} onChanged={invalidate} />
          )}
          {tab === 'matrix' && <MatrixTab processes={processes.data ?? []} />}
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

// ----------------------------- Fluxograma ---------------------------------
function FlowTab({ processes, canManage, onOpen, onChanged }: { processes: Process[]; canManage: boolean; onOpen: (p: Process) => void; onChanged: () => void }) {
  return (
    <ReactFlowProvider>
      <FlowCanvas processes={processes} canManage={canManage} onOpen={onOpen} onChanged={onChanged} />
    </ReactFlowProvider>
  );
}

function FlowCanvas({ processes, canManage, onOpen, onChanged }: { processes: Process[]; canManage: boolean; onOpen: (p: Process) => void; onChanged: () => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);

  const persist = useMutation({
    mutationFn: ({ id, positionX, positionY }: { id: string; positionX: number; positionY: number }) =>
      api(`/food-safety/processes/${id}`, { method: 'PATCH', json: { positionX, positionY } }),
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar posição'),
    onSuccess: () => onChanged(),
  });

  useEffect(() => {
    setNodes(
      processes.map((p, i) => ({
        id: p.id,
        position: { x: p.positionX ?? (i % 4) * 260 + 20, y: p.positionY ?? Math.floor(i / 4) * 150 + 20 },
        data: { label: p },
        type: 'default',
        style: {
          width: 220,
          borderRadius: 10,
          border: '2px solid',
          borderColor: p.status === 'PUBLISHED' || p.status === 'APPROVED' ? '#16a34a' : p.status === 'OBSOLETE' ? '#dc2626' : '#94a3b8',
          background: 'white',
          padding: 0,
        },
      })),
    );
  }, [processes, setNodes]);

  const nodeContent = useMemo(
    () =>
      ({ id }: Node) => {
        const p = processes.find((x) => x.id === id);
        return p;
      },
    [processes],
  );

  return (
    <Card>
      <CardContent className="p-0">
        <div className="h-[68vh] rounded-md bg-muted/5">
          <ReactFlow
            nodes={nodes.map((n) => {
              const p = nodeContent(n);
              return {
                ...n,
                data: {
                  label: p ? (
                    <div className="px-3 py-2 text-left">
                      <div className="truncate text-sm font-semibold text-slate-800">{p.code ? `${p.code} · ` : ''}{p.name}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {PROCESS_STATUS_LABEL[p.status]} · {p.steps.length} etapas
                        {p.steps.some((s) => s.isControlPoint) ? ` · ${p.steps.filter((s) => s.isControlPoint).length} PC` : ''}
                      </div>
                    </div>
                  ) : (
                    n.data?.label
                  ),
                },
              };
            })}
            onNodesChange={onNodesChange}
            nodesDraggable={canManage}
            onNodeDragStop={(_, node) => {
              if (!canManage) return;
              persist.mutate({ id: node.id, positionX: Math.round(node.position.x), positionY: Math.round(node.position.y) });
            }}
            onNodeClick={(_, node) => {
              const p = processes.find((x) => x.id === node.id);
              if (p) onOpen(p);
            }}
            fitView
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} color="#cbd5e1" className="opacity-45" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!bg-muted" />
          </ReactFlow>
        </div>
        <div className="border-t p-2 text-center text-xs text-muted-foreground">
          {processes.length === 0
            ? 'Cadastre processos na aba Processos para vê-los no fluxograma.'
            : canManage
              ? 'Arraste os processos para reorganizar · clique para abrir · zoom e minimapa no canto.'
              : 'Clique em um processo para ver os detalhes.'}
        </div>
      </CardContent>
    </Card>
  );
}

// ----------------------------- Matriz Geral -------------------------------
function MatrixTab({ processes }: { processes: Process[] }) {
  const rows = useMemo(
    () =>
      processes.flatMap((p) =>
        (p.steps.length ? p.steps : [null]).map((s) => ({ process: p, step: s as Step | null })),
      ),
    [processes],
  );
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th className="text-left">Processo</th>
                <th className="text-left">Etapa</th>
                <th className="text-left">Tipo</th>
                <th className="text-left">Entradas</th>
                <th className="text-left">Saídas</th>
                <th className="text-left">Ponto de controle</th>
                <th className="text-left">Status do processo</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">Sem etapas para exibir. Cadastre processos e etapas.</td></tr>
              ) : (
                rows.map(({ process: p, step: s }, i) => (
                  <tr key={`${p.id}-${s?.id ?? i}`}>
                    <td className="font-medium">{p.code ? `${p.code} · ` : ''}{p.name}</td>
                    <td>{s ? `${s.number}. ${s.name}` : <span className="text-muted-foreground">— sem etapas —</span>}</td>
                    <td>{s ? STEP_TYPE_LABEL[s.type] : '—'}</td>
                    <td className="max-w-[16rem] truncate text-sm">{s?.inputs ?? '—'}</td>
                    <td className="max-w-[16rem] truncate text-sm">{s?.outputs ?? '—'}</td>
                    <td>{s?.isControlPoint ? <Badge className="border-emerald-300 bg-emerald-50 text-emerald-700" variant="outline">PC</Badge> : '—'}</td>
                    <td><span className={cn('pill', PROCESS_STATUS_CLASS[p.status])}>{PROCESS_STATUS_LABEL[p.status]}</span></td>
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
            <Label>Status (workflow)</Label>
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
