'use client';

import { useQuery } from '@tanstack/react-query';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/utils';

interface Report {
  slug: string;
  name: string;
  records: number;
  exportable: boolean;
}

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  recordLabel: string | null;
  createdAt: string;
  result: string | null;
}

export default function RelatoriosPage() {
  const reportsQuery = useQuery<Report[]>({ queryKey: ['compensation', 'reports'], queryFn: () => api('/cargos-salarios/reports') });
  const auditQuery = useQuery<AuditLog[]>({ queryKey: ['compensation', 'audit'], queryFn: () => api('/cargos-salarios/audit?take=20') });

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salarios"
        title="Relatorios e Auditoria"
        description="Central de relatorios do modulo e ultimos eventos de rastreabilidade."
        breadcrumbs={[{ label: 'Inicio', href: '/' }, { label: 'Cargos e Salarios', href: '/cargos-salarios' }, { label: 'Relatorios' }]}
      />
      <CompensationModuleNav />

      <SectionCard title="Relatorios disponiveis">
        {reportsQuery.isLoading && <LoadingState />}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(reportsQuery.data ?? []).map((report) => (
            <div key={report.slug} className="border border-border/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{report.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatNumber(report.records)} registros no escopo atual</div>
                </div>
                <Badge variant={report.exportable ? 'default' : 'secondary'}>{report.exportable ? 'Exportavel' : 'Consulta'}</Badge>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Auditoria recente" className="mt-4">
        {auditQuery.isLoading && <LoadingState />}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 text-left">Data</th>
                <th className="py-2 text-left">Acao</th>
                <th className="py-2 text-left">Entidade</th>
                <th className="py-2 text-left">Registro</th>
                <th className="py-2 text-left">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {(auditQuery.data ?? []).map((item) => (
                <tr key={item.id} className="border-b border-border/60">
                  <td className="py-2">{formatDate(item.createdAt)}</td>
                  <td className="py-2">{item.action}</td>
                  <td className="py-2">{item.entity}</td>
                  <td className="py-2">{item.recordLabel ?? item.entityId ?? '-'}</td>
                  <td className="py-2"><Badge variant="secondary">{item.result ?? 'SUCCESS'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

