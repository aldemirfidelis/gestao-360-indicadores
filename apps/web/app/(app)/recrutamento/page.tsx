'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2,
  ClipboardCheck,
  FileSignature,
  Megaphone,
  Plus,
  Search,
  Send,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { EmptyState } from '@/components/platform/empty-state';
import { LoadingState } from '@/components/platform/loading-state';
import { MetricCard } from '@/components/platform/metric-card';
import { ReasonDialog, type ReasonDialogState } from '@/components/platform/reason-dialog';
import { StatusBadge } from '@/components/platform/status-badge';
import { JourneyStepper, NextStepCallout, type JourneyStep } from '@/components/recruitment/journey-stepper';
import { RecruitersDialog } from '@/components/recruitment/recruiters-dialog';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import {
  APPROVAL_ROLE,
  GATE_KIND,
  PRIORITY,
  REQUISITION_STATUS,
  VACANCY_TYPE,
  formatDateBr,
  formatMoneyCents,
  labelOf,
  metaOf,
} from '@/lib/recruitment/labels';

interface Requisition {
  id: string; code: string; status: string; vacancyType: string; priority: string;
  openingsRequested: number; orgNodeId: string | null; orgJobId: string | null;
  recruiterId: string | null; confidential: boolean; createdAt?: string;
  _count?: { openings: number; approvals: number };
}
interface RequisitionDetail extends Requisition {
  requesterId: string; reason: string | null; notes: string | null;
  monthlyBudgetCents: number | string | null;
  recruiterLeadId: string | null;
  recruiterName: string | null; recruiterLeadName: string | null; requesterName: string | null;
  gateExceptions: Array<{ kind: string; reason: string; at: string }> | null;
  approvals: Array<{ id: string; order: number; role: string; decision: string | null; comment: string | null; approverId: string | null; approverName: string | null }>;
  openings: Array<{ id: string; status: string }>;
}
interface Recruiter {
  id: string; userId: string; userName: string | null; areaName: string | null;
  leadUserId: string | null; leadUserName: string | null; active: boolean;
}
interface Gate {
  ready: boolean; blocks: string[]; warnings: string[]; exceptionsRequired: string[];
  availability: { headcountAvailable: number | null; budgetAvailableCents: number | null };
}
interface Options {
  orgNodes: Array<{ id: string; name: string }>;
  jobs: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string }>;
}
interface Posting { id: string; status: string; _count?: { applications: number } }

const EMPTY_FORM = { orgJobId: '', orgNodeId: '', openingsRequested: 1, vacancyType: 'AUMENTO', priority: 'NORMAL', reason: '', recruiterId: '', monthlyBudgetCents: '', confidential: false };

export default function RecruitmentPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { hasPermission, user } = useAuth();
  const canCreate = hasPermission(['recruit:requisition:create']);
  const canApprove = hasPermission(['recruit:requisition:approve']);
  const canManage = hasPermission(['recruit:manage']);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [reasonDialog, setReasonDialog] = useState<ReasonDialogState | null>(null);
  const [reassign, setReassign] = useState<{ stepId: string; role: string; approverId: string } | null>(null);
  const [recruitersOpen, setRecruitersOpen] = useState(false);
  // Encaminhamento: escolhe quem CONDUZ (recrutador) e quem ACOMPANHA (líder).
  const [forwardId, setForwardId] = useState<string | null>(null);
  const [forwardForm, setForwardForm] = useState({ recruiterId: '', recruiterLeadId: '' });

  // Abre a requisição direto quando o link vem de uma notificação (?focus=<id>), ex.: alerta de SLA.
  useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get('focus');
    if (focus) setDetailId(focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listQuery = useQuery<Requisition[]>({ queryKey: ['recruit-requisitions'], queryFn: () => api('/recruitment/requisitions') });
  const postingsQuery = useQuery<Posting[]>({ queryKey: ['recruit-postings'], queryFn: () => api('/recruitment/postings') });
  const optionsQuery = useQuery<Options>({ queryKey: ['personnel-employees', 'options'], queryFn: () => api('/personnel/employees/options'), staleTime: 60_000 });
  const detailQuery = useQuery<RequisitionDetail>({ queryKey: ['recruit-req', detailId], queryFn: () => api(`/recruitment/requisitions/${detailId}`), enabled: Boolean(detailId) });
  const recruitersQuery = useQuery<Recruiter[]>({ queryKey: ['recruit-recruiters'], queryFn: () => api('/recruitment/recruiters') });
  const gateQuery = useQuery<Gate>({ queryKey: ['recruit-gate', detailId], queryFn: () => api(`/recruitment/requisitions/${detailId}/gate`), enabled: Boolean(detailId) });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['recruit-requisitions'] });
    void qc.invalidateQueries({ queryKey: ['recruit-req', detailId] });
    void qc.invalidateQueries({ queryKey: ['recruit-gate', detailId] });
  };

  const activeRecruiters = useMemo(() => (recruitersQuery.data ?? []).filter((r) => r.active), [recruitersQuery.data]);

  // Abre o diálogo de encaminhamento com o recrutador atual (se houver) e o
  // líder autopreenchido do cadastro do recrutador escolhido.
  const openForward = (req: RequisitionDetail) => {
    const recruiterId = req.recruiterId ?? '';
    const lead = activeRecruiters.find((r) => r.userId === recruiterId)?.leadUserId ?? '';
    setForwardForm({ recruiterId, recruiterLeadId: req.recruiterLeadId ?? lead });
    setForwardId(req.id);
  };
  const forward = useMutation({
    mutationFn: () => api(`/recruitment/requisitions/${forwardId}/send-to-recruitment`, { method: 'POST', json: forwardForm }),
    onSuccess: () => { toast.success('Requisição encaminhada ao recrutamento.'); setForwardId(null); invalidate(); },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível encaminhar.'),
  });

  const create = useMutation({
    mutationFn: () =>
      api<Requisition>('/recruitment/requisitions', {
        method: 'POST',
        json: { ...form, monthlyBudgetCents: form.monthlyBudgetCents ? Math.round(Number(form.monthlyBudgetCents) * 100) : null },
      }),
    onSuccess: () => { toast.success('Requisição criada como rascunho. Envie para aprovação quando estiver pronta.'); setFormOpen(false); setForm({ ...EMPTY_FORM }); invalidate(); },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível criar a requisição.'),
  });
  const act = useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: string; body?: unknown }) => api(`/recruitment/requisitions/${id}/${action}`, { method: 'POST', json: body ?? {} }),
    onSuccess: (_, variables) => {
      const messages: Record<string, string> = {
        submit: 'Requisição enviada para aprovação.',
        decide: 'Decisão registrada.',
        'send-to-recruitment': 'Requisição encaminhada ao recrutamento.',
        'gate-exception': 'Exceção aprovada e registrada na auditoria.',
        cancel: 'Requisição cancelada.',
      };
      toast.success(messages[variables.action] ?? 'Feito.');
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível concluir a ação.'),
  });
  const reassignMut = useMutation({
    mutationFn: ({ id, stepId, approverId }: { id: string; stepId: string; approverId: string }) =>
      api(`/recruitment/requisitions/${id}/reassign-approver`, { method: 'POST', json: { stepId, approverId: approverId || null } }),
    onSuccess: () => { toast.success('Aprovador reatribuído.'); setReassign(null); invalidate(); },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível reatribuir o aprovador.'),
  });
  const createPosting = useMutation({
    mutationFn: (id: string) => api<{ id: string }>(`/recruitment/requisitions/${id}/posting`, { method: 'POST' }),
    onSuccess: (posting) => {
      toast.success('Vaga criada como rascunho. Ajuste o texto de divulgação e publique.');
      setDetailId(null);
      router.push(`/recrutamento/vagas/${posting.id}`);
    },
    onError: (error: any) => toast.error(error?.message ?? 'Não foi possível criar a vaga.'),
  });

  const requisitions = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const postings = useMemo(() => postingsQuery.data ?? [], [postingsQuery.data]);
  const options = optionsQuery.data;
  const jobName = (id: string | null) => options?.jobs.find((job) => job.id === id)?.name ?? '—';
  const nodeName = (id: string | null) => options?.orgNodes.find((node) => node.id === id)?.name ?? '—';
  const detail = detailQuery.data;
  const gate = gateQuery.data;
  const userName = (id: string | null) => options?.users.find((u) => u.id === id)?.name ?? null;
  // Passo pendente e quem pode agir nele: passo aberto (sem designado), o próprio
  // designado, ou RH/Admin (recruit:manage) aprovando em nome do designado.
  const pendingApproval = detail?.approvals.find((a) => a.decision === null) ?? null;
  const pendingApproverId = pendingApproval?.approverId ?? null;
  const isDesignatedApprover = pendingApproverId != null && pendingApproverId === user?.id;
  const canActOnPending = canApprove && (!pendingApproverId || isDesignatedApprover || canManage);

  const counts = useMemo(() => {
    const byStatus = (...statuses: string[]) => requisitions.filter((req) => statuses.includes(req.status)).length;
    return {
      draft: byStatus('DRAFT', 'RETURNED'),
      approval: byStatus('SUBMITTED'),
      recruitment: byStatus('APPROVED', 'SENT_TO_RECRUITMENT', 'IN_RECRUITMENT'),
      published: postings.filter((posting) => posting.status === 'PUBLISHED').length,
      applications: postings.reduce((sum, posting) => sum + (posting._count?.applications ?? 0), 0),
      filled: byStatus('FILLED'),
    };
  }, [requisitions, postings]);

  const filtered = useMemo(() => {
    return requisitions.filter((req) => {
      if (statusFilter === 'GROUP:draft') {
        if (!['DRAFT', 'RETURNED'].includes(req.status)) return false;
      } else if (statusFilter === 'GROUP:recruitment') {
        if (!['APPROVED', 'SENT_TO_RECRUITMENT', 'IN_RECRUITMENT'].includes(req.status)) return false;
      } else if (statusFilter && req.status !== statusFilter) return false;
      if (search) {
        const haystack = `${req.code} ${jobName(req.orgJobId)} ${nodeName(req.orgNodeId)}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requisitions, statusFilter, search, options]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recrutamento e Seleção"
        description="Da requisição de vaga à admissão: aprovação com travas de quadro/orçamento, divulgação no portal de carreiras, seleção com scorecard, proposta, pré-admissão com ASO e admissão integrada ao Serviço Pessoal."
        actions={
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <Button variant="outline" onClick={() => setRecruitersOpen(true)}><Users className="mr-2 h-4 w-4" /> Recrutadores</Button>
            )}
            {canCreate && (
              <Button onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nova requisição</Button>
            )}
          </div>
        }
      />

      {/* Funil do processo com contagens reais — cada cartão filtra ou navega. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <button type="button" className="text-left" onClick={() => setStatusFilter('GROUP:draft')}>
          <MetricCard compact title="1 · Rascunhos" value={counts.draft} description="Requisições a enviar" icon={<FileSignature className="h-3.5 w-3.5" />} tone="neutral" />
        </button>
        <button type="button" className="text-left" onClick={() => setStatusFilter('SUBMITTED')}>
          <MetricCard compact title="2 · Em aprovação" value={counts.approval} description="Aguardando decisão" icon={<ClipboardCheck className="h-3.5 w-3.5" />} tone={counts.approval > 0 ? 'yellow' : 'neutral'} />
        </button>
        <button type="button" className="text-left" onClick={() => setStatusFilter('GROUP:recruitment')}>
          <MetricCard compact title="3 · No recrutamento" value={counts.recruitment} description="Aprovadas, criar vaga" icon={<Send className="h-3.5 w-3.5" />} tone={counts.recruitment > 0 ? 'blue' : 'neutral'} />
        </button>
        <MetricCard compact title="4 · Vagas no ar" value={counts.published} description="Publicadas em carreiras" icon={<Megaphone className="h-3.5 w-3.5" />} tone={counts.published > 0 ? 'purple' : 'neutral'} href="/recrutamento/vagas" />
        <MetricCard compact title="5 · Candidaturas" value={counts.applications} description="Recebidas nas vagas" icon={<Users className="h-3.5 w-3.5" />} tone={counts.applications > 0 ? 'blue' : 'neutral'} href="/recrutamento/vagas" />
        <button type="button" className="text-left" onClick={() => setStatusFilter('FILLED')}>
          <MetricCard compact title="6 · Preenchidas" value={counts.filled} description="Admissões concluídas" icon={<UserCheck className="h-3.5 w-3.5" />} tone={counts.filled > 0 ? 'green' : 'neutral'} />
        </button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <h2 className="mr-auto text-sm font-semibold">Requisições de vaga</h2>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 w-56 pl-8 text-xs" placeholder="Código, cargo ou área..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <NativeSelect className="h-8 w-48 text-xs" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Todos os status</option>
              <option value="GROUP:draft">Rascunhos e devolvidas</option>
              <option value="GROUP:recruitment">Aprovadas / no recrutamento</option>
              {Object.entries(REQUISITION_STATUS).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
            </NativeSelect>
            {(statusFilter || search) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setStatusFilter(''); setSearch(''); }}>Limpar</Button>
            )}
          </div>
          {listQuery.isLoading ? (
            <LoadingState label="Carregando requisições..." />
          ) : filtered.length === 0 ? (
            <EmptyState
              className="m-4"
              title={requisitions.length === 0 ? 'Nenhuma requisição de vaga' : 'Nada com esse filtro'}
              description={
                requisitions.length === 0
                  ? 'O processo começa aqui: crie a requisição informando cargo, área e motivo. Ela passa pela aprovação e vira vaga de divulgação.'
                  : 'Ajuste a busca ou o filtro de status.'
              }
              action={requisitions.length === 0 && canCreate ? <Button onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" /> Criar a primeira</Button> : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Código</th>
                    <th className="p-3">Cargo / Área</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Prioridade</th>
                    <th className="p-3 text-center">Vagas</th>
                    <th className="p-3">Status</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((req) => {
                    const statusMeta = metaOf(REQUISITION_STATUS, req.status);
                    const priorityMeta = metaOf(PRIORITY, req.priority);
                    return (
                      <tr key={req.id} className="cursor-pointer hover:bg-muted/20" onClick={() => setDetailId(req.id)}>
                        <td className="p-3 font-mono text-xs">{req.code}</td>
                        <td className="p-3">
                          <div className="font-medium">{jobName(req.orgJobId)}</div>
                          <div className="text-[10px] text-muted-foreground">{nodeName(req.orgNodeId)}</div>
                        </td>
                        <td className="p-3 text-xs">
                          {labelOf(VACANCY_TYPE, req.vacancyType)}
                          {req.confidential && <Badge variant="outline" className="ml-1 text-[8px]">confidencial</Badge>}
                        </td>
                        <td className="p-3"><StatusBadge label={priorityMeta.label} tone={priorityMeta.tone} /></td>
                        <td className="p-3 text-center tabular-nums">{req.openingsRequested}</td>
                        <td className="p-3"><StatusBadge label={statusMeta.label} tone={statusMeta.tone} /></td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); setDetailId(req.id); }}>Abrir</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nova requisição */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader><DialogTitle>Nova requisição de vaga</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">
            A requisição é a origem de toda contratação: define cargo, área e motivo, passa pelas travas de quadro/orçamento e pela aprovação antes de virar vaga.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Cargo</Label>
              <NativeSelect value={form.orgJobId} onChange={(event) => setForm((f) => ({ ...f, orgJobId: event.target.value }))}>
                <option value="">Selecionar cargo…</option>
                {(options?.jobs ?? []).map((job) => <option key={job.id} value={job.id}>{job.name}</option>)}
              </NativeSelect>
            </div>
            <div className="col-span-2">
              <Label>Área</Label>
              <NativeSelect value={form.orgNodeId} onChange={(event) => setForm((f) => ({ ...f, orgNodeId: event.target.value }))}>
                <option value="">Selecionar área…</option>
                {(options?.orgNodes ?? []).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Tipo de vaga</Label>
              <NativeSelect value={form.vacancyType} onChange={(event) => setForm((f) => ({ ...f, vacancyType: event.target.value }))}>
                {Object.entries(VACANCY_TYPE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Prioridade</Label>
              <NativeSelect value={form.priority} onChange={(event) => setForm((f) => ({ ...f, priority: event.target.value }))}>
                {Object.entries(PRIORITY).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Quantidade de vagas</Label>
              <Input type="number" min={1} value={form.openingsRequested} onChange={(event) => setForm((f) => ({ ...f, openingsRequested: Number(event.target.value) }))} />
            </div>
            <div>
              <Label>Orçamento mensal (R$)</Label>
              <Input type="number" placeholder="Ex.: 4500" value={form.monthlyBudgetCents} onChange={(event) => setForm((f) => ({ ...f, monthlyBudgetCents: event.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>Recrutador responsável</Label>
              <NativeSelect value={form.recruiterId} onChange={(event) => setForm((f) => ({ ...f, recruiterId: event.target.value }))}>
                <option value="">Definir depois…</option>
                {(options?.users ?? []).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </NativeSelect>
              <p className="mt-1 text-[10px] text-muted-foreground">Se não definido, quem encaminhar a requisição ao recrutamento assume como recrutador.</p>
            </div>
            <div className="col-span-2">
              <Label>Motivo / justificativa</Label>
              <Textarea value={form.reason} onChange={(event) => setForm((f) => ({ ...f, reason: event.target.value }))} placeholder="Por que esta vaga é necessária?" />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.confidential} onChange={(event) => setForm((f) => ({ ...f, confidential: event.target.checked }))} />
              Vaga confidencial (aprovação adicional da diretoria)
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={!form.orgJobId || create.isPending}>Criar rascunho</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhe da requisição */}
      <Sheet open={Boolean(detailId)} onOpenChange={(open) => !open && setDetailId(null)}>
        <SheetContent size="lg">
          {detailQuery.isLoading && (
            <SheetBody><LoadingState label="Carregando requisição..." /></SheetBody>
          )}
          {detail && (
            <>
              <SheetHeader className="pr-12">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle>{detail.code} — {jobName(detail.orgJobId)}</SheetTitle>
                  <StatusBadge {...badgeOf(REQUISITION_STATUS, detail.status)} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {labelOf(VACANCY_TYPE, detail.vacancyType)} · {detail.openingsRequested} vaga(s) · {nodeName(detail.orgNodeId)}
                  {detail.confidential ? ' · confidencial' : ''}
                </div>
              </SheetHeader>
              <SheetBody className="space-y-4">
                <div className="space-y-2">
                  <JourneyStepper steps={requisitionJourney(detail.status)} />
                  {gate && gate.exceptionsRequired.length > 0 && !['CANCELLED', 'CLOSED', 'REJECTED', 'FILLED'].includes(detail.status) ? (
                    <NextStepCallout
                      text="há exceções de quadro/orçamento pendentes — aprove-as nas travas abaixo antes de encaminhar ao recrutamento."
                      tone="yellow"
                    />
                  ) : (
                    <NextStepCallout {...requisitionNextStep(detail.status, { canCreate, canApprove, canManage })} />
                  )}
                </div>

                {detail.reason && (
                  <div className="rounded-md bg-muted/40 p-3 text-xs">
                    <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Motivo</div>
                    {detail.reason}
                  </div>
                )}

                {detail.recruiterId && (
                  <div className="rounded-md border border-status-blue/30 bg-status-blue/5 p-3 text-xs">
                    <div className="mb-1.5 flex items-center gap-1.5 font-semibold"><UserCheck className="h-3.5 w-3.5 text-status-blue" /> Condução da seleção</div>
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                      <div>
                        <div className="text-[10px] uppercase text-muted-foreground">Recrutador (conduz)</div>
                        <div className="font-medium">{detail.recruiterName ?? userName(detail.recruiterId) ?? '—'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-muted-foreground">Líder (acompanha)</div>
                        <div className="font-medium">{detail.recruiterLeadName ?? (detail.recruiterLeadId ? userName(detail.recruiterLeadId) : null) ?? '—'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-muted-foreground">Gestor solicitante</div>
                        <div className="font-medium">{detail.requesterName ?? userName(detail.requesterId) ?? '—'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {gate && (
                  <div className="rounded-md border p-3 text-xs">
                    <div className="mb-1 flex items-center gap-2 font-semibold">
                      {gate.ready ? <CheckCircle2 className="h-4 w-4 text-status-green" /> : <ShieldAlert className="h-4 w-4 text-status-yellow" />}
                      Travas de quadro e orçamento
                    </div>
                    <div className="text-muted-foreground">
                      Saldo de quadro: {gate.availability.headcountAvailable ?? 'não cadastrado'} · Orçamento disponível: {formatMoneyCents(gate.availability.budgetAvailableCents)}
                    </div>
                    {gate.blocks.map((block, index) => <div key={index} className="mt-1 text-status-red">• {block}</div>)}
                    {gate.warnings.map((warning, index) => <div key={index} className="mt-1 text-status-yellow">• {warning}</div>)}
                    {gate.exceptionsRequired.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-1 font-medium text-status-yellow">
                          <ShieldAlert className="h-3.5 w-3.5" /> Exceções pendentes de aprovação:
                        </div>
                        {gate.exceptionsRequired.map((kind) => (
                          <div key={kind} className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1">
                            <span>Exceção de {labelOf(GATE_KIND, kind)}</span>
                            {canApprove && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px]"
                                onClick={() =>
                                  setReasonDialog({
                                    title: `Aprovar exceção de ${labelOf(GATE_KIND, kind)}`,
                                    description: 'A exceção fica registrada na auditoria com a sua justificativa.',
                                    label: 'Justificativa',
                                    confirmLabel: 'Aprovar exceção',
                                    onConfirm: (reason) => act.mutate({ id: detail.id, action: 'gate-exception', body: { kind, reason } }),
                                  })
                                }
                              >
                                Aprovar exceção
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {(detail.gateExceptions ?? [])?.length > 0 && (
                      <div className="mt-2 border-t pt-2 text-muted-foreground">
                        {(detail.gateExceptions ?? []).map((exception, index) => (
                          <div key={index}>✓ Exceção de {labelOf(GATE_KIND, exception.kind)} aprovada em {formatDateBr(exception.at)}: {exception.reason}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-md border p-3 text-xs">
                  <div className="mb-2 font-semibold">Fluxo de aprovação</div>
                  {detail.approvals.length === 0 ? (
                    <div className="text-muted-foreground">Definido no envio para aprovação.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {detail.approvals.map((approval) => (
                        <div key={approval.id} className="flex items-center justify-between gap-2">
                          <span className="min-w-0">
                            {approval.order}. {labelOf(APPROVAL_ROLE, approval.role)}
                            <span className="ml-1 text-muted-foreground">
                              · {approval.approverName ?? (approval.approverId ? 'aprovador designado' : 'qualquer aprovador com permissão')}
                            </span>
                            {approval.decision === null && detail.status === 'SUBMITTED' && canManage && (
                              <button
                                type="button"
                                className="ml-2 text-[11px] font-medium text-primary underline-offset-2 hover:underline"
                                onClick={() => setReassign({ stepId: approval.id, role: approval.role, approverId: approval.approverId ?? '' })}
                              >
                                Reatribuir
                              </button>
                            )}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            {approval.comment && <span className="text-[10px] text-muted-foreground">{approval.comment}</span>}
                            <StatusBadge
                              label={approval.decision === 'APPROVED' ? 'Aprovado' : approval.decision === 'REJECTED' ? 'Reprovado' : 'Pendente'}
                              tone={approval.decision === 'APPROVED' ? 'green' : approval.decision === 'REJECTED' ? 'red' : 'gray'}
                            />
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {detail.monthlyBudgetCents != null && (
                  <div className="text-xs text-muted-foreground">Orçamento mensal solicitado: <strong>{formatMoneyCents(detail.monthlyBudgetCents)}</strong></div>
                )}

                <div className="flex flex-wrap gap-2 border-t pt-3">
                  {canCreate && detail.status === 'DRAFT' && (
                    <Button size="sm" onClick={() => act.mutate({ id: detail.id, action: 'submit' })} disabled={act.isPending}>
                      <Send className="mr-1 h-3.5 w-3.5" /> Enviar para aprovação
                    </Button>
                  )}
                  {canActOnPending && detail.status === 'SUBMITTED' && (
                    <>
                      <Button size="sm" onClick={() => act.mutate({ id: detail.id, action: 'decide', body: { decision: 'APPROVED' } })} disabled={act.isPending}>
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Aprovar este passo
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={act.isPending}
                        onClick={() =>
                          setReasonDialog({
                            title: 'Reprovar requisição',
                            label: 'Motivo da reprovação',
                            confirmLabel: 'Reprovar',
                            destructive: true,
                            onConfirm: (comment) => act.mutate({ id: detail.id, action: 'decide', body: { decision: 'REJECTED', comment } }),
                          })
                        }
                      >
                        <X className="mr-1 h-3.5 w-3.5" /> Reprovar
                      </Button>
                      {pendingApproverId && !isDesignatedApprover && canManage && (
                        <span className="basis-full text-[11px] text-muted-foreground">
                          Você aprovará em nome de <strong>{userName(pendingApproverId) ?? 'aprovador designado'}</strong> (RH/Admin) — fica registrado na auditoria.
                        </span>
                      )}
                    </>
                  )}
                  {canApprove && !canActOnPending && detail.status === 'SUBMITTED' && pendingApproval && (
                    <span className="basis-full text-[11px] text-amber-600">
                      Aguardando aprovação de <strong>{pendingApproval.approverName ?? 'aprovador designado'}</strong>. Só essa pessoa (ou um RH/Admin) pode decidir este passo.
                    </span>
                  )}
                  {canApprove && detail.status === 'APPROVED' && (
                    <Button size="sm" onClick={() => openForward(detail)} disabled={act.isPending}>
                      <UserPlus className="mr-1 h-3.5 w-3.5" /> Encaminhar ao recrutamento
                    </Button>
                  )}
                  {canManage && ['SENT_TO_RECRUITMENT', 'IN_RECRUITMENT'].includes(detail.status) && (
                    <Button size="sm" onClick={() => createPosting.mutate(detail.id)} disabled={createPosting.isPending}>
                      <Megaphone className="mr-1 h-3.5 w-3.5" /> Criar vaga de divulgação
                    </Button>
                  )}
                  {canCreate && !['CANCELLED', 'CLOSED', 'FILLED'].includes(detail.status) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-status-red"
                      disabled={act.isPending}
                      onClick={() =>
                        setReasonDialog({
                          title: `Cancelar requisição ${detail.code}`,
                          description: 'A reserva de quadro/orçamento é liberada.',
                          label: 'Motivo do cancelamento',
                          confirmLabel: 'Cancelar requisição',
                          destructive: true,
                          onConfirm: (reason) => act.mutate({ id: detail.id, action: 'cancel', body: { reason } }),
                        })
                      }
                    >
                      Cancelar requisição
                    </Button>
                  )}
                </div>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ReasonDialog state={reasonDialog} onClose={() => setReasonDialog(null)} />

      <Dialog open={reassign != null} onOpenChange={(open) => !open && setReassign(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reatribuir aprovador — {reassign ? labelOf(APPROVAL_ROLE, reassign.role) : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reassign-approver">Aprovador designado para este passo</Label>
            <NativeSelect
              id="reassign-approver"
              value={reassign?.approverId ?? ''}
              onChange={(e) => setReassign((prev) => (prev ? { ...prev, approverId: e.target.value } : prev))}
            >
              <option value="">Qualquer aprovador com permissão</option>
              {(options?.users ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </NativeSelect>
            <p className="text-[11px] text-muted-foreground">
              A pessoa escolhida passa a ser a única que pode aprovar/reprovar este passo. Deixe em branco para abrir a qualquer usuário com a permissão de aprovação. O solicitante não pode ser o aprovador.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReassign(null)}>Cancelar</Button>
            <Button
              size="sm"
              disabled={reassignMut.isPending || !detail || !reassign}
              onClick={() => { if (detail && reassign) reassignMut.mutate({ id: detail.id, stepId: reassign.stepId, approverId: reassign.approverId }); }}
            >
              Salvar aprovador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Encaminhamento: define quem conduz e quem acompanha */}
      <Dialog open={forwardId != null} onOpenChange={(open) => !open && setForwardId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encaminhar ao recrutamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="fwd-recruiter">Recrutador responsável (conduz a seleção)</Label>
              <NativeSelect
                id="fwd-recruiter"
                value={forwardForm.recruiterId}
                onChange={(e) => {
                  const recruiterId = e.target.value;
                  const lead = activeRecruiters.find((r) => r.userId === recruiterId)?.leadUserId ?? '';
                  setForwardForm({ recruiterId, recruiterLeadId: lead });
                }}
              >
                <option value="">Selecione um recrutador…</option>
                {activeRecruiters.map((r) => <option key={r.id} value={r.userId}>{r.userName}{r.areaName ? ` — ${r.areaName}` : ''}</option>)}
              </NativeSelect>
              {activeRecruiters.length === 0 && (
                <p className="mt-1 text-[11px] text-status-yellow">
                  Nenhum recrutador cadastrado.{' '}
                  <button type="button" className="underline" onClick={() => { setForwardId(null); setRecruitersOpen(true); }}>Cadastre um recrutador</button> antes de encaminhar.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="fwd-lead">Líder do recrutador (acompanha)</Label>
              <NativeSelect id="fwd-lead" value={forwardForm.recruiterLeadId} onChange={(e) => setForwardForm((f) => ({ ...f, recruiterLeadId: e.target.value }))}>
                <option value="">Sem líder acompanhante</option>
                {(options?.users ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </NativeSelect>
              <p className="mt-1 text-[11px] text-muted-foreground">Preenchido automaticamente pelo líder do recrutador cadastrado. O gestor solicitante ({detail?.requesterName ?? (detail ? userName(detail.requesterId) : null) ?? '—'}) já acompanha por padrão.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setForwardId(null)}>Cancelar</Button>
            <Button size="sm" disabled={forward.isPending || !forwardForm.recruiterId} onClick={() => forward.mutate()}>
              <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Encaminhar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RecruitersDialog open={recruitersOpen} onOpenChange={setRecruitersOpen} />
    </div>
  );
}

function badgeOf(map: Record<string, { label: string; tone: 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple' }>, value: string) {
  const meta = metaOf(map, value);
  return { label: meta.label, tone: meta.tone };
}

function requisitionJourney(status: string): JourneyStep[] {
  const order = ['DRAFT', 'SUBMITTED', 'APPROVED', 'SENT_TO_RECRUITMENT', 'IN_RECRUITMENT', 'FILLED'];
  const position = order.indexOf(status);
  const stepState = (from: number, to: number): JourneyStep['state'] => {
    if (status === 'REJECTED') return to <= 1 ? (to === 1 ? 'blocked' : 'done') : 'todo';
    if (['CANCELLED', 'FROZEN', 'CLOSED', 'RETURNED'].includes(status)) return 'todo';
    if (position > to) return 'done';
    if (position >= from && position <= to) return 'current';
    return 'todo';
  };
  return [
    { key: 'draft', label: 'Requisição', state: status === 'DRAFT' || status === 'RETURNED' ? 'current' : 'done' },
    { key: 'approval', label: 'Aprovação', state: stepState(1, 1) },
    { key: 'forward', label: 'Encaminhamento', state: stepState(2, 2) },
    { key: 'posting', label: 'Vaga e seleção', state: stepState(3, 4) },
    { key: 'filled', label: 'Preenchida', state: status === 'FILLED' ? 'done' : 'todo' },
  ];
}

function requisitionNextStep(status: string, can: { canCreate: boolean; canApprove: boolean; canManage: boolean }): { text: string; tone: 'blue' | 'green' | 'yellow' | 'red' } {
  switch (status) {
    case 'DRAFT':
      return { text: can.canCreate ? 'revise os dados e clique em “Enviar para aprovação”.' : 'aguardando o solicitante enviar para aprovação.', tone: 'blue' };
    case 'RETURNED':
      return { text: 'a requisição foi devolvida — ajuste e reenvie para aprovação.', tone: 'yellow' };
    case 'SUBMITTED':
      return { text: can.canApprove ? 'decida o passo pendente do fluxo de aprovação abaixo.' : 'em aprovação — os aprovadores decidem na ordem do fluxo.', tone: 'yellow' };
    case 'APPROVED':
      return { text: can.canApprove ? 'aprovada — encaminhe ao recrutamento para virar vaga.' : 'aprovada — aguardando encaminhamento ao recrutamento.', tone: 'blue' };
    case 'SENT_TO_RECRUITMENT':
      return { text: can.canManage ? 'crie a vaga de divulgação e publique no portal de carreiras.' : 'no recrutamento — o recrutador cria a vaga de divulgação.', tone: 'blue' };
    case 'IN_RECRUITMENT':
      return { text: 'vaga em seleção — acompanhe os candidatos em Vagas e candidatos.', tone: 'blue' };
    case 'FILLED':
      return { text: 'requisição preenchida — admissão concluída.', tone: 'green' };
    case 'REJECTED':
      return { text: 'reprovada na aprovação — veja o motivo no fluxo abaixo.', tone: 'red' };
    case 'CANCELLED':
      return { text: 'cancelada — a reserva de quadro/orçamento foi liberada.', tone: 'red' };
    case 'FROZEN':
      return { text: 'congelada — retome quando houver liberação.', tone: 'yellow' };
    default:
      return { text: 'encerrada.', tone: 'blue' };
  }
}
