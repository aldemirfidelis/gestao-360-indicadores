'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText, FileDown, Send, CheckCircle2, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

interface CompetenceRef { id: string; label: string; program: { code: string; name: string } }
interface PayslipRow { id: string; registration: string; name: string; version: number; status: string; finalValue: string | null; publishedAt: string | null; acknowledgedAt: string | null }
interface PayslipFull { id: string; data: any }

const money = (v: number | null | undefined) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const STATUS: Record<string, { label: string; variant: any }> = {
  GENERATED: { label: 'Gerado', variant: 'secondary' }, PUBLISHED: { label: 'Publicado', variant: 'default' },
  SUPERSEDED: { label: 'Substituído', variant: 'outline' }, DRAFT: { label: 'Rascunho', variant: 'secondary' },
};

function buildPdf(d: any) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  let y = 40;
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('Demonstrativo de Pagamento — Prêmio Mensal', W / 2, y, { align: 'center' });
  y += 16; doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(`${d.company?.name ?? ''} · ${d.program?.code ?? ''} ${d.program?.name ?? ''} · Competência ${d.competence?.label ?? ''}`, W / 2, y, { align: 'center' });
  y += 20;

  const e = d.employee ?? {};
  autoTable(doc, {
    startY: y, theme: 'plain', styles: { fontSize: 9, cellPadding: 1 },
    body: [
      ['Colaborador', `${e.name ?? ''} (${e.registration ?? ''})`, 'CPF', e.cpfMasked ?? '—'],
      ['Área', e.area ?? '—', 'Cargo', e.position ?? '—'],
      ['Centro de custo', e.costCenter ?? '—', 'Unidade', e.unit ?? '—'],
      ['Salário considerado', money(e.baseSalary), 'Dias trabalhados', String(e.workedDays ?? '—')],
    ],
    columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } },
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  const p = d.prize ?? {};
  autoTable(doc, {
    startY: y, head: [['Resumo do prêmio', 'Valor']], theme: 'striped', styles: { fontSize: 9 }, headStyles: { fillColor: [40, 80, 140] },
    body: [
      ['Potencial de prêmio', money(p.potential)],
      ['Atingimento ponderado', p.weightedGain != null ? `${p.weightedGain}%` : '—'],
      ['Proporcionalidade', p.proportionality != null ? String(p.proportionality) : '—'],
      ['Prêmio bruto', money(p.grossValue)],
      ['Total de reduções (moderadores)', `- ${money(p.totalReductions)}`],
      ['Ajustes aprovados', money(p.adjustments)],
      ...(p.gratification ? [['Gratificação de treinamento', money(p.gratification)]] : []),
      ['PRÊMIO FINAL', money(p.finalValue)],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  if (Array.isArray(d.memory) && d.memory.length) {
    autoTable(doc, {
      startY: y, head: [['#', 'Etapa', 'Detalhe', 'Valor']], theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [90, 90, 90] },
      body: d.memory.map((l: any) => [l.step, l.label, l.detail ?? '', l.value == null ? '' : Number(l.value).toLocaleString('pt-BR')]),
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  doc.setFontSize(8); doc.setTextColor(120);
  const meta = d.meta ?? {};
  doc.text(`Versão do cálculo: ${meta.calcVersion ?? '—'} · Motor: ${meta.engineVersion ?? '—'} · ID: ${meta.hash ?? '—'} · Emitido em ${meta.emittedAt ? new Date(meta.emittedAt).toLocaleString('pt-BR') : '—'}`, 40, y);
  y += 12;
  doc.text(d.channel ?? '', 40, y);
  return doc;
}

export default function PrizePayslipsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canPublish = hasPermission(['prize:payslip:publish']);

  const [competenceId, setCompetenceId] = useState('');
  const { data: competences = [] } = useQuery({ queryKey: ['prize-competences-ref'], queryFn: () => api<CompetenceRef[]>('/prize/competences') });
  const { data: payslips = [], isLoading } = useQuery({ queryKey: ['prize-payslips', competenceId], queryFn: () => api<PayslipRow[]>(`/prize/payslips/competence/${competenceId}`), enabled: !!competenceId });

  const inval = () => qc.invalidateQueries({ queryKey: ['prize-payslips'] });
  const onErr = (e: ApiError) => toast.error(e.message);

  const generate = useMutation({ mutationFn: () => api(`/prize/payslips/competence/${competenceId}/generate`, { method: 'POST' }), onSuccess: (r: any) => { toast.success(`${r.created} espelho(s) emitido(s)`); inval(); }, onError: onErr });
  const publishAll = useMutation({ mutationFn: () => api(`/prize/payslips/competence/${competenceId}/publish`, { method: 'POST' }), onSuccess: (r: any) => { toast.success(`${r.published} espelho(s) publicado(s)`); inval(); }, onError: onErr });
  const publishOne = useMutation({ mutationFn: (id: string) => api(`/prize/payslips/${id}/publish`, { method: 'POST' }), onSuccess: () => { toast.success('Publicado'); inval(); }, onError: onErr });
  const acknowledge = useMutation({ mutationFn: (id: string) => api(`/prize/payslips/${id}/acknowledge`, { method: 'POST' }), onSuccess: () => { toast.success('Ciência registrada'); inval(); }, onError: onErr });

  async function openPdf(id: string, reg: string) {
    try {
      const full = await api<PayslipFull>(`/prize/payslips/${id}`);
      const doc = buildPdf(full.data);
      doc.save(`espelho-${reg}.pdf`);
    } catch (e: any) { toast.error('Erro ao gerar PDF'); }
  }

  return (
    <div>
      <PageHeader
        title="Espelhos do Prêmio"
        eyebrow="Gestão de Prêmio"
        description="Demonstrativo individual com memória de cálculo. Emissão em lote, publicação versionada e controle de ciência."
        tone="view"
        breadcrumbs={[{ label: 'Gestão de Prêmio', href: '/gestao-premio' }, { label: 'Espelhos do Prêmio' }]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Label className="text-xs text-muted-foreground">Competência:</Label>
        <NativeSelect value={competenceId} onChange={(e) => setCompetenceId(e.target.value)} className="max-w-sm">
          <option value="">Selecione…</option>
          {competences.map((c) => <option key={c.id} value={c.id}>{c.program.code} — {c.label}</option>)}
        </NativeSelect>
        {canPublish && competenceId && (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => generate.mutate()} disabled={generate.isPending}><Plus className="mr-1 h-4 w-4" />Emitir espelhos</Button>
            <Button onClick={() => publishAll.mutate()} disabled={publishAll.isPending}><Send className="mr-1 h-4 w-4" />Publicar todos</Button>
          </div>
        )}
      </div>

      {!competenceId ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Selecione uma competência para emitir os espelhos a partir da apuração.</p>
        </CardContent></Card>
      ) : isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : payslips.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum espelho emitido. Clique em "Emitir espelhos" (requer apuração rodada).</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground">
                <tr><th className="px-3 py-2 text-left">Colaborador</th><th className="px-3 py-2 text-right">Final</th><th className="px-3 py-2 text-left">Versão</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Ciência</th><th className="px-3 py-2"></th></tr>
              </thead>
              <tbody>
                {payslips.map((p) => (
                  <tr key={p.id} className="border-b border-border/40">
                    <td className="px-3 py-2"><div className="font-medium">{p.name}</div><div className="font-mono text-xs text-muted-foreground">{p.registration}</div></td>
                    <td className="px-3 py-2 text-right font-semibold">{money(Number(p.finalValue))}</td>
                    <td className="px-3 py-2">v{p.version}</td>
                    <td className="px-3 py-2"><Badge variant={STATUS[p.status]?.variant}>{STATUS[p.status]?.label ?? p.status}</Badge></td>
                    <td className="px-3 py-2">{p.acknowledgedAt ? <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />ciente</span> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => openPdf(p.id, p.registration)}><FileDown className="mr-1 h-3.5 w-3.5" />PDF</Button>
                      {canPublish && p.status === 'GENERATED' && <Button size="sm" variant="ghost" onClick={() => publishOne.mutate(p.id)}>Publicar</Button>}
                      {p.status === 'PUBLISHED' && !p.acknowledgedAt && <Button size="sm" variant="ghost" onClick={() => acknowledge.mutate(p.id)}>Dar ciência</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
