'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Play, Plus, Save, X } from 'lucide-react';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { FilterBar } from '@/components/platform/filter-bar';
import { MetricCard } from '@/components/platform/metric-card';
import { StatusBadge } from '@/components/platform/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/compensation/format';
import { MOVEMENT_STATUS_LABELS, MOVEMENT_TYPE_LABELS, movementStatusTone } from '@/lib/compensation/types';
import { formatDate, formatNumber } from '@/lib/utils';

const REQUEST_PERMS = ['compensation:movements:request', 'compensation:manage', 'org:positions:manage'];
const APPROVE_PERMS = ['compensation:movements:approve', 'compensation:manage'];
const EXECUTE_PERMS = ['compensation:movements:execute', 'compensation:manage'];
const FINAL = new Set(['APPLIED', 'REJECTED', 'CANCELLED']);

interface ApprovalStep {
  role: string;
  status: string;
  approverId?: string;
}

interface Movement {
  id: string;
  protocol: string;
  type: string;
  monthlyImpact: string | null;
  currentSalary: string | null;
  proposedSalary: string | null;
  effectiveAt: string;
  status: string;
  reason: string;
  createdAt: string;
  approvalSteps?: ApprovalStep[] | null;
}

// Alçadas disponíveis para compor a cadeia de aprovação.
const APPROVAL_ROLES = ['RH', 'GESTOR', 'DIRETORIA'] as const;

const emptyForm = () => ({
  type: 'PROMOCAO',
  employeeId: '',
  targetJobId: '',
  currentBand: '',
  targetBand: '',
  currentSalary: '',
  proposedSalary: '',
  availableBudget: '',
  effectiveAt: new Date().toISOString().slice(0, 10),
  reason: '',
  justification: '',
});

export default function MovimentacoesPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canRequest = hasPermission(REQUEST_PERMS);
  const canApprove = hasPermission(APPROVE_PERMS);
  const canExecute = hasPermission(EXECUTE_PERMS);

  const [form, setForm] = useState(emptyForm);
  const [approvalRoles, setApprovalRoles] = useState<string[]>(['RH']);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const optionsQuery = useQuery<{ jobs: Array<{ id: string; name: string; orgJobId?: string | null }> }>({ queryKey: ['compensation', 'options'], queryFn: () => api('/cargos-salarios/options') });
  const structureQuery = useQuery<{ employees: Array<{ id: string; name: string; registrationId: string | null; band: string }> }>({ queryKey: ['compensation', 'estrutura-quadro'], queryFn: () => api('/cargos-salarios/estrutura-quadro') });
  const movementsQuery = useQuery<Movement[]>({ queryKey: ['compensation', 'movements'], queryFn: () => api('/cargos-salarios/movements') });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['compensation', 'movements'] });
    qc.invalidateQueries({ queryKey: ['compensation', 'approvals'] });
  };

  const createMovement = useMutation({
    mutationFn: () => api('/cargos-salarios/movements', { method: 'POST', json: { ...numericPayload(form), approvalSteps: approvalRoles } }),
    onSuccess: () => {
      toast.success('Movimentação solicitada');
      setForm(emptyForm());
      setApprovalRoles(['RH']);
      setShowCreate(false);
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha ao solicitar movimentação'),
  });

  function toggleRole(role: string) {
    setApprovalRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }
  const act = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: 'approve' | 'reject' | 'apply'; note?: string }) =>
      api(`/cargos-salarios/movements/${id}/${action}`, { method: 'PATCH', json: note ? { note } : {} }),
    onSuccess: () => {
      toast.success('Movimentação atualizada');
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Falha na ação'),
  });

  const all = movementsQuery.data ?? [];
  const movements = useMemo(
    () => all.filter((m) => (!statusFilter || m.status === statusFilter) && (!typeFilter || m.type === typeFilter)),
    [all, statusFilter, typeFilter],
  );
  const kpis = useMemo(() => {
    const pending = all.filter((m) => !FINAL.has(m.status)).length;
    const applied = all.filter((m) => m.status === 'APPLIED').length;
    const approved = all.filter((m) => m.status === 'APPROVED').length;
    const monthlyImpact = all.filter((m) => !FINAL.has(m.status)).reduce((sum, m) => sum + Number(m.monthlyImpact ?? 0), 0);
    return { pending, applied, approved, monthlyImpact };
  }, [all]);

  const selectedEmployee = structureQuery.data?.employees.find((e) => e.id === form.employeeId);

  function reject(id: string) {
    const note = window.prompt('Motivo da rejeição:') ?? undefined;
    if (note === undefined) return;
    act.mutate({ id, action: 'reject', note });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Movimentações"
        description="Solicitações de promoção, mérito, enquadramento, transferência e demais impactos, com fluxo de aprovação e aplicação."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Movimentações' }]}
      />
      <CompensationModuleNav />

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard title="Pendentes" value={formatNumber(kpis.pending)} description="Aguardando fluxo" tone="yellow" />
        <MetricCard title="Aprovadas" value={formatNumber(kpis.approved)} description="Prontas para aplicar" tone="blue" />
        <MetricCard title="Aplicadas" value={formatNumber(kpis.applied)} description="Concluídas" tone="green" />
        <MetricCard title="Impacto mensal pendente" value={formatMoney(kpis.monthlyImpact)} description="Soma do que está em fluxo" tone="purple" />
      </div>

      <FilterBar
        actions={
          canRequest && (
            <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova solicitação
            </Button>
          )
        }
      >
        <div>
          <Label className="text-xs">Status</Label>
          <NativeSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(MOVEMENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label className="text-xs">Tipo</Label>
          <NativeSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </NativeSelect>
        </div>
      </FilterBar>

      {showCreate && canRequest && (
        <SectionCard title="Nova solicitação" className="mb-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <div>
              <Label>Tipo</Label>
              <NativeSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Colaborador</Label>
              <NativeSelect
                value={form.employeeId}
                onChange={(e) => {
                  const emp = structureQuery.data?.employees.find((i) => i.id === e.target.value);
                  setForm({ ...form, employeeId: e.target.value, currentBand: emp?.band ?? '', targetBand: emp?.band ?? '' });
                }}
              >
                <option value="">Selecione</option>
                {(structureQuery.data?.employees ?? []).filter((e) => e.name && e.registrationId).map((e) => (
                  <option key={e.id} value={e.id}>{e.registrationId} - {e.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Cargo pretendido</Label>
              <NativeSelect value={form.targetJobId} onChange={(e) => setForm({ ...form, targetJobId: e.target.value })}>
                <option value="">Sem alteração</option>
                {(optionsQuery.data?.jobs ?? []).map((job) => (
                  <option key={job.id} value={job.orgJobId ?? job.id}>{job.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Vigência</Label>
              <Input type="date" value={form.effectiveAt} onChange={(e) => setForm({ ...form, effectiveAt: e.target.value })} />
            </div>
            <div>
              <Label>Faixa atual</Label>
              <Input value={form.currentBand || selectedEmployee?.band || ''} onChange={(e) => setForm({ ...form, currentBand: e.target.value })} />
            </div>
            <div>
              <Label>Faixa pretendida</Label>
              <Input value={form.targetBand} onChange={(e) => setForm({ ...form, targetBand: e.target.value })} />
            </div>
            <div>
              <Label>Salário atual</Label>
              <Input type="number" value={form.currentSalary} onChange={(e) => setForm({ ...form, currentSalary: e.target.value })} />
            </div>
            <div>
              <Label>Salário proposto</Label>
              <Input type="number" value={form.proposedSalary} onChange={(e) => setForm({ ...form, proposedSalary: e.target.value })} />
            </div>
            <div>
              <Label>Orçamento disponível</Label>
              <Input type="number" value={form.availableBudget} onChange={(e) => setForm({ ...form, availableBudget: e.target.value })} />
            </div>
            <div className="lg:col-span-3">
              <Label>Motivo</Label>
              <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
            <div className="lg:col-span-4">
              <Label>Alçadas de aprovação (em ordem)</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {APPROVAL_ROLES.map((role) => {
                  const active = approvalRoles.includes(role);
                  const order = approvalRoles.indexOf(role) + 1;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground'}`}
                    >
                      {active && <span className="mr-1 tabular-nums">{order}.</span>}
                      {role}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">A movimentação só fica aprovada após todas as alçadas selecionadas decidirem.</p>
            </div>
            <div className="lg:col-span-4">
              <Label>Justificativa obrigatória</Label>
              <Textarea rows={3} value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} />
            </div>
            <div className="lg:col-span-4">
              <Button onClick={() => createMovement.mutate()} disabled={!form.type || !form.reason || !form.justification || !form.effectiveAt || createMovement.isPending}>
                <Save className="mr-2 h-4 w-4" /> Solicitar
              </Button>
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Solicitações">
        {movementsQuery.isLoading ? (
          <LoadingState />
        ) : movements.length === 0 ? (
          <EmptyState title="Nenhuma movimentação" description="Ajuste os filtros ou crie uma nova solicitação." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 text-left">Protocolo</th>
                  <th className="py-2 text-left">Tipo</th>
                  <th className="py-2 text-left">Vigência</th>
                  <th className="py-2 text-left">Motivo</th>
                  <th className="py-2 text-right">Impacto mensal</th>
                  <th className="py-2 text-left">Alçadas</th>
                  <th className="py-2 text-left">Status</th>
                  <th className="py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-border/60">
                    <td className="py-2 font-mono text-xs">{m.protocol}</td>
                    <td className="py-2">{MOVEMENT_TYPE_LABELS[m.type] ?? m.type}</td>
                    <td className="py-2">{formatDate(m.effectiveAt)}</td>
                    <td className="py-2 max-w-[220px] truncate">{m.reason}</td>
                    <td className="py-2 text-right tabular-nums">{m.monthlyImpact ? formatMoney(m.monthlyImpact) : '-'}</td>
                    <td className="py-2"><StepsChain steps={m.approvalSteps} /></td>
                    <td className="py-2">
                      <StatusBadge value={m.status} tone={movementStatusTone(m.status)} label={MOVEMENT_STATUS_LABELS[m.status] ?? m.status} />
                    </td>
                    <td className="py-2">
                      <div className="flex justify-end gap-1.5">
                        {!FINAL.has(m.status) && m.status !== 'APPROVED' && canApprove && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 text-status-green" onClick={() => act.mutate({ id: m.id, action: 'approve' })} disabled={act.isPending}>
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Aprovar
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-status-red" onClick={() => reject(m.id)} disabled={act.isPending}>
                              <X className="mr-1 h-3.5 w-3.5" /> Rejeitar
                            </Button>
                          </>
                        )}
                        {m.status === 'APPROVED' && canExecute && (
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => act.mutate({ id: m.id, action: 'apply' })} disabled={act.isPending}>
                            <Play className="mr-1 h-3.5 w-3.5" /> Aplicar
                          </Button>
                        )}
                        {FINAL.has(m.status) && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function numericPayload(form: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(form).map(([key, value]) => {
      if (['currentSalary', 'proposedSalary', 'availableBudget'].includes(key)) return [key, value ? Number(value) : undefined];
      return [key, value || undefined];
    }),
  );
}

// Cadeia de alçadas: cada etapa colorida por status (verde aprovada, vermelha rejeitada, âmbar pendente).
function StepsChain({ steps }: { steps?: ApprovalStep[] | null }) {
  if (!steps || steps.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const cls = (status: string) =>
    status === 'APPROVED'
      ? 'bg-status-green/15 text-status-green border-status-green/30'
      : status === 'REJECTED'
        ? 'bg-status-red/15 text-status-red border-status-red/30'
        : 'bg-status-yellow/15 text-status-yellow border-status-yellow/30';
  return (
    <div className="flex flex-wrap items-center gap-1">
      {steps.map((step, idx) => (
        <span key={`${step.role}-${idx}`} className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${cls(step.status)}`} title={step.status}>
          {step.role}
        </span>
      ))}
    </div>
  );
}
