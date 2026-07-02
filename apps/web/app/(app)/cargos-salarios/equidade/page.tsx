'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Printer, ShieldAlert, Upload, Users } from 'lucide-react';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { ImportProfilesDialog } from '@/components/compensation/import-profiles-dialog';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { EmptyState } from '@/components/platform/empty-state';
import { MetricCard } from '@/components/platform/metric-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/select';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { downloadCsv, formatMoney } from '@/lib/compensation/format';
import { openEquityReportPrint } from '@/lib/compensation/print-equity';
import type { EquityGroup, EquityReport } from '@/lib/compensation/types';
import { formatNumber } from '@/lib/utils';

function gapTone(gap: number | null): string {
  if (gap === null) return 'text-muted-foreground';
  if (gap <= -5) return 'text-status-red font-semibold';
  if (gap < 0) return 'text-status-yellow';
  return 'text-status-green';
}

function formatGap(gap: number | null): string {
  if (gap === null) return '—';
  return `${gap > 0 ? '+' : ''}${formatNumber(gap, { maximumFractionDigits: 1 })}%`;
}

export default function EquidadeSalarialPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['compensation:manage', 'org:positions:manage']);
  const [dimension, setDimension] = useState<'byGrade' | 'byFamily' | 'byArea'>('byGrade');
  const [importOpen, setImportOpen] = useState(false);

  const equityQuery = useQuery<EquityReport>({
    queryKey: ['compensation', 'equidade'],
    queryFn: () => api('/cargos-salarios/equidade'),
  });
  const report = equityQuery.data;
  const groups: EquityGroup[] = report ? report[dimension] : [];
  const lowCoverage = (report?.coverage.genderPct ?? 0) < 60;

  function exportCsv() {
    if (!report) return;
    const rows: Array<Array<string | number>> = [
      ['Dimensão', 'Grupo', 'Pessoas', 'Mulheres', 'Homens', 'Mediana F', 'Mediana M', 'Gap mediana %', 'Gap média %', 'Suprimido'],
    ];
    const push = (dim: string, list: EquityGroup[]) => {
      for (const group of list) {
        rows.push([
          dim,
          group.label,
          group.count,
          group.women,
          group.men,
          group.medianWomen ?? '',
          group.medianMen ?? '',
          group.gapMedianPct ?? '',
          group.gapMeanPct ?? '',
          group.suppressed ? 'Sim' : 'Não',
        ]);
      }
    };
    push('Geral', [report.global]);
    push('Grade', report.byGrade);
    push('Família', report.byFamily);
    push('Área', report.byArea);
    downloadCsv(`equidade-salarial-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Equidade Salarial"
        description="Gap salarial por gênero (mediana e média), representatividade em liderança e base do Relatório de Transparência Salarial (Lei 14.611/2023)."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Equidade Salarial' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="mr-1.5 h-4 w-4" /> Importar perfis
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!report}>
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
            <Button size="sm" onClick={() => report && openEquityReportPrint(report)} disabled={!report || report.masked}>
              <Printer className="mr-1.5 h-4 w-4" /> Relatório de Transparência
            </Button>
          </div>
        }
      />
      <CompensationModuleNav />

      {equityQuery.isLoading && <LoadingState />}

      {report && (
        <>
          {report.masked && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Você não possui permissão de visualização de salários em massa — os valores e gaps estão restritos; apenas contagens são exibidas.</span>
            </div>
          )}
          {lowCoverage && !report.masked && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
              <Users className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Apenas {formatNumber(report.coverage.genderPct, { maximumFractionDigits: 0 })}% do quadro tem gênero informado
                ({report.coverage.withGender} de {report.coverage.employees}). Importe os perfis para uma análise representativa.
              </span>
            </div>
          )}

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              title="Gap de mediana (geral)"
              value={report.global.suppressed || report.masked ? '—' : formatGap(report.global.gapMedianPct)}
              description="Mediana mulheres vs. homens"
              tone={report.global.gapMedianPct != null && report.global.gapMedianPct <= -5 ? 'red' : 'green'}
            />
            <MetricCard
              title="Gap de média (geral)"
              value={report.global.suppressed || report.masked ? '—' : formatGap(report.global.gapMeanPct)}
              description="Média mulheres vs. homens"
              tone={report.global.gapMeanPct != null && report.global.gapMeanPct <= -5 ? 'red' : 'green'}
            />
            <MetricCard
              title="Mulheres no quadro"
              value={report.global.count ? `${formatNumber((report.global.women / report.global.count) * 100, { maximumFractionDigits: 0 })}%` : '—'}
              description={`${report.global.women} de ${report.global.count} com gênero informado`}
              tone="blue"
            />
            <MetricCard
              title="Mulheres na liderança"
              value={report.leadership.womenSharePct == null ? '—' : `${formatNumber(report.leadership.womenSharePct, { maximumFractionDigits: 0 })}%`}
              description={`${report.leadership.women} de ${report.leadership.count} posições de liderança`}
              tone="purple"
            />
            <MetricCard
              title="Cobertura de dados"
              value={`${formatNumber(report.coverage.genderPct, { maximumFractionDigits: 0 })}%`}
              description={`Gênero informado · ${formatNumber(report.coverage.ratingPct, { maximumFractionDigits: 0 })}% com rating`}
              tone={lowCoverage ? 'yellow' : 'green'}
            />
          </div>

          <SectionCard
            title="Gap salarial por grupo"
            description={report.privacyNote}
            actions={
              <NativeSelect value={dimension} onChange={(e) => setDimension(e.target.value as typeof dimension)} className="h-8 w-32 text-xs">
                <option value="byGrade">Por grade</option>
                <option value="byFamily">Por família</option>
                <option value="byArea">Por área</option>
              </NativeSelect>
            }
            contentClassName="p-0"
          >
            {groups.length === 0 ? (
              <EmptyState
                title="Sem dados de gênero"
                description="Importe os perfis dos colaboradores (matrícula, gênero, admissão) para calcular o gap por grupo."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="border-b text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Grupo</th>
                      <th className="px-2 py-2 text-right">Pessoas</th>
                      <th className="px-2 py-2 text-right">Mulheres</th>
                      <th className="px-2 py-2 text-right">Homens</th>
                      <th className="px-2 py-2 text-right">Mediana F</th>
                      <th className="px-2 py-2 text-right">Mediana M</th>
                      <th className="px-2 py-2 text-right">Gap mediana</th>
                      <th className="px-4 py-2 text-right">Gap média</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => (
                      <tr key={group.label} className="border-b border-border/60">
                        <td className="px-4 py-2 font-medium">{group.label}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{group.count}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{group.women}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{group.men}</td>
                        {group.suppressed || report.masked ? (
                          <td colSpan={4} className="px-4 py-2 text-right">
                            <Badge variant="secondary" className="text-[10px]">
                              {report.masked ? 'Restrito' : 'Suprimido (n < 3)'}
                            </Badge>
                          </td>
                        ) : (
                          <>
                            <td className="px-2 py-2 text-right tabular-nums">{formatMoney(group.medianWomen)}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{formatMoney(group.medianMen)}</td>
                            <td className={`px-2 py-2 text-right tabular-nums ${gapTone(group.gapMedianPct)}`}>{formatGap(group.gapMedianPct)}</td>
                            <td className={`px-4 py-2 text-right tabular-nums ${gapTone(group.gapMeanPct)}`}>{formatGap(group.gapMeanPct)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SectionCard title="Liderança" description="Posições identificadas como liderança pelo nível hierárquico/trilha do catálogo de cargos.">
              {report.leadership.count === 0 ? (
                <EmptyState title="Sem posições de liderança identificadas" description="Preencha nível hierárquico ou trilha (gestão) no catálogo de cargos." />
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Mulheres na liderança</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums">
                      {report.leadership.womenSharePct == null ? '—' : `${formatNumber(report.leadership.womenSharePct, { maximumFractionDigits: 0 })}%`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      vs. {report.leadership.womenShareOverallPct == null ? '—' : `${formatNumber(report.leadership.womenShareOverallPct, { maximumFractionDigits: 0 })}%`} no quadro geral
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Gap de mediana na liderança</div>
                    <div className={`mt-1 text-2xl font-bold tabular-nums ${gapTone(report.leadership.gapMedianPct)}`}>
                      {report.leadership.suppressed || report.masked ? '—' : formatGap(report.leadership.gapMedianPct)}
                    </div>
                    <div className="text-xs text-muted-foreground">{report.leadership.count} posições de liderança com gênero informado</div>
                  </div>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Tempo de casa por gênero" description="Média em anos, a partir da data de admissão informada no perfil.">
              {report.global.avgTenureWomenMonths == null && report.global.avgTenureMenMonths == null ? (
                <EmptyState title="Sem datas de admissão" description="Importe as datas de admissão para comparar tempo de casa." />
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Mulheres</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums">
                      {report.global.avgTenureWomenMonths == null ? '—' : `${formatNumber(report.global.avgTenureWomenMonths / 12, { maximumFractionDigits: 1 })} anos`}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Homens</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums">
                      {report.global.avgTenureMenMonths == null ? '—' : `${formatNumber(report.global.avgTenureMenMonths / 12, { maximumFractionDigits: 1 })} anos`}
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Metodologia: gap = mediana (ou média) salarial das mulheres ÷ dos homens − 1, no padrão do Relatório de Transparência
            Salarial e de Critérios Remuneratórios (Lei 14.611/2023 e Decreto 11.795/2023). Valores negativos indicam remuneração
            feminina inferior. {report.privacyNote}
          </p>
        </>
      )}

      <ImportProfilesDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
