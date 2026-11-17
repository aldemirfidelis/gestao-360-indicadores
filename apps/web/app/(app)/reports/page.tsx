'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, FileText, Printer, SlidersHorizontal } from 'lucide-react';
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
  { key: 'indicators', label: 'Relatório por indicador', description: 'Catálogo completo com último realizado.', url: '/reports/indicators.csv' },
  { key: 'results', label: 'Histórico de lançamentos', description: 'Realizados, faróis, metas e atingimento.', url: '/reports/results.csv' },
  { key: 'actions', label: 'Planos de ação', description: 'Status, prazos, responsáveis e prioridades.', url: '/reports/actions.csv' },
  { key: 'deviations', label: 'Não conformidades', description: 'Severidade, planos, prazos e histórico.', url: '/reports/deviations.csv' },
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
      toast.success('Baixar iniciado');
    } catch (e: any) {
      toast.error(`Falha ao baixar: ${e.message}`);
    }
  };

  const generateExecutivePdf = async () => {
    if (!overview.data || !indicators.data) {
      toast.error('Aguarde os dados carregarem');
      return;
    }
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt' });
    const o = overview.data;
    doc.setFontSize(18);
    doc.text('Relatório Executivo - Gestão 360 Indicadores', 40, 50);
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
        ['Atingimento médio', formatPercent(o.generalAttainment ?? 0)],
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

    doc.save(`relatório-executivo-${new Date().toISOString().slice(0, 10)}.pdf`);
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
        summary={
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MetricCard title="Indicadores" value={formatNumber(overview.data?.totalIndicators)} description="Base do relatório" icon={<FileSpreadsheet className="h-4 w-4" />} tone="blue" href="/indicators" />
            <MetricCard title="Atingimento geral" value={formatPercent(overview.data?.generalAttainment)} description="Resumo executivo" icon={<FileText className="h-4 w-4" />} tone="green" href="/visualization" />
            <MetricCard title="Ações em aberto" value={formatNumber(overview.data?.openActions)} description={`${formatNumber(overview.data?.overdueActions)} atrasadas`} icon={<SlidersHorizontal className="h-4 w-4" />} tone="yellow" href="/actions" />
          </div>
        }
      />

      <FilterBar>
        <div>
          <NativeSelect aria-label="Filtrar relatório" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="ALL">Todos os setores</option>
            <option value="CRITICAL">Apenas críticos</option>
            <option value="ACTIONS">Com plano de ação</option>
          </NativeSelect>
        </div>
        <div>
          <Input aria-label="Mês do relatório" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
      </FilterBar>

      <SectionCard title="Exportar dados" description="Escolha o conteúdo para baixar em CSV.">
        <div className="divide-y">
        {CSV_REPORTS.map((r) => (
            <div key={r.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="text-sm font-medium">{r.label}</p><p className="text-xs text-muted-foreground">{r.description}</p></div>
              <Button size="sm" variant="outline" aria-label={`Baixar ${r.label} em CSV`} onClick={() => downloadCsv(r.url, `${r.key}.csv`)}>
                <Download className="mr-2 h-4 w-4" />
                Baixar CSV
              </Button>
            </div>
        ))}
        </div>
      </SectionCard>
    </div>
  );
}
