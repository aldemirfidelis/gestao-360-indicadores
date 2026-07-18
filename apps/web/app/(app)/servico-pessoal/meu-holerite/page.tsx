'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { CheckCircle2, Download, FileText, Trophy, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';

interface Payslip { id: string; netPay: string; run: { kind: string; competence: { year: number; month: number } } }
interface PayslipDetail {
  netPay: string; totalEarnings: string; totalDeductions: string;
  items: Array<{ rubricCode: string; rubricName: string; nature: string; reference: string | null; amount: string }>;
  employee: { name: string; registrationId: string | null } | null;
  run: { competence: { year: number; month: number } };
}
interface IncomeReport {
  year: number;
  employee: { name: string; cpf: string | null } | null;
  months: Array<{ month: number; kind: string; earnings: number; inss: number; irrf: number; net: number }>;
  totals: { earnings: number; inss: number; irrf: number; fgts: number; taxable: number } | null;
}
interface PrizePayslip { id: string; competence: string; finalValue: string | null; publishedAt: string | null; acknowledgedAt: string | null }

const MONTHS = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const money = (v: number | string) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function MyPayslipPage() {
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear - 1);

  const payslipsQuery = useQuery<Payslip[]>({ queryKey: ['my-payslips'], queryFn: () => api('/payroll/my-payslips') });
  const incomeQuery = useQuery<IncomeReport>({ queryKey: ['my-income-report', year], queryFn: () => api(`/payroll/my-income-report?year=${year}`) });
  const prizeQuery = useQuery<PrizePayslip[]>({ queryKey: ['my-prize-payslips'], queryFn: () => api('/prize/payslips/mine') });

  const payslips = payslipsQuery.data ?? [];
  const income = incomeQuery.data;
  const prizePayslips = prizeQuery.data ?? [];

  const acknowledgePrize = useMutation({
    mutationFn: (id: string) => api(`/prize/payslips/mine/${id}/acknowledge`, { method: 'POST' }),
    onSuccess: () => { toast.success('Ciência registrada.'); void qc.invalidateQueries({ queryKey: ['my-prize-payslips'] }); },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível registrar a ciência.'),
  });

  async function downloadHolerite(id: string, comp: string) {
    try {
      const d = await api<PayslipDetail>(`/payroll/my-payslips/${id}`);
      const doc = new jsPDF();
      let y = 16;
      doc.setFontSize(14); doc.text('Demonstrativo de Pagamento (Holerite)', 14, y); y += 8;
      doc.setFontSize(10);
      doc.text(`Colaborador: ${d.employee?.name ?? ''}`, 14, y); y += 6;
      doc.text(`Matrícula: ${d.employee?.registrationId ?? '—'}    Competência: ${comp}`, 14, y); y += 8;
      doc.setFontSize(9);
      doc.text('Cód', 14, y); doc.text('Descrição', 28, y); doc.text('Ref.', 120, y); doc.text('Provento', 150, y); doc.text('Desconto', 180, y); y += 2;
      doc.line(14, y, 196, y); y += 5;
      for (const it of d.items.filter((i) => i.nature === 'PROVENTO' || i.nature === 'DESCONTO')) {
        doc.text(it.rubricCode, 14, y);
        doc.text(it.rubricName.slice(0, 48), 28, y);
        doc.text(it.reference ?? '', 120, y);
        if (it.nature === 'PROVENTO') doc.text(money(it.amount), 150, y);
        else doc.text(money(it.amount), 180, y);
        y += 5;
        if (y > 270) { doc.addPage(); y = 20; }
      }
      y += 2; doc.line(14, y, 196, y); y += 6;
      doc.setFontSize(10);
      doc.text(`Total proventos: ${money(d.totalEarnings)}`, 14, y);
      doc.text(`Total descontos: ${money(d.totalDeductions)}`, 90, y); y += 6;
      doc.setFont('helvetica', 'bold');
      doc.text(`Líquido a receber: ${money(d.netPay)}`, 14, y);
      doc.setFont('helvetica', 'normal');
      y += 10; doc.setFontSize(8);
      doc.text('Documento para conferência interna. Não substitui o comprovante oficial.', 14, y);
      doc.save(`Holerite-${comp}.pdf`);
    } catch (e: any) { toast.error(e.message || 'Erro ao gerar o holerite.'); }
  }

  function downloadIncomePdf() {
    if (!income?.totals) { toast.info('Sem dados no ano.'); return; }
    const doc = new jsPDF();
    let y = 16;
    doc.setFontSize(14); doc.text(`Informe de Rendimentos — ${income.year}`, 14, y); y += 8;
    doc.setFontSize(10);
    doc.text(`Colaborador: ${income.employee?.name ?? ''}`, 14, y); y += 6;
    doc.text(`CPF: ${income.employee?.cpf ?? '—'}`, 14, y); y += 8;
    doc.setFontSize(9);
    doc.text('Mês', 14, y); doc.text('Rendimentos', 50, y); doc.text('INSS', 100, y); doc.text('IRRF', 140, y); doc.text('Líquido', 175, y); y += 2;
    doc.line(14, y, 196, y); y += 5;
    for (const m of income.months) {
      doc.text(MONTHS[m.month], 14, y); doc.text(money(m.earnings), 50, y); doc.text(money(m.inss), 100, y); doc.text(money(m.irrf), 140, y); doc.text(money(m.net), 175, y); y += 5;
    }
    y += 2; doc.line(14, y, 196, y); y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total rendimentos: ${money(income.totals.earnings)}`, 14, y); y += 6;
    doc.text(`Base tributável: ${money(income.totals.taxable)}   INSS: ${money(income.totals.inss)}   IRRF: ${money(income.totals.irrf)}`, 14, y);
    doc.setFont('helvetica', 'normal'); y += 10; doc.setFontSize(8);
    doc.text('Documento para conferência. Não substitui o Comprovante de Rendimentos oficial da Receita Federal.', 14, y);
    doc.save(`InformeRendimentos-${income.year}.pdf`);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Minha Vida Funcional" description="Seus holerites e informe de rendimentos." />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-sky-500" /> Informe de Rendimentos</CardTitle>
          <div className="flex items-center gap-2">
            <NativeSelect className="h-8 w-24 text-xs" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[currentYear - 1, currentYear - 2, currentYear - 3, currentYear].map((y) => <option key={y} value={y}>{y}</option>)}
            </NativeSelect>
            <Button size="sm" variant="outline" onClick={downloadIncomePdf} disabled={!income?.totals}><Download className="mr-1 h-3.5 w-3.5" /> PDF</Button>
          </div>
        </CardHeader>
        <CardContent className="text-xs">
          {income?.totals ? (
            <div className="flex flex-wrap gap-4">
              <div><div className="text-[10px] uppercase text-muted-foreground">Rendimentos</div><div className="text-lg font-bold">{money(income.totals.earnings)}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground">Base tributável</div><div className="text-lg font-bold">{money(income.totals.taxable)}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground">INSS</div><div className="text-lg font-bold">{money(income.totals.inss)}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground">IRRF</div><div className="text-lg font-bold">{money(income.totals.irrf)}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground">FGTS</div><div className="text-lg font-bold">{money(income.totals.fgts)}</div></div>
            </div>
          ) : <div className="py-4 text-muted-foreground">Sem folhas fechadas em {year}.</div>}
        </CardContent>
      </Card>

      {prizePayslips.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Trophy className="h-4 w-4 text-amber-500" /> Meu Prêmio / PLR</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {prizePayslips.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-[10px]">{p.competence}</Badge>
                    {p.acknowledgedAt ? (
                      <Badge variant="outline" className="border-status-green/40 text-[10px] text-status-green">Ciência dada</Badge>
                    ) : (
                      <Badge variant="outline" className="border-status-yellow/40 text-[10px] text-status-yellow">Aguardando ciência</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{p.finalValue != null ? money(p.finalValue) : '—'}</span>
                    {!p.acknowledgedAt && (
                      <Button size="sm" variant="outline" disabled={acknowledgePrize.isPending} onClick={() => acknowledgePrize.mutate(p.id)}>
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Dar ciência
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">Demonstrativo do prêmio de remuneração variável publicado para você. A ciência confirma que você visualizou o valor.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Wallet className="h-4 w-4 text-emerald-500" /> Meus Holerites</CardTitle></CardHeader>
        <CardContent className="p-0">
          {payslips.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhum holerite disponível ainda (aparecem após o fechamento da folha).</div>
          ) : (
            <div className="divide-y">
              {payslips.map((p) => {
                const comp = `${p.run.competence.year}-${String(p.run.competence.month).padStart(2, '0')}`;
                return (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-[10px]">{p.run.kind}</Badge>
                      <span className="font-medium">{MONTHS[p.run.competence.month]} / {p.run.competence.year}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{money(p.netPay)}</span>
                      <Button size="sm" variant="outline" onClick={() => downloadHolerite(p.id, comp)}><Download className="mr-1 h-3.5 w-3.5" /> PDF</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
