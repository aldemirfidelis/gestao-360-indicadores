'use client';

// Extraido de app/(app)/comunicacao/page.tsx (decomposicao Fase 4).
import { AlertTriangle, BookOpenCheck, ClipboardCheck, FileText, Megaphone, Sparkles, Vote } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatNumber, formatPercent } from '@/lib/utils';
import { toneClass, type CommunicationOverview } from './shared';
import { SmallFact } from './shared-widgets';

export function Dashboard({ metrics, loading }: { metrics?: CommunicationOverview['metrics']; loading: boolean }) {
  const items = [
    { label: 'Publicados no mês', value: metrics?.publishedThisMonth ?? 0, detail: `${metrics?.scheduled ?? 0} agendados`, icon: Megaphone, tone: 'blue' },
    { label: 'Rascunhos', value: metrics?.drafts ?? 0, detail: `${metrics?.pendingApproval ?? 0} aguardando aprovação`, icon: FileText, tone: 'slate' },
    { label: 'Visualizações', value: metrics?.totalViews ?? 0, detail: `Leitura ${formatPercent(metrics?.readRate ?? 0)}`, icon: BookOpenCheck, tone: 'green' },
    { label: 'Confirmação', value: formatPercent(metrics?.confirmationRate ?? 0), detail: `${metrics?.mandatoryPending ?? 0} obrigatórios pendentes`, icon: ClipboardCheck, tone: 'amber' },
    { label: 'Enquetes', value: formatPercent(metrics?.pollResponseRate ?? 0), detail: 'taxa de resposta', icon: Vote, tone: 'violet' },
    { label: 'Críticos', value: metrics?.critical ?? 0, detail: `${metrics?.expired ?? 0} vencidos`, icon: AlertTriangle, tone: 'red' },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label} className="min-w-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-xs font-medium uppercase text-muted-foreground">{item.label}</p>
                <p className="mt-2 break-words text-2xl font-semibold">{loading ? '-' : item.value}</p>
              </div>
              <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-md', toneClass(item.tone))}>
                <item.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 break-words text-xs text-muted-foreground">{loading ? 'Carregando...' : item.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function EngagementCharts({ data }: { data?: CommunicationOverview }) {
  const readByArea = data?.charts?.readByArea?.slice(0, 8) ?? [];
  const typeData = data?.charts?.engagementByType ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Engajamento</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={readByArea} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="area" width={120} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => formatNumber(Number(value))} />
              <Bar dataKey="read" fill="#2563eb" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={typeData} margin={{ left: -16, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="type" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="views" fill="#16a34a" radius={[6, 6, 0, 0]} />
              <Bar dataKey="responses" fill="#d97706" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function IntegrationSignals({ data }: { data?: CommunicationOverview }) {
  const signals = data?.integrationSignals;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrações do Gestão 360</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <SmallFact label="Indicadores vermelhos" value={signals?.redIndicators ?? 0} />
          <SmallFact label="Ações atrasadas" value={signals?.overdueActions ?? 0} />
          <SmallFact label="Ciência documental" value={signals?.docsNeedingRead ?? 0} />
          <SmallFact label="Reuniões futuras" value={signals?.upcomingMeetings ?? 0} />
        </div>
        <div className="space-y-2">
          {(signals?.suggestions ?? []).map((item) => (
            <div key={item} className="flex min-w-0 gap-2 rounded-md border p-3 text-sm">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="break-words">{item}</span>
            </div>
          ))}
          {!signals?.suggestions?.length && <p className="text-sm text-muted-foreground">Sem sugestões automáticas no momento.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function MetricsPanel({ data }: { data?: CommunicationOverview }) {
  const evolution = data?.charts?.monthlyEvolution ?? [];
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Evolução mensal</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolution} margin={{ left: -16, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="published" stroke="#2563eb" strokeWidth={2} />
              <Line type="monotone" dataKey="views" stroke="#16a34a" strokeWidth={2} />
              <Line type="monotone" dataKey="confirmations" stroke="#d97706" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Pendências por gestor</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(data?.charts?.pendingByManager ?? []).slice(0, 10).map((item) => (
            <div key={`${item.manager}-${item.area}`} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
              <span className="min-w-0 break-words">{item.manager} · {item.area}</span>
              <Badge variant={item.pending > 0 ? 'destructive' : 'secondary'}>{item.pending}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

