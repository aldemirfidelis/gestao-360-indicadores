'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { CompensationModuleNav } from '@/components/compensation/module-nav';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

interface FitRow {
  employeeId: string;
  registrationId: string | null;
  employeeName: string;
  orgNode: { name: string } | null;
  job: { name: string } | null;
  grade: string | null;
  band: string | null;
  currentSalary: number | null;
  minSalary: number | null;
  midpointSalary: number | null;
  maxSalary: number | null;
  compaRatio: number | null;
  positioningPercent: number | null;
  situation: string;
  budgetStatus: string | null;
  salaryMasked: boolean;
}

const situations = [
  '',
  'ABAIXO_DA_FAIXA',
  'PROXIMO_AO_MINIMO',
  'DENTRO_DA_FAIXA',
  'PROXIMO_AO_PONTO_MEDIO',
  'ACIMA_DO_PONTO_MEDIO',
  'PROXIMO_AO_TETO',
  'ACIMA_DA_FAIXA',
  'SEM_TABELA',
  'PENDENTE_ANALISE',
];

export default function EnquadramentoPage() {
  const searchParams = useSearchParams();
  const [situation, setSituation] = useState(searchParams.get('situation') ?? '');
  const params = useMemo(() => {
    const qs = new URLSearchParams();
    if (situation) qs.set('situation', situation);
    return qs.toString();
  }, [situation]);
  const fitQuery = useQuery<FitRow[]>({
    queryKey: ['compensation', 'enquadramento', params],
    queryFn: () => api(`/cargos-salarios/enquadramento${params ? `?${params}` : ''}`),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Cargos e Salários"
        title="Enquadramento Salarial"
        description="Análise de salário atual contra mínimo, ponto médio e máximo da faixa, com compa-ratio calculado no backend."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cargos e Salários', href: '/cargos-salarios' }, { label: 'Enquadramento' }]}
      />
      <CompensationModuleNav />

      <SectionCard title="Filtros">
        <div className="max-w-sm">
          <Label>Situação</Label>
          <NativeSelect value={situation} onChange={(event) => setSituation(event.target.value)}>
            <option value="">Todas</option>
            {situations.filter(Boolean).map((item) => <option key={item} value={item}>{item}</option>)}
          </NativeSelect>
        </div>
      </SectionCard>

      <SectionCard title="Colaboradores" className="mt-4">
        {fitQuery.isLoading && <LoadingState />}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 text-left">Matricula</th>
                <th className="py-2 text-left">Colaborador</th>
                <th className="py-2 text-left">Área</th>
                <th className="py-2 text-left">Cargo</th>
                <th className="py-2 text-left">Faixa</th>
                <th className="py-2 text-right">Salário</th>
                <th className="py-2 text-right">Min / Medio / Max</th>
                <th className="py-2 text-right">Compa</th>
                <th className="py-2 text-left">Situação</th>
              </tr>
            </thead>
            <tbody>
              {(fitQuery.data ?? []).map((row) => (
                <tr key={row.employeeId} className="border-b border-border/60">
                  <td className="py-2 font-mono text-xs">{row.registrationId ?? '-'}</td>
                  <td className="py-2 font-medium">{row.employeeName}</td>
                  <td className="py-2">{row.orgNode?.name ?? '-'}</td>
                  <td className="py-2">{row.job?.name ?? '-'}</td>
                  <td className="py-2">{row.band ?? '-'}</td>
                  <td className="py-2 text-right">{row.salaryMasked ? 'Restrito' : formatMoney(row.currentSalary)}</td>
                  <td className="py-2 text-right">{row.salaryMasked ? 'Restrito' : `${formatMoney(row.minSalary)} / ${formatMoney(row.midpointSalary)} / ${formatMoney(row.maxSalary)}`}</td>
                  <td className="py-2 text-right">{row.compaRatio === null ? '-' : formatNumber(row.compaRatio)}</td>
                  <td className="py-2"><Badge variant={row.situation.includes('ABAIXO') || row.situation.includes('ACIMA_DA_FAIXA') ? 'destructive' : 'secondary'}>{row.situation}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function formatMoney(value: number | null) {
  return value === null ? '-' : formatNumber(value, { style: 'currency', currency: 'BRL' });
}

