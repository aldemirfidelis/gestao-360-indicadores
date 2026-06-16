'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileDown,
  Inbox,
  Lock,
  RotateCcw,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { ACTION_STATUS_LABEL } from '@/lib/labels';

interface ApprovalRow {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  currentBand: string;
  targetBand: string;
  reason: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  employee: { id: string; name: string; registrationId: string | null; orgNode: { id: string; name: string } | null };
  requester: { id: string; name: string; email?: string };
  approver: { id: string; name: string; email?: string };
  currentJob: { id: string; name: string };
  targetJob: { id: string; name: string };
}

interface ApprovalDetail extends ApprovalRow {
  employee: ApprovalRow['employee'] & {
    job: { id: string; name: string };
    jobPretended: { id: string; name: string } | null;
  };
  company: { id: string; name: string; tradeName: string | null; cnpj: string | null };
  requester: ApprovalRow['requester'] & { jobTitle?: string | null };
  approver: ApprovalRow['approver'] & { jobTitle?: string | null; role: string };
}

interface EffectivenessActionRow {
  id: string;
  title: string;
  status: string;
  effectivenessStatus: string;
  priority: string;
  criticality: string;
  dueDate: string | null;
  completedAt: string | null;
  achievedResult: string | null;
  expectedResult: string | null;
  effectivenessSummary: string | null;
  effectivenessEvidence: string | null;
  responsibleUser: { id: string; name: string } | null;
  ownerNode: { id: string; name: string } | null;
  indicator: { id: string; name: string; code: string | null } | null;
}

interface GeneralApprovalRow {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  title: string;
  description: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  requester: { id: string; name: string; email: string } | null;
  approver: { id: string; name: string; email: string } | null;
  actionPlan: {
    id: string;
    title: string;
    status: string;
    deletedAt: string | null;
    ownerNode: { id: string; name: string } | null;
    responsibleUser: { id: string; name: string; email: string } | null;
  } | null;
}

const APPROVAL_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  REJECTED: 'Reprovado',
  CANCELLED: 'Cancelado',
};

const STATUS_PILL: Record<string, string> = {
  PENDING: 'bg-sky-100 text-sky-800 border-sky-300',
  APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  REJECTED: 'bg-rose-100 text-rose-800 border-rose-300',
  CANCELLED: 'bg-gray-100 text-gray-700 border-gray-300',
};

const EFFECTIVENESS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Não iniciado',
  PENDING: 'Pendente análise',
  IN_REVIEW: 'Em análise',
  EFFECTIVE: 'Eficaz',
  INEFFECTIVE: 'Ineficaz',
  REOPENED: 'Reaberto',
  NOT_APPLICABLE: 'N/A',
};

const EFFECTIVENESS_PILL: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-300',
  IN_REVIEW: 'bg-sky-100 text-sky-800 border-sky-300',
  EFFECTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  INEFFECTIVE: 'bg-rose-100 text-rose-800 border-rose-300',
  REOPENED: 'bg-purple-100 text-purple-800 border-purple-300',
  NOT_STARTED: 'bg-gray-100 text-gray-700 border-gray-300',
  NOT_APPLICABLE: 'bg-gray-100 text-gray-700 border-gray-300',
};

const ALLOWED_EFFECTIVENESS_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'DIRECTOR', 'MANAGER'];

export default function AprovacoesPage() {
  const search = useSearchParams();
  const requestedTab = search.get('tab');
  const defaultTab = requestedTab === 'eficácia' || requestedTab === 'gerais' ? requestedTab : 'cargo';

  return (
    <div>
      <PageHeader
        title="Aprovações"
        description="Central de aprovações de cargo, análise de eficácia e solicitações gerais."
      />

      <Card>
        <CardContent className="p-4">
          <Tabs defaultValue={defaultTab}>
            <TabsList>
              <TabsTrigger value="cargo">
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                Aprovações de Cargo
              </TabsTrigger>
              <TabsTrigger value="eficacia">
                <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
                Análise de Eficácia
              </TabsTrigger>
              <TabsTrigger value="gerais">
                <Inbox className="mr-1.5 h-3.5 w-3.5" />
                Aprovações Gerais
              </TabsTrigger>
            </TabsList>
            <TabsContent value="cargo">
              <CareerApprovalsContent />
            </TabsContent>
            <TabsContent value="eficacia">
              <EffectivenessApprovalsContent />
            </TabsContent>
            <TabsContent value="gerais">
              <GeneralApprovalsContent />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function CareerApprovalsContent() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [scope, setScope] = useState<'mine' | 'requested' | 'all'>('mine');
  const [decisionDialog, setDecisionDialog] = useState<{ open: boolean; row: ApprovalRow | null; decision: 'APPROVED' | 'REJECTED' | null }>({ open: false, row: null, decision: null });
  const [decisionNote, setDecisionNote] = useState('');

  const query = useQuery<ApprovalRow[]>({
    queryKey: ['career-approvals', scope],
    queryFn: () => api(`/strategy/career-approvals?scope=${scope}`),
  });

  const decide = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'APPROVED' | 'REJECTED'; note?: string }) =>
      api(`/strategy/career-approvals/${id}/decision`, { method: 'PATCH', json: { decision, decisionNote: note } }),
    onSuccess: () => {
      toast.success('Decisão registrada');
      setDecisionDialog({ open: false, row: null, decision: null });
      setDecisionNote('');
      qc.invalidateQueries({ queryKey: ['career-approvals'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao registrar decisão'),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api(`/strategy/career-approvals/${id}/cancel`, { method: 'PATCH' }),
    onSuccess: () => {
      toast.success('Solicitação cancelada');
      qc.invalidateQueries({ queryKey: ['career-approvals'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao cancelar'),
  });

  const rows = query.data ?? [];
  const stats = useMemo(() => ({
    pending: rows.filter((r) => r.status === 'PENDING').length,
    approved: rows.filter((r) => r.status === 'APPROVED').length,
    rejected: rows.filter((r) => r.status === 'REJECTED').length,
    total: rows.length,
  }), [rows]);

  const openDecision = (row: ApprovalRow, decision: 'APPROVED' | 'REJECTED') => {
    setDecisionDialog({ open: true, row, decision });
    setDecisionNote('');
  };

  const submitDecision = () => {
    if (!decisionDialog.row || !decisionDialog.decision) return;
    decide.mutate({
      id: decisionDialog.row.id,
      decision: decisionDialog.decision,
      note: decisionNote || undefined,
    });
  };

  const downloadReport = async (rowId: string) => {
    try {
      const detail = await api<ApprovalDetail>(`/strategy/career-approvals/${rowId}`);
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const w = doc.internal.pageSize.getWidth();
      const margin = 48;
      let y = 72;

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório de Aprovação de Cargo', w / 2, y, { align: 'center' });
      y += 12;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120);
      doc.text(detail.company.tradeName ?? detail.company.name, w / 2, y + 12, { align: 'center' });
      doc.setTextColor(0);
      y += 36;

      doc.setDrawColor(200);
      doc.line(margin, y, w - margin, y);
      y += 20;

      const labelValue = (label: string, value: string) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(label.toUpperCase(), margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.text(value || '-', margin, y + 14);
        y += 36;
      };

      labelValue('Status', APPROVAL_STATUS_LABEL[detail.status] ?? detail.status);
      labelValue('Colaborador', detail.employee.name);
      if (detail.employee.registrationId) labelValue('Matricula', detail.employee.registrationId);
      if (detail.employee.orgNode) labelValue('Área / Setor', detail.employee.orgNode.name);
      labelValue('Movimentação', `${detail.currentJob.name} (Faixa ${detail.currentBand}) -> ${detail.targetJob.name} (Faixa ${detail.targetBand})`);
      labelValue('Solicitante', `${detail.requester.name}${detail.requester.jobTitle ? ' - ' + detail.requester.jobTitle : ''}`);
      labelValue('Aprovador', `${detail.approver.name}${detail.approver.jobTitle ? ' - ' + detail.approver.jobTitle : ''} (${detail.approver.role})`);
      labelValue('Solicitado em', new Date(detail.createdAt).toLocaleString('pt-BR'));
      if (detail.decidedAt) labelValue('Decidido em', new Date(detail.decidedAt).toLocaleString('pt-BR'));

      if (detail.reason) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text('JUSTIFICATIVA', margin, y);
        y += 14;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0);
        const split = doc.splitTextToSize(detail.reason, w - margin * 2);
        doc.text(split, margin, y);
        y += split.length * 12 + 16;
      }

      if (detail.decisionNote) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text('OBSERVACAO DO APROVADOR', margin, y);
        y += 14;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0);
        const split = doc.splitTextToSize(detail.decisionNote, w - margin * 2);
        doc.text(split, margin, y);
      }

      const safeName = detail.employee.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      doc.save(`aprovação-cargo-${safeName}-${detail.id.slice(0, 8)}.pdf`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao gerar relatório');
    }
  };

  return (
    <div className="space-y-4">
      <StatGrid>
        <StatTile title="Pendentes" value={stats.pending} description="Aguardando decisão" icon={<Clock className="h-4 w-4" />} />
        <StatTile title="Aprovadas" value={stats.approved} description="Cargos liberados" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatTile title="Reprovadas" value={stats.rejected} description="Recusas registradas" icon={<XCircle className="h-4 w-4" />} />
        <StatTile title="No filtro" value={stats.total} description="Total exibido" icon={<Inbox className="h-4 w-4" />} />
      </StatGrid>

      <div className="flex flex-wrap gap-2">
        <Button variant={scope === 'mine' ? 'default' : 'outline'} size="sm" onClick={() => setScope('mine')}>Para minha aprovação</Button>
        <Button variant={scope === 'requested' ? 'default' : 'outline'} size="sm" onClick={() => setScope('requested')}>Solicitadas por mim</Button>
        <Button variant={scope === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setScope('all')}>Todas</Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Colaborador</th>
              <th className="p-3 text-left">Movimentação</th>
              <th className="p-3 text-left">Solicitante</th>
              <th className="p-3 text-left">Aprovador</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Solicitado em</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isMyApproval = user?.id === row.approver.id && row.status === 'PENDING';
              const isMyRequest = user?.id === row.requester.id && row.status === 'PENDING';
              return (
                <tr key={row.id} className="border-b transition hover:bg-muted/20">
                  <td className="p-3">
                    <div className="font-semibold">{row.employee.name}</div>
                    {row.employee.orgNode && <div className="text-[11px] text-muted-foreground">{row.employee.orgNode.name}</div>}
                  </td>
                  <td className="p-3 text-xs">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-medium">{row.currentJob.name}</div>
                        <div className="text-muted-foreground">Faixa {row.currentBand}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-amber-600" />
                      <div>
                        <div className="font-medium text-amber-700">{row.targetJob.name}</div>
                        <div className="text-muted-foreground">Faixa {row.targetBand}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-xs">{row.requester.name}</td>
                  <td className="p-3 text-xs">{row.approver.name}</td>
                  <td className="p-3 text-center">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="p-3 text-center text-xs">{formatDate(row.createdAt)}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      {isMyApproval && (
                        <>
                          <Button size="sm" className="h-7 bg-emerald-600 px-2 text-[10px] hover:bg-emerald-700" onClick={() => openDecision(row, 'APPROVED')}>
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Aprovar
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 px-2 text-[10px]" onClick={() => openDecision(row, 'REJECTED')}>
                            <XCircle className="mr-1 h-3 w-3" /> Reprovar
                          </Button>
                        </>
                      )}
                      {isMyRequest && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => cancel.mutate(row.id)}>
                          Cancelar
                        </Button>
                      )}
                      {(row.status === 'APPROVED' || row.status === 'REJECTED') && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => downloadReport(row.id)} title="Baixar relatório em PDF">
                          <FileDown className="mr-1 h-3 w-3" /> PDF
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !query.isLoading && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">Nenhuma solicitação no filtro selecionado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <DecisionDialog
        open={decisionDialog.open}
        title={decisionDialog.decision === 'APPROVED' ? 'Aprovar movimentação de cargo' : 'Reprovar solicitação'}
        description={decisionDialog.row?.employee.name ?? ''}
        note={decisionNote}
        setNote={setDecisionNote}
        confirmLabel={decisionDialog.decision === 'APPROVED' ? 'Confirmar aprovação' : 'Confirmar reprovação'}
        destructive={decisionDialog.decision === 'REJECTED'}
        onClose={() => setDecisionDialog({ open: false, row: null, decision: null })}
        onConfirm={submitDecision}
        loading={decide.isPending}
      />
    </div>
  );
}

function EffectivenessApprovalsContent() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const allowed = !!user && ALLOWED_EFFECTIVENESS_ROLES.includes(user.role);
  const [filter, setFilter] = useState<'PENDING' | 'IN_REVIEW' | 'EFFECTIVE' | 'INEFFECTIVE' | 'ALL'>('PENDING');
  const [dialog, setDialog] = useState<{ open: boolean; row: EffectivenessActionRow | null }>({ open: false, row: null });
  const [form, setForm] = useState({ effective: true, reopen: false, summary: '', evidence: '', achievedResult: '' });

  const query = useQuery<EffectivenessActionRow[]>({
    queryKey: ['actions', 'eficacia', filter],
    queryFn: () => {
      const q = filter === 'ALL' ? '' : `?effectivenessStatus=${filter}`;
      return api<EffectivenessActionRow[]>(`/actions${q}`);
    },
    enabled: allowed,
  });

  const validate = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      api(`/actions/${id}/effectiveness`, { method: 'POST', json: body }),
    onSuccess: () => {
      toast.success('Eficácia registrada');
      setDialog({ open: false, row: null });
      qc.invalidateQueries({ queryKey: ['actions', 'eficacia'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao registrar eficácia'),
  });

  const openDialog = (row: EffectivenessActionRow) => {
    setForm({
      effective: row.effectivenessStatus === 'EFFECTIVE',
      reopen: false,
      summary: row.effectivenessSummary ?? '',
      evidence: row.effectivenessEvidence ?? '',
      achievedResult: row.achievedResult ?? '',
    });
    setDialog({ open: true, row });
  };

  const actions = query.data ?? [];
  const stats = useMemo(() => ({
    pending: actions.filter((a) => ['PENDING', 'IN_REVIEW', 'REOPENED'].includes(a.effectivenessStatus)).length,
    effective: actions.filter((a) => a.effectivenessStatus === 'EFFECTIVE').length,
    ineffective: actions.filter((a) => a.effectivenessStatus === 'INEFFECTIVE').length,
    total: actions.length,
  }), [actions]);

  if (!user) return null;
  if (!allowed) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center">
        <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
        <div className="mt-3 text-lg font-semibold">Acesso restrito</div>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Apenas usuários com perfil SUPER_ADMIN, COMPANY_ADMIN, DIRECTOR ou MANAGER podem realizar a Análise de Eficácia.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StatGrid>
        <StatTile title="Aguardando análise" value={stats.pending} description="Pendente / em análise / reaberto" icon={<ClipboardCheck className="h-4 w-4" />} />
        <StatTile title="Eficazes" value={stats.effective} description="Ações validadas" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatTile title="Ineficazes" value={stats.ineffective} description="Resultado não atingido" icon={<XCircle className="h-4 w-4" />} />
        <StatTile title="No filtro" value={stats.total} description="Total exibido" icon={<ShieldCheck className="h-4 w-4" />} />
      </StatGrid>

      <div className="flex flex-wrap gap-2">
        {(['PENDING', 'IN_REVIEW', 'EFFECTIVE', 'INEFFECTIVE', 'ALL'] as const).map((s) => (
          <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm" onClick={() => setFilter(s)}>
            {s === 'ALL' ? 'Todas' : EFFECTIVENESS_LABEL[s]}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Ação</th>
              <th className="p-3 text-left">Indicador</th>
              <th className="p-3 text-left">Responsável</th>
              <th className="p-3 text-center">Status ação</th>
              <th className="p-3 text-center">Eficácia</th>
              <th className="p-3 text-center">Concluída em</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a) => (
              <tr key={a.id} className="border-b transition hover:bg-muted/20">
                <td className="p-3">
                  <Link href={`/actions/${a.id}`} className="font-semibold hover:underline">{a.title}</Link>
                  {a.ownerNode && <div className="text-[11px] text-muted-foreground">{a.ownerNode.name}</div>}
                </td>
                <td className="p-3 text-xs">
                  {a.indicator ? (
                    <>
                      {a.indicator.code && <span className="mr-1 font-mono text-muted-foreground">[{a.indicator.code}]</span>}
                      {a.indicator.name}
                    </>
                  ) : '-'}
                </td>
                <td className="p-3 text-xs">{a.responsibleUser?.name ?? '-'}</td>
                <td className="p-3 text-center text-xs font-medium">{ACTION_STATUS_LABEL[a.status] ?? a.status}</td>
                <td className="p-3 text-center">
                  <span className={cn('inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-semibold', EFFECTIVENESS_PILL[a.effectivenessStatus] ?? EFFECTIVENESS_PILL.NOT_STARTED)}>
                    {EFFECTIVENESS_LABEL[a.effectivenessStatus] ?? a.effectivenessStatus}
                  </span>
                </td>
                <td className="p-3 text-center text-xs">{formatDate(a.completedAt)}</td>
                <td className="p-3 text-center">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => openDialog(a)}>
                    <ShieldCheck className="mr-1 h-3 w-3" /> Analisar
                  </Button>
                </td>
              </tr>
            ))}
            {actions.length === 0 && !query.isLoading && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">Nenhuma ação no filtro selecionado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog({ open, row: open ? dialog.row : null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Analisar eficácia
            </DialogTitle>
          </DialogHeader>
          {dialog.row && (
            <div className="grid gap-4 text-sm">
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="font-semibold">{dialog.row.title}</div>
                {dialog.row.expectedResult && (
                  <div className="mt-2 text-xs">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Resultado esperado</div>
                    <div>{dialog.row.expectedResult}</div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ChoiceButton active={form.effective && !form.reopen} onClick={() => setForm({ ...form, effective: true, reopen: false })} icon={<CheckCircle2 className="mb-1 h-5 w-5 text-emerald-600" />} title="Eficaz" description="Resultado atingido" />
                <ChoiceButton active={!form.effective && !form.reopen} onClick={() => setForm({ ...form, effective: false, reopen: false })} icon={<XCircle className="mb-1 h-5 w-5 text-rose-600" />} title="Ineficaz" description="Resultado não atingido" />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input type="checkbox" checked={form.reopen} onChange={(e) => setForm({ ...form, reopen: e.target.checked })} className="h-4 w-4 rounded" />
                <RotateCcw className="h-3.5 w-3.5" /> Reabrir ação
              </label>
              <FieldText label="Resultado alcançado" value={form.achievedResult} onChange={(achievedResult) => setForm({ ...form, achievedResult })} rows={2} />
              <FieldText label="Resumo da análise" value={form.summary} onChange={(summary) => setForm({ ...form, summary })} rows={3} />
              <div className="space-y-2">
                <Label>Evidências</Label>
                <Input value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })} placeholder="Links, códigos de documentos, etc." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog({ open: false, row: null })}>Cancelar</Button>
            <Button onClick={() => dialog.row && validate.mutate({ id: dialog.row.id, body: form })} disabled={validate.isPending}>
              {form.reopen ? <><RotateCcw className="mr-2 h-4 w-4" /> Reabrir</> : form.effective ? <><CheckCircle2 className="mr-2 h-4 w-4" /> Validar como eficaz</> : <><AlertTriangle className="mr-2 h-4 w-4" /> Marcar como ineficaz</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GeneralApprovalsContent() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canDecide = hasPermission(['actions:delete', 'actions:approve', 'actions:manage']);
  const [scope, setScope] = useState<'pending' | 'requested' | 'all'>('pending');
  const [dialog, setDialog] = useState<{ open: boolean; row: GeneralApprovalRow | null; decision: 'APPROVED' | 'REJECTED' | null }>({ open: false, row: null, decision: null });
  const [decisionNote, setDecisionNote] = useState('');

  const query = useQuery<GeneralApprovalRow[]>({
    queryKey: ['actions', 'general-approvals', scope],
    queryFn: () => api<GeneralApprovalRow[]>(`/actions/general-approvals?scope=${scope}`),
  });

  const decide = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'APPROVED' | 'REJECTED'; note?: string }) =>
      api(`/actions/general-approvals/${id}/decision`, { method: 'PATCH', json: { decision, decisionNote: note } }),
    onSuccess: () => {
      toast.success('Decisão registrada');
      setDialog({ open: false, row: null, decision: null });
      setDecisionNote('');
      qc.invalidateQueries({ queryKey: ['actions', 'general-approvals'] });
      qc.invalidateQueries({ queryKey: ['actions'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao registrar decisão'),
  });

  const rows = query.data ?? [];
  const stats = useMemo(() => ({
    pending: rows.filter((r) => r.status === 'PENDING').length,
    approved: rows.filter((r) => r.status === 'APPROVED').length,
    rejected: rows.filter((r) => r.status === 'REJECTED').length,
    total: rows.length,
  }), [rows]);

  const submitDecision = () => {
    if (!dialog.row || !dialog.decision) return;
    decide.mutate({ id: dialog.row.id, decision: dialog.decision, note: decisionNote || undefined });
  };

  return (
    <div className="space-y-4">
      <StatGrid>
        <StatTile title="Pendentes" value={stats.pending} description="Aguardando gestão" icon={<Clock className="h-4 w-4" />} />
        <StatTile title="Aprovadas" value={stats.approved} description="Solicitações liberadas" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatTile title="Reprovadas" value={stats.rejected} description="Solicitações recusadas" icon={<XCircle className="h-4 w-4" />} />
        <StatTile title="No filtro" value={stats.total} description="Total exibido" icon={<Inbox className="h-4 w-4" />} />
      </StatGrid>

      <div className="flex flex-wrap gap-2">
        <Button variant={scope === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setScope('pending')}>Pendentes</Button>
        <Button variant={scope === 'requested' ? 'default' : 'outline'} size="sm" onClick={() => setScope('requested')}>Solicitadas por mim</Button>
        <Button variant={scope === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setScope('all')}>Todas</Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Solicitação</th>
              <th className="p-3 text-left">Plano relacionado</th>
              <th className="p-3 text-left">Solicitante</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Solicitado em</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b transition hover:bg-muted/20">
                <td className="p-3">
                  <div className="flex items-center gap-2 font-semibold">
                    <Trash2 className="h-4 w-4 text-status-red" />
                    {generalTypeLabel(row.type)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{row.reason ?? row.description ?? row.title}</div>
                  {row.decisionNote && <div className="mt-1 text-xs">Decisão: {row.decisionNote}</div>}
                </td>
                <td className="p-3 text-xs">
                  {row.actionPlan ? (
                    <>
                      <Link href={`/actions/${row.actionPlan.id}`} className="font-semibold hover:underline">{row.actionPlan.title}</Link>
                      <div className="text-muted-foreground">
                        {ACTION_STATUS_LABEL[row.actionPlan.status] ?? row.actionPlan.status}
                        {row.actionPlan.deletedAt ? ' - eliminado' : ''}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Registro não encontrado</span>
                  )}
                </td>
                <td className="p-3 text-xs">{row.requester?.name ?? '-'}</td>
                <td className="p-3 text-center"><StatusPill status={row.status} /></td>
                <td className="p-3 text-center text-xs">{formatDate(row.createdAt)}</td>
                <td className="p-3 text-center">
                  {row.status === 'PENDING' && canDecide ? (
                    <div className="flex justify-center gap-1">
                      <Button size="sm" className="h-7 bg-emerald-600 px-2 text-[10px] hover:bg-emerald-700" onClick={() => setDialog({ open: true, row, decision: 'APPROVED' })}>
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Aprovar
                      </Button>
                      <Button size="sm" variant="destructive" className="h-7 px-2 text-[10px]" onClick={() => setDialog({ open: true, row, decision: 'REJECTED' })}>
                        <XCircle className="mr-1 h-3 w-3" /> Reprovar
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">{row.approver?.name ?? '-'}</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !query.isLoading && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">Nenhuma aprovação geral no filtro selecionado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <DecisionDialog
        open={dialog.open}
        title={dialog.decision === 'APPROVED' ? 'Aprovar solicitação geral' : 'Reprovar solicitação geral'}
        description={dialog.row?.title ?? ''}
        note={decisionNote}
        setNote={setDecisionNote}
        confirmLabel={dialog.decision === 'APPROVED' ? 'Confirmar aprovação' : 'Confirmar reprovação'}
        destructive={dialog.decision === 'REJECTED'}
        onClose={() => setDialog({ open: false, row: null, decision: null })}
        onConfirm={submitDecision}
        loading={decide.isPending}
      />
    </div>
  );
}

function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>;
}

function StatTile({ title, value, description, icon }: { title: string; value: number; description: string; icon: ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{title}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-semibold', STATUS_PILL[status] ?? STATUS_PILL.PENDING)}>
      {APPROVAL_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function DecisionDialog({
  open,
  title,
  description,
  note,
  setNote,
  confirmLabel,
  destructive,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  title: string;
  description: string;
  note: string;
  setNote: (value: string) => void;
  confirmLabel: string;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {description && <div className="rounded-md border bg-muted/30 p-3 text-sm font-semibold">{description}</div>}
          <div className="space-y-2">
            <Label>Observação do aprovador</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Registre um comentário para a decisão..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={loading} variant={destructive ? 'destructive' : 'default'}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChoiceButton({ active, onClick, icon, title, description }: { active: boolean; onClick: () => void; icon: ReactNode; title: string; description: string }) {
  return (
    <button
      type="button"
      className={cn('rounded-md border p-3 text-left transition hover:bg-accent/30', active && 'border-primary bg-primary/5 ring-2 ring-primary/20')}
      onClick={onClick}
    >
      {icon}
      <div className="font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
    </button>
  );
}

function FieldText({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function generalTypeLabel(type: string) {
  if (type === 'ACTION_PLAN_DELETION') return 'Eliminação de plano de ação';
  return type;
}
