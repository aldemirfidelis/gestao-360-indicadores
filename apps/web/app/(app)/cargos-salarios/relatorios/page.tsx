'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileBarChart } from 'lucide-react';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { FilterBar } from '@/components/platform/filter-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { downloadCsv } from '@/lib/compensation/format';
import { formatNumber } from '@/lib/utils';

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

// Rótulos legíveis para entidades e ações de auditoria.
const ENTITY_LABELS: Record<string, string> = {
  CompensationJobCatalog: 'Catálogo de cargos',
  CompensationJobDescription: 'Descrições',
  CompensationSalaryTable: 'Tabelas salariais',
  CompensationSalaryRange: 'Faixas salariais',
  CompensationMovementRequest: 'Movimentações',
  CompensationCycle: 'Ciclos de mérito',
  CompensationBudget: 'Orçamento',
  CompensationSalarySurvey: 'Pesquisas salariais',
  CompensationSimulation: 'Simulações',
  CompensationSalaryFit: 'Enquadramento',
  AppSetting: 'Configurações',
};

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    CREATE: 'Criação',
    UPDATE: 'Atualização',
    DUPLICATE: 'Duplicação',
    VERSION: 'Nova versão',
    INACTIVATE: 'Inativação',
    REACTIVATE: 'Reativação',
    PUBLISH: 'Publicação',
    REVISION: 'Revisão',
    SENSITIVE_VIEW: 'Visualização sensível',
    SETTINGS_UPDATED: 'Configurações salvas',
  };
  if (map[action]) return map[action];
  if (action.startsWith('MOVEMENT_')) return `Movimentação: ${action.replace('MOVEMENT_', '').toLowerCase()}`;
  if (action.startsWith('CYCLE_')) return 'Ciclo de mérito';
  return action;
}

export default function RelatoriosPage() {
  const [entityFilter, setEntityFilter] = useState('');
  const reportsQuery = useQuery<Report[]>({ queryKey: ['compensation', 'reports'], queryFn: () => api('/cargos-salarios/reports') });
  const auditQuery = useQuery<AuditLog[]>({ queryKey: ['compensation', 'audit'], queryFn: () => api('/cargos-salarios/audit?take=200') });

  const allAudit = auditQuery.data ?? [];
  const entities = useMemo(() => Array.from(new Set(allAudit.map((a) => a.entity))).sort(), [allAudit]);
  const audit = useMemo(() => allAudit.filter((a) => !entityFilter || a.entity === entityFilter), [allAudit, entityFilter]);

  function exportAudit() {
    const header = ['Data', 'Ação', 'Entidade', 'Registro', 'Resultado'];
    const body = audit.map((a) => [
      new Date(a.createdAt).toLocaleString('pt-BR'),
      actionLabel(a.action),
      ENTITY_LABELS[a.entity] ?? a.entity,
      a.recordLabel ?? a.entityId ?? '',
      a.result ?? 'SUCCESS',
    ]);
    downloadCsv(`auditoria-cargos-salarios-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...body]);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Relatórios e Auditoria"
        description="Central de relatórios do módulo e rastreabilidade das alterações e visualizações sensíveis."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Relatórios' }]}
      />
      <CompensationModuleNav />

      <SectionCard title="Relatórios disponíveis">
        {reportsQuery.isLoading ? (
          <LoadingState />
        ) : (reportsQuery.data ?? []).length === 0 ? (
          <EmptyState title="Sem relatórios" />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(reportsQuery.data ?? []).map((report) => (
              <div key={report.slug} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3">
                <div className="flex items-start gap-2.5">
                  <FileBarChart className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{report.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatNumber(report.records)} registros no escopo atual</div>
                  </div>
                </div>
                <Badge variant={report.exportable ? 'default' : 'secondary'}>{report.exportable ? 'Exportável' : 'Consulta'}</Badge>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <FilterBar
        className="mt-4"
        actions={
          <Button size="sm" variant="outline" onClick={exportAudit} disabled={audit.length === 0}>
            <Download className="mr-1.5 h-4 w-4" /> Exportar auditoria
          </Button>
        }
      >
        <div>
          <Label className="text-xs">Entidade</Label>
          <NativeSelect value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
            <option value="">Todas</option>
            {entities.map((entity) => (
              <option key={entity} value={entity}>{ENTITY_LABELS[entity] ?? entity}</option>
            ))}
          </NativeSelect>
        </div>
      </FilterBar>

      <SectionCard title="Auditoria recente" actions={<Badge variant="secondary">{audit.length} eventos</Badge>}>
        {auditQuery.isLoading ? (
          <LoadingState />
        ) : audit.length === 0 ? (
          <EmptyState title="Sem eventos" description="Ainda não há eventos de auditoria para o filtro atual." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 text-left">Data</th>
                  <th className="py-2 text-left">Ação</th>
                  <th className="py-2 text-left">Entidade</th>
                  <th className="py-2 text-left">Registro</th>
                  <th className="py-2 text-left">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((item) => (
                  <tr key={item.id} className="border-b border-border/60">
                    <td className="py-2 whitespace-nowrap">{new Date(item.createdAt).toLocaleString('pt-BR')}</td>
                    <td className="py-2">{actionLabel(item.action)}</td>
                    <td className="py-2">{ENTITY_LABELS[item.entity] ?? item.entity}</td>
                    <td className="py-2">{item.recordLabel ?? item.entityId ?? '-'}</td>
                    <td className="py-2"><Badge variant="secondary">{item.result ?? 'SUCCESS'}</Badge></td>
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
