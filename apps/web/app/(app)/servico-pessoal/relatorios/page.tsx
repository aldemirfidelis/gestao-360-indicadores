'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, ComposedChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ArrowDownRight, ArrowUpRight, CalendarClock, Clock, Download, FileSpreadsheet, Stethoscope, TrendingUp, Users,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/platform/empty-state';
import { api, getAccessToken } from '@/lib/api';

interface Overview {
  periodRef: string; headcount: number; admissionsMonth: number; terminationsMonth: number;
  turnoverRate12m: number; absenteeismRate: number; leaveDaysMonth: number; overtimeHoursMonth: number; pontoFaltasMonth: number;
}
interface TurnoverBucket { key: string; label: string; admissions: number; terminations: number; headcountEnd: number }
interface Turnover {
  from: string; to: string; headcountStart: number; headcountEnd: number; admissions: number; terminations: number;
  averageHeadcount: number; turnoverRate: number; monthly: TurnoverBucket[]; byArea: TurnoverBucket[];
}
interface Absenteeism {
  periodRef: string; headcount: number; businessDays: number; totalLeaveDays: number; pontoFaltas: number; absenteeismRate: number;
  byType: Array<{ type: string; days: number }>; byArea: Array<{ key: string; label: string; days: number }>;
  detail: Array<{ id: string; employee: string; area: string; type: string; startDate: string; endDate: string | null; days: number; cid: string | null }>;
}
interface Overtime {
  periodRef: string; status: string; totalOvertimeHours: number; totalAbsentDays: number;
  byArea: Array<{ key: string; label: string; overtimeHours: number }>;
  rows: Array<{ employee: string; registrationId: string | null; area: string; overtimeHours: number; balanceMinutes: number; workedHours: number; absentDays: number; inconsistentDays: number }>;
}

const LEAVE_LABELS: Record<string, string> = {
  ATESTADO: 'Atestado', ACIDENTE_TRABALHO: 'Acidente de trabalho', MATERNIDADE: 'Licença-maternidade',
  PATERNIDADE: 'Licença-paternidade', LICENCA_NAO_REMUNERADA: 'Licença não remunerada', FALTA_JUSTIFICADA: 'Falta justificada', OUTRO: 'Outro',
};
const COLORS = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#65a30d', '#db2777'];

export default function PersonnelReportsPage() {
  const [ref, setRef] = useState(currentRef());
  const [range, setRange] = useState(() => defaultRange());

  const overview = useQuery<Overview>({ queryKey: ['dp-reports', 'overview', ref], queryFn: () => api(`/personnel/reports/overview?ref=${ref}`) });
  const turnover = useQuery<Turnover>({ queryKey: ['dp-reports', 'turnover', range.from, range.to], queryFn: () => api(`/personnel/reports/turnover?from=${range.from}&to=${range.to}`) });
  const absenteeism = useQuery<Absenteeism>({ queryKey: ['dp-reports', 'absenteeism', ref], queryFn: () => api(`/personnel/reports/absenteeism?ref=${ref}`) });
  const overtime = useQuery<Overtime>({ queryKey: ['dp-reports', 'overtime', ref], queryFn: () => api(`/personnel/reports/overtime?ref=${ref}`) });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Relatórios de Pessoal"
        eyebrow="Serviço Pessoal"
        tone="admin"
        description="Turnover, absenteísmo, horas extras e exportação para a folha — a partir dos dados reais de ponto, afastamentos e movimentações."
        actions={
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Competência</Label>
              <Input type="month" value={ref} onChange={(event) => setRef(event.target.value)} className="w-40" />
            </div>
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="turnover">Turnover</TabsTrigger>
          <TabsTrigger value="absenteeism">Absenteísmo</TabsTrigger>
          <TabsTrigger value="overtime">Horas extras</TabsTrigger>
          <TabsTrigger value="export">Exportar folha</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={Users} label="Headcount ativo" value={overview.data?.headcount ?? 0} loading={overview.isLoading} />
            <Metric icon={ArrowUpRight} label="Admissões no mês" value={overview.data?.admissionsMonth ?? 0} loading={overview.isLoading} tone="green" />
            <Metric icon={ArrowDownRight} label="Desligamentos no mês" value={overview.data?.terminationsMonth ?? 0} loading={overview.isLoading} tone="red" />
            <Metric icon={TrendingUp} label="Turnover (12 meses)" value={`${overview.data?.turnoverRate12m ?? 0}%`} loading={overview.isLoading} tone="purple" />
            <Metric icon={Stethoscope} label="Absenteísmo no mês" value={`${overview.data?.absenteeismRate ?? 0}%`} loading={overview.isLoading} tone="yellow" />
            <Metric icon={CalendarClock} label="Dias de afastamento" value={overview.data?.leaveDaysMonth ?? 0} loading={overview.isLoading} />
            <Metric icon={Clock} label="Horas extras no mês" value={`${overview.data?.overtimeHoursMonth ?? 0}h`} loading={overview.isLoading} tone="green" />
            <Metric icon={CalendarClock} label="Faltas de ponto" value={overview.data?.pontoFaltasMonth ?? 0} loading={overview.isLoading} tone="red" />
          </div>
          <Card><CardContent className="p-4 text-sm text-muted-foreground">
            Os indicadores usam a competência selecionada no topo. O turnover é calculado sobre os últimos 12 meses;
            o absenteísmo considera os afastamentos registrados sobre a capacidade de dias úteis; as horas extras vêm do saldo positivo do espelho de ponto.
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="turnover" className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} className="w-40" /></div>
            <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} className="w-40" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={ArrowUpRight} label="Admissões" value={turnover.data?.admissions ?? 0} loading={turnover.isLoading} tone="green" />
            <Metric icon={ArrowDownRight} label="Desligamentos" value={turnover.data?.terminations ?? 0} loading={turnover.isLoading} tone="red" />
            <Metric icon={Users} label="Headcount (início→fim)" value={`${turnover.data?.headcountStart ?? 0}→${turnover.data?.headcountEnd ?? 0}`} loading={turnover.isLoading} />
            <Metric icon={TrendingUp} label="Turnover no período" value={`${turnover.data?.turnoverRate ?? 0}%`} loading={turnover.isLoading} tone="purple" />
          </div>
          <Card><CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Movimentações por mês</h2>
            {turnover.data?.monthly.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={turnover.data.monthly}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" fontSize={12} /><YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="admissions" name="Admissões" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="terminations" name="Desligamentos" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  <Line dataKey="headcountEnd" name="Headcount" stroke="#2563eb" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : <EmptyState title="Sem movimentações no período" description="Ajuste o intervalo de datas." />}
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Por área</h2>
            <SimpleTable
              head={['Área', 'Admissões', 'Desligamentos', 'Headcount']}
              rows={(turnover.data?.byArea ?? []).map((bucket) => [bucket.label, bucket.admissions, bucket.terminations, bucket.headcountEnd])}
              empty="Sem áreas com movimentação."
            />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="absenteeism" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={Stethoscope} label="Taxa de absenteísmo" value={`${absenteeism.data?.absenteeismRate ?? 0}%`} loading={absenteeism.isLoading} tone="yellow" />
            <Metric icon={CalendarClock} label="Dias de afastamento" value={absenteeism.data?.totalLeaveDays ?? 0} loading={absenteeism.isLoading} />
            <Metric icon={CalendarClock} label="Faltas de ponto" value={absenteeism.data?.pontoFaltas ?? 0} loading={absenteeism.isLoading} tone="red" />
            <Metric icon={Users} label="Dias úteis / headcount" value={`${absenteeism.data?.businessDays ?? 0} / ${absenteeism.data?.headcount ?? 0}`} loading={absenteeism.isLoading} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold">Dias por tipo</h2>
              {absenteeism.data?.byType.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={absenteeism.data.byType} dataKey="days" nameKey="type" outerRadius={90} label={(entry) => leaveLabel(String(entry.type))}>
                      {absenteeism.data.byType.map((entry, index) => <Cell key={entry.type} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value} dias`, leaveLabel(String(name))]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyState title="Sem afastamentos" description="Nenhum afastamento na competência." />}
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold">Dias por área</h2>
              {absenteeism.data?.byArea.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={absenteeism.data.byArea} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" fontSize={12} /><YAxis type="category" dataKey="label" width={120} fontSize={12} />
                    <Tooltip formatter={(value) => [`${value} dias`, 'Afastamento']} />
                    <Bar dataKey="days" fill="#d97706" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState title="Sem dados" description="Nenhum afastamento por área." />}
            </CardContent></Card>
          </div>
          <Card><CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Afastamentos da competência</h2>
            <SimpleTable
              head={['Colaborador', 'Área', 'Tipo', 'Início', 'Fim', 'Dias', 'CID']}
              rows={(absenteeism.data?.detail ?? []).map((row) => [row.employee, row.area, leaveLabel(row.type), fmtDate(row.startDate), row.endDate ? fmtDate(row.endDate) : 'Em aberto', row.days, row.cid ?? '—'])}
              empty="Nenhum afastamento registrado nesta competência."
            />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="overtime" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={Clock} label="Total de horas extras" value={`${overtime.data?.totalOvertimeHours ?? 0}h`} loading={overtime.isLoading} tone="green" />
            <Metric icon={CalendarClock} label="Faltas de ponto" value={overtime.data?.totalAbsentDays ?? 0} loading={overtime.isLoading} tone="red" />
            <Metric icon={Users} label="Competência" value={overtime.data?.periodRef ?? ref} loading={overtime.isLoading} />
            <Metric icon={TrendingUp} label="Situação" value={overtime.data?.status === 'CLOSED' ? 'Fechada' : 'Aberta'} loading={overtime.isLoading} tone={overtime.data?.status === 'CLOSED' ? 'green' : 'yellow'} />
          </div>
          <Card><CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Horas extras por área</h2>
            {overtime.data?.byArea.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={overtime.data.byArea}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" fontSize={12} /><YAxis fontSize={12} />
                  <Tooltip formatter={(value) => [`${value}h`, 'Horas extras']} />
                  <Bar dataKey="overtimeHours" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState title="Sem horas extras" description="Nenhum saldo positivo de ponto na competência." />}
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Detalhe por colaborador</h2>
            <SimpleTable
              head={['Colaborador', 'Área', 'Horas extras', 'Horas trabalhadas', 'Faltas', 'Inconsistências']}
              rows={(overtime.data?.rows ?? []).map((row) => [row.employee, row.area, `${row.overtimeHours}h`, `${row.workedHours}h`, row.absentDays, row.inconsistentDays])}
              empty="Sem colaboradores com ponto nesta competência."
            />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card><CardContent className="space-y-4 p-6">
            <div>
              <h2 className="text-lg font-semibold">Exportação para a folha de pagamento</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Consolida a competência <strong>{ref}</strong> por colaborador — horas previstas, trabalhadas, extras, saldo, faltas de ponto e dias de afastamento —
                pronta para conferência e importação na folha (Apdata/SAP/planilha).
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => downloadPayroll(ref, 'xlsx')}><FileSpreadsheet className="mr-2 h-4 w-4" />Baixar XLSX</Button>
              <Button variant="outline" onClick={() => downloadPayroll(ref, 'csv')}><Download className="mr-2 h-4 w-4" />Baixar CSV</Button>
            </div>
            <Badge variant="outline" className="border-status-blue/40 text-status-blue">Competência {ref}</Badge>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ icon: Icon, label, value, loading, tone = 'blue' }: { icon: typeof Users; label: string; value: string | number; loading?: boolean; tone?: string }) {
  const colors: Record<string, string> = {
    blue: 'text-status-blue bg-status-blue/10', yellow: 'text-status-yellow bg-status-yellow/10',
    red: 'text-status-red bg-status-red/10', green: 'text-status-green bg-status-green/10', purple: 'text-status-purple bg-status-purple/10',
  };
  return (
    <Card><CardContent className="flex items-center gap-3 p-4">
      <div className={`rounded-lg p-2 ${colors[tone]}`}><Icon className="h-5 w-5" /></div>
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">{loading ? '—' : value}</div>
      </div>
    </CardContent></Card>
  );
}

function SimpleTable({ head, rows, empty }: { head: string[]; rows: Array<Array<string | number>>; empty: string }) {
  if (!rows.length) return <EmptyState title={empty} description="" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground">{head.map((cell) => <th key={cell} className="px-2 py-2 font-medium">{cell}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index} className="border-b last:border-0">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-2 py-2">{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function leaveLabel(type: string) { return LEAVE_LABELS[type] ?? type; }
function fmtDate(value: string) { return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' }); }
function currentRef() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; }
function defaultRange() {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 11, 1)).toISOString().slice(0, 10);
  return { from, to };
}

async function downloadPayroll(ref: string, format: 'csv' | 'xlsx') {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';
    const token = getAccessToken();
    const res = await fetch(`${apiUrl}/personnel/reports/payroll/${ref}/export.${format}`, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error('Falha ao gerar a exportação');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `folha-${ref}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error('Não foi possível baixar a exportação da folha');
  }
}
