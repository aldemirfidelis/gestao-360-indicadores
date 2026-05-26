'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, FileDown, Send, Inbox, Clock, ArrowRight } from 'lucide-react';
import jsPDF from 'jspdf';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

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

const STATUS_LABEL: Record<string, string> = {
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

export default function AprovacoesCargoPage() {
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
      toast.success('Decisao registrada');
      setDecisionDialog({ open: false, row: null, decision: null });
      setDecisionNote('');
      qc.invalidateQueries({ queryKey: ['career-approvals'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao registrar decisao'),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api(`/strategy/career-approvals/${id}/cancel`, { method: 'PATCH' }),
    onSuccess: () => {
      toast.success('Solicitacao cancelada');
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
      doc.text('Relatorio de Aprovacao de Cargo', w / 2, y, { align: 'center' });
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

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Status:', margin, y);
      doc.setFont('helvetica', 'normal');
      const statusText = STATUS_LABEL[detail.status] ?? detail.status;
      const statusColor: [number, number, number] = detail.status === 'APPROVED' ? [22, 163, 74] : detail.status === 'REJECTED' ? [239, 68, 68] : [100, 116, 139];
      doc.setTextColor(...statusColor);
      doc.text(statusText, margin + 56, y);
      doc.setTextColor(0);
      y += 22;

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

      labelValue('Colaborador', detail.employee.name);
      if (detail.employee.registrationId) labelValue('Matricula', detail.employee.registrationId);
      if (detail.employee.orgNode) labelValue('Area / Setor', detail.employee.orgNode.name);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text('MOVIMENTACAO DE CARREIRA', margin, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(0);
      const move = `${detail.currentJob.name} (Faixa ${detail.currentBand})  ->  ${detail.targetJob.name} (Faixa ${detail.targetBand})`;
      doc.text(move, margin, y);
      y += 28;

      labelValue('Solicitante', `${detail.requester.name}${detail.requester.jobTitle ? ' • ' + detail.requester.jobTitle : ''}`);
      labelValue('Aprovador', `${detail.approver.name}${detail.approver.jobTitle ? ' • ' + detail.approver.jobTitle : ''} (${detail.approver.role})`);
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
        y += split.length * 12 + 16;
      }

      // Footer with signatures
      y = doc.internal.pageSize.getHeight() - 140;
      doc.setDrawColor(180);
      doc.line(margin, y, margin + 200, y);
      doc.line(w - margin - 200, y, w - margin, y);
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text(detail.requester.name, margin, y + 14);
      doc.text('Solicitante', margin, y + 26);
      doc.text(detail.approver.name, w - margin - 200, y + 14);
      doc.text('Aprovador', w - margin - 200, y + 26);

      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Documento gerado automaticamente em ${new Date().toLocaleString('pt-BR')}`, w / 2, doc.internal.pageSize.getHeight() - 32, { align: 'center' });

      const safeName = detail.employee.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      doc.save(`aprovacao-cargo-${safeName}-${detail.id.slice(0, 8)}.pdf`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao gerar relatorio');
    }
  };

  return (
    <div>
      <PageHeader
        title="Aprovacoes de Cargo"
        description="Solicitacoes de promocao e mudanca de cargo. Apenas o aprovador designado pode decidir cada caso."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard title="Pendentes" value={String(stats.pending)} description="Aguardando decisao" icon={<Clock className="h-4 w-4" />} tone="yellow" />
        <MetricCard title="Aprovadas" value={String(stats.approved)} description="Cargos liberados" icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
        <MetricCard title="Reprovadas" value={String(stats.rejected)} description="Recusas registradas" icon={<XCircle className="h-4 w-4" />} tone="red" />
        <MetricCard title="No filtro" value={String(stats.total)} description="Total exibido" icon={<Inbox className="h-4 w-4" />} tone="blue" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant={scope === 'mine' ? 'default' : 'outline'} size="sm" onClick={() => setScope('mine')}>
          Para minha aprovacao
        </Button>
        <Button variant={scope === 'requested' ? 'default' : 'outline'} size="sm" onClick={() => setScope('requested')}>
          Solicitadas por mim
        </Button>
        <Button variant={scope === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setScope('all')}>
          Todas
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Colaborador</th>
                <th className="p-3 text-left">Movimentacao</th>
                <th className="p-3 text-left">Solicitante</th>
                <th className="p-3 text-left">Aprovador</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Solicitado em</th>
                <th className="p-3 text-center">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isMyApproval = user?.id === row.approver.id && row.status === 'PENDING';
                const isMyRequest = user?.id === row.requester.id && row.status === 'PENDING';
                return (
                  <tr key={row.id} className="border-b hover:bg-muted/20 transition">
                    <td className="p-3">
                      <div className="font-semibold">{row.employee.name}</div>
                      {row.employee.orgNode && (
                        <div className="text-[11px] text-muted-foreground">{row.employee.orgNode.name}</div>
                      )}
                    </td>
                    <td className="p-3 text-xs">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium">{row.currentJob.name}</div>
                          <div className="text-muted-foreground">Faixa {row.currentBand}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-amber-600 shrink-0" />
                        <div>
                          <div className="font-medium text-amber-700">{row.targetJob.name}</div>
                          <div className="text-muted-foreground">Faixa {row.targetBand}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-xs">{row.requester.name}</td>
                    <td className="p-3 text-xs">{row.approver.name}</td>
                    <td className="p-3 text-center">
                      <span className={cn('inline-flex items-center rounded-md px-2 py-1 text-[10px] font-semibold border', STATUS_PILL[row.status])}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td className="p-3 text-center text-xs">{formatDate(row.createdAt)}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        {isMyApproval && (
                          <>
                            <Button size="sm" variant="default" className="h-7 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700" onClick={() => openDecision(row, 'APPROVED')}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 px-2 text-[10px]" onClick={() => openDecision(row, 'REJECTED')}>
                              <XCircle className="h-3 w-3 mr-1" /> Reprovar
                            </Button>
                          </>
                        )}
                        {isMyRequest && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => cancel.mutate(row.id)}>
                            Cancelar
                          </Button>
                        )}
                        {(row.status === 'APPROVED' || row.status === 'REJECTED') && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => downloadReport(row.id)} title="Baixar relatorio em PDF">
                            <FileDown className="h-3 w-3 mr-1" /> PDF
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && !query.isLoading && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                    Nenhuma solicitacao no filtro selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={decisionDialog.open} onOpenChange={(open) => setDecisionDialog({ ...decisionDialog, open })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {decisionDialog.decision === 'APPROVED' ? (
                <><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Aprovar movimentacao de cargo</>
              ) : (
                <><XCircle className="h-5 w-5 text-rose-600" /> Reprovar solicitacao</>
              )}
            </DialogTitle>
          </DialogHeader>
          {decisionDialog.row && (
            <div className="grid gap-3 text-xs">
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="font-semibold">{decisionDialog.row.employee.name}</div>
                <div className="mt-1 flex items-center gap-2">
                  <span>{decisionDialog.row.currentJob.name} • Faixa {decisionDialog.row.currentBand}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span className="text-amber-700 font-medium">{decisionDialog.row.targetJob.name} • Faixa {decisionDialog.row.targetBand}</span>
                </div>
                {decisionDialog.row.reason && (
                  <div className="mt-2 text-muted-foreground italic">&ldquo;{decisionDialog.row.reason}&rdquo;</div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Observacao do aprovador (opcional)</Label>
                <Textarea
                  rows={3}
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder={decisionDialog.decision === 'APPROVED' ? 'Comente os pontos considerados...' : 'Motivo da reprovacao...'}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDecisionDialog({ open: false, row: null, decision: null })}>Cancelar</Button>
            <Button
              onClick={submitDecision}
              disabled={decide.isPending}
              className={decisionDialog.decision === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}
            >
              {decisionDialog.decision === 'APPROVED' ? 'Confirmar aprovacao' : 'Confirmar reprovacao'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
