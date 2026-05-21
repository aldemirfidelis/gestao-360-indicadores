'use client';

import { Download, FileText, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api, getAccessToken } from '@/lib/api';
import { formatDate, formatNumber, formatPercent, periodRefLabel } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';

interface Indicator {
  id: string;
  name: string;
  code: string | null;
  type: string;
  ownerNode: { name: string };
  last: { periodRef: string; value: number; light: string; attainment: number | null } | null;
}

interface Overview {
  totalIndicators: number;
  counts: { GREEN: number; YELLOW: number; RED: number; GRAY: number };
  generalAttainment: number | null;
  openActions: number;
  overdueActions: number;
  criticalDeviations: number;
}

const CSV_REPORTS = [
  { key: 'indicators', label: 'Indicadores (CSV)', description: 'Catalogo completo com ultimo realizado.', url: '/reports/indicators.csv' },
  { key: 'results', label: 'Lancamentos (CSV)', description: 'Historico de realizados com farol e atingimento.', url: '/reports/results.csv' },
  { key: 'actions', label: 'Acoes (CSV)', description: 'Planos de acao com status, prazos e responsaveis.', url: '/reports/actions.csv' },
  { key: 'deviations', label: 'Desvios (CSV)', description: 'Desvios com severidade, status e prazos.', url: '/reports/deviations.csv' },
];

export default function ReportsPage() {
  const overview = useQuery<Overview>({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => api<Overview>('/dashboard/overview'),
  });
  const indicators = useQuery<Indicator[]>({
    queryKey: ['indicators'],
    queryFn: () => api<Indicator[]>('/indicators'),
  });

  const downloadCsv = async (path: string, filename: string) => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_URL}${path}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Download iniciado');
    } catch (e: any) {
      toast.error(`Falha ao baixar: ${e.message}`);
    }
  };

  const generateExecutivePdf = () => {
    if (!overview.data || !indicators.data) {
      toast.error('Aguarde os dados carregarem');
      return;
    }
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt' });
    const o = overview.data;
    doc.setFontSize(18);
    doc.text('Relatorio Executivo - Gestao 360 Indicadores', 40, 50);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em ${formatDate(new Date())}`, 40, 68);
    doc.setTextColor(0);

    // Resumo
    doc.setFontSize(13);
    doc.text('Resumo', 40, 110);
    autoTable(doc, {
      startY: 120,
      head: [['Metrica', 'Valor']],
      body: [
        ['Indicadores ativos', String(o.totalIndicators)],
        ['No alvo (verde)', String(o.counts.GREEN)],
        ['Em atencao (amarelo)', String(o.counts.YELLOW)],
        ['Criticos (vermelho)', String(o.counts.RED)],
        ['Sem dados (cinza)', String(o.counts.GRAY)],
        ['Atingimento medio', formatPercent(o.generalAttainment ?? 0)],
        ['Acoes em aberto', String(o.openActions)],
        ['Acoes atrasadas', String(o.overdueActions)],
        ['Desvios criticos', String(o.criticalDeviations)],
      ],
      theme: 'striped',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 9 },
    });

    // Indicadores
    const finalY = (doc as any).lastAutoTable.finalY + 30;
    doc.setFontSize(13);
    doc.text('Indicadores ativos', 40, finalY);
    autoTable(doc, {
      startY: finalY + 10,
      head: [['Codigo', 'Indicador', 'Area', 'Periodo', 'Realizado', 'Farol']],
      body: indicators.data.map((i) => [
        i.code ?? '—',
        i.name,
        i.ownerNode.name,
        i.last ? periodRefLabel(i.last.periodRef) : '—',
        i.last ? formatNumber(i.last.value) : '—',
        i.last?.light ?? 'GRAY',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 8 },
    });

    doc.save(`relatorio-executivo-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('PDF gerado');
  };

  return (
    <div>
      <PageHeader
        title="Relatorios"
        description="Exporte dados estruturados para Excel/CSV ou um sumario executivo em PDF."
      />

      <Card className="mb-6">
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Relatorio Executivo (PDF)</h3>
            <p className="text-sm text-muted-foreground">
              Sumario com KPIs, faroes e lista de indicadores ativos. Gerado on-the-fly no navegador.
            </p>
          </div>
          <Button onClick={generateExecutivePdf}>
            <FileText className="h-4 w-4 mr-2" /> Gerar PDF
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CSV_REPORTS.map((r) => (
          <Card key={r.key}>
            <CardContent className="p-5 flex items-start gap-4">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{r.label}</h3>
                <p className="text-sm text-muted-foreground">{r.description}</p>
              </div>
              <Button variant="outline" onClick={() => downloadCsv(r.url, `${r.key}.csv`)}>
                <Download className="h-4 w-4 mr-2" /> Baixar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
