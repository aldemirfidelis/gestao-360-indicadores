'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, FileSpreadsheet, FileText, Printer, Save, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { FilterBar } from '@/components/platform/filter-bar';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
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
  { key: 'indicators', label: 'Relatorio por indicador', description: 'Catalogo completo com último realizado.', url: '/reports/indicators.csv' },
  { key: 'results', label: 'Histórico de lançamentos', description: 'Realizados, farois, metas e atingimento.', url: '/reports/results.csv' },
  { key: 'actions', label: 'Planos de ação', description: 'Status, prazos, responsáveis e prioridades.', url: '/reports/actions.csv' },
  { key: 'deviations', label: 'Não conformidades', description: 'Severidade, tratativas, prazos e histórico.', url: '/reports/deviations.csv' },
];

export default function ReportsPage() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [scope, setScope] = useState('ALL');
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
    doc.text('Relatorio Executivo - Gestão 360 Indicadores', 40, 50);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Período: ${periodRefLabel(period)} | Escopo: ${scope} | Gerado em ${formatDate(new Date())}`, 40, 68);
    doc.setTextColor(0);

    doc.setFontSize(13);
    doc.text('Resumo executivo', 40, 110);
    autoTable(doc, {
      startY: 120,
      head: [['Métrica', 'Valor']],
      body: [
        ['Indicadores ativos', String(o.totalIndicators)],
        ['Dentro da meta', String(o.counts.GREEN)],
        ['Em atenção', String(o.counts.YELLOW)],
        ['Fora da meta', String(o.counts.RED)],
        ['Sem dados', String(o.counts.GRAY)],
        ['Atingimento medio', formatPercent(o.generalAttainment ?? 0)],
        ['Ações em aberto', String(o.openActions)],
        ['Ações atrasadas', String(o.overdueActions)],
        ['Desvios críticos', String(o.criticalDeviations)],
      ],
      theme: 'striped',
      headStyles: { fillColor: [22, 63, 101] },
      styles: { fontSize: 9 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 30;
    doc.setFontSize(13);
    doc.text('Indicadores ativos', 40, finalY);
    autoTable(doc, {
      startY: finalY + 10,
      head: [['Código', 'Indicador', 'Área', 'Período', 'Realizado', 'Farol']],
      body: indicators.data.map((i) => [
        i.code ?? '-',
        i.name,
        i.ownerNode.name,
        i.last ? periodRefLabel(i.last.periodRef) : '-',
        i.last ? formatNumber(i.last.value) : '-',
        i.last?.light ?? 'GRAY',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [22, 63, 101] },
      styles: { fontSize: 8 },
    });

    doc.save(`relatorio-executivo-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('PDF gerado');
  };

  return (
    <div>
      <PageHeader
        eyebrow="Visualização"
        tone="view"
        title="Relatórios e exportação"
        description="Relatórios executivos, históricos, indicadores, planos de ação e dados para auditoria."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Visualização', href: '/visualization' }, { label: 'Relatórios' }]}
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
            <Button onClick={generateExecutivePdf}>
              <FileText className="mr-2 h-4 w-4" />
              PDF executivo
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Indicadores" value={formatNumber(overview.data?.totalIndicators)} description="Base do relatório" icon={<FileSpreadsheet className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Atingimento geral" value={formatPercent(overview.data?.generalAttainment)} description="Resumo executivo" icon={<FileText className="h-4 w-4" />} tone="green" />
        <MetricCard title="Ações em aberto" value={formatNumber(overview.data?.openActions)} description={`${formatNumber(overview.data?.overdueActions)} atrasadas`} icon={<SlidersHorizontal className="h-4 w-4" />} tone="yellow" />
        <MetricCard title="Exportações" value={formatNumber(CSV_REPORTS.length + 1)} description="PDF e CSV" icon={<Download className="h-4 w-4" />} tone="purple" />
      </div>

      <FilterBar
        actions={
          <Button variant="outline" size="sm">
            <Save className="mr-2 h-4 w-4" />
            Salvar filtro
          </Button>
        }
      >
        <div>
          <NativeSelect value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="ALL">Todos os setores</option>
            <option value="CRITICAL">Apenas críticos</option>
            <option value="ACTIONS">Com plano de ação</option>
          </NativeSelect>
        </div>
        <div>
          <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
      </FilterBar>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Relatório executivo" description="Sumário em PDF para reuniões, com indicadores, faróis e prioridades.">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground">
              <FileText className="h-6 w-6" />
            </div>
            <Button onClick={generateExecutivePdf} className="sm:ml-auto">
              <FileText className="mr-2 h-4 w-4" />
              Gerar PDF
            </Button>
          </div>
        </SectionCard>

        {CSV_REPORTS.map((r) => (
          <SectionCard key={r.key} title={r.label} description={r.description}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid h-12 w-12 place-items-center rounded-lg bg-muted text-muted-foreground">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <Button variant="outline" onClick={() => downloadCsv(r.url, `${r.key}.csv`)} className="sm:ml-auto">
                <Download className="mr-2 h-4 w-4" />
                Baixar CSV
              </Button>
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
