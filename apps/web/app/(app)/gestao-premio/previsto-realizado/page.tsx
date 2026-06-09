'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { TrendingUp, AlertTriangle, CheckCircle2, MinusCircle, ClipboardList } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';

interface CompetenceRef { id: string; label: string; status: string; program: { code: string; name: string } }
interface PxrRow {
  indicatorId: string; code: string; name: string; unit: string | null; kind: string; weight: number | null;
  hasActual: boolean; realized: number | null; target: number | null; zero: number | null;
  deviation: number | null; deviationPercent: number | null; achievementPercent: number | null;
  gainPercent: number | null; rangeLabel: string | null; onTarget: boolean | null; actualStatus: string | null;
}
interface Pxr {
  competenceId: string;
  summary: { indicators: number; withActual: number; missingActual: number; offTarget: number };
  rows: PxrRow[];
}

function fmt(n: number | null) { return n === null || n === undefined ? '—' : String(n); }

export default function PrizePrevistoRealizadoPage() {
  const [competenceId, setCompetenceId] = useState('');
  const { data: competences = [] } = useQuery({ queryKey: ['prize-competences-ref'], queryFn: () => api<CompetenceRef[]>('/prize/competences') });
  const { data: pxr, isLoading } = useQuery({
    queryKey: ['prize-pxr-view', competenceId],
    queryFn: () => api<Pxr>(`/prize/actuals/previsto-realizado/${competenceId}`),
    enabled: !!competenceId,
  });

  const StatusIcon = ({ r }: { r: PxrRow }) =>
    !r.hasActual ? <MinusCircle className="h-4 w-4 text-muted-foreground" /> :
    r.onTarget ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> :
    <AlertTriangle className="h-4 w-4 text-amber-600" />;

  return (
    <div>
      <PageHeader
        title="Previsto × Realizado"
        eyebrow="Gestão de Prêmio"
        description="Acompanhe meta × realizado, desvios, atingimento e faixa antes do fechamento. Atue nos indicadores fora da meta."
        tone="view"
        breadcrumbs={[{ label: 'Gestão de Prêmio', href: '/gestao-premio' }, { label: 'Previsto × Realizado' }]}
      />

      <div className="mb-4 flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Competência:</Label>
        <NativeSelect value={competenceId} onChange={(e) => setCompetenceId(e.target.value)} className="max-w-sm">
          <option value="">Selecione…</option>
          {competences.map((c) => <option key={c.id} value={c.id}>{c.program.code} — {c.label}</option>)}
        </NativeSelect>
      </div>

      {!competenceId ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <TrendingUp className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Selecione uma competência para acompanhar o desempenho.</p>
        </CardContent></Card>
      ) : isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card><CardContent className="p-4"><div className="text-2xl font-semibold">{pxr?.summary.indicators ?? 0}</div><div className="text-xs text-muted-foreground">Indicadores</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-2xl font-semibold text-emerald-600">{pxr?.summary.withActual ?? 0}</div><div className="text-xs text-muted-foreground">Com realizado</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-2xl font-semibold text-muted-foreground">{pxr?.summary.missingActual ?? 0}</div><div className="text-xs text-muted-foreground">Sem realizado</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-2xl font-semibold text-amber-600">{pxr?.summary.offTarget ?? 0}</div><div className="text-xs text-muted-foreground">Fora da meta</div></CardContent></Card>
          </div>

          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left"></th>
                    <th className="px-3 py-2 text-left">Indicador</th>
                    <th className="px-3 py-2 text-right">Meta</th>
                    <th className="px-3 py-2 text-right">Realizado</th>
                    <th className="px-3 py-2 text-right">Desvio</th>
                    <th className="px-3 py-2 text-right">Atingimento</th>
                    <th className="px-3 py-2 text-left">Faixa</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {pxr?.rows.map((r) => (
                    <tr key={r.indicatorId} className={`border-b border-border/40 ${r.onTarget === false ? 'bg-amber-50/50' : ''}`}>
                      <td className="px-3 py-2"><StatusIcon r={r} /></td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.code}{r.weight ? ` · peso ${r.weight}` : ''}</div>
                      </td>
                      <td className="px-3 py-2 text-right">{fmt(r.target)}</td>
                      <td className="px-3 py-2 text-right font-medium">{fmt(r.realized)}</td>
                      <td className={`px-3 py-2 text-right ${(r.deviation ?? 0) < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {r.deviation === null ? '—' : `${r.deviation > 0 ? '+' : ''}${r.deviation}`}
                        {r.deviationPercent !== null && <span className="ml-1 text-xs text-muted-foreground">({r.deviationPercent}%)</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{r.achievementPercent === null ? '—' : `${r.achievementPercent}%`}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.rangeLabel ?? '—'}</td>
                      <td className="px-3 py-2 text-right">
                        {r.onTarget === false && (
                          <div className="flex justify-end gap-1">
                            <Link href={`/deviations`}><Button size="sm" variant="ghost" title="Abrir análise de causa"><AlertTriangle className="h-3.5 w-3.5" /></Button></Link>
                            <Link href={`/actions`}><Button size="sm" variant="ghost" title="Abrir plano de ação"><ClipboardList className="h-3.5 w-3.5" /></Button></Link>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            Indicadores fora da meta podem ser tratados via Análise de Causa e Plano de Ação. O impacto financeiro no prêmio será calculado pelo Motor de Apuração (próxima fase).
          </p>
        </div>
      )}
    </div>
  );
}
